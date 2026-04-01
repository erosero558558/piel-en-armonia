<?php

declare(strict_types=1);

require_once __DIR__ . '/storage.php';

class DataAccessAudit
{
    public static function detectAccessor(): string
    {
        if (function_exists('operator_auth_current_identity')) {
            $identity = operator_auth_current_identity(false);
            if (is_array($identity) && isset($identity['email']) && (string)$identity['email'] !== '') {
                return (string)$identity['email'];
            }
        }
        if (isset($_SESSION['admin_email']) && (string)$_SESSION['admin_email'] !== '') {
            return (string)$_SESSION['admin_email'];
        }
        return 'sistema_backend';
    }

    /**
     * Escribe un registro de acceso inmutable en un log append-only (JSONL).
     */
    public static function logAccess(string $resourceName, string $patientId, ?string $accessorEmail = null): void
    {
        $accessorEmail = $accessorEmail ?? self::detectAccessor();
        if ($accessorEmail === '' || $patientId === '') {
            return;
        }

        $logFile = data_dir_path() . DIRECTORY_SEPARATOR . 'access-log.jsonl';
        
        $entry = [
            'accessor' => $accessorEmail,
            'resource' => $resourceName,
            'patient_id' => $patientId,
            'ip' => $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0',
            'ts' => time()
        ];
        
        $line = json_encode($entry, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
        
        // Append inmutable y atómico
        @file_put_contents($logFile, $line, FILE_APPEND | LOCK_EX);
    }
}
