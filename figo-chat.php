<?php
declare(strict_types=1);

require_once __DIR__ . '/api-lib.php';

/**
 * Figo chat endpoint.
 * Frontend -> /figo-chat.php -> configured Figo backend.
 */

function figo_apply_cors(): void
{
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

    $origin = isset($_SERVER['HTTP_ORIGIN']) ? trim((string) $_SERVER['HTTP_ORIGIN']) : '';
    if ($origin === '') {
        return;
    }

    $allowed = [];
    $rawAllowed = getenv('PIELARMONIA_ALLOWED_ORIGINS');
    if (is_string($rawAllowed) && trim($rawAllowed) !== '') {
        foreach (explode(',', $rawAllowed) as $item) {
            $item = trim($item);
            if ($item !== '') {
                $allowed[] = rtrim($item, '/');
            }
        }
    }

    $host = isset($_SERVER['HTTP_HOST']) ? trim((string) $_SERVER['HTTP_HOST']) : '';
    if ($host !== '') {
        $scheme = is_https_request() ? 'https' : 'http';
        $allowed[] = $scheme . '://' . $host;
    }

    $allowed[] = 'https://pielarmonia.com';
    $allowed[] = 'https://www.pielarmonia.com';
    $allowed = array_values(array_unique(array_filter($allowed)));

    $normalizedOrigin = rtrim($origin, '/');
    foreach ($allowed as $allowedOrigin) {
        if (strcasecmp($normalizedOrigin, $allowedOrigin) === 0) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Vary: Origin');
            return;
        }
    }
}

function figo_extract_text(array $decoded, string $raw): string
{
    if (isset($decoded['choices'][0]['message']['content']) && is_string($decoded['choices'][0]['message']['content'])) {
        return trim($decoded['choices'][0]['message']['content']);
    }

    if (isset($decoded['message']['content']) && is_string($decoded['message']['content'])) {
        return trim($decoded['message']['content']);
    }

    foreach (['reply', 'response', 'text', 'answer', 'output'] as $key) {
        if (isset($decoded[$key]) && is_string($decoded[$key])) {
            return trim($decoded[$key]);
        }
    }

    return trim($raw);
}

figo_apply_cors();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit();
}

header('Content-Type: application/json; charset=utf-8');

$endpoint = trim((string) getenv('FIGO_CHAT_ENDPOINT'));

if ($method === 'GET') {
    json_response([
        'ok' => true,
        'service' => 'figo-chat',
        'configured' => $endpoint !== '',
        'timestamp' => gmdate('c')
    ]);
}

if ($method !== 'POST') {
    json_response([
        'ok' => false,
        'error' => 'Metodo no permitido'
    ], 405);
}

if ($endpoint === '') {
    json_response([
        'ok' => false,
        'error' => 'Figo backend no configurado',
        'hint' => 'Define FIGO_CHAT_ENDPOINT en el servidor'
    ], 503);
}

$payload = require_json_body();
$messages = isset($payload['messages']) && is_array($payload['messages'])
    ? $payload['messages']
    : [];

if ($messages === []) {
    json_response([
        'ok' => false,
        'error' => 'messages es obligatorio'
    ], 400);
}

$model = isset($payload['model']) && is_string($payload['model']) && trim($payload['model']) !== ''
    ? trim($payload['model'])
    : 'figo-assistant';

$maxTokens = isset($payload['max_tokens']) ? (int) $payload['max_tokens'] : 1000;
if ($maxTokens < 64) {
    $maxTokens = 64;
}
if ($maxTokens > 2000) {
    $maxTokens = 2000;
}

$temperature = isset($payload['temperature']) ? (float) $payload['temperature'] : 0.7;
if ($temperature < 0.0) {
    $temperature = 0.0;
}
if ($temperature > 1.0) {
    $temperature = 1.0;
}

$upstreamPayload = [
    'model' => $model,
    'messages' => array_slice($messages, -20),
    'max_tokens' => $maxTokens,
    'temperature' => $temperature,
    'metadata' => [
        'site' => 'pielarmonia.com',
        'source' => 'web'
    ]
];

$encodedPayload = json_encode($upstreamPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if (!is_string($encodedPayload)) {
    json_response([
        'ok' => false,
        'error' => 'No se pudo serializar el payload'
    ], 500);
}

$headers = [
    'Content-Type: application/json',
    'Accept: application/json'
];

$authToken = trim((string) getenv('FIGO_CHAT_TOKEN'));
if ($authToken !== '') {
    $headers[] = 'Authorization: Bearer ' . $authToken;
}

$apiKey = trim((string) getenv('FIGO_CHAT_APIKEY'));
$apiKeyHeader = trim((string) getenv('FIGO_CHAT_APIKEY_HEADER'));
if ($apiKey !== '' && $apiKeyHeader !== '') {
    $headers[] = $apiKeyHeader . ': ' . $apiKey;
}

$timeout = (int) getenv('FIGO_CHAT_TIMEOUT_SECONDS');
if ($timeout <= 0) {
    $timeout = 20;
}

$ch = curl_init($endpoint);
if ($ch === false) {
    json_response([
        'ok' => false,
        'error' => 'No se pudo inicializar la conexion de chat'
    ], 500);
}

curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_POSTFIELDS => $encodedPayload,
    CURLOPT_TIMEOUT => $timeout,
    CURLOPT_CONNECTTIMEOUT => 10
]);

$rawResponse = curl_exec($ch);
$httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr = curl_error($ch);
curl_close($ch);

if (!is_string($rawResponse)) {
    error_log('Piel en Armonia figo-chat cURL error: ' . $curlErr);
    json_response([
        'ok' => false,
        'error' => 'No se pudo conectar con el bot Figo'
    ], 502);
}

if ($httpCode >= 400) {
    $snippet = trim(substr($rawResponse, 0, 240));
    error_log('Piel en Armonia figo-chat upstream status ' . $httpCode . ': ' . $snippet);
    json_response([
        'ok' => false,
        'error' => 'El bot Figo devolvio un error',
        'status' => $httpCode
    ], 503);
}

$decoded = json_decode($rawResponse, true);
if (!is_array($decoded)) {
    $decoded = [];
}

$content = figo_extract_text($decoded, $rawResponse);
if ($content === '') {
    $content = 'En este momento no pude generar una respuesta. ¿Deseas que te conecte por WhatsApp?';
}

try {
    $id = 'figo-' . bin2hex(random_bytes(8));
} catch (Throwable $e) {
    $id = 'figo-' . substr(md5((string) microtime(true)), 0, 16);
}

json_response([
    'id' => $id,
    'object' => 'chat.completion',
    'created' => time(),
    'model' => $model,
    'choices' => [[
        'index' => 0,
        'message' => [
            'role' => 'assistant',
            'content' => $content
        ],
        'finish_reason' => 'stop'
    ]]
]);

