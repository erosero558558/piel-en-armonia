<?php
declare(strict_types=1);

/**
 * Shared helpers for lightweight JSON API persistence.
 */

const DATA_DIR = __DIR__ . DIRECTORY_SEPARATOR . 'data';
const DATA_FILE = DATA_DIR . DIRECTORY_SEPARATOR . 'store.json';
const BACKUP_DIR = DATA_DIR . DIRECTORY_SEPARATOR . 'backups';
const MAX_STORE_BACKUPS = 30;
const ADMIN_PASSWORD_ENV = 'PIELARMONIA_ADMIN_PASSWORD';
const ADMIN_PASSWORD_HASH_ENV = 'PIELARMONIA_ADMIN_PASSWORD_HASH';
const APP_TIMEZONE = 'America/Guayaquil';
const SESSION_TIMEOUT = 1800; // 30 minutos de inactividad

date_default_timezone_set(APP_TIMEZONE);

function local_date(string $format): string
{
    return date($format);
}

function data_dir_path(): string
{
    static $resolvedDir = null;
    if (is_string($resolvedDir) && $resolvedDir !== '') {
        return $resolvedDir;
    }

    $candidates = [];

    $envDir = getenv('PIELARMONIA_DATA_DIR');
    if (is_string($envDir) && trim($envDir) !== '') {
        $candidates[] = trim($envDir);
    }

    $candidates[] = DATA_DIR;
    $candidates[] = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'data';
    $candidates[] = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pielarmonia-data';

    foreach ($candidates as $candidate) {
        $candidate = rtrim(str_replace(['/', '\\'], DIRECTORY_SEPARATOR, (string) $candidate), DIRECTORY_SEPARATOR);
        if ($candidate === '') {
            continue;
        }

        if (!@is_dir($candidate)) {
            if (!@mkdir($candidate, 0775, true) && !@is_dir($candidate)) {
                continue;
            }
        }

        if (@is_writable($candidate)) {
            $resolvedDir = $candidate;
            return $resolvedDir;
        }
    }

    $resolvedDir = DATA_DIR;
    return $resolvedDir;
}

function data_file_path(): string
{
    return data_dir_path() . DIRECTORY_SEPARATOR . 'store.json';
}

function backup_dir_path(): string
{
    return data_dir_path() . DIRECTORY_SEPARATOR . 'backups';
}

function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit();
}

function is_https_request(): bool
{
    if (isset($_SERVER['HTTPS'])) {
        $https = strtolower((string) $_SERVER['HTTPS']);
        if ($https === 'on' || $https === '1') {
            return true;
        }
    }

    if (isset($_SERVER['SERVER_PORT']) && (string) $_SERVER['SERVER_PORT'] === '443') {
        return true;
    }

    if (isset($_SERVER['HTTP_X_FORWARDED_PROTO'])) {
        return strtolower((string) $_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https';
    }

    return false;
}

function start_secure_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $secure = is_https_request();

    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_strict_mode', '1');
    ini_set('session.cookie_httponly', '1');
    ini_set('session.cookie_secure', $secure ? '1' : '0');

    if (PHP_VERSION_ID >= 70300) {
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'domain' => '',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Strict'
        ]);
    } else {
        ini_set('session.cookie_samesite', 'Strict');
        session_set_cookie_params(0, '/; samesite=Strict', '', $secure, true);
    }

    session_start();

    // Expirar sesion por inactividad
    if (isset($_SESSION['last_activity']) && (time() - $_SESSION['last_activity']) > SESSION_TIMEOUT) {
        destroy_secure_session();
        start_secure_session();
    }
    $_SESSION['last_activity'] = time();
}

function destroy_secure_session(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        return;
    }

    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        if (PHP_VERSION_ID >= 70300) {
            setcookie(session_name(), '', [
                'expires' => time() - 42000,
                'path' => $params['path'] ?? '/',
                'domain' => $params['domain'] ?? '',
                'secure' => (bool) ($params['secure'] ?? false),
                'httponly' => (bool) ($params['httponly'] ?? true),
                'samesite' => 'Strict'
            ]);
        } else {
            setcookie(session_name(), '', time() - 42000, ($params['path'] ?? '/') . '; samesite=Strict', $params['domain'] ?? '', (bool) ($params['secure'] ?? false), (bool) ($params['httponly'] ?? true));
        }
    }

    session_destroy();
}

function ensure_backup_dir(): bool
{
    $backupDir = backup_dir_path();
    if (is_dir($backupDir)) {
        return true;
    }
    return @mkdir($backupDir, 0775, true) || is_dir($backupDir);
}

function prune_backup_files(): void
{
    $files = glob(backup_dir_path() . DIRECTORY_SEPARATOR . 'store-*.json');
    if (!is_array($files) || count($files) <= MAX_STORE_BACKUPS) {
        return;
    }

    sort($files, SORT_STRING);
    $toDelete = array_slice($files, 0, count($files) - MAX_STORE_BACKUPS);
    foreach ($toDelete as $file) {
        @unlink($file);
    }
}

function create_store_backup_locked($fp): void
{
    if (!is_resource($fp)) {
        return;
    }

    if (!ensure_backup_dir()) {
        error_log('Piel en Armonia: no se pudo crear el directorio de backups');
        return;
    }

    rewind($fp);
    $current = stream_get_contents($fp);
    if (!is_string($current) || trim($current) === '') {
        return;
    }

    try {
        $suffix = bin2hex(random_bytes(3));
    } catch (Throwable $e) {
        $suffix = substr(md5((string) microtime(true)), 0, 6);
    }

    $filename = backup_dir_path() . DIRECTORY_SEPARATOR . 'store-' . local_date('Ymd-His') . '-' . $suffix . '.json';
    if (@file_put_contents($filename, $current, LOCK_EX) === false) {
        error_log('Piel en Armonia: no se pudo guardar backup de store.json');
        return;
    }

    prune_backup_files();
}

function ensure_data_file(): bool
{
    $dataDir = data_dir_path();
    $dataFile = data_file_path();

    if (!is_dir($dataDir) && !@mkdir($dataDir, 0775, true) && !is_dir($dataDir)) {
        error_log('Piel en Armonia: no se pudo crear el directorio de datos: ' . $dataDir);
        return false;
    }

    if (!file_exists($dataFile)) {
        $seed = [
            'appointments' => [],
            'callbacks' => [],
            'reviews' => [],
            'availability' => [],
            'createdAt' => local_date('c'),
            'updatedAt' => local_date('c')
        ];
        $seedEncoded = json_encode($seed, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($seedEncoded === false || @file_put_contents($dataFile, $seedEncoded, LOCK_EX) === false) {
            error_log('Piel en Armonia: no se pudo inicializar store.json en ' . $dataFile);
            return false;
        }
    }

    return true;
}

function read_store(): array
{
    if (!ensure_data_file()) {
        return [
            'appointments' => [],
            'callbacks' => [],
            'reviews' => [],
            'availability' => [],
            'updatedAt' => local_date('c')
        ];
    }

    $raw = @file_get_contents(data_file_path());
    if ($raw === false || $raw === '') {
        return [
            'appointments' => [],
            'callbacks' => [],
            'reviews' => [],
            'availability' => [],
            'updatedAt' => local_date('c')
        ];
    }

    $data = json_decode($raw, true);
    if (!is_array($data)) {
        return [
            'appointments' => [],
            'callbacks' => [],
            'reviews' => [],
            'availability' => [],
            'updatedAt' => local_date('c')
        ];
    }

    $data['appointments'] = isset($data['appointments']) && is_array($data['appointments']) ? $data['appointments'] : [];
    $data['callbacks'] = isset($data['callbacks']) && is_array($data['callbacks']) ? $data['callbacks'] : [];
    $data['reviews'] = isset($data['reviews']) && is_array($data['reviews']) ? $data['reviews'] : [];
    $data['availability'] = isset($data['availability']) && is_array($data['availability']) ? $data['availability'] : [];
    $data['updatedAt'] = isset($data['updatedAt']) ? (string) $data['updatedAt'] : local_date('c');

    return $data;
}

function write_store(array $store): void
{
    if (!ensure_data_file()) {
        json_response([
            'ok' => false,
            'error' => 'No hay permisos de escritura para los datos',
            'path' => data_file_path()
        ], 500);
    }

    $store['appointments'] = isset($store['appointments']) && is_array($store['appointments']) ? $store['appointments'] : [];
    $store['callbacks'] = isset($store['callbacks']) && is_array($store['callbacks']) ? $store['callbacks'] : [];
    $store['reviews'] = isset($store['reviews']) && is_array($store['reviews']) ? $store['reviews'] : [];
    $store['availability'] = isset($store['availability']) && is_array($store['availability']) ? $store['availability'] : [];
    $store['updatedAt'] = local_date('c');

    $fp = @fopen(data_file_path(), 'c+');
    if ($fp === false) {
        json_response([
            'ok' => false,
            'error' => 'No se pudo abrir el archivo de datos'
        ], 500);
    }

    try {
        if (!flock($fp, LOCK_EX)) {
            json_response([
                'ok' => false,
                'error' => 'No se pudo bloquear el archivo de datos'
            ], 500);
        }

        // Backup del estado anterior antes de sobrescribir.
        create_store_backup_locked($fp);

        ftruncate($fp, 0);
        rewind($fp);
        $encoded = json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($encoded === false || fwrite($fp, $encoded) === false) {
            json_response([
                'ok' => false,
                'error' => 'No se pudo guardar la información'
            ], 500);
        }
        fflush($fp);
        flock($fp, LOCK_UN);
    } finally {
        fclose($fp);
    }
}

function sanitize_phone(string $phone): string
{
    return trim($phone);
}

function validate_email(string $email): bool
{
    return $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

function validate_phone(string $phone): bool
{
    $digits = preg_replace('/\D/', '', $phone);
    return is_string($digits) && strlen($digits) >= 7 && strlen($digits) <= 15;
}

function require_json_body(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?? '', true);
    if (!is_array($data)) {
        json_response([
            'ok' => false,
            'error' => 'El JSON enviado no es válido'
        ], 400);
    }
    return $data;
}

function parse_bool(mixed $value): bool
{
    if (is_bool($value)) {
        return $value;
    }
    if (is_string($value)) {
        return in_array(strtolower($value), ['1', 'true', 'yes', 'on'], true);
    }
    if (is_int($value)) {
        return $value === 1;
    }
    return false;
}

function map_callback_status(string $status): string
{
    $normalized = strtolower(trim($status));
    if ($normalized === 'contacted') {
        return 'contactado';
    }
    if ($normalized === 'pending') {
        return 'pendiente';
    }
    return in_array($normalized, ['pendiente', 'contactado'], true) ? $normalized : 'pendiente';
}

function map_appointment_status(string $status): string
{
    $normalized = strtolower(trim($status));
    return in_array($normalized, ['confirmed', 'pending', 'cancelled', 'completed'], true)
        ? $normalized
        : 'confirmed';
}

function generate_csrf_token(): string
{
    if (!isset($_SESSION['csrf_token']) || $_SESSION['csrf_token'] === '') {
        try {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        } catch (Throwable $e) {
            $_SESSION['csrf_token'] = bin2hex((string) microtime(true) . (string) mt_rand());
        }
    }
    return $_SESSION['csrf_token'];
}

function verify_csrf_token(): bool
{
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if ($token === '' || !isset($_SESSION['csrf_token']) || $_SESSION['csrf_token'] === '') {
        return false;
    }
    return hash_equals($_SESSION['csrf_token'], (string) $token);
}

function require_csrf(): void
{
    if (!verify_csrf_token()) {
        json_response([
            'ok' => false,
            'error' => 'Token CSRF inválido o ausente'
        ], 403);
    }
}

function check_rate_limit(string $action, int $maxRequests = 10, int $windowSeconds = 60): bool
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $key = md5($ip . ':' . $action);
    $rateDir = data_dir_path() . DIRECTORY_SEPARATOR . 'ratelimit';

    if (!@is_dir($rateDir)) {
        @mkdir($rateDir, 0775, true);
    }

    $file = $rateDir . DIRECTORY_SEPARATOR . $key . '.json';
    $now = time();
    $entries = [];

    if (file_exists($file)) {
        $raw = @file_get_contents($file);
        $entries = is_string($raw) ? (json_decode($raw, true) ?? []) : [];
    }

    // Filtrar entradas dentro de la ventana de tiempo
    $entries = array_values(array_filter($entries, static function (int $ts) use ($now, $windowSeconds): bool {
        return ($now - $ts) < $windowSeconds;
    }));

    if (count($entries) >= $maxRequests) {
        return false;
    }

    $entries[] = $now;
    @file_put_contents($file, json_encode($entries), LOCK_EX);
    return true;
}

function require_rate_limit(string $action, int $maxRequests = 10, int $windowSeconds = 60): void
{
    if (!check_rate_limit($action, $maxRequests, $windowSeconds)) {
        json_response([
            'ok' => false,
            'error' => 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.'
        ], 429);
    }
}

function verify_admin_password(string $password): bool
{
    $hash = getenv(ADMIN_PASSWORD_HASH_ENV);
    if (is_string($hash) && $hash !== '') {
        return password_verify($password, $hash);
    }

    $plain = getenv(ADMIN_PASSWORD_ENV);
    if (is_string($plain) && $plain !== '') {
        return hash_equals($plain, $password);
    }

    return false;
}

function normalize_review(array $review): array
{
    $rating = isset($review['rating']) ? (int) $review['rating'] : 0;
    if ($rating < 1) {
        $rating = 1;
    }
    if ($rating > 5) {
        $rating = 5;
    }
    return [
        'id' => isset($review['id']) ? (int) $review['id'] : (int) round(microtime(true) * 1000),
        'name' => isset($review['name']) ? trim((string) $review['name']) : '',
        'rating' => $rating,
        'text' => isset($review['text']) ? trim((string) $review['text']) : '',
        'date' => isset($review['date']) ? (string) $review['date'] : local_date('c'),
        'verified' => isset($review['verified']) ? parse_bool($review['verified']) : true
    ];
}

function normalize_callback(array $callback): array
{
    return [
        'id' => isset($callback['id']) ? (int) $callback['id'] : (int) round(microtime(true) * 1000),
        'telefono' => sanitize_phone((string) ($callback['telefono'] ?? '')),
        'preferencia' => (string) ($callback['preferencia'] ?? ''),
        'fecha' => isset($callback['fecha']) ? (string) $callback['fecha'] : local_date('c'),
        'status' => map_callback_status((string) ($callback['status'] ?? 'pendiente'))
    ];
}

function normalize_appointment(array $appointment): array
{
    return [
        'id' => isset($appointment['id']) ? (int) $appointment['id'] : (int) round(microtime(true) * 1000),
        'service' => (string) ($appointment['service'] ?? ''),
        'doctor' => (string) ($appointment['doctor'] ?? ''),
        'date' => (string) ($appointment['date'] ?? ''),
        'time' => (string) ($appointment['time'] ?? ''),
        'name' => trim((string) ($appointment['name'] ?? '')),
        'email' => trim((string) ($appointment['email'] ?? '')),
        'phone' => sanitize_phone((string) ($appointment['phone'] ?? '')),
        'price' => (string) ($appointment['price'] ?? '$0.00'),
        'status' => map_appointment_status((string) ($appointment['status'] ?? 'confirmed')),
        'paymentMethod' => isset($appointment['paymentMethod']) ? (string) $appointment['paymentMethod'] : 'unpaid',
        'paymentStatus' => isset($appointment['paymentStatus']) ? (string) $appointment['paymentStatus'] : 'pending',
        'dateBooked' => isset($appointment['dateBooked']) ? (string) $appointment['dateBooked'] : local_date('c')
    ];
}

function appointment_slot_taken(array $appointments, string $date, string $time, ?int $excludeId = null): bool
{
    foreach ($appointments as $appt) {
        $id = isset($appt['id']) ? (int) $appt['id'] : null;
        if ($excludeId !== null && $id === $excludeId) {
            continue;
        }
        $status = map_appointment_status((string) ($appt['status'] ?? 'confirmed'));
        if ($status !== 'cancelled'
            && (string) ($appt['date'] ?? '') === $date
            && (string) ($appt['time'] ?? '') === $time) {
            return true;
        }
    }
    return false;
}

function maybe_send_appointment_email(array $appointment): bool
{
    $to = trim((string) ($appointment['email'] ?? ''));
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $clinicName = 'Piel en Armonía';
    $subject = 'Confirmacion de cita - ' . $clinicName;
    $message = "Hola " . ($appointment['name'] ?? 'paciente') . ",\n\n";
    $message .= "Tu cita fue registrada correctamente.\n";
    $message .= "Servicio: " . ($appointment['service'] ?? '-') . "\n";
    $message .= "Doctor: " . ($appointment['doctor'] ?? '-') . "\n";
    $message .= "Fecha: " . ($appointment['date'] ?? '-') . "\n";
    $message .= "Hora: " . ($appointment['time'] ?? '-') . "\n";
    $message .= "Estado de pago: " . ($appointment['paymentStatus'] ?? 'pending') . "\n\n";
    $message .= "Gracias por confiar en nosotros.";

    $from = getenv('PIELARMONIA_EMAIL_FROM');
    if (!is_string($from) || $from === '') {
        error_log('Piel en Armonia: PIELARMONIA_EMAIL_FROM no configurado, usando fallback no-reply@pielarmonia.com');
        $from = 'no-reply@pielarmonia.com';
    }
    $headers = "From: {$from}\r\nContent-Type: text/plain; charset=UTF-8";

    $sent = mail($to, $subject, $message, $headers);
    if (!$sent) {
        error_log('Piel en Armonia: fallo al enviar email de confirmación a ' . $to);
    }
    return $sent;
}
