<?php

declare(strict_types=1);

require_once __DIR__ . '/storage.php';

class DataAccessAudit
{
    /**
     * Escribe un registro de acceso inmutable en un log append-only (JSONL).
     */
    public static function logAccess(string $accessorEmail, string $resourceName, string $patientId): void
    {
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
