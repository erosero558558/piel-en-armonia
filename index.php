<?php

declare(strict_types=1);

require_once __DIR__ . '/api-lib.php';

$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$requestPath = is_string($requestPath) ? $requestPath : '/';

apply_security_headers(false);
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

if (app_backend_only_is_removed_ui_path($requestPath)) {
    http_response_code(410);
    echo json_encode([
        'ok' => false,
        'code' => 'ui_surface_removed',
        'error' => 'This UI surface was removed. Aurora Derm now runs in backend-only mode.',
        'path' => $requestPath,
        'replacement' => app_backend_only_replacement_relative_url($requestPath),
        'health' => app_api_relative_url('health'),
        'api' => app_relative_url('/api.php'),
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

if ($requestPath !== '/') {
    http_response_code(404);
    echo json_encode([
        'ok' => false,
        'code' => 'not_found',
        'error' => 'Route not found.',
        'path' => $requestPath,
        'health' => app_api_relative_url('health'),
        'api' => app_relative_url('/api.php'),
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

http_response_code(200);
echo json_encode(
    app_backend_only_root_payload(),
    JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT
);
