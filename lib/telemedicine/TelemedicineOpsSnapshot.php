<?php

declare(strict_types=1);

$policyFile = __DIR__ . '/TelemedicineEnforcementPolicy.php';
if (is_file($policyFile)) {
    require_once $policyFile;
}

$diagnosticsFile = __DIR__ . '/TelemedicineOpsDiagnostics.php';
if (is_file($diagnosticsFile)) {
    require_once $diagnosticsFile;
}

final class TelemedicineOpsSnapshot
{
    private const STATUS_KEYS = [
        'draft',
        'awaiting_payment',
        'ready_for_booking',
        'booked',
        'review_required',
        'unsuitable',
        'cancelled',
        'completed',
        'legacy_migrated',
    ];

    private const SUITABILITY_KEYS = [
        'fit',
        'review_required',
        'unsuitable',
    ];

    private const CHANNEL_KEYS = [
        'phone',
        'secure_video',
    ];

    private const REVIEW_DECISION_KEYS = [
        'none',
        'approve_remote',
        'request_more_info',
        'escalate_presential',
    ];

    private const REVIEW_STATE_KEYS = [
        'pending',
        'awaiting_patient',
        'resolved',
    ];

    private const PHOTO_AI_URGENCY_KEYS = [
        '1',
        '2',
        '3',
        '4',
        '5',
    ];

    private const PHOTO_AI_VALIDATION_KEYS = [
        'pending',
        'validated',
    ];

    private const MEDIA_KIND_KEYS = [
        'case_photo',
        'supporting_document',
        'legacy_unclassified',
        'payment_proof',
    ];

    private const STORAGE_MODE_KEYS = [
        'private_clinical',
        'public_payment',
        'staging_legacy',
    ];

    public static function build(array $store): array
    {
        $appointments = isset($store['appointments']) && is_array($store['appointments'])
            ? array_values($store['appointments'])
            : [];
        $intakes = isset($store['telemedicine_intakes']) && is_array($store['telemedicine_intakes'])
            ? array_values($store['telemedicine_intakes'])
            : [];
        $uploads = isset($store['clinical_uploads']) && is_array($store['clinical_uploads'])
            ? array_values($store['clinical_uploads'])
            : [];

        $appointmentIds = [];
        $appointmentsWithIntakeLink = 0;
        $telemedAppointmentsWithoutIntake = 0;
        foreach ($appointments as $appointment) {
            $appointmentId = (int) ($appointment['id'] ?? 0);
            if ($appointmentId > 0) {
                $appointmentIds[$appointmentId] = true;
            }
            $service = trim((string) ($appointment['service'] ?? ''));
            $isTelemedService = in_array($service, ['telefono', 'video'], true);
            $telemedicineIntakeId = (int) ($appointment['telemedicineIntakeId'] ?? 0);
            if ($telemedicineIntakeId > 0) {
                $appointmentsWithIntakeLink++;
            } elseif ($isTelemedService) {
                $telemedAppointmentsWithoutIntake++;
            }
        }

        $statusCounts = self::initializeCounters(self::STATUS_KEYS);
        $suitabilityCounts = self::initializeCounters(self::SUITABILITY_KEYS);
        $channelCounts = self::initializeCounters(self::CHANNEL_KEYS);
        $reviewDecisionCounts = self::initializeCounters(self::REVIEW_DECISION_KEYS);
        $reviewStateCounts = self::initializeCounters(self::REVIEW_STATE_KEYS);
        $photoAiUrgencyCounts = self::initializeCounters(self::PHOTO_AI_URGENCY_KEYS);
        $photoAiValidationCounts = self::initializeCounters(self::PHOTO_AI_VALIDATION_KEYS);
        $kindCounts = self::initializeCounters(self::MEDIA_KIND_KEYS);
        $storageCounts = self::initializeCounters(self::STORAGE_MODE_KEYS);

        $reviewQueue = [];
        $briefingQueue = [];
        $linkedAppointmentsCount = 0;
        $danglingAppointmentLinksCount = 0;
        $unlinkedIntakesCount = 0;
        $latestActivityAt = '';
        $photoAiHighUrgencyCount = 0;
        $photoAiPendingValidationCount = 0;

        foreach ($intakes as $intake) {
            $status = trim((string) ($intake['status'] ?? 'draft'));
            if ($status === '') {
                $status = 'draft';
            }
            $statusCounts[$status] = ($statusCounts[$status] ?? 0) + 1;

            $suitability = trim((string) ($intake['suitability'] ?? 'review_required'));
            if ($suitability === '') {
                $suitability = 'review_required';
            }
            $suitabilityCounts[$suitability] = ($suitabilityCounts[$suitability] ?? 0) + 1;

            $channel = trim((string) ($intake['channel'] ?? ''));
            if ($channel !== '') {
                $channelCounts[$channel] = ($channelCounts[$channel] ?? 0) + 1;
            }

            $reviewDecision = trim((string) ($intake['reviewDecision'] ?? ''));
            if ($reviewDecision === '') {
                $reviewDecision = 'none';
            }
            $reviewDecisionCounts[$reviewDecision] = ($reviewDecisionCounts[$reviewDecision] ?? 0) + 1;

            $reviewState = trim((string) ($intake['reviewStatus'] ?? ''));
            if ($reviewState === '') {
                if ($reviewDecision === 'request_more_info') {
                    $reviewState = 'awaiting_patient';
                } elseif ($reviewDecision !== 'none') {
                    $reviewState = 'resolved';
                } else {
                    $reviewState = 'pending';
                }
            }
            $reviewStateCounts[$reviewState] = ($reviewStateCounts[$reviewState] ?? 0) + 1;

            $photoAiTriage = isset($intake['photoAiTriage']) && is_array($intake['photoAiTriage'])
                ? $intake['photoAiTriage']
                : [];
            $photoAiUrgency = (int) ($photoAiTriage['urgencyLevel'] ?? 0);
            if ($photoAiUrgency >= 1 && $photoAiUrgency <= 5) {
                $photoAiUrgencyCounts[(string) $photoAiUrgency] = ($photoAiUrgencyCounts[(string) $photoAiUrgency] ?? 0) + 1;
                if ($photoAiUrgency >= 4) {
                    $photoAiHighUrgencyCount++;
                }
            }
            $photoAiValidationStatus = trim((string) ($photoAiTriage['doctorValidationStatus'] ?? 'pending'));
            if ($photoAiValidationStatus === '') {
                $photoAiValidationStatus = 'pending';
            }
            if (isset($photoAiValidationCounts[$photoAiValidationStatus])) {
                $photoAiValidationCounts[$photoAiValidationStatus] += 1;
            }
            if ($photoAiValidationStatus !== 'validated') {
                $photoAiPendingValidationCount++;
            }

            $linkedAppointmentId = (int) ($intake['linkedAppointmentId'] ?? 0);
            if ($linkedAppointmentId > 0) {
                if (isset($appointmentIds[$linkedAppointmentId])) {
                    $linkedAppointmentsCount++;
                } else {
                    $danglingAppointmentLinksCount++;
                }
            } else {
                $unlinkedIntakesCount++;
            }

            $updatedAt = (string) ($intake['updatedAt'] ?? $intake['createdAt'] ?? '');
            $latestActivityAt = self::maxTimestamp($latestActivityAt, $updatedAt);

            $needsReview = self::intakeNeedsReviewQueue($intake, $suitability, $status, $reviewState);
            if ($needsReview) {
                $reviewQueue[] = self::buildReviewQueueRow($intake);
            } elseif (self::intakeNeedsBriefingQueue($intake, $status)) {
                $briefingQueue[] = self::buildBriefingQueueRow($intake);
            }
        }

        $orphanedClinicalUploadsCount = 0;
        $casePhotosWithoutPrivatePathCount = 0;
        foreach ($uploads as $upload) {
            $kind = trim((string) ($upload['kind'] ?? 'legacy_unclassified'));
            if ($kind === '') {
                $kind = 'legacy_unclassified';
            }
            $kindCounts[$kind] = ($kindCounts[$kind] ?? 0) + 1;

            $storageMode = trim((string) ($upload['storageMode'] ?? 'staging_legacy'));
            if ($storageMode === '') {
                $storageMode = 'staging_legacy';
            }
            $storageCounts[$storageMode] = ($storageCounts[$storageMode] ?? 0) + 1;

            $updatedAt = (string) ($upload['updatedAt'] ?? $upload['createdAt'] ?? '');
            $latestActivityAt = self::maxTimestamp($latestActivityAt, $updatedAt);

            $intakeId = (int) ($upload['intakeId'] ?? 0);
            $appointmentId = (int) ($upload['appointmentId'] ?? 0);
            if ($intakeId <= 0 && $appointmentId <= 0) {
                $orphanedClinicalUploadsCount++;
            }
            if ($kind === 'case_photo' && trim((string) ($upload['privatePath'] ?? '')) === '') {
                $casePhotosWithoutPrivatePathCount++;
            }
        }

        usort($reviewQueue, static function (array $left, array $right): int {
            $priorityLeft = self::reviewPriority($left['suitability'] ?? '');
            $priorityRight = self::reviewPriority($right['suitability'] ?? '');
            if ($priorityLeft !== $priorityRight) {
                return $priorityLeft <=> $priorityRight;
            }

            return strcmp((string) ($left['updatedAt'] ?? ''), (string) ($right['updatedAt'] ?? ''));
        });

        usort($briefingQueue, static function (array $left, array $right): int {
            return strcmp((string) ($right['submittedAt'] ?? ''), (string) ($left['submittedAt'] ?? ''));
        });

        $snapshot = [
            'configured' => true,
            'intakes' => [
                'total' => count($intakes),
                'byStatus' => $statusCounts,
                'bySuitability' => $suitabilityCounts,
                'byChannel' => $channelCounts,
                'byReviewDecision' => $reviewDecisionCounts,
                'byReviewState' => $reviewStateCounts,
                'byPhotoAiUrgency' => $photoAiUrgencyCounts,
                'byPhotoAiValidation' => $photoAiValidationCounts,
                'photoAiPendingValidationCount' => $photoAiPendingValidationCount,
                'photoAiHighUrgencyCount' => $photoAiHighUrgencyCount,
            ],
            'media' => [
                'total' => count($uploads),
                'byKind' => $kindCounts,
                'byStorageMode' => $storageCounts,
            ],
            'integrity' => [
                'linkedAppointmentsCount' => $linkedAppointmentsCount,
                'danglingAppointmentLinksCount' => $danglingAppointmentLinksCount,
                'unlinkedIntakesCount' => $unlinkedIntakesCount,
                'appointmentsWithIntakeLinkCount' => $appointmentsWithIntakeLink,
                'telemedAppointmentsWithoutIntakeCount' => $telemedAppointmentsWithoutIntake,
                'orphanedClinicalUploadsCount' => $orphanedClinicalUploadsCount,
                'casePhotosWithoutPrivatePathCount' => $casePhotosWithoutPrivatePathCount,
                'stagedLegacyUploadsCount' => (int) ($storageCounts['staging_legacy'] ?? 0),
            ],
            'reviewQueue' => [
                'count' => count($reviewQueue),
                'items' => array_values($reviewQueue),
            ],
            'briefingQueue' => [
                'count' => count($briefingQueue),
                'items' => array_values($briefingQueue),
            ],
            'latestActivityAt' => $latestActivityAt,
        ];

        $snapshot['diagnostics'] = class_exists('TelemedicineOpsDiagnostics')
            ? TelemedicineOpsDiagnostics::buildFromSnapshot($snapshot)
            : [
                'status' => 'unknown',
                'healthy' => false,
                'summary' => [
                    'critical' => 0,
                    'warning' => 0,
                    'info' => 0,
                    'totalChecks' => 0,
                    'totalIssues' => 0,
                ],
                'checks' => [],
                'issues' => [],
            ];

        return $snapshot;
    }

    public static function forHealth(array $snapshot): array
    {
        $policy = class_exists('TelemedicineEnforcementPolicy')
            ? TelemedicineEnforcementPolicy::snapshot()
            : [
                'shadowModeEnabled' => true,
                'enforceUnsuitable' => false,
                'enforceReviewRequired' => false,
                'allowDecisionOverride' => true,
            ];

        $diagnostics = isset($snapshot['diagnostics']) && is_array($snapshot['diagnostics'])
            ? $snapshot['diagnostics']
            : [
                'status' => 'unknown',
                'healthy' => false,
                'summary' => [
                    'critical' => 0,
                    'warning' => 0,
                    'info' => 0,
                    'totalChecks' => 0,
                    'totalIssues' => 0,
                ],
            ];

        return [
            'configured' => (bool) ($snapshot['configured'] ?? false),
            'intakes' => $snapshot['intakes'] ?? [],
            'media' => $snapshot['media'] ?? [],
            'integrity' => $snapshot['integrity'] ?? [],
            'reviewQueueCount' => (int) ($snapshot['reviewQueue']['count'] ?? 0),
            'briefingQueueCount' => (int) ($snapshot['briefingQueue']['count'] ?? 0),
            'latestActivityAt' => (string) ($snapshot['latestActivityAt'] ?? ''),
            'policy' => $policy,
            'diagnostics' => [
                'status' => (string) ($diagnostics['status'] ?? 'unknown'),
                'healthy' => (bool) ($diagnostics['healthy'] ?? false),
                'summary' => isset($diagnostics['summary']) && is_array($diagnostics['summary'])
                    ? $diagnostics['summary']
                    : [
                        'critical' => 0,
                        'warning' => 0,
                        'info' => 0,
                        'totalChecks' => 0,
                        'totalIssues' => 0,
                    ],
            ],
        ];
    }

    public static function forAdmin(array $snapshot): array
    {
        return [
            'summary' => self::forHealth($snapshot),
            'reviewQueue' => $snapshot['reviewQueue']['items'] ?? [],
            'briefingQueue' => $snapshot['briefingQueue']['items'] ?? [],
            'diagnostics' => isset($snapshot['diagnostics']) && is_array($snapshot['diagnostics'])
                ? $snapshot['diagnostics']
                : [],
        ];
    }

    public static function renderPrometheusMetrics(array $snapshot): string
    {
        $lines = [];
        $intakes = is_array($snapshot['intakes'] ?? null) ? $snapshot['intakes'] : [];
        $media = is_array($snapshot['media'] ?? null) ? $snapshot['media'] : [];
        $integrity = is_array($snapshot['integrity'] ?? null) ? $snapshot['integrity'] : [];
        $policy = class_exists('TelemedicineEnforcementPolicy')
            ? TelemedicineEnforcementPolicy::snapshot()
            : [
                'shadowModeEnabled' => true,
                'enforceUnsuitable' => false,
                'enforceReviewRequired' => false,
                'allowDecisionOverride' => true,
            ];

        $lines[] = '# TYPE auroraderm_telemedicine_intakes_total gauge';
        $lines[] = 'auroraderm_telemedicine_intakes_total ' . (int) ($intakes['total'] ?? 0);

        foreach ((array) ($intakes['byStatus'] ?? []) as $status => $count) {
            $lines[] = '# TYPE auroraderm_telemedicine_intakes_by_status_total gauge';
            $lines[] = 'auroraderm_telemedicine_intakes_by_status_total{status="' . self::escapeLabel((string) $status) . '"} ' . (int) $count;
        }
        foreach ((array) ($intakes['bySuitability'] ?? []) as $suitability => $count) {
            $lines[] = '# TYPE auroraderm_telemedicine_intakes_by_suitability_total gauge';
            $lines[] = 'auroraderm_telemedicine_intakes_by_suitability_total{suitability="' . self::escapeLabel((string) $suitability) . '"} ' . (int) $count;
        }
        foreach ((array) ($intakes['byChannel'] ?? []) as $channel => $count) {
            $lines[] = '# TYPE auroraderm_telemedicine_intakes_by_channel_total gauge';
            $lines[] = 'auroraderm_telemedicine_intakes_by_channel_total{channel="' . self::escapeLabel((string) $channel) . '"} ' . (int) $count;
        }
        foreach ((array) ($intakes['byReviewDecision'] ?? []) as $decision => $count) {
            $lines[] = '# TYPE auroraderm_telemedicine_review_decisions_total gauge';
            $lines[] = 'auroraderm_telemedicine_review_decisions_total{decision="' . self::escapeLabel((string) $decision) . '"} ' . (int) $count;
        }
        foreach ((array) ($intakes['byReviewState'] ?? []) as $reviewState => $count) {
            $lines[] = '# TYPE auroraderm_telemedicine_review_state_total gauge';
            $lines[] = 'auroraderm_telemedicine_review_state_total{state="' . self::escapeLabel((string) $reviewState) . '"} ' . (int) $count;
        }
        foreach ((array) ($intakes['byPhotoAiUrgency'] ?? []) as $level => $count) {
            $lines[] = '# TYPE auroraderm_telemedicine_photo_ai_urgency_total gauge';
            $lines[] = 'auroraderm_telemedicine_photo_ai_urgency_total{level="' . self::escapeLabel((string) $level) . '"} ' . (int) $count;
        }
        foreach ((array) ($intakes['byPhotoAiValidation'] ?? []) as $validationStatus => $count) {
            $lines[] = '# TYPE auroraderm_telemedicine_photo_ai_validation_total gauge';
            $lines[] = 'auroraderm_telemedicine_photo_ai_validation_total{status="' . self::escapeLabel((string) $validationStatus) . '"} ' . (int) $count;
        }
        foreach ((array) ($media['byKind'] ?? []) as $kind => $count) {
            $lines[] = '# TYPE auroraderm_telemedicine_media_by_kind_total gauge';
            $lines[] = 'auroraderm_telemedicine_media_by_kind_total{kind="' . self::escapeLabel((string) $kind) . '"} ' . (int) $count;
        }
        foreach ((array) ($media['byStorageMode'] ?? []) as $storageMode => $count) {
            $lines[] = '# TYPE auroraderm_telemedicine_media_by_storage_total gauge';
            $lines[] = 'auroraderm_telemedicine_media_by_storage_total{storage_mode="' . self::escapeLabel((string) $storageMode) . '"} ' . (int) $count;
        }

        $lines[] = '# TYPE auroraderm_telemedicine_review_queue_total gauge';
        $lines[] = 'auroraderm_telemedicine_review_queue_total ' . (int) ($snapshot['reviewQueue']['count'] ?? 0);
        $lines[] = '# TYPE auroraderm_telemedicine_briefing_queue_total gauge';
        $lines[] = 'auroraderm_telemedicine_briefing_queue_total ' . (int) ($snapshot['briefingQueue']['count'] ?? 0);
        $lines[] = '# TYPE auroraderm_telemedicine_unlinked_intakes_total gauge';
        $lines[] = 'auroraderm_telemedicine_unlinked_intakes_total ' . (int) ($integrity['unlinkedIntakesCount'] ?? 0);
        $lines[] = '# TYPE auroraderm_telemedicine_dangling_appointment_links_total gauge';
        $lines[] = 'auroraderm_telemedicine_dangling_appointment_links_total ' . (int) ($integrity['danglingAppointmentLinksCount'] ?? 0);
        $lines[] = '# TYPE auroraderm_telemedicine_orphaned_clinical_uploads_total gauge';
        $lines[] = 'auroraderm_telemedicine_orphaned_clinical_uploads_total ' . (int) ($integrity['orphanedClinicalUploadsCount'] ?? 0);
        $lines[] = '# TYPE auroraderm_telemedicine_case_photos_missing_private_path_total gauge';
        $lines[] = 'auroraderm_telemedicine_case_photos_missing_private_path_total ' . (int) ($integrity['casePhotosWithoutPrivatePathCount'] ?? 0);
        $lines[] = '# TYPE auroraderm_telemedicine_staged_legacy_uploads_total gauge';
        $lines[] = 'auroraderm_telemedicine_staged_legacy_uploads_total ' . (int) ($integrity['stagedLegacyUploadsCount'] ?? 0);
        $lines[] = '# TYPE auroraderm_telemedicine_photo_ai_high_urgency_total gauge';
        $lines[] = 'auroraderm_telemedicine_photo_ai_high_urgency_total ' . (int) ($intakes['photoAiHighUrgencyCount'] ?? 0);
        $lines[] = '# TYPE auroraderm_telemedicine_photo_ai_pending_validation_total gauge';
        $lines[] = 'auroraderm_telemedicine_photo_ai_pending_validation_total ' . (int) ($intakes['photoAiPendingValidationCount'] ?? 0);
        $lines[] = '# TYPE auroraderm_telemedicine_shadow_mode_enabled gauge';
        $lines[] = 'auroraderm_telemedicine_shadow_mode_enabled ' . ((bool) ($policy['shadowModeEnabled'] ?? true) ? 1 : 0);
        $lines[] = '# TYPE auroraderm_telemedicine_enforce_unsuitable_enabled gauge';
        $lines[] = 'auroraderm_telemedicine_enforce_unsuitable_enabled ' . ((bool) ($policy['enforceUnsuitable'] ?? false) ? 1 : 0);
        $lines[] = '# TYPE auroraderm_telemedicine_enforce_review_required_enabled gauge';
        $lines[] = 'auroraderm_telemedicine_enforce_review_required_enabled ' . ((bool) ($policy['enforceReviewRequired'] ?? false) ? 1 : 0);
        $lines[] = '# TYPE auroraderm_telemedicine_allow_decision_override_enabled gauge';
        $lines[] = 'auroraderm_telemedicine_allow_decision_override_enabled ' . ((bool) ($policy['allowDecisionOverride'] ?? true) ? 1 : 0);
        $diagnostics = isset($snapshot['diagnostics']) && is_array($snapshot['diagnostics'])
            ? $snapshot['diagnostics']
            : [];
        $diagnosticsSummary = isset($diagnostics['summary']) && is_array($diagnostics['summary'])
            ? $diagnostics['summary']
            : [];
        $diagnosticsStatus = (string) ($diagnostics['status'] ?? 'unknown');
        $statusLabels = ['healthy', 'degraded', 'critical', 'unknown'];
        foreach ($statusLabels as $statusLabel) {
            $lines[] = '# TYPE auroraderm_telemedicine_diagnostics_status gauge';
            $lines[] = 'auroraderm_telemedicine_diagnostics_status{status="' . self::escapeLabel($statusLabel) . '"} ' . ($diagnosticsStatus === $statusLabel ? 1 : 0);
        }
        foreach (['critical', 'warning', 'info'] as $severityLabel) {
            $lines[] = '# TYPE auroraderm_telemedicine_diagnostics_issues_total gauge';
            $lines[] = 'auroraderm_telemedicine_diagnostics_issues_total{severity="' . self::escapeLabel($severityLabel) . '"} ' . (int) ($diagnosticsSummary[$severityLabel] ?? 0);
        }
        $lines[] = '# TYPE auroraderm_telemedicine_diagnostics_healthy gauge';
        $lines[] = 'auroraderm_telemedicine_diagnostics_healthy ' . ((bool) ($diagnostics['healthy'] ?? false) ? 1 : 0);

        return app_prometheus_alias_output("\n" . implode("\n", $lines));
    }

    private static function buildReviewQueueRow(array $intake): array
    {
        $patient = isset($intake['patient']) && is_array($intake['patient'])
            ? $intake['patient']
            : [];
        $photoTriage = isset($intake['photoTriage']) && is_array($intake['photoTriage'])
            ? $intake['photoTriage']
            : [];
        $photoAiTriage = isset($intake['photoAiTriage']) && is_array($intake['photoAiTriage'])
            ? $intake['photoAiTriage']
            : [];
        $preConsultation = isset($intake['telemedicinePreConsultation']) && is_array($intake['telemedicinePreConsultation'])
            ? $intake['telemedicinePreConsultation']
            : [];

        return [
            'intakeId' => (int) ($intake['id'] ?? 0),
            'appointmentId' => (int) ($intake['linkedAppointmentId'] ?? 0),
            'channel' => (string) ($intake['channel'] ?? ''),
            'status' => (string) ($intake['status'] ?? ''),
            'suitability' => (string) ($intake['suitability'] ?? 'review_required'),
            'reasons' => array_values(is_array($intake['suitabilityReasons'] ?? null) ? $intake['suitabilityReasons'] : []),
            'escalationRecommendation' => (string) ($intake['escalationRecommendation'] ?? 'manual_review'),
            'requestedDate' => (string) ($intake['requestedDate'] ?? ''),
            'requestedTime' => (string) ($intake['requestedTime'] ?? ''),
            'requestedDoctor' => (string) ($intake['requestedDoctor'] ?? ''),
            'patientName' => (string) ($patient['name'] ?? ''),
            'patientEmail' => (string) ($patient['email'] ?? ''),
            'patientPhone' => (string) ($patient['phone'] ?? ''),
            'latestPatientConcern' => (string) ($intake['latestPatientConcern'] ?? ''),
            'clinicalMediaCount' => count(is_array($intake['clinicalMediaIds'] ?? null) ? $intake['clinicalMediaIds'] : []),
            'photoTriageStatus' => (string) ($photoTriage['status'] ?? 'missing'),
            'photoTriageRoles' => array_values(is_array($photoTriage['roles'] ?? null) ? $photoTriage['roles'] : []),
            'photoTriageMissingRoles' => array_values(is_array($photoTriage['missingRoles'] ?? null) ? $photoTriage['missingRoles'] : []),
            'photoAiTriageStatus' => (string) ($photoAiTriage['status'] ?? 'insufficient_data'),
            'photoAiUrgencyLevel' => (int) ($photoAiTriage['urgencyLevel'] ?? 0),
            'photoAiUrgencyLabel' => (string) ($photoAiTriage['urgencyLabel'] ?? ''),
            'photoAiSuggestedConsultType' => (string) ($photoAiTriage['suggestedConsultType'] ?? ''),
            'photoAiSuggestedConsultTypeLabel' => (string) ($photoAiTriage['suggestedConsultTypeLabel'] ?? ''),
            'photoAiSignals' => array_values(is_array($photoAiTriage['signals'] ?? null) ? $photoAiTriage['signals'] : []),
            'photoAiSummary' => (string) ($photoAiTriage['summary'] ?? ''),
            'photoAiDoctorValidationStatus' => (string) ($photoAiTriage['doctorValidationStatus'] ?? 'pending'),
            'reviewDecision' => (string) ($intake['reviewDecision'] ?? ''),
            'reviewStatus' => (string) ($intake['reviewStatus'] ?? 'pending'),
            'reviewNotes' => (string) ($intake['reviewNotes'] ?? ''),
            'reviewedBy' => (string) ($intake['reviewedBy'] ?? ''),
            'reviewedAt' => (string) ($intake['reviewedAt'] ?? ''),
            'preConsultation' => $preConsultation,
            'createdAt' => (string) ($intake['createdAt'] ?? ''),
            'updatedAt' => (string) ($intake['updatedAt'] ?? ''),
        ];
    }

    private static function buildBriefingQueueRow(array $intake): array
    {
        $patient = isset($intake['patient']) && is_array($intake['patient'])
            ? $intake['patient']
            : [];
        $preConsultation = isset($intake['telemedicinePreConsultation']) && is_array($intake['telemedicinePreConsultation'])
            ? $intake['telemedicinePreConsultation']
            : [];

        return [
            'intakeId' => (int) ($intake['id'] ?? 0),
            'appointmentId' => (int) ($intake['linkedAppointmentId'] ?? 0),
            'patientName' => (string) ($patient['name'] ?? ''),
            'patientPhone' => (string) ($patient['phone'] ?? ''),
            'requestedDoctor' => (string) ($intake['requestedDoctor'] ?? ''),
            'requestedDate' => (string) ($intake['requestedDate'] ?? ''),
            'requestedTime' => (string) ($intake['requestedTime'] ?? ''),
            'channel' => (string) ($intake['channel'] ?? ''),
            'status' => (string) ($intake['status'] ?? ''),
            'latestPatientConcern' => (string) ($intake['latestPatientConcern'] ?? ''),
            'preConsultation' => $preConsultation,
            'concern' => (string) ($preConsultation['concern'] ?? $intake['latestPatientConcern'] ?? ''),
            'photoCount' => (int) ($preConsultation['photoCount'] ?? 0),
            'hasNewLesion' => (bool) ($preConsultation['hasNewLesion'] ?? false),
            'submittedAt' => (string) ($preConsultation['updatedAt'] ?? $preConsultation['submittedAt'] ?? ''),
            'roomUrl' => (int) ($intake['linkedAppointmentId'] ?? 0) > 0
                ? '/api.php?resource=telemedicine-preconsultation&id=' . (int) $intake['linkedAppointmentId']
                : '',
        ];
    }

    private static function intakeNeedsReviewQueue(array $intake, string $suitability, string $status, string $reviewState): bool
    {
        if ($reviewState === 'resolved') {
            return false;
        }
        if ($reviewState === 'awaiting_patient') {
            return true;
        }

        return (bool) ($intake['reviewRequired'] ?? false)
            || $suitability === 'review_required'
            || $suitability === 'unsuitable'
            || $status === 'review_required'
            || $status === 'unsuitable';
    }

    private static function intakeNeedsBriefingQueue(array $intake, string $status): bool
    {
        $linkedAppointmentId = (int) ($intake['linkedAppointmentId'] ?? 0);
        $preConsultation = isset($intake['telemedicinePreConsultation']) && is_array($intake['telemedicinePreConsultation'])
            ? $intake['telemedicinePreConsultation']
            : [];

        return $linkedAppointmentId > 0
            && (string) ($preConsultation['status'] ?? '') === 'submitted'
            && !in_array($status, ['cancelled', 'unsuitable'], true);
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

    private static function reviewPriority(string $suitability): int
    {
        if ($suitability === 'unsuitable') {
            return 0;
        }
        if ($suitability === 'review_required') {
            return 1;
        }

        return 2;
    }

    private static function escapeLabel(string $value): string
    {
        return str_replace(['\\', '"', "\n"], ['\\\\', '\"', '\n'], $value);
    }
}
