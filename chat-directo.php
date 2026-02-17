<?php
// Chat directo con Kimi - API hardcodeada
// Solo para pruebas - NO usar en producción con esta key expuesta

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// API KEY - REEMPLAZAR AQUI
$API_KEY = 'sk-kimi-lMIpVZxWGocfNOqaKO68Ws54Gi2lBuiFHkyBRA7VlCDWVeW0PWUAup1fUucHjHLZ';

// Obtener mensaje del usuario
$mensaje = $_GET['msg'] ?? 'Hola';

// Preparar datos para Kimi
$data = [
    'model' => 'moonshot-v1-8k',
    'messages' => [
        ['role' => 'system', 'content' => 'Eres el Dr. Virtual de Piel en Armonia, clinica dermatologica en Quito.'],
        ['role' => 'user', 'content' => $mensaje]
    ],
    'max_tokens' => 500
];

// Enviar a Kimi
$ch = curl_init('https://api.moonshot.cn/v1/chat/completions');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Bearer ' . $API_KEY
]);

$response = curl_exec($ch);
curl_close($ch);

// Devolver respuesta
echo $response;
