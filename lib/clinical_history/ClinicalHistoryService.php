<?php

declare(strict_types=1);

require_once __DIR__ . '/../audit.php';
require_once __DIR__ . '/../telemedicine/ClinicalMediaService.php';

final class ClinicalHistoryService
{
    private ClinicalHistoryAIService $ai;

    public function __construct(?ClinicalHistoryAIService $ai = null)
    {
        $this->ai = $ai ?? new ClinicalHistoryAIService();
    }

    public function createOrResumeSession(array $store, array $payload): array
    {
        [$store, $session, $draft, $created] = $this->resolveSessionContext($store, $payload, true);
        $reconciled = $this->reconcilePendingAi($store, $session, $draft);
        $store = $reconciled['store'];
        $session = $reconciled['session'];
        $draft = $reconciled['draft'];

        $attachmentResult = $this->attachUploads($store, $session, $draft, $payload);
        $store = $attachmentResult['store'];
        $session = $attachmentResult['session'];
        $draft = $attachmentResult['draft'];

        $sessionSave = ClinicalHistoryRepository::upsertSession($store, $session);
        $store = $sessionSave['store'];
        $session = $sessionSave['session'];

        $draftSave = ClinicalHistoryRepository::upsertDraft($store, $draft);
        $store = $draftSave['store'];
        $draft = $draftSave['draft'];

        audit_log_event($created ? 'clinical_history.session_created' : 'clinical_history.session_resumed', [
            'sessionId' => (string) ($session['sessionId'] ?? ''),
            'caseId' => (string) ($session['caseId'] ?? ''),
            'appointmentId' => (int) ($session['appointmentId'] ?? 0),
            'surface' => (string) ($session['surface'] ?? ''),
        ]);

        return [
            'ok' => true,
            'statusCode' => $created ? 201 : 200,
            'store' => $store,
            'session' => $session,
            'draft' => $draft,
            'created' => $created,
            'data' => $this->buildPublicPayload($session, $draft),
        ];
    }

    public function handlePatientMessage(array $store, array $payload): array
    {
        $messageText = $this->extractPatientMessage($payload);
        if ($messageText === '') {
            return [
                'ok' => false,
                'statusCode' => 400,
                'error' => 'message es obligatorio',
                'errorCode' => 'clinical_history_message_required',
            ];
        }

        [$store, $session, $draft] = $this->resolveSessionContext($store, $payload, true);
        $reconciled = $this->reconcilePendingAi($store, $session, $draft);
        $store = $reconciled['store'];
        $session = $reconciled['session'];
        $draft = $reconciled['draft'];
        if (($reconciled['mutated'] ?? false) === true) {
            $sessionSave = ClinicalHistoryRepository::upsertSession($store, $session);
            $store = $sessionSave['store'];
            $session = $sessionSave['session'];

            $draftSave = ClinicalHistoryRepository::upsertDraft($store, $draft);
            $store = $draftSave['store'];
            $draft = $draftSave['draft'];
        }

        $clientMessageId = ClinicalHistoryRepository::trimString(
            $payload['clientMessageId'] ?? $payload['messageId'] ?? ''
        );
        $messageHash = hash('sha256', strtolower(trim($messageText)));

        if ($this->isReplay($session, $clientMessageId, $messageHash)) {
            $response = is_array($session['lastTurn']['response'] ?? null) ? $session['lastTurn']['response'] : [];
            $ai = is_array($session['lastTurn']['ai'] ?? null) ? $session['lastTurn']['ai'] : [];

            return [
                'ok' => true,
                'statusCode' => 200,
                'store' => $store,
                'session' => $session,
                'draft' => $draft,
                'replay' => true,
                'response' => $response,
                'ai' => $ai,
                'data' => $this->buildPublicPayload($session, $draft, $response, $ai),
            ];
        }

        [$session, $draft] = $this->clearPendingAi($session, $draft, 'superseded_by_new_patient_turn');

        $session['surface'] = ClinicalHistoryRepository::trimString($payload['surface'] ?? $session['surface'] ?? 'web_chat');
        $session['surfaces'] = ClinicalHistoryRepository::normalizeStringList(array_merge(
            $session['surfaces'] ?? [],
            [$session['surface']]
        ));
        $session['patient'] = ClinicalHistoryRepository::normalizePatient(array_merge(
            $session['patient'] ?? [],
            isset($payload['patient']) && is_array($payload['patient']) ? $payload['patient'] : []
        ));

        $session = ClinicalHistoryRepository::appendTranscriptMessage($session, [
            'role' => 'user',
            'actor' => 'patient',
            'content' => $messageText,
            'surface' => $session['surface'],
            'clientMessageId' => $clientMessageId,
            'meta' => [
                'caseId' => (string) ($session['caseId'] ?? ''),
            ],
        ]);

        $attachmentResult = $this->attachUploads($store, $session, $draft, $payload);
        $store = $attachmentResult['store'];
        $session = $attachmentResult['session'];
        $draft = $attachmentResult['draft'];

        $aiResult = $this->ai->requestEnvelope($session, $draft, $messageText, $payload);
        $guarded = ClinicalHistoryGuardrails::applyEnvelope($session, $draft, $aiResult['envelope'] ?? [], $aiResult);
        $draft = $guarded['draft'];
        $publicResponse = isset($guarded['publicResponse']) && is_array($guarded['publicResponse']) ? $guarded['publicResponse'] : [];
        $questionFieldKey = (string) ($guarded['questionFieldKey'] ?? '');

        $assistantContent = $this->assistantContentFromResponse($publicResponse);
        $assistantMessageId = '';
        if ($assistantContent !== '') {
            $session = ClinicalHistoryRepository::appendTranscriptMessage($session, [
                'role' => 'assistant',
                'actor' => 'clinical_intake',
                'content' => $assistantContent,
                'surface' => $session['surface'],
                'fieldKey' => $questionFieldKey,
                'meta' => [
                    'aiMode' => (string) ($aiResult['mode'] ?? 'fallback'),
                    'provider' => (string) ($aiResult['provider'] ?? 'local_fallback'),
                ],
            ]);
            $transcript = is_array($session['transcript'] ?? null) ? $session['transcript'] : [];
            $assistantMessageId = (string) (($transcript[count($transcript) - 1]['id'] ?? ''));
        }

        if ($questionFieldKey !== '') {
            $session['questionHistory'] = ClinicalHistoryRepository::normalizeStringList(array_merge(
                $session['questionHistory'] ?? [],
                [$questionFieldKey]
            ));
        }

        $session['status'] = (bool) ($draft['requiresHumanReview'] ?? true) ? 'review_required' : 'active';
        $session['updatedAt'] = local_date('c');
        $session['lastTurn'] = [
            'clientMessageId' => $clientMessageId,
            'messageHash' => $messageHash,
            'assistantMessageId' => $assistantMessageId,
            'questionFieldKey' => $questionFieldKey,
            'response' => $publicResponse,
            'ai' => $this->publicAiPayload($aiResult),
        ];

        if (($aiResult['mode'] ?? '') === 'queued' && ClinicalHistoryRepository::trimString($aiResult['jobId'] ?? '') !== '') {
            $pendingAi = $this->buildPendingAi($aiResult, $messageHash, $clientMessageId, $assistantMessageId, $questionFieldKey);
            $session['pendingAi'] = $pendingAi;
            $draft['pendingAi'] = $pendingAi;
        } else {
            $session['pendingAi'] = [];
            $draft['pendingAi'] = [];
        }

        $sessionSave = ClinicalHistoryRepository::upsertSession($store, $session);
        $store = $sessionSave['store'];
        $session = $sessionSave['session'];

        $draftSave = ClinicalHistoryRepository::upsertDraft($store, $draft);
        $store = $draftSave['store'];
        $draft = $draftSave['draft'];

        audit_log_event('clinical_history.turn_recorded', [
            'sessionId' => (string) ($session['sessionId'] ?? ''),
            'caseId' => (string) ($session['caseId'] ?? ''),
            'mode' => (string) ($aiResult['mode'] ?? 'fallback'),
            'provider' => (string) ($aiResult['provider'] ?? 'local_fallback'),
            'requiresHumanReview' => (bool) ($draft['requiresHumanReview'] ?? true),
        ]);

        return [
            'ok' => true,
            'statusCode' => 200,
            'store' => $store,
            'session' => $session,
            'draft' => $draft,
            'replay' => false,
            'response' => $publicResponse,
            'ai' => $this->publicAiPayload($aiResult),
            'data' => $this->buildPublicPayload($session, $draft, $publicResponse, $this->publicAiPayload($aiResult)),
        ];
    }

    public function getSession(array $store, array $query, bool $admin = false): array
    {
        [$session, $draft] = $this->findContext($store, $query);
        if ($session === null || $draft === null) {
            return [
                'ok' => false,
                'statusCode' => 404,
                'error' => 'Sesion clinica no encontrada',
                'errorCode' => 'clinical_history_not_found',
            ];
        }

        $reconciled = $this->reconcilePendingAi($store, $session, $draft);
        $store = $reconciled['store'];
        $session = $reconciled['session'];
        $draft = $reconciled['draft'];

        if (($reconciled['mutated'] ?? false) === true) {
            $sessionSave = ClinicalHistoryRepository::upsertSession($store, $session);
            $store = $sessionSave['store'];
            $session = $sessionSave['session'];

            $draftSave = ClinicalHistoryRepository::upsertDraft($store, $draft);
            $store = $draftSave['store'];
            $draft = $draftSave['draft'];
        }

        return [
            'ok' => true,
            'statusCode' => 200,
            'store' => $store,
            'session' => $session,
            'draft' => $draft,
            'mutated' => (bool) ($reconciled['mutated'] ?? false),
            'data' => $admin
                ? $this->buildAdminPayload($store, $session, $draft)
                : $this->buildPublicPayload($session, $draft),
        ];
    }

    public function getRecord(array $store, array $query): array
    {
        [$session, $draft] = $this->findContext($store, $query);
        if ($session === null || $draft === null) {
            return [
                'ok' => false,
                'statusCode' => 404,
                'error' => 'Registro clinico no encontrado',
                'errorCode' => 'clinical_record_not_found',
            ];
        }

        $reconciled = $this->reconcilePendingAi($store, $session, $draft);
        $store = $reconciled['store'];
        $session = $reconciled['session'];
        $draft = $reconciled['draft'];
        $mutated = (bool) ($reconciled['mutated'] ?? false);

        if ($mutated === true) {
            $sessionSave = ClinicalHistoryRepository::upsertSession($store, $session);
            $store = $sessionSave['store'];
            $session = $sessionSave['session'];

            $draftSave = ClinicalHistoryRepository::upsertDraft($store, $draft);
            $store = $draftSave['store'];
            $draft = $draftSave['draft'];
        }

        $store = $this->recordAccessAudit(
            $store,
            $session,
            $draft,
            'view_record',
            'authorized_clinical_record_read',
            [
                'surface' => 'clinical-record',
                'approvalStatus' => (string) ($draft['approval']['status'] ?? 'pending'),
            ]
        );
        $mutated = true;

        return [
            'ok' => true,
            'statusCode' => 200,
            'store' => $store,
            'session' => $session,
            'draft' => $draft,
            'mutated' => $mutated,
            'data' => $this->buildClinicalRecordPayload($store, $session, $draft),
        ];
    }

    public function patchRecord(array $store, array $payload): array
    {
        return $this->mutateClinicalRecord($store, $payload, 'save');
    }

    public function episodeAction(array $store, array $payload): array
    {
        $action = ClinicalHistoryRepository::trimString($payload['action'] ?? '');
        if ($action === '') {
            return [
                'ok' => false,
                'statusCode' => 400,
                'error' => 'action es obligatorio',
                'errorCode' => 'clinical_episode_action_required',
            ];
        }

        if ($action === 'open_episode') {
            return $this->openEpisode($store, $payload);
        }

        if ($action === 'resume_episode') {
            return $this->getRecord($store, $payload);
        }

        if ($action === 'record_consent') {
            return $this->mutateClinicalRecord($store, $payload, 'consent');
        }

        if ($action === 'revoke_consent') {
            $payload['consent'] = array_merge(
                isset($payload['consent']) && is_array($payload['consent']) ? $payload['consent'] : [],
                [
                    'status' => 'revoked',
                    'revokedAt' => local_date('c'),
                ]
            );
            return $this->mutateClinicalRecord($store, $payload, 'revoke-consent');
        }

        if ($action === 'issue_prescription') {
            return $this->mutateClinicalRecord($store, $payload, 'prescription');
        }

        if ($action === 'issue_certificate') {
            return $this->mutateClinicalRecord($store, $payload, 'certificate');
        }

        if ($action === 'request_missing_data') {
            return $this->mutateClinicalRecord($store, $payload, 'follow-up');
        }

        if ($action === 'mark_review_required') {
            return $this->mutateClinicalRecord($store, $payload, 'review-required');
        }

        if ($action === 'approve_final_note') {
            return $this->mutateClinicalRecord($store, $payload, 'approve');
        }

        if ($action === 'save_draft') {
            return $this->mutateClinicalRecord($store, $payload, 'save');
        }

        if ($action === 'request_certified_copy') {
            return $this->mutateClinicalRecord($store, $payload, 'copy-request');
        }

        if ($action === 'deliver_certified_copy') {
            return $this->mutateClinicalRecord($store, $payload, 'copy-delivery');
        }

        if ($action === 'log_disclosure') {
            return $this->mutateClinicalRecord($store, $payload, 'disclosure');
        }

        if ($action === 'set_archive_state') {
            return $this->mutateClinicalRecord($store, $payload, 'archive-state');
        }

        return [
            'ok' => false,
            'statusCode' => 400,
            'error' => 'Accion clinica no soportada',
            'errorCode' => 'clinical_episode_action_invalid',
        ];
    }

    public function reconcilePendingSessions(array $store, array $options = []): array
    {
        $sessions = isset($store['clinical_history_sessions']) && is_array($store['clinical_history_sessions'])
            ? array_values($store['clinical_history_sessions'])
            : [];
        $maxSessions = isset($options['maxSessions']) && is_numeric($options['maxSessions'])
            ? max(0, (int) $options['maxSessions'])
            : 50;

        $scanned = 0;
        $mutated = 0;
        $completed = 0;
        $failed = 0;
        $superseded = 0;
        $closed = 0;
        $remaining = 0;
        $processedSessionIds = [];

        foreach ($sessions as $sessionRecord) {
            $pending = ClinicalHistoryRepository::normalizePendingAi(
                isset($sessionRecord['pendingAi']) && is_array($sessionRecord['pendingAi']) ? $sessionRecord['pendingAi'] : []
            );
            if ($pending === []) {
                continue;
            }

            if ($maxSessions > 0 && $scanned >= $maxSessions) {
                break;
            }
            $scanned++;

            $session = ClinicalHistoryRepository::adminSession($sessionRecord);
            $draft = ClinicalHistoryRepository::findDraftBySessionId($store, (string) ($session['sessionId'] ?? ''));
            if ($draft === null) {
                $draft = ClinicalHistoryRepository::defaultDraft($session);
            } else {
                $draft = ClinicalHistoryRepository::adminDraft($draft);
            }

            $reconciled = $this->reconcilePendingAi($store, $session, $draft);
            $store = $reconciled['store'];
            $session = $reconciled['session'];
            $draft = $reconciled['draft'];

            if (($reconciled['mutated'] ?? false) === true) {
                $sessionSave = ClinicalHistoryRepository::upsertSession($store, $session);
                $store = $sessionSave['store'];
                $session = $sessionSave['session'];

                $draftSave = ClinicalHistoryRepository::upsertDraft($store, $draft);
                $store = $draftSave['store'];
                $draft = $draftSave['draft'];
                $mutated++;
            }

            $processedSessionIds[] = (string) ($session['sessionId'] ?? '');
            $pendingAfter = ClinicalHistoryRepository::normalizePendingAi(
                isset($session['pendingAi']) && is_array($session['pendingAi'])
                    ? $session['pendingAi']
                    : (isset($draft['pendingAi']) && is_array($draft['pendingAi']) ? $draft['pendingAi'] : [])
            );
            if ($pendingAfter !== []) {
                $remaining++;
                continue;
            }

            $lastPending = ClinicalHistoryRepository::normalizePendingAi(
                isset($session['metadata']['lastPendingAi']) && is_array($session['metadata']['lastPendingAi'])
                    ? $session['metadata']['lastPendingAi']
                    : []
            );
            $lastStatus = ClinicalHistoryRepository::trimString($lastPending['status'] ?? '');
            if ($lastStatus === 'completed') {
                $completed++;
            } elseif (in_array($lastStatus, ['failed', 'expired'], true)) {
                $failed++;
            } elseif ($lastStatus === 'superseded') {
                $superseded++;
            } elseif ($lastStatus !== '') {
                $closed++;
            }
        }

        return [
            'ok' => true,
            'store' => $store,
            'scanned' => $scanned,
            'mutated' => $mutated,
            'completed' => $completed,
            'failed' => $failed,
            'superseded' => $superseded,
            'closed' => $closed,
            'remaining' => $remaining,
            'processedSessionIds' => array_values(array_filter($processedSessionIds, static function ($sessionId): bool {
                return is_string($sessionId) && trim($sessionId) !== '';
            })),
        ];
    }

    public function applyReview(array $store, array $payload): array
    {
        $mode = 'save';
        if (($payload['approve'] ?? false) === true) {
            $mode = 'approve';
        } elseif (ClinicalHistoryRepository::trimString($payload['requestAdditionalQuestion'] ?? $payload['followUpQuestion'] ?? '') !== '') {
            $mode = 'follow-up';
        } elseif (ClinicalHistoryRepository::trimString($payload['reviewStatus'] ?? '') === 'review_required') {
            $mode = 'review-required';
        }

        return $this->mutateClinicalRecord($store, $payload, $mode);
    }

    public function buildChatCompletionPayload(array $result): array
    {
        $payload = isset($result['data']) && is_array($result['data']) ? $result['data'] : [];
        $response = isset($payload['response']) && is_array($payload['response']) ? $payload['response'] : [];
        $reply = ClinicalHistoryRepository::trimString($response['reply'] ?? '');
        $nextQuestion = ClinicalHistoryRepository::trimString($response['nextQuestion'] ?? '');
        $content = trim(implode("\n\n", array_filter([$reply, $nextQuestion])));
        if ($content === '') {
            $content = 'Gracias, ya registre esta informacion en tu historia clinica.';
        }

        try {
            $id = 'clinical-chat-' . bin2hex(random_bytes(8));
        } catch (Throwable $e) {
            $id = 'clinical-chat-' . substr(sha1((string) microtime(true)), 0, 16);
        }

        return [
            'id' => $id,
            'object' => 'chat.completion',
            'created' => time(),
            'model' => 'clinical-intake',
            'choices' => [[
                'index' => 0,
                'message' => [
                    'role' => 'assistant',
                    'content' => $content,
                ],
                'finish_reason' => 'stop',
            ]],
            'mode' => (string) (($result['ai']['mode'] ?? 'fallback')),
            'source' => (string) (($result['ai']['provider'] ?? 'clinical_intake')),
            'clinicalIntake' => $payload,
        ];
    }

    private function buildPublicPayload(array $session, array $draft, array $response = [], array $ai = []): array
    {
        if ($response === []) {
            $response = isset($session['lastTurn']['response']) && is_array($session['lastTurn']['response'])
                ? $session['lastTurn']['response']
                : [];
        }
        if ($ai === []) {
            $ai = isset($session['lastTurn']['ai']) && is_array($session['lastTurn']['ai'])
                ? $session['lastTurn']['ai']
                : [];
        }

        return [
            'session' => ClinicalHistoryRepository::patientSafeSession($session),
            'draft' => ClinicalHistoryRepository::patientSafeDraft($draft),
            'response' => $response,
            'ai' => $ai,
        ];
    }

    private function buildAdminPayload(array $store, array $session, array $draft): array
    {
        $payload = $this->buildClinicalRecordPayload($store, $session, $draft);

        return [
            'session' => $payload['session'] ?? [],
            'draft' => $payload['draft'] ?? [],
            'events' => $payload['events'] ?? [],
            'patientRecord' => $payload['patientRecord'] ?? [],
            'activeEpisode' => $payload['activeEpisode'] ?? [],
            'encounter' => $payload['encounter'] ?? [],
            'liveNote' => $payload['liveNote'] ?? [],
            'documents' => $payload['documents'] ?? [],
            'consent' => $payload['consent'] ?? [],
            'approval' => $payload['approval'] ?? [],
            'approvalState' => $payload['approvalState'] ?? [],
            'legalReadiness' => $payload['legalReadiness'] ?? [],
            'closureChecklist' => $payload['closureChecklist'] ?? [],
            'approvalBlockedReasons' => $payload['approvalBlockedReasons'] ?? [],
            'recordsGovernance' => $payload['recordsGovernance'] ?? [],
            'accessAudit' => $payload['accessAudit'] ?? [],
            'disclosureLog' => $payload['disclosureLog'] ?? [],
            'copyRequests' => $payload['copyRequests'] ?? [],
            'archiveReadiness' => $payload['archiveReadiness'] ?? [],
            'auditSummary' => $payload['auditSummary'] ?? [],
            'legacyBridge' => [
                'session' => $payload['session'] ?? [],
                'draft' => $payload['draft'] ?? [],
                'events' => $payload['events'] ?? [],
            ],
        ];
    }

    private function buildClinicalRecordPayload(array $store, array $session, array $draft): array
    {
        $session = ClinicalHistoryRepository::adminSession($session);
        $draft = $this->synchronizeHcu005Draft(ClinicalHistoryRepository::adminDraft($draft));
        $events = ClinicalHistoryRepository::findEventsBySessionId(
            $store,
            (string) ($session['sessionId'] ?? '')
        );
        $legalReadiness = ClinicalHistoryLegalReadiness::build($session, $draft, $events);
        $documents = ClinicalHistoryRepository::normalizeClinicalDocuments(
            is_array($draft['documents'] ?? null) ? $draft['documents'] : []
        );
        $consent = ClinicalHistoryRepository::normalizeConsentRecord(
            is_array($draft['consent'] ?? null) ? $draft['consent'] : []
        );
        $approval = ClinicalHistoryRepository::normalizeApprovalRecord(
            is_array($draft['approval'] ?? null) ? $draft['approval'] : []
        );
        $recordMeta = ClinicalHistoryRepository::normalizeRecordMeta(
            is_array($draft['recordMeta'] ?? null) ? $draft['recordMeta'] : [],
            $session,
            $draft
        );
        $patient = is_array($session['patient'] ?? null) ? $session['patient'] : [];
        $disclosureLog = ClinicalHistoryRepository::normalizeDisclosureLog($draft['disclosureLog'] ?? []);
        $copyRequests = array_map(
            fn (array $request): array => $this->decorateCopyRequest($request),
            ClinicalHistoryRepository::normalizeCopyRequests($draft['copyRequests'] ?? [])
        );
        $accessAudit = ClinicalHistoryRepository::findAccessAuditForRecord(
            $store,
            (string) ($draft['patientRecordId'] ?? ''),
            (string) ($session['sessionId'] ?? '')
        );
        $archiveReadiness = $this->buildArchiveReadiness($recordMeta);
        $recordsGovernance = $this->buildRecordsGovernance(
            $recordMeta,
            $archiveReadiness,
            $copyRequests,
            $disclosureLog,
            $accessAudit
        );
        $hcu005Status = is_array($legalReadiness['hcu005Status'] ?? null)
            ? $legalReadiness['hcu005Status']
            : ['status' => 'missing', 'label' => 'HCU-005 pendiente', 'summary' => ''];

        return [
            'session' => $session,
            'draft' => $draft,
            'events' => $events,
            'patientRecord' => [
                'recordId' => (string) ($draft['patientRecordId'] ?? ''),
                'patient' => ClinicalHistoryRepository::normalizePatient($patient),
                'archiveState' => (string) ($recordMeta['archiveState'] ?? 'active'),
                'archiveStatusLabel' => (string) ($archiveReadiness['label'] ?? 'Activa'),
                'archiveReadiness' => $archiveReadiness,
                'lastAttentionAt' => (string) ($recordMeta['lastAttentionAt'] ?? ''),
                'confidentialityLabel' => (string) ($recordMeta['confidentialityLabel'] ?? 'CONFIDENCIAL'),
                'identityProtectionMode' => (string) ($recordMeta['identityProtectionMode'] ?? 'standard'),
                'copyDeliverySlaHours' => (int) ($recordMeta['copyDeliverySlaHours'] ?? 48),
                'formsCatalogStatus' => (string) ($recordMeta['formsCatalogStatus'] ?? 'official_partial_traceability'),
                'confirmedForms' => is_array($recordMeta['confirmedForms'] ?? null)
                    ? array_values($recordMeta['confirmedForms'])
                    : [],
            ],
            'activeEpisode' => [
                'episodeId' => (string) ($draft['episodeId'] ?? ''),
                'caseId' => (string) ($session['caseId'] ?? ''),
                'status' => (string) ($session['status'] ?? 'active'),
                'legalStatus' => (string) ($legalReadiness['status'] ?? 'blocked'),
                'legalLabel' => (string) ($legalReadiness['label'] ?? 'Bloqueada'),
                'updatedAt' => (string) ($draft['updatedAt'] ?? $session['updatedAt'] ?? ''),
            ],
            'encounter' => [
                'encounterId' => (string) ($draft['encounterId'] ?? ''),
                'appointmentId' => $draft['appointmentId'] ?? $session['appointmentId'] ?? null,
                'surface' => (string) ($session['surface'] ?? ''),
                'startedAt' => (string) ($session['createdAt'] ?? ''),
                'updatedAt' => (string) ($draft['updatedAt'] ?? $session['updatedAt'] ?? ''),
            ],
            'liveNote' => [
                'summary' => $this->buildLiveNoteSummary($draft),
                'draftVersion' => max(1, (int) ($draft['version'] ?? 1)),
                'requiresHumanReview' => (bool) ($draft['requiresHumanReview'] ?? true),
                'reviewStatus' => (string) ($draft['reviewStatus'] ?? ''),
                'hcu005Status' => $hcu005Status,
            ],
            'documents' => $documents,
            'consent' => $consent,
            'approval' => $approval,
            'approvalState' => $approval,
            'legalReadiness' => $legalReadiness,
            'closureChecklist' => $legalReadiness,
            'approvalBlockedReasons' => $legalReadiness['blockingReasons'] ?? [],
            'recordsGovernance' => $recordsGovernance,
            'accessAudit' => $accessAudit,
            'disclosureLog' => $disclosureLog,
            'copyRequests' => $copyRequests,
            'archiveReadiness' => $archiveReadiness,
            'auditSummary' => [
                'accessAuditCount' => count($accessAudit),
                'disclosureLogCount' => count($disclosureLog),
                'copyRequestsCount' => count($copyRequests),
                'pendingCopyRequestsCount' => (int) ($recordsGovernance['copyRequestSummary']['pending'] ?? 0),
                'overdueCopyRequestsCount' => (int) ($recordsGovernance['copyRequestSummary']['overdue'] ?? 0),
                'lastAccessAt' => (string) (($recordsGovernance['lastAccessEvent']['createdAt'] ?? '')),
                'lastApprovedAt' => (string) ($approval['approvedAt'] ?? ''),
                'approvalStatus' => (string) ($approval['status'] ?? 'pending'),
            ],
        ];
    }

    private function openEpisode(array $store, array $payload): array
    {
        [$store, $session, $draft, $created] = $this->resolveSessionContext($store, $payload, true);

        $sessionSave = ClinicalHistoryRepository::upsertSession($store, $session);
        $store = $sessionSave['store'];
        $session = $sessionSave['session'];

        $draftSave = ClinicalHistoryRepository::upsertDraft($store, $draft);
        $store = $draftSave['store'];
        $draft = $draftSave['draft'];

        audit_log_event($created ? 'clinical_history.episode_opened' : 'clinical_history.episode_resumed', [
            'sessionId' => (string) ($session['sessionId'] ?? ''),
            'caseId' => (string) ($session['caseId'] ?? ''),
            'episodeId' => (string) ($draft['episodeId'] ?? ''),
        ]);

        return [
            'ok' => true,
            'statusCode' => $created ? 201 : 200,
            'store' => $store,
            'session' => $session,
            'draft' => $draft,
            'data' => $this->buildClinicalRecordPayload($store, $session, $draft),
        ];
    }

    private function mutateClinicalRecord(array $store, array $payload, string $mode): array
    {
        [$session, $draft] = $this->findContext($store, $payload);
        if ($session === null || $draft === null) {
            return [
                'ok' => false,
                'statusCode' => 404,
                'error' => 'Sesion clinica no encontrada',
                'errorCode' => 'clinical_history_not_found',
            ];
        }

        $reconciled = $this->reconcilePendingAi($store, $session, $draft);
        $store = $reconciled['store'];
        $session = $reconciled['session'];
        $draft = $reconciled['draft'];

        $draft = $this->applyDraftPatches($draft, $payload);
        $modeAuditReason = '';
        $modeAuditMeta = [];

        if (array_key_exists('requiresHumanReview', $payload)) {
            $draft['requiresHumanReview'] = (bool) $payload['requiresHumanReview'];
        }

        $question = ClinicalHistoryRepository::trimString(
            $payload['requestAdditionalQuestion'] ?? $payload['followUpQuestion'] ?? ''
        );
        if ($mode === 'follow-up' && $question !== '') {
            $session = ClinicalHistoryRepository::appendTranscriptMessage($session, [
                'role' => 'assistant',
                'actor' => 'clinician_review',
                'content' => ClinicalHistoryGuardrails::sanitizePatientText($question),
                'surface' => 'clinician_review',
                'meta' => [
                    'requestedBy' => $this->currentClinicalActor(),
                ],
            ]);
            $draft['requiresHumanReview'] = true;
            $draft['reviewStatus'] = 'review_required';
            $draft['status'] = 'review_required';
            $session['status'] = 'review_required';
        }

        if ($mode === 'copy-request') {
            $copyRequestResult = $this->applyCertifiedCopyRequest($session, $draft, $payload);
            if (($copyRequestResult['ok'] ?? false) !== true) {
                return $copyRequestResult;
            }
            $draft = $copyRequestResult['draft'];
            $modeAuditReason = 'certified_copy_requested';
            $modeAuditMeta = $copyRequestResult['meta'] ?? [];
        } elseif ($mode === 'copy-delivery') {
            $copyDeliveryResult = $this->applyCertifiedCopyDelivery($session, $draft, $payload);
            if (($copyDeliveryResult['ok'] ?? false) !== true) {
                return $copyDeliveryResult;
            }
            $draft = $copyDeliveryResult['draft'];
            $modeAuditReason = 'certified_copy_delivered';
            $modeAuditMeta = $copyDeliveryResult['meta'] ?? [];
        } elseif ($mode === 'disclosure') {
            $disclosureResult = $this->applyDisclosureAction($session, $draft, $payload);
            if (($disclosureResult['ok'] ?? false) !== true) {
                return $disclosureResult;
            }
            $draft = $disclosureResult['draft'];
            $modeAuditReason = 'disclosure_logged';
            $modeAuditMeta = $disclosureResult['meta'] ?? [];
        } elseif ($mode === 'archive-state') {
            $archiveResult = $this->applyArchiveStateAction($draft, $payload);
            if (($archiveResult['ok'] ?? false) !== true) {
                return $archiveResult;
            }
            $draft = $archiveResult['draft'];
            $modeAuditReason = 'archive_state_changed';
            $modeAuditMeta = $archiveResult['meta'] ?? [];
        }

        if ($mode === 'review-required') {
            $draft['requiresHumanReview'] = true;
            $draft['reviewStatus'] = 'review_required';
            $draft['status'] = 'review_required';
            $session['status'] = 'review_required';
        } elseif ($mode !== 'approve' && (bool) ($draft['requiresHumanReview'] ?? true) === false) {
            $session['status'] = ClinicalHistoryRepository::trimString($session['status'] ?? '') === 'approved'
                ? 'approved'
                : 'active';
            if (ClinicalHistoryRepository::trimString($draft['reviewStatus'] ?? '') === '') {
                $draft['reviewStatus'] = 'ready_for_review';
            }
        }

        $events = ClinicalHistoryRepository::findEventsBySessionId($store, (string) ($session['sessionId'] ?? ''));
        $legalReadiness = ClinicalHistoryLegalReadiness::build($session, $draft, $events);

        if ($mode === 'approve') {
            if (($legalReadiness['ready'] ?? false) !== true) {
                audit_log_event('clinical_history.approval_blocked', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                    'blockingReasons' => $legalReadiness['blockingReasons'] ?? [],
                ]);

                return [
                    'ok' => false,
                    'statusCode' => 409,
                    'error' => 'La nota final no esta lista para aprobar.',
                    'errorCode' => 'clinical_history_approval_blocked',
                ];
            }

            $draft = $this->applyClinicalApproval($session, $draft, $legalReadiness);
            $session['status'] = 'approved';
            $store = $this->touchSessionEventsForReview($store, $session, true);
            audit_log_event('clinical_history.approved', [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'caseId' => (string) ($session['caseId'] ?? ''),
                'approvedBy' => (string) ($draft['approval']['approvedBy'] ?? ''),
                'finalDraftVersion' => (int) ($draft['approval']['finalDraftVersion'] ?? 0),
            ]);
        } else {
            $resolveEvents = in_array($mode, ['save', 'consent', 'revoke-consent', 'prescription', 'certificate'], true)
                && ((bool) ($draft['requiresHumanReview'] ?? true) === false);
            $store = $this->touchSessionEventsForReview($store, $session, $resolveEvents);

            if ($mode === 'save') {
                audit_log_event('clinical_history.draft_saved', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                ]);
            } elseif ($mode === 'follow-up') {
                audit_log_event('clinical_history.follow_up_requested', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                    'question' => $question,
                ]);
            } elseif ($mode === 'review-required') {
                audit_log_event('clinical_history.review_required', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                ]);
            } elseif ($mode === 'consent') {
                audit_log_event('clinical_history.consent_recorded', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                    'status' => (string) ($draft['consent']['status'] ?? ''),
                ]);
            } elseif ($mode === 'revoke-consent') {
                audit_log_event('clinical_history.consent_revoked', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                ]);
            } elseif ($mode === 'prescription') {
                audit_log_event('clinical_history.prescription_saved', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                ]);
            } elseif ($mode === 'certificate') {
                audit_log_event('clinical_history.certificate_saved', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                ]);
            } elseif ($mode === 'copy-request') {
                audit_log_event('clinical_history.certified_copy_requested', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                    'requestId' => (string) (($modeAuditMeta['requestId'] ?? '')),
                ]);
            } elseif ($mode === 'copy-delivery') {
                audit_log_event('clinical_history.certified_copy_delivered', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                    'requestId' => (string) (($modeAuditMeta['requestId'] ?? '')),
                    'deliveredTo' => (string) (($modeAuditMeta['deliveredTo'] ?? '')),
                ]);
            } elseif ($mode === 'disclosure') {
                audit_log_event('clinical_history.disclosure_logged', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                    'targetType' => (string) (($modeAuditMeta['targetType'] ?? '')),
                    'targetName' => (string) (($modeAuditMeta['targetName'] ?? '')),
                ]);
            } elseif ($mode === 'archive-state') {
                audit_log_event('clinical_history.archive_state_set', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                    'archiveState' => (string) (($modeAuditMeta['archiveState'] ?? '')),
                    'overrideReason' => (string) (($modeAuditMeta['overrideReason'] ?? '')),
                ]);
            }
        }

        $draft = $this->touchDraft($draft);
        $session = $this->touchSession($session);

        $sessionSave = ClinicalHistoryRepository::upsertSession($store, $session);
        $store = $sessionSave['store'];
        $session = $sessionSave['session'];

        $draftSave = ClinicalHistoryRepository::upsertDraft($store, $draft);
        $store = $draftSave['store'];
        $draft = $draftSave['draft'];
        $store = $this->recordAccessAudit(
            $store,
            $session,
            $draft,
            $this->accessAuditActionForMode($mode),
            $modeAuditReason !== '' ? $modeAuditReason : $mode,
            $modeAuditMeta
        );

        return [
            'ok' => true,
            'statusCode' => 200,
            'store' => $store,
            'session' => $session,
            'draft' => $draft,
            'data' => $this->buildClinicalRecordPayload($store, $session, $draft),
        ];
    }

    private function applyDraftPatches(array $draft, array $payload): array
    {
        $draft = ClinicalHistoryRepository::adminDraft($draft);
        $draftPatch = isset($payload['draft']) && is_array($payload['draft'])
            ? $payload['draft']
            : [];

        if (isset($payload['intakePatch']) && is_array($payload['intakePatch'])) {
            $draftPatch['intake'] = array_merge(
                isset($draftPatch['intake']) && is_array($draftPatch['intake']) ? $draftPatch['intake'] : [],
                $payload['intakePatch']
            );
        }

        if (isset($payload['liveNote']) && is_array($payload['liveNote'])) {
            $draftPatch['clinicianDraft'] = array_merge(
                isset($draftPatch['clinicianDraft']) && is_array($draftPatch['clinicianDraft']) ? $draftPatch['clinicianDraft'] : [],
                $payload['liveNote']
            );
        }

        if (isset($draftPatch['intake']) && is_array($draftPatch['intake'])) {
            $draft = ClinicalHistoryGuardrails::applyPatchToDraft($draft, $draftPatch['intake']);
            if (array_key_exists('preguntasFaltantes', $draftPatch['intake'])) {
                $draft['intake']['preguntasFaltantes'] = ClinicalHistoryRepository::normalizeStringList(
                    $draftPatch['intake']['preguntasFaltantes']
                );
            }
            if (array_key_exists('rosRedFlags', $draftPatch['intake'])) {
                $draft['intake']['rosRedFlags'] = ClinicalHistoryRepository::normalizeStringList(
                    $draftPatch['intake']['rosRedFlags']
                );
            }
            if (array_key_exists('cie10Sugeridos', $draftPatch['intake'])) {
                $draft['intake']['cie10Sugeridos'] = ClinicalHistoryRepository::normalizeStringList(
                    $draftPatch['intake']['cie10Sugeridos']
                );
            }
        }

        if (isset($draftPatch['clinicianDraft']) && is_array($draftPatch['clinicianDraft'])) {
            $draft['clinicianDraft'] = ClinicalHistoryRepository::normalizeClinicianDraft(array_merge(
                $draft['clinicianDraft'] ?? [],
                $draftPatch['clinicianDraft']
            ));
        }

        if (isset($payload['documents']) && is_array($payload['documents'])) {
            $draft['documents'] = ClinicalHistoryRepository::normalizeClinicalDocuments(array_replace_recursive(
                is_array($draft['documents'] ?? null) ? $draft['documents'] : [],
                $payload['documents']
            ));
        }

        if (isset($payload['consent']) && is_array($payload['consent'])) {
            $draft['consent'] = ClinicalHistoryRepository::normalizeConsentRecord(array_merge(
                is_array($draft['consent'] ?? null) ? $draft['consent'] : [],
                $payload['consent']
            ));
        }

        if (isset($payload['recordMeta']) && is_array($payload['recordMeta'])) {
            $draft['recordMeta'] = ClinicalHistoryRepository::normalizeRecordMeta(array_merge(
                is_array($draft['recordMeta'] ?? null) ? $draft['recordMeta'] : [],
                $payload['recordMeta']
            ));
        }

        return $this->synchronizeHcu005Draft($draft);
    }

    private function applyClinicalApproval(array $session, array $draft, array $legalReadiness): array
    {
        $draft = $this->synchronizeHcu005Draft(ClinicalHistoryRepository::adminDraft($draft));
        $documents = ClinicalHistoryRepository::normalizeClinicalDocuments(
            is_array($draft['documents'] ?? null) ? $draft['documents'] : []
        );
        $clinicianDraft = ClinicalHistoryRepository::normalizeClinicianDraft(
            is_array($draft['clinicianDraft'] ?? null) ? $draft['clinicianDraft'] : []
        );
        $hcu005 = ClinicalHistoryRepository::normalizeHcu005Draft(
            $clinicianDraft['hcu005'] ?? []
        );
        $summary = ClinicalHistoryRepository::renderHcu005Summary($hcu005);
        $content = $this->buildFinalNoteContent($session, $draft);
        $prescriptionItems = ClinicalHistoryRepository::normalizePrescriptionItems(
            $hcu005['prescriptionItems'] ?? []
        );
        $now = local_date('c');

        $documents['finalNote'] = [
            'status' => 'approved',
            'summary' => $summary,
            'content' => $content,
            'version' => max(1, (int) ($draft['version'] ?? 1)) + 1,
            'generatedAt' => $now,
            'confidential' => true,
            'sections' => [
                'hcu005' => ClinicalHistoryRepository::normalizeHcu005Section($hcu005),
            ],
        ];
        $documents['prescription']['items'] = $prescriptionItems;
        $documents['prescription']['medication'] = ClinicalHistoryRepository::renderPrescriptionMedicationMirror($prescriptionItems);
        $documents['prescription']['directions'] = ClinicalHistoryRepository::renderPrescriptionDirectionsMirror($prescriptionItems);

        if (ClinicalHistoryRepository::trimString($documents['prescription']['medication'] ?? '') !== ''
            || ClinicalHistoryRepository::trimString($documents['prescription']['directions'] ?? '') !== ''
        ) {
            $documents['prescription']['status'] = 'issued';
            $documents['prescription']['signedAt'] = $now;
        }

        if (ClinicalHistoryRepository::trimString($documents['certificate']['summary'] ?? '') !== '') {
            $documents['certificate']['status'] = 'issued';
            $documents['certificate']['signedAt'] = $now;
        }

        $draft['documents'] = $documents;
        $draft['approval'] = ClinicalHistoryRepository::normalizeApprovalRecord([
            'status' => 'approved',
            'approvedBy' => $this->currentClinicalActor(),
            'approvedAt' => $now,
            'finalDraftVersion' => max(1, (int) ($draft['version'] ?? 1)) + 1,
            'checklistSnapshot' => $legalReadiness['checklist'] ?? [],
            'aiTraceSnapshot' => $this->buildAiTraceSnapshot($session, $draft),
            'notes' => ClinicalHistoryRepository::trimString($draft['approval']['notes'] ?? ''),
            'normativeSources' => $legalReadiness['normativeSources'] ?? [],
        ]);
        $draft['reviewStatus'] = 'approved';
        $draft['status'] = 'approved';
        $draft['requiresHumanReview'] = false;

        return $draft;
    }

    private function buildFinalNoteContent(array $session, array $draft): string
    {
        $patient = is_array($session['patient'] ?? null) ? $session['patient'] : [];
        $intake = is_array($draft['intake'] ?? null) ? $draft['intake'] : [];
        $clinicianDraft = ClinicalHistoryRepository::normalizeClinicianDraft(
            is_array($draft['clinicianDraft'] ?? null) ? $draft['clinicianDraft'] : []
        );
        $hcu005 = ClinicalHistoryRepository::normalizeHcu005Draft(
            $clinicianDraft['hcu005'] ?? []
        );
        $consent = ClinicalHistoryRepository::normalizeConsentRecord(
            is_array($draft['consent'] ?? null) ? $draft['consent'] : []
        );

        $parts = [
            'Paciente: ' . (
                ClinicalHistoryRepository::trimString($patient['name'] ?? '') !== ''
                    ? ClinicalHistoryRepository::trimString($patient['name'] ?? '')
                    : 'Sin identificacion visible'
            ),
            'Motivo de consulta: ' . ClinicalHistoryRepository::trimString($intake['motivoConsulta'] ?? ''),
            'Enfermedad actual: ' . ClinicalHistoryRepository::trimString($intake['enfermedadActual'] ?? ''),
            'Evolucion clinica: ' . ClinicalHistoryRepository::trimString($hcu005['evolutionNote'] ?? ''),
            'Impresion diagnostica: ' . ClinicalHistoryRepository::trimString($hcu005['diagnosticImpression'] ?? ''),
            'Plan terapeutico: ' . ClinicalHistoryRepository::trimString($hcu005['therapeuticPlan'] ?? ''),
            'Indicaciones / cuidados: ' . ClinicalHistoryRepository::trimString($hcu005['careIndications'] ?? ''),
            'Consentimiento: ' . ClinicalHistoryRepository::trimString($consent['status'] ?? 'not_required'),
        ];

        return trim(implode("\n", array_filter($parts, static function ($item): bool {
            return is_string($item) && trim($item) !== '';
        })));
    }

    private function synchronizeHcu005Draft(array $draft): array
    {
        $draft = ClinicalHistoryRepository::adminDraft($draft);
        $clinicianDraft = ClinicalHistoryRepository::normalizeClinicianDraft(
            is_array($draft['clinicianDraft'] ?? null) ? $draft['clinicianDraft'] : []
        );
        $documents = ClinicalHistoryRepository::normalizeClinicalDocuments(
            is_array($draft['documents'] ?? null) ? $draft['documents'] : []
        );

        $existingItems = ClinicalHistoryRepository::normalizePrescriptionItems(
            $documents['prescription']['items'] ?? []
        );
        if (($clinicianDraft['hcu005']['prescriptionItems'] ?? []) === [] && $existingItems !== []) {
            $clinicianDraft['hcu005']['prescriptionItems'] = $existingItems;
            $clinicianDraft = ClinicalHistoryRepository::normalizeClinicianDraft($clinicianDraft);
        }

        $hcu005 = ClinicalHistoryRepository::normalizeHcu005Draft(
            $clinicianDraft['hcu005'] ?? []
        );
        $documents['finalNote']['sections'] = [
            'hcu005' => ClinicalHistoryRepository::normalizeHcu005Section($hcu005),
        ];
        $documents['finalNote']['summary'] = ClinicalHistoryRepository::renderHcu005Summary($hcu005);
        $documents['finalNote']['content'] = $this->buildFinalNoteContent([], [
            'intake' => $draft['intake'] ?? [],
            'clinicianDraft' => $clinicianDraft,
            'consent' => $draft['consent'] ?? [],
        ]);
        $documents['prescription']['items'] = ClinicalHistoryRepository::normalizePrescriptionItems(
            $hcu005['prescriptionItems'] ?? []
        );
        $documents['prescription']['medication'] = ClinicalHistoryRepository::renderPrescriptionMedicationMirror(
            $documents['prescription']['items']
        );
        $documents['prescription']['directions'] = ClinicalHistoryRepository::renderPrescriptionDirectionsMirror(
            $documents['prescription']['items']
        );

        $draft['clinicianDraft'] = $clinicianDraft;
        $draft['documents'] = $documents;

        return $draft;
    }

    private function buildLiveNoteSummary(array $draft): string
    {
        $draft = ClinicalHistoryRepository::adminDraft($draft);
        $clinicianDraft = ClinicalHistoryRepository::normalizeClinicianDraft(
            is_array($draft['clinicianDraft'] ?? null) ? $draft['clinicianDraft'] : []
        );
        $hcu005 = ClinicalHistoryRepository::normalizeHcu005Draft(
            $clinicianDraft['hcu005'] ?? []
        );

        return ClinicalHistoryRepository::trimString(
            ClinicalHistoryRepository::renderHcu005Summary($hcu005)
                ?: ($clinicianDraft['resumen'] ?? '')
                ?: ($draft['intake']['resumenClinico'] ?? '')
        );
    }

    private function buildAiTraceSnapshot(array $session, array $draft): array
    {
        $pendingAi = ClinicalHistoryRepository::normalizePendingAi(
            is_array($session['pendingAi'] ?? null)
                ? $session['pendingAi']
                : (is_array($draft['pendingAi'] ?? null) ? $draft['pendingAi'] : [])
        );

        return [
            'pendingAi' => $pendingAi,
            'lastPendingAi' => isset($session['metadata']['lastPendingAi']) && is_array($session['metadata']['lastPendingAi'])
                ? $session['metadata']['lastPendingAi']
                : [],
            'lastAiEnvelope' => isset($draft['lastAiEnvelope']) && is_array($draft['lastAiEnvelope'])
                ? $draft['lastAiEnvelope']
                : [],
        ];
    }

    private function decorateCopyRequest(array $request): array
    {
        $request = ClinicalHistoryRepository::normalizeCopyRequests([$request])[0] ?? [];
        $effectiveStatus = $this->resolveCopyRequestEffectiveStatus($request);

        return array_merge($request, [
            'effectiveStatus' => $effectiveStatus,
            'statusLabel' => match ($effectiveStatus) {
                'delivered' => 'Entregada',
                'overdue' => 'Vencida',
                default => 'Pendiente',
            },
        ]);
    }

    private function resolveCopyRequestEffectiveStatus(array $request): string
    {
        $status = ClinicalHistoryRepository::trimString($request['status'] ?? '');
        if ($status === 'delivered' || ClinicalHistoryRepository::trimString($request['deliveredAt'] ?? '') !== '') {
            return 'delivered';
        }

        $dueAt = ClinicalHistoryRepository::trimString($request['dueAt'] ?? '');
        if ($dueAt !== '' && $this->timestampIsPast($dueAt)) {
            return 'overdue';
        }

        return 'requested';
    }

    private function buildArchiveReadiness(array $recordMeta): array
    {
        $archiveState = ClinicalHistoryRepository::trimString($recordMeta['archiveState'] ?? 'active');
        if ($archiveState === '') {
            $archiveState = 'active';
        }

        $lastAttentionAt = ClinicalHistoryRepository::trimString($recordMeta['lastAttentionAt'] ?? '');
        $passiveAfterYears = max(1, (int) ($recordMeta['passiveAfterYears'] ?? 5));
        $eligibleAt = '';
        $eligibleForPassive = false;
        $daysUntilPassive = null;

        if ($lastAttentionAt !== '') {
            try {
                $lastAttention = new \DateTimeImmutable($lastAttentionAt);
                $eligibleDate = $lastAttention->add(new \DateInterval('P' . $passiveAfterYears . 'Y'));
                $eligibleAt = $eligibleDate->format('c');
                $now = new \DateTimeImmutable(local_date('c'));
                $eligibleForPassive = $eligibleDate <= $now;
                $daysUntilPassive = $eligibleForPassive
                    ? 0
                    : (int) $now->diff($eligibleDate)->format('%a');
            } catch (\Throwable $e) {
                $eligibleAt = '';
                $eligibleForPassive = false;
                $daysUntilPassive = null;
            }
        }

        $label = 'Activa';
        if ($archiveState === 'passive') {
            $label = 'Pasiva';
        } elseif ($eligibleForPassive) {
            $label = 'Elegible para pasiva';
        }

        return [
            'archiveState' => $archiveState,
            'lastAttentionAt' => $lastAttentionAt,
            'passiveAfterYears' => $passiveAfterYears,
            'eligibleForPassive' => $eligibleForPassive,
            'eligibleAt' => $eligibleAt,
            'daysUntilPassive' => $daysUntilPassive,
            'recommendedState' => $eligibleForPassive ? 'passive' : 'active',
            'label' => $label,
            'overrideRequired' => $archiveState !== 'passive' && $eligibleForPassive !== true,
        ];
    }

    private function buildRecordsGovernance(
        array $recordMeta,
        array $archiveReadiness,
        array $copyRequests,
        array $disclosureLog,
        array $accessAudit
    ): array {
        $pending = 0;
        $delivered = 0;
        $overdue = 0;

        foreach ($copyRequests as $request) {
            $effectiveStatus = ClinicalHistoryRepository::trimString($request['effectiveStatus'] ?? '');
            if ($effectiveStatus === 'delivered') {
                $delivered++;
                continue;
            }

            $pending++;
            if ($effectiveStatus === 'overdue') {
                $overdue++;
            }
        }

        return [
            'archiveState' => (string) ($recordMeta['archiveState'] ?? 'active'),
            'archiveReadiness' => $archiveReadiness,
            'copyRequestSummary' => [
                'total' => count($copyRequests),
                'pending' => $pending,
                'delivered' => $delivered,
                'overdue' => $overdue,
                'latestRequest' => $copyRequests[0] ?? null,
            ],
            'disclosureSummary' => [
                'total' => count($disclosureLog),
                'latest' => $disclosureLog[0] ?? null,
            ],
            'lastAccessEvent' => $accessAudit[0] ?? null,
            'confidentialityLabel' => (string) ($recordMeta['confidentialityLabel'] ?? 'CONFIDENCIAL'),
            'identityProtectionMode' => (string) ($recordMeta['identityProtectionMode'] ?? 'standard'),
        ];
    }

    private function applyCertifiedCopyRequest(array $session, array $draft, array $payload): array
    {
        $draft = ClinicalHistoryRepository::adminDraft($draft);
        $recordMeta = ClinicalHistoryRepository::normalizeRecordMeta(
            is_array($draft['recordMeta'] ?? null) ? $draft['recordMeta'] : [],
            $session,
            $draft
        );
        $patient = ClinicalHistoryRepository::normalizePatient(
            is_array($session['patient'] ?? null) ? $session['patient'] : []
        );
        $requestedByType = ClinicalHistoryRepository::trimString(
            $payload['requestedByType'] ?? $payload['copyRequest']['requestedByType'] ?? 'patient'
        );
        if ($requestedByType === '') {
            $requestedByType = 'patient';
        }

        $requestedByName = ClinicalHistoryRepository::trimString(
            $payload['requestedByName']
                ?? $payload['copyRequest']['requestedByName']
                ?? $payload['requestedBy']
                ?? ($requestedByType === 'patient' ? ($patient['name'] ?? '') : '')
        );
        if ($requestedByName === '') {
            $requestedByName = $requestedByType === 'patient' ? 'Paciente' : 'Solicitante';
        }

        $requestedAt = local_date('c');
        $dueAt = $this->addHoursToTimestamp(
            $requestedAt,
            (int) ($recordMeta['copyDeliverySlaHours'] ?? 48)
        );
        $requestId = ClinicalHistoryRepository::newOpaqueId('copy');

        $copyRequests = ClinicalHistoryRepository::normalizeCopyRequests($draft['copyRequests'] ?? []);
        $copyRequests[] = [
            'requestId' => $requestId,
            'requestedByType' => $requestedByType,
            'requestedByName' => $requestedByName,
            'requestedAt' => $requestedAt,
            'dueAt' => $dueAt,
            'status' => 'requested',
            'legalBasis' => ClinicalHistoryRepository::trimString(
                $payload['legalBasis'] ?? $payload['copyRequest']['legalBasis'] ?? ''
            ),
            'notes' => ClinicalHistoryRepository::trimString(
                $payload['notes'] ?? $payload['copyRequest']['notes'] ?? ''
            ),
            'deliveredAt' => '',
            'deliveryChannel' => '',
            'deliveredTo' => '',
        ];
        $draft['copyRequests'] = ClinicalHistoryRepository::normalizeCopyRequests($copyRequests);

        return [
            'ok' => true,
            'draft' => $draft,
            'meta' => [
                'requestId' => $requestId,
                'requestedByType' => $requestedByType,
                'requestedByName' => $requestedByName,
                'dueAt' => $dueAt,
            ],
        ];
    }

    private function applyCertifiedCopyDelivery(array $session, array $draft, array $payload): array
    {
        $draft = ClinicalHistoryRepository::adminDraft($draft);
        $copyRequests = ClinicalHistoryRepository::normalizeCopyRequests($draft['copyRequests'] ?? []);
        $requestId = ClinicalHistoryRepository::trimString(
            $payload['requestId'] ?? $payload['copyRequest']['requestId'] ?? ''
        );
        if ($requestId === '') {
            return [
                'ok' => false,
                'statusCode' => 400,
                'error' => 'requestId es obligatorio para entregar una copia certificada.',
                'errorCode' => 'clinical_copy_request_required',
            ];
        }

        $matchedIndex = null;
        foreach ($copyRequests as $index => $request) {
            if (ClinicalHistoryRepository::trimString($request['requestId'] ?? '') === $requestId) {
                $matchedIndex = $index;
                break;
            }
        }

        if ($matchedIndex === null) {
            return [
                'ok' => false,
                'statusCode' => 404,
                'error' => 'No existe la solicitud de copia certificada indicada.',
                'errorCode' => 'clinical_copy_request_not_found',
            ];
        }

        $selectedRequest = $copyRequests[$matchedIndex];
        if ($this->resolveCopyRequestEffectiveStatus($selectedRequest) === 'delivered') {
            return [
                'ok' => false,
                'statusCode' => 409,
                'error' => 'La copia certificada seleccionada ya fue entregada.',
                'errorCode' => 'clinical_copy_request_already_delivered',
            ];
        }

        $deliveredAt = local_date('c');
        $deliveryChannel = ClinicalHistoryRepository::trimString(
            $payload['deliveryChannel'] ?? $payload['copyRequest']['deliveryChannel'] ?? 'manual_delivery'
        );
        $deliveredTo = ClinicalHistoryRepository::trimString(
            $payload['deliveredTo']
                ?? $payload['copyRequest']['deliveredTo']
                ?? ($selectedRequest['requestedByName'] ?? '')
        );
        if ($deliveredTo === '') {
            $deliveredTo = 'Paciente';
        }

        $targetType = ClinicalHistoryRepository::trimString($selectedRequest['requestedByType'] ?? 'patient');
        $consent = ClinicalHistoryRepository::normalizeConsentRecord(
            is_array($draft['consent'] ?? null) ? $draft['consent'] : []
        );
        $legalBasis = ClinicalHistoryRepository::trimString($selectedRequest['legalBasis'] ?? '');
        if ($targetType === 'companion' && ($consent['companionShareAuthorized'] ?? false) !== true) {
            return [
                'ok' => false,
                'statusCode' => 409,
                'error' => 'No se puede entregar la copia a un acompanante sin autorizacion expresa.',
                'errorCode' => 'clinical_companion_disclosure_requires_consent',
            ];
        }
        if ($targetType === 'external_third_party' && $legalBasis === '') {
            return [
                'ok' => false,
                'statusCode' => 409,
                'error' => 'No se puede entregar la copia a un tercero externo sin base legal escrita.',
                'errorCode' => 'clinical_external_disclosure_requires_legal_basis',
            ];
        }

        $selectedRequest['status'] = 'delivered';
        $selectedRequest['deliveredAt'] = $deliveredAt;
        $selectedRequest['deliveryChannel'] = $deliveryChannel;
        $selectedRequest['deliveredTo'] = $deliveredTo;
        $selectedRequest['notes'] = ClinicalHistoryRepository::trimString(
            $payload['notes'] ?? $payload['copyRequest']['notes'] ?? $selectedRequest['notes'] ?? ''
        );
        $copyRequests[$matchedIndex] = $selectedRequest;
        $draft['copyRequests'] = ClinicalHistoryRepository::normalizeCopyRequests($copyRequests);

        $disclosureLog = ClinicalHistoryRepository::normalizeDisclosureLog($draft['disclosureLog'] ?? []);
        $disclosureId = ClinicalHistoryRepository::newOpaqueId('disclosure');
        $disclosureLog[] = [
            'disclosureId' => $disclosureId,
            'targetType' => $targetType !== '' ? $targetType : 'patient',
            'targetName' => $deliveredTo,
            'purpose' => 'Entrega de copia certificada',
            'legalBasis' => $legalBasis,
            'authorizedByConsent' => $targetType === 'companion'
                ? (($consent['companionShareAuthorized'] ?? false) === true)
                : false,
            'performedBy' => $this->currentClinicalActor(),
            'performedAt' => $deliveredAt,
            'channel' => $deliveryChannel,
            'notes' => $selectedRequest['notes'] ?? '',
        ];
        $draft['disclosureLog'] = ClinicalHistoryRepository::normalizeDisclosureLog($disclosureLog);

        return [
            'ok' => true,
            'draft' => $draft,
            'meta' => [
                'requestId' => $requestId,
                'deliveredTo' => $deliveredTo,
                'deliveryChannel' => $deliveryChannel,
                'disclosureId' => $disclosureId,
            ],
        ];
    }

    private function applyDisclosureAction(array $session, array $draft, array $payload): array
    {
        $draft = ClinicalHistoryRepository::adminDraft($draft);
        $patient = ClinicalHistoryRepository::normalizePatient(
            is_array($session['patient'] ?? null) ? $session['patient'] : []
        );
        $consent = ClinicalHistoryRepository::normalizeConsentRecord(
            is_array($draft['consent'] ?? null) ? $draft['consent'] : []
        );
        $targetType = ClinicalHistoryRepository::trimString(
            $payload['targetType'] ?? $payload['disclosure']['targetType'] ?? 'patient'
        );
        if ($targetType === '') {
            $targetType = 'patient';
        }

        $targetName = ClinicalHistoryRepository::trimString(
            $payload['targetName']
                ?? $payload['disclosure']['targetName']
                ?? ($targetType === 'patient' ? ($patient['name'] ?? '') : '')
        );
        if ($targetName === '') {
            $targetName = $targetType === 'patient' ? 'Paciente' : 'Destinatario';
        }

        $legalBasis = ClinicalHistoryRepository::trimString(
            $payload['legalBasis'] ?? $payload['disclosure']['legalBasis'] ?? ''
        );
        if ($targetType === 'companion' && ($consent['companionShareAuthorized'] ?? false) !== true) {
            return [
                'ok' => false,
                'statusCode' => 409,
                'error' => 'No se puede registrar disclosure a acompanante sin autorizacion expresa.',
                'errorCode' => 'clinical_companion_disclosure_requires_consent',
            ];
        }
        if ($targetType === 'external_third_party' && $legalBasis === '') {
            return [
                'ok' => false,
                'statusCode' => 409,
                'error' => 'No se puede registrar disclosure a tercero externo sin base legal escrita.',
                'errorCode' => 'clinical_external_disclosure_requires_legal_basis',
            ];
        }

        $performedAt = local_date('c');
        $disclosureLog = ClinicalHistoryRepository::normalizeDisclosureLog($draft['disclosureLog'] ?? []);
        $disclosureId = ClinicalHistoryRepository::newOpaqueId('disclosure');
        $disclosureLog[] = [
            'disclosureId' => $disclosureId,
            'targetType' => $targetType,
            'targetName' => $targetName,
            'purpose' => ClinicalHistoryRepository::trimString(
                $payload['purpose'] ?? $payload['disclosure']['purpose'] ?? ''
            ),
            'legalBasis' => $legalBasis,
            'authorizedByConsent' => $targetType === 'companion'
                ? (($consent['companionShareAuthorized'] ?? false) === true)
                : false,
            'performedBy' => $this->currentClinicalActor(),
            'performedAt' => $performedAt,
            'channel' => ClinicalHistoryRepository::trimString(
                $payload['channel'] ?? $payload['disclosure']['channel'] ?? 'manual_note'
            ),
            'notes' => ClinicalHistoryRepository::trimString(
                $payload['notes'] ?? $payload['disclosure']['notes'] ?? ''
            ),
        ];
        $draft['disclosureLog'] = ClinicalHistoryRepository::normalizeDisclosureLog($disclosureLog);

        return [
            'ok' => true,
            'draft' => $draft,
            'meta' => [
                'disclosureId' => $disclosureId,
                'targetType' => $targetType,
                'targetName' => $targetName,
            ],
        ];
    }

    private function applyArchiveStateAction(array $draft, array $payload): array
    {
        $draft = ClinicalHistoryRepository::adminDraft($draft);
        $desiredState = ClinicalHistoryRepository::trimString(
            $payload['archiveState'] ?? $payload['recordMeta']['archiveState'] ?? ''
        );
        if ($desiredState === '') {
            return [
                'ok' => false,
                'statusCode' => 400,
                'error' => 'archiveState es obligatorio para actualizar la custodia del record.',
                'errorCode' => 'clinical_archive_state_required',
            ];
        }

        if (!in_array($desiredState, ['active', 'passive'], true)) {
            return [
                'ok' => false,
                'statusCode' => 400,
                'error' => 'archiveState debe ser active o passive.',
                'errorCode' => 'clinical_archive_state_invalid',
            ];
        }

        $recordMeta = ClinicalHistoryRepository::normalizeRecordMeta(
            is_array($draft['recordMeta'] ?? null) ? $draft['recordMeta'] : []
        );
        $overrideReason = ClinicalHistoryRepository::trimString(
            $payload['overrideReason'] ?? $payload['recordMeta']['overrideReason'] ?? ''
        );
        $archiveReadiness = $this->buildArchiveReadiness($recordMeta);
        if (
            $desiredState === 'passive'
            && ($archiveReadiness['eligibleForPassive'] ?? false) !== true
            && $overrideReason === ''
        ) {
            return [
                'ok' => false,
                'statusCode' => 409,
                'error' => 'El record todavia no es elegible para archivo pasivo sin una razon de override.',
                'errorCode' => 'clinical_archive_override_required',
            ];
        }

        $recordMeta['archiveState'] = $desiredState;
        $draft['recordMeta'] = ClinicalHistoryRepository::normalizeRecordMeta($recordMeta);

        return [
            'ok' => true,
            'draft' => $draft,
            'meta' => [
                'archiveState' => $desiredState,
                'overrideReason' => $overrideReason,
            ],
        ];
    }

    private function accessAuditActionForMode(string $mode): string
    {
        return match ($mode) {
            'save' => 'edit_record',
            'approve' => 'approve_final_note',
            'follow-up' => 'request_missing_data',
            'review-required' => 'mark_review_required',
            'consent' => 'record_consent',
            'revoke-consent' => 'revoke_consent',
            'prescription' => 'issue_prescription',
            'certificate' => 'issue_certificate',
            'copy-request' => 'request_certified_copy',
            'copy-delivery' => 'deliver_certified_copy',
            'disclosure' => 'log_disclosure',
            'archive-state' => 'set_archive_state',
            default => 'edit_record',
        };
    }

    private function recordAccessAudit(
        array $store,
        array $session,
        array $draft,
        string $action,
        string $reason,
        array $meta = []
    ): array {
        return ClinicalHistoryRepository::appendAccessAudit(
            $store,
            $this->buildAccessAuditEntry($session, $draft, $action, $reason, $meta)
        );
    }

    private function buildAccessAuditEntry(
        array $session,
        array $draft,
        string $action,
        string $reason,
        array $meta = []
    ): array {
        return [
            'recordId' => (string) ($draft['patientRecordId'] ?? ''),
            'sessionId' => (string) ($session['sessionId'] ?? ''),
            'episodeId' => (string) ($draft['episodeId'] ?? ''),
            'actor' => $this->currentClinicalActor(),
            'actorRole' => 'clinician_admin',
            'action' => $action,
            'resource' => 'clinical_record',
            'reason' => $reason,
            'createdAt' => local_date('c'),
            'meta' => $meta,
        ];
    }

    private function addHoursToTimestamp(string $stamp, int $hours): string
    {
        $hours = max(1, $hours);
        try {
            return (new \DateTimeImmutable($stamp))
                ->add(new \DateInterval('PT' . $hours . 'H'))
                ->format('c');
        } catch (\Throwable $e) {
            return $stamp;
        }
    }

    private function timestampIsPast(string $stamp): bool
    {
        try {
            return (new \DateTimeImmutable($stamp)) <= new \DateTimeImmutable(local_date('c'));
        } catch (\Throwable $e) {
            return false;
        }
    }

    private function currentClinicalActor(): string
    {
        if (function_exists('operator_auth_current_identity')) {
            $operator = operator_auth_current_identity(false);
            if (is_array($operator)) {
                $name = ClinicalHistoryRepository::trimString($operator['name'] ?? '');
                if ($name !== '') {
                    return $name;
                }
                $email = ClinicalHistoryRepository::trimString($operator['email'] ?? '');
                if ($email !== '') {
                    return $email;
                }
            }
        }

        return 'admin@local';
    }

    private function resolveSessionContext(array $store, array $payload, bool $createIfMissing): array
    {
        $sessionId = ClinicalHistoryRepository::trimString($payload['sessionId'] ?? '');
        $caseId = ClinicalHistoryRepository::trimString($payload['caseId'] ?? '');

        $session = $sessionId !== ''
            ? ClinicalHistoryRepository::findSessionBySessionId($store, $sessionId)
            : null;
        if ($session === null && $caseId !== '') {
            $session = ClinicalHistoryRepository::findSessionByCaseId($store, $caseId);
        }

        $created = false;
        if ($session === null) {
            if (!$createIfMissing) {
                return [$store, ClinicalHistoryRepository::defaultSession(), ClinicalHistoryRepository::defaultDraft([], []), false];
            }

            $session = ClinicalHistoryRepository::defaultSession([
                'sessionId' => $sessionId,
                'caseId' => $caseId,
                'appointmentId' => $payload['appointmentId'] ?? null,
                'surface' => $payload['surface'] ?? 'web_chat',
                'patient' => isset($payload['patient']) && is_array($payload['patient']) ? $payload['patient'] : [],
                'metadata' => [
                    'source' => ClinicalHistoryRepository::trimString($payload['source'] ?? 'clinical_intake'),
                ],
            ]);
            $created = true;
        } else {
            $session = ClinicalHistoryRepository::adminSession($session);
            $session['surface'] = ClinicalHistoryRepository::trimString($payload['surface'] ?? $session['surface'] ?? 'web_chat');
            $session['surfaces'] = ClinicalHistoryRepository::normalizeStringList(array_merge(
                $session['surfaces'] ?? [],
                [$session['surface']]
            ));
            $appointmentId = ClinicalHistoryRepository::nullablePositiveInt($payload['appointmentId'] ?? null);
            if ($appointmentId !== null) {
                $session['appointmentId'] = $appointmentId;
            }
            if ($caseId !== '') {
                $session['caseId'] = $caseId;
            }
            if ($sessionId !== '') {
                $session['sessionId'] = $sessionId;
            }
            if (isset($payload['patient']) && is_array($payload['patient'])) {
                $session['patient'] = ClinicalHistoryRepository::normalizePatient(array_merge(
                    $session['patient'] ?? [],
                    $payload['patient']
                ));
            }
        }

        $draft = ClinicalHistoryRepository::findDraftBySessionId($store, (string) ($session['sessionId'] ?? ''));
        if ($draft === null) {
            $draft = ClinicalHistoryRepository::defaultDraft($session);
        } else {
            $draft = ClinicalHistoryRepository::adminDraft($draft);
        }

        $draft['sessionId'] = (string) ($session['sessionId'] ?? '');
        $draft['caseId'] = (string) ($session['caseId'] ?? '');
        $draft['appointmentId'] = $session['appointmentId'] ?? null;

        return [$store, $session, $draft, $created];
    }

    private function findContext(array $store, array $payload): array
    {
        $sessionId = ClinicalHistoryRepository::trimString($payload['sessionId'] ?? ($_GET['sessionId'] ?? ''));
        $caseId = ClinicalHistoryRepository::trimString($payload['caseId'] ?? ($_GET['caseId'] ?? ''));

        $session = $sessionId !== ''
            ? ClinicalHistoryRepository::findSessionBySessionId($store, $sessionId)
            : null;
        if ($session === null && $caseId !== '') {
            $session = ClinicalHistoryRepository::findSessionByCaseId($store, $caseId);
        }
        if ($session === null) {
            return [null, null];
        }

        $draft = ClinicalHistoryRepository::findDraftBySessionId($store, (string) ($session['sessionId'] ?? ''));
        if ($draft === null) {
            return [$session, ClinicalHistoryRepository::defaultDraft($session)];
        }

        return [$session, $draft];
    }

    private function extractPatientMessage(array $payload): string
    {
        $message = ClinicalHistoryRepository::trimString($payload['message'] ?? '');
        if ($message !== '') {
            return $message;
        }

        $messages = isset($payload['messages']) && is_array($payload['messages']) ? $payload['messages'] : [];
        for ($index = count($messages) - 1; $index >= 0; $index--) {
            $item = $messages[$index] ?? null;
            if (!is_array($item)) {
                continue;
            }
            $role = strtolower(trim((string) ($item['role'] ?? '')));
            $content = ClinicalHistoryRepository::trimString($item['content'] ?? '');
            if ($role === 'user' && $content !== '') {
                return $content;
            }
        }

        return '';
    }

    private function isReplay(array $session, string $clientMessageId, string $messageHash): bool
    {
        $lastTurn = isset($session['lastTurn']) && is_array($session['lastTurn']) ? $session['lastTurn'] : [];
        if ($lastTurn === []) {
            return false;
        }

        $lastClientMessageId = ClinicalHistoryRepository::trimString($lastTurn['clientMessageId'] ?? '');
        $lastMessageHash = ClinicalHistoryRepository::trimString($lastTurn['messageHash'] ?? '');
        if ($clientMessageId !== '' && $lastClientMessageId !== '' && $clientMessageId === $lastClientMessageId) {
            return true;
        }

        return $lastMessageHash !== '' && $lastMessageHash === $messageHash;
    }

    private function attachUploads(array $store, array $session, array $draft, array $payload): array
    {
        $attachmentIds = [];
        if (isset($payload['attachmentIds']) && is_array($payload['attachmentIds'])) {
            foreach ($payload['attachmentIds'] as $attachmentId) {
                $id = (int) $attachmentId;
                if ($id > 0) {
                    $attachmentIds[] = $id;
                }
            }
        }

        if (isset($payload['legacyUploads']) && is_array($payload['legacyUploads'])) {
            foreach ($payload['legacyUploads'] as $legacyUpload) {
                if (!is_array($legacyUpload)) {
                    continue;
                }
                $staged = ClinicalMediaService::stageLegacyUpload($store, $legacyUpload, [
                    'source' => 'clinical_history',
                ]);
                $store = $staged['store'];
                $upload = isset($staged['upload']) && is_array($staged['upload']) ? $staged['upload'] : [];
                $uploadId = (int) ($upload['id'] ?? 0);
                if ($uploadId > 0) {
                    $attachmentIds[] = $uploadId;
                }
            }
        }

        $attachmentSnapshots = $draft['intake']['adjuntos'] ?? [];
        foreach (array_values(array_unique($attachmentIds)) as $uploadId) {
            $upload = ClinicalHistoryRepository::findClinicalUploadById($store, $uploadId);
            if (!is_array($upload)) {
                continue;
            }

            $upload['clinicalHistorySessionId'] = (string) ($session['sessionId'] ?? '');
            $upload['clinicalHistoryCaseId'] = (string) ($session['caseId'] ?? '');
            $upload['appointmentId'] = $upload['appointmentId'] ?? ($session['appointmentId'] ?? null);
            $upload['linkedAt'] = local_date('c');

            $uploadSave = ClinicalHistoryRepository::upsertClinicalUpload($store, $upload);
            $store = $uploadSave['store'];
            $savedUpload = $uploadSave['upload'];

            $attachmentSnapshots[] = [
                'id' => (int) ($savedUpload['id'] ?? 0),
                'kind' => (string) ($savedUpload['kind'] ?? ''),
                'originalName' => (string) ($savedUpload['originalName'] ?? ''),
                'mime' => (string) ($savedUpload['mime'] ?? ''),
                'size' => (int) ($savedUpload['size'] ?? 0),
                'privatePath' => (string) ($savedUpload['privatePath'] ?? ''),
                'appointmentId' => $savedUpload['appointmentId'] ?? null,
            ];
        }

        $draft['intake']['adjuntos'] = ClinicalHistoryRepository::normalizeAttachmentList($attachmentSnapshots);
        return [
            'store' => $store,
            'session' => $session,
            'draft' => $draft,
        ];
    }

    private function reconcilePendingAi(array $store, array $session, array $draft): array
    {
        $session = ClinicalHistoryRepository::adminSession($session);
        $draft = ClinicalHistoryRepository::adminDraft($draft);
        $pending = ClinicalHistoryRepository::normalizePendingAi(
            isset($session['pendingAi']) && is_array($session['pendingAi'])
                ? $session['pendingAi']
                : (isset($draft['pendingAi']) && is_array($draft['pendingAi']) ? $draft['pendingAi'] : [])
        );

        if ($pending === []) {
            return [
                'store' => $store,
                'session' => $session,
                'draft' => $draft,
                'mutated' => false,
            ];
        }

        $reviewStatus = ClinicalHistoryRepository::trimString($draft['reviewStatus'] ?? '');
        $sessionStatus = ClinicalHistoryRepository::trimString($session['status'] ?? '');
        if ($reviewStatus === 'approved' || $sessionStatus === 'approved') {
            [$session, $draft] = $this->closePendingAi($session, $draft, $pending, 'closed', 'approved_before_reconcile');
            return [
                'store' => $store,
                'session' => $session,
                'draft' => $draft,
                'mutated' => true,
            ];
        }

        $lastTurn = isset($session['lastTurn']) && is_array($session['lastTurn']) ? $session['lastTurn'] : [];
        $lastMessageHash = ClinicalHistoryRepository::trimString($lastTurn['messageHash'] ?? '');
        if ($pending['messageHash'] !== '' && $lastMessageHash !== '' && $pending['messageHash'] !== $lastMessageHash) {
            [$session, $draft] = $this->closePendingAi($session, $draft, $pending, 'superseded', 'superseded_by_newer_turn');
            return [
                'store' => $store,
                'session' => $session,
                'draft' => $draft,
                'mutated' => true,
            ];
        }

        if (!figo_queue_enabled() || !figo_queue_job_id_is_valid($pending['jobId'])) {
            $session['lastTurn']['ai'] = array_merge(
                isset($session['lastTurn']['ai']) && is_array($session['lastTurn']['ai']) ? $session['lastTurn']['ai'] : [],
                [
                    'mode' => 'fallback',
                    'status' => 'failed',
                    'reason' => 'pending_job_invalid',
                    'jobId' => $pending['jobId'],
                    'pollAfterMs' => 0,
                ]
            );
            [$session, $draft] = $this->closePendingAi($session, $draft, $pending, 'failed', 'pending_job_invalid');
            $store = $this->recordPendingAiLifecycleEvent($store, $session, $draft, $pending, 'failed', 'pending_job_invalid');
            return [
                'store' => $store,
                'session' => $session,
                'draft' => $draft,
                'mutated' => true,
            ];
        }

        figo_queue_process_job($pending['jobId'], figo_queue_poll_process_timeout_seconds());
        $status = figo_queue_status_payload_for_job($pending['jobId']);
        $jobStatus = ClinicalHistoryRepository::trimString($status['status'] ?? 'queued');

        if ($jobStatus === 'completed') {
            $completion = isset($status['completion']) && is_array($status['completion']) ? $status['completion'] : null;
            $envelope = is_array($completion) ? $this->ai->envelopeFromCompletion($completion) : null;
            if (!is_array($envelope)) {
                $session['lastTurn']['ai'] = array_merge(
                    isset($session['lastTurn']['ai']) && is_array($session['lastTurn']['ai']) ? $session['lastTurn']['ai'] : [],
                    [
                        'mode' => 'fallback',
                        'status' => 'failed',
                        'reason' => 'queued_completion_invalid',
                        'jobId' => $pending['jobId'],
                        'pollAfterMs' => 0,
                    ]
                );
                [$session, $draft] = $this->closePendingAi($session, $draft, $pending, 'failed', 'queued_completion_invalid');
                $store = $this->recordPendingAiLifecycleEvent($store, $session, $draft, $pending, 'failed', 'queued_completion_invalid');
                return [
                    'store' => $store,
                    'session' => $session,
                    'draft' => $draft,
                    'mutated' => true,
                ];
            }

            $guardrailSession = $session;
            $guardrailSession['questionHistory'] = $this->removeQuestionFieldFromHistory(
                is_array($guardrailSession['questionHistory'] ?? null) ? $guardrailSession['questionHistory'] : [],
                $pending['questionFieldKey']
            );

            $aiResult = [
                'mode' => 'live',
                'status' => 'completed',
                'provider' => 'openclaw_queue',
                'reason' => 'queued_completion_reconciled',
                'jobId' => $pending['jobId'],
                'pollAfterMs' => 0,
            ];
            $guarded = ClinicalHistoryGuardrails::applyEnvelope($guardrailSession, $draft, $envelope, $aiResult);
            $draft = $guarded['draft'];
            $publicResponse = isset($guarded['publicResponse']) && is_array($guarded['publicResponse']) ? $guarded['publicResponse'] : [];
            $questionFieldKey = (string) ($guarded['questionFieldKey'] ?? '');

            $assistantContent = $this->assistantContentFromResponse($publicResponse);
            [$session, $assistantUpdated] = $this->replaceAssistantTranscriptMessage(
                $session,
                $pending['assistantMessageId'],
                $assistantContent,
                [
                    'aiMode' => 'live',
                    'provider' => 'openclaw_queue',
                    'reconciled' => true,
                    'jobId' => $pending['jobId'],
                ],
                $questionFieldKey
            );
            if (!$assistantUpdated && $assistantContent !== '') {
                $session = ClinicalHistoryRepository::appendTranscriptMessage($session, [
                    'role' => 'assistant',
                    'actor' => 'clinical_intake',
                    'content' => $assistantContent,
                    'surface' => (string) ($session['surface'] ?? 'web_chat'),
                    'fieldKey' => $questionFieldKey,
                    'meta' => [
                        'aiMode' => 'live',
                        'provider' => 'openclaw_queue',
                        'reconciled' => true,
                        'jobId' => $pending['jobId'],
                    ],
                ]);

                $transcript = is_array($session['transcript'] ?? null) ? $session['transcript'] : [];
                $pending['assistantMessageId'] = (string) (($transcript[count($transcript) - 1]['id'] ?? ''));
            }

            $session['questionHistory'] = $this->removeQuestionFieldFromHistory(
                is_array($session['questionHistory'] ?? null) ? $session['questionHistory'] : [],
                $pending['questionFieldKey']
            );
            if ($questionFieldKey !== '') {
                $session['questionHistory'] = ClinicalHistoryRepository::normalizeStringList(array_merge(
                    $session['questionHistory'],
                    [$questionFieldKey]
                ));
            }

            $publicAi = $this->publicAiPayload($aiResult);
            $session['status'] = (bool) ($draft['requiresHumanReview'] ?? true) ? 'review_required' : 'active';
            $session['lastTurn'] = [
                'clientMessageId' => ClinicalHistoryRepository::trimString($lastTurn['clientMessageId'] ?? $pending['clientMessageId']),
                'messageHash' => ClinicalHistoryRepository::trimString($lastTurn['messageHash'] ?? $pending['messageHash']),
                'assistantMessageId' => $pending['assistantMessageId'],
                'questionFieldKey' => $questionFieldKey,
                'response' => $publicResponse,
                'ai' => $publicAi,
            ];
            $session = $this->touchSession($session);
            [$session, $draft] = $this->closePendingAi(
                $session,
                $draft,
                $pending,
                'completed',
                'queued_completion_reconciled',
                ['skipTouch' => true]
            );
            $store = $this->recordPendingAiLifecycleEvent(
                $store,
                $session,
                $draft,
                $pending,
                'completed',
                'queued_completion_reconciled'
            );

            audit_log_event('clinical_history.pending_ai_reconciled', [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'caseId' => (string) ($session['caseId'] ?? ''),
                'jobId' => $pending['jobId'],
            ]);

            return [
                'store' => $store,
                'session' => $session,
                'draft' => $draft,
                'mutated' => true,
            ];
        }

        if (in_array($jobStatus, ['queued', 'processing'], true)) {
            $nextPending = $pending;
            $nextPending['status'] = $jobStatus;
            $nextPending['pollAfterMs'] = figo_queue_poll_after_ms();
            if ($nextPending !== $pending) {
                $session['pendingAi'] = $nextPending;
                $draft['pendingAi'] = $nextPending;
                $session = $this->touchSession($session);
                $draft = $this->touchDraft($draft);
                return [
                    'store' => $store,
                    'session' => $session,
                    'draft' => $draft,
                    'mutated' => true,
                ];
            }

            return [
                'store' => $store,
                'session' => $session,
                'draft' => $draft,
                'mutated' => false,
            ];
        }

        $terminalReason = ClinicalHistoryRepository::trimString($status['errorCode'] ?? $jobStatus);
        $session['lastTurn']['ai'] = array_merge(
            isset($session['lastTurn']['ai']) && is_array($session['lastTurn']['ai']) ? $session['lastTurn']['ai'] : [],
            [
                'mode' => 'fallback',
                'status' => $jobStatus !== '' ? $jobStatus : 'failed',
                'reason' => $terminalReason !== '' ? $terminalReason : 'queue_failed',
                'jobId' => $pending['jobId'],
                'pollAfterMs' => 0,
            ]
        );
        [$session, $draft] = $this->closePendingAi(
            $session,
            $draft,
            array_merge($pending, [
                'errorCode' => ClinicalHistoryRepository::trimString($status['errorCode'] ?? ''),
                'errorMessage' => ClinicalHistoryRepository::trimString($status['errorMessage'] ?? ''),
            ]),
            $jobStatus !== '' ? $jobStatus : 'failed',
            $terminalReason !== '' ? $terminalReason : 'queue_failed'
        );
        $store = $this->recordPendingAiLifecycleEvent(
            $store,
            $session,
            $draft,
            array_merge($pending, [
                'errorCode' => ClinicalHistoryRepository::trimString($status['errorCode'] ?? ''),
                'errorMessage' => ClinicalHistoryRepository::trimString($status['errorMessage'] ?? ''),
            ]),
            $jobStatus !== '' ? $jobStatus : 'failed',
            $terminalReason !== '' ? $terminalReason : 'queue_failed'
        );

        return [
            'store' => $store,
            'session' => $session,
            'draft' => $draft,
            'mutated' => true,
        ];
    }

    private function buildPendingAi(
        array $aiResult,
        string $messageHash,
        string $clientMessageId,
        string $assistantMessageId,
        string $questionFieldKey
    ): array {
        return ClinicalHistoryRepository::normalizePendingAi([
            'jobId' => (string) ($aiResult['jobId'] ?? ''),
            'status' => (string) ($aiResult['status'] ?? $aiResult['mode'] ?? 'queued'),
            'messageHash' => $messageHash,
            'clientMessageId' => $clientMessageId,
            'assistantMessageId' => $assistantMessageId,
            'questionFieldKey' => $questionFieldKey,
            'requestedAt' => local_date('c'),
            'reason' => (string) ($aiResult['reason'] ?? ''),
            'pollAfterMs' => isset($aiResult['pollAfterMs']) && is_numeric($aiResult['pollAfterMs'])
                ? (int) $aiResult['pollAfterMs']
                : figo_queue_poll_after_ms(),
        ]);
    }

    private function clearPendingAi(array $session, array $draft, string $reason): array
    {
        $pending = ClinicalHistoryRepository::normalizePendingAi(
            isset($session['pendingAi']) && is_array($session['pendingAi'])
                ? $session['pendingAi']
                : (isset($draft['pendingAi']) && is_array($draft['pendingAi']) ? $draft['pendingAi'] : [])
        );
        if ($pending === []) {
            return [$session, $draft];
        }

        return $this->closePendingAi($session, $draft, $pending, 'closed', $reason);
    }

    private function closePendingAi(array $session, array $draft, array $pending, string $status, string $reason, array $options = []): array
    {
        $skipTouch = ($options['skipTouch'] ?? false) === true;
        $session = ClinicalHistoryRepository::adminSession($session);
        $draft = ClinicalHistoryRepository::adminDraft($draft);

        $snapshot = ClinicalHistoryRepository::normalizePendingAi($pending);
        if ($snapshot !== []) {
            $snapshot['status'] = $status;
            $snapshot['reason'] = $reason;
            $snapshot['updatedAt'] = local_date('c');
            if ($status === 'completed') {
                $snapshot['completedAt'] = $snapshot['updatedAt'];
            }
            $session['metadata']['lastPendingAi'] = $snapshot;
        }

        $session['pendingAi'] = [];
        $draft['pendingAi'] = [];

        if (!$skipTouch) {
            $session = $this->touchSession($session);
            $draft = $this->touchDraft($draft);
        }

        return [$session, $draft];
    }

    private function assistantContentFromResponse(array $response): string
    {
        return trim(implode("\n\n", array_filter([
            ClinicalHistoryRepository::trimString($response['reply'] ?? ''),
            ClinicalHistoryRepository::trimString($response['nextQuestion'] ?? ''),
        ])));
    }

    private function replaceAssistantTranscriptMessage(
        array $session,
        string $assistantMessageId,
        string $assistantContent,
        array $meta,
        string $questionFieldKey
    ): array {
        $assistantMessageId = ClinicalHistoryRepository::trimString($assistantMessageId);
        if ($assistantMessageId === '') {
            return [$session, false];
        }

        $session = ClinicalHistoryRepository::adminSession($session);
        $transcript = is_array($session['transcript'] ?? null) ? $session['transcript'] : [];
        foreach ($transcript as $index => $message) {
            if (!is_array($message)) {
                continue;
            }
            if (ClinicalHistoryRepository::trimString($message['id'] ?? '') !== $assistantMessageId) {
                continue;
            }

            $transcript[$index] = ClinicalHistoryRepository::normalizeTranscriptMessage(array_merge(
                $message,
                [
                    'content' => $assistantContent !== ''
                        ? $assistantContent
                        : ClinicalHistoryRepository::trimString($message['content'] ?? ''),
                    'fieldKey' => $questionFieldKey !== ''
                        ? $questionFieldKey
                        : ClinicalHistoryRepository::trimString($message['fieldKey'] ?? ''),
                    'meta' => array_merge(
                        isset($message['meta']) && is_array($message['meta']) ? $message['meta'] : [],
                        $meta
                    ),
                ]
            ));
            $session['transcript'] = array_values($transcript);
            $session = $this->touchSession($session);
            return [$session, true];
        }

        return [$session, false];
    }

    private function removeQuestionFieldFromHistory(array $history, string $fieldKey): array
    {
        $fieldKey = ClinicalHistoryRepository::trimString($fieldKey);
        if ($fieldKey === '') {
            return ClinicalHistoryRepository::normalizeStringList($history);
        }

        return ClinicalHistoryRepository::normalizeStringList(array_values(array_filter(
            ClinicalHistoryRepository::normalizeStringList($history),
            static function (string $item) use ($fieldKey): bool {
                return $item !== $fieldKey;
            }
        )));
    }

    private function touchSession(array $session): array
    {
        $session['updatedAt'] = local_date('c');
        $session['version'] = max(1, (int) ($session['version'] ?? 1)) + 1;
        return $session;
    }

    private function touchDraft(array $draft): array
    {
        $draft['updatedAt'] = local_date('c');
        $draft['version'] = max(1, (int) ($draft['version'] ?? 1)) + 1;
        return $draft;
    }

    private function recordPendingAiLifecycleEvent(
        array $store,
        array $session,
        array $draft,
        array $pending,
        string $status,
        string $reason
    ): array {
        $session = ClinicalHistoryRepository::adminSession($session);
        $draft = ClinicalHistoryRepository::adminDraft($draft);
        $pending = ClinicalHistoryRepository::normalizePendingAi($pending);
        if ($pending === []) {
            return $store;
        }

        $eventType = '';
        $severity = 'info';
        $requiresAction = false;
        $title = '';
        $message = '';
        if ($status === 'completed') {
            $eventType = 'draft_reconciled';
            $requiresAction = (bool) ($draft['requiresHumanReview'] ?? true);
            $severity = $requiresAction ? 'warning' : 'info';
            $title = $requiresAction
                ? 'Historia clinica reconciliada y lista para revision'
                : 'Historia clinica reconciliada automaticamente';
            $message = $requiresAction
                ? 'El borrador clinico se completo y requiere validacion del medico.'
                : 'El borrador clinico se completo sin bloqueos adicionales.';
        } elseif (in_array($status, ['failed', 'expired'], true)) {
            $eventType = 'draft_reconcile_failed';
            $severity = 'warning';
            $requiresAction = true;
            $title = $status === 'expired'
                ? 'OpenClaw no completo la historia clinica a tiempo'
                : 'OpenClaw no pudo reconciliar la historia clinica';
            $message = $pending['errorMessage'] !== ''
                ? $pending['errorMessage']
                : 'Se requiere seguimiento manual para completar la historia clinica.';
        }

        if ($eventType === '') {
            return $store;
        }

        $dedupeKey = implode('|', array_filter([
            'clinical_history',
            $eventType,
            (string) ($session['sessionId'] ?? ''),
            (string) ($pending['jobId'] ?? ''),
        ]));
        $existingEvents = ClinicalHistoryRepository::findEventsBySessionId($store, (string) ($session['sessionId'] ?? ''));
        $acknowledgedAt = '';
        $resolvedAt = '';
        foreach ($existingEvents as $existingEvent) {
            if (ClinicalHistoryRepository::trimString($existingEvent['dedupeKey'] ?? '') !== $dedupeKey) {
                continue;
            }
            $acknowledgedAt = ClinicalHistoryRepository::trimString($existingEvent['acknowledgedAt'] ?? '');
            $resolvedAt = ClinicalHistoryRepository::trimString($existingEvent['resolvedAt'] ?? '');
            break;
        }

        $event = [
            'sessionId' => (string) ($session['sessionId'] ?? ''),
            'caseId' => (string) ($session['caseId'] ?? ''),
            'appointmentId' => $session['appointmentId'] ?? null,
            'type' => $eventType,
            'severity' => $severity,
            'status' => $requiresAction ? 'open' : 'resolved',
            'title' => $title,
            'message' => $message,
            'requiresAction' => $requiresAction,
            'jobId' => (string) ($pending['jobId'] ?? ''),
            'dedupeKey' => $dedupeKey,
            'patient' => isset($session['patient']) && is_array($session['patient']) ? $session['patient'] : [],
            'metadata' => [
                'reason' => $reason,
                'reviewStatus' => (string) ($draft['reviewStatus'] ?? ''),
                'requiresHumanReview' => (bool) ($draft['requiresHumanReview'] ?? true),
                'confidence' => (float) ($draft['confidence'] ?? 0),
                'reviewReasons' => array_values(is_array($draft['reviewReasons'] ?? null) ? $draft['reviewReasons'] : []),
            ],
            'occurredAt' => local_date('c'),
            'acknowledgedAt' => $acknowledgedAt,
            'resolvedAt' => $requiresAction ? $resolvedAt : ($resolvedAt !== '' ? $resolvedAt : local_date('c')),
        ];

        $eventSave = ClinicalHistoryRepository::upsertEvent($store, $event);
        return $eventSave['store'];
    }

    private function touchSessionEventsForReview(array $store, array $session, bool $resolve): array
    {
        $sessionId = ClinicalHistoryRepository::trimString($session['sessionId'] ?? '');
        if ($sessionId === '') {
            return $store;
        }

        $events = isset($store['clinical_history_events']) && is_array($store['clinical_history_events'])
            ? $store['clinical_history_events']
            : [];
        $changed = false;
        foreach ($events as $index => $eventRecord) {
            $event = ClinicalHistoryRepository::defaultEvent($eventRecord);
            if (ClinicalHistoryRepository::trimString($event['sessionId'] ?? '') !== $sessionId) {
                continue;
            }
            if ((bool) ($event['requiresAction'] ?? false) !== true) {
                continue;
            }

            $now = local_date('c');
            if (ClinicalHistoryRepository::trimString($event['acknowledgedAt'] ?? '') === '') {
                $event['acknowledgedAt'] = $now;
            }
            if ($resolve) {
                $event['status'] = 'resolved';
                if (ClinicalHistoryRepository::trimString($event['resolvedAt'] ?? '') === '') {
                    $event['resolvedAt'] = $now;
                }
            } else {
                $event['status'] = 'acknowledged';
            }
            $event['updatedAt'] = $now;
            $events[$index] = ClinicalHistoryRepository::defaultEvent($event);
            $changed = true;
        }

        if ($changed) {
            $store['clinical_history_events'] = array_values($events);
        }

        return $store;
    }

    private function publicAiPayload(array $aiResult): array
    {
        return [
            'mode' => (string) ($aiResult['mode'] ?? 'fallback'),
            'provider' => (string) ($aiResult['provider'] ?? 'local_fallback'),
            'status' => (string) ($aiResult['status'] ?? $aiResult['mode'] ?? 'fallback'),
            'reason' => (string) ($aiResult['reason'] ?? ''),
            'jobId' => (string) ($aiResult['jobId'] ?? ''),
            'pollAfterMs' => isset($aiResult['pollAfterMs']) && is_numeric($aiResult['pollAfterMs'])
                ? (int) $aiResult['pollAfterMs']
                : 0,
        ];
    }
}
