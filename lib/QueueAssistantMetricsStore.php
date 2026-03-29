<?php

declare(strict_types=1);

require_once __DIR__ . '/storage.php';

final class QueueAssistantMetricsStore
{
    private const FILE_NAME = 'queue-assistant-metrics.json';
    private const RETAIN_DAYS = 35;
    private const SESSION_EXPIRE_SECONDS = 1209600;
    private const SUMMARY_FIELDS = [
        'actioned',
        'resolvedWithoutHuman',
        'assistedResolutions',
        'escalated',
        'clinicalBlocked',
        'fallback',
        'errors',
        'latencyTotalMs',
        'latencySamples',
        'queueWaitMsTotal',
        'queueWaitSamples',
    ];

    public static function recordHeartbeat(array $payload): void
    {
        $snapshot = self::extractSnapshot($payload);
        if ($snapshot === null) {
            return;
        }

        $data = self::prune(self::readRawData());
        $sessionId = (string) ($snapshot['sessionId'] ?? '');
        $previous = is_array($data['sessions'][$sessionId] ?? null)
            ? $data['sessions'][$sessionId]
            : null;
        $delta = self::buildDelta($previous, $snapshot);

        $dayKey = (string) ($snapshot['day'] ?? local_date('Y-m-d'));
        $dayBucket = is_array($data['days'][$dayKey] ?? null)
            ? $data['days'][$dayKey]
            : self::buildEmptyDay($dayKey);

        $dayBucket['summary'] = self::mergeSummary(
            is_array($dayBucket['summary'] ?? null)
                ? $dayBucket['summary']
                : self::emptySummary(),
            $delta
        );
        $dayBucket['intents'] = self::mergeCounts(
            is_array($dayBucket['intents'] ?? null) ? $dayBucket['intents'] : [],
            is_array($delta['intents'] ?? null) ? $delta['intents'] : []
        );
        $dayBucket['helpReasons'] = self::mergeCounts(
            is_array($dayBucket['helpReasons'] ?? null)
                ? $dayBucket['helpReasons']
                : [],
            is_array($delta['helpReasons'] ?? null) ? $delta['helpReasons'] : []
        );
        $dayBucket['reviewOutcomes'] = self::mergeCounts(
            is_array($dayBucket['reviewOutcomes'] ?? null)
                ? $dayBucket['reviewOutcomes']
                : [],
            is_array($delta['reviewOutcomes'] ?? null)
                ? $delta['reviewOutcomes']
                : []
        );
        $dayBucket['sessions'][$sessionId] = [
            'sessionId' => $sessionId,
            'updatedAt' => (string) ($snapshot['updatedAt'] ?? local_date('c')),
            'actioned' => (int) ($snapshot['actioned'] ?? 0),
            'resolvedWithoutHuman' => (int) ($snapshot['resolvedWithoutHuman'] ?? 0),
            'assistedResolutions' => (int) ($snapshot['assistedResolutions'] ?? 0),
            'escalated' => (int) ($snapshot['escalated'] ?? 0),
            'clinicalBlocked' => (int) ($snapshot['clinicalBlocked'] ?? 0),
            'fallback' => (int) ($snapshot['fallback'] ?? 0),
            'errors' => (int) ($snapshot['errors'] ?? 0),
            'useful' => ((int) ($snapshot['actioned'] ?? 0)) > 0,
            'lastIntent' => (string) ($snapshot['lastIntent'] ?? ''),
        ];

        $data['sessions'][$sessionId] = $snapshot;
        $data['days'][$dayKey] = $dayBucket;
        $data['updatedAt'] = local_date('c');

        self::writeRawData($data);
    }

    /**
     * @return array<string, mixed>
     */
    public static function buildReport(): array
    {
        $data = self::prune(self::readRawData());
        $days = is_array($data['days'] ?? null) ? $data['days'] : [];
        $todayKey = local_date('Y-m-d');
        $today = self::buildWindowSummary($days, [$todayKey]);
        $last7d = self::buildWindowSummary($days, self::windowDays(7));

        return [
            'today' => $today,
            'last7d' => $last7d,
            'intentBreakdown' => self::toList(
                is_array($last7d['intentCounts'] ?? null)
                    ? $last7d['intentCounts']
                    : []
            ),
            'helpReasonBreakdown' => self::toList(
                is_array($last7d['helpReasonCounts'] ?? null)
                    ? $last7d['helpReasonCounts']
                    : []
            ),
            'reviewOutcomeBreakdown' => self::toList(
                is_array($last7d['reviewOutcomeCounts'] ?? null)
                    ? $last7d['reviewOutcomeCounts']
                    : []
            ),
            'topIntent' => self::topRow(
                is_array($last7d['intentCounts'] ?? null)
                    ? $last7d['intentCounts']
                    : []
            ),
            'topHelpReason' => self::topRow(
                is_array($last7d['helpReasonCounts'] ?? null)
                    ? $last7d['helpReasonCounts']
                    : []
            ),
            'topReviewOutcome' => self::topRow(
                is_array($last7d['reviewOutcomeCounts'] ?? null)
                    ? $last7d['reviewOutcomeCounts']
                    : []
            ),
            'generatedAt' => local_date('c'),
        ];
    }

    public static function recordHelpRequestResolution(array $request): void
    {
        $event = self::extractHelpRequestResolutionEvent($request);
        if ($event === null) {
            return;
        }

        $data = self::prune(self::readRawData());
        $dayKey = (string) ($event['day'] ?? local_date('Y-m-d'));
        $dayBucket = is_array($data['days'][$dayKey] ?? null)
            ? $data['days'][$dayKey]
            : self::buildEmptyDay($dayKey);
        $summary = is_array($dayBucket['summary'] ?? null)
            ? $dayBucket['summary']
            : self::emptySummary();
        $summary['assistedResolutions'] = (int) ($summary['assistedResolutions'] ?? 0) + 1;
        $dayBucket['summary'] = $summary;
        $dayBucket['reviewOutcomes'] = self::mergeCounts(
            is_array($dayBucket['reviewOutcomes'] ?? null)
                ? $dayBucket['reviewOutcomes']
                : [],
            [
                (string) ($event['outcome'] ?? 'general_resolution') => 1,
            ]
        );
        $data['days'][$dayKey] = $dayBucket;
        $data['updatedAt'] = local_date('c');

        self::writeRawData($data);
    }

    public static function recordClinicQueueEvent(string $day, string $hour, ?int $waitMs): void
    {
        $data = self::prune(self::readRawData());
        $dayBucket = is_array($data['days'][$day] ?? null)
            ? $data['days'][$day]
            : self::buildEmptyDay($day);

        $summary = is_array($dayBucket['summary'] ?? null)
            ? $dayBucket['summary']
            : self::emptySummary();

        if ($waitMs !== null) {
            $summary['queueWaitMsTotal'] = (int) ($summary['queueWaitMsTotal'] ?? 0) + max(0, $waitMs);
            $summary['queueWaitSamples'] = (int) ($summary['queueWaitSamples'] ?? 0) + 1;
        }
        $dayBucket['summary'] = $summary;

        if ($hour !== '') {
            $dayBucket['hourlyThroughput'] = self::mergeCounts(
                is_array($dayBucket['hourlyThroughput'] ?? null) ? $dayBucket['hourlyThroughput'] : [],
                [$hour => 1]
            );
        }

        $data['days'][$day] = $dayBucket;
        $data['updatedAt'] = local_date('c');

        self::writeRawData($data);
    }

    private static function filePath(): string
    {
        return data_dir_path() . DIRECTORY_SEPARATOR . self::FILE_NAME;
    }

    private static function lockPath(): string
    {
        return self::filePath() . '.lock';
    }

    /**
     * @return array<string, mixed>|null
     */
    private static function extractSnapshot(array $payload): ?array
    {
        $surface = strtolower(trim((string) ($payload['surface'] ?? '')));
        if ($surface === 'sala_tv') {
            $surface = 'display';
        }
        if ($surface !== 'kiosk') {
            return null;
        }

        $details = is_array($payload['details'] ?? null)
            ? $payload['details']
            : [];
        $metrics = is_array($details['assistantMetrics'] ?? null)
            ? $details['assistantMetrics']
            : [];
        $updatedAt = self::normalizeIso(
            self::readValue(
                $payload,
                ['updatedAt', 'updated_at', 'lastEventAt', 'last_event_at'],
                ''
            )
        );
        if ($updatedAt === '') {
            $updatedAt = local_date('c');
        }

        $sessionId = trim((string) self::readNestedValue(
            [$details, $metrics],
            ['assistantSessionId', 'assistant_session_id', 'sessionId', 'session_id'],
            ''
        ));
        if ($sessionId === '') {
            return null;
        }

        $snapshot = [
            'sessionId' => $sessionId,
            'updatedAt' => $updatedAt,
            'day' => substr($updatedAt, 0, 10),
            'actioned' => self::readPositiveInt(
                [$details, $metrics],
                ['assistantActioned', 'assistant_actioned', 'actioned']
            ),
            'resolvedWithoutHuman' => self::readPositiveInt(
                [$details, $metrics],
                [
                    'assistantResolvedWithoutHuman',
                    'assistant_resolved_without_human',
                    'resolvedWithoutHuman',
                    'resolved_without_human',
                ]
            ),
            'assistedResolutions' => self::readPositiveInt(
                [$details, $metrics],
                [
                    'assistantAssistedResolutions',
                    'assistant_assisted_resolutions',
                    'assistedResolutions',
                    'assisted_resolutions',
                ]
            ),
            'escalated' => self::readPositiveInt(
                [$details, $metrics],
                ['assistantEscalated', 'assistant_escalated', 'escalated']
            ),
            'clinicalBlocked' => self::readPositiveInt(
                [$details, $metrics],
                [
                    'assistantClinicalBlocked',
                    'assistant_clinical_blocked',
                    'clinicalBlocked',
                    'clinical_blocked',
                ]
            ),
            'fallback' => self::readPositiveInt(
                [$details, $metrics],
                ['assistantFallback', 'assistant_fallback', 'fallback']
            ),
            'errors' => self::readPositiveInt(
                [$details, $metrics],
                ['assistantErrors', 'assistant_errors', 'errors']
            ),
            'lastIntent' => trim((string) self::readNestedValue(
                [$details, $metrics],
                ['assistantLastIntent', 'assistant_last_intent', 'lastIntent', 'last_intent'],
                ''
            )),
            'lastLatencyMs' => self::readPositiveInt(
                [$details, $metrics],
                ['assistantLastLatencyMs', 'assistant_last_latency_ms', 'lastLatencyMs', 'last_latency_ms']
            ),
            'latencyTotalMs' => self::readPositiveInt(
                [$details, $metrics],
                [
                    'assistantLatencyTotalMs',
                    'assistant_latency_total_ms',
                    'latencyTotalMs',
                    'latency_total_ms',
                ]
            ),
            'latencySamples' => self::readPositiveInt(
                [$details, $metrics],
                [
                    'assistantLatencySamples',
                    'assistant_latency_samples',
                    'latencySamples',
                    'latency_samples',
                ]
            ),
            'intents' => self::normalizeCountMap(self::readNestedValue(
                [$details, $metrics],
                ['assistantIntents', 'assistant_intents', 'intents'],
                []
            )),
            'helpReasons' => self::normalizeCountMap(self::readNestedValue(
                [$details, $metrics],
                ['assistantHelpReasons', 'assistant_help_reasons', 'helpReasons', 'help_reasons'],
                []
            )),
            'reviewOutcomes' => self::normalizeCountMap(self::readNestedValue(
                [$details, $metrics],
                [
                    'assistantReviewOutcomes',
                    'assistant_review_outcomes',
                    'reviewOutcomes',
                    'review_outcomes',
                ],
                []
            )),
        ];

        $hasSignal = false;
        foreach (self::SUMMARY_FIELDS as $field) {
            if (((int) ($snapshot[$field] ?? 0)) > 0) {
                $hasSignal = true;
                break;
            }
        }
        if (!$hasSignal) {
            $hasSignal =
                $snapshot['intents'] !== [] ||
                $snapshot['helpReasons'] !== [] ||
                $snapshot['reviewOutcomes'] !== [];
        }

        return $hasSignal ? $snapshot : null;
    }

    /**
     * @param array<string, mixed>|null $previous
     * @param array<string, mixed> $current
     * @return array<string, mixed>
     */
    private static function buildDelta(?array $previous, array $current): array
    {
        $delta = [
            'intents' => [],
            'helpReasons' => [],
            'reviewOutcomes' => [],
        ];

        foreach (self::SUMMARY_FIELDS as $field) {
            $currentValue = (int) ($current[$field] ?? 0);
            $previousValue = is_array($previous)
                ? (int) ($previous[$field] ?? 0)
                : 0;
            $delta[$field] = max(0, $currentValue - $previousValue);
        }

        $delta['intents'] = self::diffCounts(
            is_array($current['intents'] ?? null) ? $current['intents'] : [],
            is_array($previous['intents'] ?? null) ? $previous['intents'] : []
        );
        $delta['helpReasons'] = self::diffCounts(
            is_array($current['helpReasons'] ?? null) ? $current['helpReasons'] : [],
            is_array($previous['helpReasons'] ?? null)
                ? $previous['helpReasons']
                : []
        );
        $delta['reviewOutcomes'] = self::diffCounts(
            is_array($current['reviewOutcomes'] ?? null)
                ? $current['reviewOutcomes']
                : [],
            is_array($previous['reviewOutcomes'] ?? null)
                ? $previous['reviewOutcomes']
                : []
        );

        return $delta;
    }

    /**
     * @param array<string, mixed> $days
     * @param array<int, string> $dayKeys
     * @return array<string, mixed>
     */
    private static function buildWindowSummary(array $days, array $dayKeys): array
    {
        $summary = array_merge(self::emptySummary(), [
            'sessions' => 0,
            'usefulSessions' => 0,
            'avgLatencyMs' => 0,
            'avgQueueWaitMs' => 0,
            'intentCounts' => [],
            'helpReasonCounts' => [],
            'reviewOutcomeCounts' => [],
            'hourlyThroughput' => [],
        ]);
        $sessionStates = [];

        foreach ($dayKeys as $dayKey) {
            $bucket = is_array($days[$dayKey] ?? null) ? $days[$dayKey] : null;
            if (!is_array($bucket)) {
                continue;
            }

            $summary = self::mergeSummary(
                $summary,
                is_array($bucket['summary'] ?? null)
                    ? $bucket['summary']
                    : self::emptySummary()
            );
            $summary['intentCounts'] = self::mergeCounts(
                is_array($summary['intentCounts'] ?? null)
                    ? $summary['intentCounts']
                    : [],
                is_array($bucket['intents'] ?? null) ? $bucket['intents'] : []
            );
            $summary['helpReasonCounts'] = self::mergeCounts(
                is_array($summary['helpReasonCounts'] ?? null)
                    ? $summary['helpReasonCounts']
                    : [],
                is_array($bucket['helpReasons'] ?? null)
                    ? $bucket['helpReasons']
                    : []
            );
            $summary['reviewOutcomeCounts'] = self::mergeCounts(
                is_array($summary['reviewOutcomeCounts'] ?? null)
                    ? $summary['reviewOutcomeCounts']
                    : [],
                is_array($bucket['reviewOutcomes'] ?? null)
                    ? $bucket['reviewOutcomes']
                    : []
            );
            $summary['hourlyThroughput'] = self::mergeCounts(
                is_array($summary['hourlyThroughput'] ?? null)
                    ? $summary['hourlyThroughput']
                    : [],
                is_array($bucket['hourlyThroughput'] ?? null)
                    ? $bucket['hourlyThroughput']
                    : []
            );

            $sessions = is_array($bucket['sessions'] ?? null)
                ? $bucket['sessions']
                : [];
            foreach ($sessions as $sessionId => $sessionState) {
                if (!is_string($sessionId) || !is_array($sessionState)) {
                    continue;
                }
                $sessionStates[$sessionId] = [
                    'actioned' => max(
                        (int) ($sessionStates[$sessionId]['actioned'] ?? 0),
                        (int) ($sessionState['actioned'] ?? 0)
                    ),
                    'useful' => !empty($sessionState['useful']),
                ];
            }
        }

        $summary['sessions'] = count(array_filter(
            $sessionStates,
            static function (array $sessionState): bool {
                return (int) ($sessionState['actioned'] ?? 0) > 0;
            }
        ));
        $summary['usefulSessions'] = count(array_filter(
            $sessionStates,
            static function (array $sessionState): bool {
                return !empty($sessionState['useful']);
            }
        ));
        $summary['avgLatencyMs'] = ((int) ($summary['latencySamples'] ?? 0)) > 0
            ? (int) round(
                ((int) ($summary['latencyTotalMs'] ?? 0)) /
                    ((int) ($summary['latencySamples'] ?? 1))
            )
            : 0;
        $summary['avgQueueWaitMs'] = ((int) ($summary['queueWaitSamples'] ?? 0)) > 0
            ? (int) round(
                ((int) ($summary['queueWaitMsTotal'] ?? 0)) /
                    ((int) ($summary['queueWaitSamples'] ?? 1))
            )
            : 0;

        return $summary;
    }

    /**
     * @return array<string, mixed>
     */
    private static function readRawData(): array
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

    /**
     * @param array<string, mixed> $data
     */
    private static function writeRawData(array $data): void
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

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    private static function prune(array $data): array
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

    /**
     * @param array<string, mixed> $summary
     * @param array<string, mixed> $delta
     * @return array<string, mixed>
     */
    private static function mergeSummary(array $summary, array $delta): array
    {
        $merged = $summary;
        foreach (self::SUMMARY_FIELDS as $field) {
            $merged[$field] =
                (int) ($merged[$field] ?? 0) + (int) ($delta[$field] ?? 0);
        }
        return $merged;
    }

    /**
     * @param array<string, int> $base
     * @param array<string, int> $delta
     * @return array<string, int>
     */
    private static function mergeCounts(array $base, array $delta): array
    {
        $merged = $base;
        foreach ($delta as $key => $value) {
            if (!is_string($key) || $key === '') {
                continue;
            }
            $merged[$key] = (int) ($merged[$key] ?? 0) + (int) $value;
        }
        arsort($merged);
        return $merged;
    }

    /**
     * @param array<string, int> $current
     * @param array<string, int> $previous
     * @return array<string, int>
     */
    private static function diffCounts(array $current, array $previous): array
    {
        $delta = [];
        foreach ($current as $key => $value) {
            if (!is_string($key) || $key === '') {
                continue;
            }
            $nextValue = max(0, (int) $value - (int) ($previous[$key] ?? 0));
            if ($nextValue <= 0) {
                continue;
            }
            $delta[$key] = $nextValue;
        }
        return $delta;
    }

    /**
     * @param mixed $value
     * @return array<string, int>
     */
    private static function normalizeCountMap($value): array
    {
        if (!is_array($value)) {
            return [];
        }

        $normalized = [];
        foreach ($value as $rawKey => $rawValue) {
            $key = strtolower(trim((string) $rawKey));
            $count = max(0, (int) round((float) $rawValue));
            if ($key === '' || $count <= 0) {
                continue;
            }
            $normalized[$key] = $count;
        }
        arsort($normalized);
        return $normalized;
    }

    /**
     * @param array<int, array<string, mixed>> $sources
     * @param array<int, string> $keys
     * @param mixed $fallback
     * @return mixed
     */
    private static function readNestedValue(array $sources, array $keys, $fallback)
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

    /**
     * @param array<string, mixed> $source
     * @param array<int, string> $keys
     * @param mixed $fallback
     * @return mixed
     */
    private static function readValue(array $source, array $keys, $fallback)
    {
        foreach ($keys as $key) {
            if (array_key_exists($key, $source)) {
                return $source[$key];
            }
        }
        return $fallback;
    }

    /**
     * @param array<int, array<string, mixed>> $sources
     * @param array<int, string> $keys
     */
    private static function readPositiveInt(array $sources, array $keys): int
    {
        $value = self::readNestedValue($sources, $keys, 0);
        return max(0, (int) round((float) $value));
    }

    private static function normalizeIso(string $value): string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return '';
        }
        return strtotime($trimmed) === false ? '' : $trimmed;
    }

    /**
     * @param array<string, mixed> $request
     * @return array<string, string>|null
     */
    private static function extractHelpRequestResolutionEvent(array $request): ?array
    {
        $status = strtolower(trim((string) ($request['status'] ?? '')));
        if ($status !== 'resolved') {
            return null;
        }

        $context = is_array($request['context'] ?? null)
            ? $request['context']
            : [];
        $outcome = self::normalizeCountKey((string) self::readValue(
            $context,
            ['resolutionOutcome', 'resolution_outcome', 'reviewOutcome', 'review_outcome'],
            ''
        ));
        if ($outcome === '') {
            return null;
        }

        $resolvedAt = self::normalizeIso((string) self::readValue(
            $request,
            ['resolvedAt', 'resolved_at', 'updatedAt', 'updated_at', 'createdAt', 'created_at'],
            ''
        ));
        if ($resolvedAt === '') {
            $resolvedAt = local_date('c');
        }

        return [
            'day' => substr($resolvedAt, 0, 10),
            'outcome' => $outcome,
        ];
    }

    private static function normalizeCountKey(string $value): string
    {
        $normalized = strtolower(trim($value));
        if ($normalized === '') {
            return '';
        }

        $normalized = preg_replace('/[^a-z0-9]+/', '_', $normalized);
        return trim((string) $normalized, '_');
    }

    /**
     * @return array<string, int>
     */
    private static function emptySummary(): array
    {
        return [
            'actioned' => 0,
            'resolvedWithoutHuman' => 0,
            'assistedResolutions' => 0,
            'escalated' => 0,
            'clinicalBlocked' => 0,
            'fallback' => 0,
            'errors' => 0,
            'latencyTotalMs' => 0,
            'latencySamples' => 0,
            'queueWaitMsTotal' => 0,
            'queueWaitSamples' => 0,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private static function buildEmptyDay(string $dayKey): array
    {
        return [
            'date' => $dayKey,
            'summary' => self::emptySummary(),
            'intents' => [],
            'helpReasons' => [],
            'reviewOutcomes' => [],
            'hourlyThroughput' => [],
            'sessions' => [],
        ];
    }

    /**
     * @param array<string, int> $counts
     * @return array<int, array{label:string,count:int}>
     */
    private static function toList(array $counts): array
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

    /**
     * @param array<string, int> $counts
     * @return array{label:string,count:int}
     */
    private static function topRow(array $counts): array
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

    /**
     * @return array<int, string>
     */
    private static function windowDays(int $days): array
    {
        $safeDays = max(1, $days);
        $keys = [];
        for ($offset = 0; $offset < $safeDays; $offset += 1) {
            $keys[] = date('Y-m-d', strtotime('-' . $offset . ' days'));
        }
        return $keys;
    }
}
