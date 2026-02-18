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

function figo_read_file_config(): array
{
    $path = DATA_DIR . DIRECTORY_SEPARATOR . 'figo-config.json';
    if (!is_file($path)) {
        return [];
    }

    $raw = @file_get_contents($path);
    if (!is_string($raw) || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function figo_first_non_empty(array $values): string
{
    foreach ($values as $value) {
        if (is_string($value) && trim($value) !== '') {
            return trim($value);
        }
    }
    return '';
}

function figo_build_fallback_completion(string $model, array $messages): array
{
    $lastUser = '';
    for ($i = count($messages) - 1; $i >= 0; $i--) {
        $msg = $messages[$i] ?? null;
        if (is_array($msg) && (($msg['role'] ?? '') === 'user') && is_string($msg['content'] ?? null)) {
            $lastUser = trim((string) $msg['content']);
            break;
        }
    }

    if ($lastUser === '') {
        $lastUser = 'consulta general';
    }

    $content = "Puedo ayudarte con Piel en Armonia. Sobre \"{$lastUser}\", te guio paso a paso en servicios, citas o pagos. Si prefieres atencion inmediata: WhatsApp +593 98 245 3672.";

    try {
        $id = 'figo-fallback-' . bin2hex(random_bytes(8));
    } catch (Throwable $e) {
        $id = 'figo-fallback-' . substr(md5((string) microtime(true)), 0, 16);
    }

    return [
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
    ];
}

figo_apply_cors();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit();
}

header('Content-Type: application/json; charset=utf-8');
$fileConfig = figo_read_file_config();

$endpoint = figo_first_non_empty([
    getenv('FIGO_CHAT_ENDPOINT'),
    getenv('FIGO_ENDPOINT'),
    getenv('CLAWBOT_ENDPOINT'),
    getenv('CHATBOT_ENDPOINT'),
    getenv('PIELARMONIA_FIGO_ENDPOINT'),
    $fileConfig['endpoint'] ?? null,
    $fileConfig['url'] ?? null
]);

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

$authToken = figo_first_non_empty([
    getenv('FIGO_CHAT_TOKEN'),
    getenv('FIGO_TOKEN'),
    getenv('CLAWBOT_TOKEN'),
    $fileConfig['token'] ?? null
]);
if ($authToken !== '') {
    $headers[] = 'Authorization: Bearer ' . $authToken;
}

$apiKey = figo_first_non_empty([
    getenv('FIGO_CHAT_APIKEY'),
    getenv('FIGO_APIKEY'),
    getenv('CLAWBOT_APIKEY'),
    $fileConfig['apiKey'] ?? null
]);
$apiKeyHeader = figo_first_non_empty([
    getenv('FIGO_CHAT_APIKEY_HEADER'),
    getenv('FIGO_APIKEY_HEADER'),
    getenv('CLAWBOT_APIKEY_HEADER'),
    $fileConfig['apiKeyHeader'] ?? null
]);
if ($apiKey !== '' && $apiKeyHeader !== '') {
    $headers[] = $apiKeyHeader . ': ' . $apiKey;
}

$timeout = (int) figo_first_non_empty([
    getenv('FIGO_CHAT_TIMEOUT_SECONDS'),
    getenv('FIGO_TIMEOUT_SECONDS'),
    getenv('CLAWBOT_TIMEOUT_SECONDS'),
    isset($fileConfig['timeout']) ? (string) $fileConfig['timeout'] : ''
]);
if ($timeout <= 0) {
    $timeout = 20;
}

if ($endpoint === '') {
    $fallback = figo_build_fallback_completion($model, $messages);
    $fallback['configured'] = false;
    $fallback['degraded'] = true;
    $fallback['hint'] = 'Configura FIGO_CHAT_ENDPOINT o data/figo-config.json';
    json_response($fallback);
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
    $fallback = figo_build_fallback_completion($model, $messages);
    $fallback['configured'] = true;
    $fallback['degraded'] = true;
    $fallback['error'] = 'No se pudo conectar con el backend Figo';
    json_response($fallback);
}

if ($httpCode >= 400) {
    $snippet = trim(substr($rawResponse, 0, 240));
    error_log('Piel en Armonia figo-chat upstream status ' . $httpCode . ': ' . $snippet);
    $fallback = figo_build_fallback_completion($model, $messages);
    $fallback['configured'] = true;
    $fallback['degraded'] = true;
    $fallback['upstreamStatus'] = $httpCode;
    json_response($fallback);
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
