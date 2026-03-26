<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/hosting_runtime_fingerprint.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

function hosting_runtime_is_local_request(): bool
{
    $remote = isset($_SERVER['REMOTE_ADDR']) ? trim((string) $_SERVER['REMOTE_ADDR']) : '';
    return in_array($remote, ['127.0.0.1', '::1', '::ffff:127.0.0.1'], true);
}

function hosting_runtime_json(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

if (!hosting_runtime_is_local_request()) {
    hosting_runtime_json(403, [
        'ok' => false,
        'error' => 'forbidden',
        'status_source' => 'hosting_runtime_fingerprint',
    ]);
}

$fingerprint = hosting_runtime_build_fingerprint(__DIR__);

hosting_runtime_json(200, [
    'ok' => true,
    'site_root' => (string) ($fingerprint['site_root'] ?? ''),
    'current_commit' => (string) ($fingerprint['current_commit'] ?? ''),
    'desired_commit' => (string) ($fingerprint['desired_commit'] ?? ''),
    'status_source' => (string) ($fingerprint['status_source'] ?? 'hosting_runtime_fingerprint'),
    'caddy_runtime_config_path' => (string) ($fingerprint['caddy_runtime_config_path'] ?? ''),
]);
