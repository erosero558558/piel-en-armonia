<?php

declare(strict_types=1);

final class CalendarHealthService
{
public static function publicCalendarSummaryFields(array $detailedPayload): array
    {
        $fields = [
            'calendarConfigured',
            'calendarReachable',
            'calendarMode',
            'calendarSource',
            'calendarAuth',
            'calendarTokenHealthy',
            'calendarLastSuccessAt',
            'calendarLastErrorAt',
            'calendarLastErrorReason',
        ];
        $payload = [];
        foreach ($fields as $field) {
            if (array_key_exists($field, $detailedPayload)) {
                $payload[$field] = $detailedPayload[$field];
            }
        }

        return $payload;
    }

public static function publicSyncSummaryPayload($raw): ?array
    {
        if (!is_array($raw)) {
            return null;
        }

        return [
            'configured' => (bool) ($raw['configured'] ?? false),
            'jobId' => (string) ($raw['jobId'] ?? ''),
            'healthy' => (bool) ($raw['healthy'] ?? false),
            'operationallyHealthy' => (bool) ($raw['operationallyHealthy'] ?? false),
            'repoHygieneIssue' => (bool) ($raw['repoHygieneIssue'] ?? false),
            'state' => (string) ($raw['state'] ?? 'unknown'),
            'ageSeconds' => array_key_exists('ageSeconds', $raw)
                ? $raw['ageSeconds']
                : null,
            'expectedMaxLagSeconds' => (int) ($raw['expectedMaxLagSeconds'] ?? 120),
            'lastCheckedAt' => (string) ($raw['lastCheckedAt'] ?? ''),
            'lastSuccessAt' => (string) ($raw['lastSuccessAt'] ?? ''),
            'lastErrorAt' => (string) ($raw['lastErrorAt'] ?? ''),
            'lastErrorMessage' => (string) ($raw['lastErrorMessage'] ?? ''),
            'failureReason' => (string) ($raw['failureReason'] ?? ''),
            'deployedCommit' => (string) ($raw['deployedCommit'] ?? ''),
            'currentHead' => (string) ($raw['currentHead'] ?? ''),
            'remoteHead' => (string) ($raw['remoteHead'] ?? ''),
            'headDrift' => (bool) ($raw['headDrift'] ?? false),
            'telemetryGap' => (bool) ($raw['telemetryGap'] ?? false),
            'dirtyPathsCount' => (int) ($raw['dirtyPathsCount'] ?? 0),
            'dirtyPathsSample' => is_array($raw['dirtyPathsSample'] ?? null)
                ? array_values($raw['dirtyPathsSample'])
                : [],
        ];
    }

public static function resolveCalendarReachable(
        bool $calendarActive,
        bool $calendarRequired,
        bool $calendarConfigured,
        string $lastSuccessAt,
        string $lastErrorAt
    ): bool {
        if (!$calendarActive) {
            return !$calendarRequired;
        }
        if (!$calendarConfigured) {
            return false;
        }
        if ($lastSuccessAt === '' && $lastErrorAt === '') {
            return true;
        }
        if ($lastSuccessAt === '') {
            return false;
        }
        if ($lastErrorAt === '') {
            return true;
        }
        return !HealthController::timestampGreater($lastErrorAt, $lastSuccessAt);
    }

public static function resolveCalendarMode(
        bool $calendarActive,
        bool $calendarRequired,
        bool $blockOnFailure,
        bool $calendarReachable
    ): string {
        if (!$calendarActive) {
            return $calendarRequired ? 'blocked' : 'live';
        }
        if ($blockOnFailure && !$calendarReachable) {
            return 'blocked';
        }
        return 'live';
    }

public static function resolveCalendarTokenHealthy(
        bool $calendarActive,
        bool $calendarRequired,
        bool $calendarConfigured,
        string $calendarAuth,
        array $tokenSnapshot
    ): bool {
        if (!$calendarActive) {
            return !$calendarRequired;
        }
        if (!$calendarConfigured) {
            return false;
        }
        if (!in_array($calendarAuth, ['oauth_refresh', 'service_account'], true)) {
            return false;
        }

        $expiresAt = (int) ($tokenSnapshot['expiresAt'] ?? 0);
        if ($expiresAt > (time() + 30)) {
            return true;
        }

        $lastSuccessAt = (string) ($tokenSnapshot['lastSuccessAt'] ?? '');
        $lastErrorAt = (string) ($tokenSnapshot['lastErrorAt'] ?? '');
        if ($lastSuccessAt === '' && $lastErrorAt === '') {
            return false;
        }
        if ($lastSuccessAt === '') {
            return false;
        }
        if ($lastErrorAt === '') {
            return true;
        }
        return !HealthController::timestampGreater($lastErrorAt, $lastSuccessAt);
    }

}
