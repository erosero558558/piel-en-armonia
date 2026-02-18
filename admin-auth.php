<?php
declare(strict_types=1);

require_once __DIR__ . '/api-lib.php';

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
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

start_secure_session();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$action = isset($_GET['action']) ? (string) $_GET['action'] : '';

if ($method === 'GET' && $action === 'status') {
    $isAuth = isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true;
    audit_log_event('admin.status', [
        'authenticated' => $isAuth
    ]);
    $resp = ['ok' => true, 'authenticated' => $isAuth];
    if ($isAuth) {
        $resp['csrfToken'] = generate_csrf_token();
    }
    json_response($resp);
}

if ($method === 'POST' && $action === 'login') {
    require_rate_limit('admin-login', 5, 300);

    $payload = require_json_body();
    $password = isset($payload['password']) ? (string) $payload['password'] : '';
    if ($password === '') {
        json_response([
            'ok' => false,
            'error' => 'Contraseña requerida'
        ], 400);
    }

    if (!verify_admin_password($password)) {
        audit_log_event('admin.login_failed', [
            'reason' => 'invalid_credentials'
        ]);
        json_response([
            'ok' => false,
            'error' => 'Credenciales inválidas'
        ], 401);
    }

    session_regenerate_id(true);
    $_SESSION['admin_logged_in'] = true;
    audit_log_event('admin.login_success', [
        'authenticated' => true
    ]);

    json_response([
        'ok' => true,
        'authenticated' => true,
        'csrfToken' => generate_csrf_token()
    ]);
}

if ($method === 'POST' && $action === 'logout') {
    audit_log_event('admin.logout', [
        'authenticated' => false
    ]);
    destroy_secure_session();

    json_response([
        'ok' => true,
        'authenticated' => false
    ]);
}

json_response([
    'ok' => false,
    'error' => 'Acción no válida'
], 404);
