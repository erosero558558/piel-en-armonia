<?php
/**
 * PROXY PARA KIMI API (Moonshot AI)
 * 
 * Este archivo actúa como intermediario entre el frontend y la API de Kimi,
 * solucionando problemas de CORS.
 * 
 * Coloca este archivo en tu servidor web (requiere PHP 7.4+)
 */

// Configuración de errores (deshabilitado en producción)
error_reporting(0);
ini_set('display_errors', 0);

// Configuración de CORS - Permitir solo desde pielarmonia.com
$allowed_origins = [
    'https://pielarmonia.com',
    'https://www.pielarmonia.com',
    'http://pielarmonia.com',
    'http://localhost', // Para desarrollo local
    'http://127.0.0.1'
];

$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';

if (in_array($origin, $allowed_origins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
} else {
    header('Access-Control-Allow-Origin: https://pielarmonia.com');
}
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

// Manejar peticiones OPTIONS (preflight CORS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Endpoint de test
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode([
        'status' => 'ok',
        'message' => 'Proxy funcionando correctamente',
        'php_version' => phpversion(),
        'curl_enabled' => function_exists('curl_init'),
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    exit();
}

// Solo aceptar POST para la API
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método no permitido. Usa POST para la API o GET para test.']);
    exit();
}

// Leer el cuerpo de la petición
$input = file_get_contents('php://input');
$data = json_decode($input, true);

// Validar datos recibidos
if (!$data || !isset($data['messages']) || !is_array($data['messages'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Datos inválidos. Se requiere "messages".']);
    exit();
}

// API Key de Kimi - Hardcodeada (más seguro)
$apiKey = 'sk-kimi-lMIpVZxWGocfNOqaKO68Ws54Gi2lBuiFHkyBRA7VlCDWVeW0PWUAup1fUucHjHLZ';

// Si quieres usar la key del frontend (menos seguro), descomenta:
// $apiKey = isset($data['api_key']) ? trim($data['api_key']) : $apiKey;

// Configuración de la petición a Kimi
$kimiUrl = 'https://api.moonshot.cn/v1/chat/completions';

$payload = [
    'model' => isset($data['model']) ? $data['model'] : 'moonshot-v1-8k',
    'messages' => $data['messages'],
    'max_tokens' => isset($data['max_tokens']) ? intval($data['max_tokens']) : 1000,
    'temperature' => isset($data['temperature']) ? floatval($data['temperature']) : 0.7
];

// Inicializar cURL
$ch = curl_init($kimiUrl);

$headers = [
    'Content-Type: application/json',
    'Authorization: Bearer ' . $apiKey
];



curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($payload),
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_FOLLOWLOCATION => true
]);

// Ejecutar petición
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);

curl_close($ch);

// Separar headers del body (porque CURLOPT_HEADER está activo)
$headerSize = strpos($response, "\r\n\r\n");
if ($headerSize !== false) {
    $body = substr($response, $headerSize + 4);
} else {
    $body = $response;
}



// Manejar errores de cURL
if ($error) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Error de conexión con Kimi API',
        'details' => $error
    ]);
    exit();
}

// Devolver respuesta de Kimi al cliente
http_response_code($httpCode);
echo $body;
