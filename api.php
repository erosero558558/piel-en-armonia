<?php

declare(strict_types=1);

require_once __DIR__ . '/api-lib.php';
require_once __DIR__ . '/payment-lib.php';
require_once __DIR__ . '/lib/monitoring.php';
require_once __DIR__ . '/lib/metrics.php';
require_once __DIR__ . '/lib/prediction.php';
require_once __DIR__ . '/lib/figo_utils.php';
require_once __DIR__ . '/lib/http.php';

// Router and Routes
require_once __DIR__ . '/lib/Router.php';
require_once __DIR__ . '/lib/routes.php';

// Controllers
require_once __DIR__ . '/controllers/HealthController.php';
require_once __DIR__ . '/controllers/PaymentController.php';
require_once __DIR__ . '/controllers/AdminDataController.php';
require_once __DIR__ . '/controllers/AppointmentController.php';
require_once __DIR__ . '/controllers/CallbackController.php';
require_once __DIR__ . '/controllers/ReviewController.php';
require_once __DIR__ . '/controllers/AvailabilityController.php';
require_once __DIR__ . '/controllers/ContentController.php';
require_once __DIR__ . '/controllers/SystemController.php';
require_once __DIR__ . '/controllers/ConfigController.php';

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

// CORS
api_apply_cors(['GET', 'POST', 'PUT', 'PATCH', 'OPTIONS'], ['Content-Type', 'Authorization', 'X-CSRF-Token']);

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$resource = isset($_GET['resource']) ? (string) $_GET['resource'] : '';
$action = isset($_GET['action']) ? (string) $_GET['action'] : '';

if ($resource === '' && $action !== '') {
    $resource = $action;
}

// Rate Limiting Configuration
$rateLimits = [
    // Public GET - High volume
    'content:GET' => [120, 60],
    'features:GET' => [60, 60],
    'availability:GET' => [60, 60],
    'reviews:GET' => [60, 60],
    'booked-slots:GET' => [60, 60],
    'payment-config:GET' => [60, 60],
    'monitoring-config:GET' => [60, 60],
    'metrics:GET' => [60, 60],

    // Public POST - Actionable, lower volume to prevent spam
    'payment-intent:POST' => [10, 60],
    'payment-verify:POST' => [10, 60],
    'transfer-proof:POST' => [5, 60],
    'appointments:POST' => [5, 60],
    'reviews:POST' => [5, 60],
    'callbacks:POST' => [5, 60],

    // Webhooks
    'stripe-webhook:POST' => [60, 60],

    // Reschedule
    'reschedule:GET' => [30, 60],
    'reschedule:PATCH' => [10, 60],

    // Admin (authenticated)
    'data:GET' => [60, 60],
    'import:POST' => [5, 60],

    // Predictions
    'predictions:GET' => [20, 60],
];

$limitKey = $resource . ':' . $method;

if (isset($rateLimits[$limitKey])) {
    [$limitMax, $limitWindow] = $rateLimits[$limitKey];
    $clientIp = rate_limit_client_ip();
    // Bypass for localhost (IPv4 and IPv6) to allow local testing
    if ($clientIp !== '127.0.0.1' && $clientIp !== '::1') {
        require_rate_limit($limitKey, $limitMax, $limitWindow);
    }
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
    ['method' => 'GET', 'resource' => 'content'],
    // Previously handled inline as public
    ['method' => 'GET', 'resource' => 'health'],
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

// Determine Version
$version = 'v1';
if (isset($_SERVER['HTTP_X_API_VERSION'])) {
    $version = trim((string) $_SERVER['HTTP_X_API_VERSION']);
} elseif (isset($_GET['v'])) {
    $version = trim((string) $_GET['v']);
}
if (ctype_digit($version)) {
    $version = 'v' . $version;
}
// Basic validation for version format 'v1', 'v2', etc.
if (!preg_match('/^v\d+$/', $version)) {
    $version = 'v1';
}

// Initialize Router and Dispatch
$router = new Router();
register_api_routes($router);
$router->dispatch($method, $resource, $version, $context);
