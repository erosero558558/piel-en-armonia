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
        ];
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
            'alergias' => '',
            'medicacionActual' => '',
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
        foreach (['motivoConsulta', 'enfermedadActual', 'antecedentes', 'alergias', 'medicacionActual', 'resumenClinico', 'tratamientoBorrador'] as $field) {
            $normalized[$field] = self::trimString($intake[$field] ?? $defaults[$field]);
        }

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
