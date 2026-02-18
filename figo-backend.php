<?php
declare(strict_types=1);

require_once __DIR__ . '/api-lib.php';

/**
 * Figo backend local:
 * - Web chat mode: receives OpenAI-style payload and returns chat.completion
 * - Telegram webhook mode: receives Telegram updates and replies as bot
 */

function figo_backend_apply_cors(): void
{
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Telegram-Bot-Api-Secret-Token');
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

function figo_backend_normalize_text(string $text): string
{
    $text = strtolower(trim($text));
    if ($text === '') {
        return '';
    }

    if (function_exists('iconv')) {
        $ascii = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text);
        if (is_string($ascii) && $ascii !== '') {
            $text = $ascii;
        }
    }

    $text = preg_replace('/\s+/', ' ', $text);
    return is_string($text) ? $text : '';
}

function figo_backend_contains_any(string $text, array $patterns): bool
{
    foreach ($patterns as $pattern) {
        if (preg_match($pattern, $text) === 1) {
            return true;
        }
    }
    return false;
}

function figo_backend_last_user_message(array $messages): string
{
    for ($i = count($messages) - 1; $i >= 0; $i--) {
        $msg = $messages[$i] ?? null;
        if (is_array($msg) && (($msg['role'] ?? '') === 'user') && is_string($msg['content'] ?? null)) {
            return trim((string) $msg['content']);
        }
    }
    return '';
}

function figo_backend_answer(string $userMessage): string
{
    $normalized = figo_backend_normalize_text($userMessage);

    if ($normalized === '') {
        return 'Hola, soy Figo de Piel en Armonia. Puedo ayudarte con servicios, precios, pagos y reservas. En que te ayudo?';
    }

    if (figo_backend_contains_any($normalized, [
        '/\bcapital\b/',
        '/\bpresidente\b/',
        '/\bnoticias?\b/',
        '/\bfutbol\b/',
        '/\bdeporte\b/',
        '/\bclima\b/',
        '/\bbitcoin\b/',
        '/\bpolitica\b/'
    ])) {
        return 'Puedo ayudarte solo con temas de Piel en Armonia: servicios, precios, reservas, pagos, horarios y ubicacion. Si quieres, te ayudo a reservar ahora mismo.';
    }

    if (figo_backend_contains_any($normalized, [
        '/\bpago\b/',
        '/\bpagar\b/',
        '/\btarjeta\b/',
        '/\btransferencia\b/',
        '/\befectivo\b/',
        '/\bfactura\b/',
        '/\bcomprobante\b/'
    ])) {
        return "Para pagar en la web:\n"
            . "1) Completa el formulario en Reservar Cita.\n"
            . "2) Se abre el modal de pago automaticamente.\n"
            . "3) Elige tarjeta, transferencia o efectivo.\n"
            . "4) Confirma y la cita queda registrada.\n\n"
            . "Si eliges transferencia, sube comprobante y numero de referencia.\n"
            . "Soporte inmediato: WhatsApp +593 98 245 3672.";
    }

    if (figo_backend_contains_any($normalized, [
        '/\bcita\b/',
        '/\bagendar\b/',
        '/\breservar\b/',
        '/\bturno\b/',
        '/\bhora\b/'
    ])) {
        return "Para reservar:\n"
            . "1) Elige servicio y doctor.\n"
            . "2) Selecciona fecha y hora.\n"
            . "3) Completa tus datos.\n"
            . "4) Continua al pago y confirma.\n\n"
            . "Tambien puedes reservar por WhatsApp: https://wa.me/593982453672";
    }

    if (figo_backend_contains_any($normalized, [
        '/\bservicio\b/',
        '/\btratamiento\b/',
        '/\bofrecen\b/',
        '/\bhacen\b/'
    ])) {
        return "Servicios principales:\n"
            . "- Consulta Dermatologica: $40\n"
            . "- Consulta Telefonica: $25\n"
            . "- Video Consulta: $30\n"
            . "- Tratamiento de Acne: desde $80\n"
            . "- Rejuvenecimiento: desde $120\n"
            . "- Laser Dermatologico: desde $150\n"
            . "- Deteccion de Cancer de Piel: desde $70";
    }

    if (figo_backend_contains_any($normalized, [
        '/\bprecio\b/',
        '/\bcosto\b/',
        '/\bvalor\b/',
        '/\btarifa\b/',
        '/\bcuanto\b/'
    ])) {
        return "Precios base:\n"
            . "- Consulta Dermatologica: $40\n"
            . "- Consulta Telefonica: $25\n"
            . "- Video Consulta: $30\n"
            . "- Laser: desde $150\n"
            . "- Rejuvenecimiento: desde $120\n"
            . "- Acne: desde $80";
    }

    if (figo_backend_contains_any($normalized, [
        '/\bubicacion\b/',
        '/\bdireccion\b/',
        '/\bdonde\b/',
        '/\bhorario\b/'
    ])) {
        return "Estamos en Quito, Ecuador.\n"
            . "Direccion: Av. Dr. Cecilio Caiza e Hijas N2-30 y Av. Amazonas.\n"
            . "Horario: Lunes a Viernes 09:00-18:00, Sabados 09:00-13:00.\n"
            . "Telefono/WhatsApp: +593 98 245 3672.";
    }

    return "Entiendo tu consulta sobre \"" . $userMessage . "\". Te ayudo en servicios, precios, pagos y reservas de Piel en Armonia. Quieres que avancemos con una cita?";
}

function figo_backend_telegram_token(): string
{
    $candidates = [
        getenv('FIGO_TELEGRAM_BOT_TOKEN'),
        getenv('TELEGRAM_BOT_TOKEN'),
        getenv('FIGO_CHAT_TOKEN')
    ];
    foreach ($candidates as $candidate) {
        if (is_string($candidate) && trim($candidate) !== '') {
            return trim($candidate);
        }
    }
    return '';
}

function figo_backend_telegram_chat_id(): string
{
    $candidates = [
        getenv('FIGO_TELEGRAM_CHAT_ID'),
        getenv('TELEGRAM_CHAT_ID')
    ];
    foreach ($candidates as $candidate) {
        if (is_string($candidate) && trim($candidate) !== '') {
            return trim($candidate);
        }
    }
    return '';
}

function figo_backend_telegram_webhook_secret(): string
{
    $secret = getenv('FIGO_TELEGRAM_WEBHOOK_SECRET');
    return is_string($secret) ? trim($secret) : '';
}

function figo_backend_telegram_api_request(string $token, string $method, array $payload): array
{
    if ($token === '' || $method === '') {
        return ['ok' => false, 'error' => 'invalid_token_or_method'];
    }

    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($json)) {
        return ['ok' => false, 'error' => 'payload_encode_failed'];
    }

    $url = 'https://api.telegram.org/bot' . $token . '/' . $method;
    $ch = curl_init($url);
    if ($ch === false) {
        return ['ok' => false, 'error' => 'curl_init_failed'];
    }

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Accept: application/json'
        ],
        CURLOPT_POSTFIELDS => $json,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2
    ]);

    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if (!is_string($raw) || $status >= 400) {
        return [
            'ok' => false,
            'error' => 'telegram_http_error',
            'status' => $status,
            'curl' => $curlErr
        ];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return ['ok' => false, 'error' => 'telegram_invalid_json'];
    }

    return $decoded;
}

function figo_backend_telegram_send_message(string $token, string $chatId, string $text): bool
{
    if ($token === '' || $chatId === '' || trim($text) === '') {
        return false;
    }

    $resp = figo_backend_telegram_api_request($token, 'sendMessage', [
        'chat_id' => $chatId,
        'text' => $text,
        'disable_web_page_preview' => true
    ]);

    return (($resp['ok'] ?? false) === true);
}

function figo_backend_is_telegram_update(array $payload): bool
{
    return isset($payload['update_id']) && (is_int($payload['update_id']) || ctype_digit((string) $payload['update_id']));
}

function figo_backend_validate_telegram_secret(): bool
{
    $expected = figo_backend_telegram_webhook_secret();
    if ($expected === '') {
        return true;
    }

    $received = isset($_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'])
        ? trim((string) $_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'])
        : '';

    return $received !== '' && hash_equals($expected, $received);
}

function figo_backend_handle_telegram_update(array $update, string $telegramToken): void
{
    if (!figo_backend_validate_telegram_secret()) {
        json_response([
            'ok' => false,
            'error' => 'invalid_telegram_secret'
        ], 403);
    }

    if ($telegramToken === '') {
        json_response([
            'ok' => false,
            'error' => 'telegram_token_missing'
        ], 503);
    }

    $msg = $update['message'] ?? null;
    if (!is_array($msg)) {
        json_response(['ok' => true, 'handled' => false]);
    }

    $chat = $msg['chat'] ?? null;
    $chatId = is_array($chat) && isset($chat['id']) ? (string) $chat['id'] : '';
    $text = isset($msg['text']) && is_string($msg['text']) ? trim((string) $msg['text']) : '';

    if ($chatId === '') {
        json_response(['ok' => true, 'handled' => false]);
    }

    if ($text === '/start') {
        $welcome = "Hola, soy Figo de Piel en Armonia.\n"
            . "Te ayudo con servicios, precios, pagos y reservas.\n"
            . "Escribe tu consulta y te respondo.";
        figo_backend_telegram_send_message($telegramToken, $chatId, $welcome);
        json_response(['ok' => true, 'handled' => true]);
    }

    if ($text === '') {
        figo_backend_telegram_send_message($telegramToken, $chatId, 'Escribeme tu consulta en texto para poder ayudarte.');
        json_response(['ok' => true, 'handled' => true]);
    }

    $answer = figo_backend_answer($text);
    figo_backend_telegram_send_message($telegramToken, $chatId, $answer);
    json_response(['ok' => true, 'handled' => true]);
}

figo_backend_apply_cors();

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit();
}

header('Content-Type: application/json; charset=utf-8');

$telegramToken = figo_backend_telegram_token();
$telegramConfigured = $telegramToken !== '';
$telegramChatId = figo_backend_telegram_chat_id();
$telegramChatConfigured = $telegramChatId !== '';

if ($method === 'GET') {
    json_response([
        'ok' => true,
        'service' => 'figo-backend',
        'mode' => 'local',
        'provider' => 'telegram_bridge',
        'telegramConfigured' => $telegramConfigured,
        'telegramChatConfigured' => $telegramChatConfigured,
        'webhookSecretConfigured' => figo_backend_telegram_webhook_secret() !== '',
        'timestamp' => gmdate('c')
    ]);
}

if ($method !== 'POST') {
    json_response([
        'ok' => false,
        'error' => 'Metodo no permitido'
    ], 405);
}

require_rate_limit('figo-backend', 30, 60);
$payload = require_json_body();

if (figo_backend_is_telegram_update($payload)) {
    figo_backend_handle_telegram_update($payload, $telegramToken);
}

$messages = isset($payload['messages']) && is_array($payload['messages'])
    ? $payload['messages']
    : [];
if ($messages === []) {
    json_response([
        'ok' => false,
        'error' => 'messages required'
    ], 400);
}

$model = isset($payload['model']) && is_string($payload['model']) && trim($payload['model']) !== ''
    ? trim($payload['model'])
    : 'figo-assistant';

$userMessage = figo_backend_last_user_message($messages);
$content = figo_backend_answer($userMessage);

if ($telegramConfigured && $telegramChatConfigured) {
    $telegramText = "Nuevo mensaje web (Piel en Armonia)\n"
        . "Paciente: " . ($userMessage === '' ? '[vacio]' : $userMessage) . "\n"
        . "Respuesta: " . $content . "\n"
        . "Hora: " . gmdate('Y-m-d H:i:s') . ' UTC';
    figo_backend_telegram_send_message($telegramToken, $telegramChatId, $telegramText);
}

try {
    $id = 'figo-local-' . bin2hex(random_bytes(8));
} catch (Throwable $e) {
    $id = 'figo-local-' . substr(md5((string) microtime(true)), 0, 16);
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
    ]],
    'provider' => 'telegram_bridge',
    'telegramConfigured' => $telegramConfigured,
    'telegramChatConfigured' => $telegramChatConfigured
]);
