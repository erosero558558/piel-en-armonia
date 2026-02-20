<?php
declare(strict_types=1);

require_once __DIR__ . '/storage.php';

function api_resolve_figo_endpoint_for_health(): string
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
        getenv('PIELARMONIA_FIGO_ENDPOINT')
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

function api_is_figo_recursive_config(string $endpoint): bool
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

function api_figo_config_candidate_paths(): array
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

function api_resolve_figo_config_path(): string
{
    $candidates = api_figo_config_candidate_paths();
    foreach ($candidates as $candidate) {
        if (is_file($candidate)) {
            return $candidate;
        }
    }

    return $candidates[0] ?? (dirname(__DIR__) . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'figo-config.json');
}

function api_read_figo_config_with_meta(): array
{
    $path = api_resolve_figo_config_path();
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

function api_mask_secret_value(string $value): string
{
    $value = trim($value);
    if ($value === '') {
        return '';
    }

    $length = strlen($value);
    if ($length <= 10) {
        return str_repeat('*', $length);
    }

    return substr($value, 0, 6) . str_repeat('*', max(4, $length - 10)) . substr($value, -4);
}

function api_mask_figo_config(array $config): array
{
    $masked = $config;
    foreach (['token', 'apiKey'] as $key) {
        if (isset($masked[$key]) && is_string($masked[$key])) {
            $masked[$key] = api_mask_secret_value((string) $masked[$key]);
        }
    }

    if (isset($masked['ai']) && is_array($masked['ai']) && isset($masked['ai']['apiKey']) && is_string($masked['ai']['apiKey'])) {
        $masked['ai']['apiKey'] = api_mask_secret_value((string) $masked['ai']['apiKey']);
    }

    return $masked;
}

function api_parse_optional_bool($raw): ?bool
{
    if (is_bool($raw)) {
        return $raw;
    }

    if (!is_string($raw) && !is_int($raw)) {
        return null;
    }

    $value = strtolower(trim((string) $raw));
    if (in_array($value, ['1', 'true', 'yes', 'on'], true)) {
        return true;
    }

    if (in_array($value, ['0', 'false', 'no', 'off'], true)) {
        return false;
    }

    return null;
}

function api_validate_absolute_http_url(string $url, string $field): void
{
    $url = trim($url);
    if ($url === '') {
        return;
    }

    $parts = @parse_url($url);
    if (!is_array($parts)) {
        throw new RuntimeException($field . ' no es una URL valida', 400);
    }

    $scheme = strtolower((string) ($parts['scheme'] ?? ''));
    $host = strtolower((string) ($parts['host'] ?? ''));
    if (!in_array($scheme, ['http', 'https'], true) || $host === '') {
        throw new RuntimeException($field . ' debe ser una URL absoluta http(s)', 400);
    }
}

function api_merge_figo_config(array $existing, array $payload): array
{
    $next = $existing;
    $endpointTouched = false;
    $aiEndpointTouched = false;

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
        $parsed = api_parse_optional_bool($payload['allowLocalFallback']);
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
                $aiBool = api_parse_optional_bool($rawAi['allowLocalFallback']);
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
        api_validate_absolute_http_url((string) $next['endpoint'], 'endpoint');
        if (api_is_figo_recursive_config((string) $next['endpoint'])) {
            throw new RuntimeException('endpoint no debe apuntar a /figo-chat.php', 400);
        }
    }

    if ($aiEndpointTouched && isset($next['ai']) && is_array($next['ai']) && isset($next['ai']['endpoint']) && is_string($next['ai']['endpoint'])) {
        api_validate_absolute_http_url((string) $next['ai']['endpoint'], 'ai.endpoint');
    }

    return $next;
}
