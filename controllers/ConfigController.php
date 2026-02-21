<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/figo_utils.php';

class ConfigController
{
    public static function getFigoConfig(array $context): void
    {
        $configMeta = api_read_figo_config_with_meta();
        $candidatePaths = api_figo_config_candidate_paths();
        $writePath = $candidatePaths[0] ?? (string) ($configMeta['path'] ?? api_resolve_figo_config_path());
        $config = is_array($configMeta['config'] ?? null) ? $configMeta['config'] : [];
        $masked = api_mask_figo_config($config);
        $aiNode = (isset($config['ai']) && is_array($config['ai'])) ? $config['ai'] : [];
        $aiEndpoint = isset($aiNode['endpoint']) && is_string($aiNode['endpoint']) ? trim((string) $aiNode['endpoint']) : '';
        $figoEndpoint = isset($config['endpoint']) && is_string($config['endpoint']) ? trim((string) $config['endpoint']) : '';

        json_response([
            'ok' => true,
            'data' => $masked,
            'exists' => (bool) ($configMeta['exists'] ?? false),
            'path' => basename((string) ($configMeta['path'] ?? 'figo-config.json')),
            'activePath' => (string) ($configMeta['path'] ?? ''),
            'writePath' => (string) $writePath,
            'figoEndpointConfigured' => $figoEndpoint !== '',
            'aiConfigured' => $aiEndpoint !== '',
            'timestamp' => gmdate('c')
        ]);
    }

    public static function updateFigoConfig(array $context): void
    {
        require_rate_limit('figo-config', 6, 60);

        $payload = require_json_body();
        if (!is_array($payload)) {
            json_response([
                'ok' => false,
                'error' => 'Payload invalido'
            ], 400);
        }

        $configMeta = api_read_figo_config_with_meta();
        $current = is_array($configMeta['config'] ?? null) ? $configMeta['config'] : [];

        try {
            $next = api_merge_figo_config($current, $payload);
        } catch (RuntimeException $e) {
            $status = $e->getCode() >= 400 && $e->getCode() < 600 ? (int) $e->getCode() : 400;
            $msg = function_exists('api_error_message_for_client') ? api_error_message_for_client($e, $status) : $e->getMessage();
            json_response([
                'ok' => false,
                'error' => $msg
            ], $status);
        }

        $candidatePaths = api_figo_config_candidate_paths();
        $path = (string) ($candidatePaths[0] ?? ($configMeta['path'] ?? api_resolve_figo_config_path()));
        $dir = dirname($path);

        if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) {
            json_response([
                'ok' => false,
                'error' => 'No se pudo crear el directorio de configuracion en ' . $dir
            ], 500);
        }

        if (!is_file($path)) {
            @chmod($dir, 0775);
        } else {
            @chmod($path, 0664);
        }

        if ((is_file($path) && !is_writable($path)) || (!is_file($path) && !is_writable($dir))) {
            json_response([
                'ok' => false,
                'error' => 'No hay permisos para guardar la configuracion en ' . $path
            ], 500);
        }

        $encoded = json_encode($next, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($encoded)) {
            json_response([
                'ok' => false,
                'error' => 'No se pudo serializar la configuracion'
            ], 500);
        }

        $bytes = @file_put_contents($path, $encoded . PHP_EOL, LOCK_EX);
        if (!is_int($bytes)) {
            json_response([
                'ok' => false,
                'error' => 'No se pudo guardar figo-config.json'
            ], 500);
        }

        $aiNode = (isset($next['ai']) && is_array($next['ai'])) ? $next['ai'] : [];
        $aiEndpoint = isset($aiNode['endpoint']) && is_string($aiNode['endpoint']) ? trim((string) $aiNode['endpoint']) : '';
        $figoEndpoint = isset($next['endpoint']) && is_string($next['endpoint']) ? trim((string) $next['endpoint']) : '';
        $figoHost = '';
        if ($figoEndpoint !== '') {
            $figoParts = @parse_url($figoEndpoint);
            if (is_array($figoParts) && isset($figoParts['host']) && is_string($figoParts['host'])) {
                $figoHost = strtolower(trim((string) $figoParts['host']));
            }
        }

        audit_log_event('figo.config_updated', [
            'path' => basename($path),
            'figoEndpointConfigured' => $figoEndpoint !== '',
            'figoEndpointHost' => $figoHost,
            'aiConfigured' => $aiEndpoint !== '',
            'allowLocalFallback' => isset($next['allowLocalFallback']) ? (bool) $next['allowLocalFallback'] : null
        ]);

        json_response([
            'ok' => true,
            'saved' => true,
            'path' => basename($path),
            'bytes' => $bytes,
            'data' => api_mask_figo_config($next),
            'figoEndpointConfigured' => $figoEndpoint !== '',
            'aiConfigured' => $aiEndpoint !== '',
            'timestamp' => gmdate('c')
        ]);
    }
}
