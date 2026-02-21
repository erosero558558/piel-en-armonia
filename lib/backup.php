<?php

declare(strict_types=1);

/**
 * Backup and recovery helpers.
 * - Health checks for rotating backups
 * - Snapshot export for offsite replication
 * - Optional upload to external endpoint
 */

if (!defined('BACKUP_HEALTH_DEFAULT_MAX_AGE_HOURS')) {
    define('BACKUP_HEALTH_DEFAULT_MAX_AGE_HOURS', 24);
}

if (!defined('BACKUP_OFFSITE_TIMEOUT_SECONDS')) {
    define('BACKUP_OFFSITE_TIMEOUT_SECONDS', 20);
}

if (!defined('BACKUP_OFFSITE_MIN_TIMEOUT_SECONDS')) {
    define('BACKUP_OFFSITE_MIN_TIMEOUT_SECONDS', 5);
}

if (!defined('BACKUP_OFFSITE_MAX_TIMEOUT_SECONDS')) {
    define('BACKUP_OFFSITE_MAX_TIMEOUT_SECONDS', 120);
}

if (!defined('BACKUP_LOCAL_REPLICA_DIRNAME')) {
    define('BACKUP_LOCAL_REPLICA_DIRNAME', 'offsite-local');
}

function backup_health_max_age_hours(): int
{
    $raw = getenv('PIELARMONIA_BACKUP_MAX_AGE_HOURS');
    $hours = is_string($raw) && trim($raw) !== '' ? (int) trim($raw) : BACKUP_HEALTH_DEFAULT_MAX_AGE_HOURS;
    if ($hours < 1) {
        $hours = 1;
    }
    if ($hours > 168) {
        $hours = 168;
    }
    return $hours;
}

function backup_offsite_timeout_seconds(): int
{
    $raw = getenv('PIELARMONIA_BACKUP_OFFSITE_TIMEOUT_SECONDS');
    $seconds = is_string($raw) && trim($raw) !== '' ? (int) trim($raw) : BACKUP_OFFSITE_TIMEOUT_SECONDS;
    if ($seconds < BACKUP_OFFSITE_MIN_TIMEOUT_SECONDS) {
        $seconds = BACKUP_OFFSITE_MIN_TIMEOUT_SECONDS;
    }
    if ($seconds > BACKUP_OFFSITE_MAX_TIMEOUT_SECONDS) {
        $seconds = BACKUP_OFFSITE_MAX_TIMEOUT_SECONDS;
    }
    return $seconds;
}

function backup_first_non_empty_string(array $values): string
{
    foreach ($values as $value) {
        if (is_string($value) && trim($value) !== '') {
            return trim($value);
        }
    }
    return '';
}

function backup_offsite_target_url(): string
{
    return backup_first_non_empty_string([
        getenv('PIELARMONIA_BACKUP_OFFSITE_URL'),
        getenv('PIELARMONIA_BACKUP_WEBHOOK_URL')
    ]);
}

function backup_local_replica_enabled(): bool
{
    $raw = getenv('PIELARMONIA_BACKUP_LOCAL_REPLICA');
    if (!is_string($raw) || trim($raw) === '') {
        // Enabled by default to keep backup replication active even without remote endpoint.
        return true;
    }
    return parse_bool($raw);
}

function backup_local_replica_dir(): string
{
    return backup_dir_path() . DIRECTORY_SEPARATOR . BACKUP_LOCAL_REPLICA_DIRNAME;
}

function backup_replica_mode(): string
{
    if (backup_offsite_target_url() !== '') {
        return 'remote';
    }
    if (backup_local_replica_enabled()) {
        return 'local';
    }
    return 'none';
}

function backup_offsite_token(): string
{
    return backup_first_non_empty_string([
        getenv('PIELARMONIA_BACKUP_OFFSITE_TOKEN'),
        getenv('PIELARMONIA_BACKUP_WEBHOOK_TOKEN')
    ]);
}

function backup_offsite_token_header(): string
{
    $header = backup_first_non_empty_string([
        getenv('PIELARMONIA_BACKUP_OFFSITE_TOKEN_HEADER'),
        getenv('PIELARMONIA_BACKUP_WEBHOOK_TOKEN_HEADER')
    ]);

    return $header !== '' ? $header : 'Authorization';
}

function backup_offsite_configured(): bool
{
    return backup_replica_mode() !== 'none';
}

function backup_auto_refresh_enabled(): bool
{
    $raw = getenv('PIELARMONIA_BACKUP_AUTO_REFRESH');
    if (!is_string($raw) || trim($raw) === '') {
        // Enabled by default to avoid stale health checks when no writes occur.
        return true;
    }
    return parse_bool($raw);
}

function backup_auto_refresh_interval_seconds(): int
{
    $raw = getenv('PIELARMONIA_BACKUP_AUTO_REFRESH_INTERVAL_SECONDS');
    $seconds = is_string($raw) && trim($raw) !== '' ? (int) trim($raw) : 21600;
    if ($seconds < 300) {
        $seconds = 300;
    }
    if ($seconds > 604800) {
        $seconds = 604800;
    }
    return $seconds;
}

function backup_auto_refresh_marker_path(): string
{
    return backup_dir_path() . DIRECTORY_SEPARATOR . 'backup-auto-refresh.marker';
}

function backup_auto_refresh_last_attempt_age_seconds(): ?int
{
    $marker = backup_auto_refresh_marker_path();
    if (!is_file($marker)) {
        return null;
    }

    $mtime = @filemtime($marker);
    if (!is_int($mtime) || $mtime <= 0) {
        return null;
    }

    return max(0, time() - $mtime);
}

function backup_auto_refresh_touch_marker(): void
{
    if (!ensure_backup_dir()) {
        return;
    }

    $marker = backup_auto_refresh_marker_path();
    @touch($marker);
}

function backup_auto_refresh_try_create(): array
{
    $cooldownSeconds = backup_auto_refresh_interval_seconds();
    $lastAttemptAge = backup_auto_refresh_last_attempt_age_seconds();

    $result = [
        'ok' => false,
        'attempted' => false,
        'created' => false,
        'reason' => '',
        'cooldownSeconds' => $cooldownSeconds,
        'lastAttemptAgeSeconds' => $lastAttemptAge,
        'file' => ''
    ];

    if (!backup_auto_refresh_enabled()) {
        $result['reason'] = 'auto_refresh_disabled';
        return $result;
    }

    if (!function_exists('ensure_data_file') || !function_exists('create_store_backup_locked')) {
        $result['reason'] = 'storage_helpers_unavailable';
        return $result;
    }

    if (!ensure_backup_dir()) {
        $result['reason'] = 'backup_dir_not_ready';
        return $result;
    }

    if ($lastAttemptAge !== null && $lastAttemptAge < $cooldownSeconds) {
        $result['reason'] = 'cooldown_active';
        return $result;
    }

    $result['attempted'] = true;
    backup_auto_refresh_touch_marker();

    if (!ensure_data_file()) {
        $result['reason'] = 'store_not_ready';
        return $result;
    }

    $storeCandidates = [];
    if (function_exists('data_file_path')) {
        $storeCandidates[] = (string) data_file_path();
    }
    if (function_exists('data_json_path')) {
        $storeCandidates[] = (string) data_json_path();
    }

    $storePath = '';
    foreach ($storeCandidates as $candidate) {
        if (!is_string($candidate) || trim($candidate) === '') {
            continue;
        }
        if (is_file($candidate) && is_readable($candidate)) {
            $storePath = $candidate;
            break;
        }
    }

    if ($storePath === '') {
        $result['reason'] = 'store_file_missing';
        return $result;
    }

    $before = backup_list_files(1);
    $beforeLatest = count($before) > 0 ? basename((string) $before[0]) : '';

    create_store_backup_locked($storePath);

    $after = backup_list_files(1);
    if (count($after) === 0) {
        $result['reason'] = 'refresh_no_backup_created';
        return $result;
    }

    $afterLatest = basename((string) $after[0]);
    $result['ok'] = true;
    $result['created'] = $afterLatest !== '' && $afterLatest !== $beforeLatest;
    $result['file'] = $afterLatest;
    $result['reason'] = $result['created'] ? '' : 'refresh_not_detected';

    return $result;
}

function backup_create_initial_seed_if_missing(): array
{
    $result = [
        'ok' => false,
        'created' => false,
        'reason' => '',
        'file' => '',
        'path' => ''
    ];

    $existing = backup_list_files(1);
    if (count($existing) > 0) {
        $result['ok'] = true;
        $result['reason'] = 'already_exists';
        $result['file'] = basename((string) $existing[0]);
        $result['path'] = (string) $existing[0];
        return $result;
    }

    if (!function_exists('ensure_data_file') || !function_exists('create_store_backup_locked')) {
        $result['reason'] = 'storage_helpers_unavailable';
        return $result;
    }

    if (!ensure_data_file()) {
        $result['reason'] = 'store_not_ready';
        return $result;
    }

    $storePathCandidates = [];
    if (function_exists('data_file_path')) {
        $storePathCandidates[] = (string) data_file_path();
    }
    if (function_exists('data_json_path')) {
        $storePathCandidates[] = (string) data_json_path();
    }

    $storePath = '';
    foreach ($storePathCandidates as $candidatePath) {
        if (!is_string($candidatePath) || trim($candidatePath) === '') {
            continue;
        }
        if (is_file($candidatePath) && is_readable($candidatePath)) {
            $storePath = $candidatePath;
            break;
        }
    }
    if ($storePath === '') {
        $result['reason'] = 'store_file_missing';
        return $result;
    }

    if (!ensure_backup_dir()) {
        $result['reason'] = 'backup_dir_not_ready';
        return $result;
    }

    create_store_backup_locked($storePath);
    $after = backup_list_files(1);
    if (count($after) === 0) {
        $result['reason'] = 'seed_copy_failed';
        return $result;
    }

    $result['ok'] = true;
    $result['created'] = true;
    $result['reason'] = '';
    $result['file'] = basename((string) $after[0]);
    $result['path'] = (string) $after[0];

    return $result;
}

function backup_list_files(int $limit = 0): array
{
    $patterns = [
        backup_dir_path() . DIRECTORY_SEPARATOR . 'store-*.sqlite',
        backup_dir_path() . DIRECTORY_SEPARATOR . 'store-*.json'
    ];

    $files = [];
    foreach ($patterns as $pattern) {
        $matches = glob($pattern);
        if (!is_array($matches) || $matches === []) {
            continue;
        }
        $files = array_merge($files, $matches);
    }
    if ($files === []) {
        return [];
    }

    rsort($files, SORT_STRING);
    $files = array_values(array_filter($files, static function ($file): bool {
        return is_string($file) && $file !== '';
    }));

    if ($limit > 0 && count($files) > $limit) {
        $files = array_slice($files, 0, $limit);
    }

    return $files;
}

function backup_validate_store_shape(array $data): array
{
    $issues = [];
    $requiredArrayKeys = ['appointments', 'callbacks', 'reviews', 'availability'];
    foreach ($requiredArrayKeys as $key) {
        if (!array_key_exists($key, $data)) {
            $issues[] = 'missing_' . $key;
            continue;
        }
        if (!is_array($data[$key])) {
            $issues[] = 'invalid_' . $key;
        }
    }

    return [
        'ok' => $issues === [],
        'issues' => $issues,
        'counts' => [
            'appointments' => isset($data['appointments']) && is_array($data['appointments']) ? count($data['appointments']) : 0,
            'callbacks' => isset($data['callbacks']) && is_array($data['callbacks']) ? count($data['callbacks']) : 0,
            'reviews' => isset($data['reviews']) && is_array($data['reviews']) ? count($data['reviews']) : 0,
            'availability' => isset($data['availability']) && is_array($data['availability']) ? count($data['availability']) : 0
        ]
    ];
}

function backup_decode_store_payload(string $raw): array
{
    $raw = trim($raw);
    if ($raw === '') {
        return [
            'ok' => false,
            'reason' => 'empty_payload'
        ];
    }

    $decoded = data_decrypt_payload($raw);
    if ($decoded === '') {
        return [
            'ok' => false,
            'reason' => 'decrypt_failed'
        ];
    }

    $data = json_decode($decoded, true);
    if (!is_array($data)) {
        return [
            'ok' => false,
            'reason' => 'invalid_json'
        ];
    }

    $shape = backup_validate_store_shape($data);
    if (($shape['ok'] ?? false) !== true) {
        return [
            'ok' => false,
            'reason' => 'invalid_store_shape',
            'issues' => $shape['issues'] ?? []
        ];
    }

    return [
        'ok' => true,
        'data' => $data,
        'counts' => $shape['counts'] ?? []
    ];
}

function backup_validate_file(string $path): array
{
    $result = [
        'ok' => false,
        'path' => $path,
        'file' => basename($path),
        'exists' => false,
        'readable' => false,
        'sizeBytes' => 0,
        'mtime' => '',
        'ageHours' => null,
        'counts' => [
            'appointments' => 0,
            'callbacks' => 0,
            'reviews' => 0,
            'availability' => 0
        ],
        'reason' => ''
    ];

    if (!is_file($path)) {
        $result['reason'] = 'file_not_found';
        return $result;
    }
    $result['exists'] = true;

    if (!is_readable($path)) {
        $result['reason'] = 'file_not_readable';
        return $result;
    }
    $result['readable'] = true;

    $size = @filesize($path);
    if (is_int($size) && $size >= 0) {
        $result['sizeBytes'] = $size;
    }

    $mtime = @filemtime($path);
    if (is_int($mtime) && $mtime > 0) {
        $result['mtime'] = date('c', $mtime);
        $result['ageHours'] = round(max(0, time() - $mtime) / 3600, 3);
    }

    // Check if it's a SQLite file
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    if ($ext === 'sqlite') {
        try {
            $pdo = new PDO("sqlite:$path");
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

            // Basic integrity check could be PRAGMA integrity_check, but slow.
            // Just count rows.
            $counts = [];
            $counts['appointments'] = (int)$pdo->query("SELECT COUNT(*) FROM appointments")->fetchColumn();
            $counts['reviews'] = (int)$pdo->query("SELECT COUNT(*) FROM reviews")->fetchColumn();
            $counts['callbacks'] = (int)$pdo->query("SELECT COUNT(*) FROM callbacks")->fetchColumn();
            $counts['availability'] = (int)$pdo->query("SELECT COUNT(*) FROM availability")->fetchColumn();

            $result['counts'] = $counts;
            $result['ok'] = true;
            $result['reason'] = '';
            return $result;
        } catch (Exception $e) {
            $result['reason'] = 'sqlite_error: ' . $e->getMessage();
            return $result;
        }
    }

    // Fallback to JSON validation (for legacy backups or offsite snapshots)
    $raw = @file_get_contents($path);
    if (!is_string($raw) || trim($raw) === '') {
        $result['reason'] = 'file_empty_or_unreadable';
        return $result;
    }

    $decoded = backup_decode_store_payload($raw);
    if (($decoded['ok'] ?? false) !== true) {
        $result['reason'] = (string) ($decoded['reason'] ?? 'decode_failed');
        if (isset($decoded['issues']) && is_array($decoded['issues'])) {
            $result['issues'] = $decoded['issues'];
        }
        return $result;
    }

    $result['ok'] = true;
    $result['reason'] = '';
    if (isset($decoded['counts']) && is_array($decoded['counts'])) {
        $result['counts'] = $decoded['counts'];
    }

    return $result;
}

function backup_validate_file_fast(string $path): array
{
    $result = [
        'ok' => false,
        'path' => $path,
        'file' => basename($path),
        'exists' => false,
        'readable' => false,
        'sizeBytes' => 0,
        'mtime' => '',
        'ageHours' => null,
        'counts' => [
            'appointments' => 0,
            'callbacks' => 0,
            'reviews' => 0,
            'availability' => 0
        ],
        'reason' => ''
    ];

    if (!is_file($path)) {
        $result['reason'] = 'file_not_found';
        return $result;
    }
    $result['exists'] = true;

    if (!is_readable($path)) {
        $result['reason'] = 'file_not_readable';
        return $result;
    }
    $result['readable'] = true;

    $size = @filesize($path);
    if (is_int($size) && $size >= 0) {
        $result['sizeBytes'] = $size;
    }
    if ($result['sizeBytes'] <= 0) {
        $result['reason'] = 'file_empty';
        return $result;
    }

    $mtime = @filemtime($path);
    if (is_int($mtime) && $mtime > 0) {
        $result['mtime'] = date('c', $mtime);
        $result['ageHours'] = round(max(0, time() - $mtime) / 3600, 3);
    }

    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    if ($ext === 'sqlite') {
        $header = '';
        $fh = @fopen($path, 'rb');
        if ($fh !== false) {
            $read = @fread($fh, 16);
            if (is_string($read)) {
                $header = $read;
            }
            @fclose($fh);
        }
        if ($header !== '' && strpos($header, 'SQLite format 3') !== 0) {
            $result['reason'] = 'sqlite_header_invalid';
            return $result;
        }
    }

    $result['ok'] = true;
    $result['reason'] = '';
    return $result;
}

function backup_latest_status_internal(?int $maxAgeHours, callable $validator): array
{
    $maxAge = $maxAgeHours ?? backup_health_max_age_hours();
    if ($maxAge < 1) {
        $maxAge = 1;
    }

    $autoRefreshEnabled = backup_auto_refresh_enabled();
    $autoRefresh = [
        'enabled' => $autoRefreshEnabled,
        'attempted' => false,
        'created' => false,
        'reason' => '',
        'cooldownSeconds' => backup_auto_refresh_interval_seconds(),
        'lastAttemptAgeSeconds' => backup_auto_refresh_last_attempt_age_seconds(),
        'file' => ''
    ];

    $files = backup_list_files();
    $count = count($files);

    $bootstrapResult = null;
    if ($count === 0) {
        $bootstrapResult = backup_create_initial_seed_if_missing();
        if (($bootstrapResult['ok'] ?? false) === true) {
            $files = backup_list_files();
            $count = count($files);
        }
    }

    if ($count === 0 && $autoRefreshEnabled) {
        $refresh = backup_auto_refresh_try_create();
        $autoRefresh['attempted'] = (bool) ($refresh['attempted'] ?? false);
        $autoRefresh['created'] = (bool) ($refresh['created'] ?? false);
        $autoRefresh['reason'] = (string) ($refresh['reason'] ?? '');
        $autoRefresh['cooldownSeconds'] = (int) ($refresh['cooldownSeconds'] ?? $autoRefresh['cooldownSeconds']);
        $autoRefresh['lastAttemptAgeSeconds'] = $refresh['lastAttemptAgeSeconds'] ?? $autoRefresh['lastAttemptAgeSeconds'];
        $autoRefresh['file'] = (string) ($refresh['file'] ?? '');
        if (($refresh['ok'] ?? false) === true) {
            $files = backup_list_files();
            $count = count($files);
        }
    }

    if ($count === 0) {
        return [
            'ok' => false,
            'reason' => 'no_backup_files',
            'count' => 0,
            'maxAgeHours' => $maxAge,
            'latestFile' => '',
            'latestPath' => '',
            'latestAgeHours' => null,
            'latestValid' => false,
            'latestFresh' => false,
            'bootstrapAttempted' => $bootstrapResult !== null,
            'bootstrapCreated' => (bool) ($bootstrapResult['created'] ?? false),
            'bootstrapReason' => (string) ($bootstrapResult['reason'] ?? ''),
            'autoRefresh' => $autoRefresh
        ];
    }

    $latestPath = $files[0];
    $latest = $validator($latestPath);
    $latestAgeHours = isset($latest['ageHours']) && is_numeric($latest['ageHours']) ? (float) $latest['ageHours'] : null;
    $latestValid = ($latest['ok'] ?? false) === true;
    $latestFresh = $latestAgeHours !== null && $latestAgeHours <= $maxAge;
    $ok = $latestValid && $latestFresh;

    $reason = '';
    if (!$latestValid) {
        $reason = (string) ($latest['reason'] ?? 'latest_backup_invalid');
    } elseif (!$latestFresh) {
        $reason = 'latest_backup_stale';
    }

    if (!$ok && $autoRefreshEnabled && !$autoRefresh['attempted']) {
        $refresh = backup_auto_refresh_try_create();
        $autoRefresh['attempted'] = (bool) ($refresh['attempted'] ?? false);
        $autoRefresh['created'] = (bool) ($refresh['created'] ?? false);
        $autoRefresh['reason'] = (string) ($refresh['reason'] ?? '');
        $autoRefresh['cooldownSeconds'] = (int) ($refresh['cooldownSeconds'] ?? $autoRefresh['cooldownSeconds']);
        $autoRefresh['lastAttemptAgeSeconds'] = $refresh['lastAttemptAgeSeconds'] ?? $autoRefresh['lastAttemptAgeSeconds'];
        $autoRefresh['file'] = (string) ($refresh['file'] ?? '');

        if (($refresh['ok'] ?? false) === true) {
            $files = backup_list_files();
            $count = count($files);
            if ($count > 0) {
                $latestPath = $files[0];
                $latest = $validator($latestPath);
                $latestAgeHours = isset($latest['ageHours']) && is_numeric($latest['ageHours']) ? (float) $latest['ageHours'] : null;
                $latestValid = ($latest['ok'] ?? false) === true;
                $latestFresh = $latestAgeHours !== null && $latestAgeHours <= $maxAge;
                $ok = $latestValid && $latestFresh;

                $reason = '';
                if (!$latestValid) {
                    $reason = (string) ($latest['reason'] ?? 'latest_backup_invalid');
                } elseif (!$latestFresh) {
                    $reason = 'latest_backup_stale';
                }
            }
        }
    }

    return [
        'ok' => $ok,
        'reason' => $reason,
        'count' => $count,
        'maxAgeHours' => $maxAge,
        'latestFile' => basename($latestPath),
        'latestPath' => $latestPath,
        'latestAgeHours' => $latestAgeHours,
        'latestValid' => $latestValid,
        'latestFresh' => $latestFresh,
        'bootstrapAttempted' => $bootstrapResult !== null,
        'bootstrapCreated' => (bool) ($bootstrapResult['created'] ?? false),
        'bootstrapReason' => (string) ($bootstrapResult['reason'] ?? ''),
        'latest' => $latest,
        'autoRefresh' => $autoRefresh
    ];
}

function backup_latest_status(?int $maxAgeHours = null): array
{
    return backup_latest_status_internal($maxAgeHours, 'backup_validate_file');
}

function backup_latest_status_fast(?int $maxAgeHours = null): array
{
    return backup_latest_status_internal($maxAgeHours, 'backup_validate_file_fast');
}

function backup_create_offsite_snapshot(): array
{
    if (!ensure_data_file()) {
        return [
            'ok' => false,
            'reason' => 'store_not_ready'
        ];
    }

    if (!ensure_backup_dir()) {
        return [
            'ok' => false,
            'reason' => 'backup_dir_not_ready'
        ];
    }

    $offsiteDir = backup_dir_path() . DIRECTORY_SEPARATOR . 'offsite';
    if (!is_dir($offsiteDir) && !@mkdir($offsiteDir, 0775, true) && !is_dir($offsiteDir)) {
        return [
            'ok' => false,
            'reason' => 'offsite_dir_not_ready'
        ];
    }

    // Generate JSON dump from current store state
    $data = read_store();
    $raw = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);

    if (!is_string($raw) || trim($raw) === '') {
        return [
            'ok' => false,
            'reason' => 'store_empty'
        ];
    }

    // Verify it's valid structure (sanity check)
    $shape = backup_validate_store_shape($data);
    if (!$shape['ok']) {
        return [
           'ok' => false,
           'reason' => 'invalid_store_shape_export'
        ];
    }

    try {
        $suffix = bin2hex(random_bytes(4));
    } catch (Throwable $e) {
        $suffix = substr(md5((string) microtime(true)), 0, 8);
    }

    $baseName = 'store-offsite-' . local_date('Ymd-His') . '-' . $suffix;
    $jsonPath = $offsiteDir . DIRECTORY_SEPARATOR . $baseName . '.json';
    if (@file_put_contents($jsonPath, $raw, LOCK_EX) === false) {
        return [
            'ok' => false,
            'reason' => 'snapshot_write_failed'
        ];
    }

    $sha256 = hash('sha256', $raw);
    $shaPath = $jsonPath . '.sha256';
    $shaLine = $sha256 . '  ' . basename($jsonPath) . PHP_EOL;
    @file_put_contents($shaPath, $shaLine, LOCK_EX);

    $gzipPath = '';
    if (function_exists('gzencode')) {
        $gzData = gzencode($raw, 6);
        if (is_string($gzData) && $gzData !== '') {
            $candidate = $jsonPath . '.gz';
            if (@file_put_contents($candidate, $gzData, LOCK_EX) !== false) {
                $gzipPath = $candidate;
            }
        }
    }

    $uploadPath = $gzipPath !== '' ? $gzipPath : $jsonPath;
    $uploadBytes = @filesize($uploadPath);

    return [
        'ok' => true,
        'reason' => '',
        'createdAt' => local_date('c'),
        'path' => $jsonPath,
        'file' => basename($jsonPath),
        'sizeBytes' => is_int($uploadBytes) && $uploadBytes > 0 ? $uploadBytes : 0,
        'gzipPath' => $gzipPath,
        'gzipFile' => $gzipPath !== '' ? basename($gzipPath) : '',
        'uploadPath' => $uploadPath,
        'sha256' => $sha256,
        'counts' => $shape['counts'] ?? []
    ];
}

function backup_upload_file(string $filePath, array $metadata = []): array
{
    $targetUrl = backup_offsite_target_url();
    if ($targetUrl === '') {
        return [
            'ok' => false,
            'status' => 0,
            'reason' => 'offsite_url_not_configured'
        ];
    }

    if (!is_file($filePath) || !is_readable($filePath)) {
        return [
            'ok' => false,
            'status' => 0,
            'reason' => 'snapshot_not_readable'
        ];
    }

    if (!function_exists('curl_init') || !class_exists('CURLFile')) {
        return [
            'ok' => false,
            'status' => 0,
            'reason' => 'curl_not_available'
        ];
    }

    $headers = [
        'Accept: application/json'
    ];

    $token = backup_offsite_token();
    $tokenHeader = backup_offsite_token_header();
    if ($token !== '' && $tokenHeader !== '') {
        if (strcasecmp($tokenHeader, 'Authorization') === 0 && stripos($token, 'Bearer ') !== 0) {
            $token = 'Bearer ' . $token;
        }
        $headers[] = $tokenHeader . ': ' . $token;
    }

    $meta = $metadata;
    $meta['filename'] = basename($filePath);
    $meta['generatedAt'] = local_date('c');
    $meta['runtimeVersion'] = app_runtime_version();

    $postFields = [
        'backup' => new CURLFile($filePath, 'application/octet-stream', basename($filePath)),
        'metadata' => json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
    ];

    $ch = curl_init($targetUrl);
    if ($ch === false) {
        return [
            'ok' => false,
            'status' => 0,
            'reason' => 'curl_init_failed'
        ];
    }

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => $postFields,
        CURLOPT_TIMEOUT => backup_offsite_timeout_seconds(),
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2
    ]);

    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if (!is_string($raw)) {
        return [
            'ok' => false,
            'status' => $status,
            'reason' => 'curl_exec_failed',
            'curlError' => $curlError
        ];
    }

    $ok = $status >= 200 && $status < 300;
    $decoded = json_decode($raw, true);
    $responseSummary = is_array($decoded) ? $decoded : trim(substr($raw, 0, 500));

    return [
        'ok' => $ok,
        'status' => $status,
        'reason' => $ok ? '' : 'offsite_http_error',
        'response' => $responseSummary
    ];
}

function backup_replicate_local_file(string $filePath, array $metadata = []): array
{
    if (!backup_local_replica_enabled()) {
        return [
            'ok' => false,
            'status' => 0,
            'reason' => 'local_replica_disabled'
        ];
    }

    if (!is_file($filePath) || !is_readable($filePath)) {
        return [
            'ok' => false,
            'status' => 0,
            'reason' => 'snapshot_not_readable'
        ];
    }

    $replicaDir = backup_local_replica_dir();
    if (!is_dir($replicaDir) && !@mkdir($replicaDir, 0775, true) && !is_dir($replicaDir)) {
        return [
            'ok' => false,
            'status' => 0,
            'reason' => 'local_replica_dir_not_ready'
        ];
    }

    $destination = $replicaDir . DIRECTORY_SEPARATOR . basename($filePath);
    if (!@copy($filePath, $destination)) {
        return [
            'ok' => false,
            'status' => 0,
            'reason' => 'local_replica_copy_failed'
        ];
    }

    $sourceShaPath = $filePath . '.sha256';
    if (is_file($sourceShaPath) && is_readable($sourceShaPath)) {
        @copy($sourceShaPath, $destination . '.sha256');
    }

    $metaFile = $destination . '.meta.json';
    $meta = $metadata;
    $meta['replicatedAt'] = local_date('c');
    $meta['runtimeVersion'] = app_runtime_version();
    @file_put_contents($metaFile, json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT), LOCK_EX);

    $bytes = @filesize($destination);
    return [
        'ok' => true,
        'status' => 200,
        'reason' => '',
        'mode' => 'local',
        'file' => basename($destination),
        'path' => $destination,
        'sizeBytes' => is_int($bytes) && $bytes > 0 ? $bytes : 0
    ];
}
