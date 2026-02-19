<?php
declare(strict_types=1);

/**
 * Deprecated endpoint.
 * Chatbot traffic must use /figo-chat.php
 */

require_once __DIR__ . '/api-lib.php';
apply_security_headers(false);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit();
}

http_response_code(410);
echo json_encode([
    'ok' => false,
    'error' => 'Endpoint deshabilitado',
    'message' => 'Usa figo-chat.php para el asistente virtual.',
    'deprecated' => true,
    'replacement' => '/figo-chat.php'
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
