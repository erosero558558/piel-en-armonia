<?php
declare(strict_types=1);

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

function hosting_runtime_read_json_file(string $path): ?array
{
    if (!is_file($path)) {
        return null;
    }

    $raw = @file_get_contents($path);
    if (!is_string($raw) || trim($raw) === '') {
        return null;
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : null;
}

function hosting_runtime_resolve_git_dir(string $repoRoot): ?string
{
    $gitPath = $repoRoot . DIRECTORY_SEPARATOR . '.git';
    if (is_dir($gitPath)) {
        return $gitPath;
    }

    if (!is_file($gitPath)) {
        return null;
    }

    $raw = @file_get_contents($gitPath);
    if (!is_string($raw)) {
        return null;
    }

    if (!preg_match('/gitdir:\s*(.+)\s*$/i', $raw, $matches)) {
        return null;
    }

    $candidate = trim((string) $matches[1]);
    if ($candidate === '') {
        return null;
    }

    if (preg_match('/^[A-Za-z]:[\\\\\\/]/', $candidate) === 1 || str_starts_with($candidate, DIRECTORY_SEPARATOR)) {
        return $candidate;
    }

    return realpath(dirname($gitPath) . DIRECTORY_SEPARATOR . $candidate) ?: null;
}

function hosting_runtime_resolve_git_ref(string $gitDir, string $ref): string
{
    $refPath = $gitDir . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $ref);
    if (is_file($refPath)) {
        $contents = @file_get_contents($refPath);
        if (is_string($contents)) {
            $commit = trim($contents);
            if ($commit !== '') {
                return $commit;
            }
        }
    }

    $packedRefsPath = $gitDir . DIRECTORY_SEPARATOR . 'packed-refs';
    if (is_file($packedRefsPath)) {
        $lines = @file($packedRefsPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if (is_array($lines)) {
            foreach ($lines as $line) {
                if ($line === '' || $line[0] === '#' || $line[0] === '^') {
                    continue;
                }
                $parts = preg_split('/\s+/', trim($line), 2);
                if (is_array($parts) && count($parts) === 2 && trim((string) $parts[1]) === $ref) {
                    return trim((string) $parts[0]);
                }
            }
        }
    }

    return '';
}

function hosting_runtime_current_commit(string $repoRoot): string
{
    $gitDir = hosting_runtime_resolve_git_dir($repoRoot);
    if ($gitDir === null || $gitDir === '') {
        return '';
    }

    $headPath = $gitDir . DIRECTORY_SEPARATOR . 'HEAD';
    if (!is_file($headPath)) {
        return '';
    }

    $head = @file_get_contents($headPath);
    if (!is_string($head)) {
        return '';
    }

    $head = trim($head);
    if ($head === '') {
        return '';
    }

    if (str_starts_with($head, 'ref: ')) {
        return hosting_runtime_resolve_git_ref($gitDir, trim(substr($head, 5)));
    }

    return $head;
}

if (!hosting_runtime_is_local_request()) {
    hosting_runtime_json(403, [
        'ok' => false,
        'error' => 'forbidden',
        'status_source' => 'hosting_runtime_fingerprint',
    ]);
}

$repoRoot = realpath(__DIR__) ?: __DIR__;
$releaseTargetPath = 'C:\\ProgramData\\Pielarmonia\\hosting\\release-target.json';
$runtimeConfigPath = $repoRoot . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'runtime' . DIRECTORY_SEPARATOR . 'hosting' . DIRECTORY_SEPARATOR . 'Caddyfile.runtime';
$releaseTarget = hosting_runtime_read_json_file($releaseTargetPath);
$desiredCommit = '';
if (is_array($releaseTarget) && isset($releaseTarget['target_commit']) && is_string($releaseTarget['target_commit'])) {
    $desiredCommit = trim($releaseTarget['target_commit']);
}

hosting_runtime_json(200, [
    'ok' => true,
    'site_root' => $repoRoot,
    'current_commit' => hosting_runtime_current_commit($repoRoot),
    'desired_commit' => $desiredCommit,
    'status_source' => 'hosting_runtime_fingerprint',
    'caddy_runtime_config_path' => $runtimeConfigPath,
]);
