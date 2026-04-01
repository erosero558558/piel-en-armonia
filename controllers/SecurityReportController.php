<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/common.php';
require_once __DIR__ . '/../lib/storage.php';
require_once __DIR__ . '/../lib/TurneroOperatorAccess.php';
require_once __DIR__ . '/../lib/monitoring.php';

class SecurityReportController
{
    private static function get(array $context): void
    {
        // 1. Secrets Rotation (operator pin rotation as proxy for secrets if none exists, or filemtime)
        $meta = turnero_operator_access_meta();
        $secretRotationLastAt = $meta['rotated_at'] ?? null;
        if (!$secretRotationLastAt && file_exists(__DIR__ . '/../env.php')) {
            $secretRotationLastAt = date('c', filemtime(__DIR__ . '/../env.php'));
        }

        // 2. Backup status
        $backupLastAt = null;
        if (function_exists('backup_latest_status')) {
            $backupStatus = backup_latest_status();
            $backupLastAt = $backupStatus['latestValid'] ? ($backupStatus['latestAgeHours'] !== null ? date('c', time() - (int)($backupStatus['latestAgeHours'] * 3600)) : null) : null;
        }

        // 3. Admin Logins Last 5
        $adminLoginsLast5 = self::getLatestAdminLogins(5);

        // 4. File Integrity
        $fileIntegrity = [
            'api.php' => self::getFileHash(__DIR__ . '/../api.php'),
            'lib/auth.php' => self::getFileHash(__DIR__ . '/../lib/auth.php')
        ];

        json_response([
            'ok' => true,
            'secret_rotation_last_at' => $secretRotationLastAt,
            'backup_last_at' => $backupLastAt,
            'admin_logins_last_5' => $adminLoginsLast5,
            'csp_active' => true,
            'app_version' => function_exists('app_runtime_version') ? app_runtime_version() : 'unknown',
            'file_integrity' => $fileIntegrity,
            'timestamp' => local_date('c')
        ]);
    }

    private static function getLatestAdminLogins(int $limit): array
    {
        $logins = [];
        if (function_exists('audit_log_file_path')) {
            $path = audit_log_file_path();
            if (is_file($path) && is_readable($path)) {
                // Read from end of file efficiently or just file()
                $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
                if ($lines !== false) {
                    $lines = array_reverse($lines);
                    foreach ($lines as $line) {
                        $record = json_decode($line, true);
                        if (is_array($record) && ($record['event'] ?? '') === 'admin.login_success') {
                            $logins[] = [
                                'ts' => $record['ts'] ?? '',
                                'ip' => $record['ip'] ?? 'unknown',
                                'actor' => $record['actor'] ?? 'unknown'
                            ];
                            if (count($logins) >= $limit) {
                                break;
                            }
                        }
                    }
                }
            }
        }
        return $logins;
    }

    private static function getFileHash(string $path): ?string
    {
        if (is_file($path) && is_readable($path)) {
            return hash_file('sha256', $path);
        }
        return null;
    }

    public static function handle(array $context): void
    {
        $resource = $context['resource'] ?? '';
        $method = $context['method'] ?? 'GET';
        $key = "$method:$resource";
        
        switch ($key) {
            case 'GET:security-report':
                self::get($context);
                return;
            default:
                if (isset($context['action'])) {
                    $action = $context['action'];
                    switch ($action) {
                        case 'get':
                            self::get($context);
                            return;
                    }
                }
                json_response(['ok' => false, 'error' => 'Not found in controller dispatch: ' . $key], 404);
        }
    }
}
