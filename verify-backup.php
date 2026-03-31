<?php

declare(strict_types=1);

require_once __DIR__ . '/api-lib.php';

apply_security_headers(false);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
api_apply_cors(['GET', 'OPTIONS'], ['Authorization', 'X-Backup-Token'], false);

function verify_backup_json(array $payload, int $status = 200): void
{
    if (defined('TESTING_ENV')) {
        $GLOBALS['__TEST_RESPONSE'] = ['payload' => $payload, 'status' => $status];
        if (!defined('TESTING_FORCE_EXIT')) {
            throw new TestingExitException($payload, $status);
        }
    }

    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit();
}

function verify_backup_extract_token(): string
{
    $authHeader = isset($_SERVER['HTTP_AUTHORIZATION']) ? trim((string) $_SERVER['HTTP_AUTHORIZATION']) : '';
    if ($authHeader !== '' && preg_match('/^Bearer\s+(.+)$/i', $authHeader, $matches) === 1) {
        return trim((string) ($matches[1] ?? ''));
    }
    if ($authHeader !== '') {
        return $authHeader;
    }

    $backupToken = isset($_SERVER['HTTP_X_BACKUP_TOKEN']) ? trim((string) $_SERVER['HTTP_X_BACKUP_TOKEN']) : '';
    if ($backupToken !== '') {
        return $backupToken;
    }

    return '';
}

function verify_backup_expected_token(): string
{
    $token = app_env('AURORADERM_BACKUP_VERIFY_TOKEN');
    return is_string($token) ? trim($token) : '';
}

function verify_backup_authorization_state(): array
{
    $providedToken = verify_backup_extract_token();
    if ($providedToken === '') {
        return [
            'ok' => false,
            'status' => 401,
            'code' => 'auth_missing',
            'error' => 'Token de verificacion ausente',
        ];
    }

    $forbiddenTokens = [
        [
            'env' => 'AURORADERM_CRON_SECRET',
            'code' => 'auth_forbidden_cron_secret',
            'error' => 'CRON_SECRET no tiene permisos para verify-backup',
        ],
        [
            'env' => 'AURORADERM_DIAGNOSTICS_ACCESS_TOKEN',
            'code' => 'auth_forbidden_diagnostics_token',
            'error' => 'AURORADERM_DIAGNOSTICS_ACCESS_TOKEN no tiene permisos para verify-backup',
        ],
    ];

    foreach ($forbiddenTokens as $forbidden) {
        $forbiddenToken = app_env((string) ($forbidden['env'] ?? ''));
        if (!is_string($forbiddenToken) || trim($forbiddenToken) === '') {
            continue;
        }
        if (hash_equals(trim($forbiddenToken), $providedToken)) {
            return [
                'ok' => false,
                'status' => 403,
                'code' => (string) ($forbidden['code'] ?? 'auth_invalid'),
                'error' => (string) ($forbidden['error'] ?? 'Token de verificacion invalido'),
            ];
        }
    }

    $expectedToken = verify_backup_expected_token();
    if ($expectedToken !== '' && hash_equals($expectedToken, $providedToken)) {
        return [
            'ok' => true,
            'status' => 200,
            'code' => '',
            'error' => '',
        ];
    }

    return [
        'ok' => false,
        'status' => 403,
        'code' => 'auth_invalid',
        'error' => 'Token de verificacion invalido',
    ];
}

function verify_backup_list_encrypted_files(string $storageRoot, int $limit = 100): array
{
    if (!is_dir($storageRoot)) {
        return [];
    }

    $files = [];
    try {
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($storageRoot, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::LEAVES_ONLY
        );
    } catch (Throwable $e) {
        return [];
    }

    foreach ($iterator as $entry) {
        if (!$entry instanceof SplFileInfo || !$entry->isFile()) {
            continue;
        }
        $path = $entry->getPathname();
        if (substr($path, -4) !== '.enc') {
            continue;
        }
        $files[] = [
            'path' => $path,
            'mtime' => (int) $entry->getMTime()
        ];
    }

    usort($files, static function (array $a, array $b): int {
        return ($b['mtime'] ?? 0) <=> ($a['mtime'] ?? 0);
    });

    if (count($files) > $limit) {
        $files = array_slice($files, 0, $limit);
    }

    return array_values(array_map(static function (array $item): string {
        return (string) ($item['path'] ?? '');
    }, $files));
}

function verify_backup_resolve_file(string $storageRoot, string $relativePath): string
{
    $normalized = str_replace(['\\', '/'], DIRECTORY_SEPARATOR, trim($relativePath));
    if ($normalized === '' || strpos($normalized, '..') !== false) {
        return '';
    }

    $candidate = $storageRoot . DIRECTORY_SEPARATOR . ltrim($normalized, DIRECTORY_SEPARATOR);
    $rootReal = realpath($storageRoot);
    $candidateReal = realpath($candidate);
    if ($rootReal === false || $candidateReal === false) {
        return '';
    }

    if (strpos($candidateReal, $rootReal) !== 0) {
        return '';
    }

    return $candidateReal;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    verify_backup_json(['ok' => true, 'service' => 'verify-backup']);
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    verify_backup_json([
        'ok' => false,
        'error' => 'Metodo no permitido'
    ], 405);
}

/** @var array{ok:bool,status:int,code:string,error:string} $authorization */
$authorization = verify_backup_authorization_state();
if (($authorization['ok'] ?? false) !== true) {
    verify_backup_json([
        'ok' => false,
        'error' => (string) ($authorization['error'] ?? 'No autorizado'),
        'code' => (string) ($authorization['code'] ?? 'auth_invalid'),
    ], (int) ($authorization['status'] ?? 403));
}

$storageRoot = backup_receiver_storage_root();
if (!is_dir($storageRoot)) {
    verify_backup_json([
        'ok' => false,
        'error' => 'No existe almacenamiento de backups',
        'code' => 'storage_not_found'
    ], 500);
}

$requestedFile = isset($_GET['file']) ? trim((string) $_GET['file']) : '';
$targetFile = '';
if ($requestedFile !== '') {
    $targetFile = verify_backup_resolve_file($storageRoot, $requestedFile);
    if ($targetFile === '') {
        verify_backup_json([
            'ok' => false,
            'error' => 'Archivo invalido',
            'code' => 'invalid_file'
        ], 400);
    }
} else {
    $files = verify_backup_list_encrypted_files($storageRoot, 1);
    $targetFile = count($files) > 0 ? (string) $files[0] : '';
}

if ($targetFile === '') {
    verify_backup_json([
        'ok' => false,
        'error' => 'No hay backups cifrados para verificar',
        'code' => 'no_backup_files'
    ], 404);
}

$verification = backup_receiver_verify_stored_file($targetFile);
$verificationOk = (bool) ($verification['ok'] ?? false);
$verificationReason = (string) ($verification['reason'] ?? '');
$statusCode = 200;
$errorCode = '';
$errorMessage = '';
if (!$verificationOk) {
    if (in_array($verificationReason, ['metadata_checksum_mismatch', 'integrity_check_failed'], true)) {
        $statusCode = 409;
        $errorCode = 'checksum_mismatch';
        $errorMessage = 'Checksum de backup no coincide';
    } else {
        $statusCode = 422;
        $errorCode = 'verification_failed';
        $errorMessage = 'No se pudo verificar el backup cifrado';
    }
}
$storageRootReal = realpath($storageRoot);
$relativeFile = $targetFile;
if (is_string($storageRootReal) && $storageRootReal !== '' && strpos($targetFile, $storageRootReal) === 0) {
    $relativeFile = ltrim(substr($targetFile, strlen($storageRootReal)), DIRECTORY_SEPARATOR);
}

/** @var array<string,mixed> $payload */
$payload = [
    'ok' => (bool) ($verification['ok'] ?? false),
    'service' => 'verify-backup',
    'file' => $relativeFile,
    'storageRoot' => $storageRoot,
    'verifiedAt' => gmdate('c'),
    'verification' => $verification
];
if (!$verificationOk) {
    $payload['code'] = $errorCode;
    $payload['error'] = $errorMessage;
}

verify_backup_json($payload, $statusCode);
