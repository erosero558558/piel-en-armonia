<?php
declare(strict_types=1);

require_once __DIR__ . '/api-lib.php';

api_apply_cors(['GET', 'POST', 'OPTIONS'], ['Content-Type', 'X-CSRF-Token'], true);

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
