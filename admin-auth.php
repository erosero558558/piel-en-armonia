<?php
declare(strict_types=1);

require_once __DIR__ . '/api-lib.php';

header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

start_secure_session();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$action = isset($_GET['action']) ? (string) $_GET['action'] : '';

if ($method === 'GET' && $action === 'status') {
    json_response([
        'ok' => true,
        'authenticated' => isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true
    ]);
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
        'authenticated' => true
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
    'error' => 'Acción no soportada'
], 404);
