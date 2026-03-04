<?php

declare(strict_types=1);

require_once __DIR__ . '/../storage.php';
require_once __DIR__ . '/../figo_utils.php';

final class QueueConfig
{
    public static function clampInt($raw, int $default, int $min, int $max): int
    {
        $value = is_numeric($raw) ? (int) $raw : $default;
        if ($value < $min) {
            return $min;
        }
        if ($value > $max) {
            return $max;
        }
        return $value;
    }

    public static function providerMode(): string
    {
        return api_figo_env_provider_mode();
    }

    public static function enabled(): bool
    {
        return self::providerMode() === 'openclaw_queue';
    }

    public static function gatewayEndpoint(): string
    {
        return api_figo_env_gateway_endpoint();
    }

    public static function gatewayApiKey(): string
    {
        return api_figo_env_gateway_api_key();
    }

    public static function prefersFigoAiAuth(): bool
    {
        return api_figo_env_ai_endpoint() !== '';
    }

    public static function gatewayModel(): string
    {
        return api_figo_env_gateway_model();
    }

    public static function gatewayKeyHeader(): string
    {
        return api_figo_env_gateway_key_header();
    }

    public static function gatewayKeyPrefix(): string
    {
        return api_figo_env_gateway_key_prefix();
    }

    public static function allowLocalFallback(): bool
    {
        return api_figo_env_allow_local_fallback();
    }

    public static function queueTtlSec(): int
    {
        return self::clampInt(getenv('OPENCLAW_QUEUE_TTL_SEC'), 1800, 60, 86400);
    }

    public static function retentionSec(): int
    {
        return self::clampInt(getenv('OPENCLAW_QUEUE_RETENTION_SEC'), 86400, 600, 604800);
    }

    public static function syncWaitMs(): int
    {
        return self::clampInt(getenv('OPENCLAW_BRIDGE_SYNC_WAIT_MS'), 1400, 0, 10000);
    }

    public static function workerMaxJobs(): int
    {
        return self::clampInt(getenv('OPENCLAW_WORKER_MAX_JOBS'), 20, 1, 200);
    }

    public static function workerRetryMax(): int
    {
        return self::clampInt(getenv('OPENCLAW_WORKER_RETRY_MAX'), 2, 0, 5);
    }

    public static function workerTimeoutSeconds(): int
    {
        return self::clampInt(getenv('OPENCLAW_GATEWAY_TIMEOUT_SECONDS'), 12, 4, 60);
    }

    public static function pollAfterMs(): int
    {
        return self::clampInt(getenv('OPENCLAW_POLL_AFTER_MS'), 800, 400, 5000);
    }

    public static function pollProcessTimeoutSeconds(): int
    {
        return self::clampInt(getenv('OPENCLAW_POLL_PROCESS_TIMEOUT_SEC'), 8, 1, 20);
    }

    public static function allowClientModel(): bool
    {
        return api_parse_bool(getenv('OPENCLAW_ALLOW_CLIENT_MODEL'), false);
    }

    public static function triggerMaxJobs(): int
    {
        return self::clampInt(getenv('OPENCLAW_TRIGGER_MAX_JOBS'), 1, 1, 8);
    }

    public static function triggerTimeBudgetMs(): int
    {
        return self::clampInt(getenv('OPENCLAW_TRIGGER_TIME_BUDGET_MS'), 900, 200, 5000);
    }

    public static function normalizeModelName($rawModel): string
    {
        if (!is_string($rawModel)) {
            return '';
        }
        $model = trim($rawModel);
        if ($model === '') {
            return '';
        }
        if (!preg_match('/^[a-zA-Z0-9._:\\/\-]{2,160}$/', $model)) {
            return '';
        }
        return $model;
    }

    public static function dirBase(): string
    {
        return data_dir_path() . DIRECTORY_SEPARATOR . 'ai-queue';
    }

    public static function dirJobs(): string
    {
        return self::dirBase() . DIRECTORY_SEPARATOR . 'jobs';
    }

    public static function dirLocks(): string
    {
        return self::dirBase() . DIRECTORY_SEPARATOR . 'locks';
    }

    public static function workerMetaPath(): string
    {
        return self::dirBase() . DIRECTORY_SEPARATOR . 'worker-meta.json';
    }

    public static function gatewayStatusPath(): string
    {
        return self::dirBase() . DIRECTORY_SEPARATOR . 'gateway-status.json';
    }

    public static function jobIdIsValid(string $jobId): bool
    {
        return preg_match('/^[a-f0-9]{24,64}$/', $jobId) === 1;
    }

    public static function newJobId(): string
    {
        try {
            return bin2hex(random_bytes(16));
        } catch (Throwable $e) {
            return substr(sha1((string) microtime(true) . (string) mt_rand()), 0, 32);
        }
    }

    public static function now(): int
    {
        return time();
    }

    public static function safeTimeIso(int $ts): string
    {
        return gmdate('c', max(1, $ts));
    }

    public static function hashValue(string $value): string
    {
        return hash('sha256', $value);
    }

    public static function normalizeMessages(array $messages): array
    {
        $normalized = [];
        foreach ($messages as $msg) {
            if (!is_array($msg)) {
                continue;
            }

            $role = isset($msg['role']) ? strtolower(trim((string) $msg['role'])) : '';
            if (!in_array($role, ['system', 'user', 'assistant'], true)) {
                continue;
            }

            $content = trim((string) ($msg['content'] ?? ''));
            if ($content === '') {
                continue;
            }
            if (strlen($content) > 5000) {
                $content = substr($content, 0, 5000);
            }

            $normalized[] = [
                'role' => $role,
                'content' => $content,
            ];
        }

        if (count($normalized) > 20) {
            $normalized = array_slice($normalized, -20);
        }

        return $normalized;
    }

    public static function defaultRequest(array $payload): array
    {
        $messages = isset($payload['messages']) && is_array($payload['messages'])
            ? self::normalizeMessages($payload['messages'])
            : [];
        $model = self::gatewayModel();
        if (self::allowClientModel()) {
            $clientModel = self::normalizeModelName($payload['model'] ?? null);
            if ($clientModel !== '') {
                $model = $clientModel;
            }
        }

        $maxTokens = isset($payload['max_tokens']) ? (int) $payload['max_tokens'] : 1000;
        if ($maxTokens < 64) {
            $maxTokens = 64;
        }
        if ($maxTokens > 2000) {
            $maxTokens = 2000;
        }

        $temperature = isset($payload['temperature']) ? (float) $payload['temperature'] : 0.7;
        if ($temperature < 0.0) {
            $temperature = 0.0;
        }
        if ($temperature > 1.0) {
            $temperature = 1.0;
        }

        return [
            'model' => $model,
            'messages' => $messages,
            'max_tokens' => $maxTokens,
            'temperature' => $temperature,
        ];
    }

    public static function extractSessionId(array $payload): string
    {
        $metadata = isset($payload['metadata']) && is_array($payload['metadata']) ? $payload['metadata'] : [];
        $candidate = api_first_non_empty([
            isset($metadata['sessionId']) ? (string) $metadata['sessionId'] : '',
            isset($payload['sessionId']) ? (string) $payload['sessionId'] : '',
            session_id(),
            isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : '',
        ]);

        return $candidate !== '' ? $candidate : 'anonymous';
    }

    public static function requestHash(array $request): string
    {
        $payload = [
            'model' => (string) ($request['model'] ?? ''),
            'messages' => isset($request['messages']) && is_array($request['messages']) ? $request['messages'] : [],
            'max_tokens' => (int) ($request['max_tokens'] ?? 0),
            'temperature' => (float) ($request['temperature'] ?? 0),
        ];
        $encoded = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($encoded)) {
            $encoded = serialize($payload);
        }

        return self::hashValue($encoded);
    }
}
