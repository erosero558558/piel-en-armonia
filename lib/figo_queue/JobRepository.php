<?php

declare(strict_types=1);

require_once __DIR__ . '/QueueConfig.php';

final class JobRepository
{
    public function ensureDirs(): bool
    {
        $dirs = [QueueConfig::dirBase(), QueueConfig::dirJobs(), QueueConfig::dirLocks()];
        foreach ($dirs as $dir) {
            if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
                return false;
            }
            ensure_data_htaccess($dir);
        }
        return true;
    }

    public function jobPath(string $jobId): string
    {
        if (!QueueConfig::jobIdIsValid($jobId)) {
            return '';
        }
        return QueueConfig::dirJobs() . DIRECTORY_SEPARATOR . $jobId . '.json';
    }

    public function readJsonFile(string $path): ?array
    {
        if (!is_file($path)) {
            return null;
        }
        $raw = @file_get_contents($path);
        if (!is_string($raw) || trim($raw) === '') {
            return null;
        }
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : null;
    }

    public function writeJsonFile(string $path, array $data): bool
    {
        $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($json)) {
            return false;
        }
        return @file_put_contents($path, $json, LOCK_EX) !== false;
    }

    public function readJob(string $jobId): ?array
    {
        $path = $this->jobPath($jobId);
        if ($path === '') {
            return null;
        }
        return $this->readJsonFile($path);
    }

    public function writeJob(array $job): bool
    {
        if (!$this->ensureDirs()) {
            return false;
        }

        $jobId = isset($job['jobId']) ? (string) $job['jobId'] : '';
        $path = $this->jobPath($jobId);
        if ($path === '') {
            return false;
        }

        return $this->writeJsonFile($path, $job);
    }

    public function writeWorkerMeta(array $meta): void
    {
        if (!$this->ensureDirs()) {
            return;
        }
        $current = $this->readJsonFile(QueueConfig::workerMetaPath());
        if (!is_array($current)) {
            $current = [];
        }
        $next = array_merge($current, $meta);
        $next['updatedAt'] = gmdate('c');
        $this->writeJsonFile(QueueConfig::workerMetaPath(), $next);
    }

    public function readWorkerMeta(): array
    {
        $meta = $this->readJsonFile(QueueConfig::workerMetaPath());
        return is_array($meta) ? $meta : [];
    }

    public function writeGatewayStatus(array $status): void
    {
        if (!$this->ensureDirs()) {
            return;
        }
        $this->writeJsonFile(QueueConfig::gatewayStatusPath(), [
            'updatedAt' => gmdate('c'),
            'status' => $status,
        ]);
    }

    public function readGatewayStatus(): array
    {
        $raw = $this->readJsonFile(QueueConfig::gatewayStatusPath());
        if (!is_array($raw)) {
            return [];
        }
        return isset($raw['status']) && is_array($raw['status']) ? $raw['status'] : [];
    }

    public function acquireLock(string $name, int $timeoutMs = 800)
    {
        if (!$this->ensureDirs()) {
            return null;
        }

        $safeName = preg_replace('/[^a-zA-Z0-9_-]/', '_', $name);
        if (!is_string($safeName) || $safeName === '') {
            $safeName = 'lock';
        }
        $path = QueueConfig::dirLocks() . DIRECTORY_SEPARATOR . $safeName . '.lock';
        $fp = @fopen($path, 'c+');
        if ($fp === false) {
            return null;
        }

        $start = (int) floor(microtime(true) * 1000);
        do {
            if (@flock($fp, LOCK_EX | LOCK_NB)) {
                return $fp;
            }
            usleep(25000);
            $elapsed = (int) floor(microtime(true) * 1000) - $start;
        } while ($elapsed < max(0, $timeoutMs));

        @fclose($fp);
        return null;
    }

    public function releaseLock($handle): void
    {
        if (!is_resource($handle)) {
            return;
        }
        @flock($handle, LOCK_UN);
        @fclose($handle);
    }

    public function listJobFiles(): array
    {
        if (!$this->ensureDirs()) {
            return [];
        }

        $files = glob(QueueConfig::dirJobs() . DIRECTORY_SEPARATOR . '*.json');
        return is_array($files) ? $files : [];
    }

    public function findRecentByRequestHash(string $requestHash, string $sessionHash, int $lookbackSec = 75): ?array
    {
        $files = $this->listJobFiles();
        if ($files === []) {
            return null;
        }

        $now = QueueConfig::now();
        rsort($files, SORT_STRING);
        $checked = 0;
        foreach ($files as $path) {
            $checked++;
            if ($checked > 80) {
                break;
            }

            $mtime = (int) @filemtime($path);
            if ($mtime > 0 && ($now - $mtime) > $lookbackSec) {
                continue;
            }

            $job = $this->readJsonFile($path);
            if (!is_array($job)) {
                continue;
            }
            if ((string) ($job['requestHash'] ?? '') !== $requestHash) {
                continue;
            }
            if ((string) ($job['sessionIdHash'] ?? '') !== $sessionHash) {
                continue;
            }
            $status = (string) ($job['status'] ?? '');
            if (!in_array($status, ['queued', 'processing', 'completed'], true)) {
                continue;
            }

            $expiresAt = strtotime((string) ($job['expiresAt'] ?? ''));
            if ($expiresAt > 0 && $expiresAt < $now) {
                continue;
            }
            return $job;
        }

        return null;
    }

    public function countDepth(): array
    {
        $counts = [
            'queued' => 0,
            'processing' => 0,
            'completed' => 0,
            'failed' => 0,
            'expired' => 0,
        ];

        foreach ($this->listJobFiles() as $path) {
            $job = $this->readJsonFile($path);
            if (!is_array($job)) {
                continue;
            }
            $status = (string) ($job['status'] ?? '');
            if (array_key_exists($status, $counts)) {
                $counts[$status]++;
            }
        }

        return $counts;
    }

    public function pendingJobIds(?int $now = null): array
    {
        $currentTime = is_int($now) ? $now : QueueConfig::now();
        $scored = [];

        foreach ($this->listJobFiles() as $path) {
            $job = $this->readJsonFile($path);
            if (!is_array($job)) {
                continue;
            }
            $status = (string) ($job['status'] ?? '');
            if (!in_array($status, ['queued', 'processing'], true)) {
                continue;
            }
            $jobId = isset($job['jobId']) ? (string) $job['jobId'] : '';
            if (!QueueConfig::jobIdIsValid($jobId)) {
                continue;
            }

            $nextAttemptAtTs = strtotime((string) ($job['nextAttemptAt'] ?? ''));
            if ($nextAttemptAtTs > $currentTime) {
                continue;
            }

            $createdAtTs = strtotime((string) ($job['createdAt'] ?? ''));
            if ($createdAtTs <= 0) {
                $createdAtTs = (int) @filemtime($path);
            }
            if ($createdAtTs <= 0) {
                $createdAtTs = $currentTime;
            }

            $scored[] = [
                'jobId' => $jobId,
                'createdAtTs' => $createdAtTs,
            ];
        }

        usort($scored, static function (array $a, array $b): int {
            return $a['createdAtTs'] <=> $b['createdAtTs'];
        });

        return array_values(array_map(static function (array $row): string {
            return (string) $row['jobId'];
        }, $scored));
    }
}
