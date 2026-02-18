<?php
declare(strict_types=1);

require_once __DIR__ . '/api-lib.php';

$allowedOrigin = getenv('PIELARMONIA_ALLOWED_ORIGIN');
if (is_string($allowedOrigin) && $allowedOrigin !== '') {
    header('Access-Control-Allow-Origin: ' . $allowedOrigin);
} else {
    header('Access-Control-Allow-Origin: ' . (isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*'));
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
header('Access-Control-Allow-Credentials: true');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

start_secure_session();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$action = isset($_GET['action']) ? (string) $_GET['action'] : '';

if ($method === 'GET' && $action === 'status') {
    $isAuth = isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true;
    $resp = ['ok' => true, 'authenticated' => $isAuth];
    if ($isAuth) {
        $resp['csrfToken'] = generate_csrf_token();
    }
    json_response($resp);
}

if ($method === 'POST' && $action === 'login') {
    $payload = require_json_body();
    $password = isset($payload['password']) ? (string) $payload['password'] : '';
    if ($password === '') {
        json_response([
            'ok' => false,
            'error' => 'Contraseña requerida'
        ], 400);
    }

    if (!verify_admin_password($password)) {
        json_response([
            'ok' => false,
            'error' => 'Credenciales inválidas'
        ], 401);
    }

    session_regenerate_id(true);
    $_SESSION['admin_logged_in'] = true;

    json_response([
        'ok' => true,
        'authenticated' => true,
        'csrfToken' => generate_csrf_token()
    ]);
}

if ($method === 'POST' && $action === 'logout') {
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
