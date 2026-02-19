<?php
declare(strict_types=1);

require_once __DIR__ . '/api-lib.php';
require_once __DIR__ . '/payment-lib.php';

$requestStartedAt = microtime(true);

set_exception_handler(static function (Throwable $e): void {
    $code = ($e->getCode() >= 400 && $e->getCode() < 600) ? (int) $e->getCode() : 500;
    if (!headers_sent()) {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
    }
    error_log('Piel en Armonía API uncaught: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage() ?: 'Error interno del servidor'
    ], JSON_UNESCAPED_UNICODE);
    exit(1);
});

function api_elapsed_ms(float $startedAt): int
{
    return (int) round((microtime(true) - $startedAt) * 1000);
}

function api_is_figo_recursive_config(string $endpoint): bool
{
    $endpoint = trim($endpoint);
    if ($endpoint === '') {
        return false;
    }

    $parts = @parse_url($endpoint);
    if (!is_array($parts)) {
        return false;
    }

    $endpointHost = strtolower((string) ($parts['host'] ?? ''));
    $endpointPath = strtolower((string) ($parts['path'] ?? ''));
    $currentHost = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));

    $requestUri = (string) ($_SERVER['REQUEST_URI'] ?? '/api.php');
    $requestPath = strtolower((string) parse_url($requestUri, PHP_URL_PATH));
    if ($requestPath === '') {
        $requestPath = '/api.php';
    }

    if ($endpointHost === '' || $currentHost === '') {
        return false;
    }

    // Permite comparacion robusta entre host directo y variante www.
    $normalizedEndpointHost = preg_replace('/^www\./', '', $endpointHost);
    $normalizedCurrentHost = preg_replace('/^www\./', '', $currentHost);

    if ($normalizedEndpointHost !== $normalizedCurrentHost) {
        return false;
    }

    if ($endpointPath === '') {
        return false;
    }

    if ($endpointPath === $requestPath) {
        return true;
    }

    return $endpointPath === '/figo-chat.php';
}

$requestOrigin = isset($_SERVER['HTTP_ORIGIN']) ? trim((string) $_SERVER['HTTP_ORIGIN']) : '';
$allowedOrigin = getenv('PIELARMONIA_ALLOWED_ORIGIN');
$allowedList = [];
if (is_string($allowedOrigin) && trim($allowedOrigin) !== '') {
    foreach (explode(',', $allowedOrigin) as $origin) {
        $origin = trim((string) $origin);
        if ($origin !== '') {
            $allowedList[] = rtrim($origin, '/');
        }
    }
}

$host = isset($_SERVER['HTTP_HOST']) ? trim((string) $_SERVER['HTTP_HOST']) : '';
if ($host !== '') {
    $allowedList[] = (is_https_request() ? 'https' : 'http') . '://' . $host;
}

$allowedList = array_values(array_unique(array_filter($allowedList)));
if ($requestOrigin !== '') {
    $normalizedOrigin = rtrim($requestOrigin, '/');
    foreach ($allowedList as $origin) {
        if (strcasecmp($normalizedOrigin, $origin) === 0) {
            header('Access-Control-Allow-Origin: ' . $requestOrigin);
            header('Access-Control-Allow-Credentials: true');
            header('Vary: Origin');
            break;
        }
    }
}
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$resource = isset($_GET['resource']) ? (string) $_GET['resource'] : '';
$action = isset($_GET['action']) ? (string) $_GET['action'] : '';

if ($resource === '' && $action !== '') {
    $resource = $action;
}

register_shutdown_function(static function () use ($requestStartedAt, $method, $resource): void {
    $elapsed = api_elapsed_ms($requestStartedAt);
    if ($elapsed < 2000) {
        return;
    }
    audit_log_event('api.slow', [
        'method' => $method,
        'resource' => $resource,
        'timingMs' => $elapsed
    ]);
});

if ($resource === 'health') {
    $storageReady = ensure_data_file();
    $figoEndpoint = get_figo_endpoint();
    $figoConfigured = $figoEndpoint !== '';
    $figoRecursive = api_is_figo_recursive_config($figoEndpoint);
    $timingMs = api_elapsed_ms($requestStartedAt);
    audit_log_event('api.health', [
        'method' => $method,
        'resource' => $resource,
        'storageReady' => $storageReady,
        'timingMs' => $timingMs,
        'version' => app_runtime_version(),
        'figoConfigured' => $figoConfigured,
        'figoRecursiveConfig' => $figoRecursive
    ]);
    json_response([
        'ok' => true,
        'status' => 'ok',
        'storageReady' => $storageReady,
        'timingMs' => $timingMs,
        'version' => app_runtime_version(),
        'dataDirWritable' => data_dir_writable(),
        'storeEncrypted' => store_file_is_encrypted(),
        'figoConfigured' => $figoConfigured,
        'figoRecursiveConfig' => $figoRecursive,
        'timestamp' => local_date('c')
    ]);
}

$publicEndpoints = [
    ['method' => 'GET', 'resource' => 'payment-config'],
    ['method' => 'GET', 'resource' => 'availability'],
    ['method' => 'GET', 'resource' => 'reviews'],
    ['method' => 'GET', 'resource' => 'booked-slots'],
    ['method' => 'POST', 'resource' => 'payment-intent'],
    ['method' => 'POST', 'resource' => 'payment-verify'],
    ['method' => 'POST', 'resource' => 'transfer-proof'],
    ['method' => 'POST', 'resource' => 'stripe-webhook'],
    ['method' => 'POST', 'resource' => 'appointments'],
    ['method' => 'POST', 'resource' => 'callbacks'],
    ['method' => 'POST', 'resource' => 'reviews'],
    ['method' => 'GET', 'resource' => 'reschedule'],
    ['method' => 'PATCH', 'resource' => 'reschedule'],
];

$isPublic = false;
foreach ($publicEndpoints as $endpoint) {
    if ($endpoint['method'] === $method && $endpoint['resource'] === $resource) {
        $isPublic = true;
        break;
    }
}

$isAdmin = false;
if (!$isPublic) {
    start_secure_session();
    $isAdmin = isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true;
    if (!$isAdmin) {
        audit_log_event('api.unauthorized', [
            'method' => $method,
            'resource' => $resource,
            'reason' => 'admin_required'
        ]);
        json_response([
            'ok' => false,
            'error' => 'No autorizado'
        ], 401);
    }
}

audit_log_event('api.access', [
    'method' => $method,
    'resource' => $resource,
    'scope' => $isAdmin ? 'admin' : 'public'
]);

// CSRF: validar token en mutaciones autenticadas (no publicas)
if (in_array($method, ['POST', 'PUT', 'PATCH'], true) && $isAdmin) {
    $publicMutations = ['appointments', 'callbacks', 'reviews', 'payment-intent', 'payment-verify', 'transfer-proof', 'stripe-webhook'];
    if (!in_array($resource, $publicMutations, true)) {
        require_csrf();
    }
}

$store = read_store();

if ($method === 'GET' && $resource === 'data') {
    json_response([
        'ok' => true,
        'data' => $store
    ]);
}

if ($method === 'GET' && $resource === 'appointments') {
    json_response([
        'ok' => true,
        'data' => $store['appointments']
    ]);
}

if ($method === 'GET' && $resource === 'callbacks') {
    json_response([
        'ok' => true,
        'data' => $store['callbacks']
    ]);
}

if ($method === 'GET' && $resource === 'reviews') {
    usort($store['reviews'], static function (array $a, array $b): int {
        return strcmp((string) ($b['date'] ?? ''), (string) ($a['date'] ?? ''));
    });
    json_response([
        'ok' => true,
        'data' => $store['reviews']
    ]);
}

if ($method === 'GET' && $resource === 'availability') {
    json_response([
        'ok' => true,
        'data' => $store['availability']
    ]);
}

if ($method === 'GET' && $resource === 'booked-slots') {
    $date = isset($_GET['date']) ? (string) $_GET['date'] : '';
    if ($date === '') {
        json_response([
            'ok' => false,
            'error' => 'Fecha requerida'
        ], 400);
    }

    $doctor = isset($_GET['doctor']) ? trim((string) $_GET['doctor']) : '';

    $slots = [];
    foreach ($store['appointments'] as $appointment) {
        $status = map_appointment_status((string) ($appointment['status'] ?? 'confirmed'));
        if ($status === 'cancelled') {
            continue;
        }
        if ((string) ($appointment['date'] ?? '') !== $date) {
            continue;
        }
        if ($doctor !== '' && $doctor !== 'indiferente') {
            $apptDoctor = (string) ($appointment['doctor'] ?? '');
            if ($apptDoctor !== '' && $apptDoctor !== 'indiferente' && $apptDoctor !== $doctor) {
                continue;
            }
        }
        $time = (string) ($appointment['time'] ?? '');
        if ($time !== '') {
            $slots[] = $time;
        }
    }

    $slots = array_values(array_unique($slots));
    sort($slots);

    json_response([
        'ok' => true,
        'data' => $slots
    ]);
}

if ($method === 'GET' && $resource === 'payment-config') {
    json_response([
        'ok' => true,
        'provider' => 'stripe',
        'enabled' => payment_gateway_enabled(),
        'publishableKey' => payment_stripe_publishable_key(),
        'currency' => payment_currency()
    ]);
}

if ($method === 'POST' && $resource === 'payment-intent') {
    require_rate_limit('payment-intent');

    $payload = require_json_body();
    if (!captcha_verify_token((string)($payload['captchaToken'] ?? ''))) {
        json_response(['ok' => false, 'error' => 'CAPTCHA invalido'], 400);
    }

    if (!payment_gateway_enabled()) {
        json_response([
            'ok' => false,
            'error' => 'Pasarela de pago no configurada'
        ], 503);
    }
    $appointment = normalize_appointment($payload);

    if ($appointment['service'] === '' || $appointment['name'] === '' || $appointment['email'] === '') {
        json_response([
            'ok' => false,
            'error' => 'Datos incompletos para iniciar el pago'
        ], 400);
    }

    if (!validate_email($appointment['email'])) {
        json_response([
            'ok' => false,
            'error' => 'El formato del email no es valido'
        ], 400);
    }

    if (!validate_phone($appointment['phone'])) {
        json_response([
            'ok' => false,
            'error' => 'El formato del telefono no es valido'
        ], 400);
    }

    if (!isset($appointment['privacyConsent']) || $appointment['privacyConsent'] !== true) {
        json_response([
            'ok' => false,
            'error' => 'Debes aceptar el tratamiento de datos para reservar la cita'
        ], 400);
    }

    if ($appointment['date'] === '' || $appointment['time'] === '') {
        json_response([
            'ok' => false,
            'error' => 'Fecha y hora son obligatorias'
        ], 400);
    }

    if ($appointment['date'] < local_date('Y-m-d')) {
        json_response([
            'ok' => false,
            'error' => 'No se puede agendar en una fecha pasada'
        ], 400);
    }

    if (appointment_slot_taken($store['appointments'], $appointment['date'], $appointment['time'], null, $appointment['doctor'])) {
        json_response([
            'ok' => false,
            'error' => 'Ese horario ya fue reservado'
        ], 409);
    }

    $seed = implode('|', [
        $appointment['email'],
        $appointment['service'],
        $appointment['date'],
        $appointment['time'],
        $appointment['doctor'],
        $appointment['phone']
    ]);
    $idempotencyKey = payment_build_idempotency_key('intent', $seed);

    try {
        $intent = stripe_create_payment_intent($appointment, $idempotencyKey);
    } catch (RuntimeException $e) {
        json_response([
            'ok' => false,
            'error' => $e->getMessage()
        ], 502);
    }

    json_response([
        'ok' => true,
        'clientSecret' => isset($intent['client_secret']) ? (string) $intent['client_secret'] : '',
        'paymentIntentId' => isset($intent['id']) ? (string) $intent['id'] : '',
        'amount' => isset($intent['amount']) ? (int) $intent['amount'] : payment_expected_amount_cents($appointment['service']),
        'currency' => strtoupper((string) ($intent['currency'] ?? payment_currency())),
        'publishableKey' => payment_stripe_publishable_key()
    ]);
}

if ($method === 'POST' && $resource === 'payment-verify') {
    require_rate_limit('payment-verify');

    if (!payment_gateway_enabled()) {
        json_response([
            'ok' => false,
            'error' => 'Pasarela de pago no configurada'
        ], 503);
    }

    $payload = require_json_body();
    $paymentIntentId = isset($payload['paymentIntentId']) ? trim((string) $payload['paymentIntentId']) : '';
    if ($paymentIntentId === '') {
        json_response([
            'ok' => false,
            'error' => 'paymentIntentId es obligatorio'
        ], 400);
    }

    try {
        $intent = stripe_get_payment_intent($paymentIntentId);
    } catch (RuntimeException $e) {
        json_response([
            'ok' => false,
            'error' => $e->getMessage()
        ], 502);
    }

    $status = (string) ($intent['status'] ?? '');
    $paid = in_array($status, ['succeeded', 'requires_capture'], true);

    json_response([
        'ok' => true,
        'paid' => $paid,
        'status' => $status,
        'id' => isset($intent['id']) ? (string) $intent['id'] : $paymentIntentId,
        'amount' => isset($intent['amount']) ? (int) $intent['amount'] : 0,
        'amountReceived' => isset($intent['amount_received']) ? (int) $intent['amount_received'] : 0,
        'currency' => strtoupper((string) ($intent['currency'] ?? payment_currency()))
    ]);
}

if ($method === 'POST' && $resource === 'transfer-proof') {
    require_rate_limit('transfer-proof');

    if (!isset($_FILES['proof']) || !is_array($_FILES['proof'])) {
        json_response([
            'ok' => false,
            'error' => 'Debes adjuntar un comprobante'
        ], 400);
    }

    try {
        $upload = save_transfer_proof_upload($_FILES['proof']);
    } catch (RuntimeException $e) {
        json_response([
            'ok' => false,
            'error' => $e->getMessage()
        ], 400);
    }

    json_response([
        'ok' => true,
        'data' => [
            'transferProofPath' => (string) ($upload['path'] ?? ''),
            'transferProofUrl' => (string) ($upload['url'] ?? ''),
            'transferProofName' => (string) ($upload['name'] ?? ''),
            'transferProofMime' => (string) ($upload['mime'] ?? ''),
            'transferProofSize' => (int) ($upload['size'] ?? 0)
        ]
    ], 201);
}

if ($method === 'POST' && $resource === 'stripe-webhook') {
    $webhookSecret = payment_stripe_webhook_secret();
    if ($webhookSecret === '') {
        json_response(['ok' => false, 'error' => 'Webhook no configurado'], 503);
    }

    $rawBody = file_get_contents('php://input');
    if (!is_string($rawBody) || $rawBody === '') {
        json_response(['ok' => false, 'error' => 'Cuerpo vacio'], 400);
    }

    $sigHeader = isset($_SERVER['HTTP_STRIPE_SIGNATURE']) ? (string) $_SERVER['HTTP_STRIPE_SIGNATURE'] : '';
    if ($sigHeader === '') {
        json_response(['ok' => false, 'error' => 'Sin firma'], 400);
    }

    try {
        $event = stripe_verify_webhook_signature($rawBody, $sigHeader, $webhookSecret);
    } catch (RuntimeException $e) {
        audit_log_event('stripe.webhook_signature_failed', ['error' => $e->getMessage()]);
        json_response(['ok' => false, 'error' => $e->getMessage()], 400);
    }

    $eventType = (string) ($event['type'] ?? '');
    audit_log_event('stripe.webhook_received', ['type' => $eventType]);

    if ($eventType === 'payment_intent.succeeded') {
        $intentData = isset($event['data']['object']) && is_array($event['data']['object']) ? $event['data']['object'] : [];
        $intentId = (string) ($intentData['id'] ?? '');

        if ($intentId !== '') {
            $webhookStore = read_store();
            $updated = false;
            foreach ($webhookStore['appointments'] as &$appt) {
                $existingIntent = trim((string) ($appt['paymentIntentId'] ?? ''));
                if ($existingIntent !== '' && hash_equals($existingIntent, $intentId)) {
                    if (($appt['paymentStatus'] ?? '') !== 'paid') {
                        $appt['paymentStatus'] = 'paid';
                        $appt['paymentPaidAt'] = local_date('c');
                        $updated = true;
                    }
                    break;
                }
            }
            unset($appt);
            if ($updated) {
                write_store($webhookStore);
                audit_log_event('stripe.webhook_payment_confirmed', ['intentId' => $intentId]);
            }
        }
    }

    if ($eventType === 'payment_intent.payment_failed') {
        $intentData = isset($event['data']['object']) && is_array($event['data']['object']) ? $event['data']['object'] : [];
        $intentId = (string) ($intentData['id'] ?? '');

        if ($intentId !== '') {
            $webhookStore = read_store();
            $updated = false;
            foreach ($webhookStore['appointments'] as &$appt) {
                $existingIntent = trim((string) ($appt['paymentIntentId'] ?? ''));
                if ($existingIntent !== '' && hash_equals($existingIntent, $intentId)) {
                    if (!in_array($appt['paymentStatus'] ?? '', ['paid', 'failed'], true)) {
                        $appt['paymentStatus'] = 'failed';
                        $updated = true;
                    }
                    break;
                }
            }
            unset($appt);
            if ($updated) {
                write_store($webhookStore);
                audit_log_event('stripe.webhook_payment_failed', ['intentId' => $intentId]);
            }
        }
    }

    json_response(['ok' => true, 'received' => true]);
}

if ($method === 'POST' && $resource === 'appointments') {
    require_rate_limit('appointments');
    $payload = require_json_body();

    if (!captcha_verify_token((string)($payload['captchaToken'] ?? ''))) {
        json_response(['ok' => false, 'error' => 'CAPTCHA invalido'], 400);
    }

    $appointment = normalize_appointment($payload);

    if ($appointment['name'] === '' || $appointment['email'] === '' || $appointment['phone'] === '') {
        json_response([
            'ok' => false,
            'error' => 'Nombre, email y teléfono son obligatorios'
        ], 400);
    }

    if (!validate_email($appointment['email'])) {
        json_response([
            'ok' => false,
            'error' => 'El formato del email no es válido'
        ], 400);
    }

    if (!validate_phone($appointment['phone'])) {
        json_response([
            'ok' => false,
            'error' => 'El formato del teléfono no es válido'
        ], 400);
    }

    if (!isset($appointment['privacyConsent']) || $appointment['privacyConsent'] !== true) {
        json_response([
            'ok' => false,
            'error' => 'Debes aceptar el tratamiento de datos para reservar la cita'
        ], 400);
    }

    if ($appointment['date'] === '' || $appointment['time'] === '') {
        json_response([
            'ok' => false,
            'error' => 'Fecha y hora son obligatorias'
        ], 400);
    }

    if ($appointment['date'] < local_date('Y-m-d')) {
        json_response([
            'ok' => false,
            'error' => 'No se puede agendar en una fecha pasada'
        ], 400);
    }

    // Si es hoy, la hora debe ser al menos 1 hora en el futuro
    if ($appointment['date'] === local_date('Y-m-d')) {
        $nowMinutes = (int) local_date('H') * 60 + (int) local_date('i');
        $parts = explode(':', $appointment['time']);
        $slotMinutes = (int) ($parts[0] ?? 0) * 60 + (int) ($parts[1] ?? 0);
        if ($slotMinutes <= $nowMinutes + 60) {
            json_response([
                'ok' => false,
                'error' => 'Ese horario ya pasó o es muy pronto. Selecciona una hora con al menos 1 hora de anticipación, o elige otra fecha.'
            ], 400);
        }
    }

    // Validar que el horario exista en la disponibilidad configurada
    $availableSlots = isset($store['availability'][$appointment['date']]) && is_array($store['availability'][$appointment['date']])
        ? $store['availability'][$appointment['date']]
        : [];
    if (count($availableSlots) > 0 && !in_array($appointment['time'], $availableSlots, true)) {
        json_response([
            'ok' => false,
            'error' => 'Ese horario no está disponible para la fecha seleccionada'
        ], 400);
    }

    if (appointment_slot_taken($store['appointments'], $appointment['date'], $appointment['time'], null, $appointment['doctor'])) {
        json_response([
            'ok' => false,
            'error' => 'Ese horario ya fue reservado'
        ], 409);
    }

    $paymentMethod = strtolower(trim((string) ($appointment['paymentMethod'] ?? 'unpaid')));
    if (!in_array($paymentMethod, ['card', 'transfer', 'cash', 'unpaid'], true)) {
        json_response([
            'ok' => false,
            'error' => 'Metodo de pago no valido'
        ], 400);
    }

    if ($paymentMethod === 'card') {
        $paymentIntentId = trim((string) ($appointment['paymentIntentId'] ?? ''));
        if ($paymentIntentId === '') {
            json_response([
                'ok' => false,
                'error' => 'Falta confirmar el pago con tarjeta'
            ], 400);
        }

        foreach ($store['appointments'] as $existingAppointment) {
            $existingIntent = trim((string) ($existingAppointment['paymentIntentId'] ?? ''));
            if ($existingIntent !== '' && hash_equals($existingIntent, $paymentIntentId)) {
                json_response([
                    'ok' => false,
                    'error' => 'Este pago ya fue utilizado para otra reserva'
                ], 409);
            }
        }

        if (!payment_gateway_enabled()) {
            json_response([
                'ok' => false,
                'error' => 'La pasarela de pago no esta disponible'
            ], 503);
        }

        try {
            $intent = stripe_get_payment_intent($paymentIntentId);
        } catch (RuntimeException $e) {
            json_response([
                'ok' => false,
                'error' => 'No se pudo validar el pago: ' . $e->getMessage()
            ], 502);
        }

        $intentStatus = (string) ($intent['status'] ?? '');
        $expectedAmount = payment_expected_amount_cents($appointment['service']);
        $intentAmount = isset($intent['amount']) ? (int) $intent['amount'] : 0;
        $amountReceived = isset($intent['amount_received']) ? (int) $intent['amount_received'] : 0;
        $intentCurrency = strtoupper((string) ($intent['currency'] ?? payment_currency()));
        $expectedCurrency = strtoupper(payment_currency());
        $intentMetadata = isset($intent['metadata']) && is_array($intent['metadata']) ? $intent['metadata'] : [];
        $metadataSite = trim((string) ($intentMetadata['site'] ?? ''));
        $metadataService = trim((string) ($intentMetadata['service'] ?? ''));
        $metadataDate = trim((string) ($intentMetadata['date'] ?? ''));
        $metadataTime = trim((string) ($intentMetadata['time'] ?? ''));
        $metadataDoctor = trim((string) ($intentMetadata['doctor'] ?? ''));

        if ($intentStatus !== 'succeeded') {
            json_response([
                'ok' => false,
                'error' => 'El pago aun no esta completado'
            ], 400);
        }
        if ($intentAmount !== $expectedAmount || $amountReceived < $expectedAmount) {
            json_response([
                'ok' => false,
                'error' => 'El monto pagado no coincide con la reserva'
            ], 400);
        }
        if ($intentCurrency !== $expectedCurrency) {
            json_response([
                'ok' => false,
                'error' => 'La moneda del pago no coincide con la configuracion'
            ], 400);
        }
        if ($metadataSite !== '' && strcasecmp($metadataSite, 'pielarmonia.com') !== 0) {
            json_response([
                'ok' => false,
                'error' => 'El pago no pertenece a este sitio'
            ], 400);
        }
        if ($metadataService !== '' && $metadataService !== $appointment['service']) {
            json_response([
                'ok' => false,
                'error' => 'El pago no coincide con el servicio seleccionado'
            ], 400);
        }
        if ($metadataDate !== '' && $metadataDate !== $appointment['date']) {
            json_response([
                'ok' => false,
                'error' => 'El pago no coincide con la fecha seleccionada'
            ], 400);
        }
        if ($metadataTime !== '' && $metadataTime !== $appointment['time']) {
            json_response([
                'ok' => false,
                'error' => 'El pago no coincide con la hora seleccionada'
            ], 400);
        }
        if ($metadataDoctor !== '' && $metadataDoctor !== $appointment['doctor']) {
            json_response([
                'ok' => false,
                'error' => 'El pago no coincide con el doctor seleccionado'
            ], 400);
        }

        $appointment['paymentMethod'] = 'card';
        $appointment['paymentStatus'] = 'paid';
        $appointment['paymentProvider'] = 'stripe';
        $appointment['paymentPaidAt'] = local_date('c');
        $appointment['paymentIntentId'] = $paymentIntentId;
    } elseif ($paymentMethod === 'transfer') {
        $reference = trim((string) ($appointment['transferReference'] ?? ''));
        $proofPath = trim((string) ($appointment['transferProofPath'] ?? ''));
        $proofUrl = trim((string) ($appointment['transferProofUrl'] ?? ''));

        if ($reference === '') {
            json_response([
                'ok' => false,
                'error' => 'Debes ingresar el numero de referencia de la transferencia'
            ], 400);
        }
        if ($proofPath === '' || $proofUrl === '') {
            json_response([
                'ok' => false,
                'error' => 'Debes adjuntar el comprobante de transferencia'
            ], 400);
        }

        $appointment['paymentMethod'] = 'transfer';
        $appointment['paymentStatus'] = 'pending_transfer_review';
    } elseif ($paymentMethod === 'cash') {
        $appointment['paymentMethod'] = 'cash';
        $appointment['paymentStatus'] = 'pending_cash';
    } else {
        $appointment['paymentMethod'] = 'unpaid';
        $appointment['paymentStatus'] = 'pending';
    }

    // Si el doctor es "indiferente", asignar al primer doctor con slot libre
    if ($appointment['doctor'] === 'indiferente' || $appointment['doctor'] === '') {
        $doctors = ['rosero', 'narvaez'];
        $assigned = '';
        foreach ($doctors as $candidate) {
            if (!appointment_slot_taken($store['appointments'], $appointment['date'], $appointment['time'], null, $candidate)) {
                $assigned = $candidate;
                break;
            }
        }
        if ($assigned !== '') {
            $appointment['doctorAssigned'] = $assigned;
        }
    }

    $store['appointments'][] = $appointment;
    write_store($store);

    $emailSent = false;
    try {
        $emailSent = maybe_send_appointment_email($appointment);
    } catch (Throwable $e) {
        error_log('Piel en Armonía: fallo al enviar email de confirmación: ' . $e->getMessage());
    }
    try {
        maybe_send_admin_notification($appointment);
    } catch (Throwable $e) {
        error_log('Piel en Armonía: fallo al enviar notificación admin: ' . $e->getMessage());
    }

    json_response([
        'ok' => true,
        'data' => $appointment,
        'emailSent' => $emailSent
    ], 201);
}

if (($method === 'PATCH' || $method === 'PUT') && $resource === 'appointments') {
    $payload = require_json_body();
    $id = isset($payload['id']) ? (int) $payload['id'] : 0;
    if ($id <= 0) {
        json_response([
            'ok' => false,
            'error' => 'Identificador inválido'
        ], 400);
    }
    $found = false;
    foreach ($store['appointments'] as &$appt) {
        if ((int) ($appt['id'] ?? 0) !== $id) {
            continue;
        }
        $found = true;
        if (isset($payload['status'])) {
            $appt['status'] = map_appointment_status((string) $payload['status']);
        }
        if (isset($payload['paymentStatus'])) {
            $appt['paymentStatus'] = (string) $payload['paymentStatus'];
        }
        if (isset($payload['paymentMethod'])) {
            $appt['paymentMethod'] = (string) $payload['paymentMethod'];
        }
        if (isset($payload['paymentProvider'])) {
            $appt['paymentProvider'] = (string) $payload['paymentProvider'];
        }
        if (isset($payload['paymentIntentId'])) {
            $appt['paymentIntentId'] = (string) $payload['paymentIntentId'];
        }
        if (isset($payload['paymentPaidAt'])) {
            $appt['paymentPaidAt'] = (string) $payload['paymentPaidAt'];
        }
        if (isset($payload['transferReference'])) {
            $appt['transferReference'] = (string) $payload['transferReference'];
        }
        if (isset($payload['transferProofPath'])) {
            $appt['transferProofPath'] = (string) $payload['transferProofPath'];
        }
        if (isset($payload['transferProofUrl'])) {
            $appt['transferProofUrl'] = (string) $payload['transferProofUrl'];
        }
        if (isset($payload['transferProofName'])) {
            $appt['transferProofName'] = (string) $payload['transferProofName'];
        }
        if (isset($payload['transferProofMime'])) {
            $appt['transferProofMime'] = (string) $payload['transferProofMime'];
        }
    }
    unset($appt);
    if (!$found) {
        json_response([
            'ok' => false,
            'error' => 'Cita no encontrada'
        ], 404);
    }
    write_store($store);

    // Enviar email de cancelación al paciente si se canceló la cita
    if (isset($payload['status']) && map_appointment_status((string) $payload['status']) === 'cancelled') {
        foreach ($store['appointments'] as $apptNotify) {
            if ((int) ($apptNotify['id'] ?? 0) === $id) {
                try { maybe_send_cancellation_email($apptNotify); } catch (Throwable $e) { error_log('Piel en Armonía: fallo email cancelación: ' . $e->getMessage()); }
                break;
            }
        }
    }

    json_response([
        'ok' => true
    ]);
}

if ($method === 'POST' && $resource === 'callbacks') {
    require_rate_limit('callbacks');
    $payload = require_json_body();

    if (!captcha_verify_token((string)($payload['captchaToken'] ?? ''))) {
        json_response(['ok' => false, 'error' => 'CAPTCHA invalido'], 400);
    }

    $callback = normalize_callback($payload);

    if ($callback['telefono'] === '') {
        json_response([
            'ok' => false,
            'error' => 'Teléfono obligatorio'
        ], 400);
    }

    if (!validate_phone($callback['telefono'])) {
        json_response([
            'ok' => false,
            'error' => 'El formato del teléfono no es válido'
        ], 400);
    }

    $store['callbacks'][] = $callback;
    write_store($store);
    try { maybe_send_callback_admin_notification($callback); } catch (Throwable $e) { error_log('Piel en Armonía: fallo notificación callback: ' . $e->getMessage()); }
    json_response([
        'ok' => true,
        'data' => $callback
    ], 201);
}

if (($method === 'PATCH' || $method === 'PUT') && $resource === 'callbacks') {
    $payload = require_json_body();
    $id = isset($payload['id']) ? (int) $payload['id'] : 0;
    if ($id <= 0) {
        json_response([
            'ok' => false,
            'error' => 'Identificador inválido'
        ], 400);
    }
    $found = false;
    foreach ($store['callbacks'] as &$callback) {
        if ((int) ($callback['id'] ?? 0) !== $id) {
            continue;
        }
        $found = true;
        if (isset($payload['status'])) {
            $callback['status'] = map_callback_status((string) $payload['status']);
        }
    }
    unset($callback);
    if (!$found) {
        json_response([
            'ok' => false,
            'error' => 'Callback no encontrado'
        ], 404);
    }
    write_store($store);
    json_response([
        'ok' => true
    ]);
}

if ($method === 'POST' && $resource === 'reviews') {
    require_rate_limit('reviews');
    $payload = require_json_body();

    if (!captcha_verify_token((string)($payload['captchaToken'] ?? ''))) {
        json_response(['ok' => false, 'error' => 'CAPTCHA invalido'], 400);
    }

    $review = normalize_review($payload);
    if ($review['name'] === '' || $review['text'] === '') {
        json_response([
            'ok' => false,
            'error' => 'Nombre y reseña son obligatorios'
        ], 400);
    }
    $store['reviews'][] = $review;
    write_store($store);
    json_response([
        'ok' => true,
        'data' => $review
    ], 201);
}

if ($method === 'POST' && $resource === 'availability') {
    $payload = require_json_body();
    $availability = isset($payload['availability']) && is_array($payload['availability'])
        ? $payload['availability']
        : [];
    $store['availability'] = $availability;
    write_store($store);
    json_response([
        'ok' => true,
        'data' => $store['availability']
    ]);
}

if ($method === 'POST' && $resource === 'import') {
    if (!$isAdmin) {
        json_response(['ok' => false, 'error' => 'No autorizado'], 401);
    }
    require_csrf();
    $payload = require_json_body();
    $store['appointments'] = isset($payload['appointments']) && is_array($payload['appointments']) ? $payload['appointments'] : [];
    $store['callbacks'] = isset($payload['callbacks']) && is_array($payload['callbacks']) ? $payload['callbacks'] : [];
    $store['reviews'] = isset($payload['reviews']) && is_array($payload['reviews']) ? $payload['reviews'] : [];
    $store['availability'] = isset($payload['availability']) && is_array($payload['availability']) ? $payload['availability'] : [];
    write_store($store);
    json_response([
        'ok' => true
    ]);
}

// ── Reprogramación pública (por token) ──────────────────
if ($method === 'GET' && $resource === 'reschedule') {
    $token = trim((string) ($_GET['token'] ?? ''));
    if ($token === '' || strlen($token) < 16) {
        json_response(['ok' => false, 'error' => 'Token inválido'], 400);
    }

    $found = null;
    foreach ($store['appointments'] as $appt) {
        if (($appt['rescheduleToken'] ?? '') === $token && ($appt['status'] ?? '') !== 'cancelled') {
            $found = $appt;
            break;
        }
    }

    if (!$found) {
        json_response(['ok' => false, 'error' => 'Cita no encontrada o cancelada'], 404);
    }

    json_response([
        'ok' => true,
        'data' => [
            'id' => $found['id'],
            'service' => $found['service'] ?? '',
            'doctor' => $found['doctor'] ?? '',
            'date' => $found['date'] ?? '',
            'time' => $found['time'] ?? '',
            'name' => $found['name'] ?? '',
            'status' => $found['status'] ?? ''
        ]
    ]);
}

if ($method === 'PATCH' && $resource === 'reschedule') {
    require_rate_limit('reschedule');
    $payload = require_json_body();
    $token = trim((string) ($payload['token'] ?? ''));
    $newDate = trim((string) ($payload['date'] ?? ''));
    $newTime = trim((string) ($payload['time'] ?? ''));

    if ($token === '' || strlen($token) < 16) {
        json_response(['ok' => false, 'error' => 'Token inválido'], 400);
    }
    if ($newDate === '' || $newTime === '') {
        json_response(['ok' => false, 'error' => 'Fecha y hora son obligatorias'], 400);
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $newDate)) {
        json_response(['ok' => false, 'error' => 'Formato de fecha inválido'], 400);
    }
    if (strtotime($newDate) < strtotime(date('Y-m-d'))) {
        json_response(['ok' => false, 'error' => 'No puedes reprogramar a una fecha pasada'], 400);
    }

    $found = false;
    foreach ($store['appointments'] as &$appt) {
        if (($appt['rescheduleToken'] ?? '') !== $token) {
            continue;
        }
        if (($appt['status'] ?? '') === 'cancelled') {
            json_response(['ok' => false, 'error' => 'Esta cita fue cancelada'], 400);
        }

        $doctor = $appt['doctor'] ?? '';
        $excludeId = (int) ($appt['id'] ?? 0);
        if (appointment_slot_taken($store['appointments'], $newDate, $newTime, $excludeId, $doctor)) {
            json_response(['ok' => false, 'error' => 'El horario seleccionado ya no está disponible'], 409);
        }

        $appt['date'] = $newDate;
        $appt['time'] = $newTime;
        $appt['reminderSentAt'] = '';
        $found = true;

        write_store($store);
        try { maybe_send_reschedule_email($appt); } catch (Throwable $e) { error_log('Piel en Armonía: fallo email reagendar: ' . $e->getMessage()); }

        json_response([
            'ok' => true,
            'data' => [
                'id' => $appt['id'],
                'date' => $newDate,
                'time' => $newTime
            ]
        ]);
    }
    unset($appt);

    if (!$found) {
        json_response(['ok' => false, 'error' => 'Cita no encontrada'], 404);
    }
}

json_response([
    'ok' => false,
    'error' => 'Ruta no soportada'
], 404);
