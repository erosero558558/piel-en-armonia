<?php
declare(strict_types=1);

/**
 * Figo Configuration Controller
 * Handles chatbot configuration management
 */

require_once __DIR__ . '/../api-lib.php';

class FigoConfigController
{
    /**
     * GET /figo-config - Retrieve current configuration (masked)
     */
    public static function show(array $context): void
    {
        $configMeta = self::readFigoConfigWithMeta();
        $candidatePaths = self::getConfigCandidatePaths();
        $writePath = $candidatePaths[0] ?? (string) ($configMeta['path'] ?? self::resolveConfigPath());
        $config = is_array($configMeta['config'] ?? null) ? $configMeta['config'] : [];
        $masked = self::maskConfig($config);
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

    /**
     * POST/PUT/PATCH /figo-config - Update configuration
     */
    public static function update(array $context): void
    {
        require_rate_limit('figo-config', 6, 60);

        $payload = require_json_body();
        if (!is_array($payload)) {
            json_response([
                'ok' => false,
                'error' => 'Payload invalido'
            ], 400);
        }

        $configMeta = self::readFigoConfigWithMeta();
        $current = is_array($configMeta['config'] ?? null) ? $configMeta['config'] : [];

        try {
            $next = self::mergeConfig($current, $payload);
        } catch (RuntimeException $e) {
            $status = $e->getCode() >= 400 && $e->getCode() < 600 ? (int) $e->getCode() : 400;
            json_response([
                'ok' => false,
                'error' => self::errorMessageForClient($e, $status)
            ], $status);
        }

        $candidatePaths = self::getConfigCandidatePaths();
        $path = (string) ($candidatePaths[0] ?? ($configMeta['path'] ?? self::resolveConfigPath()));
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
            'data' => self::maskConfig($next),
            'figoEndpointConfigured' => $figoEndpoint !== '',
            'aiConfigured' => $aiEndpoint !== '',
            'timestamp' => gmdate('c')
        ]);
    }

    /**
     * Read figo config with metadata
     */
    private static function readFigoConfigWithMeta(): array
    {
        $paths = self::getConfigCandidatePaths();
        foreach ($paths as $path) {
            if (!is_file($path)) {
                continue;
            }
            $raw = @file_get_contents($path);
            if (!is_string($raw) || trim($raw) === '') {
                continue;
            }
            $decoded = json_decode($raw, true);
            if (!is_array($decoded)) {
                continue;
            }
            return [
                'exists' => true,
                'path' => $path,
                'config' => $decoded
            ];
        }
        return [
            'exists' => false,
            'path' => '',
            'config' => []
        ];
    }

    /**
     * Get candidate paths for figo config
     */
    private static function getConfigCandidatePaths(): array
    {
        $paths = [];

        $customBackendPath = getenv('FIGO_BACKEND_CONFIG_PATH');
        if (is_string($customBackendPath) && trim($customBackendPath) !== '') {
            $paths[] = trim($customBackendPath);
        }

        $customChatPath = getenv('FIGO_CHAT_CONFIG_PATH');
        if (is_string($customChatPath) && trim($customChatPath) !== '') {
            $paths[] = trim($customChatPath);
        }

        $paths[] = data_dir_path() . DIRECTORY_SEPARATOR . 'figo-config.json';
        $paths[] = __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'figo-config.json';
        $paths[] = __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'figo-config.json';

        $normalized = [];
        foreach ($paths as $path) {
            $path = trim((string) $path);
            if ($path === '') {
                continue;
            }
            $path = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $path);
            if (!in_array($path, $normalized, true)) {
                $normalized[] = $path;
            }
        }

        return $normalized;
    }

    /**
     * Resolve default config path
     */
    private static function resolveConfigPath(): string
    {
        return data_dir_path() . DIRECTORY_SEPARATOR . 'figo-config.json';
    }

    /**
     * Mask sensitive values in config for API response
     */
    private static function maskConfig(array $config): array
    {
        $masked = [];
        foreach ($config as $key => $value) {
            if (is_array($value)) {
                $masked[$key] = self::maskConfig($value);
            } elseif (is_string($value)) {
                $lowerKey = strtolower($key);
                if (strpos($lowerKey, 'key') !== false ||
                    strpos($lowerKey, 'token') !== false ||
                    strpos($lowerKey, 'secret') !== false ||
                    strpos($lowerKey, 'password') !== false) {
                    $masked[$key] = self::maskString($value);
                } else {
                    $masked[$key] = $value;
                }
            } else {
                $masked[$key] = $value;
            }
        }
        return $masked;
    }

    /**
     * Mask a sensitive string
     */
    private static function maskString(string $value): string
    {
        $len = strlen($value);
        if ($len <= 8) {
            return '***';
        }
        return substr($value, 0, 4) . '***' . substr($value, -4);
    }

    /**
     * Merge existing config with updates
     */
    private static function mergeConfig(array $current, array $updates): array
    {
        $merged = $current;

        foreach ($updates as $key => $value) {
            // Allow null to remove keys
            if ($value === null && array_key_exists($key, $merged)) {
                unset($merged[$key]);
                continue;
            }

            // Merge nested arrays recursively
            if (is_array($value) && isset($merged[$key]) && is_array($merged[$key])) {
                $merged[$key] = self::mergeConfig($merged[$key], $value);
            } else {
                $merged[$key] = $value;
            }
        }

        // Validate AI endpoint to prevent recursive config
        $aiNode = (isset($merged['ai']) && is_array($merged['ai'])) ? $merged['ai'] : [];
        $aiEndpoint = isset($aiNode['endpoint']) && is_string($aiNode['endpoint']) ? trim((string) $aiNode['endpoint']) : '';
        if ($aiEndpoint !== '' && self::isRecursiveEndpoint($aiEndpoint)) {
            throw new RuntimeException('El endpoint de IA apunta a este mismo servidor. Configura un endpoint externo valido.', 400);
        }

        $figoEndpoint = isset($merged['endpoint']) && is_string($merged['endpoint']) ? trim((string) $merged['endpoint']) : '';
        if ($figoEndpoint !== '' && self::isRecursiveEndpoint($figoEndpoint)) {
            throw new RuntimeException('El endpoint de Figo apunta a este mismo servidor. Configura un endpoint externo valido.', 400);
        }

        return $merged;
    }

    /**
     * Check if endpoint points to current server (recursive)
     */
    private static function isRecursiveEndpoint(string $endpoint): bool
    {
        $endpoint = trim($endpoint);
        if ($endpoint === '') {
            return false;
        }

        $parts = @parse_url($endpoint);
        if (!is_array($parts)) {
            return false;
        }

        $endpointHost = strtolower((string) ($parts['host'] ?? ''));
        $endpointPath = strtolower((string) ($parts['path'] ?? ''));
        $currentHost = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));

        $requestUri = (string) ($_SERVER['REQUEST_URI'] ?? '/api.php');
        $requestPath = strtolower((string) parse_url($requestUri, PHP_URL_PATH));
        if ($requestPath === '') {
            $requestPath = '/api.php';
        }

        if ($endpointHost === '' || $currentHost === '') {
            return false;
        }

        $normalizedEndpointHost = preg_replace('/^www\./', '', $endpointHost);
        $normalizedCurrentHost = preg_replace('/^www\./', '', $currentHost);

        if ($normalizedEndpointHost !== $normalizedCurrentHost) {
            return false;
        }

        if ($endpointPath === '') {
            return false;
        }

        if ($endpointPath === $requestPath) {
            return true;
        }

        return $endpointPath === '/figo-chat.php';
    }

    /**
     * Get error message for client (hide technical details)
     */
    private static function errorMessageForClient(Throwable $error, int $status): string
    {
        $debugEnabled = parse_bool(getenv('PIELARMONIA_DEBUG_EXCEPTIONS') ?: false);
        if ($debugEnabled) {
            return $error->getMessage();
        }
        return $status >= 500 ? 'Error interno del servidor' : $error->getMessage();
    }
}
