<?php

declare(strict_types=1);

require_once __DIR__ . '/QueueConfig.php';
require_once __DIR__ . '/JobRepository.php';
require_once __DIR__ . '/GatewayClient.php';
require_once __DIR__ . '/../audit.php';
require_once __DIR__ . '/../metrics.php';

final class JobProcessor
{
    private JobRepository $repository;
    private GatewayClient $gateway;

    public function __construct(?JobRepository $repository = null, ?GatewayClient $gateway = null)
    {
        $this->repository = $repository ?? new JobRepository();
        $this->gateway = $gateway ?? new GatewayClient();
    }

    public function markJob(array $job, string $status, string $errorCode = '', string $errorMessage = '', ?array $completion = null): array
    {
        $now = QueueConfig::now();
        $job['status'] = $status;
        $job['updatedAt'] = gmdate('c', $now);

        if ($errorCode !== '') {
            $job['errorCode'] = $errorCode;
        } elseif (isset($job['errorCode'])) {
            unset($job['errorCode']);
        }

        if ($errorMessage !== '') {
            $job['errorMessage'] = $errorMessage;
        } elseif (isset($job['errorMessage'])) {
            unset($job['errorMessage']);
        }

        if (is_array($completion)) {
            $job['response'] = $completion;
        }

        if ($status === 'completed') {
            $job['completedAt'] = gmdate('c', $now);
        } elseif ($status === 'failed') {
            $job['failedAt'] = gmdate('c', $now);
        } elseif ($status === 'expired') {
            $job['expiredAt'] = gmdate('c', $now);
        }

        return $job;
    }

    public function shouldRetryError(string $errorCode): bool
    {
        return in_array($errorCode, ['gateway_timeout', 'gateway_network', 'gateway_upstream_5xx', 'gateway_rate_limited'], true);
    }

    public function nextRetryAt(int $attempts, int $now): int
    {
        $backoff = min(5 + ($attempts * 2), 30);
        return $now + $backoff;
    }

    public function purgeOldJobs(?int $nowTs = null): array
    {
        $now = is_int($nowTs) ? $nowTs : QueueConfig::now();
        $ttl = QueueConfig::queueTtlSec();
        $retention = QueueConfig::retentionSec();
        $result = ['expiredNow' => 0, 'deleted' => 0];

        foreach ($this->repository->listJobFiles() as $path) {
            $job = $this->repository->readJsonFile($path);
            if (!is_array($job)) {
                continue;
            }

            $status = (string) ($job['status'] ?? '');
            $createdAtTs = strtotime((string) ($job['createdAt'] ?? ''));
            if ($createdAtTs <= 0) {
                $createdAtTs = (int) @filemtime($path);
            }
            if ($createdAtTs <= 0) {
                $createdAtTs = $now;
            }

            if (in_array($status, ['queued', 'processing'], true)) {
                if (($now - $createdAtTs) > $ttl) {
                    $job['status'] = 'expired';
                    $job['updatedAt'] = gmdate('c');
                    $job['expiredAt'] = gmdate('c');
                    $job['errorCode'] = 'queue_expired';
                    $job['errorMessage'] = 'Job vencido en cola';
                    $this->repository->writeJsonFile($path, $job);
                    $result['expiredNow']++;
                    Metrics::increment('openclaw_queue_jobs_total', ['status' => 'expired']);
                    audit_log_event('figo.queue.expired', [
                        'jobId' => (string) ($job['jobId'] ?? ''),
                        'reason' => 'ttl_exceeded',
                    ]);
                }
                continue;
            }

            if (($now - $createdAtTs) > $retention && @unlink($path)) {
                $result['deleted']++;
            }
        }

        return $result;
    }

    public function processJob(string $jobId, ?int $gatewayTimeoutSeconds = null): array
    {
        $jobLock = $this->repository->acquireLock('job-' . $jobId, 600);
        if (!is_resource($jobLock)) {
            return ['ok' => false, 'status' => 'lock_busy', 'jobId' => $jobId];
        }

        try {
            $job = $this->repository->readJob($jobId);
            if (!is_array($job)) {
                return ['ok' => false, 'status' => 'missing', 'jobId' => $jobId];
            }

            $status = (string) ($job['status'] ?? '');
            if (in_array($status, ['completed', 'failed', 'expired'], true)) {
                return ['ok' => true, 'status' => $status, 'jobId' => $jobId];
            }

            $now = QueueConfig::now();
            $expiresAtTs = strtotime((string) ($job['expiresAt'] ?? ''));
            if ($expiresAtTs > 0 && $expiresAtTs < $now) {
                $job = $this->markJob($job, 'expired', 'queue_expired', 'Job vencido en cola');
                $this->repository->writeJob($job);
                Metrics::increment('openclaw_queue_jobs_total', ['status' => 'expired']);
                return ['ok' => false, 'status' => 'expired', 'jobId' => $jobId];
            }

            $nextAttemptAtTs = strtotime((string) ($job['nextAttemptAt'] ?? ''));
            if ($nextAttemptAtTs > $now) {
                return ['ok' => true, 'status' => 'deferred', 'jobId' => $jobId];
            }

            $attempts = isset($job['attempts']) ? ((int) $job['attempts']) + 1 : 1;
            $job['attempts'] = $attempts;
            $job = $this->markJob($job, 'processing');
            $this->repository->writeJob($job);

            $gatewayResult = $this->gateway->call($job, $gatewayTimeoutSeconds);
            $this->repository->writeGatewayStatus([
                'ok' => (bool) ($gatewayResult['ok'] ?? false),
                'errorCode' => (string) ($gatewayResult['errorCode'] ?? ''),
                'httpCode' => (int) ($gatewayResult['httpCode'] ?? 0),
            ]);

            if (($gatewayResult['ok'] ?? false) === true && is_array($gatewayResult['completion'] ?? null)) {
                $job = $this->markJob($job, 'completed', '', '', $gatewayResult['completion']);
                $this->repository->writeJob($job);
                Metrics::increment('openclaw_queue_jobs_total', ['status' => 'completed']);
                audit_log_event('figo.queue.completed', [
                    'jobId' => $jobId,
                    'attempts' => $attempts,
                    'durationMs' => (int) ($gatewayResult['durationMs'] ?? 0),
                ]);
                return ['ok' => true, 'status' => 'completed', 'jobId' => $jobId];
            }

            $errorCode = (string) ($gatewayResult['errorCode'] ?? 'gateway_unknown');
            $errorMessage = (string) ($gatewayResult['errorMessage'] ?? 'Gateway error');
            $retryMax = QueueConfig::workerRetryMax();
            $shouldRetry = $attempts <= $retryMax && $this->shouldRetryError($errorCode);

            if ($shouldRetry) {
                $nextRetryTs = $this->nextRetryAt($attempts, $now);
                $job['nextAttemptAt'] = QueueConfig::safeTimeIso($nextRetryTs);
                $job = $this->markJob($job, 'queued', $errorCode, $errorMessage);
                $this->repository->writeJob($job);
                audit_log_event('figo.queue.retry', [
                    'jobId' => $jobId,
                    'attempts' => $attempts,
                    'errorCode' => $errorCode,
                ]);
                return ['ok' => false, 'status' => 'retry', 'jobId' => $jobId];
            }

            $job = $this->markJob($job, 'failed', $errorCode, $errorMessage);
            $this->repository->writeJob($job);
            Metrics::increment('openclaw_queue_jobs_total', ['status' => 'failed']);
            audit_log_event('figo.queue.failed', [
                'jobId' => $jobId,
                'attempts' => $attempts,
                'errorCode' => $errorCode,
            ]);
            return ['ok' => false, 'status' => 'failed', 'jobId' => $jobId];
        } finally {
            $this->repository->releaseLock($jobLock);
        }
    }

    public function processWorker(?int $maxJobs = null, ?int $timeBudgetMs = null, bool $fromCron = false): array
    {
        $start = microtime(true);
        $maxJobsValue = is_int($maxJobs) && $maxJobs > 0 ? $maxJobs : QueueConfig::workerMaxJobs();
        $timeBudget = is_int($timeBudgetMs) && $timeBudgetMs > 0
            ? QueueConfig::clampInt($timeBudgetMs, 1600, 200, 30000)
            : 1600;

        $lock = $this->repository->acquireLock('worker-global', 120);
        if (!is_resource($lock)) {
            return [
                'ok' => false,
                'reason' => 'worker_locked',
                'processed' => 0,
                'completed' => 0,
                'failed' => 0,
                'remaining' => 0,
                'durationMs' => 0,
            ];
        }

        try {
            $purge = $this->purgeOldJobs();
            $pending = $this->repository->pendingJobIds();
            $processed = 0;
            $completed = 0;
            $failed = 0;

            foreach ($pending as $jobId) {
                $elapsedMs = (int) round((microtime(true) - $start) * 1000);
                if ($processed >= $maxJobsValue || $elapsedMs >= $timeBudget) {
                    break;
                }

                $timeoutOverride = null;
                if (!$fromCron) {
                    $remainingMs = max(200, $timeBudget - $elapsedMs);
                    $timeoutOverride = max(1, min(3, (int) ceil($remainingMs / 1000)));
                }

                $result = $this->processJob($jobId, $timeoutOverride);
                $processed++;
                if (($result['status'] ?? '') === 'completed') {
                    $completed++;
                }
                if (($result['status'] ?? '') === 'failed') {
                    $failed++;
                }
            }

            $remaining = count($this->repository->pendingJobIds());
            $durationMs = (int) round((microtime(true) - $start) * 1000);
            Metrics::observe('openclaw_worker_duration_seconds', max(0.001, $durationMs / 1000), [
                'source' => $fromCron ? 'cron' : 'trigger',
            ]);

            $this->repository->writeWorkerMeta([
                'lastRunAt' => gmdate('c'),
                'lastRunDurationMs' => $durationMs,
                'lastRunSource' => $fromCron ? 'cron' : 'trigger',
                'lastProcessed' => $processed,
                'lastCompleted' => $completed,
                'lastFailed' => $failed,
                'lastRemaining' => $remaining,
                'lastExpired' => (int) ($purge['expiredNow'] ?? 0),
            ]);

            return [
                'ok' => true,
                'processed' => $processed,
                'completed' => $completed,
                'failed' => $failed,
                'remaining' => $remaining,
                'expired' => (int) ($purge['expiredNow'] ?? 0),
                'deleted' => (int) ($purge['deleted'] ?? 0),
                'durationMs' => $durationMs,
            ];
        } finally {
            $this->repository->releaseLock($lock);
        }
    }

    public function waitForTerminal(string $jobId, int $waitMs): array
    {
        $waitMs = QueueConfig::clampInt($waitMs, 2200, 0, 10000);
        if ($waitMs <= 0) {
            return ['status' => 'queued', 'job' => $this->repository->readJob($jobId)];
        }

        $startedAt = (int) floor(microtime(true) * 1000);
        do {
            $job = $this->repository->readJob($jobId);
            $status = is_array($job) ? (string) ($job['status'] ?? 'queued') : 'queued';
            if (in_array($status, ['completed', 'failed', 'expired'], true)) {
                return ['status' => $status, 'job' => $job];
            }
            usleep(120000);
        } while (((int) floor(microtime(true) * 1000) - $startedAt) < $waitMs);

        return ['status' => 'queued', 'job' => $this->repository->readJob($jobId)];
    }

    public function enqueue(array $payload): array
    {
        if (!$this->repository->ensureDirs()) {
            return [
                'ok' => false,
                'status' => 'failed',
                'errorCode' => 'queue_storage_unavailable',
                'errorMessage' => 'No se pudo inicializar almacenamiento de cola',
            ];
        }

        $request = QueueConfig::defaultRequest($payload);
        if (!isset($request['messages']) || !is_array($request['messages']) || $request['messages'] === []) {
            return [
                'ok' => false,
                'status' => 'failed',
                'errorCode' => 'messages_required',
                'errorMessage' => 'messages es obligatorio',
            ];
        }

        $sessionHash = QueueConfig::hashValue(QueueConfig::extractSessionId($payload));
        $requestHash = QueueConfig::requestHash($request);
        $recentJob = $this->repository->findRecentByRequestHash($requestHash, $sessionHash);
        if (is_array($recentJob)) {
            return [
                'ok' => true,
                'status' => 'deduplicated',
                'job' => $recentJob,
                'jobId' => (string) ($recentJob['jobId'] ?? ''),
            ];
        }

        $now = QueueConfig::now();
        $expiresTs = $now + QueueConfig::queueTtlSec();
        $jobId = QueueConfig::newJobId();
        $job = [
            'jobId' => $jobId,
            'status' => 'queued',
            'createdAt' => gmdate('c', $now),
            'updatedAt' => gmdate('c', $now),
            'expiresAt' => gmdate('c', $expiresTs),
            'nextAttemptAt' => gmdate('c', $now),
            'sessionIdHash' => $sessionHash,
            'requestHash' => $requestHash,
            'attempts' => 0,
            'model' => (string) $request['model'],
            'messages' => $request['messages'],
            'temperature' => (float) $request['temperature'],
            'maxTokens' => (int) $request['max_tokens'],
        ];

        if (!$this->repository->writeJob($job)) {
            return [
                'ok' => false,
                'status' => 'failed',
                'errorCode' => 'queue_write_failed',
                'errorMessage' => 'No se pudo persistir job',
            ];
        }

        Metrics::increment('openclaw_queue_jobs_total', ['status' => 'queued']);
        audit_log_event('figo.queue.enqueued', ['jobId' => $jobId]);

        return [
            'ok' => true,
            'status' => 'queued',
            'jobId' => $jobId,
            'job' => $job,
        ];
    }

    public function statusPayloadForJob(string $jobId): array
    {
        $job = $this->repository->readJob($jobId);
        if (!is_array($job)) {
            return [
                'ok' => false,
                'status' => 'expired',
                'errorCode' => 'queue_expired',
                'errorMessage' => 'El job no existe o fue purgado',
            ];
        }

        $status = (string) ($job['status'] ?? 'queued');
        if ($status === 'completed') {
            $completion = $this->gateway->completionFromJob($job);
            if (is_array($completion)) {
                return [
                    'ok' => true,
                    'status' => 'completed',
                    'completedAt' => (string) ($job['completedAt'] ?? gmdate('c')),
                    'provider' => 'openclaw_queue',
                    'completion' => $completion,
                ];
            }
            $status = 'failed';
        }

        if ($status === 'failed') {
            return [
                'ok' => false,
                'status' => 'failed',
                'errorCode' => (string) ($job['errorCode'] ?? 'gateway_unknown'),
                'errorMessage' => (string) ($job['errorMessage'] ?? $this->gateway->unavailableMessage()),
                'failedAt' => (string) ($job['failedAt'] ?? gmdate('c')),
            ];
        }

        if ($status === 'expired') {
            return [
                'ok' => false,
                'status' => 'expired',
                'errorCode' => (string) ($job['errorCode'] ?? 'queue_expired'),
                'errorMessage' => (string) ($job['errorMessage'] ?? 'Solicitud expirada'),
                'expiredAt' => (string) ($job['expiredAt'] ?? gmdate('c')),
            ];
        }

        return [
            'ok' => true,
            'status' => $status,
            'jobId' => $jobId,
            'nextAttemptAt' => (string) ($job['nextAttemptAt'] ?? ''),
            'updatedAt' => (string) ($job['updatedAt'] ?? ''),
        ];
    }

    public function bridgeResult(array $payload): array
    {
        $enqueue = $this->enqueue($payload);
        if (($enqueue['ok'] ?? false) !== true) {
            return [
                'httpStatus' => 400,
                'payload' => [
                    'ok' => false,
                    'provider' => 'openclaw_queue',
                    'mode' => 'failed',
                    'errorCode' => (string) ($enqueue['errorCode'] ?? 'queue_failed'),
                    'error' => (string) ($enqueue['errorMessage'] ?? 'No se pudo procesar la solicitud'),
                ],
            ];
        }

        $jobId = (string) ($enqueue['jobId'] ?? '');
        if (!QueueConfig::jobIdIsValid($jobId)) {
            return [
                'httpStatus' => 500,
                'payload' => [
                    'ok' => false,
                    'provider' => 'openclaw_queue',
                    'mode' => 'failed',
                    'errorCode' => 'queue_invalid_jobid',
                    'error' => 'No se pudo crear el job',
                ],
            ];
        }

        $this->processWorker(QueueConfig::triggerMaxJobs(), QueueConfig::triggerTimeBudgetMs(), false);

        $terminal = $this->waitForTerminal($jobId, QueueConfig::syncWaitMs());
        $status = (string) ($terminal['status'] ?? 'queued');
        $job = isset($terminal['job']) && is_array($terminal['job']) ? $terminal['job'] : $this->repository->readJob($jobId);

        if ($status === 'completed' && is_array($job)) {
            $completion = $this->gateway->completionFromJob($job);
            if (is_array($completion)) {
                $completion['mode'] = 'live';
                $completion['provider'] = 'openclaw_queue';
                $completion['source'] = 'openclaw_gateway';
                $completion['jobId'] = $jobId;
                return ['httpStatus' => 200, 'payload' => $completion];
            }
        }

        if ($status === 'failed' && is_array($job)) {
            return [
                'httpStatus' => 503,
                'payload' => [
                    'ok' => false,
                    'mode' => 'failed',
                    'provider' => 'openclaw_queue',
                    'source' => 'openclaw_gateway',
                    'jobId' => $jobId,
                    'errorCode' => (string) ($job['errorCode'] ?? 'gateway_unknown'),
                    'reason' => (string) ($job['errorCode'] ?? 'gateway_unknown'),
                    'error' => (string) ($job['errorMessage'] ?? $this->gateway->unavailableMessage()),
                ],
            ];
        }

        return [
            'httpStatus' => 200,
            'payload' => [
                'ok' => true,
                'mode' => 'queued',
                'provider' => 'openclaw_queue',
                'source' => 'openclaw_queue',
                'jobId' => $jobId,
                'status' => 'queued',
                'pollUrl' => '/check-ai-response.php?jobId=' . rawurlencode($jobId),
                'pollAfterMs' => QueueConfig::pollAfterMs(),
                'message' => 'Estamos procesando tu consulta...',
            ],
        ];
    }

    public function statusOverview(): array
    {
        $depth = $this->repository->countDepth();
        $workerMeta = $this->repository->readWorkerMeta();
        $gatewayStatus = $this->repository->readGatewayStatus();
        $endpoint = QueueConfig::gatewayEndpoint();
        $host = '';
        $path = '';
        if ($endpoint !== '') {
            $parts = @parse_url($endpoint);
            if (is_array($parts)) {
                $host = isset($parts['host']) ? strtolower((string) $parts['host']) : '';
                $path = isset($parts['path']) ? (string) $parts['path'] : '';
            }
        }

        return [
            'providerMode' => QueueConfig::providerMode(),
            'queueDepth' => $depth,
            'workerLastRunAt' => isset($workerMeta['lastRunAt']) ? (string) $workerMeta['lastRunAt'] : '',
            'workerLastRunDurationMs' => isset($workerMeta['lastRunDurationMs']) ? (int) $workerMeta['lastRunDurationMs'] : 0,
            'openclawReachable' => $this->gateway->probe(2),
            'gatewayHost' => $host,
            'gatewayPath' => $path,
            'gatewayAuthHeader' => QueueConfig::gatewayKeyHeader(),
            'gatewayAuthPrefix' => QueueConfig::gatewayKeyPrefix(),
            'prefersFigoAiAuth' => QueueConfig::prefersFigoAiAuth(),
            'gatewayConfigured' => $endpoint !== '',
            'gatewayAuthConfigured' => QueueConfig::gatewayApiKey() !== '',
            'gatewayLastStatus' => $gatewayStatus,
        ];
    }
}
