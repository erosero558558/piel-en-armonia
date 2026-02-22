<?php

declare(strict_types=1);

/**
 * Redis connection helper.
 */

function get_redis_client(): ?\Predis\Client
{
    static $client = null;

    if ($client !== null) {
        return $client;
    }

    $host = getenv('PIELARMONIA_REDIS_HOST');
    if (!$host) {
        // Fallback to localhost if explicitly requested or just return null?
        // Let's stick to returning null if not configured to allow safe fallback.
        return null;
    }

    $port = getenv('PIELARMONIA_REDIS_PORT') ?: 6379;
    $password = getenv('PIELARMONIA_REDIS_PASSWORD');

    try {
        $options = [
            'scheme' => 'tcp',
            'host'   => $host,
            'port'   => (int)$port,
            'timeout' => 2.0,
        ];

        if ($password) {
            $options['password'] = $password;
        }

        $client = new \Predis\Client($options);
        $client->connect();
    } catch (\Exception $e) {
        // En caso de error de conexión, devolvemos null para que el sistema haga fallback
        if (function_exists('error_log')) {
            error_log('Redis connection error: ' . $e->getMessage());
        }
        return null;
    }

    return $client;
}
