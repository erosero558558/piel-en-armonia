<?php
declare(strict_types=1);

/**
 * Shared helpers for lightweight JSON API persistence.
 */

// Cargar variables de entorno si existe env.php
$envFile = __DIR__ . DIRECTORY_SEPARATOR . 'env.php';
if (is_file($envFile)) {
    require_once $envFile;
}

const DATA_DIR = __DIR__ . DIRECTORY_SEPARATOR . 'data';
const DATA_FILE = DATA_DIR . DIRECTORY_SEPARATOR . 'store.json';
const BACKUP_DIR = DATA_DIR . DIRECTORY_SEPARATOR . 'backups';
const MAX_STORE_BACKUPS = 30;
const STORE_LOCK_TIMEOUT_MS = 1800;
const STORE_LOCK_RETRY_DELAY_US = 25000;
const ADMIN_PASSWORD_ENV = 'PIELARMONIA_ADMIN_PASSWORD';
const ADMIN_PASSWORD_HASH_ENV = 'PIELARMONIA_ADMIN_PASSWORD_HASH';
const APP_TIMEZONE = 'America/Guayaquil';
const SESSION_TIMEOUT = 1800; // 30 minutos de inactividad

date_default_timezone_set(APP_TIMEZONE);

function local_date(string $format): string
{
    return date($format);
}

function app_runtime_version(): string
{
    static $resolved = null;
    if (is_string($resolved) && $resolved !== '') {
        return $resolved;
    }

    $candidates = [
        getenv('PIELARMONIA_APP_VERSION'),
        getenv('APP_VERSION')
    ];

    foreach ($candidates as $candidate) {
        if (is_string($candidate) && trim($candidate) !== '') {
            $resolved = trim($candidate);
            return $resolved;
        }
    }

    $versionSources = [
        __DIR__ . DIRECTORY_SEPARATOR . 'index.html',
        __DIR__ . DIRECTORY_SEPARATOR . 'script.js',
        __DIR__ . DIRECTORY_SEPARATOR . 'styles.css',
        __DIR__ . DIRECTORY_SEPARATOR . 'api.php',
        __DIR__ . DIRECTORY_SEPARATOR . 'figo-chat.php'
    ];

    $latestMtime = 0;
    foreach ($versionSources as $source) {
        if (!is_file($source)) {
            continue;
        }
        $mtime = @filemtime($source);
        if (is_int($mtime) && $mtime > $latestMtime) {
            $latestMtime = $mtime;
        }
    }

    if ($latestMtime > 0) {
        $resolved = gmdate('YmdHis', $latestMtime);
    } else {
        $resolved = 'dev';
    }

    return $resolved;
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

function data_dir_writable(): bool
{
    $dir = data_dir_path();

    if (!is_dir($dir)) {
        if (!@mkdir($dir, 0775, true) && !is_dir($dir)) {
            return false;
        }
    }

    return @is_writable($dir);
}

function store_file_is_encrypted(): bool
{
    $path = data_file_path();
    if (!is_file($path)) {
        return false;
    }

    $fp = @fopen($path, 'rb');
    if ($fp === false) {
        return false;
    }

    try {
        $prefix = fread($fp, 6);
    } finally {
        fclose($fp);
    }

    return is_string($prefix) && $prefix === 'ENCv1:';
}

function backup_dir_path(): string
{
    return data_dir_path() . DIRECTORY_SEPARATOR . 'backups';
}

function audit_log_file_path(): string
{
    return data_dir_path() . DIRECTORY_SEPARATOR . 'audit.log';
}

function data_encryption_key(): string
{
    static $resolved = null;
    if (is_string($resolved)) {
        return $resolved;
    }

    $candidates = [
        getenv('PIELARMONIA_DATA_ENCRYPTION_KEY'),
        getenv('PIELARMONIA_DATA_KEY')
    ];

    $raw = '';
    foreach ($candidates as $candidate) {
        if (is_string($candidate) && trim($candidate) !== '') {
            $raw = trim($candidate);
            break;
        }
    }

    if ($raw === '') {
        $resolved = '';
        return $resolved;
    }

    if (strpos($raw, 'base64:') === 0) {
        $decoded = base64_decode(substr($raw, 7), true);
        if (is_string($decoded) && $decoded !== '') {
            $raw = $decoded;
        }
    }

    if (strlen($raw) !== 32) {
        $raw = hash('sha256', $raw, true);
    }

    $resolved = substr($raw, 0, 32);
    return $resolved;
}

function data_encrypt_payload(string $plain): string
{
    $key = data_encryption_key();
    if ($key === '') {
        return $plain;
    }

    if (!function_exists('openssl_encrypt')) {
        error_log('Piel en Armonía: openssl_encrypt no disponible para cifrado de datos');
        return '';
    }

    try {
        $iv = random_bytes(12);
    } catch (Throwable $e) {
        error_log('Piel en Armonía: no se pudo generar IV para cifrado de datos');
        return '';
    }

    $tag = '';
    $cipher = openssl_encrypt($plain, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
    if (!is_string($cipher) || $cipher === '' || !is_string($tag) || $tag === '') {
        error_log('Piel en Armonía: fallo al cifrar store.json');
        return '';
    }

    return 'ENCv1:' . base64_encode($iv . $tag . $cipher);
}

function data_decrypt_payload(string $raw): string
{
    if (substr($raw, 0, 6) !== 'ENCv1:') {
        return $raw;
    }

    $key = data_encryption_key();
    if ($key === '') {
        error_log('Piel en Armonía: store cifrado pero no hay PIELARMONIA_DATA_ENCRYPTION_KEY');
        return '';
    }

    if (!function_exists('openssl_decrypt')) {
        error_log('Piel en Armonía: openssl_decrypt no disponible para descifrado de datos');
        return '';
    }

    $encoded = substr($raw, 6);
    $packed = base64_decode($encoded, true);
    if (!is_string($packed) || strlen($packed) <= 28) {
        error_log('Piel en Armonía: payload cifrado invalido');
        return '';
    }

    $iv = substr($packed, 0, 12);
    $tag = substr($packed, 12, 16);
    $cipher = substr($packed, 28);
    $plain = openssl_decrypt($cipher, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
    if (!is_string($plain)) {
        error_log('Piel en Armonía: fallo al descifrar store.json');
        return '';
    }

    return $plain;
}

function audit_log_event(string $event, array $details = []): void
{
    $line = [
        'ts' => local_date('c'),
        'event' => $event,
        'ip' => get_client_ip(),
        'actor' => (session_status() === PHP_SESSION_ACTIVE && !empty($_SESSION['admin_logged_in'])) ? 'admin' : 'public',
        'path' => (string) ($_SERVER['REQUEST_URI'] ?? ''),
        'details' => $details
    ];

    $encoded = json_encode($line, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($encoded) || $encoded === '') {
        return;
    }

    $dir = data_dir_path();
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    ensure_data_htaccess($dir);
    @file_put_contents(audit_log_file_path(), $encoded . PHP_EOL, FILE_APPEND | LOCK_EX);
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
        error_log('Piel en Armonía: no se pudo crear el directorio de backups');
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
        error_log('Piel en Armonía: no se pudo guardar backup de store.json');
        return;
    }

    prune_backup_files();
}

function ensure_data_htaccess(string $dir): void
{
    $htaccess = $dir . DIRECTORY_SEPARATOR . '.htaccess';
    if (file_exists($htaccess)) {
        return;
    }
    $rules = "# Bloquear acceso publico a datos sensibles\n";
    $rules .= "Order deny,allow\nDeny from all\n";
    $rules .= "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n";
    @file_put_contents($htaccess, $rules, LOCK_EX);
}

function ensure_data_file(): bool
{
    $dataDir = data_dir_path();
    $dataFile = data_file_path();

    if (!is_dir($dataDir) && !@mkdir($dataDir, 0775, true) && !is_dir($dataDir)) {
        error_log('Piel en Armonía: no se pudo crear el directorio de datos: ' . $dataDir);
        return false;
    }

    ensure_data_htaccess($dataDir);

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
        $payloadToWrite = is_string($seedEncoded) ? data_encrypt_payload($seedEncoded) : '';
        if ($payloadToWrite === '' || @file_put_contents($dataFile, $payloadToWrite, LOCK_EX) === false) {
            error_log('Piel en Armonía: no se pudo inicializar store.json en ' . $dataFile);
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

    $rawText = (string) $raw;
    $decodedRaw = data_decrypt_payload($rawText);
    if ($decodedRaw === '') {
        if (substr($rawText, 0, 6) === 'ENCv1:') {
            json_response([
                'ok' => false,
                'error' => 'No se pudo descifrar la base de datos. Verifica PIELARMONIA_DATA_ENCRYPTION_KEY'
            ], 500);
        }
        return [
            'appointments' => [],
            'callbacks' => [],
            'reviews' => [],
            'availability' => [],
            'updatedAt' => local_date('c')
        ];
    }

    $data = json_decode($decodedRaw, true);
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

    $lockAcquired = false;
    try {
        $lockTimeoutMs = STORE_LOCK_TIMEOUT_MS;
        if (!acquire_store_lock($fp, $lockTimeoutMs)) {
            header('Retry-After: 1');
            json_response([
                'ok' => false,
                'error' => 'El sistema esta ocupado. Intenta nuevamente en unos segundos',
                'retryAfterMs' => $lockTimeoutMs
            ], 503);
        }
        $lockAcquired = true;

        // Backup del estado anterior antes de sobrescribir.
        create_store_backup_locked($fp);

        ftruncate($fp, 0);
        rewind($fp);
        $encoded = json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $payloadToWrite = is_string($encoded) ? data_encrypt_payload($encoded) : '';
        if ($payloadToWrite === '' || fwrite($fp, $payloadToWrite) === false) {
            json_response([
                'ok' => false,
                'error' => 'No se pudo guardar la información'
            ], 500);
        }
        fflush($fp);
    } finally {
        if ($lockAcquired) {
            flock($fp, LOCK_UN);
        }
        fclose($fp);
    }
}

function acquire_store_lock($fp, int $timeoutMs = STORE_LOCK_TIMEOUT_MS): bool
{
    if (!is_resource($fp)) {
        return false;
    }

    $timeoutMs = max(100, $timeoutMs);
    $deadline = microtime(true) + ($timeoutMs / 1000);

    do {
        if (flock($fp, LOCK_EX | LOCK_NB)) {
            return true;
        }
        usleep(STORE_LOCK_RETRY_DELAY_US);
    } while (microtime(true) < $deadline);

    return false;
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

function get_client_ip(): string
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

    // Cloudflare
    if (isset($_SERVER['HTTP_CF_CONNECTING_IP']) && filter_var($_SERVER['HTTP_CF_CONNECTING_IP'], FILTER_VALIDATE_IP)) {
        return $_SERVER['HTTP_CF_CONNECTING_IP'];
    }

    // X-Forwarded-For
    if (isset($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $forwarded = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        $first = trim($forwarded[0]);
        if (filter_var($first, FILTER_VALIDATE_IP)) {
            return $first;
        }
    }

    // Client-IP
    if (isset($_SERVER['HTTP_CLIENT_IP']) && filter_var($_SERVER['HTTP_CLIENT_IP'], FILTER_VALIDATE_IP)) {
        return $_SERVER['HTTP_CLIENT_IP'];
    }

    return $ip;
}

function check_rate_limit(string $action, int $maxRequests = 10, int $windowSeconds = 60): bool
{
    $ip = get_client_ip();
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

    // Limpieza periódica: eliminar archivos de rate limit con más de 1 hora sin modificación
    if (mt_rand(1, 50) === 1) {
        $allFiles = @glob($rateDir . DIRECTORY_SEPARATOR . '*.json');
        if (is_array($allFiles)) {
            foreach ($allFiles as $f) {
                if (($now - (int) @filemtime($f)) > 3600) {
                    @unlink($f);
                }
            }
        }
    }

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

function truncate_field(string $value, int $maxLength): string
{
    return mb_strlen($value) > $maxLength ? mb_substr($value, 0, $maxLength) : $value;
}

function normalize_string_list(mixed $value, int $maxItems = 5, int $maxLength = 300): array
{
    if (!is_array($value)) {
        return [];
    }

    $result = [];
    foreach ($value as $item) {
        if (!is_scalar($item)) {
            continue;
        }

        $text = truncate_field(trim((string) $item), $maxLength);
        if ($text === '') {
            continue;
        }

        $result[] = $text;
        if (count($result) >= $maxItems) {
            break;
        }
    }

    return $result;
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
        'name' => truncate_field(isset($review['name']) ? trim((string) $review['name']) : '', 100),
        'rating' => $rating,
        'text' => truncate_field(isset($review['text']) ? trim((string) $review['text']) : '', 2000),
        'date' => isset($review['date']) ? (string) $review['date'] : local_date('c'),
        'verified' => isset($review['verified']) ? parse_bool($review['verified']) : true
    ];
}

function normalize_callback(array $callback): array
{
    return [
        'id' => isset($callback['id']) ? (int) $callback['id'] : (int) round(microtime(true) * 1000),
        'telefono' => truncate_field(sanitize_phone((string) ($callback['telefono'] ?? '')), 20),
        'preferencia' => truncate_field((string) ($callback['preferencia'] ?? ''), 200),
        'fecha' => isset($callback['fecha']) ? (string) $callback['fecha'] : local_date('c'),
        'status' => map_callback_status((string) ($callback['status'] ?? 'pendiente'))
    ];
}

function get_vat_rate(): float
{
    $raw = getenv('PIELARMONIA_VAT_RATE');
    if (!is_string($raw) || trim($raw) === '') {
        return 0.12;
    }

    $rate = (float) trim($raw);
    if ($rate > 1.0 && $rate <= 100.0) {
        $rate = $rate / 100.0;
    }

    if ($rate < 0.0) {
        return 0.0;
    }
    if ($rate > 1.0) {
        return 1.0;
    }
    return $rate;
}

function get_service_price_amount(string $service): float
{
    $prices = [
        'consulta' => 40.00,
        'telefono' => 25.00,
        'video' => 30.00,
        'laser' => 150.00,
        'rejuvenecimiento' => 120.00
    ];
    return isset($prices[$service]) ? (float) $prices[$service] : 0.0;
}

function get_service_price(string $service): string
{
    return '$' . number_format(get_service_price_amount($service), 2, '.', '');
}

function get_service_total_price(string $service): string
{
    $subtotal = get_service_price_amount($service);
    $total = $subtotal + ($subtotal * get_vat_rate());
    return '$' . number_format($total, 2, '.', '');
}

function normalize_appointment(array $appointment): array
{
    $service = (string) ($appointment['service'] ?? '');
    $paymentMethod = strtolower(trim((string) ($appointment['paymentMethod'] ?? 'unpaid')));
    if (!in_array($paymentMethod, ['card', 'transfer', 'cash', 'unpaid'], true)) {
        $paymentMethod = 'unpaid';
    }

    $paymentStatus = trim((string) ($appointment['paymentStatus'] ?? 'pending'));
    if ($paymentStatus === '') {
        $paymentStatus = 'pending';
    }

    $privacyConsent = isset($appointment['privacyConsent']) ? parse_bool($appointment['privacyConsent']) : false;
    $privacyConsentAtDefault = $privacyConsent ? local_date('c') : '';
    $casePhotoNames = normalize_string_list($appointment['casePhotoNames'] ?? [], 3, 200);
    $casePhotoUrls = normalize_string_list($appointment['casePhotoUrls'] ?? [], 3, 500);
    $casePhotoPaths = normalize_string_list($appointment['casePhotoPaths'] ?? [], 3, 500);
    $casePhotoCount = isset($appointment['casePhotoCount']) ? (int) $appointment['casePhotoCount'] : count($casePhotoUrls);
    if ($casePhotoCount < 0) {
        $casePhotoCount = 0;
    }
    if ($casePhotoCount > 3) {
        $casePhotoCount = 3;
    }

    return [
        'id' => isset($appointment['id']) ? (int) $appointment['id'] : (int) round(microtime(true) * 1000),
        'service' => truncate_field($service, 50),
        'doctor' => truncate_field((string) ($appointment['doctor'] ?? ''), 100),
        'date' => truncate_field((string) ($appointment['date'] ?? ''), 20),
        'time' => truncate_field((string) ($appointment['time'] ?? ''), 10),
        'name' => truncate_field(trim((string) ($appointment['name'] ?? '')), 150),
        'email' => truncate_field(trim((string) ($appointment['email'] ?? '')), 254),
        'phone' => truncate_field(sanitize_phone((string) ($appointment['phone'] ?? '')), 20),
        'reason' => truncate_field(trim((string) ($appointment['reason'] ?? '')), 1000),
        'affectedArea' => truncate_field(trim((string) ($appointment['affectedArea'] ?? '')), 100),
        'evolutionTime' => truncate_field(trim((string) ($appointment['evolutionTime'] ?? '')), 100),
        'privacyConsent' => $privacyConsent,
        'privacyConsentAt' => truncate_field(trim((string) ($appointment['privacyConsentAt'] ?? $privacyConsentAtDefault)), 30),
        'casePhotoCount' => $casePhotoCount,
        'casePhotoNames' => $casePhotoNames,
        'casePhotoUrls' => $casePhotoUrls,
        'casePhotoPaths' => $casePhotoPaths,
        'price' => get_service_total_price($service),
        'status' => map_appointment_status((string) ($appointment['status'] ?? 'confirmed')),
        'paymentMethod' => $paymentMethod,
        'paymentStatus' => $paymentStatus,
        'paymentProvider' => truncate_field(trim((string) ($appointment['paymentProvider'] ?? '')), 50),
        'paymentIntentId' => truncate_field(trim((string) ($appointment['paymentIntentId'] ?? '')), 100),
        'paymentPaidAt' => truncate_field(trim((string) ($appointment['paymentPaidAt'] ?? '')), 30),
        'transferReference' => truncate_field(trim((string) ($appointment['transferReference'] ?? '')), 100),
        'transferProofPath' => truncate_field(trim((string) ($appointment['transferProofPath'] ?? '')), 300),
        'transferProofUrl' => truncate_field(trim((string) ($appointment['transferProofUrl'] ?? '')), 300),
        'transferProofName' => truncate_field(trim((string) ($appointment['transferProofName'] ?? '')), 200),
        'transferProofMime' => truncate_field(trim((string) ($appointment['transferProofMime'] ?? '')), 50),
        'dateBooked' => isset($appointment['dateBooked']) ? (string) $appointment['dateBooked'] : local_date('c'),
        'rescheduleToken' => isset($appointment['rescheduleToken']) && $appointment['rescheduleToken'] !== ''
            ? (string) $appointment['rescheduleToken']
            : bin2hex(random_bytes(16)),
        'reminderSentAt' => truncate_field(trim((string) ($appointment['reminderSentAt'] ?? '')), 30)
    ];
}

function appointment_slot_taken(array $appointments, string $date, string $time, ?int $excludeId = null, string $doctor = ''): bool
{
    foreach ($appointments as $appt) {
        $id = isset($appt['id']) ? (int) $appt['id'] : null;
        if ($excludeId !== null && $id === $excludeId) {
            continue;
        }
        $status = map_appointment_status((string) ($appt['status'] ?? 'confirmed'));
        if ($status === 'cancelled') {
            continue;
        }
        if ((string) ($appt['date'] ?? '') !== $date || (string) ($appt['time'] ?? '') !== $time) {
            continue;
        }
        if ($doctor !== '' && $doctor !== 'indiferente') {
            $apptDoctor = (string) ($appt['doctor'] ?? '');
            if ($apptDoctor !== '' && $apptDoctor !== 'indiferente' && $apptDoctor !== $doctor) {
                continue;
            }
        }
        return true;
    }
    return false;
}

// ========================================
// SMTP EMAIL
// ========================================

function smtp_config(): array
{
    return [
        'host' => (string) (getenv('PIELARMONIA_SMTP_HOST') ?: 'smtp.gmail.com'),
        'port' => (int) (getenv('PIELARMONIA_SMTP_PORT') ?: 587),
        'user' => (string) (getenv('PIELARMONIA_SMTP_USER') ?: ''),
        'pass' => (string) (getenv('PIELARMONIA_SMTP_PASS') ?: ''),
        'from' => (string) (getenv('PIELARMONIA_EMAIL_FROM') ?: ''),
        'from_name' => 'Piel en Armonía',
    ];
}

function smtp_enabled(): bool
{
    $cfg = smtp_config();
    return $cfg['user'] !== '' && $cfg['pass'] !== '';
}

/**
 * Envía email vía SMTP con autenticación STARTTLS.
 * Compatible con Gmail y cualquier servidor SMTP estándar.
 */
function smtp_send_mail(string $to, string $subject, string $body): bool
{
    $cfg = smtp_config();

    if ($cfg['user'] === '' || $cfg['pass'] === '') {
        error_log('Piel en Armonía: SMTP no configurado (PIELARMONIA_SMTP_USER / PIELARMONIA_SMTP_PASS)');
        return false;
    }

    $from = $cfg['from'] !== '' ? $cfg['from'] : $cfg['user'];
    $fromName = $cfg['from_name'];

    $socket = @fsockopen($cfg['host'], $cfg['port'], $errno, $errstr, 10);
    if (!$socket) {
        error_log("Piel en Armonía SMTP: no se pudo conectar a {$cfg['host']}:{$cfg['port']} - {$errstr}");
        return false;
    }
    stream_set_timeout($socket, 15);

    $log = [];

    $readLine = static function () use ($socket, &$log): string {
        $response = '';
        while (($line = fgets($socket, 512)) !== false) {
            $response .= $line;
            if (isset($line[3]) && $line[3] === ' ') {
                break;
            }
        }
        $log[] = 'S: ' . trim($response);
        return $response;
    };

    $sendCmd = static function (string $cmd) use ($socket, $readLine, &$log): string {
        $log[] = 'C: ' . trim($cmd);
        fwrite($socket, $cmd . "\r\n");
        return $readLine();
    };

    try {
        // Greeting
        $greeting = $readLine();
        if (strpos($greeting, '220') !== 0) {
            error_log('Piel en Armonía SMTP: saludo inesperado: ' . trim($greeting));
            fclose($socket);
            return false;
        }

        // EHLO
        $sendCmd('EHLO pielarmonia.com');

        // STARTTLS
        $tlsResp = $sendCmd('STARTTLS');
        if (strpos($tlsResp, '220') !== 0) {
            error_log('Piel en Armonía SMTP: STARTTLS falló: ' . trim($tlsResp));
            fclose($socket);
            return false;
        }

        $cryptoOk = stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT);
        if (!$cryptoOk) {
            error_log('Piel en Armonía SMTP: fallo al habilitar TLS');
            fclose($socket);
            return false;
        }

        // Re-EHLO after TLS
        $sendCmd('EHLO pielarmonia.com');

        // AUTH LOGIN
        $authResp = $sendCmd('AUTH LOGIN');
        if (strpos($authResp, '334') !== 0) {
            error_log('Piel en Armonía SMTP: AUTH LOGIN no aceptado: ' . trim($authResp));
            fclose($socket);
            return false;
        }

        $userResp = $sendCmd(base64_encode($cfg['user']));
        if (strpos($userResp, '334') !== 0) {
            error_log('Piel en Armonía SMTP: usuario rechazado');
            fclose($socket);
            return false;
        }

        $passResp = $sendCmd(base64_encode($cfg['pass']));
        if (strpos($passResp, '235') !== 0) {
            error_log('Piel en Armonía SMTP: autenticación falló - verifica contraseña de aplicación');
            fclose($socket);
            return false;
        }

        // MAIL FROM
        $fromResp = $sendCmd("MAIL FROM:<{$from}>");
        if (strpos($fromResp, '250') !== 0) {
            error_log('Piel en Armonía SMTP: MAIL FROM rechazado: ' . trim($fromResp));
            fclose($socket);
            return false;
        }

        // RCPT TO
        $rcptResp = $sendCmd("RCPT TO:<{$to}>");
        if (strpos($rcptResp, '250') !== 0) {
            error_log('Piel en Armonía SMTP: RCPT TO rechazado: ' . trim($rcptResp));
            fclose($socket);
            return false;
        }

        // DATA
        $dataResp = $sendCmd('DATA');
        if (strpos($dataResp, '354') !== 0) {
            error_log('Piel en Armonía SMTP: DATA rechazado: ' . trim($dataResp));
            fclose($socket);
            return false;
        }

        // Construir mensaje
        $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
        $encodedFrom = '=?UTF-8?B?' . base64_encode($fromName) . '?= <' . $from . '>';
        $messageId = '<' . bin2hex(random_bytes(16)) . '@pielarmonia.com>';

        $headers = "From: {$encodedFrom}\r\n";
        $headers .= "To: {$to}\r\n";
        $headers .= "Subject: {$encodedSubject}\r\n";
        $headers .= "MIME-Version: 1.0\r\n";
        $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
        $headers .= "Content-Transfer-Encoding: base64\r\n";
        $headers .= "Message-ID: {$messageId}\r\n";
        $headers .= "Date: " . date('r') . "\r\n";

        $encodedBody = chunk_split(base64_encode($body), 76, "\r\n");
        $fullMessage = $headers . "\r\n" . $encodedBody . "\r\n.";

        $endResp = $sendCmd($fullMessage);
        if (strpos($endResp, '250') !== 0) {
            error_log('Piel en Armonía SMTP: mensaje no aceptado: ' . trim($endResp));
            fclose($socket);
            return false;
        }

        $sendCmd('QUIT');
        fclose($socket);
        return true;

    } catch (Throwable $e) {
        error_log('Piel en Armonía SMTP: excepción - ' . $e->getMessage());
        @fclose($socket);
        return false;
    }
}

/**
 * Envía email usando SMTP si está configurado, o mail() como fallback.
 */
function send_mail(string $to, string $subject, string $body): bool
{
    if (smtp_enabled()) {
        return smtp_send_mail($to, $subject, $body);
    }

    // Fallback a mail() nativo
    $from = getenv('PIELARMONIA_EMAIL_FROM');
    if (!is_string($from) || $from === '') {
        $from = 'no-reply@pielarmonia.com';
    }
    $headers = "From: Piel en Armonía <{$from}>\r\nContent-Type: text/plain; charset=UTF-8";

    $sent = @mail($to, $subject, $body, $headers);
    if (!$sent) {
        error_log('Piel en Armonía: fallo al enviar email (mail nativo) a ' . $to);
    }
    return $sent;
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

    $token = $appointment['rescheduleToken'] ?? '';
    if ($token !== '') {
        $message .= "Si necesitas reprogramar tu cita, usa este enlace:\n";
        $message .= "https://pielarmonia.com/?reschedule=" . $token . "\n\n";
    }

    $message .= "Gracias por confiar en nosotros.";

    return send_mail($to, $subject, $message);
}

function maybe_send_admin_notification(array $appointment): bool
{
    $adminEmail = getenv('PIELARMONIA_ADMIN_EMAIL');
    if (!is_string($adminEmail) || trim($adminEmail) === '') {
        $adminEmail = 'javier.rosero94@gmail.com';
    }
    $adminEmail = trim((string) $adminEmail);
    if (!filter_var($adminEmail, FILTER_VALIDATE_EMAIL)) {
        error_log('Piel en Armonía: PIELARMONIA_ADMIN_EMAIL invalido');
        return false;
    }

    $clinicName = 'Piel en Armonía';
    $subject = 'Nueva cita agendada - ' . $clinicName;
    $body = "Se ha agendado una nueva cita:\n\n";
    $body .= "Paciente: " . ($appointment['name'] ?? '-') . "\n";
    $body .= "Email: " . ($appointment['email'] ?? '-') . "\n";
    $body .= "Telefono: " . ($appointment['phone'] ?? '-') . "\n";
    $body .= "Motivo: " . ($appointment['reason'] ?? '-') . "\n";
    $body .= "Zona: " . ($appointment['affectedArea'] ?? '-') . "\n";
    $body .= "Evolucion: " . ($appointment['evolutionTime'] ?? '-') . "\n";
    $body .= "Consentimiento datos: " . ((isset($appointment['privacyConsent']) && $appointment['privacyConsent']) ? 'si' : 'no') . "\n";
    $body .= "Servicio: " . ($appointment['service'] ?? '-') . "\n";
    $body .= "Doctor: " . ($appointment['doctor'] ?? '-') . "\n";
    $body .= "Fecha: " . ($appointment['date'] ?? '-') . "\n";
    $body .= "Hora: " . ($appointment['time'] ?? '-') . "\n";
    $body .= "Precio: " . ($appointment['price'] ?? '-') . "\n";
    $body .= "Metodo de pago: " . ($appointment['paymentMethod'] ?? '-') . "\n";
    $body .= "Estado de pago: " . ($appointment['paymentStatus'] ?? '-') . "\n";
    $body .= "Fotos adjuntas: " . (int) ($appointment['casePhotoCount'] ?? 0) . "\n";
    if (isset($appointment['casePhotoUrls']) && is_array($appointment['casePhotoUrls']) && count($appointment['casePhotoUrls']) > 0) {
        $body .= "URLs de fotos:\n";
        foreach ($appointment['casePhotoUrls'] as $photoUrl) {
            $url = trim((string) $photoUrl);
            if ($url !== '') {
                $body .= "- " . $url . "\n";
            }
        }
    }
    $body .= "\nFecha de registro: " . local_date('d/m/Y H:i') . "\n";

    return send_mail($adminEmail, $subject, $body);
}

function maybe_send_cancellation_email(array $appointment): bool
{
    $to = trim((string) ($appointment['email'] ?? ''));
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $clinicName = 'Piel en Armonía';
    $subject = 'Cita cancelada - ' . $clinicName;
    $message = "Hola " . ($appointment['name'] ?? 'paciente') . ",\n\n";
    $message .= "Tu cita ha sido cancelada.\n\n";
    $message .= "Detalles de la cita cancelada:\n";
    $message .= "Servicio: " . ($appointment['service'] ?? '-') . "\n";
    $message .= "Doctor: " . ($appointment['doctor'] ?? '-') . "\n";
    $message .= "Fecha: " . ($appointment['date'] ?? '-') . "\n";
    $message .= "Hora: " . ($appointment['time'] ?? '-') . "\n\n";
    $message .= "Si deseas reprogramar, visita https://pielarmonia.com/#citas o escribenos por WhatsApp: +593 98 245 3672.\n\n";
    $message .= "Gracias por confiar en nosotros.";

    return send_mail($to, $subject, $message);
}

function maybe_send_callback_admin_notification(array $callback): bool
{
    $adminEmail = getenv('PIELARMONIA_ADMIN_EMAIL');
    if (!is_string($adminEmail) || $adminEmail === '') {
        return false;
    }
    if (!filter_var($adminEmail, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $clinicName = 'Piel en Armonía';
    $subject = 'Nueva solicitud de llamada - ' . $clinicName;
    $body = "Un paciente solicita que le llamen:\n\n";
    $body .= "Teléfono: " . ($callback['telefono'] ?? '-') . "\n";
    $body .= "Preferencia: " . ($callback['preferencia'] ?? '-') . "\n";
    $body .= "Fecha de solicitud: " . local_date('d/m/Y H:i') . "\n\n";
    $body .= "Por favor contactar lo antes posible.";

    return send_mail($adminEmail, $subject, $body);
}

function maybe_send_reminder_email(array $appointment): bool
{
    $to = trim((string) ($appointment['email'] ?? ''));
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $clinicName = 'Piel en Armonía';
    $subject = 'Recordatorio de cita - ' . $clinicName;
    $body = "Hola " . ($appointment['name'] ?? 'paciente') . ",\n\n";
    $body .= "Te recordamos que tienes una cita programada para mañana.\n\n";
    $body .= "Servicio: " . ($appointment['service'] ?? '-') . "\n";
    $body .= "Doctor: " . ($appointment['doctor'] ?? '-') . "\n";
    $body .= "Fecha: " . ($appointment['date'] ?? '-') . "\n";
    $body .= "Hora: " . ($appointment['time'] ?? '-') . "\n\n";

    $token = $appointment['rescheduleToken'] ?? '';
    if ($token !== '') {
        $body .= "Si necesitas reprogramar, usa este enlace:\n";
        $body .= "https://pielarmonia.com/?reschedule=" . $token . "\n\n";
    }

    $body .= "Te esperamos. ¡Gracias por confiar en nosotros!\n";
    $body .= "- Equipo Piel en Armonía\n";
    $body .= "WhatsApp: +593 98 245 3672";

    return send_mail($to, $subject, $body);
}

function maybe_send_reschedule_email(array $appointment): bool
{
    $to = trim((string) ($appointment['email'] ?? ''));
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $clinicName = 'Piel en Armonía';
    $subject = 'Cita reprogramada - ' . $clinicName;
    $body = "Hola " . ($appointment['name'] ?? 'paciente') . ",\n\n";
    $body .= "Tu cita ha sido reprogramada exitosamente.\n\n";
    $body .= "Servicio: " . ($appointment['service'] ?? '-') . "\n";
    $body .= "Doctor: " . ($appointment['doctor'] ?? '-') . "\n";
    $body .= "Nueva fecha: " . ($appointment['date'] ?? '-') . "\n";
    $body .= "Nueva hora: " . ($appointment['time'] ?? '-') . "\n\n";

    $token = $appointment['rescheduleToken'] ?? '';
    if ($token !== '') {
        $body .= "Si necesitas reprogramar de nuevo:\n";
        $body .= "https://pielarmonia.com/?reschedule=" . $token . "\n\n";
    }

    $body .= "Te esperamos. ¡Gracias por confiar en nosotros!\n";
    $body .= "- Equipo Piel en Armonía";

    return send_mail($to, $subject, $body);
}
