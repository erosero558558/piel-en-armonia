<?php

declare(strict_types=1);

/**
 * Rate limiting compatibility restored for the simplified backend runtime.
 */

function rate_limit_client_ip(): string
{
    $remoteAddr = $_SERVER['REMOTE_ADDR'] ?? null;
    if (!is_string($remoteAddr) || trim($remoteAddr) === '') {
        return 'unknown';
    }

    $remoteAddr = trim($remoteAddr);

    if (!rate_limit_is_trusted_proxy($remoteAddr)) {
        return filter_var($remoteAddr, FILTER_VALIDATE_IP) !== false ? $remoteAddr : 'unknown';
    }

    $candidates = [
        $_SERVER['HTTP_CF_CONNECTING_IP'] ?? null,
        $_SERVER['HTTP_X_REAL_IP'] ?? null,
    ];

    $forwarded = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? null;
    if (is_string($forwarded) && trim($forwarded) !== '') {
        $parts = explode(',', $forwarded);
        $candidates[] = trim((string) ($parts[0] ?? ''));
    }

    $candidates[] = $remoteAddr;

    foreach ($candidates as $candidate) {
        if (!is_string($candidate) || trim($candidate) === '') {
            continue;
        }

        $candidate = trim($candidate);
        if (filter_var($candidate, FILTER_VALIDATE_IP) !== false) {
            return $candidate;
        }
    }

    return 'unknown';
}

function rate_limit_is_trusted_proxy(string $ip): bool
{
    $trusted = getenv('PIELARMONIA_TRUSTED_PROXIES');
    if (!is_string($trusted) || trim($trusted) === '') {
        $trusted = '127.0.0.1,::1';
    }

    $trusted = trim($trusted);
    if ($trusted === '*') {
        return true;
    }

    $proxies = explode(',', $trusted);
    foreach ($proxies as $proxy) {
        $proxy = trim($proxy);
        if ($proxy === '') {
            continue;
        }
        if (rate_limit_ip_in_range($ip, $proxy)) {
            return true;
        }
    }

    return false;
}

function rate_limit_ip_in_range(string $ip, string $range): bool
{
    if (strpos($range, '/') === false) {
        return $ip === $range;
    }

    [$subnet, $bits] = explode('/', $range, 2);
    $packedIp = @inet_pton($ip);
    $packedSubnet = @inet_pton($subnet);

    if ($packedIp === false || $packedSubnet === false) {
        return false;
    }

    if (strlen($packedIp) !== strlen($packedSubnet)) {
        return false;
    }

    $bitCount = (int) $bits;
    $mask = str_repeat("\xFF", (int) ($bitCount / 8));
    if (($bitCount % 8) > 0) {
        $mask .= chr(0xFF << (8 - ($bitCount % 8)));
    }
    $mask = str_pad($mask, strlen($packedIp), "\x00");

    return ($packedIp & $mask) === ($packedSubnet & $mask);
}

function rate_limit_add_candidate(array &$candidates, $candidate): void
{
    if (!is_string($candidate) && !is_int($candidate)) {
        return;
    }

    $value = trim((string) $candidate);
    if ($value === '') {
        return;
    }

    if (strlen($value) > 256) {
        $value = substr($value, 0, 256);
    }

    $candidates[] = $value;
}

function rate_limit_env_int(string $name, int $fallback): int
{
    $raw = getenv($name);
    $value = is_string($raw) && trim($raw) !== '' ? (int) trim($raw) : $fallback;
    return max(1, $value);
}

function rate_limit_header_identifier_candidates(): array
{
    $candidates = [];

    foreach ([
        $_SERVER['HTTP_X_USER_ID'] ?? null,
        $_SERVER['HTTP_X_PATIENT_ID'] ?? null,
        $_SERVER['HTTP_X_SESSION_ID'] ?? null,
    ] as $candidate) {
        rate_limit_add_candidate($candidates, $candidate);
    }

    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? null;
    if (is_string($authHeader) && trim($authHeader) !== '') {
        $authHeader = trim($authHeader);
        if (preg_match('/^Bearer\s+(.+)$/i', $authHeader, $matches) === 1) {
            $token = trim((string) ($matches[1] ?? ''));
            if ($token !== '') {
                rate_limit_add_candidate($candidates, 'bearer:' . hash('sha256', $token));
            }
        } else {
            rate_limit_add_candidate($candidates, 'auth:' . hash('sha256', $authHeader));
        }
    }

    return $candidates;
}

function rate_limit_session_identifier_candidates(): array
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        return [];
    }

    $candidates = [];
    $operatorSession = function_exists('operator_auth_current_identity')
        ? operator_auth_current_identity(false)
        : null;
    $sessionCandidates = [
        $_SESSION['user_id'] ?? null,
        $_SESSION['patient_id'] ?? null,
        $_SESSION['admin_logged_in'] ?? null,
    ];

    if (is_array($operatorSession)) {
        $email = strtolower(trim((string) ($operatorSession['email'] ?? '')));
        if ($email !== '') {
            $sessionCandidates[] = 'operator:' . $email;
        }
    }

    foreach ($sessionCandidates as $candidate) {
        if (is_bool($candidate)) {
            if ($candidate === true) {
                rate_limit_add_candidate($candidates, 'session:admin');
            }
            continue;
        }

        if (is_int($candidate) || is_string($candidate)) {
            rate_limit_add_candidate($candidates, 'session:' . $candidate);
        }
    }

    return $candidates;
}

function rate_limit_user_identifier(): string
{
    $candidates = array_merge(
        rate_limit_header_identifier_candidates(),
        rate_limit_session_identifier_candidates()
    );

    foreach ($candidates as $candidate) {
        if (!is_string($candidate) || trim($candidate) === '') {
            continue;
        }
        return $candidate;
    }

    return '';
}

function rate_limit_user_limits_enabled(): bool
{
    $raw = getenv('PIELARMONIA_RATE_LIMIT_PER_USER_ENABLED');
    if (!is_string($raw) || trim($raw) === '') {
        return true;
    }

    return parse_bool($raw);
}

function rate_limit_user_max_requests(int $fallback): int
{
    return rate_limit_env_int('PIELARMONIA_RATE_LIMIT_USER_MAX_REQUESTS', $fallback);
}

function rate_limit_user_window_seconds(int $fallback): int
{
    return rate_limit_env_int('PIELARMONIA_RATE_LIMIT_USER_WINDOW_SECONDS', $fallback);
}

function rate_limit_emit_event(string $event, array $details = []): void
{
    if (function_exists('audit_log_event')) {
        audit_log_event($event, $details);
    }
}

function rate_limit_key(string $action, ?string $ip = null): string
{
    $clientIp = is_string($ip) && trim($ip) !== '' ? trim($ip) : rate_limit_client_ip();
    return md5($clientIp . ':' . $action);
}

function rate_limit_file_path(string $action, ?string $ip = null): string
{
    $key = rate_limit_key($action, $ip);
    $rateDir = data_dir_path() . DIRECTORY_SEPARATOR . 'ratelimit';
    $shard = substr($key, 0, 2);
    $shardDir = $rateDir . DIRECTORY_SEPARATOR . $shard;

    if (!@is_dir($shardDir)) {
        @mkdir($shardDir, 0775, true);
    }

    return $shardDir . DIRECTORY_SEPARATOR . $key . '.json';
}

function rate_limit_read_entries(string $filePath): array
{
    if (!is_file($filePath)) {
        return [];
    }

    $raw = @file_get_contents($filePath);
    if (!is_string($raw) || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return [];
    }

    $entries = [];
    foreach ($decoded as $value) {
        $ts = (int) $value;
        if ($ts > 0) {
            $entries[] = $ts;
        }
    }

    return $entries;
}

function rate_limit_filter_window(array $entries, int $now, int $windowSeconds): array
{
    return array_values(array_filter($entries, static function (int $ts) use ($now, $windowSeconds): bool {
        return ($now - $ts) < $windowSeconds;
    }));
}

function rate_limit_write_entries(string $filePath, array $entries): void
{
    @file_put_contents($filePath, json_encode($entries), LOCK_EX);
}

function rate_limit_entries_in_window(string $filePath, int $now, int $windowSeconds): array
{
    return rate_limit_filter_window(rate_limit_read_entries($filePath), $now, $windowSeconds);
}

function rate_limit_user_state(string $action, int $now, int $maxRequests, int $windowSeconds): array
{
    if (!rate_limit_user_limits_enabled()) {
        return [
            'enabled' => false,
            'userId' => '',
            'filePath' => '',
            'entries' => [],
            'maxRequests' => $maxRequests,
            'windowSeconds' => $windowSeconds,
        ];
    }

    $userId = rate_limit_user_identifier();
    if ($userId === '') {
        return [
            'enabled' => false,
            'userId' => '',
            'filePath' => '',
            'entries' => [],
            'maxRequests' => $maxRequests,
            'windowSeconds' => $windowSeconds,
        ];
    }

    $userMaxRequests = rate_limit_user_max_requests($maxRequests);
    $userWindowSeconds = rate_limit_user_window_seconds($windowSeconds);
    $userFilePath = rate_limit_file_path($action . ':user', $userId);

    return [
        'enabled' => true,
        'userId' => $userId,
        'filePath' => $userFilePath,
        'entries' => rate_limit_entries_in_window($userFilePath, $now, $userWindowSeconds),
        'maxRequests' => $userMaxRequests,
        'windowSeconds' => $userWindowSeconds,
    ];
}

function rate_limit_emit_blocked(
    string $action,
    string $scope,
    string $ip,
    string $filePath,
    array $entries,
    int $maxRequests,
    int $windowSeconds,
    string $userId = ''
): void {
    rate_limit_write_entries($filePath, $entries);
    $details = [
        'action' => $action,
        'scope' => $scope,
        'ip' => $ip,
        'count' => count($entries),
        'maxRequests' => $maxRequests,
        'windowSeconds' => $windowSeconds,
    ];

    if ($userId !== '') {
        $details['user'] = $userId;
    }

    rate_limit_emit_event('ratelimit.blocked', $details);
}

function rate_limit_cleanup_random_shard(string $rateDir, int $now): void
{
    if (mt_rand(1, 50) !== 1) {
        return;
    }

    $randomShard = sprintf('%02x', mt_rand(0, 255));
    $targetDir = $rateDir . DIRECTORY_SEPARATOR . $randomShard;
    $allFiles = @glob($targetDir . DIRECTORY_SEPARATOR . '*.json');
    if (!is_array($allFiles)) {
        return;
    }

    foreach ($allFiles as $filePath) {
        if (($now - (int) @filemtime($filePath)) > 3600) {
            @unlink($filePath);
        }
    }
}

function is_rate_limited(string $action, int $maxRequests = 10, int $windowSeconds = 60): bool
{
    $maxRequests = max(1, $maxRequests);
    $windowSeconds = max(1, $windowSeconds);

    $now = time();
    $filePath = rate_limit_file_path($action);
    $entries = rate_limit_entries_in_window($filePath, $now, $windowSeconds);
    if (count($entries) >= $maxRequests) {
        return true;
    }

    $userState = rate_limit_user_state($action, $now, $maxRequests, $windowSeconds);
    return $userState['enabled'] && count($userState['entries']) >= $userState['maxRequests'];
}

function check_rate_limit(string $action, int $maxRequests = 10, int $windowSeconds = 60): bool
{
    $maxRequests = max(1, $maxRequests);
    $windowSeconds = max(1, $windowSeconds);

    $rateDir = data_dir_path() . DIRECTORY_SEPARATOR . 'ratelimit';
    $filePath = rate_limit_file_path($action);
    $now = time();

    $entries = rate_limit_entries_in_window($filePath, $now, $windowSeconds);
    $clientIp = rate_limit_client_ip();

    if (count($entries) >= $maxRequests) {
        rate_limit_emit_blocked(
            $action,
            'ip',
            $clientIp,
            $filePath,
            $entries,
            $maxRequests,
            $windowSeconds
        );
        return false;
    }

    $userState = rate_limit_user_state($action, $now, $maxRequests, $windowSeconds);
    if ($userState['enabled']) {
        if (count($userState['entries']) >= $userState['maxRequests']) {
            rate_limit_emit_blocked(
                $action,
                'user',
                $clientIp,
                $userState['filePath'],
                $userState['entries'],
                $userState['maxRequests'],
                $userState['windowSeconds'],
                $userState['userId']
            );
            return false;
        }

        $userState['entries'][] = $now;
        rate_limit_write_entries($userState['filePath'], $userState['entries']);
    }

    $entries[] = $now;
    rate_limit_write_entries($filePath, $entries);

    rate_limit_cleanup_random_shard($rateDir, $now);

    rate_limit_emit_event('ratelimit.allowed', [
        'action' => $action,
        'scope' => $userState['enabled'] ? 'ip+user' : 'ip',
        'ip' => $clientIp,
        'user' => $userState['enabled'] ? $userState['userId'] : '',
        'remainingIp' => max(0, $maxRequests - count($entries)),
        'remainingUser' => $userState['enabled']
            ? max(0, $userState['maxRequests'] - count($userState['entries']))
            : null,
        'windowSeconds' => $windowSeconds,
        'userWindowSeconds' => $userState['enabled'] ? $userState['windowSeconds'] : null,
    ]);

    return true;
}

function reset_rate_limit(string $action): void
{
    $filePath = rate_limit_file_path($action);
    if (is_file($filePath)) {
        @unlink($filePath);
    }

    if (!rate_limit_user_limits_enabled()) {
        return;
    }

    $userId = rate_limit_user_identifier();
    if ($userId === '') {
        return;
    }

    $userFilePath = rate_limit_file_path($action . ':user', $userId);
    if (is_file($userFilePath)) {
        @unlink($userFilePath);
    }
}

function require_rate_limit(string $action, int $maxRequests = 10, int $windowSeconds = 60): void
{
    if (!check_rate_limit($action, $maxRequests, $windowSeconds)) {
        $retryAfterSec = max(1, $windowSeconds);
        header('Retry-After: ' . (string) $retryAfterSec);
        json_response([
            'ok' => false,
            'mode' => 'rate_limited',
            'source' => 'ratelimit',
            'reason' => 'rate_limited',
            'code' => 'rate_limited',
            'retryAfterSec' => $retryAfterSec,
            'error' => 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.',
        ], 429);
    }
}
