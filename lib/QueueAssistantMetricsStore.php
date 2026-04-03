<?php

require_once __DIR__ . '/queue/QueueMetricsFactory.php';

declare(strict_types=1);

require_once __DIR__ . '/storage.php';

final class QueueAssistantMetricsStore
{
    public static function recordHeartbeat(...$args)
    {
        return QueueMetricsFactory::recordHeartbeat(...$args);
    }

    public static function buildReport()
    {
        return QueueMetricsFactory::buildReport();
    }

    public static function recordHelpRequestResolution(...$args)
    {
        return QueueMetricsFactory::recordHelpRequestResolution(...$args);
    }

    public static function recordClinicQueueEvent(...$args)
    {
        return QueueMetricsFactory::recordClinicQueueEvent(...$args);
    }

    private static
    function filePath(): string
    {
        return data_dir_path() . DIRECTORY_SEPARATOR . self::FILE_NAME;
    }

    private static

    private static
    function lockPath(): string
    {
        return self::filePath() . '.lock';
    }

    public static function extractSnapshot(...$args)
    {
        return QueueMetricsFactory::extractSnapshot(...$args);
    }

    public static function buildDelta(...$args)
    {
        return QueueMetricsFactory::buildDelta(...$args);
    }

    public static function buildWindowSummary(...$args)
    {
        return QueueMetricsFactory::buildWindowSummary(...$args);
    }

    private static
    function readRawData(): array
    {
        $path = self::filePath();
        if (!is_file($path)) {
            return [
                'updatedAt' => '',
                'days' => [],
                'sessions' => [],
            ];
        }

        $raw = @file_get_contents($path);
        if (!is_string($raw) || trim($raw) === '') {
            return [
                'updatedAt' => '',
                'days' => [],
                'sessions' => [],
            ];
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return [
                'updatedAt' => '',
                'days' => [],
                'sessions' => [],
            ];
        }

        return [
            'updatedAt' => (string) ($decoded['updatedAt'] ?? ''),
            'days' => is_array($decoded['days'] ?? null) ? $decoded['days'] : [],
            'sessions' => is_array($decoded['sessions'] ?? null)
                ? $decoded['sessions']
                : [],
        ];
    }

    private static
    function writeRawData(array $data): void
    {
        $dir = data_dir_path();
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        ensure_data_htaccess($dir);

        $lock = @fopen(self::lockPath(), 'c+');
        if ($lock !== false) {
            @flock($lock, LOCK_EX);
        }

        try {
            $path = self::filePath();
            $tmpPath = $path . '.tmp';
            $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
            if (!is_string($json)) {
                return;
            }
            @file_put_contents($tmpPath, $json, LOCK_EX);
            @rename($tmpPath, $path);
        } finally {
            if ($lock !== false) {
                @flock($lock, LOCK_UN);
                @fclose($lock);
            }
        }
    }

    private static
    function prune(array $data): array
    {
        $days = is_array($data['days'] ?? null) ? $data['days'] : [];
        $sessions = is_array($data['sessions'] ?? null) ? $data['sessions'] : [];
        $cutoffDayTs = strtotime(local_date('Y-m-d') . ' -' . (self::RETAIN_DAYS - 1) . ' days');
        $sessionCutoffTs = time() - self::SESSION_EXPIRE_SECONDS;
        $activeDays = [];

        foreach ($days as $dayKey => $bucket) {
            if (!is_string($dayKey) || !is_array($bucket)) {
                continue;
            }
            $dayTs = strtotime($dayKey . ' 00:00:00');
            if ($dayTs === false || ($cutoffDayTs !== false && $dayTs < $cutoffDayTs)) {
                continue;
            }
            $activeDays[$dayKey] = $bucket;
        }

        $activeSessions = [];
        foreach ($sessions as $sessionId => $snapshot) {
            if (!is_string($sessionId) || !is_array($snapshot)) {
                continue;
            }
            $updatedAt = strtotime((string) ($snapshot['updatedAt'] ?? ''));
            if ($updatedAt === false || $updatedAt < $sessionCutoffTs) {
                continue;
            }
            $activeSessions[$sessionId] = $snapshot;
        }

        foreach ($activeDays as $dayKey => $bucket) {
            $daySessions = is_array($bucket['sessions'] ?? null)
                ? $bucket['sessions']
                : [];
            $filteredDaySessions = [];
            foreach ($daySessions as $sessionId => $sessionState) {
                if (!is_string($sessionId) || !is_array($sessionState)) {
                    continue;
                }
                $updatedAt = strtotime((string) ($sessionState['updatedAt'] ?? ''));
                if ($updatedAt === false || $updatedAt < $sessionCutoffTs) {
                    continue;
                }
                $filteredDaySessions[$sessionId] = $sessionState;
            }
            $activeDays[$dayKey]['sessions'] = $filteredDaySessions;
        }

        return [
            'updatedAt' => (string) ($data['updatedAt'] ?? ''),
            'days' => $activeDays,
            'sessions' => $activeSessions,
        ];
    }

    public static function mergeSummary(...$args)
    {
        return QueueMetricsFactory::mergeSummary(...$args);
    }

    public static function mergeCounts(...$args)
    {
        return QueueMetricsFactory::mergeCounts(...$args);
    }

    public static function diffCounts(...$args)
    {
        return QueueMetricsFactory::diffCounts(...$args);
    }

    public static function normalizeCountMap(...$args)
    {
        return QueueMetricsFactory::normalizeCountMap(...$args);
    }

    private static
    function readNestedValue(array $sources, array $keys, $fallback)
    {
        foreach ($sources as $source) {
            if (!is_array($source)) {
                continue;
            }
            foreach ($keys as $key) {
                if (array_key_exists($key, $source)) {
                    return $source[$key];
                }
            }
        }

        return $fallback;
    }

    private static
    function readValue(array $source, array $keys, $fallback)
    {
        foreach ($keys as $key) {
            if (array_key_exists($key, $source)) {
                return $source[$key];
            }
        }
        return $fallback;
    }

    private static
    function readPositiveInt(array $sources, array $keys): int
    {
        $value = self::readNestedValue($sources, $keys, 0);
        return max(0, (int) round((float) $value));
    }

    private static

    private static
    function normalizeIso(string $value): string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return '';
        }
        return strtotime($trimmed) === false ? '' : $trimmed;
    }

    public static function extractHelpRequestResolutionEvent(...$args)
    {
        return QueueMetricsFactory::extractHelpRequestResolutionEvent(...$args);
    }

    public static function normalizeCountKey(...$args)
    {
        return QueueMetricsFactory::normalizeCountKey(...$args);
    }

    public static function emptySummary()
    {
        return QueueMetricsFactory::emptySummary();
    }

    public static function buildEmptyDay(...$args)
    {
        return QueueMetricsFactory::buildEmptyDay(...$args);
    }

    private static
    function toList(array $counts): array
    {
        $rows = [];
        foreach ($counts as $label => $count) {
            $rows[] = [
                'label' => (string) $label,
                'count' => (int) $count,
            ];
        }
        return $rows;
    }

    private static
    function topRow(array $counts): array
    {
        foreach ($counts as $label => $count) {
            return [
                'label' => (string) $label,
                'count' => (int) $count,
            ];
        }

        return [
            'label' => '',
            'count' => 0,
        ];
    }

    private static
    function windowDays(int $days): array
    {
        $safeDays = max(1, $days);
        $keys = [];
        for ($offset = 0; $offset < $safeDays; $offset += 1) {
            $keys[] = date('Y-m-d', strtotime('-' . $offset . ' days'));
        }
        return $keys;
    }
}
