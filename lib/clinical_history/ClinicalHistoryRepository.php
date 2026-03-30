<?php

declare(strict_types=1);

require_once __DIR__ . '/../common.php';

final class ClinicalHistoryRepository
{
    public static function nextId(array $records): int
    {
        $max = 0;
        foreach ($records as $record) {
            $id = (int) ($record['id'] ?? 0);
            if ($id > $max) {
                $max = $id;
            }
        }

        return $max + 1;
    }

    public static function newOpaqueId(string $prefix = 'chs'): string
    {
        try {
            $token = bin2hex(random_bytes(12));
        } catch (Throwable $e) {
            $token = substr(sha1((string) microtime(true) . (string) mt_rand()), 0, 24);
        }

        return strtolower(trim($prefix)) . '-' . $token;
    }

    public static function defaultSession(array $seed = []): array
    {
        $now = local_date('c');
        $sessionId = self::trimString($seed['sessionId'] ?? '') !== ''
            ? self::trimString($seed['sessionId'] ?? '')
            : self::newOpaqueId('chs');
        $caseId = self::trimString($seed['caseId'] ?? '') !== ''
            ? self::trimString($seed['caseId'] ?? '')
            : self::newOpaqueId('case');

        return [
            'id' => (int) ($seed['id'] ?? 0),
            'sessionId' => $sessionId,
            'caseId' => $caseId,
            'appointmentId' => self::nullablePositiveInt($seed['appointmentId'] ?? null),
            'surface' => self::trimString($seed['surface'] ?? 'web_chat') !== ''
                ? self::trimString($seed['surface'] ?? 'web_chat')
                : 'web_chat',
            'mode' => 'clinical_intake',
            'status' => self::trimString($seed['status'] ?? 'active') !== ''
                ? self::trimString($seed['status'] ?? 'active')
                : 'active',
            'patient' => self::normalizePatient(isset($seed['patient']) && is_array($seed['patient']) ? $seed['patient'] : []),
            'transcript' => self::normalizeTranscript(isset($seed['transcript']) && is_array($seed['transcript']) ? $seed['transcript'] : []),
            'questionHistory' => self::normalizeStringList($seed['questionHistory'] ?? []),
            'surfaces' => self::normalizeStringList($seed['surfaces'] ?? [$seed['surface'] ?? 'web_chat']),
            'lastTurn' => isset($seed['lastTurn']) && is_array($seed['lastTurn']) ? $seed['lastTurn'] : [],
            'pendingAi' => self::normalizePendingAi(isset($seed['pendingAi']) && is_array($seed['pendingAi']) ? $seed['pendingAi'] : []),
            'metadata' => isset($seed['metadata']) && is_array($seed['metadata']) ? $seed['metadata'] : [],
            'version' => max(1, (int) ($seed['version'] ?? 1)),
            'createdAt' => self::trimString($seed['createdAt'] ?? $now) !== ''
                ? self::trimString($seed['createdAt'] ?? $now)
                : $now,
            'updatedAt' => self::trimString($seed['updatedAt'] ?? $now) !== ''
                ? self::trimString($seed['updatedAt'] ?? $now)
                : $now,
            'lastMessageAt' => self::trimString($seed['lastMessageAt'] ?? ''),
        ];
    }

    public static function defaultDraft(array $session, array $seed = []): array
    {
        $now = local_date('c');
        $draftId = self::trimString($seed['draftId'] ?? '') !== ''
            ? self::trimString($seed['draftId'] ?? '')
            : self::newOpaqueId('chd');
        $sessionId = self::trimString($seed['sessionId'] ?? ($session['sessionId'] ?? ''));
        $caseId = self::trimString($seed['caseId'] ?? ($session['caseId'] ?? ''));
        $appointmentId = self::nullablePositiveInt($seed['appointmentId'] ?? ($session['appointmentId'] ?? null));
        $patientRecordId = self::trimString($seed['patientRecordId'] ?? '');
        $episodeId = self::trimString($seed['episodeId'] ?? '');
        $encounterId = self::trimString($seed['encounterId'] ?? '');
        $defaultAdmissionTransition = array_key_exists('admission001', $seed)
            ? 'new_required'
            : 'legacy_inferred';
        $normalizedIntake = self::normalizeIntake(isset($seed['intake']) && is_array($seed['intake']) ? $seed['intake'] : []);
        $admission001 = self::normalizeAdmission001(
            isset($seed['admission001']) && is_array($seed['admission001']) ? $seed['admission001'] : [],
            isset($session['patient']) && is_array($session['patient']) ? $session['patient'] : [],
            $normalizedIntake,
            [
                'draft' => $seed,
                'transitionMode' => $defaultAdmissionTransition,
            ]
        );

        return [
            'id' => (int) ($seed['id'] ?? 0),
            'draftId' => $draftId,
            'sessionId' => $sessionId,
            'caseId' => $caseId,
            'appointmentId' => $appointmentId,
            'patientRecordId' => $patientRecordId !== ''
                ? $patientRecordId
                : self::stableDerivedId('hcu', [$caseId, $sessionId, (string) ($appointmentId ?? '')]),
            'episodeId' => $episodeId !== ''
                ? $episodeId
                : self::stableDerivedId('ep', [$sessionId, $caseId, 'active_episode']),
            'encounterId' => $encounterId !== ''
                ? $encounterId
                : self::stableDerivedId('enc', [$sessionId, (string) ($appointmentId ?? ''), 'encounter']),
            'status' => self::trimString($seed['status'] ?? 'draft') !== ''
                ? self::trimString($seed['status'] ?? 'draft')
                : 'draft',
            'reviewStatus' => self::trimString($seed['reviewStatus'] ?? 'pending_review') !== ''
                ? self::trimString($seed['reviewStatus'] ?? 'pending_review')
                : 'pending_review',
            'requiresHumanReview' => array_key_exists('requiresHumanReview', $seed)
                ? (bool) $seed['requiresHumanReview']
                : true,
            'confidence' => self::normalizeConfidence($seed['confidence'] ?? 0),
            'reviewReasons' => self::normalizeStringList($seed['reviewReasons'] ?? []),
            'intake' => $normalizedIntake,
            'clinicianDraft' => self::normalizeClinicianDraft(isset($seed['clinicianDraft']) && is_array($seed['clinicianDraft']) ? $seed['clinicianDraft'] : []),
            'admission001' => $admission001,
            'recordMeta' => self::normalizeRecordMeta(
                isset($seed['recordMeta']) && is_array($seed['recordMeta']) ? $seed['recordMeta'] : [],
                $session,
                $seed
            ),
            'documents' => self::normalizeClinicalDocuments(isset($seed['documents']) && is_array($seed['documents']) ? $seed['documents'] : []),
            'interconsultations' => self::normalizeInterconsultations($seed['interconsultations'] ?? []),
            'activeInterconsultationId' => self::trimString($seed['activeInterconsultationId'] ?? ''),
            'labOrders' => self::normalizeLabOrders($seed['labOrders'] ?? []),
            'activeLabOrderId' => self::trimString($seed['activeLabOrderId'] ?? ''),
            'imagingOrders' => self::normalizeImagingOrders($seed['imagingOrders'] ?? []),
            'activeImagingOrderId' => self::trimString($seed['activeImagingOrderId'] ?? ''),
            'consentPackets' => self::normalizeConsentPackets($seed['consentPackets'] ?? []),
            'activeConsentPacketId' => self::trimString($seed['activeConsentPacketId'] ?? ''),
            'consent' => self::normalizeConsentRecord(isset($seed['consent']) && is_array($seed['consent']) ? $seed['consent'] : []),
            'approval' => self::normalizeApprovalRecord(isset($seed['approval']) && is_array($seed['approval']) ? $seed['approval'] : []),
            'disclosureLog' => self::normalizeDisclosureLog($seed['disclosureLog'] ?? []),
            'copyRequests' => self::normalizeCopyRequests($seed['copyRequests'] ?? []),
            'lastAiEnvelope' => isset($seed['lastAiEnvelope']) && is_array($seed['lastAiEnvelope']) ? $seed['lastAiEnvelope'] : [],
            'pendingAi' => self::normalizePendingAi(isset($seed['pendingAi']) && is_array($seed['pendingAi']) ? $seed['pendingAi'] : []),
            'version' => max(1, (int) ($seed['version'] ?? 1)),
            'createdAt' => self::trimString($seed['createdAt'] ?? $now) !== ''
                ? self::trimString($seed['createdAt'] ?? $now)
                : $now,
            'updatedAt' => self::trimString($seed['updatedAt'] ?? $now) !== ''
                ? self::trimString($seed['updatedAt'] ?? $now)
                : $now,
        ];
    }

    public static function defaultEvent(array $seed = []): array
    {
        $now = local_date('c');
        $eventId = self::trimString($seed['eventId'] ?? '') !== ''
            ? self::trimString($seed['eventId'] ?? '')
            : self::newOpaqueId('che');

        $status = self::trimString($seed['status'] ?? 'open');
        if ($status === '') {
            $status = 'open';
        }

        return [
            'id' => (int) ($seed['id'] ?? 0),
            'eventId' => $eventId,
            'sessionId' => self::trimString($seed['sessionId'] ?? ''),
            'caseId' => self::trimString($seed['caseId'] ?? ''),
            'appointmentId' => self::nullablePositiveInt($seed['appointmentId'] ?? null),
            'type' => self::trimString($seed['type'] ?? ''),
            'severity' => self::trimString($seed['severity'] ?? 'info') !== ''
                ? self::trimString($seed['severity'] ?? 'info')
                : 'info',
            'status' => $status,
            'title' => self::trimString($seed['title'] ?? ''),
            'message' => self::trimString($seed['message'] ?? ''),
            'requiresAction' => array_key_exists('requiresAction', $seed)
                ? (bool) $seed['requiresAction']
                : false,
            'jobId' => self::trimString($seed['jobId'] ?? ''),
            'dedupeKey' => self::trimString($seed['dedupeKey'] ?? ''),
            'patient' => self::normalizePatient(isset($seed['patient']) && is_array($seed['patient']) ? $seed['patient'] : []),
            'metadata' => isset($seed['metadata']) && is_array($seed['metadata']) ? $seed['metadata'] : [],
            'createdAt' => self::trimString($seed['createdAt'] ?? $now) !== ''
                ? self::trimString($seed['createdAt'] ?? $now)
                : $now,
            'updatedAt' => self::trimString($seed['updatedAt'] ?? $now) !== ''
                ? self::trimString($seed['updatedAt'] ?? $now)
                : $now,
            'acknowledgedAt' => self::trimString($seed['acknowledgedAt'] ?? ''),
            'resolvedAt' => self::trimString($seed['resolvedAt'] ?? ''),
            'occurredAt' => self::trimString($seed['occurredAt'] ?? ($seed['createdAt'] ?? $now)) !== ''
                ? self::trimString($seed['occurredAt'] ?? ($seed['createdAt'] ?? $now))
                : $now,
        ];
    }

    public static function findSessionBySessionId(array $store, string $sessionId): ?array
    {
        $needle = self::trimString($sessionId);
        if ($needle === '') {
            return null;
        }

        foreach (($store['clinical_history_sessions'] ?? []) as $session) {
            if (self::trimString($session['sessionId'] ?? '') === $needle) {
                return self::defaultSession($session);
            }
        }

        return null;
    }

    public static function findSessionByCaseId(array $store, string $caseId): ?array
    {
        $needle = self::trimString($caseId);
        if ($needle === '') {
            return null;
        }

        foreach (($store['clinical_history_sessions'] ?? []) as $session) {
            if (self::trimString($session['caseId'] ?? '') === $needle) {
                return self::defaultSession($session);
            }
        }

        return null;
    }

    public static function findDraftBySessionId(array $store, string $sessionId): ?array
    {
        $needle = self::trimString($sessionId);
        if ($needle === '') {
            return null;
        }

        foreach (($store['clinical_history_drafts'] ?? []) as $draft) {
            if (self::trimString($draft['sessionId'] ?? '') === $needle) {
                return self::defaultDraft(['sessionId' => $needle], $draft);
            }
        }

        return null;
    }

    public static function findEventsBySessionId(array $store, string $sessionId): array
    {
        $needle = self::trimString($sessionId);
        if ($needle === '') {
            return [];
        }

        $events = [];
        foreach (($store['clinical_history_events'] ?? []) as $event) {
            if (self::trimString($event['sessionId'] ?? '') !== $needle) {
                continue;
            }
            $events[] = self::defaultEvent($event);
        }

        usort($events, static function (array $left, array $right): int {
            return strcmp(
                self::trimString($right['occurredAt'] ?? $right['createdAt'] ?? ''),
                self::trimString($left['occurredAt'] ?? $left['createdAt'] ?? '')
            );
        });

        return $events;
    }

    public static function upsertSession(array $store, array $session): array
    {
        $store['clinical_history_sessions'] = isset($store['clinical_history_sessions']) && is_array($store['clinical_history_sessions'])
            ? $store['clinical_history_sessions']
            : [];

        $records = $store['clinical_history_sessions'];
        $normalized = self::defaultSession($session);
        $normalized['updatedAt'] = local_date('c');
        $normalized['version'] = max(1, (int) ($normalized['version'] ?? 1));

        $targetId = (int) ($normalized['id'] ?? 0);
        if ($targetId <= 0) {
            foreach ($records as $existing) {
                if (self::trimString($existing['sessionId'] ?? '') === $normalized['sessionId']) {
                    $targetId = (int) ($existing['id'] ?? 0);
                    break;
                }
            }
        }

        foreach ($records as $index => $existing) {
            if ((int) ($existing['id'] ?? 0) !== $targetId || $targetId <= 0) {
                continue;
            }
            $normalized['id'] = $targetId;
            $records[$index] = $normalized;
            $store['clinical_history_sessions'] = array_values($records);
            return ['store' => $store, 'session' => $normalized];
        }

        if ($targetId <= 0) {
            $normalized['id'] = self::nextId($records);
        }

        $records[] = $normalized;
        $store['clinical_history_sessions'] = array_values($records);

        return ['store' => $store, 'session' => $normalized];
    }

    public static function upsertDraft(array $store, array $draft): array
    {
        $store['clinical_history_drafts'] = isset($store['clinical_history_drafts']) && is_array($store['clinical_history_drafts'])
            ? $store['clinical_history_drafts']
            : [];

        $records = $store['clinical_history_drafts'];
        $normalized = self::defaultDraft(['sessionId' => $draft['sessionId'] ?? '', 'caseId' => $draft['caseId'] ?? ''], $draft);
        $normalized['updatedAt'] = local_date('c');
        $normalized['version'] = max(1, (int) ($normalized['version'] ?? 1));

        $targetId = (int) ($normalized['id'] ?? 0);
        if ($targetId <= 0) {
            foreach ($records as $existing) {
                if (self::trimString($existing['sessionId'] ?? '') === $normalized['sessionId']) {
                    $targetId = (int) ($existing['id'] ?? 0);
                    break;
                }
            }
        }

        foreach ($records as $index => $existing) {
            if ((int) ($existing['id'] ?? 0) !== $targetId || $targetId <= 0) {
                continue;
            }
            $normalized['id'] = $targetId;
            $records[$index] = $normalized;
            $store['clinical_history_drafts'] = array_values($records);
            return ['store' => $store, 'draft' => $normalized];
        }

        if ($targetId <= 0) {
            $normalized['id'] = self::nextId($records);
        }

        $records[] = $normalized;
        $store['clinical_history_drafts'] = array_values($records);

        return ['store' => $store, 'draft' => $normalized];
    }

    public static function upsertEvent(array $store, array $event): array
    {
        $store['clinical_history_events'] = isset($store['clinical_history_events']) && is_array($store['clinical_history_events'])
            ? $store['clinical_history_events']
            : [];

        $records = $store['clinical_history_events'];
        $normalized = self::defaultEvent($event);
        $normalized['updatedAt'] = local_date('c');

        $targetId = (int) ($normalized['id'] ?? 0);
        $dedupeKey = self::trimString($normalized['dedupeKey'] ?? '');
        $eventId = self::trimString($normalized['eventId'] ?? '');
        if ($targetId <= 0) {
            foreach ($records as $existing) {
                if ($dedupeKey !== '' && self::trimString($existing['dedupeKey'] ?? '') === $dedupeKey) {
                    $targetId = (int) ($existing['id'] ?? 0);
                    break;
                }
                if ($eventId !== '' && self::trimString($existing['eventId'] ?? '') === $eventId) {
                    $targetId = (int) ($existing['id'] ?? 0);
                    break;
                }
            }
        }

        foreach ($records as $index => $existing) {
            if ((int) ($existing['id'] ?? 0) !== $targetId || $targetId <= 0) {
                continue;
            }
            $normalized['id'] = $targetId;
            $records[$index] = $normalized;
            $store['clinical_history_events'] = array_values($records);
            return ['store' => $store, 'event' => $normalized];
        }

        if ($targetId <= 0) {
            $normalized['id'] = self::nextId($records);
        }

        $records[] = $normalized;
        $store['clinical_history_events'] = array_values($records);
        return ['store' => $store, 'event' => $normalized];
    }

    public static function findClinicalUploadById(array $store, int $uploadId): ?array
    {
        if ($uploadId <= 0) {
            return null;
        }

        foreach (($store['clinical_uploads'] ?? []) as $upload) {
            if ((int) ($upload['id'] ?? 0) === $uploadId) {
                return $upload;
            }
        }

        return null;
    }

    public static function upsertClinicalUpload(array $store, array $upload): array
    {
        $store['clinical_uploads'] = isset($store['clinical_uploads']) && is_array($store['clinical_uploads'])
            ? $store['clinical_uploads']
            : [];

        $records = $store['clinical_uploads'];
        $normalized = $upload;
        $normalized['updatedAt'] = local_date('c');
        if (self::trimString($normalized['createdAt'] ?? '') === '') {
            $normalized['createdAt'] = $normalized['updatedAt'];
        }

        $targetId = (int) ($normalized['id'] ?? 0);
        foreach ($records as $index => $existing) {
            if ((int) ($existing['id'] ?? 0) !== $targetId || $targetId <= 0) {
                continue;
            }
            $records[$index] = $normalized;
            $store['clinical_uploads'] = array_values($records);
            return ['store' => $store, 'upload' => $normalized];
        }

        if ($targetId <= 0) {
            $normalized['id'] = self::nextId($records);
        }

        $records[] = $normalized;
        $store['clinical_uploads'] = array_values($records);

        return ['store' => $store, 'upload' => $normalized];
    }

    public static function appendTranscriptMessage(array $session, array $message): array
    {
        $session = self::defaultSession($session);
        $transcript = $session['transcript'];
        $transcript[] = self::normalizeTranscriptMessage($message);
        $session['transcript'] = array_values($transcript);
        $session['lastMessageAt'] = $session['transcript'][count($session['transcript']) - 1]['createdAt'] ?? local_date('c');
        $session['updatedAt'] = local_date('c');
        $session['version'] = max(1, (int) ($session['version'] ?? 1)) + 1;
        return $session;
    }

    public static function patientSafeSession(array $session): array
    {
        $session = self::defaultSession($session);
        $safeTranscript = [];
        foreach ($session['transcript'] as $message) {
            $safeTranscript[] = [
                'id' => self::trimString($message['id'] ?? ''),
                'role' => self::trimString($message['role'] ?? ''),
                'actor' => self::trimString($message['actor'] ?? ''),
                'content' => self::trimString($message['content'] ?? ''),
                'createdAt' => self::trimString($message['createdAt'] ?? ''),
                'surface' => self::trimString($message['surface'] ?? ''),
            ];
        }

        return [
            'id' => (int) ($session['id'] ?? 0),
            'sessionId' => self::trimString($session['sessionId'] ?? ''),
            'caseId' => self::trimString($session['caseId'] ?? ''),
            'appointmentId' => self::nullablePositiveInt($session['appointmentId'] ?? null),
            'surface' => self::trimString($session['surface'] ?? ''),
            'status' => self::trimString($session['status'] ?? ''),
            'patient' => self::normalizePatient($session['patient'] ?? []),
            'transcript' => $safeTranscript,
            'version' => max(1, (int) ($session['version'] ?? 1)),
            'createdAt' => self::trimString($session['createdAt'] ?? ''),
            'updatedAt' => self::trimString($session['updatedAt'] ?? ''),
            'lastMessageAt' => self::trimString($session['lastMessageAt'] ?? ''),
        ];
    }

    public static function adminSession(array $session): array
    {
        return self::defaultSession($session);
    }

    public static function patientSafeDraft(array $draft): array
    {
        $draft = self::defaultDraft(['sessionId' => $draft['sessionId'] ?? '', 'caseId' => $draft['caseId'] ?? ''], $draft);
        $intake = $draft['intake'];

        return [
            'id' => (int) ($draft['id'] ?? 0),
            'draftId' => self::trimString($draft['draftId'] ?? ''),
            'sessionId' => self::trimString($draft['sessionId'] ?? ''),
            'caseId' => self::trimString($draft['caseId'] ?? ''),
            'appointmentId' => self::nullablePositiveInt($draft['appointmentId'] ?? null),
            'status' => self::trimString($draft['status'] ?? ''),
            'reviewStatus' => self::trimString($draft['reviewStatus'] ?? ''),
            'requiresHumanReview' => (bool) ($draft['requiresHumanReview'] ?? true),
            'confidence' => self::normalizeConfidence($draft['confidence'] ?? 0),
            'reviewReasons' => self::normalizeStringList($draft['reviewReasons'] ?? []),
            'intake' => [
                'motivoConsulta' => self::trimString($intake['motivoConsulta'] ?? ''),
                'enfermedadActual' => self::trimString($intake['enfermedadActual'] ?? ''),
                'antecedentes' => self::trimString($intake['antecedentes'] ?? ''),
                'alergias' => self::trimString($intake['alergias'] ?? ''),
                'medicacionActual' => self::trimString($intake['medicacionActual'] ?? ''),
                'adjuntos' => self::normalizeAttachmentList($intake['adjuntos'] ?? []),
                'preguntasFaltantes' => self::normalizeStringList($intake['preguntasFaltantes'] ?? []),
                'datosPaciente' => self::normalizePatientFacts($intake['datosPaciente'] ?? []),
            ],
            'createdAt' => self::trimString($draft['createdAt'] ?? ''),
            'updatedAt' => self::trimString($draft['updatedAt'] ?? ''),
        ];
    }

    public static function adminDraft(array $draft): array
    {
        return self::defaultDraft(['sessionId' => $draft['sessionId'] ?? '', 'caseId' => $draft['caseId'] ?? ''], $draft);
    }

    public static function normalizeRecordMeta(array $meta, array $session = [], array $draft = []): array
    {
        $lastAttentionAt = self::trimString(
            $meta['lastAttentionAt']
                ?? $draft['updatedAt']
                ?? $session['updatedAt']
                ?? $draft['createdAt']
                ?? $session['createdAt']
                ?? ''
        );
        $archiveState = self::trimString($meta['archiveState'] ?? 'active');
        if ($archiveState === '') {
            $archiveState = 'active';
        }

        return [
            'archiveState' => $archiveState,
            'lastAttentionAt' => $lastAttentionAt,
            'passiveAfterYears' => is_numeric($meta['passiveAfterYears'] ?? null)
                ? max(1, (int) $meta['passiveAfterYears'])
                : 5,
            'confidentialityLabel' => self::trimString($meta['confidentialityLabel'] ?? 'CONFIDENCIAL'),
            'identityProtectionMode' => self::trimString($meta['identityProtectionMode'] ?? 'standard'),
            'copyDeliverySlaHours' => is_numeric($meta['copyDeliverySlaHours'] ?? null)
                ? max(1, (int) $meta['copyDeliverySlaHours'])
                : 48,
            'formsCatalogStatus' => self::trimString($meta['formsCatalogStatus'] ?? 'official_partial_traceability'),
            'confirmedForms' => self::normalizeStringList($meta['confirmedForms'] ?? [
                'SNS-MSP/HCU-form.001/2008',
                'SNS-MSP/HCU-form.005/2008',
                'SNS-MSP/HCU-form.007/2008',
                'SNS-MSP/HCU-form.010A/2008',
                'SNS-MSP/HCU-form.012A/2008',
                'SNS-MSP/HCU-form.024',
            ]),
            'normativeScope' => self::trimString($meta['normativeScope'] ?? 'ecuador_private_consultorio_v1'),
        ];
    }

    public static function normalizeClinicalDocuments(array $documents): array
    {
        $finalNote = isset($documents['finalNote']) && is_array($documents['finalNote'])
            ? $documents['finalNote']
            : [];
        $prescription = isset($documents['prescription']) && is_array($documents['prescription'])
            ? $documents['prescription']
            : [];
        $certificate = isset($documents['certificate']) && is_array($documents['certificate'])
            ? $documents['certificate']
            : [];
        $interconsultForms = self::normalizeInterconsultFormSnapshots($documents['interconsultForms'] ?? []);
        $interconsultReports = self::normalizeInterconsultReportSnapshots($documents['interconsultReports'] ?? []);
        $labOrders = self::normalizeLabOrderSnapshots($documents['labOrders'] ?? []);
        $imagingOrders = self::normalizeImagingOrderSnapshots($documents['imagingOrders'] ?? []);
        $imagingReports = self::normalizeImagingReportSnapshots($documents['imagingReports'] ?? []);
        $consentForms = self::normalizeConsentFormSnapshots($documents['consentForms'] ?? []);
        $finalSections = isset($finalNote['sections']) && is_array($finalNote['sections'])
            ? $finalNote['sections']
            : [];
        $hcu001Section = self::normalizeAdmission001(
            isset($finalSections['hcu001']) && is_array($finalSections['hcu001'])
                ? $finalSections['hcu001']
                : []
        );
        $legacySection = self::normalizeHcu005Section([
            'evolutionNote' => self::trimString($finalNote['summary'] ?? ''),
            'diagnosticImpression' => '',
            'therapeuticPlan' => '',
            'careIndications' => self::trimString($prescription['directions'] ?? ''),
        ]);
        $hcu005Section = self::normalizeHcu005Section(
            isset($finalSections['hcu005']) && is_array($finalSections['hcu005'])
                ? $finalSections['hcu005']
                : [],
            $legacySection
        );
        $prescriptionItems = self::normalizePrescriptionItems($prescription['items'] ?? []);
        if ($prescriptionItems === []) {
            $prescriptionItems = self::normalizePrescriptionItems(
                $documents['prescriptionItems'] ?? $documents['hcu005']['prescriptionItems'] ?? []
            );
        }
        if (
            $prescriptionItems === []
            && (
                self::trimString($prescription['medication'] ?? '') !== ''
                || self::trimString($prescription['directions'] ?? '') !== ''
            )
        ) {
            $prescriptionItems = self::normalizePrescriptionItems([[
                'medication' => self::trimString($prescription['medication'] ?? ''),
                'presentation' => '',
                'dose' => '',
                'route' => '',
                'frequency' => '',
                'duration' => '',
                'quantity' => '',
                'instructions' => self::trimString($prescription['directions'] ?? ''),
            ]]);
        }

        $finalSummary = self::renderHcu005Summary($hcu005Section);
        $finalContent = self::renderHcu005Content($hcu005Section);
        $legacyMedication = self::renderPrescriptionMedicationMirror($prescriptionItems);
        $legacyDirections = self::renderPrescriptionDirectionsMirror($prescriptionItems);

        return [
            'finalNote' => [
                'status' => self::trimString($finalNote['status'] ?? 'draft') ?: 'draft',
                'summary' => $finalSummary,
                'content' => $finalContent,
                'version' => is_numeric($finalNote['version'] ?? null)
                    ? max(1, (int) $finalNote['version'])
                    : 1,
                'generatedAt' => self::trimString($finalNote['generatedAt'] ?? ''),
                'confidential' => array_key_exists('confidential', $finalNote)
                    ? (bool) $finalNote['confidential']
                    : true,
                'sections' => [
                    'hcu001' => $hcu001Section,
                    'hcu005' => $hcu005Section,
                ],
            ],
            'prescription' => [
                'status' => self::trimString($prescription['status'] ?? 'draft') ?: 'draft',
                'medication' => $legacyMedication,
                'directions' => $legacyDirections,
                'signedAt' => self::trimString($prescription['signedAt'] ?? ''),
                'confidential' => array_key_exists('confidential', $prescription)
                    ? (bool) $prescription['confidential']
                    : true,
                'items' => $prescriptionItems,
            ],
            'certificate' => [
                'status' => self::trimString($certificate['status'] ?? 'draft') ?: 'draft',
                'summary' => self::trimString($certificate['summary'] ?? ''),
                'restDays' => self::nullablePositiveInt($certificate['restDays'] ?? null),
                'signedAt' => self::trimString($certificate['signedAt'] ?? ''),
                'confidential' => array_key_exists('confidential', $certificate)
                    ? (bool) $certificate['confidential']
                    : true,
            ],
            'interconsultForms' => $interconsultForms,
            'interconsultReports' => $interconsultReports,
            'labOrders' => $labOrders,
            'imagingOrders' => $imagingOrders,
            'imagingReports' => $imagingReports,
            'consentForms' => $consentForms,
        ];
    }

    public static function normalizeLabOrderStudySelections($items): array
    {
        $source = is_array($items) ? $items : [];

        return [
            'hematology' => self::normalizeStringList($source['hematology'] ?? []),
            'urinalysis' => self::normalizeStringList($source['urinalysis'] ?? []),
            'coprological' => self::normalizeStringList($source['coprological'] ?? []),
            'bloodChemistry' => self::normalizeStringList($source['bloodChemistry'] ?? []),
            'serology' => self::normalizeStringList($source['serology'] ?? []),
            'bacteriology' => self::normalizeStringList($source['bacteriology'] ?? []),
            'others' => self::trimString($source['others'] ?? ''),
        ];
    }

    /**
     * @return array<int,string>
     */
    public static function flattenLabOrderStudySelections(array $studySelections): array
    {
        $normalized = self::normalizeLabOrderStudySelections($studySelections);
        $flat = [];
        foreach (['hematology', 'urinalysis', 'coprological', 'bloodChemistry', 'serology', 'bacteriology'] as $key) {
            foreach ($normalized[$key] as $item) {
                $label = self::trimString($item);
                if ($label !== '') {
                    $flat[] = $label;
                }
            }
        }
        if ($normalized['others'] !== '') {
            $flat[] = $normalized['others'];
        }

        return array_values(array_unique($flat));
    }

    public static function normalizeImagingStudySelections($items): array
    {
        $source = is_array($items) ? $items : [];

        return [
            'conventionalRadiography' => self::normalizeStringList($source['conventionalRadiography'] ?? []),
            'tomography' => self::normalizeStringList($source['tomography'] ?? []),
            'magneticResonance' => self::normalizeStringList($source['magneticResonance'] ?? []),
            'ultrasound' => self::normalizeStringList($source['ultrasound'] ?? []),
            'procedures' => self::normalizeStringList($source['procedures'] ?? []),
            'others' => self::normalizeStringList($source['others'] ?? []),
        ];
    }

    /**
     * @return array<int,string>
     */
    public static function flattenImagingStudySelections(array $studySelections): array
    {
        $normalized = self::normalizeImagingStudySelections($studySelections);
        $flat = [];
        foreach (['conventionalRadiography', 'tomography', 'magneticResonance', 'ultrasound', 'procedures', 'others'] as $key) {
            foreach ($normalized[$key] as $item) {
                $label = self::trimString($item);
                if ($label !== '') {
                    $flat[] = $label;
                }
            }
        }

        return array_values(array_unique($flat));
    }

    public static function normalizeLabOrders($items): array
    {
        if (!is_array($items)) {
            return [];
        }

        $normalized = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            $normalized[] = self::normalizeLabOrder($item);
        }

        usort($normalized, static function (array $left, array $right): int {
            $leftStamp = (string) (($left['updatedAt'] ?? '') ?: ($left['requestedAt'] ?? '') ?: ($left['createdAt'] ?? ''));
            $rightStamp = (string) (($right['updatedAt'] ?? '') ?: ($right['requestedAt'] ?? '') ?: ($right['createdAt'] ?? ''));
            return strcmp($rightStamp, $leftStamp);
        });

        return array_values($normalized);
    }

    public static function normalizeImagingOrders($items): array
    {
        if (!is_array($items)) {
            return [];
        }

        $normalized = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            $normalized[] = self::normalizeImagingOrder($item);
        }

        usort($normalized, static function (array $left, array $right): int {
            $leftStamp = (string) (($left['updatedAt'] ?? '') ?: ($left['requestedAt'] ?? '') ?: ($left['createdAt'] ?? ''));
            $rightStamp = (string) (($right['updatedAt'] ?? '') ?: ($right['requestedAt'] ?? '') ?: ($right['createdAt'] ?? ''));
            return strcmp($rightStamp, $leftStamp);
        });

        return array_values($normalized);
    }

    public static function normalizeLabOrder(array $labOrder, array $fallback = []): array
    {
        $source = array_replace_recursive([
            'priority' => 'routine',
            'status' => 'draft',
            'requiredForCurrentPlan' => false,
            'diagnoses' => [],
            'studySelections' => [],
            'history' => [],
        ], $fallback, $labOrder);
        $labOrderId = self::trimString($source['labOrderId'] ?? '');
        $now = local_date('c');

        $history = [];
        foreach (($source['history'] ?? []) as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $history[] = [
                'eventId' => self::trimString($entry['eventId'] ?? $entry['id'] ?? '') !== ''
                    ? self::trimString($entry['eventId'] ?? $entry['id'] ?? '')
                    : self::newOpaqueId('lab-order-history'),
                'type' => self::trimString($entry['type'] ?? ''),
                'status' => self::trimString($entry['status'] ?? ''),
                'actor' => self::trimString($entry['actor'] ?? ''),
                'actorRole' => self::trimString($entry['actorRole'] ?? ''),
                'at' => self::trimString($entry['at'] ?? $entry['createdAt'] ?? ''),
                'notes' => self::trimString($entry['notes'] ?? ''),
            ];
        }

        return [
            'labOrderId' => $labOrderId !== ''
                ? $labOrderId
                : self::newOpaqueId('lab-order'),
            'status' => self::trimString($source['status'] ?? 'draft') ?: 'draft',
            'requiredForCurrentPlan' => array_key_exists('requiredForCurrentPlan', $source)
                ? (bool) $source['requiredForCurrentPlan']
                : false,
            'priority' => self::trimString($source['priority'] ?? 'routine') ?: 'routine',
            'requestedAt' => self::trimString($source['requestedAt'] ?? ''),
            'sampleDate' => self::trimString($source['sampleDate'] ?? ''),
            'requestingEstablishment' => self::trimString($source['requestingEstablishment'] ?? ''),
            'requestingService' => self::trimString($source['requestingService'] ?? ''),
            'careSite' => self::trimString($source['careSite'] ?? ''),
            'bedLabel' => self::trimString($source['bedLabel'] ?? ''),
            'requestedBy' => self::trimString($source['requestedBy'] ?? ''),
            'patientName' => self::trimString($source['patientName'] ?? ''),
            'patientDocumentNumber' => self::trimString($source['patientDocumentNumber'] ?? ''),
            'patientRecordId' => self::trimString($source['patientRecordId'] ?? ''),
            'patientAgeYears' => self::nullablePositiveInt($source['patientAgeYears'] ?? null),
            'patientSexAtBirth' => self::trimString($source['patientSexAtBirth'] ?? ''),
            'diagnoses' => self::normalizeInterconsultationDiagnoses($source['diagnoses'] ?? []),
            'studySelections' => self::normalizeLabOrderStudySelections($source['studySelections'] ?? []),
            'bacteriologySampleSource' => self::trimString($source['bacteriologySampleSource'] ?? ''),
            'physicianPresentAtExam' => array_key_exists('physicianPresentAtExam', $source)
                ? (bool) $source['physicianPresentAtExam']
                : false,
            'notes' => self::trimString($source['notes'] ?? ''),
            'issuedAt' => self::trimString($source['issuedAt'] ?? ''),
            'cancelledAt' => self::trimString($source['cancelledAt'] ?? ''),
            'cancelReason' => self::trimString($source['cancelReason'] ?? ''),
            'history' => array_values($history),
            'createdAt' => self::trimString($source['createdAt'] ?? $now) ?: $now,
            'updatedAt' => self::trimString($source['updatedAt'] ?? $now) ?: $now,
        ];
    }

    public static function normalizeImagingOrder(array $imagingOrder, array $fallback = []): array
    {
        $source = array_replace_recursive([
            'priority' => 'routine',
            'status' => 'draft',
            'resultStatus' => 'not_received',
            'requiredForCurrentPlan' => false,
            'diagnoses' => [],
            'studySelections' => [],
            'history' => [],
            'result' => [],
        ], $fallback, $imagingOrder);
        $imagingOrderId = self::trimString($source['imagingOrderId'] ?? '');
        $now = local_date('c');

        $history = [];
        foreach (($source['history'] ?? []) as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $history[] = [
                'eventId' => self::trimString($entry['eventId'] ?? $entry['id'] ?? '') !== ''
                    ? self::trimString($entry['eventId'] ?? $entry['id'] ?? '')
                    : self::newOpaqueId('imaging-order-history'),
                'type' => self::trimString($entry['type'] ?? ''),
                'status' => self::trimString($entry['status'] ?? ''),
                'actor' => self::trimString($entry['actor'] ?? ''),
                'actorRole' => self::trimString($entry['actorRole'] ?? ''),
                'at' => self::trimString($entry['at'] ?? $entry['createdAt'] ?? ''),
                'notes' => self::trimString($entry['notes'] ?? ''),
            ];
        }

        $result = self::normalizeImagingReport(
            isset($source['result']) && is_array($source['result']) ? $source['result'] : [],
            isset($fallback['result']) && is_array($fallback['result']) ? $fallback['result'] : []
        );
        $resultEvaluation = self::evaluateImagingReport($result);
        $resultStatus = self::trimString($source['resultStatus'] ?? '');
        if ($resultStatus === '') {
            $resultStatus = self::trimString(
                isset($source['result']) && is_array($source['result'])
                    ? ($source['result']['status'] ?? '')
                    : ''
            );
        }
        if ($resultStatus === '') {
            $resultStatus = self::trimString($resultEvaluation['status'] ?? 'not_received');
        }

        return [
            'imagingOrderId' => $imagingOrderId !== ''
                ? $imagingOrderId
                : self::newOpaqueId('imaging-order'),
            'status' => self::trimString($source['status'] ?? 'draft') ?: 'draft',
            'resultStatus' => $resultStatus !== '' ? $resultStatus : 'not_received',
            'requiredForCurrentPlan' => array_key_exists('requiredForCurrentPlan', $source)
                ? (bool) $source['requiredForCurrentPlan']
                : false,
            'priority' => self::trimString($source['priority'] ?? 'routine') ?: 'routine',
            'requestedAt' => self::trimString($source['requestedAt'] ?? ''),
            'studyDate' => self::trimString($source['studyDate'] ?? ''),
            'requestingEstablishment' => self::trimString($source['requestingEstablishment'] ?? ''),
            'requestingService' => self::trimString($source['requestingService'] ?? ''),
            'careSite' => self::trimString($source['careSite'] ?? ''),
            'bedLabel' => self::trimString($source['bedLabel'] ?? ''),
            'requestedBy' => self::trimString($source['requestedBy'] ?? ''),
            'patientName' => self::trimString($source['patientName'] ?? ''),
            'patientDocumentNumber' => self::trimString($source['patientDocumentNumber'] ?? ''),
            'patientRecordId' => self::trimString($source['patientRecordId'] ?? ''),
            'patientAgeYears' => self::nullablePositiveInt($source['patientAgeYears'] ?? null),
            'patientSexAtBirth' => self::trimString($source['patientSexAtBirth'] ?? ''),
            'diagnoses' => self::normalizeInterconsultationDiagnoses($source['diagnoses'] ?? []),
            'studySelections' => self::normalizeImagingStudySelections($source['studySelections'] ?? []),
            'requestReason' => self::trimString($source['requestReason'] ?? ''),
            'clinicalSummary' => self::trimString($source['clinicalSummary'] ?? ''),
            'canMobilize' => array_key_exists('canMobilize', $source)
                ? (bool) $source['canMobilize']
                : false,
            'canRemoveDressingsOrCasts' => array_key_exists('canRemoveDressingsOrCasts', $source)
                ? (bool) $source['canRemoveDressingsOrCasts']
                : false,
            'physicianPresentAtExam' => array_key_exists('physicianPresentAtExam', $source)
                ? (bool) $source['physicianPresentAtExam']
                : false,
            'bedsideRadiography' => array_key_exists('bedsideRadiography', $source)
                ? (bool) $source['bedsideRadiography']
                : false,
            'notes' => self::trimString($source['notes'] ?? ''),
            'issuedAt' => self::trimString($source['issuedAt'] ?? ''),
            'cancelledAt' => self::trimString($source['cancelledAt'] ?? ''),
            'cancelReason' => self::trimString($source['cancelReason'] ?? ''),
            'result' => $result,
            'history' => array_values($history),
            'createdAt' => self::trimString($source['createdAt'] ?? $now) ?: $now,
            'updatedAt' => self::trimString($source['updatedAt'] ?? $now) ?: $now,
        ];
    }

    public static function normalizeLabOrderSnapshots($items): array
    {
        if (!is_array($items)) {
            return [];
        }

        $normalized = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }

            $labOrder = self::normalizeLabOrder($item);
            $status = self::trimString($item['status'] ?? $labOrder['status'] ?? 'draft');
            $finalizedAt = self::trimString(
                $item['finalizedAt']
                    ?? ($status === 'issued'
                        ? ($labOrder['issuedAt'] ?? '')
                        : ($labOrder['cancelledAt'] ?? ''))
            );
            $normalized[] = array_merge($labOrder, [
                'snapshotId' => self::trimString($item['snapshotId'] ?? '') !== ''
                    ? self::trimString($item['snapshotId'] ?? '')
                    : self::newOpaqueId('lab-order-form'),
                'status' => $status !== '' ? $status : 'draft',
                'finalizedAt' => $finalizedAt,
                'snapshotAt' => self::trimString($item['snapshotAt'] ?? $finalizedAt ?? ''),
            ]);
        }

        usort($normalized, static function (array $left, array $right): int {
            return strcmp(
                (string) (($right['finalizedAt'] ?? '') ?: ($right['snapshotAt'] ?? '')),
                (string) (($left['finalizedAt'] ?? '') ?: ($left['snapshotAt'] ?? ''))
            );
        });

        return array_values($normalized);
    }

    public static function normalizeImagingOrderSnapshots($items): array
    {
        if (!is_array($items)) {
            return [];
        }

        $normalized = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }

            $imagingOrder = self::normalizeImagingOrder($item);
            $status = self::trimString($item['status'] ?? $imagingOrder['status'] ?? 'draft');
            $finalizedAt = self::trimString(
                $item['finalizedAt']
                    ?? ($status === 'issued'
                        ? ($imagingOrder['issuedAt'] ?? '')
                        : ($imagingOrder['cancelledAt'] ?? ''))
            );
            $normalized[] = array_merge($imagingOrder, [
                'snapshotId' => self::trimString($item['snapshotId'] ?? '') !== ''
                    ? self::trimString($item['snapshotId'] ?? '')
                    : self::newOpaqueId('imaging-order-form'),
                'status' => $status !== '' ? $status : 'draft',
                'finalizedAt' => $finalizedAt,
                'snapshotAt' => self::trimString($item['snapshotAt'] ?? $finalizedAt ?? ''),
            ]);
        }

        usort($normalized, static function (array $left, array $right): int {
            return strcmp(
                (string) (($right['finalizedAt'] ?? '') ?: ($right['snapshotAt'] ?? '')),
                (string) (($left['finalizedAt'] ?? '') ?: ($left['snapshotAt'] ?? ''))
            );
        });

        return array_values($normalized);
    }

    public static function normalizeImagingReport(array $report, array $fallback = []): array
    {
        $source = array_replace_recursive([
            'status' => 'not_received',
            'attachments' => [],
            'history' => [],
        ], $fallback, $report);
        $now = local_date('c');

        $history = [];
        foreach (($source['history'] ?? []) as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $history[] = [
                'eventId' => self::trimString($entry['eventId'] ?? $entry['id'] ?? '') !== ''
                    ? self::trimString($entry['eventId'] ?? $entry['id'] ?? '')
                    : self::newOpaqueId('imaging-report-history'),
                'type' => self::trimString($entry['type'] ?? ''),
                'status' => self::trimString($entry['status'] ?? ''),
                'actor' => self::trimString($entry['actor'] ?? ''),
                'actorRole' => self::trimString($entry['actorRole'] ?? ''),
                'at' => self::trimString($entry['at'] ?? $entry['createdAt'] ?? ''),
                'notes' => self::trimString($entry['notes'] ?? ''),
            ];
        }

        return [
            'status' => self::trimString($source['status'] ?? 'not_received') ?: 'not_received',
            'reportedAt' => self::trimString($source['reportedAt'] ?? ''),
            'reportedBy' => self::trimString($source['reportedBy'] ?? ''),
            'receivedBy' => self::trimString($source['receivedBy'] ?? ''),
            'reportingEstablishment' => self::trimString($source['reportingEstablishment'] ?? ''),
            'reportingService' => self::trimString($source['reportingService'] ?? ''),
            'radiologistProfessionalName' => self::trimString($source['radiologistProfessionalName'] ?? ''),
            'radiologistProfessionalRole' => self::trimString($source['radiologistProfessionalRole'] ?? ''),
            'studyPerformedSummary' => self::trimString($source['studyPerformedSummary'] ?? ''),
            'findings' => self::trimString($source['findings'] ?? ''),
            'diagnosticImpression' => self::trimString($source['diagnosticImpression'] ?? ''),
            'recommendations' => self::trimString($source['recommendations'] ?? ''),
            'followUpIndications' => self::trimString($source['followUpIndications'] ?? ''),
            'sourceDocumentType' => self::trimString($source['sourceDocumentType'] ?? ''),
            'sourceReference' => self::trimString($source['sourceReference'] ?? ''),
            'attachments' => self::normalizeAttachmentList($source['attachments'] ?? []),
            'history' => array_values($history),
            'createdAt' => self::trimString($source['createdAt'] ?? $now) ?: $now,
            'updatedAt' => self::trimString($source['updatedAt'] ?? $now) ?: $now,
        ];
    }

    public static function normalizeImagingReportSnapshots($items): array
    {
        if (!is_array($items)) {
            return [];
        }

        $normalized = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }

            $report = self::normalizeImagingReport(
                isset($item['report']) && is_array($item['report']) ? $item['report'] : $item
            );
            $finalizedAt = self::trimString($item['finalizedAt'] ?? $report['reportedAt'] ?? '');
            $normalized[] = [
                'snapshotId' => self::trimString($item['snapshotId'] ?? '') !== ''
                    ? self::trimString($item['snapshotId'] ?? '')
                    : self::newOpaqueId('imaging-report'),
                'imagingOrderId' => self::trimString($item['imagingOrderId'] ?? ''),
                'imagingOrderStatus' => self::trimString($item['imagingOrderStatus'] ?? $item['status'] ?? ''),
                'studySelections' => self::normalizeImagingStudySelections($item['studySelections'] ?? []),
                'requestReason' => self::trimString($item['requestReason'] ?? ''),
                'reportStatus' => self::trimString($item['reportStatus'] ?? $report['status'] ?? 'draft') ?: 'draft',
                'finalizedAt' => $finalizedAt,
                'snapshotAt' => self::trimString($item['snapshotAt'] ?? $finalizedAt) ?: ($finalizedAt !== '' ? $finalizedAt : local_date('c')),
                'report' => $report,
            ];
        }

        usort($normalized, static function (array $left, array $right): int {
            return strcmp(
                (string) (($right['finalizedAt'] ?? '') ?: ($right['snapshotAt'] ?? '')),
                (string) (($left['finalizedAt'] ?? '') ?: ($left['snapshotAt'] ?? ''))
            );
        });

        return array_values($normalized);
    }

    public static function normalizeInterconsultations($items): array
    {
        if (!is_array($items)) {
            return [];
        }

        $normalized = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            $normalized[] = self::normalizeInterconsultation($item);
        }

        usort($normalized, static function (array $left, array $right): int {
            $leftStamp = (string) (($left['updatedAt'] ?? '') ?: ($left['requestedAt'] ?? '') ?: ($left['createdAt'] ?? ''));
            $rightStamp = (string) (($right['updatedAt'] ?? '') ?: ($right['requestedAt'] ?? '') ?: ($right['createdAt'] ?? ''));
            return strcmp($rightStamp, $leftStamp);
        });

        return array_values($normalized);
    }

    public static function normalizeInterconsultation(array $interconsultation, array $fallback = []): array
    {
        $source = array_replace_recursive([
            'priority' => 'normal',
            'status' => 'draft',
            'reportStatus' => 'not_received',
            'requiredForCurrentPlan' => false,
            'history' => [],
            'diagnoses' => [],
            'report' => [],
        ], $fallback, $interconsultation);
        $interconsultId = self::trimString($source['interconsultId'] ?? '');
        $now = local_date('c');

        $history = [];
        foreach (($source['history'] ?? []) as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $history[] = [
                'eventId' => self::trimString($entry['eventId'] ?? $entry['id'] ?? '') !== ''
                    ? self::trimString($entry['eventId'] ?? $entry['id'] ?? '')
                    : self::newOpaqueId('interconsult-history'),
                'type' => self::trimString($entry['type'] ?? ''),
                'status' => self::trimString($entry['status'] ?? ''),
                'actor' => self::trimString($entry['actor'] ?? ''),
                'actorRole' => self::trimString($entry['actorRole'] ?? ''),
                'at' => self::trimString($entry['at'] ?? $entry['createdAt'] ?? ''),
                'notes' => self::trimString($entry['notes'] ?? ''),
            ];
        }

        $report = self::normalizeInterconsultReport(
            isset($source['report']) && is_array($source['report']) ? $source['report'] : [],
            isset($fallback['report']) && is_array($fallback['report']) ? $fallback['report'] : []
        );
        $reportEvaluation = self::evaluateInterconsultReport($report);
        $reportStatus = self::trimString($source['reportStatus'] ?? '');
        if ($reportStatus === '') {
            $reportStatus = self::trimString(
                isset($source['report']) && is_array($source['report'])
                    ? ($source['report']['status'] ?? '')
                    : ''
            );
        }
        if ($reportStatus === '') {
            $reportStatus = self::trimString($reportEvaluation['status'] ?? 'not_received');
        }

        return [
            'interconsultId' => $interconsultId !== ''
                ? $interconsultId
                : self::newOpaqueId('interconsult'),
            'status' => self::trimString($source['status'] ?? 'draft') ?: 'draft',
            'reportStatus' => $reportStatus !== '' ? $reportStatus : 'not_received',
            'requiredForCurrentPlan' => array_key_exists('requiredForCurrentPlan', $source)
                ? (bool) $source['requiredForCurrentPlan']
                : false,
            'priority' => self::trimString($source['priority'] ?? 'normal') ?: 'normal',
            'requestedAt' => self::trimString($source['requestedAt'] ?? ''),
            'requestingEstablishment' => self::trimString($source['requestingEstablishment'] ?? ''),
            'requestingService' => self::trimString($source['requestingService'] ?? ''),
            'destinationEstablishment' => self::trimString($source['destinationEstablishment'] ?? ''),
            'destinationService' => self::trimString($source['destinationService'] ?? ''),
            'consultedProfessionalName' => self::trimString($source['consultedProfessionalName'] ?? ''),
            'patientName' => self::trimString($source['patientName'] ?? ''),
            'patientDocumentNumber' => self::trimString($source['patientDocumentNumber'] ?? ''),
            'patientRecordId' => self::trimString($source['patientRecordId'] ?? ''),
            'patientAgeYears' => self::nullablePositiveInt($source['patientAgeYears'] ?? null),
            'patientSexAtBirth' => self::trimString($source['patientSexAtBirth'] ?? ''),
            'clinicalPicture' => self::trimString($source['clinicalPicture'] ?? ''),
            'requestReason' => self::trimString($source['requestReason'] ?? ''),
            'diagnoses' => self::normalizeInterconsultationDiagnoses($source['diagnoses'] ?? []),
            'performedDiagnosticsSummary' => self::trimString($source['performedDiagnosticsSummary'] ?? ''),
            'therapeuticMeasuresDone' => self::trimString($source['therapeuticMeasuresDone'] ?? ''),
            'questionForConsultant' => self::trimString($source['questionForConsultant'] ?? ''),
            'issuedBy' => self::trimString($source['issuedBy'] ?? ''),
            'issuedAt' => self::trimString($source['issuedAt'] ?? ''),
            'cancelledAt' => self::trimString($source['cancelledAt'] ?? ''),
            'cancelReason' => self::trimString($source['cancelReason'] ?? ''),
            'report' => $report,
            'history' => array_values($history),
            'createdAt' => self::trimString($source['createdAt'] ?? $now) ?: $now,
            'updatedAt' => self::trimString($source['updatedAt'] ?? $now) ?: $now,
        ];
    }

    public static function normalizeInterconsultationDiagnoses($items): array
    {
        if (!is_array($items)) {
            return [];
        }

        $normalized = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            $normalized[] = self::normalizeInterconsultationDiagnosis($item);
        }

        return array_values($normalized);
    }

    public static function normalizeInterconsultationDiagnosis(array $diagnosis): array
    {
        $type = self::trimString($diagnosis['type'] ?? 'pre');
        if (!in_array($type, ['pre', 'def'], true)) {
            $type = 'pre';
        }

        return [
            'type' => $type,
            'label' => self::trimString($diagnosis['label'] ?? ''),
            'cie10' => self::trimString($diagnosis['cie10'] ?? ''),
        ];
    }

    public static function normalizeInterconsultFormSnapshots($items): array
    {
        if (!is_array($items)) {
            return [];
        }

        $normalized = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }

            $interconsult = self::normalizeInterconsultation($item);
            $status = self::trimString($item['status'] ?? $interconsult['status'] ?? 'draft');
            $finalizedAt = self::trimString(
                $item['finalizedAt']
                    ?? ($status === 'issued'
                        ? ($interconsult['issuedAt'] ?? '')
                        : ($interconsult['cancelledAt'] ?? ''))
            );
            $normalized[] = array_merge($interconsult, [
                'snapshotId' => self::trimString($item['snapshotId'] ?? '') !== ''
                    ? self::trimString($item['snapshotId'] ?? '')
                    : self::newOpaqueId('interconsult-form'),
                'status' => $status !== '' ? $status : 'draft',
                'finalizedAt' => $finalizedAt,
                'snapshotAt' => self::trimString($item['snapshotAt'] ?? $finalizedAt ?? ''),
            ]);
        }

        usort($normalized, static function (array $left, array $right): int {
            return strcmp(
                (string) (($right['finalizedAt'] ?? '') ?: ($right['snapshotAt'] ?? '')),
                (string) (($left['finalizedAt'] ?? '') ?: ($left['snapshotAt'] ?? ''))
            );
        });

        return array_values($normalized);
    }

    public static function normalizeInterconsultReport(array $report, array $fallback = []): array
    {
        $source = array_replace_recursive([
            'status' => 'not_received',
            'attachments' => [],
            'history' => [],
        ], $fallback, $report);
        $now = local_date('c');

        $history = [];
        foreach (($source['history'] ?? []) as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $history[] = [
                'eventId' => self::trimString($entry['eventId'] ?? $entry['id'] ?? '') !== ''
                    ? self::trimString($entry['eventId'] ?? $entry['id'] ?? '')
                    : self::newOpaqueId('interconsult-report-history'),
                'type' => self::trimString($entry['type'] ?? ''),
                'status' => self::trimString($entry['status'] ?? ''),
                'actor' => self::trimString($entry['actor'] ?? ''),
                'actorRole' => self::trimString($entry['actorRole'] ?? ''),
                'at' => self::trimString($entry['at'] ?? $entry['createdAt'] ?? ''),
                'notes' => self::trimString($entry['notes'] ?? ''),
            ];
        }

        $normalized = [
            'status' => self::trimString($source['status'] ?? 'not_received') ?: 'not_received',
            'reportedAt' => self::trimString($source['reportedAt'] ?? ''),
            'reportedBy' => self::trimString($source['reportedBy'] ?? ''),
            'receivedBy' => self::trimString($source['receivedBy'] ?? ''),
            'respondingEstablishment' => self::trimString($source['respondingEstablishment'] ?? ''),
            'respondingService' => self::trimString($source['respondingService'] ?? ''),
            'consultantProfessionalName' => self::trimString($source['consultantProfessionalName'] ?? ''),
            'consultantProfessionalRole' => self::trimString($source['consultantProfessionalRole'] ?? ''),
            'reportSummary' => self::trimString($source['reportSummary'] ?? ''),
            'clinicalFindings' => self::trimString($source['clinicalFindings'] ?? ''),
            'diagnosticOpinion' => self::trimString($source['diagnosticOpinion'] ?? ''),
            'recommendations' => self::trimString($source['recommendations'] ?? ''),
            'followUpIndications' => self::trimString($source['followUpIndications'] ?? ''),
            'sourceDocumentType' => self::trimString($source['sourceDocumentType'] ?? ''),
            'sourceReference' => self::trimString($source['sourceReference'] ?? ''),
            'attachments' => self::normalizeAttachmentList($source['attachments'] ?? []),
            'history' => array_values($history),
            'createdAt' => self::trimString($source['createdAt'] ?? $now) ?: $now,
            'updatedAt' => self::trimString($source['updatedAt'] ?? $now) ?: $now,
        ];

        return $normalized;
    }

    public static function normalizeInterconsultReportSnapshots($items): array
    {
        if (!is_array($items)) {
            return [];
        }

        $normalized = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }

            $report = self::normalizeInterconsultReport(
                isset($item['report']) && is_array($item['report']) ? $item['report'] : $item
            );
            $finalizedAt = self::trimString($item['finalizedAt'] ?? $report['reportedAt'] ?? '');
            $normalized[] = [
                'snapshotId' => self::trimString($item['snapshotId'] ?? '') !== ''
                    ? self::trimString($item['snapshotId'] ?? '')
                    : self::newOpaqueId('interconsult-report'),
                'interconsultId' => self::trimString($item['interconsultId'] ?? ''),
                'interconsultStatus' => self::trimString($item['interconsultStatus'] ?? $item['status'] ?? ''),
                'destinationEstablishment' => self::trimString($item['destinationEstablishment'] ?? ''),
                'destinationService' => self::trimString($item['destinationService'] ?? ''),
                'consultedProfessionalName' => self::trimString($item['consultedProfessionalName'] ?? ''),
                'reportStatus' => self::trimString($item['reportStatus'] ?? $report['status'] ?? 'draft') ?: 'draft',
                'finalizedAt' => $finalizedAt,
                'snapshotAt' => self::trimString($item['snapshotAt'] ?? $finalizedAt) ?: ($finalizedAt !== '' ? $finalizedAt : local_date('c')),
                'report' => $report,
            ];
        }

        usort($normalized, static function (array $left, array $right): int {
            return strcmp(
                (string) (($right['finalizedAt'] ?? '') ?: ($right['snapshotAt'] ?? '')),
                (string) (($left['finalizedAt'] ?? '') ?: ($left['snapshotAt'] ?? ''))
            );
        });

        return array_values($normalized);
    }

    public static function syncInterconsultationArtifacts(array $draft, array $session = []): array
    {
        $draft = self::defaultDraft($session, $draft);
        $interconsultations = self::normalizeInterconsultations($draft['interconsultations'] ?? []);

        $hydrated = [];
        foreach ($interconsultations as $interconsultation) {
            $hydrated[] = self::hydrateInterconsultationContext($interconsultation, $draft, $session);
        }
        $interconsultations = array_values($hydrated);

        $activeInterconsultationId = self::trimString($draft['activeInterconsultationId'] ?? '');
        if ($activeInterconsultationId === '' && $interconsultations !== []) {
            $activeInterconsultationId = self::trimString($interconsultations[0]['interconsultId'] ?? '');
        }
        $activeInterconsultation = null;
        foreach ($interconsultations as $interconsultation) {
            if (self::trimString($interconsultation['interconsultId'] ?? '') === $activeInterconsultationId) {
                $activeInterconsultation = $interconsultation;
                break;
            }
        }
        if ($activeInterconsultation === null && $interconsultations !== []) {
            $activeInterconsultation = $interconsultations[0];
            $activeInterconsultationId = self::trimString($activeInterconsultation['interconsultId'] ?? '');
        }

        $documents = self::normalizeClinicalDocuments(
            isset($draft['documents']) && is_array($draft['documents']) ? $draft['documents'] : []
        );
        $documents['interconsultForms'] = self::ensureInterconsultFormSnapshots(
            $documents['interconsultForms'] ?? [],
            $interconsultations
        );
        $documents['interconsultReports'] = self::ensureInterconsultReportSnapshots(
            $documents['interconsultReports'] ?? [],
            $interconsultations
        );

        $draft['documents'] = $documents;
        $draft['interconsultations'] = $interconsultations;
        $draft['activeInterconsultationId'] = $activeInterconsultationId;

        return $draft;
    }

    public static function syncLabOrderArtifacts(array $draft, array $session = []): array
    {
        $draft = self::defaultDraft($session, $draft);
        $labOrders = self::normalizeLabOrders($draft['labOrders'] ?? []);

        $hydrated = [];
        foreach ($labOrders as $labOrder) {
            $hydrated[] = self::hydrateLabOrderContext($labOrder, $draft, $session);
        }
        $labOrders = array_values($hydrated);

        $activeLabOrderId = self::trimString($draft['activeLabOrderId'] ?? '');
        if ($activeLabOrderId === '' && $labOrders !== []) {
            $activeLabOrderId = self::trimString($labOrders[0]['labOrderId'] ?? '');
        }
        $activeLabOrder = null;
        foreach ($labOrders as $labOrder) {
            if (self::trimString($labOrder['labOrderId'] ?? '') === $activeLabOrderId) {
                $activeLabOrder = $labOrder;
                break;
            }
        }
        if ($activeLabOrder === null && $labOrders !== []) {
            $activeLabOrder = $labOrders[0];
            $activeLabOrderId = self::trimString($activeLabOrder['labOrderId'] ?? '');
        }

        $documents = self::normalizeClinicalDocuments(
            isset($draft['documents']) && is_array($draft['documents']) ? $draft['documents'] : []
        );
        $documents['labOrders'] = self::ensureLabOrderSnapshots(
            $documents['labOrders'] ?? [],
            $labOrders
        );

        $draft['documents'] = $documents;
        $draft['labOrders'] = $labOrders;
        $draft['activeLabOrderId'] = $activeLabOrderId;

        return $draft;
    }

    public static function syncImagingOrderArtifacts(array $draft, array $session = []): array
    {
        $draft = self::defaultDraft($session, $draft);
        $imagingOrders = self::normalizeImagingOrders($draft['imagingOrders'] ?? []);

        $hydrated = [];
        foreach ($imagingOrders as $imagingOrder) {
            $hydrated[] = self::hydrateImagingOrderContext($imagingOrder, $draft, $session);
        }
        $imagingOrders = array_values($hydrated);

        $activeImagingOrderId = self::trimString($draft['activeImagingOrderId'] ?? '');
        if ($activeImagingOrderId === '' && $imagingOrders !== []) {
            $activeImagingOrderId = self::trimString($imagingOrders[0]['imagingOrderId'] ?? '');
        }
        $activeImagingOrder = null;
        foreach ($imagingOrders as $imagingOrder) {
            if (self::trimString($imagingOrder['imagingOrderId'] ?? '') === $activeImagingOrderId) {
                $activeImagingOrder = $imagingOrder;
                break;
            }
        }
        if ($activeImagingOrder === null && $imagingOrders !== []) {
            $activeImagingOrder = $imagingOrders[0];
            $activeImagingOrderId = self::trimString($activeImagingOrder['imagingOrderId'] ?? '');
        }

        $documents = self::normalizeClinicalDocuments(
            isset($draft['documents']) && is_array($draft['documents']) ? $draft['documents'] : []
        );
        $documents['imagingOrders'] = self::ensureImagingOrderSnapshots(
            $documents['imagingOrders'] ?? [],
            $imagingOrders
        );
        $documents['imagingReports'] = self::ensureImagingReportSnapshots(
            $documents['imagingReports'] ?? [],
            $imagingOrders
        );

        $draft['documents'] = $documents;
        $draft['imagingOrders'] = $imagingOrders;
        $draft['activeImagingOrderId'] = $activeImagingOrderId;

        return $draft;
    }

    public static function evaluateInterconsultation(array $interconsultation): array
    {
        $normalized = self::normalizeInterconsultation($interconsultation);
        $diagnoses = self::normalizeInterconsultationDiagnoses($normalized['diagnoses'] ?? []);
        $status = self::trimString($normalized['status'] ?? 'draft');
        $reportEvaluation = self::evaluateInterconsultReport(
            isset($normalized['report']) && is_array($normalized['report']) ? $normalized['report'] : []
        );

        $missing = [];
        if (self::trimString($normalized['destinationEstablishment'] ?? '') === '') {
            $missing[] = 'destination_establishment';
        }
        if (self::trimString($normalized['destinationService'] ?? '') === '') {
            $missing[] = 'destination_service';
        }
        if (
            self::trimString($normalized['requestReason'] ?? '') === ''
            && self::trimString($normalized['questionForConsultant'] ?? '') === ''
        ) {
            $missing[] = 'request_reason';
        }
        if (self::trimString($normalized['clinicalPicture'] ?? '') === '') {
            $missing[] = 'clinical_picture';
        }
        if (count(array_filter($diagnoses, static fn (array $item): bool => self::trimString($item['label'] ?? '') !== '')) === 0) {
            $missing[] = 'diagnosis';
        }
        if (self::trimString($normalized['performedDiagnosticsSummary'] ?? '') === '') {
            $missing[] = 'performed_diagnostics_summary';
        }
        if (self::trimString($normalized['therapeuticMeasuresDone'] ?? '') === '') {
            $missing[] = 'therapeutic_measures_done';
        }
        if (self::trimString($normalized['issuedBy'] ?? '') === '') {
            $missing[] = 'issued_by';
        }

        $readyToIssue = $missing === [];
        $hasAnyContent =
            self::trimString($normalized['destinationEstablishment'] ?? '') !== ''
            || self::trimString($normalized['destinationService'] ?? '') !== ''
            || self::trimString($normalized['consultedProfessionalName'] ?? '') !== ''
            || self::trimString($normalized['clinicalPicture'] ?? '') !== ''
            || self::trimString($normalized['requestReason'] ?? '') !== ''
            || self::trimString($normalized['questionForConsultant'] ?? '') !== ''
            || self::trimString($normalized['performedDiagnosticsSummary'] ?? '') !== ''
            || self::trimString($normalized['therapeuticMeasuresDone'] ?? '') !== ''
            || count(array_filter($diagnoses, static fn (array $item): bool => self::trimString($item['label'] ?? '') !== '' || self::trimString($item['cie10'] ?? '') !== '')) > 0;

        $effectiveStatus = 'draft';
        if ($status === 'issued') {
            $effectiveStatus = ($reportEvaluation['status'] ?? 'not_received') === 'received'
                ? 'received'
                : (($readyToIssue && self::trimString($normalized['issuedAt'] ?? '') !== '')
                    ? 'issued'
                    : 'incomplete');
        } elseif ($status === 'cancelled') {
            $effectiveStatus = self::trimString($normalized['cancelledAt'] ?? '') !== ''
                ? 'cancelled'
                : 'incomplete';
        } elseif ($readyToIssue) {
            $effectiveStatus = 'ready_to_issue';
        } elseif ($hasAnyContent) {
            $effectiveStatus = 'incomplete';
        }

        return [
            'status' => $effectiveStatus,
            'readyToIssue' => $readyToIssue,
            'reportStatus' => (string) ($reportEvaluation['status'] ?? 'not_received'),
            'missingFields' => array_values(array_unique($missing)),
            'hasAnyContent' => $hasAnyContent,
        ];
    }

    public static function evaluateLabOrder(array $labOrder): array
    {
        $normalized = self::normalizeLabOrder($labOrder);
        $diagnoses = self::normalizeInterconsultationDiagnoses($normalized['diagnoses'] ?? []);
        $selectedStudies = self::flattenLabOrderStudySelections(
            is_array($normalized['studySelections'] ?? null) ? $normalized['studySelections'] : []
        );
        $status = self::trimString($normalized['status'] ?? 'draft');

        $missing = [];
        if (self::trimString($normalized['sampleDate'] ?? '') === '') {
            $missing[] = 'sample_date';
        }
        if (self::trimString($normalized['priority'] ?? '') === '') {
            $missing[] = 'priority';
        }
        if (
            self::trimString($normalized['requestingEstablishment'] ?? '') === ''
            && self::trimString($normalized['requestingService'] ?? '') === ''
        ) {
            $missing[] = 'requesting_service';
        }
        if (self::trimString($normalized['requestedBy'] ?? '') === '') {
            $missing[] = 'requested_by';
        }
        if (count(array_filter($diagnoses, static fn (array $item): bool => self::trimString($item['label'] ?? '') !== '')) === 0) {
            $missing[] = 'diagnosis';
        }
        if ($selectedStudies === []) {
            $missing[] = 'studies';
        }
        if (
            self::normalizeStringList($normalized['studySelections']['bacteriology'] ?? []) !== []
            && self::trimString($normalized['bacteriologySampleSource'] ?? '') === ''
        ) {
            $missing[] = 'bacteriology_sample_source';
        }

        $readyToIssue = $missing === [];
        $hasAnyContent =
            self::trimString($normalized['sampleDate'] ?? '') !== ''
            || self::trimString($normalized['requestedBy'] ?? '') !== ''
            || self::trimString($normalized['notes'] ?? '') !== ''
            || count(array_filter($diagnoses, static fn (array $item): bool => self::trimString($item['label'] ?? '') !== '' || self::trimString($item['cie10'] ?? '') !== '')) > 0
            || $selectedStudies !== [];

        $effectiveStatus = 'draft';
        if ($status === 'issued') {
            $effectiveStatus = ($readyToIssue && self::trimString($normalized['issuedAt'] ?? '') !== '')
                ? 'issued'
                : 'incomplete';
        } elseif ($status === 'cancelled') {
            $effectiveStatus = self::trimString($normalized['cancelledAt'] ?? '') !== ''
                ? 'cancelled'
                : 'incomplete';
        } elseif ($readyToIssue) {
            $effectiveStatus = 'ready_to_issue';
        } elseif ($hasAnyContent) {
            $effectiveStatus = 'incomplete';
        }

        return [
            'status' => $effectiveStatus,
            'readyToIssue' => $readyToIssue,
            'missingFields' => array_values(array_unique($missing)),
            'selectedStudiesCount' => count($selectedStudies),
            'hasAnyContent' => $hasAnyContent,
        ];
    }

    public static function evaluateImagingOrder(array $imagingOrder): array
    {
        $normalized = self::normalizeImagingOrder($imagingOrder);
        $diagnoses = self::normalizeInterconsultationDiagnoses($normalized['diagnoses'] ?? []);
        $selectedStudies = self::flattenImagingStudySelections(
            is_array($normalized['studySelections'] ?? null) ? $normalized['studySelections'] : []
        );
        $status = self::trimString($normalized['status'] ?? 'draft');
        $resultEvaluation = self::evaluateImagingReport(
            isset($normalized['result']) && is_array($normalized['result']) ? $normalized['result'] : []
        );

        $missing = [];
        if (self::trimString($normalized['studyDate'] ?? '') === '') {
            $missing[] = 'study_date';
        }
        if (self::trimString($normalized['priority'] ?? '') === '') {
            $missing[] = 'priority';
        }
        if (self::trimString($normalized['requestedBy'] ?? '') === '') {
            $missing[] = 'requested_by';
        }
        if ($selectedStudies === []) {
            $missing[] = 'studies';
        }
        if (self::trimString($normalized['requestReason'] ?? '') === '') {
            $missing[] = 'request_reason';
        }
        if (self::trimString($normalized['clinicalSummary'] ?? '') === '') {
            $missing[] = 'clinical_summary';
        }
        if (count(array_filter($diagnoses, static fn (array $item): bool => self::trimString($item['label'] ?? '') !== '')) === 0) {
            $missing[] = 'diagnosis';
        }
        if (
            ($normalized['bedsideRadiography'] ?? false) === true
            && self::normalizeStringList($normalized['studySelections']['conventionalRadiography'] ?? []) === []
        ) {
            $missing[] = 'bedside_radiography_requires_conventional';
        }

        $readyToIssue = $missing === [];
        $hasAnyContent =
            self::trimString($normalized['studyDate'] ?? '') !== ''
            || self::trimString($normalized['requestedBy'] ?? '') !== ''
            || self::trimString($normalized['requestReason'] ?? '') !== ''
            || self::trimString($normalized['clinicalSummary'] ?? '') !== ''
            || self::trimString($normalized['notes'] ?? '') !== ''
            || count(array_filter($diagnoses, static fn (array $item): bool => self::trimString($item['label'] ?? '') !== '' || self::trimString($item['cie10'] ?? '') !== '')) > 0
            || $selectedStudies !== [];

        $effectiveStatus = 'draft';
        if ($status === 'issued') {
            $effectiveStatus = ($resultEvaluation['status'] ?? 'not_received') === 'received'
                ? 'received'
                : (($readyToIssue && self::trimString($normalized['issuedAt'] ?? '') !== '')
                    ? 'issued'
                    : 'incomplete');
        } elseif ($status === 'cancelled') {
            $effectiveStatus = self::trimString($normalized['cancelledAt'] ?? '') !== ''
                ? 'cancelled'
                : 'incomplete';
        } elseif ($readyToIssue) {
            $effectiveStatus = 'ready_to_issue';
        } elseif ($hasAnyContent) {
            $effectiveStatus = 'incomplete';
        }

        return [
            'status' => $effectiveStatus,
            'reportStatus' => (string) ($resultEvaluation['status'] ?? 'not_received'),
            'readyToIssue' => $readyToIssue,
            'missingFields' => array_values(array_unique($missing)),
            'selectedStudiesCount' => count($selectedStudies),
            'hasAnyContent' => $hasAnyContent,
        ];
    }

    public static function evaluateImagingReport(array $report): array
    {
        $normalized = self::normalizeImagingReport($report);
        $status = self::trimString($normalized['status'] ?? 'not_received');

        $missing = [];
        if (
            self::trimString($normalized['reportingEstablishment'] ?? '') === ''
            && self::trimString($normalized['reportingService'] ?? '') === ''
        ) {
            $missing[] = 'reporting_service';
        }
        if (self::trimString($normalized['radiologistProfessionalName'] ?? '') === '') {
            $missing[] = 'radiologist_professional_name';
        }
        if (self::trimString($normalized['reportedAt'] ?? '') === '') {
            $missing[] = 'reported_at';
        }
        if (
            self::trimString($normalized['findings'] ?? '') === ''
            && self::trimString($normalized['diagnosticImpression'] ?? '') === ''
        ) {
            $missing[] = 'findings';
        }
        if (
            self::trimString($normalized['recommendations'] ?? '') === ''
            && self::trimString($normalized['followUpIndications'] ?? '') === ''
        ) {
            $missing[] = 'recommendations';
        }

        $readyToReceive = $missing === [];
        $hasAnyContent =
            self::trimString($normalized['reportedAt'] ?? '') !== ''
            || self::trimString($normalized['reportedBy'] ?? '') !== ''
            || self::trimString($normalized['receivedBy'] ?? '') !== ''
            || self::trimString($normalized['reportingEstablishment'] ?? '') !== ''
            || self::trimString($normalized['reportingService'] ?? '') !== ''
            || self::trimString($normalized['radiologistProfessionalName'] ?? '') !== ''
            || self::trimString($normalized['radiologistProfessionalRole'] ?? '') !== ''
            || self::trimString($normalized['studyPerformedSummary'] ?? '') !== ''
            || self::trimString($normalized['findings'] ?? '') !== ''
            || self::trimString($normalized['diagnosticImpression'] ?? '') !== ''
            || self::trimString($normalized['recommendations'] ?? '') !== ''
            || self::trimString($normalized['followUpIndications'] ?? '') !== ''
            || self::trimString($normalized['sourceDocumentType'] ?? '') !== ''
            || self::trimString($normalized['sourceReference'] ?? '') !== ''
            || count($normalized['attachments'] ?? []) > 0;

        $effectiveStatus = 'not_received';
        if ($status === 'received') {
            $effectiveStatus = $readyToReceive ? 'received' : 'draft';
        } elseif ($readyToReceive) {
            $effectiveStatus = 'ready_to_receive';
        } elseif ($hasAnyContent) {
            $effectiveStatus = 'draft';
        }

        return [
            'status' => $effectiveStatus,
            'readyToReceive' => $readyToReceive,
            'missingFields' => array_values(array_unique($missing)),
        ];
    }

    public static function evaluateInterconsultReport(array $report): array
    {
        $normalized = self::normalizeInterconsultReport($report);
        $status = self::trimString($normalized['status'] ?? 'not_received');

        $missing = [];
        if (
            self::trimString($normalized['respondingEstablishment'] ?? '') === ''
            && self::trimString($normalized['respondingService'] ?? '') === ''
        ) {
            $missing[] = 'responding_service';
        }
        if (self::trimString($normalized['consultantProfessionalName'] ?? '') === '') {
            $missing[] = 'consultant_professional_name';
        }
        if (self::trimString($normalized['reportedAt'] ?? '') === '') {
            $missing[] = 'reported_at';
        }
        if (
            self::trimString($normalized['clinicalFindings'] ?? '') === ''
            && self::trimString($normalized['diagnosticOpinion'] ?? '') === ''
        ) {
            $missing[] = 'clinical_findings';
        }
        if (
            self::trimString($normalized['recommendations'] ?? '') === ''
            && self::trimString($normalized['followUpIndications'] ?? '') === ''
        ) {
            $missing[] = 'recommendations';
        }

        $readyToReceive = $missing === [];
        $hasAnyContent =
            self::trimString($normalized['reportedAt'] ?? '') !== ''
            || self::trimString($normalized['reportedBy'] ?? '') !== ''
            || self::trimString($normalized['respondingEstablishment'] ?? '') !== ''
            || self::trimString($normalized['respondingService'] ?? '') !== ''
            || self::trimString($normalized['consultantProfessionalName'] ?? '') !== ''
            || self::trimString($normalized['consultantProfessionalRole'] ?? '') !== ''
            || self::trimString($normalized['reportSummary'] ?? '') !== ''
            || self::trimString($normalized['clinicalFindings'] ?? '') !== ''
            || self::trimString($normalized['diagnosticOpinion'] ?? '') !== ''
            || self::trimString($normalized['recommendations'] ?? '') !== ''
            || self::trimString($normalized['followUpIndications'] ?? '') !== ''
            || self::trimString($normalized['sourceDocumentType'] ?? '') !== ''
            || self::trimString($normalized['sourceReference'] ?? '') !== ''
            || count($normalized['attachments'] ?? []) > 0;

        $effectiveStatus = 'not_received';
        if ($status === 'received') {
            $effectiveStatus = $readyToReceive ? 'received' : 'draft';
        } elseif ($readyToReceive) {
            $effectiveStatus = 'ready_to_receive';
        } elseif ($hasAnyContent) {
            $effectiveStatus = 'draft';
        }

        return [
            'status' => $effectiveStatus,
            'readyToReceive' => $readyToReceive,
            'missingFields' => array_values(array_unique($missing)),
        ];
    }

    public static function consentPacketTemplate(string $templateKey): array
    {
        $normalizedTemplate = self::trimString($templateKey);
        if ($normalizedTemplate === '') {
            $normalizedTemplate = 'generic';
        }

        $base = [
            'templateKey' => $normalizedTemplate,
            'writtenRequired' => true,
            'careMode' => 'ambulatorio',
            'serviceLabel' => 'Dermatologia ambulatoria',
            'establishmentLabel' => 'Consultorio privado',
            'title' => 'Consentimiento informado HCU-form.024/2008',
            'procedureKey' => 'generic',
            'procedureLabel' => 'Consentimiento generico',
            'procedureName' => 'Procedimiento ambulatorio',
            'procedureWhatIsIt' => '',
            'procedureHowItIsDone' => '',
            'durationEstimate' => '',
            'benefits' => '',
            'frequentRisks' => '',
            'rareSeriousRisks' => '',
            'patientSpecificRisks' => '',
            'alternatives' => '',
            'postProcedureCare' => '',
            'noProcedureConsequences' => '',
            'anesthesiologistAttestation' => [
                'applicable' => false,
            ],
        ];

        if ($normalizedTemplate === 'laser-dermatologico') {
            return array_replace_recursive($base, [
                'procedureKey' => 'laser-dermatologico',
                'procedureLabel' => 'Laser dermatologico',
                'procedureName' => 'Procedimiento con laser dermatologico',
                'procedureWhatIsIt' => 'Aplicacion dirigida de energia laser sobre la piel para manejo dermatologico ambulatorio.',
                'procedureHowItIsDone' => 'Se delimita el area, se protege la zona y se aplica el laser por sesiones segun criterio clinico.',
                'durationEstimate' => '20 a 45 minutos segun area tratada',
                'benefits' => 'Mejoria del objetivo dermatologico indicado y manejo ambulatorio controlado.',
                'frequentRisks' => 'Eritema, edema, ardor transitorio, costras leves o hiperpigmentacion postinflamatoria.',
                'rareSeriousRisks' => 'Quemadura, cicatriz, infeccion secundaria o alteraciones pigmentarias persistentes.',
                'postProcedureCare' => 'Fotoproteccion estricta, cuidado gentil de la zona y seguimiento clinico.',
                'noProcedureConsequences' => 'Persistencia del problema dermatologico, respuesta mas lenta o necesidad de otras alternativas.',
            ]);
        }

        if ($normalizedTemplate === 'peeling-quimico') {
            return array_replace_recursive($base, [
                'procedureKey' => 'peeling-quimico',
                'procedureLabel' => 'Peeling quimico',
                'procedureName' => 'Peeling quimico ambulatorio',
                'procedureWhatIsIt' => 'Aplicacion controlada de agentes quimicos sobre la piel para renovacion superficial o media.',
                'procedureHowItIsDone' => 'Se prepara la piel, se aplica el agente por tiempo definido y luego se neutraliza o retira segun tecnica.',
                'durationEstimate' => '20 a 40 minutos segun protocolo',
                'benefits' => 'Mejoria de textura, tono, lesiones superficiales y apoyo al plan dermatologico.',
                'frequentRisks' => 'Ardor, eritema, descamacion, sensibilidad y cambios pigmentarios transitorios.',
                'rareSeriousRisks' => 'Quemadura quimica, cicatriz, infeccion o discromias persistentes.',
                'postProcedureCare' => 'Hidratacion, fotoproteccion, evitar manipulacion y cumplir indicaciones postratamiento.',
                'noProcedureConsequences' => 'Persistencia del problema cutaneo o necesidad de otras alternativas terapeuticas.',
            ]);
        }

        if ($normalizedTemplate === 'botox') {
            return array_replace_recursive($base, [
                'procedureKey' => 'botox',
                'procedureLabel' => 'Botox',
                'procedureName' => 'Aplicacion de toxina botulinica',
                'procedureWhatIsIt' => 'Aplicacion intramuscular o intradermica de toxina botulinica en puntos definidos.',
                'procedureHowItIsDone' => 'Se realiza marcacion anatomica y se aplica el medicamento en dosis distribuidas segun plan clinico.',
                'durationEstimate' => '15 a 30 minutos segun zonas tratadas',
                'benefits' => 'Mejoria funcional o estetica segun la indicacion establecida por el profesional tratante.',
                'frequentRisks' => 'Dolor leve, hematoma, edema, asimetria transitoria o cefalea.',
                'rareSeriousRisks' => 'Ptosis, debilidad muscular no deseada, reaccion alergica o difusion del efecto a zonas no objetivo.',
                'postProcedureCare' => 'Evitar masaje local, seguir indicaciones medicas y asistir a control si se programa.',
                'noProcedureConsequences' => 'Persistencia del motivo de consulta o necesidad de otras alternativas terapeuticas.',
            ]);
        }

        if ($normalizedTemplate === 'legacy-bridge') {
            return array_replace_recursive($base, [
                'title' => 'Consentimiento informado legacy',
                'procedureKey' => 'generic',
                'procedureLabel' => 'Consentimiento legacy',
                'procedureName' => 'Procedimiento ambulatorio documentado por bridge',
            ]);
        }

        return $base;
    }

    public static function normalizeConsentPackets($items): array
    {
        if (!is_array($items)) {
            return [];
        }

        $normalized = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            $normalized[] = self::normalizeConsentPacket($item);
        }

        usort($normalized, static function (array $left, array $right): int {
            return strcmp(
                (string) (($right['updatedAt'] ?? '') ?: ($right['createdAt'] ?? '')),
                (string) (($left['updatedAt'] ?? '') ?: ($left['createdAt'] ?? ''))
            );
        });

        return array_values($normalized);
    }

    public static function normalizeConsentPacket(array $packet, array $fallback = []): array
    {
        $templateKey = self::trimString($packet['templateKey'] ?? $fallback['templateKey'] ?? 'generic');
        if ($templateKey === '') {
            $templateKey = 'generic';
        }
        $defaults = self::consentPacketTemplate($templateKey);
        $source = array_replace_recursive($defaults, $fallback, $packet);
        $packetId = self::trimString($source['packetId'] ?? '');
        $now = local_date('c');

        $history = [];
        if (isset($source['history']) && is_array($source['history'])) {
            foreach ($source['history'] as $entry) {
                if (!is_array($entry)) {
                    continue;
                }
                $history[] = [
                    'eventId' => self::trimString($entry['eventId'] ?? $entry['id'] ?? '') !== ''
                        ? self::trimString($entry['eventId'] ?? $entry['id'] ?? '')
                        : self::newOpaqueId('consent-history'),
                    'type' => self::trimString($entry['type'] ?? ''),
                    'status' => self::trimString($entry['status'] ?? ''),
                    'actor' => self::trimString($entry['actor'] ?? ''),
                    'actorRole' => self::trimString($entry['actorRole'] ?? ''),
                    'at' => self::trimString($entry['at'] ?? $entry['createdAt'] ?? ''),
                    'notes' => self::trimString($entry['notes'] ?? ''),
                ];
            }
        }

        return [
            'packetId' => $packetId !== ''
                ? $packetId
                : self::newOpaqueId('consent'),
            'templateKey' => $templateKey,
            'sourceMode' => self::trimString($source['sourceMode'] ?? ''),
            'title' => self::trimString($source['title'] ?? $defaults['title'] ?? ''),
            'procedureKey' => self::trimString($source['procedureKey'] ?? $defaults['procedureKey'] ?? ''),
            'procedureLabel' => self::trimString($source['procedureLabel'] ?? $defaults['procedureLabel'] ?? ''),
            'status' => self::trimString($source['status'] ?? 'draft') ?: 'draft',
            'writtenRequired' => array_key_exists('writtenRequired', $source)
                ? (bool) $source['writtenRequired']
                : true,
            'careMode' => self::trimString($source['careMode'] ?? $defaults['careMode'] ?? 'ambulatorio'),
            'serviceLabel' => self::trimString($source['serviceLabel'] ?? $defaults['serviceLabel'] ?? ''),
            'establishmentLabel' => self::trimString($source['establishmentLabel'] ?? $defaults['establishmentLabel'] ?? ''),
            'patientName' => self::trimString($source['patientName'] ?? ''),
            'patientDocumentNumber' => self::trimString($source['patientDocumentNumber'] ?? ''),
            'patientRecordId' => self::trimString($source['patientRecordId'] ?? ''),
            'encounterDateTime' => self::trimString($source['encounterDateTime'] ?? ''),
            'diagnosisLabel' => self::trimString($source['diagnosisLabel'] ?? ''),
            'diagnosisCie10' => self::trimString($source['diagnosisCie10'] ?? ''),
            'procedureName' => self::trimString($source['procedureName'] ?? $defaults['procedureName'] ?? ''),
            'procedureWhatIsIt' => self::trimString($source['procedureWhatIsIt'] ?? ''),
            'procedureHowItIsDone' => self::trimString($source['procedureHowItIsDone'] ?? ''),
            'durationEstimate' => self::trimString($source['durationEstimate'] ?? ''),
            'graphicRef' => self::trimString($source['graphicRef'] ?? ''),
            'benefits' => self::trimString($source['benefits'] ?? ''),
            'frequentRisks' => self::trimString($source['frequentRisks'] ?? ''),
            'rareSeriousRisks' => self::trimString($source['rareSeriousRisks'] ?? ''),
            'patientSpecificRisks' => self::trimString($source['patientSpecificRisks'] ?? ''),
            'alternatives' => self::trimString($source['alternatives'] ?? ''),
            'postProcedureCare' => self::trimString($source['postProcedureCare'] ?? ''),
            'noProcedureConsequences' => self::trimString($source['noProcedureConsequences'] ?? ''),
            'privateCommunicationConfirmed' => array_key_exists('privateCommunicationConfirmed', $source)
                ? (bool) $source['privateCommunicationConfirmed']
                : false,
            'companionShareAuthorized' => array_key_exists('companionShareAuthorized', $source)
                ? (bool) $source['companionShareAuthorized']
                : false,
            'declaration' => [
                'declaredAt' => self::trimString($source['declaration']['declaredAt'] ?? ''),
                'patientCanConsent' => array_key_exists('patientCanConsent', $source['declaration'] ?? [])
                    ? (bool) $source['declaration']['patientCanConsent']
                    : true,
                'capacityAssessment' => self::trimString($source['declaration']['capacityAssessment'] ?? ''),
                'notes' => self::trimString($source['declaration']['notes'] ?? ''),
            ],
            'denial' => [
                'declinedAt' => self::trimString($source['denial']['declinedAt'] ?? ''),
                'reason' => self::trimString($source['denial']['reason'] ?? ''),
                'patientRefusedSignature' => array_key_exists('patientRefusedSignature', $source['denial'] ?? [])
                    ? (bool) $source['denial']['patientRefusedSignature']
                    : false,
                'notes' => self::trimString($source['denial']['notes'] ?? ''),
            ],
            'revocation' => [
                'revokedAt' => self::trimString($source['revocation']['revokedAt'] ?? ''),
                'receivedBy' => self::trimString($source['revocation']['receivedBy'] ?? ''),
                'reason' => self::trimString($source['revocation']['reason'] ?? ''),
                'notes' => self::trimString($source['revocation']['notes'] ?? ''),
            ],
            'patientAttestation' => [
                'name' => self::trimString($source['patientAttestation']['name'] ?? ''),
                'documentNumber' => self::trimString($source['patientAttestation']['documentNumber'] ?? ''),
                'signedAt' => self::trimString($source['patientAttestation']['signedAt'] ?? ''),
                'refusedSignature' => array_key_exists('refusedSignature', $source['patientAttestation'] ?? [])
                    ? (bool) $source['patientAttestation']['refusedSignature']
                    : false,
            ],
            'representativeAttestation' => [
                'name' => self::trimString($source['representativeAttestation']['name'] ?? ''),
                'kinship' => self::trimString($source['representativeAttestation']['kinship'] ?? ''),
                'documentNumber' => self::trimString($source['representativeAttestation']['documentNumber'] ?? ''),
                'phone' => self::trimString($source['representativeAttestation']['phone'] ?? ''),
                'signedAt' => self::trimString($source['representativeAttestation']['signedAt'] ?? ''),
            ],
            'professionalAttestation' => [
                'name' => self::trimString($source['professionalAttestation']['name'] ?? ''),
                'role' => self::trimString($source['professionalAttestation']['role'] ?? 'medico_tratante'),
                'documentNumber' => self::trimString($source['professionalAttestation']['documentNumber'] ?? ''),
                'signedAt' => self::trimString($source['professionalAttestation']['signedAt'] ?? ''),
            ],
            'anesthesiologistAttestation' => [
                'applicable' => array_key_exists('applicable', $source['anesthesiologistAttestation'] ?? [])
                    ? (bool) $source['anesthesiologistAttestation']['applicable']
                    : false,
                'name' => self::trimString($source['anesthesiologistAttestation']['name'] ?? ''),
                'documentNumber' => self::trimString($source['anesthesiologistAttestation']['documentNumber'] ?? ''),
                'signedAt' => self::trimString($source['anesthesiologistAttestation']['signedAt'] ?? ''),
            ],
            'witnessAttestation' => [
                'name' => self::trimString($source['witnessAttestation']['name'] ?? ''),
                'documentNumber' => self::trimString($source['witnessAttestation']['documentNumber'] ?? ''),
                'phone' => self::trimString($source['witnessAttestation']['phone'] ?? ''),
                'signedAt' => self::trimString($source['witnessAttestation']['signedAt'] ?? ''),
            ],
            'history' => $history,
            'createdAt' => self::trimString($source['createdAt'] ?? $now),
            'updatedAt' => self::trimString($source['updatedAt'] ?? $source['createdAt'] ?? $now),
        ];
    }

    public static function normalizeConsentFormSnapshots($items): array
    {
        if (!is_array($items)) {
            return [];
        }

        $normalized = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            $packet = self::normalizeConsentPacket($item);
            $status = self::trimString($item['status'] ?? $packet['status'] ?? 'draft');
            $finalizedAt = self::trimString(
                $item['finalizedAt']
                    ?? ($status === 'accepted'
                        ? ($packet['patientAttestation']['signedAt'] ?? '')
                        : ($status === 'declined'
                            ? ($packet['denial']['declinedAt'] ?? '')
                            : ($packet['revocation']['revokedAt'] ?? '')))
            );
            $normalized[] = array_merge($packet, [
                'snapshotId' => self::trimString($item['snapshotId'] ?? '') !== ''
                    ? self::trimString($item['snapshotId'] ?? '')
                    : self::newOpaqueId('consent-form'),
                'status' => $status !== '' ? $status : 'draft',
                'finalizedAt' => $finalizedAt,
                'snapshotAt' => self::trimString($item['snapshotAt'] ?? $finalizedAt ?? ''),
            ]);
        }

        usort($normalized, static function (array $left, array $right): int {
            return strcmp(
                (string) (($right['finalizedAt'] ?? '') ?: ($right['snapshotAt'] ?? '')),
                (string) (($left['finalizedAt'] ?? '') ?: ($left['snapshotAt'] ?? ''))
            );
        });

        return array_values($normalized);
    }

    public static function syncConsentArtifacts(array $draft, array $session = []): array
    {
        $draft = self::defaultDraft($session, $draft);
        $legacyConsent = self::normalizeConsentRecord(
            isset($draft['consent']) && is_array($draft['consent']) ? $draft['consent'] : []
        );
        $packets = self::normalizeConsentPackets($draft['consentPackets'] ?? []);

        if ($packets === [] && self::consentRecordHasSubstantiveContent($legacyConsent)) {
            $packets[] = self::buildLegacyConsentPacketFromRecord($legacyConsent, $draft, $session);
        }

        $hydrated = [];
        foreach ($packets as $packet) {
            $hydrated[] = self::hydrateConsentPacketContext($packet, $draft, $session);
        }
        $packets = array_values($hydrated);

        $activeConsentPacketId = self::trimString($draft['activeConsentPacketId'] ?? '');
        if ($activeConsentPacketId === '' && $packets !== []) {
            $activeConsentPacketId = self::trimString($packets[0]['packetId'] ?? '');
        }
        $activePacket = null;
        foreach ($packets as $packet) {
            if (self::trimString($packet['packetId'] ?? '') === $activeConsentPacketId) {
                $activePacket = $packet;
                break;
            }
        }
        if ($activePacket === null && $packets !== []) {
            $activePacket = $packets[0];
            $activeConsentPacketId = self::trimString($activePacket['packetId'] ?? '');
        }

        $documents = self::normalizeClinicalDocuments(
            isset($draft['documents']) && is_array($draft['documents']) ? $draft['documents'] : []
        );
        $documents['consentForms'] = self::ensureConsentFormSnapshots(
            $documents['consentForms'] ?? [],
            $packets
        );

        $draft['documents'] = $documents;
        $draft['consentPackets'] = $packets;
        $draft['activeConsentPacketId'] = $activeConsentPacketId;
        $draft['consent'] = self::buildConsentRecordFromPacket($activePacket, $legacyConsent);

        return $draft;
    }

    public static function applyConsentBridgePatch(array $draft, array $consentPatch, array $session = []): array
    {
        $draft = self::syncConsentArtifacts($draft, $session);
        $draft['consent'] = self::normalizeConsentRecord(array_merge(
            isset($draft['consent']) && is_array($draft['consent']) ? $draft['consent'] : [],
            $consentPatch
        ));

        $packets = self::normalizeConsentPackets($draft['consentPackets'] ?? []);
        $activeId = self::trimString($draft['activeConsentPacketId'] ?? '');
        if ($packets === []) {
            $packets[] = self::buildLegacyConsentPacketFromRecord($draft['consent'], $draft, $session);
            $activeId = self::trimString($packets[0]['packetId'] ?? '');
        }

        foreach ($packets as $index => $packet) {
            if (self::trimString($packet['packetId'] ?? '') !== $activeId) {
                continue;
            }

            $patched = $packet;
            $patched['writtenRequired'] = (bool) ($draft['consent']['required'] ?? false);
            $patched['privateCommunicationConfirmed'] = (bool) ($draft['consent']['privateCommunicationConfirmed'] ?? false);
            $patched['companionShareAuthorized'] = (bool) ($draft['consent']['companionShareAuthorized'] ?? false);
            $patched['professionalAttestation']['name'] = self::trimString(
                $draft['consent']['informedBy'] ?? $patched['professionalAttestation']['name'] ?? ''
            );
            $patched['declaration']['declaredAt'] = self::trimString(
                $draft['consent']['informedAt'] ?? $patched['declaration']['declaredAt'] ?? ''
            );
            $patched['declaration']['capacityAssessment'] = self::trimString(
                $draft['consent']['capacityAssessment'] ?? $patched['declaration']['capacityAssessment'] ?? ''
            );
            $patched['procedureWhatIsIt'] = self::trimString(
                $draft['consent']['explainedWhat'] ?? $patched['procedureWhatIsIt'] ?? ''
            );
            $patched['frequentRisks'] = self::trimString(
                $draft['consent']['risksExplained'] ?? $patched['frequentRisks'] ?? ''
            );
            $patched['alternatives'] = self::trimString(
                $draft['consent']['alternativesExplained'] ?? $patched['alternatives'] ?? ''
            );
            $patched['status'] = self::trimString($draft['consent']['status'] ?? $patched['status'] ?? 'draft') ?: 'draft';
            if (self::trimString($draft['consent']['acceptedAt'] ?? '') !== '') {
                $patched['patientAttestation']['signedAt'] = self::trimString($draft['consent']['acceptedAt'] ?? '');
            }
            if (self::trimString($draft['consent']['declinedAt'] ?? '') !== '') {
                $patched['denial']['declinedAt'] = self::trimString($draft['consent']['declinedAt'] ?? '');
            }
            if (self::trimString($draft['consent']['revokedAt'] ?? '') !== '') {
                $patched['revocation']['revokedAt'] = self::trimString($draft['consent']['revokedAt'] ?? '');
            }
            $patched['updatedAt'] = local_date('c');
            $packets[$index] = self::normalizeConsentPacket($patched);
            break;
        }

        $draft['consentPackets'] = $packets;
        $draft['activeConsentPacketId'] = $activeId;

        return self::syncConsentArtifacts($draft, $session);
    }

    public static function normalizeHcu005Draft(array $draft): array
    {
        $sectionSeed = isset($draft['hcu005']) && is_array($draft['hcu005'])
            ? $draft['hcu005']
            : $draft;

        return array_merge(
            self::normalizeHcu005Section($sectionSeed, [
                'evolutionNote' => self::trimString($draft['resumen'] ?? $draft['resumenClinico'] ?? ''),
                'diagnosticImpression' => implode(', ', self::normalizeStringList($draft['cie10Sugeridos'] ?? [])),
                'therapeuticPlan' => self::trimString($draft['tratamientoBorrador'] ?? ''),
                'careIndications' => self::trimString(
                    is_array($draft['posologiaBorrador'] ?? null)
                        ? ($draft['posologiaBorrador']['texto'] ?? '')
                        : ''
                ),
            ]),
            [
                'prescriptionItems' => self::normalizePrescriptionItems(
                    $sectionSeed['prescriptionItems'] ?? $draft['prescriptionItems'] ?? []
                ),
            ]
        );
    }

    public static function normalizeHcu005Section(array $section, array $fallback = []): array
    {
        $source = array_merge($fallback, $section);

        return [
            'evolutionNote' => self::trimString($source['evolutionNote'] ?? ''),
            'diagnosticImpression' => self::trimString($source['diagnosticImpression'] ?? ''),
            'therapeuticPlan' => self::trimString($source['therapeuticPlan'] ?? ''),
            'careIndications' => self::trimString($source['careIndications'] ?? ''),
        ];
    }

    public static function normalizePrescriptionItems($items): array
    {
        if (!is_array($items)) {
            return [];
        }

        $normalized = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            $normalized[] = self::normalizePrescriptionItem($item);
        }

        return array_values($normalized);
    }

    public static function normalizePrescriptionItem(array $item): array
    {
        return [
            'medication' => self::trimString($item['medication'] ?? ''),
            'presentation' => self::trimString($item['presentation'] ?? ''),
            'dose' => self::trimString($item['dose'] ?? ''),
            'route' => self::trimString($item['route'] ?? ''),
            'frequency' => self::trimString($item['frequency'] ?? ''),
            'duration' => self::trimString($item['duration'] ?? ''),
            'quantity' => self::trimString($item['quantity'] ?? ''),
            'instructions' => self::trimString($item['instructions'] ?? ''),
        ];
    }

    public static function evaluateHcu005(array $hcu005): array
    {
        $normalized = self::normalizeHcu005Draft($hcu005);
        $items = self::normalizePrescriptionItems($normalized['prescriptionItems'] ?? []);
        $startedItems = array_values(array_filter($items, static fn (array $item): bool => self::prescriptionItemIsStarted($item)));
        $incompleteItems = array_values(array_filter($startedItems, static fn (array $item): bool => !self::prescriptionItemIsComplete($item)));

        $hasEvolution = self::trimString($normalized['evolutionNote'] ?? '') !== '';
        $hasDiagnostic = self::trimString($normalized['diagnosticImpression'] ?? '') !== '';
        $hasPlanOrCare =
            self::trimString($normalized['therapeuticPlan'] ?? '') !== ''
            || self::trimString($normalized['careIndications'] ?? '') !== '';
        $hasAnyContent = $hasEvolution || $hasDiagnostic || $hasPlanOrCare || $startedItems !== [];

        $status = 'missing';
        if ($hasAnyContent) {
            $status = ($hasEvolution && $hasDiagnostic && $hasPlanOrCare && $incompleteItems === [])
                ? 'complete'
                : 'partial';
        }

        return [
            'status' => $status,
            'hasAnyContent' => $hasAnyContent,
            'hasEvolutionNote' => $hasEvolution,
            'hasDiagnosticImpression' => $hasDiagnostic,
            'hasPlanOrCare' => $hasPlanOrCare,
            'startedPrescriptionItems' => count($startedItems),
            'incompletePrescriptionItems' => count($incompleteItems),
            'incompletePrescriptionDetails' => array_values($incompleteItems),
        ];
    }

    public static function normalizeAdmission001(
        array $admission,
        array $patient = [],
        array $intake = [],
        array $options = []
    ): array {
        $facts = self::normalizePatientFacts($intake['datosPaciente'] ?? []);
        $normalizedPatient = self::normalizePatient($patient);
        $identitySource = isset($admission['identity']) && is_array($admission['identity'])
            ? $admission['identity']
            : [];
        $demographicsSource = isset($admission['demographics']) && is_array($admission['demographics'])
            ? $admission['demographics']
            : [];
        $residenceSource = isset($admission['residence']) && is_array($admission['residence'])
            ? $admission['residence']
            : [];
        $coverageSource = isset($admission['coverage']) && is_array($admission['coverage'])
            ? $admission['coverage']
            : [];
        $referralSource = isset($admission['referral']) && is_array($admission['referral'])
            ? $admission['referral']
            : [];
        $emergencySource = isset($admission['emergencyContact']) && is_array($admission['emergencyContact'])
            ? $admission['emergencyContact']
            : [];
        $metaSource = isset($admission['admissionMeta']) && is_array($admission['admissionMeta'])
            ? $admission['admissionMeta']
            : [];
        $historySource = isset($admission['history']) && is_array($admission['history'])
            ? $admission['history']
            : [];

        $transitionMode = self::trimString(
            $metaSource['transitionMode'] ?? $options['transitionMode'] ?? ''
        );
        if (!in_array($transitionMode, ['new_required', 'legacy_inferred'], true)) {
            $transitionMode = 'legacy_inferred';
        }

        $documentType = self::trimString(
            $identitySource['documentType']
                ?? $normalizedPatient['documentType']
                ?? 'cedula'
        );
        if (!in_array($documentType, ['cedula', 'passport', 'other'], true)) {
            $documentType = 'cedula';
        }

        $birthDate = self::trimString(
            $demographicsSource['birthDate']
                ?? $facts['fechaNacimiento']
                ?? $normalizedPatient['birthDate']
                ?? ''
        );
        $ageYears = self::nullablePositiveInt(
            $demographicsSource['ageYears']
                ?? $facts['edadAnios']
                ?? $normalizedPatient['ageYears']
                ?? self::deriveAgeYearsFromBirthDate($birthDate)
        );

        return [
            'identity' => [
                'documentType' => $documentType,
                'documentNumber' => self::trimString(
                    $identitySource['documentNumber']
                        ?? $normalizedPatient['documentNumber']
                        ?? ''
                ),
                'apellidoPaterno' => self::trimString($identitySource['apellidoPaterno'] ?? ''),
                'apellidoMaterno' => self::trimString($identitySource['apellidoMaterno'] ?? ''),
                'primerNombre' => self::trimString($identitySource['primerNombre'] ?? ''),
                'segundoNombre' => self::trimString($identitySource['segundoNombre'] ?? ''),
            ],
            'demographics' => [
                'birthDate' => $birthDate,
                'ageYears' => $ageYears,
                'sexAtBirth' => self::trimString(
                    $demographicsSource['sexAtBirth']
                        ?? $facts['sexoBiologico']
                        ?? $normalizedPatient['sexAtBirth']
                        ?? ''
                ),
                'maritalStatus' => self::trimString($demographicsSource['maritalStatus'] ?? ''),
                'educationLevel' => self::trimString($demographicsSource['educationLevel'] ?? ''),
                'occupation' => self::trimString($demographicsSource['occupation'] ?? ''),
                'employer' => self::trimString($demographicsSource['employer'] ?? ''),
                'nationalityCountry' => self::trimString($demographicsSource['nationalityCountry'] ?? ''),
                'culturalGroup' => self::trimString($demographicsSource['culturalGroup'] ?? ''),
                'birthPlace' => self::trimString($demographicsSource['birthPlace'] ?? ''),
            ],
            'residence' => [
                'addressLine' => self::trimString($residenceSource['addressLine'] ?? ''),
                'neighborhood' => self::trimString($residenceSource['neighborhood'] ?? ''),
                'zoneType' => self::trimString($residenceSource['zoneType'] ?? ''),
                'parish' => self::trimString($residenceSource['parish'] ?? ''),
                'canton' => self::trimString($residenceSource['canton'] ?? ''),
                'province' => self::trimString($residenceSource['province'] ?? ''),
                'phone' => self::trimString(
                    $residenceSource['phone']
                        ?? $facts['telefono']
                        ?? $normalizedPatient['phone']
                        ?? ''
                ),
            ],
            'coverage' => [
                'healthInsuranceType' => self::trimString($coverageSource['healthInsuranceType'] ?? ''),
            ],
            'referral' => [
                'referredBy' => self::trimString($referralSource['referredBy'] ?? ''),
            ],
            'emergencyContact' => [
                'name' => self::trimString($emergencySource['name'] ?? ''),
                'kinship' => self::trimString($emergencySource['kinship'] ?? ''),
                'phone' => self::trimString($emergencySource['phone'] ?? ''),
            ],
            'admissionMeta' => [
                'admissionDate' => self::trimString($metaSource['admissionDate'] ?? ''),
                'admissionKind' => self::trimString($metaSource['admissionKind'] ?? ''),
                'admittedBy' => self::trimString($metaSource['admittedBy'] ?? ''),
                'transitionMode' => $transitionMode,
            ],
            'history' => [
                'admissionHistory' => self::normalizeAdmissionHistory(
                    $historySource['admissionHistory'] ?? $admission['admissionHistory'] ?? []
                ),
                'changeLog' => self::normalizeAdmissionChangeLog(
                    $historySource['changeLog'] ?? $admission['changeLog'] ?? []
                ),
            ],
        ];
    }

    public static function normalizeAdmissionHistory($history): array
    {
        if (!is_array($history)) {
            return [];
        }

        $normalized = [];
        foreach ($history as $item) {
            if (!is_array($item)) {
                continue;
            }
            $normalized[] = [
                'entryId' => self::trimString($item['entryId'] ?? self::newOpaqueId('adm')),
                'episodeId' => self::trimString($item['episodeId'] ?? ''),
                'caseId' => self::trimString($item['caseId'] ?? ''),
                'admissionDate' => self::trimString($item['admissionDate'] ?? ''),
                'admissionKind' => self::trimString($item['admissionKind'] ?? ''),
                'admittedBy' => self::trimString($item['admittedBy'] ?? ''),
                'createdAt' => self::trimString($item['createdAt'] ?? $item['admissionDate'] ?? ''),
            ];
        }

        return array_values($normalized);
    }

    public static function normalizeAdmissionChangeLog($changeLog): array
    {
        if (!is_array($changeLog)) {
            return [];
        }

        $normalized = [];
        foreach ($changeLog as $item) {
            if (!is_array($item)) {
                continue;
            }
            $normalized[] = [
                'changeId' => self::trimString($item['changeId'] ?? self::newOpaqueId('admchg')),
                'actor' => self::trimString($item['actor'] ?? ''),
                'actorRole' => self::trimString($item['actorRole'] ?? ''),
                'changedAt' => self::trimString($item['changedAt'] ?? $item['createdAt'] ?? ''),
                'fields' => self::normalizeStringList($item['fields'] ?? []),
                'summary' => self::trimString($item['summary'] ?? ''),
            ];
        }

        return array_values($normalized);
    }

    public static function evaluateHcu001(array $admission, array $context = []): array
    {
        $normalized = self::normalizeAdmission001(
            $admission,
            isset($context['patient']) && is_array($context['patient']) ? $context['patient'] : [],
            isset($context['intake']) && is_array($context['intake']) ? $context['intake'] : [],
            isset($context['draft']) && is_array($context['draft']) ? ['draft' => $context['draft']] : []
        );
        $identity = $normalized['identity'];
        $demographics = $normalized['demographics'];
        $residence = $normalized['residence'];
        $coverage = $normalized['coverage'];
        $emergencyContact = $normalized['emergencyContact'];
        $meta = $normalized['admissionMeta'];

        $hasResidence = self::trimString($residence['addressLine'] ?? '') !== ''
            || self::trimString($residence['neighborhood'] ?? '') !== ''
            || self::trimString($residence['parish'] ?? '') !== ''
            || self::trimString($residence['canton'] ?? '') !== ''
            || self::trimString($residence['province'] ?? '') !== '';
        $hasIdentity = self::trimString($identity['documentNumber'] ?? '') !== ''
            && self::trimString($identity['primerNombre'] ?? '') !== ''
            && self::trimString($identity['apellidoPaterno'] ?? '') !== '';
        $hasBirthReference = self::trimString($demographics['birthDate'] ?? '') !== ''
            || self::nullablePositiveInt($demographics['ageYears'] ?? null) !== null;
        $hasSex = self::trimString($demographics['sexAtBirth'] ?? '') !== '';
        $hasResidenceContact = self::trimString($residence['phone'] ?? '') !== '' && $hasResidence;
        $hasInsurance = self::trimString($coverage['healthInsuranceType'] ?? '') !== '';
        $hasEmergency = self::trimString($emergencyContact['name'] ?? '') !== ''
            && self::trimString($emergencyContact['phone'] ?? '') !== '';
        $hasAdmissionDate = self::trimString($meta['admissionDate'] ?? '') !== '';
        $hasAdmissionKind = in_array(
            self::trimString($meta['admissionKind'] ?? ''),
            ['first', 'subsequent'],
            true
        );

        $complete = $hasIdentity
            && $hasBirthReference
            && $hasSex
            && $hasResidenceContact
            && $hasInsurance
            && $hasEmergency
            && $hasAdmissionDate
            && $hasAdmissionKind;

        $patient = self::normalizePatient(
            isset($context['patient']) && is_array($context['patient']) ? $context['patient'] : []
        );
        $intake = isset($context['intake']) && is_array($context['intake']) ? $context['intake'] : [];
        $legacySignals = self::trimString($patient['name'] ?? '') !== ''
            || self::trimString($patient['phone'] ?? '') !== ''
            || self::nullablePositiveInt($patient['ageYears'] ?? null) !== null
            || self::trimString($patient['sexAtBirth'] ?? '') !== ''
            || self::trimString($intake['motivoConsulta'] ?? '') !== ''
            || self::trimString($intake['resumenClinico'] ?? '') !== '';
        $explicitContent = $complete
            || self::trimString($identity['apellidoMaterno'] ?? '') !== ''
            || self::trimString($identity['segundoNombre'] ?? '') !== ''
            || self::trimString($demographics['maritalStatus'] ?? '') !== ''
            || self::trimString($demographics['educationLevel'] ?? '') !== ''
            || self::trimString($demographics['occupation'] ?? '') !== ''
            || self::trimString($demographics['employer'] ?? '') !== ''
            || self::trimString($demographics['nationalityCountry'] ?? '') !== ''
            || self::trimString($demographics['culturalGroup'] ?? '') !== ''
            || self::trimString($demographics['birthPlace'] ?? '') !== ''
            || self::trimString($residence['zoneType'] ?? '') !== ''
            || self::trimString($residence['phone'] ?? '') !== ''
            || self::normalizeAdmissionHistory($normalized['history']['admissionHistory'] ?? []) !== [];
        $transitionMode = self::trimString($meta['transitionMode'] ?? 'legacy_inferred');
        $legacyPartial = !$complete
            && $transitionMode !== 'new_required'
            && ($legacySignals || $explicitContent);

        $missingCoreFields = [];
        if (!$hasIdentity) {
            $missingCoreFields[] = 'identity';
        }
        if (!$hasAdmissionDate) {
            $missingCoreFields[] = 'admission_date';
        }
        if (!$hasAdmissionKind) {
            $missingCoreFields[] = 'admission_kind';
        }
        if (!$hasSex) {
            $missingCoreFields[] = 'sex_at_birth';
        }
        if (!$hasBirthReference) {
            $missingCoreFields[] = 'birth_reference';
        }
        if (!$hasResidenceContact) {
            $missingCoreFields[] = 'residence_contact';
        }
        if (!$hasInsurance) {
            $missingCoreFields[] = 'health_insurance_type';
        }
        if (!$hasEmergency) {
            $missingCoreFields[] = 'emergency_contact';
        }

        return [
            'status' => $complete
                ? 'complete'
                : ($legacyPartial ? 'legacy_partial' : ($explicitContent ? 'partial' : 'missing')),
            'missingCoreFields' => $missingCoreFields,
            'blocksApproval' => !$complete && !$legacyPartial,
            'transitionMode' => $transitionMode,
        ];
    }

    public static function buildPatientMirrorFromAdmission(array $patient, array $admission, array $intake = []): array
    {
        $normalizedPatient = self::normalizePatient($patient);
        $normalizedAdmission = self::normalizeAdmission001($admission, $patient, $intake);
        $legalName = self::buildAdmissionLegalName($normalizedAdmission, $normalizedPatient);

        return array_merge($normalizedPatient, [
            'name' => $legalName !== '' ? $legalName : self::trimString($normalizedPatient['name'] ?? ''),
            'phone' => self::trimString($normalizedAdmission['residence']['phone'] ?? $normalizedPatient['phone'] ?? ''),
            'ageYears' => self::nullablePositiveInt(
                $normalizedAdmission['demographics']['ageYears'] ?? $normalizedPatient['ageYears'] ?? null
            ),
            'sexAtBirth' => self::trimString(
                $normalizedAdmission['demographics']['sexAtBirth'] ?? $normalizedPatient['sexAtBirth'] ?? ''
            ),
            'birthDate' => self::trimString($normalizedAdmission['demographics']['birthDate'] ?? ''),
            'documentType' => self::trimString($normalizedAdmission['identity']['documentType'] ?? ''),
            'documentNumber' => self::trimString($normalizedAdmission['identity']['documentNumber'] ?? ''),
            'legalName' => $legalName,
        ]);
    }

    public static function buildPatientFactsMirrorFromAdmission(array $facts, array $admission): array
    {
        $normalizedFacts = self::normalizePatientFacts($facts);
        $normalizedAdmission = self::normalizeAdmission001($admission);

        return array_merge($normalizedFacts, [
            'edadAnios' => self::nullablePositiveInt(
                $normalizedAdmission['demographics']['ageYears'] ?? $normalizedFacts['edadAnios'] ?? null
            ),
            'sexoBiologico' => self::trimString(
                $normalizedAdmission['demographics']['sexAtBirth'] ?? $normalizedFacts['sexoBiologico'] ?? ''
            ),
            'telefono' => self::trimString(
                $normalizedAdmission['residence']['phone'] ?? $normalizedFacts['telefono'] ?? ''
            ),
            'fechaNacimiento' => self::trimString(
                $normalizedAdmission['demographics']['birthDate'] ?? $normalizedFacts['fechaNacimiento'] ?? ''
            ),
        ]);
    }

    public static function buildAdmissionLegalName(array $admission, array $patient = []): string
    {
        $normalized = self::normalizeAdmission001($admission, $patient);
        $identity = $normalized['identity'];
        $legalName = trim(implode(' ', array_filter([
            self::trimString($identity['primerNombre'] ?? ''),
            self::trimString($identity['segundoNombre'] ?? ''),
            self::trimString($identity['apellidoPaterno'] ?? ''),
            self::trimString($identity['apellidoMaterno'] ?? ''),
        ])));

        if ($legalName !== '') {
            return $legalName;
        }

        return self::trimString($patient['name'] ?? '');
    }

    public static function prescriptionItemIsStarted(array $item): bool
    {
        foreach (self::normalizePrescriptionItem($item) as $value) {
            if (self::trimString($value) !== '') {
                return true;
            }
        }

        return false;
    }

    public static function prescriptionItemIsComplete(array $item): bool
    {
        foreach (self::normalizePrescriptionItem($item) as $value) {
            if (self::trimString($value) === '') {
                return false;
            }
        }

        return true;
    }

    public static function renderHcu005Summary(array $section): string
    {
        $normalized = self::normalizeHcu005Section($section);
        if ($normalized['diagnosticImpression'] !== '') {
            return $normalized['diagnosticImpression'];
        }
        if ($normalized['evolutionNote'] !== '') {
            return $normalized['evolutionNote'];
        }

        return implode(' | ', array_filter([
            $normalized['therapeuticPlan'],
            $normalized['careIndications'],
        ]));
    }

    public static function renderHcu005Content(array $section): string
    {
        $normalized = self::normalizeHcu005Section($section);
        $lines = [
            self::trimString($normalized['evolutionNote']) !== ''
                ? 'Evolucion clinica: ' . $normalized['evolutionNote']
                : '',
            self::trimString($normalized['diagnosticImpression']) !== ''
                ? 'Impresion diagnostica: ' . $normalized['diagnosticImpression']
                : '',
            self::trimString($normalized['therapeuticPlan']) !== ''
                ? 'Plan terapeutico: ' . $normalized['therapeuticPlan']
                : '',
            self::trimString($normalized['careIndications']) !== ''
                ? 'Indicaciones / cuidados: ' . $normalized['careIndications']
                : '',
        ];

        return trim(implode("\n", array_filter($lines, static fn ($line): bool => is_string($line) && trim($line) !== '')));
    }

    public static function renderPrescriptionMedicationMirror(array $items): string
    {
        $labels = [];
        foreach (self::normalizePrescriptionItems($items) as $item) {
            if (!self::prescriptionItemIsStarted($item)) {
                continue;
            }
            $labels[] = trim(implode(' ', array_filter([
                $item['medication'],
                $item['presentation'],
            ])));
        }

        return trim(implode("\n", array_filter($labels, static fn ($value): bool => self::trimString($value) !== '')));
    }

    public static function renderPrescriptionDirectionsMirror(array $items): string
    {
        $lines = [];
        foreach (self::normalizePrescriptionItems($items) as $item) {
            if (!self::prescriptionItemIsStarted($item)) {
                continue;
            }

            $segments = array_filter([
                self::trimString($item['dose'] ?? ''),
                self::trimString($item['route'] ?? ''),
                self::trimString($item['frequency'] ?? ''),
                self::trimString($item['duration'] ?? ''),
                self::trimString($item['quantity'] ?? '') !== ''
                    ? 'Cantidad ' . self::trimString($item['quantity'] ?? '')
                    : '',
            ], static fn ($value): bool => self::trimString((string) $value) !== '');

            $instructions = self::trimString($item['instructions'] ?? '');
            $medication = self::trimString($item['medication'] ?? '');
            $line = $medication !== '' ? $medication . ': ' : '';
            $line .= implode(' • ', $segments);
            if ($instructions !== '') {
                $line = trim($line) !== ''
                    ? trim($line) . '. ' . $instructions
                    : $instructions;
            }
            $lines[] = trim($line);
        }

        return trim(implode("\n", array_filter($lines, static fn ($value): bool => self::trimString($value) !== '')));
    }

    public static function normalizeConsentRecord(array $consent): array
    {
        $status = self::trimString($consent['status'] ?? 'not_required');
        if ($status === '') {
            $status = 'not_required';
        }

        return [
            'required' => array_key_exists('required', $consent)
                ? (bool) $consent['required']
                : false,
            'status' => $status,
            'informedBy' => self::trimString($consent['informedBy'] ?? ''),
            'informedAt' => self::trimString($consent['informedAt'] ?? ''),
            'explainedWhat' => self::trimString($consent['explainedWhat'] ?? ''),
            'risksExplained' => self::trimString($consent['risksExplained'] ?? ''),
            'alternativesExplained' => self::trimString($consent['alternativesExplained'] ?? ''),
            'capacityAssessment' => self::trimString($consent['capacityAssessment'] ?? ''),
            'privateCommunicationConfirmed' => array_key_exists('privateCommunicationConfirmed', $consent)
                ? (bool) $consent['privateCommunicationConfirmed']
                : false,
            'companionShareAuthorized' => array_key_exists('companionShareAuthorized', $consent)
                ? (bool) $consent['companionShareAuthorized']
                : false,
            'acceptedAt' => self::trimString($consent['acceptedAt'] ?? ''),
            'declinedAt' => self::trimString($consent['declinedAt'] ?? ''),
            'revokedAt' => self::trimString($consent['revokedAt'] ?? ''),
            'notes' => self::trimString($consent['notes'] ?? ''),
        ];
    }

    public static function buildConsentRecordFromPacket(?array $packet, array $fallback = []): array
    {
        $base = self::normalizeConsentRecord($fallback);
        if ($packet === null) {
            return $base;
        }

        $normalizedPacket = self::normalizeConsentPacket($packet);
        $status = self::trimString($normalizedPacket['status'] ?? 'draft');
        $required = (bool) ($normalizedPacket['writtenRequired'] ?? true);

        return self::normalizeConsentRecord(array_merge($base, [
            'required' => $required,
            'status' => $required ? ($status !== '' ? $status : 'draft') : 'not_required',
            'informedBy' => self::trimString($normalizedPacket['professionalAttestation']['name'] ?? ''),
            'informedAt' => self::trimString($normalizedPacket['declaration']['declaredAt'] ?? ''),
            'explainedWhat' => self::trimString($normalizedPacket['procedureWhatIsIt'] ?? ''),
            'risksExplained' => self::trimString($normalizedPacket['frequentRisks'] ?? ''),
            'alternativesExplained' => self::trimString($normalizedPacket['alternatives'] ?? ''),
            'capacityAssessment' => self::trimString($normalizedPacket['declaration']['capacityAssessment'] ?? ''),
            'privateCommunicationConfirmed' => (bool) ($normalizedPacket['privateCommunicationConfirmed'] ?? false),
            'companionShareAuthorized' => (bool) ($normalizedPacket['companionShareAuthorized'] ?? false),
            'acceptedAt' => self::trimString(
                $normalizedPacket['patientAttestation']['signedAt']
                    ?? $normalizedPacket['representativeAttestation']['signedAt']
                    ?? ''
            ),
            'declinedAt' => self::trimString($normalizedPacket['denial']['declinedAt'] ?? ''),
            'revokedAt' => self::trimString($normalizedPacket['revocation']['revokedAt'] ?? ''),
            'notes' => self::trimString(
                $normalizedPacket['declaration']['notes'] ?? $normalizedPacket['denial']['notes'] ?? $normalizedPacket['revocation']['notes'] ?? ''
            ),
        ]));
    }

    public static function evaluateConsentPacket(array $packet): array
    {
        $normalized = self::normalizeConsentPacket($packet);
        $status = self::trimString($normalized['status'] ?? 'draft');
        $patientCanConsent = (bool) ($normalized['declaration']['patientCanConsent'] ?? true);
        $anesthesiologistApplicable = (bool) ($normalized['anesthesiologistAttestation']['applicable'] ?? false);
        $legacyBridge = self::trimString($normalized['sourceMode'] ?? '') === 'legacy_bridge'
            || self::trimString($normalized['templateKey'] ?? '') === 'legacy-bridge';

        $missing = [];
        if (self::trimString($normalized['title'] ?? '') === '') {
            $missing[] = 'title';
        }
        if (self::trimString($normalized['establishmentLabel'] ?? '') === '') {
            $missing[] = 'establishment';
        }
        if (self::trimString($normalized['serviceLabel'] ?? '') === '') {
            $missing[] = 'service';
        }
        if (self::trimString($normalized['encounterDateTime'] ?? '') === '') {
            $missing[] = 'encounter_datetime';
        }
        if (self::trimString($normalized['patientRecordId'] ?? '') === '') {
            $missing[] = 'record_id';
        }
        if (self::trimString($normalized['patientName'] ?? '') === '') {
            $missing[] = 'patient_name';
        }
        if (self::trimString($normalized['patientDocumentNumber'] ?? '') === '') {
            $missing[] = 'patient_document';
        }
        if (self::trimString($normalized['diagnosisLabel'] ?? '') === '') {
            $missing[] = 'diagnosis';
        }
        if (self::trimString($normalized['procedureName'] ?? '') === '') {
            $missing[] = 'procedure_name';
        }
        if (self::trimString($normalized['procedureWhatIsIt'] ?? '') === '') {
            $missing[] = 'procedure_what_is_it';
        }
        if (self::trimString($normalized['procedureHowItIsDone'] ?? '') === '') {
            $missing[] = 'procedure_how';
        }
        if (self::trimString($normalized['durationEstimate'] ?? '') === '' && !$legacyBridge) {
            $missing[] = 'duration';
        }
        if (self::trimString($normalized['benefits'] ?? '') === '' && !$legacyBridge) {
            $missing[] = 'benefits';
        }
        if (self::trimString($normalized['frequentRisks'] ?? '') === '') {
            $missing[] = 'frequent_risks';
        }
        if (self::trimString($normalized['rareSeriousRisks'] ?? '') === '' && !$legacyBridge) {
            $missing[] = 'rare_serious_risks';
        }
        if (self::trimString($normalized['patientSpecificRisks'] ?? '') === '' && !$legacyBridge) {
            $missing[] = 'patient_specific_risks';
        }
        if (self::trimString($normalized['alternatives'] ?? '') === '') {
            $missing[] = 'alternatives';
        }
        if (self::trimString($normalized['postProcedureCare'] ?? '') === '' && !$legacyBridge) {
            $missing[] = 'post_procedure_care';
        }
        if (self::trimString($normalized['noProcedureConsequences'] ?? '') === '' && !$legacyBridge) {
            $missing[] = 'no_procedure_consequences';
        }
        if (self::trimString($normalized['professionalAttestation']['name'] ?? '') === '') {
            $missing[] = 'professional_attestation';
        }
        if ($patientCanConsent !== true) {
            if (self::trimString($normalized['representativeAttestation']['name'] ?? '') === '') {
                $missing[] = 'representative_name';
            }
            if (self::trimString($normalized['representativeAttestation']['kinship'] ?? '') === '') {
                $missing[] = 'representative_kinship';
            }
            if (self::trimString($normalized['representativeAttestation']['documentNumber'] ?? '') === '') {
                $missing[] = 'representative_document';
            }
            if (self::trimString($normalized['representativeAttestation']['phone'] ?? '') === '') {
                $missing[] = 'representative_phone';
            }
        }
        if ($anesthesiologistApplicable) {
            if (self::trimString($normalized['anesthesiologistAttestation']['name'] ?? '') === '') {
                $missing[] = 'anesthesiologist_name';
            }
            if (self::trimString($normalized['anesthesiologistAttestation']['documentNumber'] ?? '') === '') {
                $missing[] = 'anesthesiologist_document';
            }
        }

        $readyForDeclaration = $missing === [];
        $effectiveStatus = $readyForDeclaration ? 'ready_for_declaration' : 'incomplete';

        if ($status === 'accepted') {
            $signedAt = self::trimString($normalized['patientAttestation']['signedAt'] ?? '');
            if ($signedAt === '') {
                $signedAt = self::trimString($normalized['representativeAttestation']['signedAt'] ?? '');
            }
            $effectiveStatus = ($readyForDeclaration && $signedAt !== '')
                ? 'accepted'
                : 'incomplete';
        } elseif ($status === 'declined') {
            $witnessRequired = (bool) ($normalized['denial']['patientRefusedSignature'] ?? false);
            $witnessReady = self::trimString($normalized['witnessAttestation']['name'] ?? '') !== ''
                && self::trimString($normalized['witnessAttestation']['documentNumber'] ?? '') !== '';
            $effectiveStatus = (
                self::trimString($normalized['denial']['declinedAt'] ?? '') !== ''
                && (!$witnessRequired || $witnessReady)
            )
                ? 'declined'
                : 'incomplete';
            if ($witnessRequired && !$witnessReady) {
                $missing[] = 'witness_attestation';
            }
        } elseif ($status === 'revoked') {
            $effectiveStatus = (
                self::trimString($normalized['revocation']['revokedAt'] ?? '') !== ''
                && self::trimString($normalized['revocation']['receivedBy'] ?? '') !== ''
            )
                ? 'revoked'
                : 'incomplete';
            if (self::trimString($normalized['revocation']['receivedBy'] ?? '') === '') {
                $missing[] = 'revocation_received_by';
            }
        } elseif ($status === 'draft') {
            $effectiveStatus = $readyForDeclaration ? 'ready_for_declaration' : 'draft';
        }

        return [
            'status' => $effectiveStatus,
            'readyForDeclaration' => $readyForDeclaration,
            'missingFields' => array_values(array_unique($missing)),
        ];
    }

    public static function normalizeApprovalRecord(array $approval): array
    {
        $status = self::trimString($approval['status'] ?? 'pending');
        if ($status === '') {
            $status = 'pending';
        }

        return [
            'status' => $status,
            'approvedBy' => self::trimString($approval['approvedBy'] ?? ''),
            'approvedAt' => self::trimString($approval['approvedAt'] ?? ''),
            'finalDraftVersion' => is_numeric($approval['finalDraftVersion'] ?? null)
                ? max(1, (int) $approval['finalDraftVersion'])
                : null,
            'checklistSnapshot' => isset($approval['checklistSnapshot']) && is_array($approval['checklistSnapshot'])
                ? array_values($approval['checklistSnapshot'])
                : [],
            'aiTraceSnapshot' => isset($approval['aiTraceSnapshot']) && is_array($approval['aiTraceSnapshot'])
                ? $approval['aiTraceSnapshot']
                : [],
            'notes' => self::trimString($approval['notes'] ?? ''),
            'normativeSources' => self::normalizeStringList($approval['normativeSources'] ?? []),
        ];
    }

    public static function normalizeDisclosureLog($items): array
    {
        if (!is_array($items)) {
            return [];
        }

        $normalized = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }

            $disclosureId = self::trimString($item['disclosureId'] ?? $item['id'] ?? '');
            if ($disclosureId === '') {
                $disclosureId = self::newOpaqueId('disclosure');
            }
            $performedAt = self::trimString($item['performedAt'] ?? $item['deliveredAt'] ?? '');
            $targetType = self::trimString($item['targetType'] ?? '');
            if ($targetType === '') {
                $targetType = self::trimString($item['authorizedByConsent'] ?? '') === '1'
                    ? 'companion'
                    : 'patient';
            }

            $normalized[] = [
                'disclosureId' => $disclosureId,
                'id' => $disclosureId,
                'targetType' => $targetType !== '' ? $targetType : 'patient',
                'targetName' => self::trimString($item['targetName'] ?? $item['deliveredTo'] ?? ''),
                'purpose' => self::trimString($item['purpose'] ?? ''),
                'legalBasis' => self::trimString($item['legalBasis'] ?? ''),
                'authorizedByConsent' => array_key_exists('authorizedByConsent', $item)
                    ? (bool) $item['authorizedByConsent']
                    : false,
                'performedBy' => self::trimString($item['performedBy'] ?? $item['requestedBy'] ?? ''),
                'performedAt' => $performedAt,
                'channel' => self::trimString($item['channel'] ?? $item['mode'] ?? ''),
                'notes' => self::trimString($item['notes'] ?? ''),
            ];
        }

        usort($normalized, static function (array $left, array $right): int {
            return strcmp(
                (string) ($right['performedAt'] ?? ''),
                (string) ($left['performedAt'] ?? '')
            );
        });

        return $normalized;
    }

    public static function normalizeCopyRequests($items): array
    {
        if (!is_array($items)) {
            return [];
        }

        $normalized = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }

            $requestId = self::trimString($item['requestId'] ?? $item['id'] ?? '');
            if ($requestId === '') {
                $requestId = self::newOpaqueId('copy');
            }
            $status = self::trimString($item['status'] ?? 'requested');
            if ($status === '') {
                $status = 'requested';
            }

            $normalized[] = [
                'requestId' => $requestId,
                'id' => $requestId,
                'requestedByType' => self::trimString($item['requestedByType'] ?? ''),
                'requestedByName' => self::trimString($item['requestedByName'] ?? $item['requestedBy'] ?? ''),
                'requestedAt' => self::trimString($item['requestedAt'] ?? ''),
                'dueAt' => self::trimString($item['dueAt'] ?? ''),
                'status' => $status,
                'legalBasis' => self::trimString($item['legalBasis'] ?? ''),
                'notes' => self::trimString($item['notes'] ?? ''),
                'deliveredAt' => self::trimString($item['deliveredAt'] ?? ''),
                'deliveryChannel' => self::trimString($item['deliveryChannel'] ?? ''),
                'deliveredTo' => self::trimString($item['deliveredTo'] ?? ''),
            ];
        }

        usort($normalized, static function (array $left, array $right): int {
            $leftStamp = (string) (($left['deliveredAt'] ?? '') ?: ($left['requestedAt'] ?? ''));
            $rightStamp = (string) (($right['deliveredAt'] ?? '') ?: ($right['requestedAt'] ?? ''));
            return strcmp($rightStamp, $leftStamp);
        });

        return $normalized;
    }

    public static function normalizeAccessAuditEntries($items): array
    {
        if (!is_array($items)) {
            return [];
        }

        $normalized = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }

            $normalized[] = self::normalizeAccessAuditEntry($item);
        }

        usort($normalized, static function (array $left, array $right): int {
            return strcmp(
                (string) ($right['createdAt'] ?? ''),
                (string) ($left['createdAt'] ?? '')
            );
        });

        return $normalized;
    }

    public static function normalizeAccessAuditEntry(array $item): array
    {
        return [
            'id' => (int) ($item['id'] ?? 0),
            'auditId' => self::trimString($item['auditId'] ?? '') ?: self::newOpaqueId('audit'),
            'recordId' => self::trimString($item['recordId'] ?? ''),
            'sessionId' => self::trimString($item['sessionId'] ?? ''),
            'episodeId' => self::trimString($item['episodeId'] ?? ''),
            'actor' => self::trimString($item['actor'] ?? ''),
            'actorRole' => self::trimString($item['actorRole'] ?? 'clinician_admin'),
            'action' => self::trimString($item['action'] ?? ''),
            'resource' => self::trimString($item['resource'] ?? 'clinical_record'),
            'reason' => self::trimString($item['reason'] ?? ''),
            'createdAt' => self::trimString($item['createdAt'] ?? local_date('c')),
            'meta' => isset($item['meta']) && is_array($item['meta']) ? $item['meta'] : [],
        ];
    }

    public static function appendAccessAudit(array $store, array $entry): array
    {
        $records = isset($store['clinical_history_access_audits']) && is_array($store['clinical_history_access_audits'])
            ? array_values($store['clinical_history_access_audits'])
            : [];

        $normalized = self::normalizeAccessAuditEntry($entry);
        if (($normalized['id'] ?? 0) <= 0) {
            $normalized['id'] = self::nextId($records);
        }

        $records[] = $normalized;
        $store['clinical_history_access_audits'] = array_values($records);
        return $store;
    }

    public static function findAccessAuditForRecord(array $store, string $recordId, string $sessionId): array
    {
        $records = isset($store['clinical_history_access_audits']) && is_array($store['clinical_history_access_audits'])
            ? array_values($store['clinical_history_access_audits'])
            : [];

        $normalizedRecordId = self::trimString($recordId);
        $normalizedSessionId = self::trimString($sessionId);
        $filtered = array_filter($records, static function ($item) use ($normalizedRecordId, $normalizedSessionId): bool {
            if (!is_array($item)) {
                return false;
            }

            $entryRecordId = self::trimString($item['recordId'] ?? '');
            $entrySessionId = self::trimString($item['sessionId'] ?? '');
            if ($normalizedRecordId !== '' && $entryRecordId === $normalizedRecordId) {
                return true;
            }

            return $normalizedSessionId !== '' && $entrySessionId === $normalizedSessionId;
        });

        return self::normalizeAccessAuditEntries(array_values($filtered));
    }

    public static function normalizePatient(array $patient): array
    {
        $normalized = [
            'name' => self::trimString($patient['name'] ?? $patient['fullName'] ?? ''),
            'email' => self::trimString($patient['email'] ?? ''),
            'phone' => self::trimString($patient['phone'] ?? ''),
            'ageYears' => self::nullablePositiveInt($patient['ageYears'] ?? $patient['edadAnios'] ?? null),
            'weightKg' => self::nullableFloat($patient['weightKg'] ?? $patient['pesoKg'] ?? null),
            'sexAtBirth' => self::trimString($patient['sexAtBirth'] ?? $patient['sexoBiologico'] ?? ''),
            'birthDate' => self::trimString($patient['birthDate'] ?? $patient['fechaNacimiento'] ?? ''),
            'documentType' => self::trimString($patient['documentType'] ?? ''),
            'documentNumber' => self::trimString($patient['documentNumber'] ?? ''),
            'legalName' => self::trimString($patient['legalName'] ?? ''),
            'pregnant' => array_key_exists('pregnant', $patient)
                ? (bool) $patient['pregnant']
                : (array_key_exists('embarazo', $patient) ? (bool) $patient['embarazo'] : null),
        ];

        foreach ($normalized as $key => $value) {
            if ($value === null) {
                unset($normalized[$key]);
            }
        }

        return $normalized;
    }

    public static function normalizePatientFacts($facts): array
    {
        $facts = is_array($facts) ? $facts : [];
        return [
            'edadAnios' => self::nullablePositiveInt($facts['edadAnios'] ?? $facts['ageYears'] ?? null),
            'pesoKg' => self::nullableFloat($facts['pesoKg'] ?? $facts['weightKg'] ?? null),
            'sexoBiologico' => self::trimString($facts['sexoBiologico'] ?? $facts['sexAtBirth'] ?? ''),
            'telefono' => self::trimString($facts['telefono'] ?? $facts['phone'] ?? ''),
            'fechaNacimiento' => self::trimString($facts['fechaNacimiento'] ?? $facts['birthDate'] ?? ''),
            'embarazo' => array_key_exists('embarazo', $facts)
                ? (bool) $facts['embarazo']
                : (array_key_exists('pregnant', $facts) ? (bool) $facts['pregnant'] : null),
        ];
    }

    public static function normalizeIntake(array $intake): array
    {
        $defaults = [
            'motivoConsulta' => '',
            'enfermedadActual' => '',
            'antecedentes' => '',
            'antecedentesPersonales' => '',
            'antecedentesFamiliares' => '',
            'alergias' => '',
            'medicacionActual' => '',
            'fototipoFitzpatrick' => '',
            'habitosSol' => '',
            'habitosTabaco' => '',
            'rosRedFlags' => [],
            'adjuntos' => [],
            'resumenClinico' => '',
            'cie10Sugeridos' => [],
            'tratamientoBorrador' => '',
            'posologiaBorrador' => [
                'texto' => '',
                'baseCalculo' => '',
                'pesoKg' => null,
                'edadAnios' => null,
                'units' => '',
                'ambiguous' => true,
            ],
            'preguntasFaltantes' => [],
            'datosPaciente' => [
                'edadAnios' => null,
                'pesoKg' => null,
                'sexoBiologico' => '',
                'telefono' => '',
                'fechaNacimiento' => '',
                'embarazo' => null,
            ],
        ];

        $normalized = $defaults;
        foreach ([
            'motivoConsulta',
            'enfermedadActual',
            'antecedentes',
            'antecedentesPersonales',
            'antecedentesFamiliares',
            'alergias',
            'medicacionActual',
            'fototipoFitzpatrick',
            'habitosSol',
            'habitosTabaco',
            'resumenClinico',
            'tratamientoBorrador',
        ] as $field) {
            $normalized[$field] = self::trimString($intake[$field] ?? $defaults[$field]);
        }
        $normalized['antecedentes'] = self::buildAntecedentesSummary($normalized);

        $normalized['rosRedFlags'] = self::normalizeStringList($intake['rosRedFlags'] ?? []);
        $normalized['cie10Sugeridos'] = self::normalizeStringList($intake['cie10Sugeridos'] ?? []);
        $normalized['preguntasFaltantes'] = self::normalizeStringList($intake['preguntasFaltantes'] ?? []);
        $normalized['adjuntos'] = self::normalizeAttachmentList($intake['adjuntos'] ?? []);
        $normalized['datosPaciente'] = self::normalizePatientFacts($intake['datosPaciente'] ?? []);

        $posologia = isset($intake['posologiaBorrador']) && is_array($intake['posologiaBorrador'])
            ? $intake['posologiaBorrador']
            : [];
        $normalized['posologiaBorrador'] = [
            'texto' => self::trimString($posologia['texto'] ?? ''),
            'baseCalculo' => self::trimString($posologia['baseCalculo'] ?? ''),
            'pesoKg' => self::nullableFloat($posologia['pesoKg'] ?? null),
            'edadAnios' => self::nullablePositiveInt($posologia['edadAnios'] ?? null),
            'units' => self::trimString($posologia['units'] ?? ''),
            'ambiguous' => array_key_exists('ambiguous', $posologia) ? (bool) $posologia['ambiguous'] : true,
        ];

        return $normalized;
    }

    public static function buildAntecedentesSummary(array $intake): string
    {
        $personal = self::trimString($intake['antecedentesPersonales'] ?? '');
        $family = self::trimString($intake['antecedentesFamiliares'] ?? '');
        $summary = [];

        if ($personal !== '') {
            $summary[] = 'Personales: ' . $personal;
        }
        if ($family !== '') {
            $summary[] = 'Familiares: ' . $family;
        }

        if ($summary !== []) {
            return implode("\n", $summary);
        }

        return self::trimString($intake['antecedentes'] ?? '');
    }

    private static function deriveAgeYearsFromBirthDate(string $birthDate): ?int
    {
        $normalized = self::trimString($birthDate);
        if ($normalized === '') {
            return null;
        }

        try {
            $birth = new DateTimeImmutable(substr($normalized, 0, 10));
            $today = new DateTimeImmutable(local_date('Y-m-d'));
            return max(0, (int) $today->diff($birth)->y);
        } catch (Throwable $e) {
            return null;
        }
    }

    public static function normalizeClinicianDraft(array $draft): array
    {
        $posologia = isset($draft['posologiaBorrador']) && is_array($draft['posologiaBorrador'])
            ? $draft['posologiaBorrador']
            : [];
        $hcu005 = self::normalizeHcu005Draft($draft);

        return [
            'resumen' => self::trimString(
                $draft['resumen']
                    ?? $draft['resumenClinico']
                    ?? $hcu005['evolutionNote']
                    ?? ''
            ),
            'preguntasFaltantes' => self::normalizeStringList($draft['preguntasFaltantes'] ?? []),
            'cie10Sugeridos' => self::normalizeStringList($draft['cie10Sugeridos'] ?? []),
            'tratamientoBorrador' => self::trimString(
                $draft['tratamientoBorrador'] ?? $hcu005['therapeuticPlan'] ?? ''
            ),
            'posologiaBorrador' => [
                'texto' => self::trimString(
                    $posologia['texto'] ?? $hcu005['careIndications'] ?? ''
                ),
                'baseCalculo' => self::trimString($posologia['baseCalculo'] ?? ''),
                'pesoKg' => self::nullableFloat($posologia['pesoKg'] ?? null),
                'edadAnios' => self::nullablePositiveInt($posologia['edadAnios'] ?? null),
                'units' => self::trimString($posologia['units'] ?? ''),
                'ambiguous' => array_key_exists('ambiguous', $posologia) ? (bool) $posologia['ambiguous'] : true,
            ],
            'hcu005' => $hcu005,
        ];
    }

    public static function normalizeAttachmentList($attachments): array
    {
        if (!is_array($attachments)) {
            return [];
        }

        $normalized = [];
        foreach ($attachments as $attachment) {
            if (!is_array($attachment)) {
                continue;
            }

            $normalized[] = [
                'id' => self::nullablePositiveInt($attachment['id'] ?? null),
                'kind' => self::trimString($attachment['kind'] ?? ''),
                'originalName' => self::trimString($attachment['originalName'] ?? $attachment['name'] ?? ''),
                'mime' => self::trimString($attachment['mime'] ?? ''),
                'size' => max(0, (int) ($attachment['size'] ?? 0)),
                'privatePath' => self::trimString($attachment['privatePath'] ?? ''),
                'appointmentId' => self::nullablePositiveInt($attachment['appointmentId'] ?? null),
            ];
        }

        return $normalized;
    }

    public static function normalizeTranscript(array $transcript): array
    {
        $normalized = [];
        foreach ($transcript as $message) {
            if (!is_array($message)) {
                continue;
            }
            $normalized[] = self::normalizeTranscriptMessage($message);
        }
        return $normalized;
    }

    public static function normalizeTranscriptMessage(array $message): array
    {
        $now = local_date('c');
        return [
            'id' => self::trimString($message['id'] ?? '') !== ''
                ? self::trimString($message['id'] ?? '')
                : self::newOpaqueId('msg'),
            'role' => self::trimString($message['role'] ?? 'user') !== ''
                ? self::trimString($message['role'] ?? 'user')
                : 'user',
            'actor' => self::trimString($message['actor'] ?? 'patient') !== ''
                ? self::trimString($message['actor'] ?? 'patient')
                : 'patient',
            'content' => self::trimString($message['content'] ?? ''),
            'surface' => self::trimString($message['surface'] ?? ''),
            'createdAt' => self::trimString($message['createdAt'] ?? $now) !== ''
                ? self::trimString($message['createdAt'] ?? $now)
                : $now,
            'clientMessageId' => self::trimString($message['clientMessageId'] ?? ''),
            'fieldKey' => self::trimString($message['fieldKey'] ?? ''),
            'meta' => isset($message['meta']) && is_array($message['meta']) ? $message['meta'] : [],
        ];
    }

    public static function normalizeStringList($items): array
    {
        if (!is_array($items)) {
            return [];
        }

        $normalized = [];
        foreach ($items as $item) {
            $value = self::trimString($item);
            if ($value === '') {
                continue;
            }
            if (!in_array($value, $normalized, true)) {
                $normalized[] = $value;
            }
        }

        return $normalized;
    }

    public static function normalizeConfidence($value): float
    {
        $confidence = is_numeric($value) ? (float) $value : 0.0;
        if ($confidence < 0) {
            $confidence = 0.0;
        }
        if ($confidence > 1) {
            $confidence = 1.0;
        }
        return round($confidence, 4);
    }

    public static function normalizePendingAi(array $pending): array
    {
        $jobId = self::trimString($pending['jobId'] ?? '');
        if ($jobId === '') {
            return [];
        }

        return [
            'jobId' => $jobId,
            'status' => self::trimString($pending['status'] ?? 'queued') !== ''
                ? self::trimString($pending['status'] ?? 'queued')
                : 'queued',
            'messageHash' => self::trimString($pending['messageHash'] ?? ''),
            'clientMessageId' => self::trimString($pending['clientMessageId'] ?? ''),
            'assistantMessageId' => self::trimString($pending['assistantMessageId'] ?? ''),
            'questionFieldKey' => self::trimString($pending['questionFieldKey'] ?? ''),
            'requestedAt' => self::trimString($pending['requestedAt'] ?? ''),
            'updatedAt' => self::trimString($pending['updatedAt'] ?? ''),
            'completedAt' => self::trimString($pending['completedAt'] ?? ''),
            'reason' => self::trimString($pending['reason'] ?? ''),
            'errorCode' => self::trimString($pending['errorCode'] ?? ''),
            'errorMessage' => self::trimString($pending['errorMessage'] ?? ''),
            'pollAfterMs' => is_numeric($pending['pollAfterMs'] ?? null)
                ? max(0, (int) $pending['pollAfterMs'])
                : 0,
        ];
    }

    public static function trimString($value): string
    {
        return is_string($value) ? trim($value) : '';
    }

    public static function nullablePositiveInt($value): ?int
    {
        if (!is_numeric($value)) {
            return null;
        }

        $intValue = (int) $value;
        return $intValue > 0 ? $intValue : null;
    }

    public static function nullableFloat($value): ?float
    {
        if (!is_numeric($value)) {
            return null;
        }

        $floatValue = (float) $value;
        return $floatValue > 0 ? round($floatValue, 2) : null;
    }

    private static function buildLegacyConsentPacketFromRecord(array $consent, array $draft, array $session): array
    {
        $sessionId = self::trimString($draft['sessionId'] ?? $session['sessionId'] ?? '');
        $draftId = self::trimString($draft['draftId'] ?? '');
        $base = self::consentPacketTemplate('legacy-bridge');
        $now = local_date('c');
        $status = self::trimString($consent['status'] ?? 'draft');
        if ($status === 'not_required' && ((bool) ($consent['required'] ?? false))) {
            $status = 'draft';
        }

        return self::normalizeConsentPacket([
            'packetId' => self::stableDerivedId('consent', [$draftId, $sessionId, 'legacy_bridge']),
            'templateKey' => 'legacy-bridge',
            'sourceMode' => 'legacy_bridge',
            'status' => $status !== '' ? $status : 'draft',
            'writtenRequired' => (bool) ($consent['required'] ?? false),
            'procedureWhatIsIt' => self::trimString($consent['explainedWhat'] ?? ''),
            'procedureHowItIsDone' => self::trimString($consent['explainedWhat'] ?? ''),
            'frequentRisks' => self::trimString($consent['risksExplained'] ?? ''),
            'alternatives' => self::trimString($consent['alternativesExplained'] ?? ''),
            'declaration' => [
                'declaredAt' => self::trimString($consent['informedAt'] ?? ''),
                'capacityAssessment' => self::trimString($consent['capacityAssessment'] ?? ''),
                'notes' => self::trimString($consent['notes'] ?? ''),
            ],
            'professionalAttestation' => [
                'name' => self::trimString($consent['informedBy'] ?? ''),
                'role' => 'medico_tratante',
                'signedAt' => self::trimString($consent['informedAt'] ?? ''),
            ],
            'patientAttestation' => [
                'signedAt' => self::trimString($consent['acceptedAt'] ?? ''),
            ],
            'denial' => [
                'declinedAt' => self::trimString($consent['declinedAt'] ?? ''),
                'notes' => self::trimString($consent['notes'] ?? ''),
            ],
            'revocation' => [
                'revokedAt' => self::trimString($consent['revokedAt'] ?? ''),
                'notes' => self::trimString($consent['notes'] ?? ''),
                'receivedBy' => self::trimString($consent['informedBy'] ?? ''),
            ],
            'privateCommunicationConfirmed' => (bool) ($consent['privateCommunicationConfirmed'] ?? false),
            'companionShareAuthorized' => (bool) ($consent['companionShareAuthorized'] ?? false),
            'history' => [[
                'eventId' => self::stableDerivedId('consent-history', [$draftId, $sessionId, 'legacy_bridge_seed']),
                'type' => 'legacy_bridge_seed',
                'status' => $status,
                'actor' => self::trimString($consent['informedBy'] ?? ''),
                'actorRole' => 'legacy_bridge',
                'at' => self::trimString($consent['informedAt'] ?? $consent['acceptedAt'] ?? $now),
                'notes' => 'Consentimiento legacy sincronizado a HCU-024.',
            ]],
            'createdAt' => self::trimString($consent['informedAt'] ?? $consent['acceptedAt'] ?? $now),
            'updatedAt' => $now,
        ], $base);
    }

    private static function hydrateConsentPacketContext(array $packet, array $draft, array $session): array
    {
        $normalized = self::normalizeConsentPacket($packet);
        $sessionPatient = isset($session['patient']) && is_array($session['patient']) ? $session['patient'] : [];
        $draftIntake = isset($draft['intake']) && is_array($draft['intake']) ? $draft['intake'] : [];
        $admission = self::normalizeAdmission001(
            isset($draft['admission001']) && is_array($draft['admission001']) ? $draft['admission001'] : [],
            $sessionPatient,
            $draftIntake,
            ['draft' => $draft]
        );
        $patient = self::buildPatientMirrorFromAdmission($sessionPatient, $admission, $draftIntake);
        $clinicianDraft = self::normalizeClinicianDraft(
            isset($draft['clinicianDraft']) && is_array($draft['clinicianDraft']) ? $draft['clinicianDraft'] : []
        );
        $hcu005 = self::normalizeHcu005Draft($clinicianDraft['hcu005'] ?? []);

        $updated = $normalized;
        if (self::trimString($updated['patientName'] ?? '') === '') {
            $updated['patientName'] = self::buildAdmissionLegalName($admission, $patient);
        }
        if (self::trimString($updated['patientDocumentNumber'] ?? '') === '') {
            $updated['patientDocumentNumber'] = self::trimString($admission['identity']['documentNumber'] ?? '');
        }
        if (self::trimString($updated['patientRecordId'] ?? '') === '') {
            $updated['patientRecordId'] = self::trimString($draft['patientRecordId'] ?? '');
        }
        if (self::trimString($updated['encounterDateTime'] ?? '') === '') {
            $updated['encounterDateTime'] = self::trimString(
                $draft['updatedAt'] ?? $session['updatedAt'] ?? $session['createdAt'] ?? $draft['createdAt'] ?? ''
            );
        }
        if (self::trimString($updated['diagnosisLabel'] ?? '') === '') {
            $updated['diagnosisLabel'] = self::trimString($hcu005['diagnosticImpression'] ?? '');
        }
        if (self::trimString($updated['diagnosisCie10'] ?? '') === '') {
            $updated['diagnosisCie10'] = implode(', ', self::normalizeStringList($clinicianDraft['cie10Sugeridos'] ?? []));
        }
        if (self::trimString($updated['procedureName'] ?? '') === '') {
            $updated['procedureName'] = self::trimString($updated['procedureLabel'] ?? '');
        }
        if (self::trimString($updated['procedureHowItIsDone'] ?? '') === '') {
            $updated['procedureHowItIsDone'] = self::trimString($hcu005['careIndications'] ?? '');
        }
        if (self::trimString($updated['benefits'] ?? '') === '') {
            $updated['benefits'] = self::trimString($hcu005['therapeuticPlan'] ?? '');
        }
        if (self::trimString($updated['professionalAttestation']['name'] ?? '') === '') {
            $updated['professionalAttestation']['name'] = self::trimString($updated['declaration']['notes'] ?? '');
        }
        if (self::trimString($updated['establishmentLabel'] ?? '') === '') {
            $updated['establishmentLabel'] = 'Consultorio privado';
        }
        if (self::trimString($updated['serviceLabel'] ?? '') === '') {
            $updated['serviceLabel'] = 'Dermatologia ambulatoria';
        }
        if (self::trimString($updated['title'] ?? '') === '') {
            $updated['title'] = 'Consentimiento informado HCU-form.024/2008';
        }
        $updated['updatedAt'] = self::trimString($updated['updatedAt'] ?? local_date('c'));

        return self::normalizeConsentPacket($updated);
    }

    private static function hydrateInterconsultationContext(array $interconsultation, array $draft, array $session): array
    {
        $normalized = self::normalizeInterconsultation($interconsultation);
        $sessionPatient = isset($session['patient']) && is_array($session['patient']) ? $session['patient'] : [];
        $draftIntake = isset($draft['intake']) && is_array($draft['intake']) ? $draft['intake'] : [];
        $admission = self::normalizeAdmission001(
            isset($draft['admission001']) && is_array($draft['admission001']) ? $draft['admission001'] : [],
            $sessionPatient,
            $draftIntake,
            ['draft' => $draft]
        );
        $patient = self::buildPatientMirrorFromAdmission($sessionPatient, $admission, $draftIntake);
        $clinicianDraft = self::normalizeClinicianDraft(
            isset($draft['clinicianDraft']) && is_array($draft['clinicianDraft']) ? $draft['clinicianDraft'] : []
        );
        $hcu005 = self::normalizeHcu005Draft($clinicianDraft['hcu005'] ?? []);
        $updated = $normalized;

        if (self::trimString($updated['patientName'] ?? '') === '') {
            $updated['patientName'] = self::buildAdmissionLegalName($admission, $patient);
        }
        if (self::trimString($updated['patientDocumentNumber'] ?? '') === '') {
            $updated['patientDocumentNumber'] = self::trimString($admission['identity']['documentNumber'] ?? '');
        }
        if (self::trimString($updated['patientRecordId'] ?? '') === '') {
            $updated['patientRecordId'] = self::trimString($draft['patientRecordId'] ?? '');
        }
        if (($updated['patientAgeYears'] ?? null) === null) {
            $updated['patientAgeYears'] = self::nullablePositiveInt($admission['demographics']['ageYears'] ?? $patient['ageYears'] ?? null);
        }
        if (self::trimString($updated['patientSexAtBirth'] ?? '') === '') {
            $updated['patientSexAtBirth'] = self::trimString($admission['demographics']['sexAtBirth'] ?? $patient['sexAtBirth'] ?? '');
        }
        if (self::trimString($updated['requestedAt'] ?? '') === '') {
            $updated['requestedAt'] = self::trimString(
                $draft['updatedAt'] ?? $session['updatedAt'] ?? $session['createdAt'] ?? $draft['createdAt'] ?? ''
            );
        }
        if (self::trimString($updated['requestingEstablishment'] ?? '') === '') {
            $updated['requestingEstablishment'] = 'Consultorio privado';
        }
        if (self::trimString($updated['requestingService'] ?? '') === '') {
            $updated['requestingService'] = 'Dermatologia ambulatoria';
        }
        if (self::trimString($updated['clinicalPicture'] ?? '') === '') {
            $updated['clinicalPicture'] = self::trimString(
                $hcu005['evolutionNote'] ?? $draftIntake['enfermedadActual'] ?? ''
            );
        }
        if (self::trimString($updated['requestReason'] ?? '') === '') {
            $updated['requestReason'] = self::trimString(
                $draftIntake['motivoConsulta'] ?? ''
            );
        }
        if (self::normalizeInterconsultationDiagnoses($updated['diagnoses'] ?? []) === []) {
            $updated['diagnoses'] = [[
                'type' => 'pre',
                'label' => self::trimString($hcu005['diagnosticImpression'] ?? ''),
                'cie10' => self::trimString(self::normalizeStringList($clinicianDraft['cie10Sugeridos'] ?? [])[0] ?? ''),
            ]];
        }
        if (self::trimString($updated['therapeuticMeasuresDone'] ?? '') === '') {
            $updated['therapeuticMeasuresDone'] = trim(implode("\n", array_filter([
                self::trimString($hcu005['therapeuticPlan'] ?? ''),
                self::trimString($hcu005['careIndications'] ?? ''),
            ], static fn ($value): bool => self::trimString((string) $value) !== '')));
        }
        $updated['report'] = self::normalizeInterconsultReport(
            isset($updated['report']) && is_array($updated['report']) ? $updated['report'] : [],
            [
                'consultantProfessionalName' => self::trimString($updated['consultedProfessionalName'] ?? ''),
                'respondingEstablishment' => self::trimString($updated['destinationEstablishment'] ?? ''),
                'respondingService' => self::trimString($updated['destinationService'] ?? ''),
            ]
        );
        $updated['reportStatus'] = self::trimString($updated['reportStatus'] ?? $updated['report']['status'] ?? '') ?: 'not_received';
        if (self::trimString($updated['updatedAt'] ?? '') === '') {
            $updated['updatedAt'] = local_date('c');
        }

        return self::normalizeInterconsultation($updated);
    }

    private static function hydrateLabOrderContext(array $labOrder, array $draft, array $session): array
    {
        $normalized = self::normalizeLabOrder($labOrder);
        $sessionPatient = isset($session['patient']) && is_array($session['patient']) ? $session['patient'] : [];
        $draftIntake = isset($draft['intake']) && is_array($draft['intake']) ? $draft['intake'] : [];
        $admission = self::normalizeAdmission001(
            isset($draft['admission001']) && is_array($draft['admission001']) ? $draft['admission001'] : [],
            $sessionPatient,
            $draftIntake,
            ['draft' => $draft]
        );
        $patient = self::buildPatientMirrorFromAdmission($sessionPatient, $admission, $draftIntake);
        $clinicianDraft = self::normalizeClinicianDraft(
            isset($draft['clinicianDraft']) && is_array($draft['clinicianDraft']) ? $draft['clinicianDraft'] : []
        );
        $hcu005 = self::normalizeHcu005Draft($clinicianDraft['hcu005'] ?? []);
        $updated = $normalized;

        if (self::trimString($updated['patientName'] ?? '') === '') {
            $updated['patientName'] = self::buildAdmissionLegalName($admission, $patient);
        }
        if (self::trimString($updated['patientDocumentNumber'] ?? '') === '') {
            $updated['patientDocumentNumber'] = self::trimString($admission['identity']['documentNumber'] ?? '');
        }
        if (self::trimString($updated['patientRecordId'] ?? '') === '') {
            $updated['patientRecordId'] = self::trimString($draft['patientRecordId'] ?? '');
        }
        if (($updated['patientAgeYears'] ?? null) === null) {
            $updated['patientAgeYears'] = self::nullablePositiveInt($admission['demographics']['ageYears'] ?? $patient['ageYears'] ?? null);
        }
        if (self::trimString($updated['patientSexAtBirth'] ?? '') === '') {
            $updated['patientSexAtBirth'] = self::trimString($admission['demographics']['sexAtBirth'] ?? $patient['sexAtBirth'] ?? '');
        }
        if (self::trimString($updated['requestedAt'] ?? '') === '') {
            $updated['requestedAt'] = self::trimString(
                $draft['updatedAt'] ?? $session['updatedAt'] ?? $session['createdAt'] ?? $draft['createdAt'] ?? ''
            );
        }
        if (self::trimString($updated['requestingEstablishment'] ?? '') === '') {
            $updated['requestingEstablishment'] = 'Consultorio privado';
        }
        if (self::trimString($updated['requestingService'] ?? '') === '') {
            $updated['requestingService'] = 'Dermatologia ambulatoria';
        }
        if (self::trimString($updated['careSite'] ?? '') === '') {
            $updated['careSite'] = 'Consulta externa';
        }
        if (self::normalizeInterconsultationDiagnoses($updated['diagnoses'] ?? []) === []) {
            $updated['diagnoses'] = [[
                'type' => 'pre',
                'label' => self::trimString($hcu005['diagnosticImpression'] ?? ''),
                'cie10' => self::trimString(self::normalizeStringList($clinicianDraft['cie10Sugeridos'] ?? [])[0] ?? ''),
            ]];
        }
        if (self::trimString($updated['updatedAt'] ?? '') === '') {
            $updated['updatedAt'] = local_date('c');
        }

        return self::normalizeLabOrder($updated);
    }

    private static function hydrateImagingOrderContext(array $imagingOrder, array $draft, array $session): array
    {
        $normalized = self::normalizeImagingOrder($imagingOrder);
        $sessionPatient = isset($session['patient']) && is_array($session['patient']) ? $session['patient'] : [];
        $draftIntake = isset($draft['intake']) && is_array($draft['intake']) ? $draft['intake'] : [];
        $admission = self::normalizeAdmission001(
            isset($draft['admission001']) && is_array($draft['admission001']) ? $draft['admission001'] : [],
            $sessionPatient,
            $draftIntake,
            ['draft' => $draft]
        );
        $patient = self::buildPatientMirrorFromAdmission($sessionPatient, $admission, $draftIntake);
        $clinicianDraft = self::normalizeClinicianDraft(
            isset($draft['clinicianDraft']) && is_array($draft['clinicianDraft']) ? $draft['clinicianDraft'] : []
        );
        $hcu005 = self::normalizeHcu005Draft($clinicianDraft['hcu005'] ?? []);
        $updated = $normalized;

        if (self::trimString($updated['patientName'] ?? '') === '') {
            $updated['patientName'] = self::buildAdmissionLegalName($admission, $patient);
        }
        if (self::trimString($updated['patientDocumentNumber'] ?? '') === '') {
            $updated['patientDocumentNumber'] = self::trimString($admission['identity']['documentNumber'] ?? '');
        }
        if (self::trimString($updated['patientRecordId'] ?? '') === '') {
            $updated['patientRecordId'] = self::trimString($draft['patientRecordId'] ?? '');
        }
        if (($updated['patientAgeYears'] ?? null) === null) {
            $updated['patientAgeYears'] = self::nullablePositiveInt($admission['demographics']['ageYears'] ?? $patient['ageYears'] ?? null);
        }
        if (self::trimString($updated['patientSexAtBirth'] ?? '') === '') {
            $updated['patientSexAtBirth'] = self::trimString($admission['demographics']['sexAtBirth'] ?? $patient['sexAtBirth'] ?? '');
        }
        if (self::trimString($updated['requestedAt'] ?? '') === '') {
            $updated['requestedAt'] = self::trimString(
                $draft['updatedAt'] ?? $session['updatedAt'] ?? $session['createdAt'] ?? $draft['createdAt'] ?? ''
            );
        }
        if (self::trimString($updated['requestingEstablishment'] ?? '') === '') {
            $updated['requestingEstablishment'] = 'Consultorio privado';
        }
        if (self::trimString($updated['requestingService'] ?? '') === '') {
            $updated['requestingService'] = 'Dermatologia ambulatoria';
        }
        if (self::trimString($updated['careSite'] ?? '') === '') {
            $updated['careSite'] = 'Consulta externa';
        }
        if (self::normalizeInterconsultationDiagnoses($updated['diagnoses'] ?? []) === []) {
            $updated['diagnoses'] = [[
                'type' => 'pre',
                'label' => self::trimString($hcu005['diagnosticImpression'] ?? ''),
                'cie10' => self::trimString(self::normalizeStringList($clinicianDraft['cie10Sugeridos'] ?? [])[0] ?? ''),
            ]];
        }
        if (self::trimString($updated['requestReason'] ?? '') === '') {
            $updated['requestReason'] = self::trimString($draft['intake']['motivoConsulta'] ?? '');
        }
        if (self::trimString($updated['clinicalSummary'] ?? '') === '') {
            $updated['clinicalSummary'] = trim(implode("\n", array_filter([
                self::trimString($hcu005['evolutionNote'] ?? ''),
                self::trimString($hcu005['therapeuticPlan'] ?? ''),
                self::trimString($hcu005['careIndications'] ?? ''),
            ])));
        }
        if (self::trimString($updated['updatedAt'] ?? '') === '') {
            $updated['updatedAt'] = local_date('c');
        }

        return self::normalizeImagingOrder($updated);
    }

    private static function ensureInterconsultFormSnapshots(array $existingSnapshots, array $interconsultations): array
    {
        $snapshots = self::normalizeInterconsultFormSnapshots($existingSnapshots);
        $existingKeys = [];
        foreach ($snapshots as $snapshot) {
            $existingKeys[] = self::trimString($snapshot['interconsultId'] ?? '') . '|' . self::trimString($snapshot['status'] ?? '');
        }

        foreach ($interconsultations as $interconsultation) {
            $normalizedInterconsultation = self::normalizeInterconsultation($interconsultation);
            $status = self::trimString($normalizedInterconsultation['status'] ?? '');
            if (!in_array($status, ['issued', 'cancelled'], true)) {
                continue;
            }

            $key = self::trimString($normalizedInterconsultation['interconsultId'] ?? '') . '|' . $status;
            if (in_array($key, $existingKeys, true)) {
                continue;
            }

            $finalizedAt = $status === 'issued'
                ? self::trimString($normalizedInterconsultation['issuedAt'] ?? '')
                : self::trimString($normalizedInterconsultation['cancelledAt'] ?? '');
            $snapshots[] = array_merge($normalizedInterconsultation, [
                'snapshotId' => self::newOpaqueId('interconsult-form'),
                'finalizedAt' => $finalizedAt,
                'snapshotAt' => $finalizedAt !== '' ? $finalizedAt : local_date('c'),
            ]);
            $existingKeys[] = $key;
        }

        return self::normalizeInterconsultFormSnapshots($snapshots);
    }

    private static function ensureInterconsultReportSnapshots(array $existingSnapshots, array $interconsultations): array
    {
        $snapshots = self::normalizeInterconsultReportSnapshots($existingSnapshots);
        $existingKeys = [];
        foreach ($snapshots as $snapshot) {
            $existingKeys[] = self::trimString($snapshot['interconsultId'] ?? '') . '|' . self::trimString($snapshot['reportStatus'] ?? '');
        }

        foreach ($interconsultations as $interconsultation) {
            $normalizedInterconsultation = self::normalizeInterconsultation($interconsultation);
            $report = self::normalizeInterconsultReport(
                isset($normalizedInterconsultation['report']) && is_array($normalizedInterconsultation['report'])
                    ? $normalizedInterconsultation['report']
                    : []
            );
            $reportStatus = self::trimString($normalizedInterconsultation['reportStatus'] ?? $report['status'] ?? '');
            if ($reportStatus !== 'received') {
                continue;
            }

            $key = self::trimString($normalizedInterconsultation['interconsultId'] ?? '') . '|received';
            if (in_array($key, $existingKeys, true)) {
                continue;
            }

            $finalizedAt = self::trimString($report['reportedAt'] ?? '');
            $snapshots[] = [
                'snapshotId' => self::newOpaqueId('interconsult-report'),
                'interconsultId' => self::trimString($normalizedInterconsultation['interconsultId'] ?? ''),
                'interconsultStatus' => self::trimString($normalizedInterconsultation['status'] ?? ''),
                'destinationEstablishment' => self::trimString($normalizedInterconsultation['destinationEstablishment'] ?? ''),
                'destinationService' => self::trimString($normalizedInterconsultation['destinationService'] ?? ''),
                'consultedProfessionalName' => self::trimString($normalizedInterconsultation['consultedProfessionalName'] ?? ''),
                'reportStatus' => 'received',
                'finalizedAt' => $finalizedAt,
                'snapshotAt' => $finalizedAt !== '' ? $finalizedAt : local_date('c'),
                'report' => $report,
            ];
            $existingKeys[] = $key;
        }

        return self::normalizeInterconsultReportSnapshots($snapshots);
    }

    private static function ensureLabOrderSnapshots(array $existingSnapshots, array $labOrders): array
    {
        $snapshots = self::normalizeLabOrderSnapshots($existingSnapshots);
        $existingKeys = [];
        foreach ($snapshots as $snapshot) {
            $existingKeys[] = self::trimString($snapshot['labOrderId'] ?? '') . '|' . self::trimString($snapshot['status'] ?? '');
        }

        foreach ($labOrders as $labOrder) {
            $normalizedLabOrder = self::normalizeLabOrder($labOrder);
            $status = self::trimString($normalizedLabOrder['status'] ?? '');
            if (!in_array($status, ['issued', 'cancelled'], true)) {
                continue;
            }

            $key = self::trimString($normalizedLabOrder['labOrderId'] ?? '') . '|' . $status;
            if (in_array($key, $existingKeys, true)) {
                continue;
            }

            $finalizedAt = $status === 'issued'
                ? self::trimString($normalizedLabOrder['issuedAt'] ?? '')
                : self::trimString($normalizedLabOrder['cancelledAt'] ?? '');
            $snapshots[] = array_merge($normalizedLabOrder, [
                'snapshotId' => self::newOpaqueId('lab-order-form'),
                'finalizedAt' => $finalizedAt,
                'snapshotAt' => $finalizedAt !== '' ? $finalizedAt : local_date('c'),
            ]);
            $existingKeys[] = $key;
        }

        return self::normalizeLabOrderSnapshots($snapshots);
    }

    private static function ensureImagingOrderSnapshots(array $existingSnapshots, array $imagingOrders): array
    {
        $snapshots = self::normalizeImagingOrderSnapshots($existingSnapshots);
        $existingKeys = [];
        foreach ($snapshots as $snapshot) {
            $existingKeys[] = self::trimString($snapshot['imagingOrderId'] ?? '') . '|' . self::trimString($snapshot['status'] ?? '');
        }

        foreach ($imagingOrders as $imagingOrder) {
            $normalizedImagingOrder = self::normalizeImagingOrder($imagingOrder);
            $status = self::trimString($normalizedImagingOrder['status'] ?? '');
            if (!in_array($status, ['issued', 'cancelled'], true)) {
                continue;
            }

            $key = self::trimString($normalizedImagingOrder['imagingOrderId'] ?? '') . '|' . $status;
            if (in_array($key, $existingKeys, true)) {
                continue;
            }

            $finalizedAt = $status === 'issued'
                ? self::trimString($normalizedImagingOrder['issuedAt'] ?? '')
                : self::trimString($normalizedImagingOrder['cancelledAt'] ?? '');
            $snapshots[] = array_merge($normalizedImagingOrder, [
                'snapshotId' => self::newOpaqueId('imaging-order-form'),
                'finalizedAt' => $finalizedAt,
                'snapshotAt' => $finalizedAt !== '' ? $finalizedAt : local_date('c'),
            ]);
            $existingKeys[] = $key;
        }

        return self::normalizeImagingOrderSnapshots($snapshots);
    }

    private static function ensureImagingReportSnapshots(array $existingSnapshots, array $imagingOrders): array
    {
        $snapshots = self::normalizeImagingReportSnapshots($existingSnapshots);
        $existingKeys = [];
        foreach ($snapshots as $snapshot) {
            $existingKeys[] = self::trimString($snapshot['imagingOrderId'] ?? '') . '|' . self::trimString($snapshot['reportStatus'] ?? '');
        }

        foreach ($imagingOrders as $imagingOrder) {
            $normalizedImagingOrder = self::normalizeImagingOrder($imagingOrder);
            $report = self::normalizeImagingReport(
                isset($normalizedImagingOrder['result']) && is_array($normalizedImagingOrder['result'])
                    ? $normalizedImagingOrder['result']
                    : []
            );
            $reportStatus = self::trimString($normalizedImagingOrder['resultStatus'] ?? $report['status'] ?? '');
            if ($reportStatus !== 'received') {
                continue;
            }

            $key = self::trimString($normalizedImagingOrder['imagingOrderId'] ?? '') . '|received';
            if (in_array($key, $existingKeys, true)) {
                continue;
            }

            $finalizedAt = self::trimString($report['reportedAt'] ?? '');
            $snapshots[] = [
                'snapshotId' => self::newOpaqueId('imaging-report'),
                'imagingOrderId' => self::trimString($normalizedImagingOrder['imagingOrderId'] ?? ''),
                'imagingOrderStatus' => self::trimString($normalizedImagingOrder['status'] ?? ''),
                'studySelections' => self::normalizeImagingStudySelections($normalizedImagingOrder['studySelections'] ?? []),
                'requestReason' => self::trimString($normalizedImagingOrder['requestReason'] ?? ''),
                'reportStatus' => 'received',
                'finalizedAt' => $finalizedAt,
                'snapshotAt' => $finalizedAt !== '' ? $finalizedAt : local_date('c'),
                'report' => $report,
            ];
            $existingKeys[] = $key;
        }

        return self::normalizeImagingReportSnapshots($snapshots);
    }

    private static function ensureConsentFormSnapshots(array $existingSnapshots, array $packets): array
    {
        $snapshots = self::normalizeConsentFormSnapshots($existingSnapshots);
        $existingKeys = [];
        foreach ($snapshots as $snapshot) {
            $existingKeys[] = self::trimString($snapshot['packetId'] ?? '') . '|' . self::trimString($snapshot['status'] ?? '');
        }

        foreach ($packets as $packet) {
            $normalizedPacket = self::normalizeConsentPacket($packet);
            $status = self::trimString($normalizedPacket['status'] ?? '');
            if (!in_array($status, ['accepted', 'declined', 'revoked'], true)) {
                continue;
            }

            $key = self::trimString($normalizedPacket['packetId'] ?? '') . '|' . $status;
            if (in_array($key, $existingKeys, true)) {
                continue;
            }

            $finalizedAt = $status === 'accepted'
                ? self::trimString($normalizedPacket['patientAttestation']['signedAt'] ?? '')
                : ($status === 'declined'
                    ? self::trimString($normalizedPacket['denial']['declinedAt'] ?? '')
                    : self::trimString($normalizedPacket['revocation']['revokedAt'] ?? ''));
            $snapshots[] = array_merge($normalizedPacket, [
                'snapshotId' => self::newOpaqueId('consent-form'),
                'finalizedAt' => $finalizedAt,
                'snapshotAt' => $finalizedAt !== '' ? $finalizedAt : local_date('c'),
            ]);
            $existingKeys[] = $key;
        }

        return self::normalizeConsentFormSnapshots($snapshots);
    }

    private static function consentRecordHasSubstantiveContent(array $consent): bool
    {
        $normalized = self::normalizeConsentRecord($consent);
        if (($normalized['required'] ?? false) === true) {
            return true;
        }
        if (!in_array($normalized['status'] ?? 'not_required', ['not_required', ''], true)) {
            return true;
        }

        foreach ([
            'informedBy',
            'informedAt',
            'explainedWhat',
            'risksExplained',
            'alternativesExplained',
            'capacityAssessment',
            'acceptedAt',
            'declinedAt',
            'revokedAt',
            'notes',
        ] as $field) {
            if (self::trimString($normalized[$field] ?? '') !== '') {
                return true;
            }
        }

        return false;
    }

    /**
     * @param array<int,string> $parts
     */
    private static function stableDerivedId(string $prefix, array $parts): string
    {
        $seed = implode('|', array_values(array_filter(array_map(
            static fn ($value): string => trim((string) $value),
            $parts
        ))));

        if ($seed === '') {
            return self::newOpaqueId($prefix);
        }

        return strtolower(trim($prefix)) . '-' . substr(sha1($seed), 0, 20);
    }
}
