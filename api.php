<?php
declare(strict_types=1);

require_once __DIR__ . '/api-lib.php';
require_once __DIR__ . '/payment-lib.php';
require_once __DIR__ . '/lib/monitoring.php';
require_once __DIR__ . '/lib/metrics.php';

// Controllers
require_once __DIR__ . '/controllers/HealthController.php';
require_once __DIR__ . '/controllers/PaymentController.php';
require_once __DIR__ . '/controllers/AdminDataController.php';
require_once __DIR__ . '/controllers/AppointmentController.php';
require_once __DIR__ . '/controllers/CallbackController.php';
require_once __DIR__ . '/controllers/ReviewController.php';
require_once __DIR__ . '/controllers/AvailabilityController.php';
require_once __DIR__ . '/controllers/FigoConfigController.php';
require_once __DIR__ . '/controllers/AnalyticsController.php';
require_once __DIR__ . '/controllers/MetricsController.php';

init_monitoring();

apply_security_headers(false);

$requestStartedAt = microtime(true);

function api_should_hide_error_message(string $message): bool
{
    $trimmed = trim($message);
    if ($trimmed === '') {
        return true;
    }

    $technicalPatterns = [
        '/call to undefined function/i',
        '/fatal error/i',
        '/uncaught/i',
        '/stack trace/i',
        '/syntax error/i',
        '/on line \d+/i',
        '/ in \\/.+\\.php/i',
        '/mb_strlen/i',
        '/pdoexception/i',
        '/sqlstate/i'
    ];

    foreach ($technicalPatterns as $pattern) {
        if (@preg_match($pattern, $trimmed) === 1) {
            return true;
        }
    }

    return false;
}

function api_error_message_for_client(Throwable $error, int $status): string
{
    $rawMessage = trim((string) $error->getMessage());
    $debugEnabled = parse_bool(getenv('PIELARMONIA_DEBUG_EXCEPTIONS') ?: false);
    if ($debugEnabled && $rawMessage !== '') {
        return $rawMessage;
    }

    $isClientError = $status >= 400 && $status < 500;
    if ($isClientError && $rawMessage !== '' && !api_should_hide_error_message($rawMessage)) {
        return $rawMessage;
    }

    return 'Error interno del servidor';
}

function api_should_audit_public_get(string $resource): bool
{
    $enabled = parse_bool(getenv('PIELARMONIA_AUDIT_PUBLIC_GET') ?: false);
    if ($enabled) {
        return true;
    }

    // Keep high-value GET traces even when broad public GET audit is disabled.
    return in_array($resource, ['health', 'metrics'], true);
}

function api_should_audit_health(): bool
{
    return parse_bool(getenv('PIELARMONIA_AUDIT_HEALTH') ?: false);
}

set_exception_handler(static function (Throwable $e): void {
    $code = ($e->getCode() >= 400 && $e->getCode() < 600) ? (int) $e->getCode() : 500;
    if (!headers_sent()) {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
    }
    if (function_exists('get_logger')) {
        get_logger()->error('Piel en Armonía API uncaught: ' . $e->getMessage(), [
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'trace' => $e->getTraceAsString()
        ]);
    } else {
        error_log('Piel en Armonía API uncaught: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    }

    if (function_exists('\Sentry\captureException')) {
        \Sentry\captureException($e);
    }

    $clientMessage = api_error_message_for_client($e, $code);
    echo json_encode([
        'ok' => false,
        'error' => $clientMessage
    ], JSON_UNESCAPED_UNICODE);
    exit(1);
});

function api_elapsed_ms(float $startedAt): int
{
    return (int) round((microtime(true) - $startedAt) * 1000);
}

function api_funnel_allowed_events(): array
{
    return [
        'view_booking',
        'start_checkout',
        'payment_method_selected',
        'payment_success',
        'booking_confirmed',
        'checkout_abandon',
        'booking_step_completed',
        'booking_error',
        'checkout_error',
        'chat_started',
        'chat_handoff_whatsapp',
        'whatsapp_click'
    ];
}

function api_funnel_normalize_label($value, string $fallback = 'unknown', int $maxLength = 48): string
{
    if (!is_string($value) && !is_numeric($value)) {
        return $fallback;
    }

    $normalized = strtolower(trim((string) $value));
    if ($normalized === '') {
        return $fallback;
    }

    $normalized = preg_replace('/[^a-z0-9_]+/', '_', $normalized);
    $normalized = trim((string) $normalized, '_');
    if ($normalized === '') {
        return $fallback;
    }

    if (strlen($normalized) > $maxLength) {
        $normalized = substr($normalized, 0, $maxLength);
    }

    return $normalized === '' ? $fallback : $normalized;
}

function api_parse_prometheus_labels(string $rawLabels): array
{
    $labels = [];
    if ($rawLabels === '') {
        return $labels;
    }

    $matchCount = preg_match_all('/([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\\\]|\\\\.)*)"/', $rawLabels, $matches, PREG_SET_ORDER);
    if (!is_int($matchCount) || $matchCount < 1) {
        return $labels;
    }

    foreach ($matches as $match) {
        $key = isset($match[1]) ? (string) $match[1] : '';
        $value = isset($match[2]) ? (string) $match[2] : '';
        if ($key === '') {
            continue;
        }
        $labels[$key] = stripcslashes($value);
    }

    return $labels;
}

function api_prometheus_counter_series(string $metricsText, string $metricName): array
{
    $series = [];
    if ($metricName === '' || trim($metricsText) === '') {
        return $series;
    }

    $pattern = '/^' . preg_quote($metricName, '/') . '(?:\{([^}]*)\})?\s+([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?)$/';
    $lines = preg_split('/\R/', $metricsText) ?: [];

    foreach ($lines as $line) {
        $line = trim((string) $line);
        if ($line === '' || $line[0] === '#') {
            continue;
        }

        if (preg_match($pattern, $line, $match) !== 1) {
            continue;
        }

        $labelsRaw = isset($match[1]) ? (string) $match[1] : '';
        $valueRaw = isset($match[2]) ? (string) $match[2] : '0';
        $value = is_numeric($valueRaw) ? (float) $valueRaw : 0.0;

        $series[] = [
            'labels' => api_parse_prometheus_labels($labelsRaw),
            'value' => $value
        ];
    }

    return $series;
}

function api_resolve_figo_endpoint_for_health(): string
{
    $envCandidates = [
        getenv('FIGO_CHAT_ENDPOINT'),
        getenv('FIGO_CHAT_URL'),
        getenv('FIGO_CHAT_API_URL'),
        getenv('FIGO_ENDPOINT'),
        getenv('FIGO_URL'),
        getenv('CLAWBOT_ENDPOINT'),
        getenv('CLAWBOT_URL'),
        getenv('CHATBOT_ENDPOINT'),
        getenv('CHATBOT_URL'),
        getenv('BOT_ENDPOINT'),
        getenv('PIELARMONIA_FIGO_ENDPOINT')
    ];

    foreach ($envCandidates as $candidate) {
        if (is_string($candidate) && trim($candidate) !== '') {
            return trim($candidate);
        }
    }

    $configCandidates = [];
    $customPath = getenv('FIGO_CHAT_CONFIG_PATH');
    if (is_string($customPath) && trim($customPath) !== '') {
        $configCandidates[] = trim($customPath);
    }

    $configCandidates[] = data_dir_path() . DIRECTORY_SEPARATOR . 'figo-config.json';
    $configCandidates[] = __DIR__ . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'figo-config.json';
    $configCandidates[] = __DIR__ . DIRECTORY_SEPARATOR . 'figo-config.json';

    foreach ($configCandidates as $path) {
        if (!is_string($path) || $path === '' || !is_file($path)) {
            continue;
        }
        $raw = @file_get_contents($path);
        if (!is_string($raw) || trim($raw) === '') {
            continue;
        }
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            continue;
        }
        $fileCandidates = [
            $decoded['endpoint'] ?? null,
            $decoded['apiUrl'] ?? null,
            $decoded['url'] ?? null
        ];
        foreach ($fileCandidates as $candidate) {
            if (is_string($candidate) && trim($candidate) !== '') {
                return trim($candidate);
            }
        }
    }

    return '';
}

function api_is_figo_recursive_config(string $endpoint): bool
{
    $endpoint = trim($endpoint);
    if ($endpoint === '') {
        return false;
    }

    $parts = @parse_url($endpoint);
    if (!is_array($parts)) {
        return false;
    }

    $endpointHost = strtolower((string) ($parts['host'] ?? ''));
    $endpointPath = strtolower((string) ($parts['path'] ?? ''));
    $currentHost = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));

    $requestUri = (string) ($_SERVER['REQUEST_URI'] ?? '/api.php');
    $requestPath = strtolower((string) parse_url($requestUri, PHP_URL_PATH));
    if ($requestPath === '') {
        $requestPath = '/api.php';
    }

    if ($endpointHost === '' || $currentHost === '') {
        return false;
    }

    // Permite comparacion robusta entre host directo y variante www.
    $normalizedEndpointHost = preg_replace('/^www\./', '', $endpointHost);
    $normalizedCurrentHost = preg_replace('/^www\./', '', $currentHost);

    if ($normalizedEndpointHost !== $normalizedCurrentHost) {
        return false;
    }

    if ($endpointPath === '') {
        return false;
    }

    if ($endpointPath === $requestPath) {
        return true;
    }

    return $endpointPath === '/figo-chat.php';
}

function api_figo_config_candidate_paths(): array
{
    $paths = [];

    $customBackendPath = getenv('FIGO_BACKEND_CONFIG_PATH');
    if (is_string($customBackendPath) && trim($customBackendPath) !== '') {
        $paths[] = trim($customBackendPath);
    }

    $customChatPath = getenv('FIGO_CHAT_CONFIG_PATH');
    if (is_string($customChatPath) && trim($customChatPath) !== '') {
        $paths[] = trim($customChatPath);
    }

    $paths[] = data_dir_path() . DIRECTORY_SEPARATOR . 'figo-config.json';
    $paths[] = __DIR__ . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'figo-config.json';
    $paths[] = __DIR__ . DIRECTORY_SEPARATOR . 'figo-config.json';

    $normalized = [];
    foreach ($paths as $path) {
        $path = trim((string) $path);
        if ($path === '') {
            continue;
        }
        $path = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $path);
        if (!in_array($path, $normalized, true)) {
            $normalized[] = $path;
        }
    }

    return $normalized;
}

function api_resolve_figo_config_path(): string
{
    $candidates = api_figo_config_candidate_paths();
    foreach ($candidates as $candidate) {
        if (is_file($candidate)) {
            return $candidate;
        }
    }

    return $candidates[0] ?? (__DIR__ . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'figo-config.json');
}

function api_read_figo_config_with_meta(): array
{
    $path = api_resolve_figo_config_path();
    if (!is_file($path)) {
        return [
            'exists' => false,
            'path' => $path,
            'config' => []
        ];
    }

    $raw = @file_get_contents($path);
    if (!is_string($raw) || trim($raw) === '') {
        return [
            'exists' => true,
            'path' => $path,
            'config' => []
        ];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return [
            'exists' => true,
            'path' => $path,
            'config' => []
        ];
    }

    return [
        'exists' => true,
        'path' => $path,
        'config' => $decoded
    ];
}

function api_mask_secret_value(string $value): string
{
    $value = trim($value);
    if ($value === '') {
        return '';
    }

    $length = strlen($value);
    if ($length <= 10) {
        return str_repeat('*', $length);
    }

    return substr($value, 0, 6) . str_repeat('*', max(4, $length - 10)) . substr($value, -4);
}

function api_mask_figo_config(array $config): array
{
    $masked = $config;
    foreach (['token', 'apiKey'] as $key) {
        if (isset($masked[$key]) && is_string($masked[$key])) {
            $masked[$key] = api_mask_secret_value((string) $masked[$key]);
        }
    }

    if (isset($masked['ai']) && is_array($masked['ai']) && isset($masked['ai']['apiKey']) && is_string($masked['ai']['apiKey'])) {
        $masked['ai']['apiKey'] = api_mask_secret_value((string) $masked['ai']['apiKey']);
    }

    return $masked;
}

function api_parse_optional_bool($raw): ?bool
{
    if (is_bool($raw)) {
        return $raw;
    }

    if (!is_string($raw) && !is_int($raw)) {
        return null;
    }

    $value = strtolower(trim((string) $raw));
    if (in_array($value, ['1', 'true', 'yes', 'on'], true)) {
        return true;
    }

    if (in_array($value, ['0', 'false', 'no', 'off'], true)) {
        return false;
    }

    return null;
}

function api_validate_absolute_http_url(string $url, string $field): void
{
    $url = trim($url);
    if ($url === '') {
        return;
    }

    $parts = @parse_url($url);
    if (!is_array($parts)) {
        throw new RuntimeException($field . ' no es una URL valida', 400);
    }

    $scheme = strtolower((string) ($parts['scheme'] ?? ''));
    $host = strtolower((string) ($parts['host'] ?? ''));
    if (!in_array($scheme, ['http', 'https'], true) || $host === '') {
        throw new RuntimeException($field . ' debe ser una URL absoluta http(s)', 400);
    }
}

function api_merge_figo_config(array $existing, array $payload): array
{
    $next = $existing;
    $endpointTouched = false;
    $aiEndpointTouched = false;

    foreach (['endpoint', 'token', 'apiKeyHeader', 'apiKey'] as $key) {
        if (!array_key_exists($key, $payload)) {
            continue;
        }

        if ($key === 'endpoint') {
            $endpointTouched = true;
        }

        $value = $payload[$key];
        if ($value === null) {
            unset($next[$key]);
            continue;
        }

        if (!is_string($value)) {
            throw new RuntimeException($key . ' debe ser texto', 400);
        }

        $value = trim($value);
        if ($value === '') {
            unset($next[$key]);
            continue;
        }

        $next[$key] = $value;
    }

    if (array_key_exists('timeout', $payload)) {
        $rawTimeout = $payload['timeout'];
        if ($rawTimeout === null || (is_string($rawTimeout) && trim($rawTimeout) === '')) {
            unset($next['timeout']);
        } elseif (!is_numeric($rawTimeout)) {
            throw new RuntimeException('timeout debe ser numerico', 400);
        } else {
            $timeout = (int) $rawTimeout;
            if ($timeout < 5) {
                $timeout = 5;
            }
            if ($timeout > 45) {
                $timeout = 45;
            }
            $next['timeout'] = $timeout;
        }
    }

    if (array_key_exists('allowLocalFallback', $payload)) {
        $parsed = api_parse_optional_bool($payload['allowLocalFallback']);
        if ($parsed === null) {
            throw new RuntimeException('allowLocalFallback debe ser booleano', 400);
        }
        $next['allowLocalFallback'] = $parsed;
    }

    if (array_key_exists('ai', $payload)) {
        $rawAi = $payload['ai'];
        if ($rawAi === null) {
            unset($next['ai']);
        } else {
            if (!is_array($rawAi)) {
                throw new RuntimeException('ai debe ser un objeto JSON', 400);
            }

            $aiNext = (isset($next['ai']) && is_array($next['ai'])) ? $next['ai'] : [];
            foreach (['endpoint', 'apiKey', 'model', 'apiKeyHeader', 'apiKeyPrefix'] as $aiKey) {
                if (!array_key_exists($aiKey, $rawAi)) {
                    continue;
                }

                if ($aiKey === 'endpoint') {
                    $aiEndpointTouched = true;
                }

                $aiValue = $rawAi[$aiKey];
                if ($aiValue === null) {
                    unset($aiNext[$aiKey]);
                    continue;
                }

                if (!is_string($aiValue)) {
                    throw new RuntimeException('ai.' . $aiKey . ' debe ser texto', 400);
                }

                $aiValue = trim($aiValue);
                if ($aiValue === '') {
                    unset($aiNext[$aiKey]);
                    continue;
                }

                $aiNext[$aiKey] = $aiValue;
            }

            if (array_key_exists('timeoutSeconds', $rawAi)) {
                $rawAiTimeout = $rawAi['timeoutSeconds'];
                if ($rawAiTimeout === null || (is_string($rawAiTimeout) && trim($rawAiTimeout) === '')) {
                    unset($aiNext['timeoutSeconds']);
                } elseif (!is_numeric($rawAiTimeout)) {
                    throw new RuntimeException('ai.timeoutSeconds debe ser numerico', 400);
                } else {
                    $aiTimeout = (int) $rawAiTimeout;
                    if ($aiTimeout < 5) {
                        $aiTimeout = 5;
                    }
                    if ($aiTimeout > 45) {
                        $aiTimeout = 45;
                    }
                    $aiNext['timeoutSeconds'] = $aiTimeout;
                }
            }

            if (array_key_exists('allowLocalFallback', $rawAi)) {
                $aiBool = api_parse_optional_bool($rawAi['allowLocalFallback']);
                if ($aiBool === null) {
                    throw new RuntimeException('ai.allowLocalFallback debe ser booleano', 400);
                }
                $aiNext['allowLocalFallback'] = $aiBool;
            }

            if (empty($aiNext)) {
                unset($next['ai']);
            } else {
                $next['ai'] = $aiNext;
            }
        }
    }

    if ($endpointTouched && isset($next['endpoint']) && is_string($next['endpoint'])) {
        api_validate_absolute_http_url((string) $next['endpoint'], 'endpoint');
        if (api_is_figo_recursive_config((string) $next['endpoint'])) {
            throw new RuntimeException('endpoint no debe apuntar a /figo-chat.php', 400);
        }
    }

    if ($aiEndpointTouched && isset($next['ai']) && is_array($next['ai']) && isset($next['ai']['endpoint']) && is_string($next['ai']['endpoint'])) {
        api_validate_absolute_http_url((string) $next['ai']['endpoint'], 'ai.endpoint');
    }

    return $next;
}

$requestOrigin = isset($_SERVER['HTTP_ORIGIN']) ? trim((string) $_SERVER['HTTP_ORIGIN']) : '';
$allowedOrigin = getenv('PIELARMONIA_ALLOWED_ORIGIN');
$allowedList = [];
if (is_string($allowedOrigin) && trim($allowedOrigin) !== '') {
    foreach (explode(',', $allowedOrigin) as $origin) {
        $origin = trim((string) $origin);
        if ($origin !== '') {
            $allowedList[] = rtrim($origin, '/');
        }
    }
}

$host = isset($_SERVER['HTTP_HOST']) ? trim((string) $_SERVER['HTTP_HOST']) : '';
if ($host !== '') {
    $allowedList[] = (is_https_request() ? 'https' : 'http') . '://' . $host;
}

$allowedList = array_values(array_unique(array_filter($allowedList)));
if ($requestOrigin !== '') {
    $normalizedOrigin = rtrim($requestOrigin, '/');
    foreach ($allowedList as $origin) {
        if (strcasecmp($normalizedOrigin, $origin) === 0) {
            header('Access-Control-Allow-Origin: ' . $requestOrigin);
            header('Access-Control-Allow-Credentials: true');
            header('Vary: Origin');
            break;
        }
    }
}
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$resource = isset($_GET['resource']) ? (string) $_GET['resource'] : '';
$action = isset($_GET['action']) ? (string) $_GET['action'] : '';

if ($resource === '' && $action !== '') {
    $resource = $action;
}

register_shutdown_function(static function () use ($requestStartedAt, $method, $resource): void {
    $elapsed = api_elapsed_ms($requestStartedAt);

    if (class_exists('Metrics')) {
        Metrics::observe('http_request_duration_seconds', $elapsed / 1000, [
            'method' => $method,
            'resource' => $resource,
            'status' => (string)http_response_code()
        ]);

        $status = http_response_code();
        $isSuccess = $status >= 200 && $status < 400;

        if ($isSuccess) {
            if ($resource === 'monitoring-config') {
                Metrics::increment('conversion_funnel_events_total', ['step' => 'page_view']);
            } elseif ($resource === 'availability' || $resource === 'booked-slots') {
                Metrics::increment('conversion_funnel_events_total', ['step' => 'view_availability']);
            } elseif ($resource === 'payment-intent' && $method === 'POST') {
                Metrics::increment('conversion_funnel_events_total', ['step' => 'initiate_checkout']);
            } elseif ($resource === 'appointments' && $method === 'POST') {
                Metrics::increment('conversion_funnel_events_total', ['step' => 'complete_booking']);
            }
        }
    }

    if (class_exists('Metrics')) {
        // Track memory usage in bytes with custom buckets (256KB to 128MB)
        Metrics::observe('php_memory_usage_bytes', (float)memory_get_peak_usage(true), [], [
            262144, 524288, 1048576, 2097152, 4194304, 8388608, 16777216, 33554432, 67108864, 134217728
        ]);
    }

    if ($elapsed < 2000) {
        return;
    }
    audit_log_event('api.slow', [
        'method' => $method,
        'resource' => $resource,
        'timingMs' => $elapsed
    ]);
});

// Load Store
$storeReadStart = microtime(true);
$store = read_store();
$storeReadDuration = microtime(true) - $storeReadStart;

if (class_exists('Metrics')) {
    Metrics::observe('store_read_duration_seconds', $storeReadDuration, [], [
        0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1.0
    ]);
}

// Inline Logic for monitoring-config, features, health
if ($resource === 'monitoring-config') {
    $config = get_monitoring_config();
    json_response($config);
}

if ($resource === 'features') {
    json_response([
        'ok' => true,
        'data' => FeatureFlags::getAll()
    ]);
}

if ($resource === 'health') {
    // We are passing context but HealthController might not need all of it
    $healthContext = [
        'store' => $store,
        'requestStartedAt' => $requestStartedAt,
        'method' => $method,
        'resource' => $resource
    ];
    HealthController::check($healthContext);
    exit;
}

$publicEndpoints = [
    ['method' => 'GET', 'resource' => 'monitoring-config'],
    ['method' => 'GET', 'resource' => 'features'],
    ['method' => 'GET', 'resource' => 'metrics'],
    ['method' => 'GET', 'resource' => 'payment-config'],
    ['method' => 'GET', 'resource' => 'availability'],
    ['method' => 'GET', 'resource' => 'reviews'],
    ['method' => 'GET', 'resource' => 'booked-slots'],
    ['method' => 'POST', 'resource' => 'payment-intent'],
    ['method' => 'POST', 'resource' => 'payment-verify'],
    ['method' => 'POST', 'resource' => 'transfer-proof'],
    ['method' => 'POST', 'resource' => 'stripe-webhook'],
    ['method' => 'POST', 'resource' => 'appointments'],
    ['method' => 'POST', 'resource' => 'callbacks'],
    ['method' => 'POST', 'resource' => 'reviews'],
    ['method' => 'POST', 'resource' => 'funnel-event'],
    ['method' => 'GET', 'resource' => 'reschedule'],
    ['method' => 'PATCH', 'resource' => 'reschedule'],
];

$isPublic = false;
foreach ($publicEndpoints as $endpoint) {
    if ($endpoint['method'] === $method && $endpoint['resource'] === $resource) {
        $isPublic = true;
        break;
    }
}

$isAdmin = false;
if (!$isPublic) {
    start_secure_session();
    $isAdmin = isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true;
    if (!$isAdmin) {
        audit_log_event('api.unauthorized', [
            'method' => $method,
            'resource' => $resource,
            'reason' => 'admin_required'
        ]);
        json_response([
            'ok' => false,
            'error' => 'No autorizado'
        ], 401);
    }
}

$shouldAuditAccess = true;
if (!$isAdmin && $method === 'GET' && !api_should_audit_public_get($resource)) {
    $shouldAuditAccess = false;
}

if ($shouldAuditAccess) {
    audit_log_event('api.access', [
        'method' => $method,
        'resource' => $resource,
        'scope' => $isAdmin ? 'admin' : 'public'
    ]);
}

// CSRF: validar token en mutaciones autenticadas (no publicas)
if (in_array($method, ['POST', 'PUT', 'PATCH'], true) && $isAdmin) {
    require_csrf();
}

// Prepare Context for Controllers
$context = [
    'store' => $store,
    'isAdmin' => $isAdmin,
    'requestStartedAt' => $requestStartedAt,
    'method' => $method,
    'resource' => $resource
];

// Figo Config endpoints
if ($resource === 'figo-config' && $method === 'GET') {
    FigoConfigController::show($context);
    exit;
}

if ($resource === 'figo-config' && in_array($method, ['POST', 'PUT', 'PATCH'], true)) {
    FigoConfigController::update($context);
    exit;
}

// Payment Config
if ($method === 'GET' && $resource === 'payment-config') {
    PaymentController::config($context);
    exit;
}

// Funnel event ingestion
if ($method === 'POST' && $resource === 'funnel-event') {
    AnalyticsController::recordEvent($context);
    exit;
}

// Metrics export
if ($resource === 'metrics') {
    MetricsController::export($context);
    exit;
}

// Funnel metrics
if ($method === 'GET' && $resource === 'funnel-metrics') {
    AnalyticsController::getFunnelMetrics($context);
    exit;
}

// Controller Dispatching

if ($method === 'GET' && $resource === 'data') {
    AdminDataController::index($context);
    exit;
}

if ($method === 'GET' && $resource === 'appointments') {
    AppointmentController::index($context);
    exit;
}

if ($method === 'GET' && $resource === 'callbacks') {
    CallbackController::index($context);
    exit;
}

if ($method === 'GET' && $resource === 'reviews') {
    ReviewController::index($context);
    exit;
}

if ($method === 'GET' && $resource === 'availability') {
    AvailabilityController::index($context);
    exit;
}

if ($method === 'GET' && $resource === 'booked-slots') {
    AppointmentController::bookedSlots($context);
    exit;
}

if ($method === 'POST' && $resource === 'payment-intent') {
    PaymentController::createIntent($context);
    exit;
}

if ($method === 'POST' && $resource === 'payment-verify') {
    PaymentController::verify($context);
    exit;
}

if ($method === 'POST' && $resource === 'transfer-proof') {
    PaymentController::transferProof($context);
    exit;
}

if ($method === 'POST' && $resource === 'stripe-webhook') {
    PaymentController::webhook($context);
    exit;
}

if ($method === 'POST' && $resource === 'appointments') {
    AppointmentController::store($context);
    exit;
}

if (($method === 'PATCH' || $method === 'PUT') && $resource === 'appointments') {
    AppointmentController::update($context);
    exit;
}

if ($method === 'POST' && $resource === 'callbacks') {
    CallbackController::store($context);
    exit;
}

if (($method === 'PATCH' || $method === 'PUT') && $resource === 'callbacks') {
    CallbackController::update($context);
    exit;
}

if ($method === 'POST' && $resource === 'reviews') {
    ReviewController::store($context);
    exit;
}

if ($method === 'POST' && $resource === 'availability') {
    AvailabilityController::update($context);
    exit;
}

if ($method === 'POST' && $resource === 'import') {
    AdminDataController::import($context);
    exit;
}

if ($method === 'GET' && $resource === 'reschedule') {
    AppointmentController::checkReschedule($context);
    exit;
}

if ($method === 'PATCH' && $resource === 'reschedule') {
    AppointmentController::processReschedule($context);
    exit;
}

json_response([
    'ok' => false,
    'error' => 'Ruta no soportada'
], 404);
