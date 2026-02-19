<?php
declare(strict_types=1);

require_once __DIR__ . '/api-lib.php';
require_once __DIR__ . '/payment-lib.php';
require_once __DIR__ . '/api-router.php';

// Controllers
require_once __DIR__ . '/controllers/HealthController.php';
require_once __DIR__ . '/controllers/AppointmentController.php';
require_once __DIR__ . '/controllers/PaymentController.php';
require_once __DIR__ . '/controllers/ReviewController.php';
require_once __DIR__ . '/controllers/CallbackController.php';
require_once __DIR__ . '/controllers/AvailabilityController.php';
require_once __DIR__ . '/controllers/AdminDataController.php';

$requestStartedAt = microtime(true);

function api_elapsed_ms(float $startedAt): int
{
    return (int) round((microtime(true) - $startedAt) * 1000);
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
    if ($elapsed < 2000) {
        return;
    }
    audit_log_event('api.slow', [
        'method' => $method,
        'resource' => $resource,
        'timingMs' => $elapsed
    ]);
});

$router = new Router();

// Register Health
$router->get('health', [HealthController::class, 'check']);

// Handle Health Early
if ($resource === 'health') {
    if ($router->dispatch($method, $resource, [
        'requestStartedAt' => $requestStartedAt,
        'method' => $method,
        'resource' => $resource
    ])) {
        exit();
    }
}

$publicEndpoints = [
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
    $publicMutations = ['appointments', 'callbacks', 'reviews', 'payment-intent', 'payment-verify', 'transfer-proof', 'stripe-webhook'];
    if (!in_array($resource, $publicMutations, true)) {
        require_csrf();
    }
}

$store = read_store();

$context = [
    'store' => &$store,
    'isAdmin' => $isAdmin,
    'method' => $method,
    'resource' => $resource,
    'requestStartedAt' => $requestStartedAt
];

// Register Routes
$router->get('data', [AdminDataController::class, 'index']);
$router->post('import', [AdminDataController::class, 'import']);

$router->get('appointments', [AppointmentController::class, 'index']);
$router->post('appointments', [AppointmentController::class, 'store']);
$router->patch('appointments', [AppointmentController::class, 'update']);
$router->put('appointments', [AppointmentController::class, 'update']);

$router->get('booked-slots', [AppointmentController::class, 'bookedSlots']);
$router->get('reschedule', [AppointmentController::class, 'checkReschedule']);
$router->patch('reschedule', [AppointmentController::class, 'processReschedule']);

$router->get('payment-config', [PaymentController::class, 'config']);
$router->post('payment-intent', [PaymentController::class, 'createIntent']);
$router->post('payment-verify', [PaymentController::class, 'verify']);
$router->post('transfer-proof', [PaymentController::class, 'transferProof']);
$router->post('stripe-webhook', [PaymentController::class, 'webhook']);

$router->get('reviews', [ReviewController::class, 'index']);
$router->post('reviews', [ReviewController::class, 'store']);

$router->get('callbacks', [CallbackController::class, 'index']);
$router->post('callbacks', [CallbackController::class, 'store']);
$router->patch('callbacks', [CallbackController::class, 'update']);
$router->put('callbacks', [CallbackController::class, 'update']);

$router->get('availability', [AvailabilityController::class, 'index']);
$router->post('availability', [AvailabilityController::class, 'update']);

if (!$router->dispatch($method, $resource, $context)) {
    json_response([
        'ok' => false,
        'error' => 'Ruta no soportada'
    ], 404);
}
