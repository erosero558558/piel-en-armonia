<?php

declare(strict_types=1);

if (PHP_SAPI === 'cli') {
    return;
}

require_once __DIR__ . '/../api-lib.php';

$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$requestPath = is_string($requestPath) ? $requestPath : '/';

$directPhpEntryPoints = [
    '/admin-auth.php',
    '/api.php',
    '/backup-receiver.php',
    '/check-ai-response.php',
    '/cron.php',
    '/figo-ai-bridge.php',
    '/figo-backend.php',
    '/figo-chat.php',
    '/hosting-runtime.php',
    '/payment-lib.php',
    '/verify-backup.php',
];

if (in_array($requestPath, $directPhpEntryPoints, true)) {
    return false;
}

if (app_backend_only_is_removed_ui_path($requestPath)) {
    apply_security_headers(false);
    header('Content-Type: application/json; charset=UTF-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
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

// ── Servir archivos estáticos localmente ──────────────────────────────
// HTML, JS, CSS que existen en disco los servimos directamente.
// En producción (nginx/Apache) esto lo maneja el servidor web.
$mimeMap = [
    'html' => 'text/html; charset=utf-8',
    'js'   => 'application/javascript; charset=utf-8',
    'css'  => 'text/css; charset=utf-8',
    'json' => 'application/json; charset=utf-8',
    'svg'  => 'image/svg+xml',
    'ico'  => 'image/x-icon',
    'png'  => 'image/png',
    'jpg'  => 'image/jpeg',
    'webp' => 'image/webp',
];

$ext = strtolower(pathinfo($requestPath, PATHINFO_EXTENSION));
if (isset($mimeMap[$ext])) {
    $filePath = __DIR__ . '/../' . ltrim($requestPath, '/');
    $filePath = realpath($filePath);
    $rootPath = realpath(__DIR__ . '/../');
    // Validación de path traversal
    if ($filePath !== false && $rootPath !== false && str_starts_with($filePath, $rootPath . '/')) {
        if (is_file($filePath)) {
            header('Content-Type: ' . $mimeMap[$ext]);
            header('Cache-Control: no-cache');
            readfile($filePath);
            exit;
        }
    }
}

require __DIR__ . '/../index.php';
