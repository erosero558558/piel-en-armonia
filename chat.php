<?php
// Chat sin cURL - usa file_get_contents
error_reporting(0);
header('Content-Type: application/json');

$API_KEY = 'sk-kimi-lMIpVZxWGocfNOqaKO68Ws54Gi2lBuiFHkyBRA7VlCDWVeW0PWUAup1fUucHjHLZ';
$mensaje = isset($_GET['m']) ? $_GET['m'] : 'Hola';

// Preparar datos
$postData = json_encode([
    'model' => 'moonshot-v1-8k',
    'messages' => [
        ['role' => 'system', 'content' => 'Eres util.'],
        ['role' => 'user', 'content' => $mensaje]
    ]
]);

// Opciones para file_get_contents
$opts = [
    'http' => [
        'method' => 'POST',
        'header' => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $API_KEY,
            'Content-Length: ' . strlen($postData)
        ],
        'content' => $postData,
        'timeout' => 30
    ]
];

// Hacer peticion
$context = stream_context_create($opts);
$response = @file_get_contents('https://api.moonshot.cn/v1/chat/completions', false, $context);

if ($response === false) {
    $error = error_get_last();
    echo json_encode(['error' => 'Error de conexion: ' . ($error['message'] ?? 'Desconocido')]);
    exit;
}

echo $response;
