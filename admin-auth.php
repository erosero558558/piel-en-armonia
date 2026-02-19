<?php
declare(strict_types=1);

require_once __DIR__ . '/api-lib.php';

apply_security_headers(false);
api_apply_cors(['GET', 'POST', 'OPTIONS'], ['Content-Type', 'X-CSRF-Token'], true);

start_secure_session();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$action = isset($_GET['action']) ? (string) $_GET['action'] : '';
const ADMIN_LOGIN_ACTION = 'admin-login';
const ADMIN_LOGIN_FAIL_ACTION = 'admin-login-failed';

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
    // Limite de intentos globales por IP para el endpoint de login.
    require_rate_limit(ADMIN_LOGIN_ACTION, 12, 300);

    // Bloqueo temporal por credenciales fallidas repetidas.
    if (is_rate_limited(ADMIN_LOGIN_FAIL_ACTION, 5, 900)) {
        audit_log_event('admin.login_blocked', [
            'reason' => 'too_many_failed_attempts'
        ]);
        header('Retry-After: 900');
        json_response([
            'ok' => false,
            'error' => 'Demasiados intentos fallidos. Intenta nuevamente en 15 minutos.'
        ], 429);
    }

    $payload = require_json_body();
    $password = isset($payload['password']) ? (string) $payload['password'] : '';
    if ($password === '') {
        json_response([
            'ok' => false,
            'error' => 'Contraseña requerida'
        ], 400);
    }

    if (!verify_admin_password($password)) {
        check_rate_limit(ADMIN_LOGIN_FAIL_ACTION, 5, 900);
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
    reset_rate_limit(ADMIN_LOGIN_FAIL_ACTION);
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
