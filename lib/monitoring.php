<?php
declare(strict_types=1);

/**
 * Monitoring and Health Check Helpers
 */

function init_monitoring(): void
{
    $dsn = getenv('PIELARMONIA_SENTRY_DSN');
    if (!is_string($dsn) || trim($dsn) === '') {
        return;
    }

    $env = getenv('PIELARMONIA_SENTRY_ENV');
    if (!is_string($env) || trim($env) === '') {
        $env = 'production';
    }

    if (function_exists('\Sentry\init')) {
        \Sentry\init([
            'dsn' => trim($dsn),
            'environment' => trim($env),
            'traces_sample_rate' => 1.0,
        ]);
    }
}

function get_monitoring_config(): array
{
    $dsn = getenv('PIELARMONIA_SENTRY_DSN_PUBLIC');
    $env = getenv('PIELARMONIA_SENTRY_ENV');

    if (!is_string($dsn) || trim($dsn) === '') {
        return [
            'enabled' => false
        ];
    }

    if (!is_string($env) || trim($env) === '') {
        $env = 'production';
    }

    return [
        'enabled' => true,
        'dsn' => trim($dsn),
        'environment' => trim($env),
        'tracesSampleRate' => 1.0,
        'replaysSessionSampleRate' => 0.1,
        'replaysOnErrorSampleRate' => 1.0,
    ];
}

function check_system_health(): array
{
    $storageReady = ensure_data_file();
    $dataWritable = data_dir_writable();
    $storeEncrypted = store_file_is_encrypted();

    // Check Redis if configured (optional)
    $redisStatus = 'disabled';
    if (getenv('PIELARMONIA_REDIS_HOST')) {
        try {
            // detailed check could be added here if predis is used
            $redisStatus = 'configured';
        } catch (Throwable $e) {
            $redisStatus = 'error';
        }
    }

    $backupCheck = [
        'enabled' => false
    ];
    if (function_exists('backup_latest_status')) {
        $backupStatus = backup_latest_status();
        $backupCheck = [
            'enabled' => true,
            'ok' => (bool) ($backupStatus['ok'] ?? false),
            'reason' => (string) ($backupStatus['reason'] ?? ''),
            'count' => (int) ($backupStatus['count'] ?? 0),
            'maxAgeHours' => (int) ($backupStatus['maxAgeHours'] ?? backup_health_max_age_hours()),
            'latestAgeHours' => $backupStatus['latestAgeHours'] ?? null,
            'latestValid' => (bool) ($backupStatus['latestValid'] ?? false),
            'latestFresh' => (bool) ($backupStatus['latestFresh'] ?? false),
            'offsiteConfigured' => function_exists('backup_offsite_configured') ? backup_offsite_configured() : false,
            'replicaMode' => function_exists('backup_replica_mode') ? backup_replica_mode() : 'none'
        ];
    }

    $status = ($storageReady && $dataWritable) ? 'ok' : 'error';

    return [
        'status' => $status,
        'ok' => $status === 'ok',
        'timestamp' => local_date('c'),
        'version' => app_runtime_version(),
        'dataDirWritable' => $dataWritable,
        'storeEncrypted' => $storeEncrypted,
        'checks' => [
            'storage' => [
                'ready' => $storageReady,
                'writable' => $dataWritable,
                'encrypted' => $storeEncrypted
            ],
            'redis' => $redisStatus,
            'php_version' => PHP_VERSION,
            'backup' => $backupCheck
        ]
    ];
}
