<?php

declare(strict_types=1);

require_once __DIR__ . '/../storage.php';
require_once __DIR__ . '/AnalyticsLabelNormalizer.php';

final class FunnelTimelineStore
{
    private const FILE_NAME = 'funnel-timeline.json';
    private const RETAIN_DAYS = 35;

    public static function recordEvent(string $event, array $labels = []): void
    {
        $normalizedEvent = AnalyticsLabelNormalizer::normalize($event, '');
        if ($normalizedEvent === '') {
            return;
        }

        $summaryField = self::resolveSummaryField($normalizedEvent);
        if ($summaryField === '') {
            return;
        }

        $data = self::prune(self::readRawData());
        $dayKey = local_date('Y-m-d');
        $dayBucket = is_array($data['days'][$dayKey] ?? null)
            ? $data['days'][$dayKey]
            : self::buildEmptyDay($dayKey);
        $summary = is_array($dayBucket['summary'] ?? null)
            ? $dayBucket['summary']
            : self::emptySummary();

        $summary[$summaryField] = (int) ($summary[$summaryField] ?? 0) + 1;
        $dayBucket['summary'] = $summary;
        $dayBucket['updatedAt'] = local_date('c');

        $data['days'][$dayKey] = $dayBucket;
        $data['updatedAt'] = local_date('c');

        self::writeRawData($data);
    }

    /**
     * @return array<string,mixed>
     */
    public static function buildReport(int $days = 7): array
    {
        $windowDays = self::windowDays($days);
        $data = self::prune(self::readRawData());
        $series = [];
        $totals = self::emptySummary();

        foreach ($windowDays as $dayKey) {
            $summary = self::readDaySummary($data, $dayKey);
            $series[] = [
                'day' => $dayKey,
                'label' => $dayKey,
                'visits' => (int) ($summary['visits'] ?? 0),
                'whatsappClicks' => (int) ($summary['whatsappClicks'] ?? 0),
                'bookingConfirmed' => (int) ($summary['bookingConfirmed'] ?? 0),
            ];

            foreach (array_keys(self::emptySummary()) as $field) {
                $totals[$field] = (int) ($totals[$field] ?? 0) + (int) ($summary[$field] ?? 0);
            }
        }

        $todayKey = $windowDays !== [] ? (string) end($windowDays) : local_date('Y-m-d');
        $today = self::readDaySummary($data, $todayKey);
        $windowSize = max(1, count($windowDays));

        return [
            'today' => [
                'day' => $todayKey,
                'visits' => (int) ($today['visits'] ?? 0),
                'whatsappClicks' => (int) ($today['whatsappClicks'] ?? 0),
                'bookingConfirmed' => (int) ($today['bookingConfirmed'] ?? 0),
            ],
            'last7d' => [
                'days' => $windowSize,
                'visits' => (int) ($totals['visits'] ?? 0),
                'whatsappClicks' => (int) ($totals['whatsappClicks'] ?? 0),
                'bookingConfirmed' => (int) ($totals['bookingConfirmed'] ?? 0),
                'visitsPerDay' => round(((float) ($totals['visits'] ?? 0)) / $windowSize, 1),
                'whatsappClicksPerDay' => round(((float) ($totals['whatsappClicks'] ?? 0)) / $windowSize, 1),
                'bookingConfirmedPerDay' => round(((float) ($totals['bookingConfirmed'] ?? 0)) / $windowSize, 1),
            ],
            'dailySeries' => $series,
            'generatedAt' => local_date('c'),
        ];
    }

    private static function resolveSummaryField(string $event): string
    {
        switch ($event) {
            case 'view_booking':
                return 'visits';
            case 'whatsapp_click':
                return 'whatsappClicks';
            case 'booking_confirmed':
                return 'bookingConfirmed';
            default:
                return '';
        }
    }

    private static function filePath(): string
    {
        return data_dir_path() . DIRECTORY_SEPARATOR . self::FILE_NAME;
    }

    /**
     * @return array<string,mixed>
     */
    private static function readRawData(): array
    {
        $path = self::filePath();
        if (!is_file($path)) {
            return self::buildEmptyData();
        }

        $raw = @file_get_contents($path);
        if (!is_string($raw) || trim($raw) === '') {
            return self::buildEmptyData();
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return self::buildEmptyData();
        }

        $days = is_array($decoded['days'] ?? null) ? $decoded['days'] : [];

        return [
            'updatedAt' => (string) ($decoded['updatedAt'] ?? ''),
            'days' => $days,
        ];
    }

    /**
     * @param array<string,mixed> $data
     */
    private static function writeRawData(array $data): void
    {
        $path = self::filePath();
        $dir = dirname($path);
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        ensure_data_htaccess($dir);

        $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($json)) {
            return;
        }

        $fp = @fopen($path, 'c+');
        if (!$fp) {
            return;
        }

        if (!flock($fp, LOCK_EX)) {
            fclose($fp);
            return;
        }

        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, $json);
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    private static function prune(array $data): array
    {
        $days = is_array($data['days'] ?? null) ? $data['days'] : [];
        $cutoff = strtotime('-' . self::RETAIN_DAYS . ' days');
        if ($cutoff === false) {
            return $data;
        }

        foreach (array_keys($days) as $dayKey) {
            $dayTs = strtotime($dayKey . ' 00:00:00');
            if ($dayTs === false || $dayTs < $cutoff) {
                unset($days[$dayKey]);
            }
        }

        ksort($days);
        $data['days'] = $days;
        return $data;
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,int>
     */
    private static function readDaySummary(array $data, string $dayKey): array
    {
        $dayBucket = is_array($data['days'][$dayKey] ?? null) ? $data['days'][$dayKey] : [];
        $summary = is_array($dayBucket['summary'] ?? null) ? $dayBucket['summary'] : [];

        return [
            'visits' => max(0, (int) ($summary['visits'] ?? 0)),
            'whatsappClicks' => max(0, (int) ($summary['whatsappClicks'] ?? 0)),
            'bookingConfirmed' => max(0, (int) ($summary['bookingConfirmed'] ?? 0)),
        ];
    }

    /**
     * @return array<string,mixed>
     */
    private static function buildEmptyData(): array
    {
        return [
            'updatedAt' => '',
            'days' => [],
        ];
    }

    /**
     * @return array<string,mixed>
     */
    private static function buildEmptyDay(string $dayKey): array
    {
        return [
            'day' => $dayKey,
            'updatedAt' => '',
            'summary' => self::emptySummary(),
        ];
    }

    /**
     * @return array<string,int>
     */
    private static function emptySummary(): array
    {
        return [
            'visits' => 0,
            'whatsappClicks' => 0,
            'bookingConfirmed' => 0,
        ];
    }

    /**
     * @return array<int,string>
     */
    private static function windowDays(int $days): array
    {
        $safeDays = max(1, min(30, $days));
        $rows = [];
        $cursor = strtotime('-' . ($safeDays - 1) . ' days');
        if ($cursor === false) {
            return [local_date('Y-m-d')];
        }

        for ($offset = 0; $offset < $safeDays; $offset += 1) {
            $rows[] = date('Y-m-d', strtotime('+' . $offset . ' days', $cursor));
        }

        return $rows;
    }
}
