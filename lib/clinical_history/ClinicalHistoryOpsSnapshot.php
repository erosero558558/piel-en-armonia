<?php

declare(strict_types=1);

final class ClinicalHistoryOpsSnapshot
{
    private const SESSION_STATUS_KEYS = [
        'active',
        'review_required',
        'approved',
        'draft_ready',
    ];

    private const REVIEW_STATUS_KEYS = [
        'pending_review',
        'review_required',
        'ready_for_review',
        'approved',
    ];

    private const EVENT_STATUS_KEYS = [
        'open',
        'acknowledged',
        'resolved',
    ];

    private const EVENT_SEVERITY_KEYS = [
        'info',
        'warning',
        'critical',
    ];

    public static function build(array $store): array
    {
        $sessions = isset($store['clinical_history_sessions']) && is_array($store['clinical_history_sessions'])
            ? array_values($store['clinical_history_sessions'])
            : [];
        $drafts = isset($store['clinical_history_drafts']) && is_array($store['clinical_history_drafts'])
            ? array_values($store['clinical_history_drafts'])
            : [];
        $events = isset($store['clinical_history_events']) && is_array($store['clinical_history_events'])
            ? array_values($store['clinical_history_events'])
            : [];

        $draftsBySessionId = [];
        foreach ($drafts as $draftRecord) {
            $draft = ClinicalHistoryRepository::adminDraft($draftRecord);
            $sessionId = ClinicalHistoryRepository::trimString($draft['sessionId'] ?? '');
            if ($sessionId !== '') {
                $draftsBySessionId[$sessionId] = $draft;
            }
        }

        $openEventStatsBySessionId = self::buildOpenEventStatsBySession($events);
        $eventsBySessionId = self::groupEventsBySession($events);

        $sessionStatusCounts = self::initializeCounters(self::SESSION_STATUS_KEYS);
        $reviewStatusCounts = self::initializeCounters(self::REVIEW_STATUS_KEYS);
        $reviewQueue = [];
        $pendingAiCount = 0;
        $latestActivityAt = '';
        $pendingCopyRequests = 0;
        $overdueCopyRequests = 0;
        $disclosuresCount = 0;
        $archiveEligibleCount = 0;
        $hcu001Coverage = [
            'complete' => 0,
            'partial' => 0,
            'legacy_partial' => 0,
            'missing' => 0,
        ];
        $hcu005Coverage = [
            'complete' => 0,
            'partial' => 0,
            'missing' => 0,
        ];
        $hcu007Coverage = [
            'not_applicable' => 0,
            'draft' => 0,
            'ready_to_issue' => 0,
            'received' => 0,
            'issued' => 0,
            'cancelled' => 0,
            'incomplete' => 0,
        ];
        $hcu010ACoverage = [
            'not_applicable' => 0,
            'draft' => 0,
            'ready_to_issue' => 0,
            'issued' => 0,
            'cancelled' => 0,
            'incomplete' => 0,
        ];
        $hcu012ACoverage = [
            'not_applicable' => 0,
            'draft' => 0,
            'ready_to_issue' => 0,
            'issued' => 0,
            'received' => 0,
            'cancelled' => 0,
            'incomplete' => 0,
        ];
        $hcu024Coverage = [
            'not_applicable' => 0,
            'draft' => 0,
            'ready_for_declaration' => 0,
            'accepted' => 0,
            'declined' => 0,
            'revoked' => 0,
            'incomplete' => 0,
        ];

        foreach ($sessions as $sessionRecord) {
            $session = ClinicalHistoryRepository::adminSession($sessionRecord);
            $sessionId = ClinicalHistoryRepository::trimString($session['sessionId'] ?? '');
            $draft = isset($draftsBySessionId[$sessionId])
                ? $draftsBySessionId[$sessionId]
                : ClinicalHistoryRepository::defaultDraft($session);

            $sessionStatus = ClinicalHistoryRepository::trimString($session['status'] ?? 'active');
            if ($sessionStatus === '') {
                $sessionStatus = 'active';
            }
            $sessionStatusCounts[$sessionStatus] = ($sessionStatusCounts[$sessionStatus] ?? 0) + 1;

            $reviewStatus = ClinicalHistoryRepository::trimString($draft['reviewStatus'] ?? 'pending_review');
            if ($reviewStatus === '') {
                $reviewStatus = 'pending_review';
            }
            $reviewStatusCounts[$reviewStatus] = ($reviewStatusCounts[$reviewStatus] ?? 0) + 1;

            $pendingAi = ClinicalHistoryRepository::normalizePendingAi(
                isset($session['pendingAi']) && is_array($session['pendingAi']) ? $session['pendingAi'] : []
            );
            if ($pendingAi !== []) {
                $pendingAiCount++;
            }

            $latestActivityAt = self::maxTimestamp(
                $latestActivityAt,
                (string) ($session['updatedAt'] ?? $draft['updatedAt'] ?? '')
            );
            $copyRequests = ClinicalHistoryRepository::normalizeCopyRequests($draft['copyRequests'] ?? []);
            $disclosureLog = ClinicalHistoryRepository::normalizeDisclosureLog($draft['disclosureLog'] ?? []);
            $archiveReadiness = self::buildArchiveReadiness($session, $draft);
            $pendingCopyRequests += self::countPendingCopyRequests($copyRequests);
            $overdueCopyRequests += self::countOverdueCopyRequests($copyRequests);
            $disclosuresCount += count($disclosureLog);
            if (($archiveReadiness['eligibleForPassive'] ?? false) === true) {
                $archiveEligibleCount++;
            }
            $legalReadiness = ClinicalHistoryLegalReadiness::build(
                $session,
                $draft,
                $eventsBySessionId[$sessionId] ?? []
            );
            $hcu001Status = ClinicalHistoryRepository::trimString(
                $legalReadiness['hcu001Status']['status'] ?? 'missing'
            );
            if (!array_key_exists($hcu001Status, $hcu001Coverage)) {
                $hcu001Status = 'missing';
            }
            $hcu001Coverage[$hcu001Status]++;
            $hcu005Status = ClinicalHistoryRepository::trimString(
                $legalReadiness['hcu005Status']['status'] ?? 'missing'
            );
            if (!array_key_exists($hcu005Status, $hcu005Coverage)) {
                $hcu005Status = 'missing';
            }
            $hcu005Coverage[$hcu005Status]++;
            $hcu007Status = ClinicalHistoryRepository::trimString(
                $legalReadiness['hcu007Status']['status'] ?? 'not_applicable'
            );
            if (!array_key_exists($hcu007Status, $hcu007Coverage)) {
                $hcu007Status = 'not_applicable';
            }
            $hcu007Coverage[$hcu007Status]++;
            $hcu010AStatus = ClinicalHistoryRepository::trimString(
                $legalReadiness['hcu010AStatus']['status'] ?? 'not_applicable'
            );
            if (!array_key_exists($hcu010AStatus, $hcu010ACoverage)) {
                $hcu010AStatus = 'not_applicable';
            }
            $hcu010ACoverage[$hcu010AStatus]++;
            $hcu012AStatus = ClinicalHistoryRepository::trimString(
                $legalReadiness['hcu012AStatus']['status'] ?? 'not_applicable'
            );
            if (!array_key_exists($hcu012AStatus, $hcu012ACoverage)) {
                $hcu012AStatus = 'not_applicable';
            }
            $hcu012ACoverage[$hcu012AStatus]++;
            $hcu024Status = ClinicalHistoryRepository::trimString(
                $legalReadiness['hcu024Status']['status'] ?? 'not_applicable'
            );
            if (!array_key_exists($hcu024Status, $hcu024Coverage)) {
                $hcu024Status = 'not_applicable';
            }
            $hcu024Coverage[$hcu024Status]++;

            if (self::needsReviewQueue($session, $draft, $pendingAi)) {
                $reviewQueue[] = self::buildReviewQueueRow(
                    $session,
                    $draft,
                    $pendingAi,
                    $openEventStatsBySessionId[$sessionId] ?? [],
                    $legalReadiness,
                    $copyRequests,
                    $disclosureLog,
                    $archiveReadiness
                );
            }
        }

        usort($reviewQueue, static function (array $left, array $right): int {
            $priorityLeft = self::reviewPriority($left);
            $priorityRight = self::reviewPriority($right);
            if ($priorityLeft !== $priorityRight) {
                return $priorityLeft <=> $priorityRight;
            }
            return strcmp((string) ($right['updatedAt'] ?? ''), (string) ($left['updatedAt'] ?? ''));
        });

        $eventStatusCounts = self::initializeCounters(self::EVENT_STATUS_KEYS);
        $eventSeverityCounts = self::initializeCounters(self::EVENT_SEVERITY_KEYS);
        $eventTypeCounts = [];
        $unreadEventsCount = 0;
        $openEventsCount = 0;
        $openSeverityCounts = self::initializeCounters(self::EVENT_SEVERITY_KEYS);
        $eventFeed = [];

        foreach ($events as $eventRecord) {
            $event = ClinicalHistoryRepository::defaultEvent($eventRecord);
            $status = ClinicalHistoryRepository::trimString($event['status'] ?? 'open');
            if ($status === '') {
                $status = 'open';
            }
            $severity = ClinicalHistoryRepository::trimString($event['severity'] ?? 'info');
            if ($severity === '') {
                $severity = 'info';
            }
            $type = ClinicalHistoryRepository::trimString($event['type'] ?? 'unknown');
            if ($type === '') {
                $type = 'unknown';
            }

            $eventStatusCounts[$status] = ($eventStatusCounts[$status] ?? 0) + 1;
            $eventSeverityCounts[$severity] = ($eventSeverityCounts[$severity] ?? 0) + 1;
            $eventTypeCounts[$type] = ($eventTypeCounts[$type] ?? 0) + 1;

            if ($status === 'open') {
                $openEventsCount++;
                $openSeverityCounts[$severity] = ($openSeverityCounts[$severity] ?? 0) + 1;
                if (ClinicalHistoryRepository::trimString($event['acknowledgedAt'] ?? '') === '') {
                    $unreadEventsCount++;
                }
            }

            $sessionId = ClinicalHistoryRepository::trimString($event['sessionId'] ?? '');
            $draft = isset($draftsBySessionId[$sessionId])
                ? $draftsBySessionId[$sessionId]
                : ClinicalHistoryRepository::defaultDraft(['sessionId' => $sessionId, 'caseId' => $event['caseId'] ?? '']);
            $eventFeed[] = self::buildEventRow($event, $draft);
            $latestActivityAt = self::maxTimestamp(
                $latestActivityAt,
                (string) ($event['occurredAt'] ?? $event['createdAt'] ?? '')
            );
        }

        usort($eventFeed, static function (array $left, array $right): int {
            return strcmp((string) ($right['occurredAt'] ?? ''), (string) ($left['occurredAt'] ?? ''));
        });

        $snapshot = [
            'configured' => true,
            'sessions' => [
                'total' => count($sessions),
                'byStatus' => $sessionStatusCounts,
            ],
            'drafts' => [
                'total' => count($drafts),
                'byReviewStatus' => $reviewStatusCounts,
                'pendingAiCount' => $pendingAiCount,
                'reviewQueueCount' => count($reviewQueue),
                'hcu001' => $hcu001Coverage,
                'hcu005' => $hcu005Coverage,
                'hcu007' => $hcu007Coverage,
                'hcu010A' => $hcu010ACoverage,
                'hcu012A' => $hcu012ACoverage,
                'hcu024' => $hcu024Coverage,
            ],
            'events' => [
                'total' => count($eventFeed),
                'openCount' => $openEventsCount,
                'unreadCount' => $unreadEventsCount,
                'byStatus' => $eventStatusCounts,
                'bySeverity' => $eventSeverityCounts,
                'openBySeverity' => $openSeverityCounts,
                'byType' => $eventTypeCounts,
                'items' => array_values($eventFeed),
            ],
            'reviewQueue' => [
                'count' => count($reviewQueue),
                'items' => array_values($reviewQueue),
            ],
            'recordsGovernance' => [
                'pendingCopyRequests' => $pendingCopyRequests,
                'overdueCopyRequests' => $overdueCopyRequests,
                'disclosures' => $disclosuresCount,
                'archiveEligible' => $archiveEligibleCount,
            ],
            'latestActivityAt' => $latestActivityAt,
        ];

        $snapshot['diagnostics'] = self::buildDiagnostics($snapshot);
        return $snapshot;
    }

    public static function forAdmin(array $snapshot): array
    {
        return [
            'summary' => [
                'configured' => (bool) ($snapshot['configured'] ?? false),
                'sessions' => $snapshot['sessions'] ?? [],
                'drafts' => $snapshot['drafts'] ?? [],
                'events' => [
                    'total' => (int) ($snapshot['events']['total'] ?? 0),
                    'openCount' => (int) ($snapshot['events']['openCount'] ?? 0),
                    'unreadCount' => (int) ($snapshot['events']['unreadCount'] ?? 0),
                    'byStatus' => $snapshot['events']['byStatus'] ?? [],
                    'bySeverity' => $snapshot['events']['bySeverity'] ?? [],
                    'openBySeverity' => $snapshot['events']['openBySeverity'] ?? [],
                    'byType' => $snapshot['events']['byType'] ?? [],
                ],
                'recordsGovernance' => $snapshot['recordsGovernance'] ?? [
                    'pendingCopyRequests' => 0,
                    'overdueCopyRequests' => 0,
                    'disclosures' => 0,
                    'archiveEligible' => 0,
                ],
                'reviewQueueCount' => (int) ($snapshot['reviewQueue']['count'] ?? 0),
                'latestActivityAt' => (string) ($snapshot['latestActivityAt'] ?? ''),
                'diagnostics' => isset($snapshot['diagnostics']) && is_array($snapshot['diagnostics'])
                    ? [
                        'status' => (string) ($snapshot['diagnostics']['status'] ?? 'unknown'),
                        'healthy' => (bool) ($snapshot['diagnostics']['healthy'] ?? false),
                        'summary' => isset($snapshot['diagnostics']['summary']) && is_array($snapshot['diagnostics']['summary'])
                            ? $snapshot['diagnostics']['summary']
                            : [],
                    ]
                    : [],
            ],
            'reviewQueue' => $snapshot['reviewQueue']['items'] ?? [],
            'events' => $snapshot['events']['items'] ?? [],
            'diagnostics' => isset($snapshot['diagnostics']) && is_array($snapshot['diagnostics'])
                ? $snapshot['diagnostics']
                : [],
        ];
    }

    private static function buildReviewQueueRow(
        array $session,
        array $draft,
        array $pendingAi,
        array $eventStats,
        array $legalReadiness,
        array $copyRequests,
        array $disclosureLog,
        array $archiveReadiness
    ): array {
        $patient = isset($session['patient']) && is_array($session['patient']) ? $session['patient'] : [];
        $intake = isset($draft['intake']) && is_array($draft['intake']) ? $draft['intake'] : [];
        $lastEnvelope = isset($draft['lastAiEnvelope']) && is_array($draft['lastAiEnvelope']) ? $draft['lastAiEnvelope'] : [];

        return [
            'sessionId' => (string) ($session['sessionId'] ?? ''),
            'caseId' => (string) ($session['caseId'] ?? ''),
            'appointmentId' => $session['appointmentId'] ?? null,
            'surface' => (string) ($session['surface'] ?? ''),
            'sessionStatus' => (string) ($session['status'] ?? ''),
            'reviewStatus' => (string) ($draft['reviewStatus'] ?? ''),
            'requiresHumanReview' => (bool) ($draft['requiresHumanReview'] ?? true),
            'confidence' => (float) ($draft['confidence'] ?? 0),
            'reviewReasons' => array_values(is_array($draft['reviewReasons'] ?? null) ? $draft['reviewReasons'] : []),
            'missingFields' => array_values(is_array($intake['preguntasFaltantes'] ?? null) ? $intake['preguntasFaltantes'] : []),
            'redFlags' => array_values(is_array($lastEnvelope['redFlags'] ?? null) ? $lastEnvelope['redFlags'] : []),
            'pendingAiStatus' => (string) ($pendingAi['status'] ?? ''),
            'pendingAiJobId' => (string) ($pendingAi['jobId'] ?? ''),
            'patientName' => (string) ($patient['name'] ?? ''),
            'patientEmail' => (string) ($patient['email'] ?? ''),
            'patientPhone' => (string) ($patient['phone'] ?? ''),
            'attachmentCount' => count(is_array($intake['adjuntos'] ?? null) ? $intake['adjuntos'] : []),
            'openEventCount' => (int) ($eventStats['openEventCount'] ?? 0),
            'highestOpenSeverity' => (string) ($eventStats['highestOpenSeverity'] ?? ''),
            'latestOpenEventTitle' => (string) ($eventStats['latestOpenEventTitle'] ?? ''),
            'legalReadinessStatus' => (string) ($legalReadiness['status'] ?? 'blocked'),
            'legalReadinessLabel' => (string) ($legalReadiness['label'] ?? 'Bloqueada'),
            'legalReadinessSummary' => (string) ($legalReadiness['summary'] ?? ''),
            'hcu001Status' => (string) ($legalReadiness['hcu001Status']['status'] ?? 'missing'),
            'hcu001Label' => (string) ($legalReadiness['hcu001Status']['label'] ?? 'HCU-001 faltante'),
            'hcu001Summary' => (string) ($legalReadiness['hcu001Status']['summary'] ?? ''),
            'hcu005Status' => (string) ($legalReadiness['hcu005Status']['status'] ?? 'missing'),
            'hcu005Label' => (string) ($legalReadiness['hcu005Status']['label'] ?? 'HCU-005 pendiente'),
            'hcu005Summary' => (string) ($legalReadiness['hcu005Status']['summary'] ?? ''),
            'hcu007Status' => (string) ($legalReadiness['hcu007Status']['status'] ?? 'not_applicable'),
            'hcu007Label' => (string) ($legalReadiness['hcu007Status']['label'] ?? 'HCU-007 no aplica'),
            'hcu007Summary' => (string) ($legalReadiness['hcu007Status']['summary'] ?? ''),
            'hcu010AStatus' => (string) ($legalReadiness['hcu010AStatus']['status'] ?? 'not_applicable'),
            'hcu010ALabel' => (string) ($legalReadiness['hcu010AStatus']['label'] ?? 'HCU-010A no aplica'),
            'hcu010ASummary' => (string) ($legalReadiness['hcu010AStatus']['summary'] ?? ''),
            'hcu012AStatus' => (string) ($legalReadiness['hcu012AStatus']['status'] ?? 'not_applicable'),
            'hcu012ALabel' => (string) ($legalReadiness['hcu012AStatus']['label'] ?? 'HCU-012A no aplica'),
            'hcu012ASummary' => (string) ($legalReadiness['hcu012AStatus']['summary'] ?? ''),
            'hcu024Status' => (string) ($legalReadiness['hcu024Status']['status'] ?? 'not_applicable'),
            'hcu024Label' => (string) ($legalReadiness['hcu024Status']['label'] ?? 'HCU-024 no aplica'),
            'hcu024Summary' => (string) ($legalReadiness['hcu024Status']['summary'] ?? ''),
            'approvalBlockedReasons' => isset($legalReadiness['blockingReasons']) && is_array($legalReadiness['blockingReasons'])
                ? array_values($legalReadiness['blockingReasons'])
                : [],
            'pendingCopyRequests' => self::countPendingCopyRequests($copyRequests),
            'overdueCopyRequests' => self::countOverdueCopyRequests($copyRequests),
            'disclosureCount' => count($disclosureLog),
            'archiveEligibleForPassive' => (bool) ($archiveReadiness['eligibleForPassive'] ?? false),
            'summary' => (string) (($draft['clinicianDraft']['resumen'] ?? '') ?: ($intake['resumenClinico'] ?? '')),
            'createdAt' => (string) ($draft['createdAt'] ?? $session['createdAt'] ?? ''),
            'updatedAt' => (string) ($draft['updatedAt'] ?? $session['updatedAt'] ?? ''),
        ];
    }

    private static function buildArchiveReadiness(array $session, array $draft): array
    {
        $recordMeta = ClinicalHistoryRepository::normalizeRecordMeta(
            isset($draft['recordMeta']) && is_array($draft['recordMeta']) ? $draft['recordMeta'] : [],
            $session,
            $draft
        );
        $archiveState = ClinicalHistoryRepository::trimString($recordMeta['archiveState'] ?? 'active');
        if ($archiveState === '') {
            $archiveState = 'active';
        }

        $lastAttentionAt = ClinicalHistoryRepository::trimString($recordMeta['lastAttentionAt'] ?? '');
        $eligibleForPassive = false;
        $eligibleAt = '';

        if ($lastAttentionAt !== '') {
            try {
                $lastAttention = new \DateTimeImmutable($lastAttentionAt);
                $eligibleAt = $lastAttention
                    ->add(new \DateInterval('P' . max(1, (int) ($recordMeta['passiveAfterYears'] ?? 5)) . 'Y'))
                    ->format('c');
                $eligibleForPassive = new \DateTimeImmutable($eligibleAt) <= new \DateTimeImmutable(date('c'));
            } catch (\Throwable $e) {
                $eligibleAt = '';
                $eligibleForPassive = false;
            }
        }

        return [
            'archiveState' => $archiveState,
            'eligibleForPassive' => $eligibleForPassive,
            'eligibleAt' => $eligibleAt,
        ];
    }

    private static function countPendingCopyRequests(array $copyRequests): int
    {
        return count(array_filter($copyRequests, static function (array $request): bool {
            $status = ClinicalHistoryRepository::trimString($request['status'] ?? '');
            return $status !== 'delivered'
                && ClinicalHistoryRepository::trimString($request['deliveredAt'] ?? '') === '';
        }));
    }

    private static function countOverdueCopyRequests(array $copyRequests): int
    {
        return count(array_filter($copyRequests, static function (array $request): bool {
            $status = ClinicalHistoryRepository::trimString($request['status'] ?? '');
            $dueAt = ClinicalHistoryRepository::trimString($request['dueAt'] ?? '');
            if ($status === 'delivered' || $dueAt === '') {
                return false;
            }

            try {
                return new \DateTimeImmutable($dueAt) <= new \DateTimeImmutable(date('c'));
            } catch (\Throwable $e) {
                return false;
            }
        }));
    }

    private static function buildEventRow(array $event, array $draft): array
    {
        $patient = isset($event['patient']) && is_array($event['patient']) ? $event['patient'] : [];
        return [
            'eventId' => (string) ($event['eventId'] ?? ''),
            'sessionId' => (string) ($event['sessionId'] ?? ''),
            'caseId' => (string) ($event['caseId'] ?? ''),
            'appointmentId' => $event['appointmentId'] ?? null,
            'type' => (string) ($event['type'] ?? ''),
            'severity' => (string) ($event['severity'] ?? ''),
            'status' => (string) ($event['status'] ?? ''),
            'title' => (string) ($event['title'] ?? ''),
            'message' => (string) ($event['message'] ?? ''),
            'requiresAction' => (bool) ($event['requiresAction'] ?? false),
            'jobId' => (string) ($event['jobId'] ?? ''),
            'patientName' => (string) ($patient['name'] ?? ''),
            'patientEmail' => (string) ($patient['email'] ?? ''),
            'patientPhone' => (string) ($patient['phone'] ?? ''),
            'reviewStatus' => (string) ($draft['reviewStatus'] ?? ''),
            'requiresHumanReview' => (bool) ($draft['requiresHumanReview'] ?? true),
            'confidence' => (float) ($draft['confidence'] ?? 0),
            'reviewReasons' => array_values(is_array($draft['reviewReasons'] ?? null) ? $draft['reviewReasons'] : []),
            'createdAt' => (string) ($event['createdAt'] ?? ''),
            'occurredAt' => (string) ($event['occurredAt'] ?? ''),
            'acknowledgedAt' => (string) ($event['acknowledgedAt'] ?? ''),
            'resolvedAt' => (string) ($event['resolvedAt'] ?? ''),
        ];
    }

    private static function needsReviewQueue(array $session, array $draft, array $pendingAi): bool
    {
        if ($pendingAi !== []) {
            return true;
        }

        $reviewStatus = ClinicalHistoryRepository::trimString($draft['reviewStatus'] ?? '');
        if (in_array($reviewStatus, ['review_required', 'pending_review', 'ready_for_review'], true)) {
            return true;
        }

        return (bool) ($draft['requiresHumanReview'] ?? false)
            || ClinicalHistoryRepository::trimString($session['status'] ?? '') === 'review_required';
    }

    private static function buildDiagnostics(array $snapshot): array
    {
        $issues = [];
        $summary = [
            'critical' => 0,
            'warning' => 0,
            'info' => 0,
            'totalChecks' => 3,
            'totalIssues' => 0,
        ];

        $openCritical = (int) (($snapshot['events']['openBySeverity']['critical'] ?? 0));
        $openWarning = (int) (($snapshot['events']['openBySeverity']['warning'] ?? 0));
        $reviewQueueCount = (int) ($snapshot['reviewQueue']['count'] ?? 0);
        $pendingAiCount = (int) ($snapshot['drafts']['pendingAiCount'] ?? 0);
        $unreadEvents = (int) ($snapshot['events']['unreadCount'] ?? 0);

        if ($openCritical > 0) {
            $issues[] = [
                'severity' => 'critical',
                'code' => 'clinical_history_critical_events_open',
                'message' => 'Hay eventos clinicos criticos abiertos para revision del staff.',
            ];
            $summary['critical']++;
        }
        if ($reviewQueueCount > 0) {
            $issues[] = [
                'severity' => 'warning',
                'code' => 'clinical_history_review_queue_pending',
                'message' => 'Existen historias clinicas pendientes de revision humana.',
            ];
            $summary['warning']++;
        }
        if ($pendingAiCount > 0 || $unreadEvents > 0 || $openWarning > 0) {
            $issues[] = [
                'severity' => 'info',
                'code' => 'clinical_history_operational_attention',
                'message' => 'Hay actividad clinica reciente que requiere seguimiento operativo.',
            ];
            $summary['info']++;
        }

        $summary['totalIssues'] = count($issues);
        $status = 'healthy';
        if ($summary['critical'] > 0) {
            $status = 'critical';
        } elseif ($summary['warning'] > 0 || $summary['info'] > 0) {
            $status = 'degraded';
        }

        return [
            'status' => $status,
            'healthy' => $status === 'healthy',
            'summary' => $summary,
            'checks' => [
                [
                    'code' => 'clinical_history_events',
                    'status' => $openCritical > 0 ? 'fail' : 'pass',
                ],
                [
                    'code' => 'clinical_history_review_queue',
                    'status' => $reviewQueueCount > 0 ? 'warn' : 'pass',
                ],
                [
                    'code' => 'clinical_history_background_flow',
                    'status' => ($pendingAiCount > 0 || $unreadEvents > 0) ? 'warn' : 'pass',
                ],
            ],
            'issues' => $issues,
        ];
    }

    private static function initializeCounters(array $keys): array
    {
        $counters = [];
        foreach ($keys as $key) {
            $counters[$key] = 0;
        }

        return $counters;
    }

    private static function maxTimestamp(string $left, string $right): string
    {
        if ($left === '') {
            return $right;
        }
        if ($right === '') {
            return $left;
        }

        $leftTs = strtotime($left);
        $rightTs = strtotime($right);
        if ($leftTs === false) {
            return $right;
        }
        if ($rightTs === false) {
            return $left;
        }

        return $rightTs > $leftTs ? $right : $left;
    }

    private static function reviewPriority(array $row): int
    {
        $severity = (string) ($row['highestOpenSeverity'] ?? '');
        if ($severity === 'critical') {
            return -1;
        }
        if ($severity === 'warning') {
            return 0;
        }
        if ((string) ($row['pendingAiStatus'] ?? '') !== '') {
            return 1;
        }
        if ((int) ($row['openEventCount'] ?? 0) > 0) {
            return 2;
        }
        if ((bool) ($row['requiresHumanReview'] ?? false)) {
            return 3;
        }
        if ((string) ($row['reviewStatus'] ?? '') === 'ready_for_review') {
            return 4;
        }

        return 5;
    }

    private static function buildOpenEventStatsBySession(array $events): array
    {
        $statsBySessionId = [];

        foreach ($events as $eventRecord) {
            $event = ClinicalHistoryRepository::defaultEvent($eventRecord);
            $sessionId = ClinicalHistoryRepository::trimString($event['sessionId'] ?? '');
            $status = ClinicalHistoryRepository::trimString($event['status'] ?? 'open');
            if ($sessionId === '' || $status !== 'open') {
                continue;
            }

            $severity = ClinicalHistoryRepository::trimString($event['severity'] ?? 'info');
            if ($severity === '') {
                $severity = 'info';
            }
            $occurredAt = (string) ($event['occurredAt'] ?? $event['createdAt'] ?? '');
            $title = (string) ($event['title'] ?? '');

            $stats = $statsBySessionId[$sessionId] ?? [
                'openEventCount' => 0,
                'highestOpenSeverity' => '',
                'latestOpenEventTitle' => '',
                'latestOpenOccurredAt' => '',
            ];

            $stats['openEventCount'] = (int) ($stats['openEventCount'] ?? 0) + 1;
            $stats['highestOpenSeverity'] = self::preferHigherSeverity(
                (string) ($stats['highestOpenSeverity'] ?? ''),
                $severity
            );

            if (
                (string) ($stats['latestOpenOccurredAt'] ?? '') === ''
                || self::timestampGreater($occurredAt, (string) ($stats['latestOpenOccurredAt'] ?? ''))
            ) {
                $stats['latestOpenOccurredAt'] = $occurredAt;
                $stats['latestOpenEventTitle'] = $title;
            }

            $statsBySessionId[$sessionId] = $stats;
        }

        return $statsBySessionId;
    }

    private static function groupEventsBySession(array $events): array
    {
        $grouped = [];

        foreach ($events as $eventRecord) {
            $event = ClinicalHistoryRepository::defaultEvent($eventRecord);
            $sessionId = ClinicalHistoryRepository::trimString($event['sessionId'] ?? '');
            if ($sessionId === '') {
                continue;
            }

            $grouped[$sessionId] = $grouped[$sessionId] ?? [];
            $grouped[$sessionId][] = $event;
        }

        return $grouped;
    }

    private static function preferHigherSeverity(string $current, string $candidate): string
    {
        if (self::severityRank($candidate) > self::severityRank($current)) {
            return $candidate;
        }

        return $current;
    }

    private static function severityRank(string $severity): int
    {
        switch ($severity) {
            case 'critical':
                return 3;
            case 'warning':
                return 2;
            case 'info':
                return 1;
            default:
                return 0;
        }
    }

    private static function timestampGreater(string $left, string $right): bool
    {
        $leftTs = strtotime($left);
        $rightTs = strtotime($right);

        if ($leftTs === false) {
            return false;
        }

        if ($rightTs === false) {
            return true;
        }

        return $leftTs > $rightTs;
    }
}
