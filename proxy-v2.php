<?php
/**
 * PROXY PARA KIMI API - VERSION 2
 * API Key hardcodeada para evitar problemas de transmisión
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// API KEY HARDCODEADA - Reemplazar con tu key válida
$API_KEY = 'sk-kimi-lMIpVZxWGocfNOqaKO68Ws54Gi2lBuiFHkyBRA7VlCDWVeW0PWUAup1fUucHjHLZ';

// También permitir key desde frontend (para flexibilidad)
$input = file_get_contents('php://input');
$data = json_decode($input, true);

// Usar key del frontend si existe, sino usar la hardcodeada
$apiKey = (!empty($data['api_key'])) ? $data['api_key'] : $API_KEY;

// Log para debug (quitar en producción)
error_log('API Key usada: ' . substr($apiKey, 0, 20) . '...');

if (empty($apiKey)) {
    echo json_encode(['error' => 'API key no configurada']);
    exit();
}

$kimiUrl = 'https://api.moonshot.cn/v1/chat/completions';

$payload = [
    'model' => $data['model'] ?? 'moonshot-v1-8k',
    'messages' => $data['messages'] ?? [],
    'max_tokens' => $data['max_tokens'] ?? 1000,
    'temperature' => $data['temperature'] ?? 0.7
];

$ch = curl_init($kimiUrl);

curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($payload),
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey
    ],
    CURLOPT_TIMEOUT => 30,
    CURLOPT_SSL_VERIFYPEER => true
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);

curl_close($ch);

if ($error) {
    echo json_encode(['error' => 'cURL Error: ' . $error]);
    exit();
}

// Devolver respuesta exacta de Kimi
echo $response;
