<?php
declare(strict_types=1);

require_once __DIR__ . '/api-lib.php';
require_once __DIR__ . '/payment-lib.php';
require_once __DIR__ . '/lib/monitoring.php';

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
    $health = check_system_health();
    $figoEndpoint = api_resolve_figo_endpoint_for_health();
    $figoConfigured = $figoEndpoint !== '';
    $figoRecursive = api_is_figo_recursive_config($figoEndpoint);
    $timingMs = api_elapsed_ms($requestStartedAt);

    $health['figoConfigured'] = $figoConfigured;
    $health['figoRecursiveConfig'] = $figoRecursive;
    $health['timingMs'] = $timingMs;

    audit_log_event('api.health', $health);
    json_response($health, $health['ok'] ? 200 : 503);
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

audit_log_event('api.access', [
    'method' => $method,
    'resource' => $resource,
    'scope' => $isAdmin ? 'admin' : 'public'
]);

// CSRF: validar token en mutaciones autenticadas (no publicas)
if (in_array($method, ['POST', 'PUT', 'PATCH'], true) && $isAdmin) {
    require_csrf();
}

if ($resource === 'figo-config' && $method === 'GET') {
    $configMeta = api_read_figo_config_with_meta();
    $candidatePaths = api_figo_config_candidate_paths();
    $writePath = $candidatePaths[0] ?? (string) ($configMeta['path'] ?? api_resolve_figo_config_path());
    $config = is_array($configMeta['config'] ?? null) ? $configMeta['config'] : [];
    $masked = api_mask_figo_config($config);
    $aiNode = (isset($config['ai']) && is_array($config['ai'])) ? $config['ai'] : [];
    $aiEndpoint = isset($aiNode['endpoint']) && is_string($aiNode['endpoint']) ? trim((string) $aiNode['endpoint']) : '';
    $figoEndpoint = isset($config['endpoint']) && is_string($config['endpoint']) ? trim((string) $config['endpoint']) : '';

    json_response([
        'ok' => true,
        'data' => $masked,
        'exists' => (bool) ($configMeta['exists'] ?? false),
        'path' => basename((string) ($configMeta['path'] ?? 'figo-config.json')),
        'activePath' => (string) ($configMeta['path'] ?? ''),
        'writePath' => (string) $writePath,
        'figoEndpointConfigured' => $figoEndpoint !== '',
        'aiConfigured' => $aiEndpoint !== '',
        'timestamp' => gmdate('c')
    ]);
}

if ($resource === 'figo-config' && in_array($method, ['POST', 'PUT', 'PATCH'], true)) {
    require_rate_limit('figo-config', 6, 60);

    $payload = require_json_body();
    if (!is_array($payload)) {
        json_response([
            'ok' => false,
            'error' => 'Payload invalido'
        ], 400);
    }

    $configMeta = api_read_figo_config_with_meta();
    $current = is_array($configMeta['config'] ?? null) ? $configMeta['config'] : [];

    try {
        $next = api_merge_figo_config($current, $payload);
    } catch (RuntimeException $e) {
        $status = $e->getCode() >= 400 && $e->getCode() < 600 ? (int) $e->getCode() : 400;
        json_response([
            'ok' => false,
            'error' => api_error_message_for_client($e, $status)
        ], $status);
    }

    $candidatePaths = api_figo_config_candidate_paths();
    $path = (string) ($candidatePaths[0] ?? ($configMeta['path'] ?? api_resolve_figo_config_path()));
    $dir = dirname($path);

    if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) {
        json_response([
            'ok' => false,
            'error' => 'No se pudo crear el directorio de configuracion en ' . $dir
        ], 500);
    }

    if (!is_file($path)) {
        @chmod($dir, 0775);
    } else {
        @chmod($path, 0664);
    }

    if ((is_file($path) && !is_writable($path)) || (!is_file($path) && !is_writable($dir))) {
        json_response([
            'ok' => false,
            'error' => 'No hay permisos para guardar la configuracion en ' . $path
        ], 500);
    }

    $encoded = json_encode($next, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($encoded)) {
        json_response([
            'ok' => false,
            'error' => 'No se pudo serializar la configuracion'
        ], 500);
    }

    $bytes = @file_put_contents($path, $encoded . PHP_EOL, LOCK_EX);
    if (!is_int($bytes)) {
        json_response([
            'ok' => false,
            'error' => 'No se pudo guardar figo-config.json'
        ], 500);
    }

    $aiNode = (isset($next['ai']) && is_array($next['ai'])) ? $next['ai'] : [];
    $aiEndpoint = isset($aiNode['endpoint']) && is_string($aiNode['endpoint']) ? trim((string) $aiNode['endpoint']) : '';
    $figoEndpoint = isset($next['endpoint']) && is_string($next['endpoint']) ? trim((string) $next['endpoint']) : '';
    $figoHost = '';
    if ($figoEndpoint !== '') {
        $figoParts = @parse_url($figoEndpoint);
        if (is_array($figoParts) && isset($figoParts['host']) && is_string($figoParts['host'])) {
            $figoHost = strtolower(trim((string) $figoParts['host']));
        }
    }

    audit_log_event('figo.config_updated', [
        'path' => basename($path),
        'figoEndpointConfigured' => $figoEndpoint !== '',
        'figoEndpointHost' => $figoHost,
        'aiConfigured' => $aiEndpoint !== '',
        'allowLocalFallback' => isset($next['allowLocalFallback']) ? (bool) $next['allowLocalFallback'] : null
    ]);

    json_response([
        'ok' => true,
        'saved' => true,
        'path' => basename($path),
        'bytes' => $bytes,
        'data' => api_mask_figo_config($next),
        'figoEndpointConfigured' => $figoEndpoint !== '',
        'aiConfigured' => $aiEndpoint !== '',
        'timestamp' => gmdate('c')
    ]);
}

$storeReadStart = microtime(true);
$store = read_store();
$storeReadDuration = microtime(true) - $storeReadStart;

if (class_exists('Metrics')) {
    Metrics::observe('store_read_duration_seconds', $storeReadDuration, [], [
        0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1.0
    ]);
}

if ($resource === 'metrics') {
    if (!class_exists('Metrics')) {
        http_response_code(500);
        die("Metrics library not loaded");
    }
    header('Content-Type: text/plain; version=0.0.4');

    // Calculate Business Metrics from Store
    $revenueByDate = [];
    foreach ($store['appointments'] as $appt) {
        if (($appt['status'] ?? '') !== 'cancelled' && ($appt['paymentStatus'] ?? '') === 'paid') {
            $date = $appt['date'] ?? '';
            $service = $appt['service'] ?? '';
            $price = function_exists('get_service_price') ? get_service_price($service) : 0;
            if ($date && $price > 0) {
                if (!isset($revenueByDate[$date])) {
                    $revenueByDate[$date] = 0;
                }
                $revenueByDate[$date] += $price;
            }
        }
    }

    $stats = ['confirmed' => 0, 'no_show' => 0, 'completed' => 0, 'cancelled' => 0];
    foreach ($store['appointments'] as $appt) {
        $st = function_exists('map_appointment_status')
            ? map_appointment_status($appt['status'] ?? 'confirmed')
            : ($appt['status'] ?? 'confirmed');

        if (isset($stats[$st])) {
            $stats[$st]++;
        }
    }

    // Output standard metrics
    echo Metrics::export();

    // Output business metrics
    foreach ($revenueByDate as $date => $amount) {
        echo "\n# TYPE pielarmonia_revenue_daily_total gauge";
        echo "\npielarmonia_revenue_daily_total{date=\"$date\"} $amount";
    }

    foreach ($stats as $st => $count) {
        echo "\n# TYPE pielarmonia_appointments_total gauge";
        echo "\npielarmonia_appointments_total{status=\"$st\"} $count";
    }

    $totalValid = $stats['confirmed'] + $stats['no_show'] + $stats['completed'];
    $rate = $totalValid > 0 ? ($stats['no_show'] / $totalValid) : 0;
    echo "\n# TYPE pielarmonia_no_show_rate gauge";
    echo "\npielarmonia_no_show_rate $rate\n";

    // Store File Size
    $storeSize = @filesize(data_file_path());
    if ($storeSize !== false) {
        echo "\n# TYPE pielarmonia_store_file_size_bytes gauge";
        echo "\npielarmonia_store_file_size_bytes $storeSize";
    }

    // Service Popularity
    $serviceCounts = [];
    foreach ($store['appointments'] as $appt) {
        $svc = $appt['service'] ?? 'unknown';
        if ($svc === '') $svc = 'unknown';
        if (!isset($serviceCounts[$svc])) $serviceCounts[$svc] = 0;
        $serviceCounts[$svc]++;
    }
    foreach ($serviceCounts as $svc => $count) {
        echo "\n# TYPE pielarmonia_service_popularity_total gauge";
        echo "\npielarmonia_service_popularity_total{service=\"$svc\"} $count";
    }

    // Lead Time (Last 30 days)
    $leadTimes = [];
    $now = time();
    foreach ($store['appointments'] as $appt) {
        if (($appt['status'] ?? '') === 'cancelled') continue;
        $bookedAt = isset($appt['dateBooked']) ? strtotime($appt['dateBooked']) : false;
        $apptTime = strtotime(($appt['date'] ?? '') . ' ' . ($appt['time'] ?? ''));
        // Only consider bookings made in the last 30 days
        if ($bookedAt && $apptTime && $bookedAt > ($now - 30 * 86400)) {
            $lead = $apptTime - $bookedAt;
            if ($lead > 0) $leadTimes[] = $lead;
        }
    }
    if (count($leadTimes) > 0) {
        $avgLead = array_sum($leadTimes) / count($leadTimes);
        echo "\n# TYPE pielarmonia_lead_time_seconds_avg gauge";
        echo "\npielarmonia_lead_time_seconds_avg $avgLead\n";
    }

    exit;
}

if ($method === 'GET' && $resource === 'data') {
    json_response([
        'ok' => true,
        'data' => $store
    ]);
}

if ($method === 'GET' && $resource === 'appointments') {
    json_response([
        'ok' => true,
        'data' => $store['appointments']
    ]);
}

if ($method === 'GET' && $resource === 'callbacks') {
    json_response([
        'ok' => true,
        'data' => $store['callbacks']
    ]);
}

if ($method === 'GET' && $resource === 'reviews') {
    usort($store['reviews'], static function (array $a, array $b): int {
        return strcmp((string) ($b['date'] ?? ''), (string) ($a['date'] ?? ''));
    });
    json_response([
        'ok' => true,
        'data' => $store['reviews']
    ]);
}

if ($method === 'GET' && $resource === 'availability') {
    json_response([
        'ok' => true,
        'data' => $store['availability']
    ]);
}

if ($method === 'GET' && $resource === 'booked-slots') {
    $date = isset($_GET['date']) ? (string) $_GET['date'] : '';
    if ($date === '') {
        json_response([
            'ok' => false,
            'error' => 'Fecha requerida'
        ], 400);
    }

    $doctor = isset($_GET['doctor']) ? trim((string) $_GET['doctor']) : '';
    $slots = [];
    $index = $store['idx_appointments_date'] ?? null;

    if ($index !== null) {
        if (isset($index[$date])) {
            foreach ($index[$date] as $idx) {
                if (!isset($store['appointments'][$idx])) {
                    continue;
                }
                $appointment = $store['appointments'][$idx];
                $status = map_appointment_status((string) ($appointment['status'] ?? 'confirmed'));
                if ($status === 'cancelled') {
                    continue;
                }
                if ($doctor !== '' && $doctor !== 'indiferente') {
                    $apptDoctor = (string) ($appointment['doctor'] ?? '');
                    if ($apptDoctor !== '' && $apptDoctor !== 'indiferente' && $apptDoctor !== $doctor) {
                        continue;
                    }
                }
                $time = (string) ($appointment['time'] ?? '');
                if ($time !== '') {
                    $slots[] = $time;
                }
            }
        }
    } else {
        foreach ($store['appointments'] as $appointment) {
            $status = map_appointment_status((string) ($appointment['status'] ?? 'confirmed'));
            if ($status === 'cancelled') {
                continue;
            }
            if ((string) ($appointment['date'] ?? '') !== $date) {
                continue;
            }
            if ($doctor !== '' && $doctor !== 'indiferente') {
                $apptDoctor = (string) ($appointment['doctor'] ?? '');
                if ($apptDoctor !== '' && $apptDoctor !== 'indiferente' && $apptDoctor !== $doctor) {
                    continue;
                }
            }
            $time = (string) ($appointment['time'] ?? '');
            if ($time !== '') {
                $slots[] = $time;
            }
        }
    }

    $slots = array_values(array_unique($slots));
    sort($slots);

    json_response([
        'ok' => true,
        'data' => $slots
    ]);
}

if ($method === 'GET' && $resource === 'payment-config') {
    json_response([
        'ok' => true,
        'provider' => 'stripe',
        'enabled' => payment_gateway_enabled(),
        'publishableKey' => payment_stripe_publishable_key(),
        'currency' => payment_currency()
    ]);
}

if ($method === 'POST' && $resource === 'payment-intent') {
    require_rate_limit('payment-intent', 8, 60);

    if (!payment_gateway_enabled()) {
        json_response([
            'ok' => false,
            'error' => 'Pasarela de pago no configurada'
        ], 503);
    }

    $payload = require_json_body();
    $appointment = normalize_appointment($payload);

    if ($appointment['service'] === '' || $appointment['name'] === '' || $appointment['email'] === '') {
        json_response([
            'ok' => false,
            'error' => 'Datos incompletos para iniciar el pago'
        ], 400);
    }

    if (!validate_email($appointment['email'])) {
        json_response([
            'ok' => false,
            'error' => 'El formato del email no es valido'
        ], 400);
    }

    if (!validate_phone($appointment['phone'])) {
        json_response([
            'ok' => false,
            'error' => 'El formato del telefono no es valido'
        ], 400);
    }

    if (!isset($appointment['privacyConsent']) || $appointment['privacyConsent'] !== true) {
        json_response([
            'ok' => false,
            'error' => 'Debes aceptar el tratamiento de datos para reservar la cita'
        ], 400);
    }

    if ($appointment['date'] === '' || $appointment['time'] === '') {
        json_response([
            'ok' => false,
            'error' => 'Fecha y hora son obligatorias'
        ], 400);
    }

    if ($appointment['date'] < local_date('Y-m-d')) {
        json_response([
            'ok' => false,
            'error' => 'No se puede agendar en una fecha pasada'
        ], 400);
    }

    if (appointment_slot_taken($store['appointments'], $appointment['date'], $appointment['time'], null, $appointment['doctor'], $store['idx_appointments_date'] ?? null)) {
        json_response([
            'ok' => false,
            'error' => 'Ese horario ya fue reservado'
        ], 409);
    }

    $seed = implode('|', [
        $appointment['email'],
        $appointment['service'],
        $appointment['date'],
        $appointment['time'],
        $appointment['doctor'],
        $appointment['phone']
    ]);
    $idempotencyKey = payment_build_idempotency_key('intent', $seed);

    try {
        $intent = stripe_create_payment_intent($appointment, $idempotencyKey);
    } catch (RuntimeException $e) {
        json_response([
            'ok' => false,
            'error' => api_error_message_for_client($e, 502)
        ], 502);
    }

    json_response([
        'ok' => true,
        'clientSecret' => isset($intent['client_secret']) ? (string) $intent['client_secret'] : '',
        'paymentIntentId' => isset($intent['id']) ? (string) $intent['id'] : '',
        'amount' => isset($intent['amount']) ? (int) $intent['amount'] : payment_expected_amount_cents($appointment['service']),
        'currency' => strtoupper((string) ($intent['currency'] ?? payment_currency())),
        'publishableKey' => payment_stripe_publishable_key()
    ]);
}

if ($method === 'POST' && $resource === 'payment-verify') {
    require_rate_limit('payment-verify', 12, 60);

    if (!payment_gateway_enabled()) {
        json_response([
            'ok' => false,
            'error' => 'Pasarela de pago no configurada'
        ], 503);
    }

    $payload = require_json_body();
    $paymentIntentId = isset($payload['paymentIntentId']) ? trim((string) $payload['paymentIntentId']) : '';
    if ($paymentIntentId === '') {
        json_response([
            'ok' => false,
            'error' => 'paymentIntentId es obligatorio'
        ], 400);
    }

    try {
        $intent = stripe_get_payment_intent($paymentIntentId);
    } catch (RuntimeException $e) {
        json_response([
            'ok' => false,
            'error' => api_error_message_for_client($e, 502)
        ], 502);
    }

    $status = (string) ($intent['status'] ?? '');
    $paid = in_array($status, ['succeeded', 'requires_capture'], true);

    json_response([
        'ok' => true,
        'paid' => $paid,
        'status' => $status,
        'id' => isset($intent['id']) ? (string) $intent['id'] : $paymentIntentId,
        'amount' => isset($intent['amount']) ? (int) $intent['amount'] : 0,
        'amountReceived' => isset($intent['amount_received']) ? (int) $intent['amount_received'] : 0,
        'currency' => strtoupper((string) ($intent['currency'] ?? payment_currency()))
    ]);
}

if ($method === 'POST' && $resource === 'transfer-proof') {
    require_rate_limit('transfer-proof', 6, 60);

    if (!isset($_FILES['proof']) || !is_array($_FILES['proof'])) {
        json_response([
            'ok' => false,
            'error' => 'Debes adjuntar un comprobante'
        ], 400);
    }

    try {
        $upload = save_transfer_proof_upload($_FILES['proof']);
    } catch (RuntimeException $e) {
        json_response([
            'ok' => false,
            'error' => api_error_message_for_client($e, 400)
        ], 400);
    }

    json_response([
        'ok' => true,
        'data' => [
            'transferProofPath' => (string) ($upload['path'] ?? ''),
            'transferProofUrl' => (string) ($upload['url'] ?? ''),
            'transferProofName' => (string) ($upload['name'] ?? ''),
            'transferProofMime' => (string) ($upload['mime'] ?? ''),
            'transferProofSize' => (int) ($upload['size'] ?? 0)
        ]
    ], 201);
}

if ($method === 'POST' && $resource === 'stripe-webhook') {
    $webhookSecret = payment_stripe_webhook_secret();
    if ($webhookSecret === '') {
        json_response(['ok' => false, 'error' => 'Webhook no configurado'], 503);
    }

    $rawBody = file_get_contents('php://input');
    if (!is_string($rawBody) || $rawBody === '') {
        json_response(['ok' => false, 'error' => 'Cuerpo vacio'], 400);
    }

    $sigHeader = isset($_SERVER['HTTP_STRIPE_SIGNATURE']) ? (string) $_SERVER['HTTP_STRIPE_SIGNATURE'] : '';
    if ($sigHeader === '') {
        json_response(['ok' => false, 'error' => 'Sin firma'], 400);
    }

    try {
        $event = stripe_verify_webhook_signature($rawBody, $sigHeader, $webhookSecret);
    } catch (RuntimeException $e) {
        audit_log_event('stripe.webhook_signature_failed', ['error' => $e->getMessage()]);
        json_response(['ok' => false, 'error' => 'Firma de webhook invalida'], 400);
    }

    $eventType = (string) ($event['type'] ?? '');
    audit_log_event('stripe.webhook_received', ['type' => $eventType]);

    if ($eventType === 'payment_intent.succeeded') {
        $intentData = isset($event['data']['object']) && is_array($event['data']['object']) ? $event['data']['object'] : [];
        $intentId = (string) ($intentData['id'] ?? '');

        if ($intentId !== '') {
            $webhookStore = read_store();
            $updated = false;
            foreach ($webhookStore['appointments'] as &$appt) {
                $existingIntent = trim((string) ($appt['paymentIntentId'] ?? ''));
                if ($existingIntent !== '' && hash_equals($existingIntent, $intentId)) {
                    if (($appt['paymentStatus'] ?? '') !== 'paid') {
                        $appt['paymentStatus'] = 'paid';
                        $appt['paymentPaidAt'] = local_date('c');
                        $updated = true;
                    }
                    break;
                }
            }
            unset($appt);
            if ($updated) {
                write_store($webhookStore);
                if (class_exists('Metrics')) {
                    Metrics::increment('conversion_funnel_events_total', ['step' => 'payment_success']);
                }
                audit_log_event('stripe.webhook_payment_confirmed', ['intentId' => $intentId]);
            }
        }
    }

    if ($eventType === 'payment_intent.payment_failed') {
        $intentData = isset($event['data']['object']) && is_array($event['data']['object']) ? $event['data']['object'] : [];
        $intentId = (string) ($intentData['id'] ?? '');

        if ($intentId !== '') {
            $webhookStore = read_store();
            $updated = false;
            foreach ($webhookStore['appointments'] as &$appt) {
                $existingIntent = trim((string) ($appt['paymentIntentId'] ?? ''));
                if ($existingIntent !== '' && hash_equals($existingIntent, $intentId)) {
                    if (!in_array($appt['paymentStatus'] ?? '', ['paid', 'failed'], true)) {
                        $appt['paymentStatus'] = 'failed';
                        $updated = true;
                    }
                    break;
                }
            }
            unset($appt);
            if ($updated) {
                write_store($webhookStore);
                audit_log_event('stripe.webhook_payment_failed', ['intentId' => $intentId]);
            }
        }
    }

    json_response(['ok' => true, 'received' => true]);
}

if ($method === 'POST' && $resource === 'appointments') {
    require_rate_limit('appointments', 5, 60);
    $payload = require_json_body();
    $appointment = normalize_appointment($payload);

    $validation = validate_appointment_payload($appointment, $store['availability'] ?? []);
    if (!$validation['ok']) {
        json_response([
            'ok' => false,
            'error' => $validation['error']
        ], 400);
    }

    if (appointment_slot_taken($store['appointments'], $appointment['date'], $appointment['time'], null, $appointment['doctor'], $store['idx_appointments_date'] ?? null)) {
        json_response([
            'ok' => false,
            'error' => 'Ese horario ya fue reservado'
        ], 409);
    }

    $paymentMethod = strtolower(trim((string) ($appointment['paymentMethod'] ?? 'unpaid')));
    if (!in_array($paymentMethod, ['card', 'transfer', 'cash', 'unpaid'], true)) {
        json_response([
            'ok' => false,
            'error' => 'Metodo de pago no valido'
        ], 400);
    }

    if ($paymentMethod === 'card') {
        $paymentIntentId = trim((string) ($appointment['paymentIntentId'] ?? ''));
        if ($paymentIntentId === '') {
            json_response([
                'ok' => false,
                'error' => 'Falta confirmar el pago con tarjeta'
            ], 400);
        }

        foreach ($store['appointments'] as $existingAppointment) {
            $existingIntent = trim((string) ($existingAppointment['paymentIntentId'] ?? ''));
            if ($existingIntent !== '' && hash_equals($existingIntent, $paymentIntentId)) {
                json_response([
                    'ok' => false,
                    'error' => 'Este pago ya fue utilizado para otra reserva'
                ], 409);
            }
        }

        if (!payment_gateway_enabled()) {
            json_response([
                'ok' => false,
                'error' => 'La pasarela de pago no esta disponible'
            ], 503);
        }

        try {
            $intent = stripe_get_payment_intent($paymentIntentId);
        } catch (RuntimeException $e) {
            json_response([
                'ok' => false,
                'error' => 'No se pudo validar el pago en este momento'
            ], 502);
        }

        $intentStatus = (string) ($intent['status'] ?? '');
        $expectedAmount = payment_expected_amount_cents($appointment['service']);
        $intentAmount = isset($intent['amount']) ? (int) $intent['amount'] : 0;
        $amountReceived = isset($intent['amount_received']) ? (int) $intent['amount_received'] : 0;
        $intentCurrency = strtoupper((string) ($intent['currency'] ?? payment_currency()));
        $expectedCurrency = strtoupper(payment_currency());
        $intentMetadata = isset($intent['metadata']) && is_array($intent['metadata']) ? $intent['metadata'] : [];
        $metadataSite = trim((string) ($intentMetadata['site'] ?? ''));
        $metadataService = trim((string) ($intentMetadata['service'] ?? ''));
        $metadataDate = trim((string) ($intentMetadata['date'] ?? ''));
        $metadataTime = trim((string) ($intentMetadata['time'] ?? ''));
        $metadataDoctor = trim((string) ($intentMetadata['doctor'] ?? ''));

        if ($intentStatus !== 'succeeded') {
            json_response([
                'ok' => false,
                'error' => 'El pago aun no esta completado'
            ], 400);
        }
        if ($intentAmount !== $expectedAmount || $amountReceived < $expectedAmount) {
            json_response([
                'ok' => false,
                'error' => 'El monto pagado no coincide con la reserva'
            ], 400);
        }
        if ($intentCurrency !== $expectedCurrency) {
            json_response([
                'ok' => false,
                'error' => 'La moneda del pago no coincide con la configuracion'
            ], 400);
        }
        if ($metadataSite !== '' && strcasecmp($metadataSite, 'pielarmonia.com') !== 0) {
            json_response([
                'ok' => false,
                'error' => 'El pago no pertenece a este sitio'
            ], 400);
        }
        if ($metadataService !== '' && $metadataService !== $appointment['service']) {
            json_response([
                'ok' => false,
                'error' => 'El pago no coincide con el servicio seleccionado'
            ], 400);
        }
        if ($metadataDate !== '' && $metadataDate !== $appointment['date']) {
            json_response([
                'ok' => false,
                'error' => 'El pago no coincide con la fecha seleccionada'
            ], 400);
        }
        if ($metadataTime !== '' && $metadataTime !== $appointment['time']) {
            json_response([
                'ok' => false,
                'error' => 'El pago no coincide con la hora seleccionada'
            ], 400);
        }
        if ($metadataDoctor !== '' && $metadataDoctor !== $appointment['doctor']) {
            json_response([
                'ok' => false,
                'error' => 'El pago no coincide con el doctor seleccionado'
            ], 400);
        }

        $appointment['paymentMethod'] = 'card';
        $appointment['paymentStatus'] = 'paid';
        $appointment['paymentProvider'] = 'stripe';
        $appointment['paymentPaidAt'] = local_date('c');
        $appointment['paymentIntentId'] = $paymentIntentId;
    } elseif ($paymentMethod === 'transfer') {
        $reference = trim((string) ($appointment['transferReference'] ?? ''));
        $proofPath = trim((string) ($appointment['transferProofPath'] ?? ''));
        $proofUrl = trim((string) ($appointment['transferProofUrl'] ?? ''));

        if ($reference === '') {
            json_response([
                'ok' => false,
                'error' => 'Debes ingresar el numero de referencia de la transferencia'
            ], 400);
        }
        if ($proofPath === '' || $proofUrl === '') {
            json_response([
                'ok' => false,
                'error' => 'Debes adjuntar el comprobante de transferencia'
            ], 400);
        }

        $appointment['paymentMethod'] = 'transfer';
        $appointment['paymentStatus'] = 'pending_transfer_review';
    } elseif ($paymentMethod === 'cash') {
        $appointment['paymentMethod'] = 'cash';
        $appointment['paymentStatus'] = 'pending_cash';
    } else {
        $appointment['paymentMethod'] = 'unpaid';
        $appointment['paymentStatus'] = 'pending';
    }

    // Si el doctor es "indiferente", asignar al primer doctor con slot libre
    if ($appointment['doctor'] === 'indiferente' || $appointment['doctor'] === '') {
        $doctors = ['rosero', 'narvaez'];
        $assigned = '';
        foreach ($doctors as $candidate) {
            if (!appointment_slot_taken($store['appointments'], $appointment['date'], $appointment['time'], null, $candidate, $store['idx_appointments_date'] ?? null)) {
                $assigned = $candidate;
                break;
            }
        }
        if ($assigned !== '') {
            $appointment['doctorAssigned'] = $assigned;
        }
    }

    $store['appointments'][] = $appointment;
    write_store($store);

    $emailSent = false;
    try {
        $emailSent = maybe_send_appointment_email($appointment);
    } catch (Throwable $e) {
        get_logger()->error('Piel en Armonía: fallo al enviar email de confirmación: ' . $e->getMessage());
    }
    try {
        maybe_send_admin_notification($appointment);
    } catch (Throwable $e) {
        get_logger()->error('Piel en Armonía: fallo al enviar notificación admin: ' . $e->getMessage());
    }

    json_response([
        'ok' => true,
        'data' => $appointment,
        'emailSent' => $emailSent
    ], 201);
}

if (($method === 'PATCH' || $method === 'PUT') && $resource === 'appointments') {
    $payload = require_json_body();
    $id = isset($payload['id']) ? (int) $payload['id'] : 0;
    if ($id <= 0) {
        json_response([
            'ok' => false,
            'error' => 'Identificador inválido'
        ], 400);
    }
    $found = false;
    foreach ($store['appointments'] as &$appt) {
        if ((int) ($appt['id'] ?? 0) !== $id) {
            continue;
        }
        $found = true;
        if (isset($payload['status'])) {
            $appt['status'] = map_appointment_status((string) $payload['status']);
        }
        if (isset($payload['paymentStatus'])) {
            $appt['paymentStatus'] = (string) $payload['paymentStatus'];
        }
        if (isset($payload['paymentMethod'])) {
            $appt['paymentMethod'] = (string) $payload['paymentMethod'];
        }
        if (isset($payload['paymentProvider'])) {
            $appt['paymentProvider'] = (string) $payload['paymentProvider'];
        }
        if (isset($payload['paymentIntentId'])) {
            $appt['paymentIntentId'] = (string) $payload['paymentIntentId'];
        }
        if (isset($payload['paymentPaidAt'])) {
            $appt['paymentPaidAt'] = (string) $payload['paymentPaidAt'];
        }
        if (isset($payload['transferReference'])) {
            $appt['transferReference'] = (string) $payload['transferReference'];
        }
        if (isset($payload['transferProofPath'])) {
            $appt['transferProofPath'] = (string) $payload['transferProofPath'];
        }
        if (isset($payload['transferProofUrl'])) {
            $appt['transferProofUrl'] = (string) $payload['transferProofUrl'];
        }
        if (isset($payload['transferProofName'])) {
            $appt['transferProofName'] = (string) $payload['transferProofName'];
        }
        if (isset($payload['transferProofMime'])) {
            $appt['transferProofMime'] = (string) $payload['transferProofMime'];
        }
    }
    unset($appt);
    if (!$found) {
        json_response([
            'ok' => false,
            'error' => 'Cita no encontrada'
        ], 404);
    }
    write_store($store);

    // Enviar email de cancelación al paciente si se canceló la cita
    if (isset($payload['status']) && map_appointment_status((string) $payload['status']) === 'cancelled') {
        foreach ($store['appointments'] as $apptNotify) {
            if ((int) ($apptNotify['id'] ?? 0) === $id) {
                try { maybe_send_cancellation_email($apptNotify); } catch (Throwable $e) { get_logger()->error('Piel en Armonía: fallo email cancelación: ' . $e->getMessage()); }
                break;
            }
        }
    }

    json_response([
        'ok' => true
    ]);
}

if ($method === 'POST' && $resource === 'callbacks') {
    require_rate_limit('callbacks', 5, 60);
    $payload = require_json_body();
    $callback = normalize_callback($payload);

    if ($callback['telefono'] === '') {
        json_response([
            'ok' => false,
            'error' => 'Teléfono obligatorio'
        ], 400);
    }

    if (!validate_phone($callback['telefono'])) {
        json_response([
            'ok' => false,
            'error' => 'El formato del teléfono no es válido'
        ], 400);
    }

    $store['callbacks'][] = $callback;
    write_store($store);
    try { maybe_send_callback_admin_notification($callback); } catch (Throwable $e) { get_logger()->error('Piel en Armonía: fallo notificación callback: ' . $e->getMessage()); }
    json_response([
        'ok' => true,
        'data' => $callback
    ], 201);
}

if (($method === 'PATCH' || $method === 'PUT') && $resource === 'callbacks') {
    $payload = require_json_body();
    $id = isset($payload['id']) ? (int) $payload['id'] : 0;
    if ($id <= 0) {
        json_response([
            'ok' => false,
            'error' => 'Identificador inválido'
        ], 400);
    }
    $found = false;
    foreach ($store['callbacks'] as &$callback) {
        if ((int) ($callback['id'] ?? 0) !== $id) {
            continue;
        }
        $found = true;
        if (isset($payload['status'])) {
            $callback['status'] = map_callback_status((string) $payload['status']);
        }
    }
    unset($callback);
    if (!$found) {
        json_response([
            'ok' => false,
            'error' => 'Callback no encontrado'
        ], 404);
    }
    write_store($store);
    json_response([
        'ok' => true
    ]);
}

if ($method === 'POST' && $resource === 'reviews') {
    require_rate_limit('reviews', 3, 60);
    $payload = require_json_body();
    $review = normalize_review($payload);
    if ($review['name'] === '' || $review['text'] === '') {
        json_response([
            'ok' => false,
            'error' => 'Nombre y reseña son obligatorios'
        ], 400);
    }
    $store['reviews'][] = $review;
    write_store($store);
    json_response([
        'ok' => true,
        'data' => $review
    ], 201);
}

if ($method === 'POST' && $resource === 'availability') {
    $payload = require_json_body();
    $availability = isset($payload['availability']) && is_array($payload['availability'])
        ? $payload['availability']
        : [];
    $store['availability'] = $availability;
    write_store($store);
    json_response([
        'ok' => true,
        'data' => $store['availability']
    ]);
}

if ($method === 'POST' && $resource === 'import') {
    if (!$isAdmin) {
        json_response(['ok' => false, 'error' => 'No autorizado'], 401);
    }
    require_csrf();
    $payload = require_json_body();
    $store['appointments'] = isset($payload['appointments']) && is_array($payload['appointments']) ? $payload['appointments'] : [];
    $store['callbacks'] = isset($payload['callbacks']) && is_array($payload['callbacks']) ? $payload['callbacks'] : [];
    $store['reviews'] = isset($payload['reviews']) && is_array($payload['reviews']) ? $payload['reviews'] : [];
    $store['availability'] = isset($payload['availability']) && is_array($payload['availability']) ? $payload['availability'] : [];
    write_store($store);
    json_response([
        'ok' => true
    ]);
}

// ── Reprogramación pública (por token) ──────────────────
if ($method === 'GET' && $resource === 'reschedule') {
    $token = trim((string) ($_GET['token'] ?? ''));
    if ($token === '' || strlen($token) < 16) {
        json_response(['ok' => false, 'error' => 'Token inválido'], 400);
    }

    $found = null;
    foreach ($store['appointments'] as $appt) {
        if (($appt['rescheduleToken'] ?? '') === $token && ($appt['status'] ?? '') !== 'cancelled') {
            $found = $appt;
            break;
        }
    }

    if (!$found) {
        json_response(['ok' => false, 'error' => 'Cita no encontrada o cancelada'], 404);
    }

    json_response([
        'ok' => true,
        'data' => [
            'id' => $found['id'],
            'service' => $found['service'] ?? '',
            'doctor' => $found['doctor'] ?? '',
            'date' => $found['date'] ?? '',
            'time' => $found['time'] ?? '',
            'name' => $found['name'] ?? '',
            'status' => $found['status'] ?? ''
        ]
    ]);
}

if ($method === 'PATCH' && $resource === 'reschedule') {
    require_rate_limit('reschedule', 5, 60);
    $payload = require_json_body();
    $token = trim((string) ($payload['token'] ?? ''));
    $newDate = trim((string) ($payload['date'] ?? ''));
    $newTime = trim((string) ($payload['time'] ?? ''));

    if ($token === '' || strlen($token) < 16) {
        json_response(['ok' => false, 'error' => 'Token inválido'], 400);
    }
    if ($newDate === '' || $newTime === '') {
        json_response(['ok' => false, 'error' => 'Fecha y hora son obligatorias'], 400);
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $newDate)) {
        json_response(['ok' => false, 'error' => 'Formato de fecha inválido'], 400);
    }
    if (strtotime($newDate) < strtotime(date('Y-m-d'))) {
        json_response(['ok' => false, 'error' => 'No puedes reprogramar a una fecha pasada'], 400);
    }

    $found = false;
    foreach ($store['appointments'] as &$appt) {
        if (($appt['rescheduleToken'] ?? '') !== $token) {
            continue;
        }
        if (($appt['status'] ?? '') === 'cancelled') {
            json_response(['ok' => false, 'error' => 'Esta cita fue cancelada'], 400);
        }

        $doctor = $appt['doctor'] ?? '';
        $excludeId = (int) ($appt['id'] ?? 0);
        if (appointment_slot_taken($store['appointments'], $newDate, $newTime, $excludeId, $doctor, $store['idx_appointments_date'] ?? null)) {
            json_response(['ok' => false, 'error' => 'El horario seleccionado ya no está disponible'], 409);
        }

        $appt['date'] = $newDate;
        $appt['time'] = $newTime;
        $appt['reminderSentAt'] = '';
        $found = true;

        write_store($store);
        try { maybe_send_reschedule_email($appt); } catch (Throwable $e) { get_logger()->error('Piel en Armonía: fallo email reagendar: ' . $e->getMessage()); }

        json_response([
            'ok' => true,
            'data' => [
                'id' => $appt['id'],
                'date' => $newDate,
                'time' => $newTime
            ]
        ]);
    }
    unset($appt);

    if (!$found) {
        json_response(['ok' => false, 'error' => 'Cita no encontrada'], 404);
    }
}

json_response([
    'ok' => false,
    'error' => 'Ruta no soportada'
], 404);
