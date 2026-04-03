<?php

declare(strict_types=1);

final class LeadTrackingService
{
private static function recordFirstContactMetric(array $callback, string $contactedAt): void
    {
        if (!class_exists('Metrics')) {
            return;
        }

        $minutes = self::minutesToFirstContact($callback, $contactedAt);
        if ($minutes === null) {
            return;
        }

        Metrics::observe(
            'lead_ops_first_contact_minutes',
            $minutes,
            [],
            [5, 10, 20, 30, 60, 120, 240, 480, 1440]
        );
    }

private static function minutesToFirstContact(array $callback, string $contactedAt): ?float
    {
        $createdAt = LeadOpsService::timestampValue((string) ($callback['fecha'] ?? ''));
        $contactedTs = LeadOpsService::timestampValue($contactedAt);
        if ($createdAt <= 0 || $contactedTs <= $createdAt) {
            return null;
        }

        return ($contactedTs - $createdAt) / 60;
    }

    /**
     * @param list<float> $values
     */

private static function average(array $values): float
    {
        if ($values === []) {
            return 0.0;
        }

        return array_sum($values) / count($values);
    }

    /**
     * @param list<float> $values
     */

private static function percentile(array $values, float $percentile): float
    {
        if ($values === []) {
            return 0.0;
        }

        sort($values, SORT_NUMERIC);
        $rank = (int) ceil((max(0.0, min(100.0, $percentile)) / 100) * count($values));
        $index = max(0, min(count($values) - 1, $rank - 1));

        return (float) $values[$index];
    }

private static function percentage(int $numerator, int $denominator): float
    {
        if ($denominator <= 0) {
            return 0.0;
        }

        return self::roundMetric(($numerator / $denominator) * 100);
    }

private static function roundMetric(float $value): float
    {
        return round($value, 2);
    }

}
