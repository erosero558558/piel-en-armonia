<?php

declare(strict_types=1);

final class FigoRouter
{
    public static function FigoRouter::api_resolve_figo_endpoint_for_health(): string
    {
        $envCandidates = [
            getenv('FIGO_CHAT_ENDPOINT'),
            getenv('FIGO_CHAT_URL'),
            getenv('FIGO_CHAT_API_URL'),
            getenv('FIGO_ENDPOINT'),
            getenv('FIGO_URL'),
            getenv('CLAWBOT_ENDPOINT'),
            getenv('CLAWBOT_URL'),
            getenv('CHATBOT_ENDPOINT'),
            getenv('CHATBOT_URL'),
            getenv('BOT_ENDPOINT'),
            app_env('AURORADERM_FIGO_ENDPOINT')
        ];
    
        foreach ($envCandidates as $candidate) {
            if (is_string($candidate) && trim($candidate) !== '') {
                return trim($candidate);
            }
        }
    
        $configCandidates = [];
        $customPath = getenv('FIGO_CHAT_CONFIG_PATH');
        if (is_string($customPath) && trim($customPath) !== '') {
            $configCandidates[] = trim($customPath);
        }
    
        $configCandidates[] = data_dir_path() . DIRECTORY_SEPARATOR . 'figo-config.json';
        $configCandidates[] = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'figo-config.json';
        $configCandidates[] = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'figo-config.json';
    
        foreach ($configCandidates as $path) {
            if (!is_string($path) || $path === '' || !is_file($path)) {
                continue;
            }
            $raw = @file_get_contents($path);
            if (!is_string($raw) || trim($raw) === '') {
                continue;
            }
            $raw = FigoSanitizer::api_strip_utf8_bom($raw);
            $decoded = json_decode($raw, true);
            if (!is_array($decoded)) {
                continue;
            }
            $fileCandidates = [
                $decoded['endpoint'] ?? null,
                $decoded['apiUrl'] ?? null,
                $decoded['url'] ?? null
            ];
            foreach ($fileCandidates as $candidate) {
                if (is_string($candidate) && trim($candidate) !== '') {
                    return trim($candidate);
                }
            }
        }
    
        return '';
    }

    public static function FigoRouter::api_is_figo_recursive_config(string $endpoint): bool
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
    
        // Permite comparacion robusta entre host directo y variante www.
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

    public static function FigoRouter::api_figo_config_candidate_paths(): array
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
        $paths[] = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'figo-config.json';
        $paths[] = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'figo-config.json';
    
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

    public static function FigoRouter::api_resolve_figo_config_path(): string
    {
        $candidates = FigoRouter::api_figo_config_candidate_paths();
        foreach ($candidates as $candidate) {
            if (is_file($candidate)) {
                return $candidate;
            }
        }
    
        return $candidates[0] ?? (dirname(__DIR__) . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'figo-config.json');
    }

    public static function FigoRouter::api_read_figo_config_with_meta(): array
    {
        $path = FigoRouter::api_resolve_figo_config_path();
        if (!is_file($path)) {
            return [
                'exists' => false,
                'path' => $path,
                'config' => []
            ];
        }
    
        $raw = @file_get_contents($path);
        if (!is_string($raw) || trim($raw) === '') {
            return [
                'exists' => true,
                'path' => $path,
                'config' => []
            ];
        }
    
        $raw = FigoSanitizer::api_strip_utf8_bom($raw);
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return [
                'exists' => true,
                'path' => $path,
                'config' => []
            ];
        }
    
        return [
            'exists' => true,
            'path' => $path,
            'config' => $decoded
        ];
    }

    public static function FigoRouter::api_merge_figo_config(array $existing, array $payload): array
    {
        $next = $existing;
        $endpointTouched = false;
        $aiEndpointTouched = false;
        $openclawEndpointTouched = false;
    
        foreach (['endpoint', 'token', 'apiKeyHeader', 'apiKey'] as $key) {
            if (!array_key_exists($key, $payload)) {
                continue;
            }
    
            if ($key === 'endpoint') {
                $endpointTouched = true;
            }
    
            $value = $payload[$key];
            if ($value === null) {
                unset($next[$key]);
                continue;
            }
    
            if (!is_string($value)) {
                throw new RuntimeException($key . ' debe ser texto', 400);
            }
    
            $value = trim($value);
            if ($value === '') {
                unset($next[$key]);
                continue;
            }
    
            $next[$key] = $value;
        }
    
        if (array_key_exists('providerMode', $payload)) {
            $rawMode = $payload['providerMode'];
            if ($rawMode === null || (is_string($rawMode) && trim($rawMode) === '')) {
                unset($next['providerMode']);
            } elseif (!is_string($rawMode)) {
                throw new RuntimeException('providerMode debe ser texto', 400);
            } else {
                $mode = strtolower(trim($rawMode));
                if (!in_array($mode, ['legacy_proxy', 'openclaw_queue'], true)) {
                    throw new RuntimeException('providerMode invalido. Usa legacy_proxy u openclaw_queue', 400);
                }
                $next['providerMode'] = $mode;
            }
        }
    
        foreach (
            [
                'openclawGatewayEndpoint',
                'openclawGatewayApiKey',
                'openclawGatewayModel',
                'openclawGatewayKeyHeader',
                'openclawGatewayKeyPrefix'
            ] as $key
        ) {
            if (!array_key_exists($key, $payload)) {
                continue;
            }
    
            if ($key === 'openclawGatewayEndpoint') {
                $openclawEndpointTouched = true;
            }
    
            $value = $payload[$key];
            if ($value === null) {
                unset($next[$key]);
                continue;
            }
    
            if (!is_string($value)) {
                throw new RuntimeException($key . ' debe ser texto', 400);
            }
    
            $value = trim($value);
            if ($value === '') {
                unset($next[$key]);
                continue;
            }
    
            $next[$key] = $value;
        }
    
        if (array_key_exists('openclaw', $payload)) {
            $rawOpenclaw = $payload['openclaw'];
            if ($rawOpenclaw === null) {
                unset($next['openclaw']);
            } else {
                if (!is_array($rawOpenclaw)) {
                    throw new RuntimeException('openclaw debe ser un objeto JSON', 400);
                }
    
                $openclawNext = (isset($next['openclaw']) && is_array($next['openclaw'])) ? $next['openclaw'] : [];
                foreach (['endpoint', 'apiKey', 'model', 'apiKeyHeader', 'apiKeyPrefix'] as $openclawKey) {
                    if (!array_key_exists($openclawKey, $rawOpenclaw)) {
                        continue;
                    }
    
                    if ($openclawKey === 'endpoint') {
                        $openclawEndpointTouched = true;
                    }
    
                    $openclawValue = $rawOpenclaw[$openclawKey];
                    if ($openclawValue === null) {
                        unset($openclawNext[$openclawKey]);
                        continue;
                    }
    
                    if (!is_string($openclawValue)) {
                        throw new RuntimeException('openclaw.' . $openclawKey . ' debe ser texto', 400);
                    }
    
                    $openclawValue = trim($openclawValue);
                    if ($openclawValue === '') {
                        unset($openclawNext[$openclawKey]);
                        continue;
                    }
    
                    $openclawNext[$openclawKey] = $openclawValue;
                }
    
                if (array_key_exists('providerMode', $rawOpenclaw)) {
                    $rawOpenclawMode = $rawOpenclaw['providerMode'];
                    if ($rawOpenclawMode === null || (is_string($rawOpenclawMode) && trim($rawOpenclawMode) === '')) {
                        unset($openclawNext['providerMode']);
                    } elseif (!is_string($rawOpenclawMode)) {
                        throw new RuntimeException('openclaw.providerMode debe ser texto', 400);
                    } else {
                        $openclawMode = strtolower(trim($rawOpenclawMode));
                        if (!in_array($openclawMode, ['legacy_proxy', 'openclaw_queue'], true)) {
                            throw new RuntimeException('openclaw.providerMode invalido. Usa legacy_proxy u openclaw_queue', 400);
                        }
                        $openclawNext['providerMode'] = $openclawMode;
                    }
                }
    
                if (empty($openclawNext)) {
                    unset($next['openclaw']);
                } else {
                    $next['openclaw'] = $openclawNext;
                }
            }
        }
    
        if (array_key_exists('timeout', $payload)) {
            $rawTimeout = $payload['timeout'];
            if ($rawTimeout === null || (is_string($rawTimeout) && trim($rawTimeout) === '')) {
                unset($next['timeout']);
            } elseif (!is_numeric($rawTimeout)) {
                throw new RuntimeException('timeout debe ser numerico', 400);
            } else {
                $timeout = (int) $rawTimeout;
                if ($timeout < 5) {
                    $timeout = 5;
                }
                if ($timeout > 45) {
                    $timeout = 45;
                }
                $next['timeout'] = $timeout;
            }
        }
    
        if (array_key_exists('allowLocalFallback', $payload)) {
            $parsed = FigoSanitizer::api_parse_optional_bool($payload['allowLocalFallback']);
            if ($parsed === null) {
                throw new RuntimeException('allowLocalFallback debe ser booleano', 400);
            }
            $next['allowLocalFallback'] = $parsed;
        }
    
        if (array_key_exists('ai', $payload)) {
            $rawAi = $payload['ai'];
            if ($rawAi === null) {
                unset($next['ai']);
            } else {
                if (!is_array($rawAi)) {
                    throw new RuntimeException('ai debe ser un objeto JSON', 400);
                }
    
                $aiNext = (isset($next['ai']) && is_array($next['ai'])) ? $next['ai'] : [];
                foreach (['endpoint', 'apiKey', 'model', 'apiKeyHeader', 'apiKeyPrefix'] as $aiKey) {
                    if (!array_key_exists($aiKey, $rawAi)) {
                        continue;
                    }
    
                    if ($aiKey === 'endpoint') {
                        $aiEndpointTouched = true;
                    }
    
                    $aiValue = $rawAi[$aiKey];
                    if ($aiValue === null) {
                        unset($aiNext[$aiKey]);
                        continue;
                    }
    
                    if (!is_string($aiValue)) {
                        throw new RuntimeException('ai.' . $aiKey . ' debe ser texto', 400);
                    }
    
                    $aiValue = trim($aiValue);
                    if ($aiValue === '') {
                        unset($aiNext[$aiKey]);
                        continue;
                    }
    
                    $aiNext[$aiKey] = $aiValue;
                }
    
                if (array_key_exists('timeoutSeconds', $rawAi)) {
                    $rawAiTimeout = $rawAi['timeoutSeconds'];
                    if ($rawAiTimeout === null || (is_string($rawAiTimeout) && trim($rawAiTimeout) === '')) {
                        unset($aiNext['timeoutSeconds']);
                    } elseif (!is_numeric($rawAiTimeout)) {
                        throw new RuntimeException('ai.timeoutSeconds debe ser numerico', 400);
                    } else {
                        $aiTimeout = (int) $rawAiTimeout;
                        if ($aiTimeout < 5) {
                            $aiTimeout = 5;
                        }
                        if ($aiTimeout > 45) {
                            $aiTimeout = 45;
                        }
                        $aiNext['timeoutSeconds'] = $aiTimeout;
                    }
                }
    
                if (array_key_exists('allowLocalFallback', $rawAi)) {
                    $aiBool = FigoSanitizer::api_parse_optional_bool($rawAi['allowLocalFallback']);
                    if ($aiBool === null) {
                        throw new RuntimeException('ai.allowLocalFallback debe ser booleano', 400);
                    }
                    $aiNext['allowLocalFallback'] = $aiBool;
                }
    
                if (empty($aiNext)) {
                    unset($next['ai']);
                } else {
                    $next['ai'] = $aiNext;
                }
            }
        }
    
        if ($endpointTouched && isset($next['endpoint']) && is_string($next['endpoint'])) {
            FigoSanitizer::api_validate_absolute_http_url((string) $next['endpoint'], 'endpoint');
            if (FigoRouter::api_is_figo_recursive_config((string) $next['endpoint'])) {
                throw new RuntimeException('endpoint no debe apuntar a /figo-chat.php', 400);
            }
        }
    
        if ($aiEndpointTouched && isset($next['ai']) && is_array($next['ai']) && isset($next['ai']['endpoint']) && is_string($next['ai']['endpoint'])) {
            FigoSanitizer::api_validate_absolute_http_url((string) $next['ai']['endpoint'], 'ai.endpoint');
        }
    
        if ($openclawEndpointTouched) {
            $openclawEndpoint = '';
            if (isset($next['openclawGatewayEndpoint']) && is_string($next['openclawGatewayEndpoint'])) {
                $openclawEndpoint = trim((string) $next['openclawGatewayEndpoint']);
            }
            if (
                $openclawEndpoint === ''
                && isset($next['openclaw'])
                && is_array($next['openclaw'])
                && isset($next['openclaw']['endpoint'])
                && is_string($next['openclaw']['endpoint'])
            ) {
                $openclawEndpoint = trim((string) $next['openclaw']['endpoint']);
            }
            if ($openclawEndpoint !== '') {
                FigoSanitizer::api_validate_absolute_http_url($openclawEndpoint, 'openclaw.endpoint');
                if (FigoRouter::api_is_figo_recursive_config($openclawEndpoint)) {
                    throw new RuntimeException('openclaw.endpoint no debe apuntar a /figo-chat.php', 400);
                }
            }
        }
    
        return $next;
    }

    public static function FigoRouter::api_figo_read_config(): array
    {
        static $cached = null;
        if (is_array($cached)) {
            return $cached;
        }
    
        $meta = FigoRouter::api_read_figo_config_with_meta();
        $config = $meta['config'];
        if (isset($meta['path']) && is_string($meta['path']) && $meta['path'] !== '') {
            $config['__source'] = $meta['path'];
        }
    
        $cached = $config;
        return $cached;
    }

    public static function FigoRouter::api_figo_env_ai_endpoint(): string
    {
        $fileConfig = FigoRouter::api_figo_read_config();
        $aiNode = (isset($fileConfig['ai']) && is_array($fileConfig['ai'])) ? $fileConfig['ai'] : [];
    
        return FigoSanitizer::api_first_non_empty([
            getenv('FIGO_AI_API_URL'),
            getenv('FIGO_AI_ENDPOINT'),
            getenv('FIGO_AI_URL'),
            $fileConfig['aiEndpoint'] ?? null,
            $fileConfig['aiUrl'] ?? null,
            $aiNode['endpoint'] ?? null,
            $aiNode['url'] ?? null
        ]);
    }

    public static function FigoRouter::api_figo_env_ai_key(): string
    {
        $fileConfig = FigoRouter::api_figo_read_config();
        $aiNode = (isset($fileConfig['ai']) && is_array($fileConfig['ai'])) ? $fileConfig['ai'] : [];
    
        return FigoSanitizer::api_first_non_empty([
            getenv('FIGO_AI_API_KEY'),
            getenv('FIGO_AI_KEY'),
            $fileConfig['aiApiKey'] ?? null,
            $fileConfig['aiKey'] ?? null,
            $aiNode['apiKey'] ?? null,
            $aiNode['key'] ?? null
        ]);
    }

    public static function FigoRouter::api_figo_env_ai_key_header(): string
    {
        $fileConfig = FigoRouter::api_figo_read_config();
        $aiNode = (isset($fileConfig['ai']) && is_array($fileConfig['ai'])) ? $fileConfig['ai'] : [];
    
        $header = FigoSanitizer::api_first_non_empty([
            getenv('FIGO_AI_API_KEY_HEADER'),
            getenv('FIGO_AI_KEY_HEADER'),
            $fileConfig['aiApiKeyHeader'] ?? null,
            $fileConfig['aiKeyHeader'] ?? null,
            $aiNode['apiKeyHeader'] ?? null,
            $aiNode['keyHeader'] ?? null
        ]);
    
        return $header !== '' ? $header : 'Authorization';
    }

    public static function FigoRouter::api_figo_env_ai_key_prefix(): string
    {
        $fileConfig = FigoRouter::api_figo_read_config();
        $aiNode = (isset($fileConfig['ai']) && is_array($fileConfig['ai'])) ? $fileConfig['ai'] : [];
    
        $prefix = FigoSanitizer::api_first_non_empty([
            getenv('FIGO_AI_API_KEY_PREFIX'),
            getenv('FIGO_AI_KEY_PREFIX'),
            $fileConfig['aiApiKeyPrefix'] ?? null,
            $fileConfig['aiKeyPrefix'] ?? null,
            $aiNode['apiKeyPrefix'] ?? null,
            $aiNode['keyPrefix'] ?? null
        ]);
    
        return $prefix !== '' ? $prefix : 'Bearer';
    }

    public static function FigoRouter::api_figo_env_ai_timeout_seconds(): int
    {
        $fileConfig = FigoRouter::api_figo_read_config();
        $aiNode = (isset($fileConfig['ai']) && is_array($fileConfig['ai'])) ? $fileConfig['ai'] : [];
    
        $raw = FigoSanitizer::api_first_non_empty([
            getenv('FIGO_AI_TIMEOUT_SECONDS'),
            $fileConfig['aiTimeoutSeconds'] ?? null,
            isset($aiNode['timeoutSeconds']) ? (string) $aiNode['timeoutSeconds'] : null
        ]);
    
        $timeout = (int) $raw;
        if ($timeout <= 0) {
            $timeout = 8;
        }
        if ($timeout < 2) {
            $timeout = 2;
        }
        if ($timeout > 25) {
            $timeout = 25;
        }
        return $timeout;
    }

    public static function FigoRouter::api_figo_env_ai_connect_timeout_seconds(): int
    {
        $fileConfig = FigoRouter::api_figo_read_config();
        $aiNode = (isset($fileConfig['ai']) && is_array($fileConfig['ai'])) ? $fileConfig['ai'] : [];
    
        $raw = FigoSanitizer::api_first_non_empty([
            getenv('FIGO_AI_CONNECT_TIMEOUT_SECONDS'),
            $fileConfig['aiConnectTimeoutSeconds'] ?? null,
            isset($aiNode['connectTimeoutSeconds']) ? (string) $aiNode['connectTimeoutSeconds'] : null
        ]);
    
        $requestTimeout = FigoRouter::api_figo_env_ai_timeout_seconds();
        $connectTimeout = (int) $raw;
        if ($connectTimeout <= 0) {
            $connectTimeout = max(1, min(3, $requestTimeout - 1));
        }
        if ($connectTimeout < 1) {
            $connectTimeout = 1;
        }
        if ($connectTimeout > 10) {
            $connectTimeout = 10;
        }
        if ($connectTimeout >= $requestTimeout) {
            $connectTimeout = max(1, $requestTimeout - 1);
        }
        return $connectTimeout;
    }

    public static function FigoRouter::api_figo_env_ai_failfast_window_seconds(): int
    {
        $fileConfig = FigoRouter::api_figo_read_config();
        $aiNode = (isset($fileConfig['ai']) && is_array($fileConfig['ai'])) ? $fileConfig['ai'] : [];
    
        $raw = FigoSanitizer::api_first_non_empty([
            getenv('FIGO_AI_FAILFAST_WINDOW_SECONDS'),
            $fileConfig['aiFailfastWindowSeconds'] ?? null,
            isset($aiNode['failfastWindowSeconds']) ? (string) $aiNode['failfastWindowSeconds'] : null
        ]);
    
        $normalizedRaw = is_string($raw) ? trim($raw) : '';
        if ($normalizedRaw === '') {
            $window = 45;
        } else {
            $window = (int) $normalizedRaw;
        }
        if ($window < 0) {
            $window = 0;
        }
        if ($window > 600) {
            $window = 600;
        }
    
        return $window;
    }

    public static function FigoRouter::api_figo_env_ai_max_tokens(): int
    {
        $fileConfig = FigoRouter::api_figo_read_config();
        $aiNode = (isset($fileConfig['ai']) && is_array($fileConfig['ai'])) ? $fileConfig['ai'] : [];
    
        $raw = FigoSanitizer::api_first_non_empty([
            getenv('FIGO_AI_MAX_TOKENS'),
            $fileConfig['aiMaxTokens'] ?? null,
            isset($aiNode['maxTokens']) ? (string) $aiNode['maxTokens'] : null
        ]);
    
        $maxTokens = (int) $raw;
        if ($maxTokens <= 0) {
            // Default conservador
            $maxTokens = 256;
        }
        if ($maxTokens < 96) {
            $maxTokens = 96;
        }
        if ($maxTokens > 1200) {
            $maxTokens = 1200;
        }
        return $maxTokens;
    }

    public static function FigoRouter::api_figo_env_ai_model(): string
    {
        $fileConfig = FigoRouter::api_figo_read_config();
        $aiNode = (isset($fileConfig['ai']) && is_array($fileConfig['ai'])) ? $fileConfig['ai'] : [];
    
        $model = FigoSanitizer::api_first_non_empty([
            getenv('FIGO_AI_MODEL'),
            $fileConfig['aiModel'] ?? null,
            $aiNode['model'] ?? null
        ]);
    
        return $model !== '' ? $model : 'auto';
    }

    public static function FigoRouter::api_figo_env_allow_local_fallback(): bool
    {
        $fileConfig = FigoRouter::api_figo_read_config();
        $aiNode = (isset($fileConfig['ai']) && is_array($fileConfig['ai'])) ? $fileConfig['ai'] : [];
    
        // Busca booleano explicito
        foreach ([
            getenv('FIGO_BACKEND_ALLOW_LOCAL_FALLBACK'),
            getenv('FIGO_AI_ALLOW_LOCAL_FALLBACK'),
            getenv('FIGO_ALLOW_LOCAL_FALLBACK'),
            isset($fileConfig['allowLocalFallback']) ? (string) $fileConfig['allowLocalFallback'] : null,
            isset($fileConfig['aiAllowLocalFallback']) ? (string) $fileConfig['aiAllowLocalFallback'] : null,
            isset($aiNode['allowLocalFallback']) ? (string) $aiNode['allowLocalFallback'] : null
        ] as $candidate) {
            $parsed = FigoSanitizer::api_parse_optional_bool($candidate);
            if ($parsed !== null) {
                return $parsed;
            }
        }
    
        // Compatibilidad: si todavia no hay IA configurada, permitir fallback local.
        return FigoRouter::api_figo_env_ai_endpoint() === '';
    }

    public static function FigoRouter::api_figo_env_provider_mode(): string
    {
        $fileConfig = FigoRouter::api_figo_read_config();
        $openclawNode = isset($fileConfig['openclaw']) && is_array($fileConfig['openclaw'])
            ? $fileConfig['openclaw'] : [];
    
        $mode = strtolower(FigoSanitizer::api_first_non_empty([
            getenv('FIGO_PROVIDER_MODE'),
            $fileConfig['providerMode'] ?? null,
            $openclawNode['providerMode'] ?? null
        ]));
    
        if ($mode !== 'openclaw_queue') {
            return 'legacy_proxy';
        }
        return $mode;
    }

    public static function FigoRouter::api_figo_env_gateway_endpoint(): string
    {
        $fileConfig = FigoRouter::api_figo_read_config();
        $openclawNode = isset($fileConfig['openclaw']) && is_array($fileConfig['openclaw'])
            ? $fileConfig['openclaw'] : [];
        $aiNode = isset($fileConfig['ai']) && is_array($fileConfig['ai'])
            ? $fileConfig['ai'] : [];
    
        return FigoSanitizer::api_first_non_empty([
            $fileConfig['openclawGatewayEndpoint'] ?? null,
            $openclawNode['endpoint'] ?? null,
            $aiNode['endpoint'] ?? null,
            getenv('FIGO_AI_API_URL'),
            getenv('FIGO_AI_ENDPOINT'),
            getenv('FIGO_AI_URL'),
            getenv('OPENCLAW_GATEWAY_ENDPOINT'),
            getenv('FIGO_OPENCLAW_GATEWAY_ENDPOINT'),
        ]);
    }

    public static function FigoRouter::api_figo_env_gateway_api_key(): string
    {
        $fileConfig = FigoRouter::api_figo_read_config();
        $openclawNode = isset($fileConfig['openclaw']) && is_array($fileConfig['openclaw'])
            ? $fileConfig['openclaw'] : [];
        $aiNode = isset($fileConfig['ai']) && is_array($fileConfig['ai'])
            ? $fileConfig['ai'] : [];
    
        return FigoSanitizer::api_first_non_empty([
            $fileConfig['openclawGatewayApiKey'] ?? null,
            $openclawNode['apiKey'] ?? null,
            $aiNode['apiKey'] ?? null,
            getenv('FIGO_AI_API_KEY'),
            getenv('FIGO_AI_KEY'),
            getenv('OPENCLAW_GATEWAY_API_KEY'),
            getenv('FIGO_OPENCLAW_GATEWAY_API_KEY'),
        ]);
    }

    public static function FigoRouter::api_figo_env_gateway_model(): string
    {
        $fileConfig = FigoRouter::api_figo_read_config();
        $openclawNode = isset($fileConfig['openclaw']) && is_array($fileConfig['openclaw'])
            ? $fileConfig['openclaw'] : [];
        $aiNode = isset($fileConfig['ai']) && is_array($fileConfig['ai'])
            ? $fileConfig['ai'] : [];
    
        $model = FigoSanitizer::api_first_non_empty([
            $fileConfig['openclawGatewayModel'] ?? null,
            $openclawNode['model'] ?? null,
            $aiNode['model'] ?? null,
            getenv('FIGO_AI_MODEL'),
            getenv('OPENCLAW_GATEWAY_MODEL'),
            getenv('FIGO_OPENCLAW_GATEWAY_MODEL'),
        ]);
    
        return $model !== '' ? $model : 'auto';
    }

    public static function FigoRouter::api_figo_env_gateway_key_header(): string
    {
        $fileConfig = FigoRouter::api_figo_read_config();
        $openclawNode = isset($fileConfig['openclaw']) && is_array($fileConfig['openclaw'])
            ? $fileConfig['openclaw'] : [];
        $aiNode = isset($fileConfig['ai']) && is_array($fileConfig['ai'])
            ? $fileConfig['ai'] : [];
    
        $header = FigoSanitizer::api_first_non_empty([
            $fileConfig['openclawGatewayKeyHeader'] ?? null,
            $openclawNode['apiKeyHeader'] ?? null,
            $aiNode['apiKeyHeader'] ?? null,
            getenv('OPENCLAW_GATEWAY_KEY_HEADER'),
            getenv('FIGO_OPENCLAW_GATEWAY_KEY_HEADER'),
            getenv('FIGO_AI_API_KEY_HEADER'),
            getenv('FIGO_AI_KEY_HEADER'),
        ]);
    
        return $header !== '' ? $header : 'Authorization';
    }

    public static function FigoRouter::api_figo_env_gateway_key_prefix(): string
    {
        $fileConfig = FigoRouter::api_figo_read_config();
        $openclawNode = isset($fileConfig['openclaw']) && is_array($fileConfig['openclaw'])
            ? $fileConfig['openclaw'] : [];
        $aiNode = isset($fileConfig['ai']) && is_array($fileConfig['ai'])
            ? $fileConfig['ai'] : [];
    
        $prefix = FigoSanitizer::api_first_non_empty([
            $fileConfig['openclawGatewayKeyPrefix'] ?? null,
            $openclawNode['apiKeyPrefix'] ?? null,
            $aiNode['apiKeyPrefix'] ?? null,
            getenv('OPENCLAW_GATEWAY_KEY_PREFIX'),
            getenv('FIGO_OPENCLAW_GATEWAY_KEY_PREFIX'),
            getenv('FIGO_AI_API_KEY_PREFIX'),
            getenv('FIGO_AI_KEY_PREFIX'),
        ]);
    
        return $prefix !== '' ? $prefix : 'Bearer';
    }

}
