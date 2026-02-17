<?php
declare(strict_types=1);

/**
 * Proxy for Moonshot/Kimi API.
 * Expected environment variable:
 * - KIMI_API_KEY
 */

error_reporting(0);
ini_set('display_errors', '0');

$allowedOrigins = [
    'https://pielarmonia.com',
    'https://www.pielarmonia.com',
    'http://pielarmonia.com',
    'http://localhost',
    'http://127.0.0.1'
];

$origin = isset($_SERVER['HTTP_ORIGIN']) ? (string) $_SERVER['HTTP_ORIGIN'] : '';
$allowedOrigin = 'https://pielarmonia.com';

foreach ($allowedOrigins as $candidate) {
    if (stripos($origin, $candidate) === 0) {
        $allowedOrigin = $origin;
        break;
    }
}

header('Access-Control-Allow-Origin: ' . $allowedOrigin);
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit();
}

$apiKey = getenv('KIMI_API_KEY');
if (!is_string($apiKey) || trim($apiKey) === '') {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
        echo json_encode([
            'status' => 'error',
            'message' => 'KIMI_API_KEY no configurada',
            'php_version' => phpversion(),
            'curl_enabled' => function_exists('curl_init'),
            'timestamp' => gmdate('c')
        ], JSON_UNESCAPED_UNICODE);
        exit();
    }

    http_response_code(503);
    echo json_encode([
        'error' => 'Servicio no configurado',
        'details' => 'Define KIMI_API_KEY en el servidor'
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    echo json_encode([
        'status' => 'ok',
        'message' => 'Proxy funcionando correctamente',
        'php_version' => phpversion(),
        'curl_enabled' => function_exists('curl_init'),
        'timestamp' => gmdate('c')
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Metodo no permitido'], JSON_UNESCAPED_UNICODE);
    exit();
}

$raw = file_get_contents('php://input');
$data = json_decode($raw ?? '', true);
if (!is_array($data) || !isset($data['messages']) || !is_array($data['messages'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Datos invalidos. Se requiere "messages".'], JSON_UNESCAPED_UNICODE);
    exit();
}

$payload = [
    'model' => isset($data['model']) ? (string) $data['model'] : 'moonshot-v1-8k',
    'messages' => $data['messages'],
    'max_tokens' => isset($data['max_tokens']) ? (int) $data['max_tokens'] : 1000,
    'temperature' => isset($data['temperature']) ? (float) $data['temperature'] : 0.7
];

$ch = curl_init('https://api.moonshot.cn/v1/chat/completions');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . trim($apiKey)
    ],
    CURLOPT_TIMEOUT => 30,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_FOLLOWLOCATION => false
]);

$response = curl_exec($ch);
$httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($error !== '') {
    http_response_code(502);
    echo json_encode([
        'error' => 'Error de conexion con Kimi API',
        'details' => $error
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

if ($response === false || $response === '') {
    http_response_code(502);
    echo json_encode([
        'error' => 'Respuesta vacia desde Kimi API'
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

http_response_code($httpCode > 0 ? $httpCode : 200);
echo $response;

