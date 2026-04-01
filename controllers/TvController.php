<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/common.php';

class TvController
{
    /**
     * POST /api.php?resource=tv-heartbeat
     */
    public static function heartbeat(array $context = []): void
    {
        $payload = require_json_body();
        $deviceId = trim((string) ($payload['device_id'] ?? ''));
        $version = trim((string) ($payload['version'] ?? ''));
        $url = trim((string) ($payload['surface_url'] ?? ''));
        $status = trim((string) ($payload['status'] ?? 'unknown'));

        if ($deviceId === '') {
            json_response(['ok' => false, 'error' => 'device_id es requerido'], 400);
        }

        // Se guarda todo en 'data/tv_heartbeats.json' para monitoreo simple
        $dbPath = __DIR__ . '/../data/tv_heartbeats.json';
        if (!is_dir(dirname($dbPath))) {
            @mkdir(dirname($dbPath), 0775, true);
        }

        $now = local_date('c');
        $lockPath = $dbPath . '.lock';
        $lockFp = @fopen($lockPath, 'c+');

        if ($lockFp && flock($lockFp, LOCK_EX)) {
            $data = [];
            if (is_file($dbPath)) {
                $content = @file_get_contents($dbPath);
                $decoded = is_string($content) ? json_decode($content, true) : null;
                if (is_array($decoded)) {
                    $data = $decoded;
                }
            }

            $data[$deviceId] = [
                'device_id' => $deviceId,
                'version' => $version,
                'surface_url' => $url,
                'status' => $status,
                'last_seen_at' => $now,
            ];

            // Limpieza de dispositivos que no se ven por más de 30 días
            $thirtyDaysAgo = time() - (86400 * 30);
            foreach ($data as $k => $deviceInfo) {
                $lastSeen = strtotime((string) ($deviceInfo['last_seen_at'] ?? ''));
                if ($lastSeen !== false && $lastSeen < $thirtyDaysAgo) {
                    unset($data[$k]);
                }
            }

            @file_put_contents($dbPath, json_encode($data, JSON_PRETTY_PRINT));
            
            flock($lockFp, LOCK_UN);
            fclose($lockFp);
        } else {
            error_log("TvController::heartbeat -> Cannot acquire lock on $lockPath");
        }

        json_response([
            'ok' => true,
            'recorded_at' => $now
        ]);
    }

    /**
     * GET /api.php?resource=tv-config
     */
    public static function config(array $context = []): void
    {
        // Esto permite gobernar dinamicamente el entorno del Turnero TV
        // Se pueden inyectar overrides leyendo una base de datos o env si se prefiere.
        $baseUrl = app_env('AURORADERM_TV_BASE_URL');
        if (!is_string($baseUrl) || trim($baseUrl) === '') {
            $baseUrl = 'https://pielarmonia.com';
        }

        $surfacePath = app_env('AURORADERM_TV_SURFACE_PATH');
        if (!is_string($surfacePath) || trim($surfacePath) === '') {
            $surfacePath = '/sala-turnos.html';
        }

        json_response([
            'ok' => true,
            'baseUrl' => trim($baseUrl),
            'surfacePath' => trim($surfacePath),
            'features' => [
                'heartbeatIntervalMs' => 60000,
            ]
        ]);
    }

    public static function handle(array $context): void
    {
        $resource = $context['resource'] ?? '';
        $method = $context['method'] ?? 'GET';
        $key = "$method:$resource";
        
        switch ($key) {
            case 'POST:tv-heartbeat':
                self::heartbeat($context);
                return;
            case 'GET:tv-config':
                self::config($context);
                return;
            default:
                if (isset($context['action'])) {
                    $action = $context['action'];
                    switch ($action) {
                        case 'heartbeat':
                            self::heartbeat($context);
                            return;
                        case 'config':
                            self::config($context);
                            return;
                    }
                }
                json_response(['ok' => false, 'error' => 'Not found in controller dispatch: ' . $key], 404);
        }
    }
}
