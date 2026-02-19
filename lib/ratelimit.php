<?php
declare(strict_types=1);

/**
 * Rate limiting logic.
 */

function check_rate_limit(string $action, int $maxRequests = 10, int $windowSeconds = 60): bool
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $key = md5($ip . ':' . $action);
    $rateDir = data_dir_path() . DIRECTORY_SEPARATOR . 'ratelimit';

    // Sharding: usar los primeros 2 caracteres del hash para distribuir archivos en subdirectorios
    $shard = substr($key, 0, 2);
    $shardDir = $rateDir . DIRECTORY_SEPARATOR . $shard;

    if (!@is_dir($shardDir)) {
        @mkdir($shardDir, 0775, true);
    }

    $file = $shardDir . DIRECTORY_SEPARATOR . $key . '.json';
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
