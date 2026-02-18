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

function figo_config_paths(): array
{
    $paths = [];

    $envPath = getenv('FIGO_CHAT_CONFIG_PATH');
    if (is_string($envPath) && trim($envPath) !== '') {
        $paths[] = trim($envPath);
    }

    $paths[] = data_dir_path() . DIRECTORY_SEPARATOR . 'figo-config.json';
    $paths[] = __DIR__ . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'figo-config.json';
    $paths[] = __DIR__ . DIRECTORY_SEPARATOR . 'figo-config.json';

    $normalized = [];
    foreach ($paths as $path) {
        $path = trim((string) $path);
        if ($path === '') {
            continue;
        }

        $path = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $path);
        if (!in_array($path, $normalized, true)) {
            $normalized[] = $path;
        }
    }

    return $normalized;
}

function figo_read_file_config(): array
{
    foreach (figo_config_paths() as $path) {
        if (!is_file($path)) {
            continue;
        }

        $raw = @file_get_contents($path);
        if (!is_string($raw) || trim($raw) === '') {
            continue;
        }

        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            $decoded['__source'] = $path;
            return $decoded;
        }
    }

    return [];
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

function figo_endpoint_diagnostics(string $endpoint): array
{
    if ($endpoint === '') {
        return [
            'configured' => false,
            'endpointHost' => '',
            'endpointScheme' => '',
            'endpointPath' => ''
        ];
    }

    $parts = @parse_url($endpoint);
    if (!is_array($parts)) {
        return [
            'configured' => true,
            'endpointHost' => '',
            'endpointScheme' => '',
            'endpointPath' => ''
        ];
    }

    return [
        'configured' => true,
        'endpointHost' => isset($parts['host']) ? (string) $parts['host'] : '',
        'endpointScheme' => isset($parts['scheme']) ? (string) $parts['scheme'] : '',
        'endpointPath' => isset($parts['path']) ? (string) $parts['path'] : ''
    ];
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

    $normalized = strtolower($lastUser);
    $isPayment = preg_match('/pago|pagar|tarjeta|transferencia|efectivo|factura|comprobante/', $normalized) === 1;
    $isBooking = preg_match('/cita|agendar|reservar|turno|hora/', $normalized) === 1;
    $isPricing = preg_match('/precio|costo|valor|tarifa|cuanto cuesta/', $normalized) === 1;
    $isOutOfScope = preg_match('/capital|presidente|noticia|deporte|futbol|clima|bitcoin|politica/', $normalized) === 1;

    if ($isOutOfScope) {
        $content = 'Puedo ayudarte solo con temas de Piel en Armonía (servicios, precios, citas, pagos y ubicación). Si quieres, te guio ahora mismo para reservar tu cita o elegir tratamiento.';
    } elseif ($isPayment) {
        $content = "Para pagar en la web:\n1) Completa el formulario de Reservar Cita.\n2) Se abre el módulo de pago.\n3) Elige tarjeta, transferencia o efectivo.\n4) Confirma y te validamos por WhatsApp (+593 98 245 3672).\n\nSi quieres, te guío según el método que prefieras.";
    } elseif ($isBooking) {
        $content = "Para agendar:\n1) Abre Reservar Cita.\n2) Elige servicio, doctor, fecha y hora.\n3) Completa tus datos.\n4) Confirma pago y reserva.\n\nTambién puedes agendar por WhatsApp: https://wa.me/593982453672";
    } elseif ($isPricing) {
        $content = "Precios base:\n- Consulta dermatológica: $40\n- Consulta telefónica: $25\n- Video consulta: $30\n- Acné: desde $80\n- Láser: desde $150\n- Rejuvenecimiento: desde $120\n\nSi me dices tu caso, te recomiendo el siguiente paso.";
    } else {
        $content = "Puedo ayudarte con Piel en Armonía. Sobre \"{$lastUser}\", te guio paso a paso en servicios, citas o pagos. Si prefieres atención inmediata: WhatsApp +593 98 245 3672.";
    }

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

function figo_degraded_mode_enabled(): bool
{
    $raw = getenv('FIGO_CHAT_DEGRADED_MODE');
    if (!is_string($raw) || trim($raw) === '') {
        // Default seguro: evita errores duros en frontend cuando falta configuracion.
        return true;
    }

    $value = strtolower(trim($raw));
    return in_array($value, ['1', 'true', 'yes', 'on'], true);
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
    getenv('FIGO_CHAT_URL'),
    getenv('FIGO_CHAT_API_URL'),
    getenv('FIGO_ENDPOINT'),
    getenv('FIGO_URL'),
    getenv('CLAWBOT_ENDPOINT'),
    getenv('CLAWBOT_URL'),
    getenv('CHATBOT_ENDPOINT'),
    getenv('CHATBOT_URL'),
    getenv('BOT_ENDPOINT'),
    getenv('PIELARMONIA_FIGO_ENDPOINT'),
    $fileConfig['endpoint'] ?? null,
    $fileConfig['apiUrl'] ?? null,
    $fileConfig['url'] ?? null
]);
$endpointDiagnostics = figo_endpoint_diagnostics($endpoint);
$configSource = isset($fileConfig['__source']) && is_string($fileConfig['__source'])
    ? basename((string) $fileConfig['__source'])
    : 'environment';

if ($method === 'GET') {
    audit_log_event('figo.status', [
        'configured' => $endpointDiagnostics['configured'],
        'degradedMode' => figo_degraded_mode_enabled(),
        'endpointHost' => $endpointDiagnostics['endpointHost']
    ]);
    json_response([
        'ok' => true,
        'service' => 'figo-chat',
        'configured' => $endpointDiagnostics['configured'],
        'degradedMode' => figo_degraded_mode_enabled(),
        'hasFileConfig' => isset($fileConfig['__source']),
        'configSource' => $configSource,
        'endpointHost' => $endpointDiagnostics['endpointHost'],
        'endpointScheme' => $endpointDiagnostics['endpointScheme'],
        'endpointPath' => $endpointDiagnostics['endpointPath'],
        'timestamp' => gmdate('c')
    ]);
}

if ($method !== 'POST') {
    json_response([
        'ok' => false,
        'error' => 'Metodo no permitido'
    ], 405);
}

start_secure_session();
require_rate_limit('figo-chat', 15, 60);

$payload = require_json_body();
$messages = isset($payload['messages']) && is_array($payload['messages'])
    ? $payload['messages']
    : [];

if ($messages === []) {
    audit_log_event('figo.invalid_request', [
        'reason' => 'messages_required'
    ]);
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
    getenv('FIGO_CHAT_BEARER_TOKEN'),
    getenv('FIGO_TOKEN'),
    getenv('FIGO_BEARER_TOKEN'),
    getenv('CLAWBOT_TOKEN'),
    getenv('CHATBOT_TOKEN'),
    $fileConfig['token'] ?? null
]);
if ($authToken !== '') {
    $headers[] = 'Authorization: Bearer ' . $authToken;
}

$apiKey = figo_first_non_empty([
    getenv('FIGO_CHAT_APIKEY'),
    getenv('FIGO_CHAT_API_KEY'),
    getenv('FIGO_APIKEY'),
    getenv('FIGO_API_KEY'),
    getenv('CLAWBOT_APIKEY'),
    getenv('CLAWBOT_API_KEY'),
    getenv('CHATBOT_APIKEY'),
    getenv('CHATBOT_API_KEY'),
    $fileConfig['apiKey'] ?? null
]);
$apiKeyHeader = figo_first_non_empty([
    getenv('FIGO_CHAT_APIKEY_HEADER'),
    getenv('FIGO_CHAT_API_KEY_HEADER'),
    getenv('FIGO_APIKEY_HEADER'),
    getenv('FIGO_API_KEY_HEADER'),
    getenv('CLAWBOT_APIKEY_HEADER'),
    getenv('CLAWBOT_API_KEY_HEADER'),
    getenv('CHATBOT_APIKEY_HEADER'),
    getenv('CHATBOT_API_KEY_HEADER'),
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
    $timeout = 12;
}
if ($timeout < 5) {
    $timeout = 5;
}
if ($timeout > 45) {
    $timeout = 45;
}

if ($endpoint === '') {
    audit_log_event('figo.fallback', [
        'reason' => 'endpoint_missing'
    ]);
    $fallback = figo_build_fallback_completion($model, $messages);
    $fallback['configured'] = false;
    $fallback['degraded'] = true;
    $fallback['hint'] = 'Configura FIGO_CHAT_ENDPOINT o figo-config.json';
    json_response($fallback);
}

$curlAvailable = function_exists('curl_init') && function_exists('curl_setopt_array') && function_exists('curl_exec');
if (!$curlAvailable) {
    if (figo_degraded_mode_enabled()) {
        $fallback = figo_build_fallback_completion($model, $messages);
        $fallback['configured'] = true;
        $fallback['degraded'] = true;
        $fallback['error'] = 'cURL no disponible en el servidor';
        json_response($fallback);
    }

    json_response([
        'ok' => false,
        'error' => 'cURL no disponible en el servidor'
    ], 503);
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
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
    CURLOPT_MAXFILESIZE => 1048576 // 1 MB limite de respuesta
]);

$rawResponse = curl_exec($ch);
$httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr = curl_error($ch);
curl_close($ch);

if (!is_string($rawResponse)) {
    error_log('Piel en Armonía figo-chat: fallo conexion cURL (codigo: ' . $curlErr . ')');
    audit_log_event('figo.upstream_error', [
        'reason' => 'curl_failed'
    ]);
    if (figo_degraded_mode_enabled()) {
        $fallback = figo_build_fallback_completion($model, $messages);
        $fallback['configured'] = true;
        $fallback['degraded'] = true;
        $fallback['error'] = 'No se pudo conectar con el backend Figo';
        json_response($fallback);
    }

    json_response([
        'ok' => false,
        'error' => 'No se pudo conectar con el backend Figo'
    ], 503);
}

if ($httpCode >= 400) {
    error_log('Piel en Armonía figo-chat: upstream devolvio HTTP ' . $httpCode);
    audit_log_event('figo.upstream_error', [
        'reason' => 'http_error',
        'status' => $httpCode
    ]);
    if (figo_degraded_mode_enabled()) {
        $fallback = figo_build_fallback_completion($model, $messages);
        $fallback['configured'] = true;
        $fallback['degraded'] = true;
        $fallback['upstreamStatus'] = $httpCode;
        json_response($fallback);
    }

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

audit_log_event('figo.success', [
    'degraded' => false,
    'endpointHost' => $endpointDiagnostics['endpointHost']
]);

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
