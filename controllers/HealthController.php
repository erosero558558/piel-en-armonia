<?php
declare(strict_types=1);

class HealthController
{
    public static function check(array $context): void
    {
        $requestStartedAt = $context['requestStartedAt'] ?? microtime(true);
        $method = $context['method'] ?? 'GET';
        $resource = $context['resource'] ?? 'health';

        $storageReady = ensure_data_file();
        $figoEndpoint = self::resolve_figo_endpoint();
        $figoConfigured = $figoEndpoint !== '';
        $figoRecursive = self::is_figo_recursive_config($figoEndpoint);

        $timingMs = (int) round((microtime(true) - $requestStartedAt) * 1000);

        audit_log_event('api.health', [
            'method' => $method,
            'resource' => $resource,
            'storageReady' => $storageReady,
            'timingMs' => $timingMs,
            'version' => app_runtime_version(),
            'figoConfigured' => $figoConfigured,
            'figoRecursiveConfig' => $figoRecursive
        ]);
        json_response([
            'ok' => true,
            'status' => 'ok',
            'storageReady' => $storageReady,
            'timingMs' => $timingMs,
            'version' => app_runtime_version(),
            'dataDirWritable' => data_dir_writable(),
            'storeEncrypted' => store_file_is_encrypted(),
            'figoConfigured' => $figoConfigured,
            'figoRecursiveConfig' => $figoRecursive,
            'timestamp' => local_date('c')
        ]);
    }

    private static function resolve_figo_endpoint(): string
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
        $configCandidates[] = __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'figo-config.json';
        $configCandidates[] = __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'figo-config.json';

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

    private static function is_figo_recursive_config(string $endpoint): bool
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
}
