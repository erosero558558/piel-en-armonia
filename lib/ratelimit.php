<?php
declare(strict_types=1);

/**
 * Rate limiting logic with Redis support.
 */

function get_redis_client(): ?Predis\Client
{
    static $client = null;
    if ($client !== null) {
        return $client;
    }

    // Check if Redis is configured
    $host = getenv('PIELARMONIA_REDIS_HOST');
    if (!is_string($host) || trim($host) === '') {
        return null;
    }

    $port = getenv('PIELARMONIA_REDIS_PORT');
    if (!is_string($port) || trim($port) === '') {
        $port = '6379';
    }

    $password = getenv('PIELARMONIA_REDIS_PASSWORD');
    $prefix = getenv('PIELARMONIA_REDIS_PREFIX') ?: 'pielarmonia:';

    if (!class_exists('Predis\Client')) {
        error_log('Piel en Armonía: Redis configured but predis/predis not installed.');
        return null;
    }

    try {
        $config = [
            'scheme' => 'tcp',
            'host'   => trim($host),
            'port'   => (int) trim($port),
        ];

        if (is_string($password) && trim($password) !== '') {
            $config['password'] = trim($password);
        }

        $options = [
            'prefix' => $prefix
        ];

        $client = new Predis\Client($config, $options);
        // Test connection? Maybe too slow for every request. Predis lazy connects.
        return $client;
    } catch (Throwable $e) {
        error_log('Piel en Armonía: Redis connection error: ' . $e->getMessage());
        return null;
    }
}

function check_rate_limit(string $action, int $maxRequests = 10, int $windowSeconds = 60): bool
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    // Use the same key generation logic for consistency, though implementation differs
    $key = 'ratelimit:' . md5($ip . ':' . $action);

    $redis = get_redis_client();
    if ($redis) {
        try {
            $current = $redis->incr($key);
            if ($current === 1) {
                $redis->expire($key, $windowSeconds);
            }
            if ($current > $maxRequests) {
                return false;
            }
            return true;
        } catch (Throwable $e) {
            error_log('Piel en Armonía: Redis operation failed, falling back to file: ' . $e->getMessage());
            // Fallback to file-based
        }
    }

    // Fallback: File-based implementation
    $keyHash = md5($ip . ':' . $action);
    $rateDir = data_dir_path() . DIRECTORY_SEPARATOR . 'ratelimit';

    // Sharding: usar los primeros 2 caracteres del hash para distribuir archivos en subdirectorios
    $shard = substr($keyHash, 0, 2);
    $shardDir = $rateDir . DIRECTORY_SEPARATOR . $shard;

    if (!@is_dir($shardDir)) {
        @mkdir($shardDir, 0775, true);
    }

    $file = $shardDir . DIRECTORY_SEPARATOR . $keyHash . '.json';
    $now = time();
    $entries = [];

    if (file_exists($file)) {
        $raw = @file_get_contents($file);
        $entries = is_string($raw) ? (json_decode($raw, true) ?? []) : [];
    }

    // Filtrar entradas dentro de la ventana de tiempo
    $entries = array_values(array_filter($entries, static function (int $ts) use ($now, $windowSeconds): bool {
        return ($now - $ts) < $windowSeconds;
    }));

    if (count($entries) >= $maxRequests) {
        return false;
    }

    $entries[] = $now;
    @file_put_contents($file, json_encode($entries), LOCK_EX);

    // Limpieza periódica: eliminar archivos de rate limit con más de 1 hora sin modificación
    // Optimizacion: Solo limpiar un shard aleatorio (1/256 del total) para evitar scanear todo el directorio
    if (mt_rand(1, 50) === 1) {
        $randomShard = sprintf('%02x', mt_rand(0, 255));
        $targetDir = $rateDir . DIRECTORY_SEPARATOR . $randomShard;

        $allFiles = @glob($targetDir . DIRECTORY_SEPARATOR . '*.json');
        if (is_array($allFiles)) {
            foreach ($allFiles as $f) {
                if (($now - (int) @filemtime($f)) > 3600) {
                    @unlink($f);
                }
            }
        }
    }

    return true;
}

function require_rate_limit(string $action, int $maxRequests = 10, int $windowSeconds = 60): void
{
    if (!check_rate_limit($action, $maxRequests, $windowSeconds)) {
        json_response([
            'ok' => false,
            'error' => 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.'
        ], 429);
    }
}
