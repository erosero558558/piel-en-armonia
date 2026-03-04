<?php

declare(strict_types=1);

require_once __DIR__ . '/figo_queue/QueueConfig.php';
require_once __DIR__ . '/figo_queue/JobRepository.php';
require_once __DIR__ . '/figo_queue/GatewayClient.php';
require_once __DIR__ . '/figo_queue/JobProcessor.php';

function figo_queue_repository(): JobRepository
{
    static $repository = null;
    if (!$repository instanceof JobRepository) {
        $repository = new JobRepository();
    }
    return $repository;
}

function figo_queue_gateway_client(): GatewayClient
{
    static $gateway = null;
    if (!$gateway instanceof GatewayClient) {
        $gateway = new GatewayClient();
    }
    return $gateway;
}

function figo_queue_job_processor(): JobProcessor
{
    static $processor = null;
    if (!$processor instanceof JobProcessor) {
        $processor = new JobProcessor(figo_queue_repository(), figo_queue_gateway_client());
    }
    return $processor;
}

function figo_queue_clamp_int($raw, int $default, int $min, int $max): int
{
    return QueueConfig::clampInt($raw, $default, $min, $max);
}

function figo_queue_provider_mode(): string
{
    return QueueConfig::providerMode();
}

function figo_queue_enabled(): bool
{
    return QueueConfig::enabled();
}

function figo_queue_gateway_endpoint(): string
{
    return QueueConfig::gatewayEndpoint();
}

function figo_queue_gateway_api_key(): string
{
    return QueueConfig::gatewayApiKey();
}

function figo_queue_prefers_figo_ai_auth(): bool
{
    return QueueConfig::prefersFigoAiAuth();
}

function figo_queue_gateway_model(): string
{
    return QueueConfig::gatewayModel();
}

function figo_queue_gateway_key_header(): string
{
    return QueueConfig::gatewayKeyHeader();
}

function figo_queue_gateway_key_prefix(): string
{
    return QueueConfig::gatewayKeyPrefix();
}

function figo_queue_allow_local_fallback(): bool
{
    return QueueConfig::allowLocalFallback();
}

function figo_queue_queue_ttl_sec(): int
{
    return QueueConfig::queueTtlSec();
}

function figo_queue_retention_sec(): int
{
    return QueueConfig::retentionSec();
}

function figo_queue_sync_wait_ms(): int
{
    return QueueConfig::syncWaitMs();
}

function figo_queue_worker_max_jobs(): int
{
    return QueueConfig::workerMaxJobs();
}

function figo_queue_worker_retry_max(): int
{
    return QueueConfig::workerRetryMax();
}

function figo_queue_worker_timeout_seconds(): int
{
    return QueueConfig::workerTimeoutSeconds();
}

function figo_queue_poll_after_ms(): int
{
    return QueueConfig::pollAfterMs();
}

function figo_queue_poll_process_timeout_seconds(): int
{
    return QueueConfig::pollProcessTimeoutSeconds();
}

function figo_queue_allow_client_model(): bool
{
    return QueueConfig::allowClientModel();
}

function figo_queue_normalize_model_name($rawModel): string
{
    return QueueConfig::normalizeModelName($rawModel);
}

function figo_queue_dir_base(): string
{
    return QueueConfig::dirBase();
}

function figo_queue_dir_jobs(): string
{
    return QueueConfig::dirJobs();
}

function figo_queue_dir_locks(): string
{
    return QueueConfig::dirLocks();
}

function figo_queue_worker_meta_path(): string
{
    return QueueConfig::workerMetaPath();
}

function figo_queue_gateway_status_path(): string
{
    return QueueConfig::gatewayStatusPath();
}

function figo_queue_ensure_dirs(): bool
{
    return figo_queue_repository()->ensureDirs();
}

function figo_queue_job_id_is_valid(string $jobId): bool
{
    return QueueConfig::jobIdIsValid($jobId);
}

function figo_queue_new_job_id(): string
{
    return QueueConfig::newJobId();
}

function figo_queue_job_path(string $jobId): string
{
    return figo_queue_repository()->jobPath($jobId);
}

function figo_queue_now(): int
{
    return QueueConfig::now();
}

function figo_queue_safe_time_iso(int $ts): string
{
    return QueueConfig::safeTimeIso($ts);
}

function figo_queue_read_json_file(string $path): ?array
{
    return figo_queue_repository()->readJsonFile($path);
}

function figo_queue_write_json_file(string $path, array $data): bool
{
    return figo_queue_repository()->writeJsonFile($path, $data);
}

function figo_queue_read_job(string $jobId): ?array
{
    return figo_queue_repository()->readJob($jobId);
}

function figo_queue_write_job(array $job): bool
{
    return figo_queue_repository()->writeJob($job);
}

function figo_queue_write_worker_meta(array $meta): void
{
    figo_queue_repository()->writeWorkerMeta($meta);
}

function figo_queue_read_worker_meta(): array
{
    return figo_queue_repository()->readWorkerMeta();
}

function figo_queue_write_gateway_status(array $status): void
{
    figo_queue_repository()->writeGatewayStatus($status);
}

function figo_queue_read_gateway_status(): array
{
    return figo_queue_repository()->readGatewayStatus();
}

function figo_queue_acquire_lock(string $name, int $timeoutMs = 800)
{
    return figo_queue_repository()->acquireLock($name, $timeoutMs);
}

function figo_queue_release_lock($handle): void
{
    figo_queue_repository()->releaseLock($handle);
}

function figo_queue_hash_value(string $value): string
{
    return QueueConfig::hashValue($value);
}

function figo_queue_normalize_messages(array $messages): array
{
    return QueueConfig::normalizeMessages($messages);
}

function figo_queue_default_request(array $payload): array
{
    return QueueConfig::defaultRequest($payload);
}

function figo_queue_extract_session_id(array $payload): string
{
    return QueueConfig::extractSessionId($payload);
}

function figo_queue_request_hash(array $request): string
{
    return QueueConfig::requestHash($request);
}

function figo_queue_find_recent_by_request_hash(string $requestHash, string $sessionHash, int $lookbackSec = 75): ?array
{
    return figo_queue_repository()->findRecentByRequestHash($requestHash, $sessionHash, $lookbackSec);
}

function figo_queue_build_completion(string $model, string $content): array
{
    return figo_queue_gateway_client()->buildCompletion($model, $content);
}

function figo_queue_extract_completion(array $decoded, string $fallbackModel): ?array
{
    return figo_queue_gateway_client()->extractCompletion($decoded, $fallbackModel);
}

function figo_queue_gateway_error_code_from_status(int $httpCode, string $curlErr): string
{
    return figo_queue_gateway_client()->errorCodeFromStatus($httpCode, $curlErr);
}

function figo_queue_gateway_call(array $job, ?int $timeoutOverrideSeconds = null): array
{
    return figo_queue_gateway_client()->call($job, $timeoutOverrideSeconds);
}

function figo_queue_probe_gateway(int $timeoutSeconds = 2): ?bool
{
    return figo_queue_gateway_client()->probe($timeoutSeconds);
}

function figo_queue_completion_from_job(array $job): ?array
{
    return figo_queue_gateway_client()->completionFromJob($job);
}

function figo_queue_build_unavailable_message(): string
{
    return figo_queue_gateway_client()->unavailableMessage();
}

function figo_queue_count_depth(): array
{
    return figo_queue_repository()->countDepth();
}

function figo_queue_purge_old_jobs(?int $nowTs = null): array
{
    return figo_queue_job_processor()->purgeOldJobs($nowTs);
}

function figo_queue_mark_job(array $job, string $status, string $errorCode = '', string $errorMessage = '', ?array $completion = null): array
{
    return figo_queue_job_processor()->markJob($job, $status, $errorCode, $errorMessage, $completion);
}

function figo_queue_should_retry_error(string $errorCode): bool
{
    return figo_queue_job_processor()->shouldRetryError($errorCode);
}

function figo_queue_next_retry_at(int $attempts, int $now): int
{
    return figo_queue_job_processor()->nextRetryAt($attempts, $now);
}

function figo_queue_process_job(string $jobId, ?int $gatewayTimeoutSeconds = null): array
{
    return figo_queue_job_processor()->processJob($jobId, $gatewayTimeoutSeconds);
}

function figo_queue_pending_job_ids(): array
{
    return figo_queue_repository()->pendingJobIds();
}

function figo_queue_process_worker(?int $maxJobs = null, ?int $timeBudgetMs = null, bool $fromCron = false): array
{
    return figo_queue_job_processor()->processWorker($maxJobs, $timeBudgetMs, $fromCron);
}

function figo_queue_wait_for_terminal(string $jobId, int $waitMs): array
{
    return figo_queue_job_processor()->waitForTerminal($jobId, $waitMs);
}

function figo_queue_enqueue(array $payload): array
{
    return figo_queue_job_processor()->enqueue($payload);
}

function figo_queue_status_payload_for_job(string $jobId): array
{
    return figo_queue_job_processor()->statusPayloadForJob($jobId);
}

function figo_queue_bridge_result(array $payload): array
{
    return figo_queue_job_processor()->bridgeResult($payload);
}

function figo_queue_status_overview(): array
{
    return figo_queue_job_processor()->statusOverview();
}
