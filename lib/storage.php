<?php
declare(strict_types=1);

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/business.php';

/**
 * Storage and file system operations.
 */

if (!defined('DATA_DIR')) {
    define('DATA_DIR', __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'data');
}
if (!defined('DATA_FILE')) {
    define('DATA_FILE', DATA_DIR . DIRECTORY_SEPARATOR . 'store.json');
}
if (!defined('BACKUP_DIR')) {
    define('BACKUP_DIR', DATA_DIR . DIRECTORY_SEPARATOR . 'backups');
}
if (!defined('MAX_STORE_BACKUPS')) {
    define('MAX_STORE_BACKUPS', 30);
}
if (!defined('STORE_LOCK_TIMEOUT_MS')) {
    define('STORE_LOCK_TIMEOUT_MS', 1800);
}
if (!defined('STORE_LOCK_RETRY_DELAY_US')) {
    define('STORE_LOCK_RETRY_DELAY_US', 25000);
}

function resolve_data_dir(): array
{
    static $resolved = null;
    if (is_array($resolved) && isset($resolved['path'], $resolved['source'])) {
        return $resolved;
    }

    $candidates = [];

    $envDir = getenv('PIELARMONIA_DATA_DIR');
    if (is_string($envDir) && trim($envDir) !== '') {
        $candidates[] = [
            'source' => 'env',
            'path' => trim($envDir)
        ];
    }

    $candidates[] = [
        'source' => 'project',
        'path' => DATA_DIR
    ];
    $candidates[] = [
        'source' => 'parent',
        'path' => dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'data'
    ];
    $candidates[] = [
        'source' => 'tmp',
        'path' => sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pielarmonia-data'
    ];

    foreach ($candidates as $candidate) {
        $path = rtrim(str_replace(['/', '\\'], DIRECTORY_SEPARATOR, (string) ($candidate['path'] ?? '')), DIRECTORY_SEPARATOR);
        $source = (string) ($candidate['source'] ?? 'unknown');
        if ($path === '') {
            continue;
        }

        if (!@is_dir($path)) {
            if (!@mkdir($path, 0775, true) && !@is_dir($path)) {
                continue;
            }
        }

        if (@is_writable($path)) {
            $resolved = [
                'path' => $path,
                'source' => $source
            ];
            return $resolved;
        }
    }

    $resolved = [
        'path' => DATA_DIR,
        'source' => 'fallback'
    ];
    return $resolved;
}

function data_dir_path(): string
{
    $resolved = resolve_data_dir();
    return (string) ($resolved['path'] ?? DATA_DIR);
}

function data_dir_source(): string
{
    $resolved = resolve_data_dir();
    return (string) ($resolved['source'] ?? 'unknown');
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
            // Esto solo se puede mostrar si json_response está disponible, pero lib/storage.php no depende de http.php.
            // Asi que hacemos un error log y retornamos array vacio, o lanzamos excepcion.
            // api-lib.php hacia json_response... que es un side effect.
            // Lo mejor es hacer error log y retornar vacio, o die.
            // Para compatibilidad:
            error_log('Piel en Armonía: No se pudo descifrar la base de datos. Verifica PIELARMONIA_DATA_ENCRYPTION_KEY');
             // Si el llamador espera respuesta json, deberiamos lanzar excepcion?
             // api-lib.php hacia: json_response(['ok'=>false, ...], 500);
             // Si yo hago require_once 'http.php' aqui seria circular dependency? No.
             // Pero storage no deberia saber de HTTP.
             // Voy a dejarlo como retorno de array vacio y log, pero si el store esta corrupto/encriptado mal, la app no funcionara bien.
             // El caller (api.php) podria manejarlo.
             // O puedo requerir http.php aqui y usar json_response para mantener el comportamiento exacto de api-lib.php.
             if (function_exists('json_response')) {
                 json_response([
                    'ok' => false,
                    'error' => 'No se pudo descifrar la base de datos. Verifica PIELARMONIA_DATA_ENCRYPTION_KEY'
                ], 500);
             }
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

    if (!isset($data['idx_appointments_date']) || !is_array($data['idx_appointments_date'])) {
        $data['idx_appointments_date'] = build_appointment_index($data['appointments']);
    }

    return $data;
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

function write_store(array $store): void
{
    if (!ensure_data_file()) {
        if (function_exists('json_response')) {
            json_response([
                'ok' => false,
                'error' => 'No hay permisos de escritura para los datos',
                'path' => data_file_path()
            ], 500);
        } else {
             error_log('No hay permisos de escritura para los datos: ' . data_file_path());
             return;
        }
    }

    $store['appointments'] = isset($store['appointments']) && is_array($store['appointments']) ? $store['appointments'] : [];
    $store['callbacks'] = isset($store['callbacks']) && is_array($store['callbacks']) ? $store['callbacks'] : [];
    $store['reviews'] = isset($store['reviews']) && is_array($store['reviews']) ? $store['reviews'] : [];
    $store['availability'] = isset($store['availability']) && is_array($store['availability']) ? $store['availability'] : [];
    $store['updatedAt'] = local_date('c');

    // Rebuild index before saving to ensure consistency
    $store['idx_appointments_date'] = build_appointment_index($store['appointments']);

    $fp = @fopen(data_file_path(), 'c+');
    if ($fp === false) {
        if (function_exists('json_response')) {
            json_response([
                'ok' => false,
                'error' => 'No se pudo abrir el archivo de datos'
            ], 500);
        } else {
            error_log('No se pudo abrir el archivo de datos');
            return;
        }
    }

    $lockAcquired = false;
    try {
        $lockTimeoutMs = STORE_LOCK_TIMEOUT_MS;
        if (!acquire_store_lock($fp, $lockTimeoutMs)) {
            header('Retry-After: 1');
            if (function_exists('json_response')) {
                json_response([
                    'ok' => false,
                    'error' => 'El sistema esta ocupado. Intenta nuevamente en unos segundos',
                    'retryAfterMs' => $lockTimeoutMs
                ], 503);
            } else {
                error_log('El sistema esta ocupado (lock timeout)');
                return;
            }
        }
        $lockAcquired = true;

        // Backup del estado anterior antes de sobrescribir.
        create_store_backup_locked($fp);

        ftruncate($fp, 0);
        rewind($fp);
        $encoded = json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $payloadToWrite = is_string($encoded) ? data_encrypt_payload($encoded) : '';
        if ($payloadToWrite === '' || fwrite($fp, $payloadToWrite) === false) {
             if (function_exists('json_response')) {
                json_response([
                    'ok' => false,
                    'error' => 'No se pudo guardar la información'
                ], 500);
            } else {
                error_log('No se pudo guardar la informacion (fwrite failed)');
            }
        }
        fflush($fp);
    } finally {
        if ($lockAcquired) {
            flock($fp, LOCK_UN);
        }
        fclose($fp);
    }
}
