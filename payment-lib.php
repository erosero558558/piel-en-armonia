<?php
declare(strict_types=1);

require_once __DIR__ . '/api-lib.php';

const TRANSFER_PROOF_MAX_BYTES = 5242880; // 5 MB

function payment_currency(): string
{
    $raw = getenv('PIELARMONIA_PAYMENT_CURRENCY');
    $currency = is_string($raw) && trim($raw) !== '' ? strtoupper(trim($raw)) : 'USD';
    if (!preg_match('/^[A-Z]{3}$/', $currency)) {
        return 'USD';
    }
    return $currency;
}

function payment_stripe_secret_key(): string
{
    $raw = getenv('PIELARMONIA_STRIPE_SECRET_KEY');
    return is_string($raw) ? trim($raw) : '';
}

function payment_stripe_publishable_key(): string
{
    $raw = getenv('PIELARMONIA_STRIPE_PUBLISHABLE_KEY');
    return is_string($raw) ? trim($raw) : '';
}

function payment_stripe_webhook_secret(): string
{
    $raw = getenv('PIELARMONIA_STRIPE_WEBHOOK_SECRET');
    return is_string($raw) ? trim($raw) : '';
}

function payment_gateway_enabled(): bool
{
    return payment_stripe_secret_key() !== '' && payment_stripe_publishable_key() !== '';
}

function stripe_verify_webhook_signature(string $payload, string $sigHeader, string $secret): array
{
    $elements = explode(',', $sigHeader);
    $timestamp = '';
    $signatures = [];
    foreach ($elements as $el) {
        $el = trim($el);
        if (strpos($el, 't=') === 0) {
            $timestamp = substr($el, 2);
        } elseif (strpos($el, 'v1=') === 0) {
            $signatures[] = substr($el, 3);
        }
    }

    if ($timestamp === '' || count($signatures) === 0) {
        throw new RuntimeException('Firma de webhook invalida.');
    }

    $tolerance = 300; // 5 minutos
    if (abs(time() - (int) $timestamp) > $tolerance) {
        throw new RuntimeException('Webhook timestamp fuera de tolerancia.');
    }

    $signedPayload = $timestamp . '.' . $payload;
    $expectedSig = hash_hmac('sha256', $signedPayload, $secret);

    $valid = false;
    foreach ($signatures as $sig) {
        if (hash_equals($expectedSig, $sig)) {
            $valid = true;
            break;
        }
    }
    if (!$valid) {
        throw new RuntimeException('Firma de webhook no coincide.');
    }

    $event = json_decode($payload, true);
    if (!is_array($event)) {
        throw new RuntimeException('Payload de webhook invalido.');
    }
    return $event;
}

function payment_expected_amount_cents(string $service): int
{
    $subtotal = get_service_price_amount($service);
    $total = $subtotal + ($subtotal * get_vat_rate());
    return (int) round($total * 100);
}

function payment_build_idempotency_key(string $prefix, string $seed): string
{
    $safePrefix = preg_replace('/[^a-z0-9_-]/i', '-', $prefix);
    if (!is_string($safePrefix) || trim($safePrefix) === '') {
        $safePrefix = 'pay';
    }
    return strtolower($safePrefix) . '-' . substr(hash('sha256', $seed), 0, 48);
}

function stripe_request(string $method, string $path, array $fields = [], string $idempotencyKey = ''): array
{
    $secret = payment_stripe_secret_key();
    if ($secret === '') {
        throw new RuntimeException('La pasarela de pagos no esta configurada.');
    }

    if (!function_exists('curl_init') || !function_exists('curl_setopt_array') || !function_exists('curl_exec')) {
        throw new RuntimeException('cURL no disponible para pagos.');
    }

    $url = 'https://api.stripe.com/v1' . $path;
    $headers = [
        'Authorization: Bearer ' . $secret,
        'Stripe-Version: 2025-04-30.basil'
    ];
    if ($idempotencyKey !== '') {
        $headers[] = 'Idempotency-Key: ' . $idempotencyKey;
    }

    $ch = curl_init($url);
    if ($ch === false) {
        throw new RuntimeException('No se pudo inicializar la conexion con Stripe.');
    }

    $upperMethod = strtoupper($method);
    $options = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 25,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ];

    if ($upperMethod === 'POST') {
        $headers[] = 'Content-Type: application/x-www-form-urlencoded';
        $options[CURLOPT_POST] = true;
        $options[CURLOPT_POSTFIELDS] = http_build_query($fields);
        $options[CURLOPT_HTTPHEADER] = $headers;
    } else {
        $options[CURLOPT_HTTPGET] = true;
    }

    curl_setopt_array($ch, $options);
    $raw = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if (!is_string($raw)) {
        throw new RuntimeException('No se pudo conectar con Stripe: ' . $curlErr);
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Stripe respondio en un formato invalido.');
    }

    if ($httpCode >= 400) {
        $message = 'Error de pago.';
        if (isset($decoded['error']['message']) && is_string($decoded['error']['message'])) {
            $message = trim($decoded['error']['message']);
        }
        throw new RuntimeException($message);
    }

    return $decoded;
}

function stripe_create_payment_intent(array $appointment, string $idempotencyKey = ''): array
{
    $service = (string) ($appointment['service'] ?? '');
    $amountCents = payment_expected_amount_cents($service);
    if ($amountCents <= 0) {
        throw new RuntimeException('No se pudo calcular el monto del pago.');
    }

    $email = trim((string) ($appointment['email'] ?? ''));
    $metadata = [
        'site' => 'pielarmonia.com',
        'service' => $service,
        'doctor' => (string) ($appointment['doctor'] ?? ''),
        'date' => (string) ($appointment['date'] ?? ''),
        'time' => (string) ($appointment['time'] ?? ''),
        'name' => (string) ($appointment['name'] ?? ''),
        'phone' => (string) ($appointment['phone'] ?? ''),
    ];

    $fields = [
        'amount' => (string) $amountCents,
        'currency' => strtolower(payment_currency()),
        'automatic_payment_methods' => ['enabled' => 'true'],
        'description' => 'Reserva de cita - Piel en Armonía',
        'metadata' => $metadata,
    ];
    if ($email !== '') {
        $fields['receipt_email'] = $email;
    }

    return stripe_request('POST', '/payment_intents', $fields, $idempotencyKey);
}

function stripe_get_payment_intent(string $paymentIntentId): array
{
    $id = trim($paymentIntentId);
    if ($id === '') {
        throw new RuntimeException('paymentIntentId es obligatorio.');
    }

    return stripe_request('GET', '/payment_intents/' . rawurlencode($id));
}

function transfer_proof_upload_dir(): string
{
    $raw = getenv('PIELARMONIA_TRANSFER_UPLOAD_DIR');
    if (is_string($raw) && trim($raw) !== '') {
        return rtrim(trim($raw), DIRECTORY_SEPARATOR);
    }
    return __DIR__ . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'transfer-proofs';
}

function transfer_proof_public_base_url(): string
{
    $raw = getenv('PIELARMONIA_TRANSFER_PUBLIC_BASE_URL');
    if (is_string($raw) && trim($raw) !== '') {
        return rtrim(trim($raw), '/');
    }
    return '/uploads/transfer-proofs';
}

function ensure_transfer_proof_dir(): bool
{
    $dir = transfer_proof_upload_dir();
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        return false;
    }

    $htaccessPath = $dir . DIRECTORY_SEPARATOR . '.htaccess';
    if (!is_file($htaccessPath)) {
        @file_put_contents($htaccessPath, "Options -Indexes\n<FilesMatch \"\\.(php|phtml|phar)$\">\n  Require all denied\n</FilesMatch>\n");
    }

    return true;
}

function save_transfer_proof_upload(array $file): array
{
    if (!ensure_transfer_proof_dir()) {
        throw new RuntimeException('No se pudo preparar el almacenamiento de comprobantes.');
    }

    $error = isset($file['error']) ? (int) $file['error'] : UPLOAD_ERR_NO_FILE;
    if ($error !== UPLOAD_ERR_OK) {
        throw new RuntimeException('No se pudo subir el comprobante. Codigo: ' . $error);
    }

    $tmpName = isset($file['tmp_name']) ? (string) $file['tmp_name'] : '';
    if ($tmpName === '' || !is_uploaded_file($tmpName)) {
        throw new RuntimeException('El archivo recibido no es valido.');
    }

    $size = isset($file['size']) ? (int) $file['size'] : 0;
    if ($size <= 0) {
        throw new RuntimeException('El comprobante esta vacio.');
    }
    if ($size > TRANSFER_PROOF_MAX_BYTES) {
        throw new RuntimeException('El comprobante supera 5 MB.');
    }

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = $finfo ? (string) finfo_file($finfo, $tmpName) : '';
    if ($finfo) {
        finfo_close($finfo);
    }

    $allowed = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'application/pdf' => 'pdf',
    ];
    if (!isset($allowed[$mime])) {
        throw new RuntimeException('Formato no permitido. Usa JPG, PNG, WEBP o PDF.');
    }

    try {
        $suffix = bin2hex(random_bytes(6));
    } catch (Throwable $e) {
        $suffix = substr(md5((string) microtime(true)), 0, 12);
    }

    $extension = $allowed[$mime];
    $filename = 'proof-' . local_date('Ymd-His') . '-' . $suffix . '.' . $extension;
    $diskPath = transfer_proof_upload_dir() . DIRECTORY_SEPARATOR . $filename;
    if (!@move_uploaded_file($tmpName, $diskPath)) {
        throw new RuntimeException('No se pudo guardar el comprobante.');
    }

    $originalName = isset($file['name']) ? (string) $file['name'] : $filename;
    $safeOriginal = preg_replace('/[^a-zA-Z0-9._ -]/', '_', basename($originalName));
    if (!is_string($safeOriginal) || $safeOriginal === '') {
        $safeOriginal = $filename;
    }

    $publicBase = transfer_proof_public_base_url();
    $publicUrl = $publicBase . '/' . rawurlencode($filename);
    $publicPath = preg_replace('#^https?://[^/]+#i', '', $publicBase);
    if (!is_string($publicPath)) {
        $publicPath = '/uploads/transfer-proofs';
    }
    $trimmedPublicPath = trim($publicPath, '/');
    $logicalPath = ($trimmedPublicPath !== '' ? '/' . $trimmedPublicPath : '') . '/' . $filename;

    return [
        'path' => $logicalPath,
        'url' => $publicUrl,
        'name' => $safeOriginal,
        'mime' => $mime,
        'size' => $size,
    ];
}
