<?php
declare(strict_types=1);

require_once __DIR__ . '/../CheckoutOrderService.php';
require_once __DIR__ . '/../models.php';
require_once __DIR__ . '/../../payment-lib.php';

class ClinicalHistorySessionService
{
    private ClinicalHistoryService $facade;
    private ClinicalHistoryAIService $ai;

    public function __construct(ClinicalHistoryService $facade, ClinicalHistoryAIService $ai)
    {
        $this->facade = $facade;
        $this->ai = $ai;
    }

    public function __call(string $name, array $args)
    {
        return $this->facade->invokeServiceMethod($name, $args);
    }

public function  createOrResumeSession(array $store, array $payload): array
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

public function  handlePatientMessage(array $store, array $payload): array
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

public function  getSession(array $store, array $query, bool $admin = false): array
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

public function  getRecord(array $store, array $query): array
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

public function  patchRecord(array $store, array $payload): array
    {
        return $this->mutateClinicalRecord($store, $payload, 'save');
    }

public function  episodeAction(array $store, array $payload): array
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

        if ($action === 'export_full_record') {
            return $this->exportClinicalRecord($store, $payload);
        }

        if ($action === 'record_consent') {
            return $this->mutateClinicalRecord($store, $payload, 'declare-consent');
        }

        if ($action === 'revoke_consent') {
            return $this->mutateClinicalRecord($store, $payload, 'revoke-consent');
        }

        if ($action === 'create_consent_packet') {
            return $this->mutateClinicalRecord($store, $payload, 'create-consent-packet');
        }

        if ($action === 'select_consent_packet') {
            return $this->mutateClinicalRecord($store, $payload, 'select-consent-packet');
        }

        if ($action === 'declare_consent') {
            return $this->mutateClinicalRecord($store, $payload, 'declare-consent');
        }

        if ($action === 'deny_consent') {
            return $this->mutateClinicalRecord($store, $payload, 'deny-consent');
        }

        if ($action === 'create_interconsultation') {
            return $this->mutateClinicalRecord($store, $payload, 'create-interconsultation');
        }

        if ($action === 'select_interconsultation') {
            return $this->mutateClinicalRecord($store, $payload, 'select-interconsultation');
        }

        if ($action === 'issue_interconsultation') {
            return $this->mutateClinicalRecord($store, $payload, 'issue-interconsultation');
        }

        if ($action === 'cancel_interconsultation') {
            return $this->mutateClinicalRecord($store, $payload, 'cancel-interconsultation');
        }

        if ($action === 'receive_interconsult_report') {
            return $this->mutateClinicalRecord($store, $payload, 'receive-interconsult-report');
        }

        if ($action === 'create_lab_order') {
            return $this->mutateClinicalRecord($store, $payload, 'create-lab-order');
        }

        if ($action === 'select_lab_order') {
            return $this->mutateClinicalRecord($store, $payload, 'select-lab-order');
        }

        if ($action === 'issue_lab_order') {
            return $this->mutateClinicalRecord($store, $payload, 'issue-lab-order');
        }

        if ($action === 'cancel_lab_order') {
            return $this->mutateClinicalRecord($store, $payload, 'cancel-lab-order');
        }

        if ($action === 'create_imaging_order') {
            return $this->mutateClinicalRecord($store, $payload, 'create-imaging-order');
        }

        if ($action === 'select_imaging_order') {
            return $this->mutateClinicalRecord($store, $payload, 'select-imaging-order');
        }

        if ($action === 'issue_imaging_order') {
            return $this->mutateClinicalRecord($store, $payload, 'issue-imaging-order');
        }

        if ($action === 'cancel_imaging_order') {
            return $this->mutateClinicalRecord($store, $payload, 'cancel-imaging-order');
        }

        if ($action === 'receive_imaging_report') {
            return $this->mutateClinicalRecord($store, $payload, 'receive-imaging-report');
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

        if ($action === 'schedule_follow_up') {
            return $this->mutateClinicalRecord($store, $payload, 'schedule-follow-up');
        }

        if ($action === 'deliver_care_plan') {
            return $this->mutateClinicalRecord($store, $payload, 'deliver-care-plan');
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

public function  getPatientGallery(array $store, string $caseId): array
    {
        $caseId = ClinicalHistoryRepository::trimString($caseId);
        if ($caseId === '') {
            return [
                'ok' => false,
                'statusCode' => 400,
                'error' => 'Case ID invalido',
                'errorCode' => 'case_id_invalid',
                'data' => [],
            ];
        }

        $drafts = ClinicalHistoryRepository::findAllDraftsByCaseId($store, $caseId);
        $gallery = [];

        foreach ($drafts as $draft) {
            $attachments = ClinicalHistoryRepository::normalizeAttachmentList($draft['attachments'] ?? []);
            foreach ($attachments as $attachment) {
                $mime = strtolower(ClinicalHistoryRepository::trimString($attachment['mime'] ?? ''));
                if (str_starts_with($mime, 'image/')) {
                    $attachment['date'] = $draft['updatedAt'] ?? '';
                    $attachment['sessionId'] = $draft['sessionId'] ?? '';
                    $gallery[] = $attachment;
                }
            }
        }

        // Ordenar con las más recientes primero
        usort($gallery, static function ($a, $b) {
            return strcmp($b['date'] ?? '', $a['date'] ?? '');
        });

        return [
            'ok' => true,
            'statusCode' => 200,
            'data' => $gallery,
        ];
    }

public function  getPatientHistory(array $store, string $patientId): array
    {
        $patientId = ClinicalHistoryRepository::trimString($patientId);
        if ($patientId === '') {
            return [];
        }

        $episodes = [];
        $prescriptions = [];
        $allergies = [];
        $aiSummary = '';
        $lastEvolution = '';
        $photos = [];

        foreach (($store['clinical_history_events'] ?? []) as $event) {
            $epCaseId = ClinicalHistoryRepository::trimString($event['caseId'] ?? '');
            $epPatientId = ClinicalHistoryRepository::trimString($event['patient']['id'] ?? '');

            if ($epCaseId === $patientId || $epPatientId === $patientId) {
                if ($event['type'] === 'openclaw_diagnosis') {
                    $episodes[] = [
                        'cie10_code' => $event['metadata']['cie10Code'] ?? '',
                        'cie10_description' => $event['metadata']['cie10Description'] ?? '',
                        'date' => $event['occurredAt'] ?? $event['createdAt'] ?? '',
                        'doctor' => $event['metadata']['doctor'] ?? '',
                        'reason' => $event['metadata']['notes'] ?? '',
                    ];
                } elseif ($event['type'] === 'openclaw_evolution') {
                    $lastEvolution = $event['message'] ?? '';
                    $aiSummary = $event['message'] ?? '';
                } elseif ($event['type'] === 'issue_prescription') {
                     $prescriptions[] = [
                         'status' => 'active',
                         'medications' => array_map(function ($i) { return $i['medication'] ?? ''; }, $event['metadata']['items'] ?? []),
                     ];
                }
            }
        }

        $session = ClinicalHistoryRepository::findSessionByCaseId($store, $patientId);
        if ($session) {
            $draft = ClinicalHistoryRepository::findDraftBySessionId($store, $session['sessionId'] ?? '');
            if ($draft) {
                $rawAllergies = ClinicalHistoryRepository::trimString($draft['intake']['alergias'] ?? '');
                if ($rawAllergies !== '' && strtolower($rawAllergies) !== 'no' && strtolower($rawAllergies) !== 'ninguna') {
                    $allergies[] = $rawAllergies;
                }
            }
        }

        usort($episodes, static function ($a, $b) {
            return strcmp($b['date'] ?? '', $a['date'] ?? '');
        });

        return [
            'episodes' => $episodes,
            'prescriptions' => $prescriptions,
            'allergies' => $allergies,
            'ai_summary' => $aiSummary,
            'last_evolution' => $lastEvolution,
            'photos' => $photos,
        ];
    }

public function  saveDiagnosis(array $store, array $payload): array
    {
        $caseId = ClinicalHistoryRepository::trimString($payload['caseId'] ?? '');
        $cie10Code = ClinicalHistoryRepository::trimString($payload['cie10Code'] ?? '');
        
        if ($caseId === '' || $cie10Code === '') {
            return ['ok' => false, 'error' => 'caseId y cie10Code son requeridos'];
        }

        $session = ClinicalHistoryRepository::findSessionByCaseId($store, $caseId);
        if (!$session) {
            $session = ['sessionId' => ''];
        }

        $event = [
            'type' => 'openclaw_diagnosis',
            'caseId' => $caseId,
            'sessionId' => $session['sessionId'] ?? '',
            'message' => 'Diagnóstico: ' . $cie10Code . ' - ' . ($payload['cie10Description'] ?? ''),
            'metadata' => [
                'cie10Code' => $cie10Code,
                'cie10Description' => $payload['cie10Description'] ?? '',
                'notes' => $payload['notes'] ?? '',
                'doctor' => $payload['doctorId'] ?? 'System',
                'source' => $payload['source'] ?? 'openclaw',
            ],
            'status' => 'closed',
        ];

        $upsertEvent = ClinicalHistoryRepository::upsertEvent($store, $event);
        $store = $upsertEvent['store'];

        return [
            'ok' => true,
            'store' => $store,
            'id' => $upsertEvent['event']['id'] ?? 0,
            'eventId' => $upsertEvent['event']['eventId'] ?? '',
        ];
    }

public function  saveEvolutionNote(array $store, array $payload): array
    {
        $caseId = ClinicalHistoryRepository::trimString($payload['caseId'] ?? '');
        $text = ClinicalHistoryRepository::trimString($payload['text'] ?? '');
        
        if ($caseId === '' || $text === '') {
            return ['ok' => false, 'error' => 'caseId y text son requeridos'];
        }

        $session = ClinicalHistoryRepository::findSessionByCaseId($store, $caseId);
        $sessionId = $session ? ($session['sessionId'] ?? '') : '';

        if ($session) {
            $draft = ClinicalHistoryRepository::findDraftBySessionId($store, $sessionId);
            if ($draft) {
                $currentLiveNote = ClinicalHistoryRepository::trimString($draft['clinicianDraft']['liveNote'] ?? '');
                $draft['clinicianDraft']['liveNote'] = $currentLiveNote !== '' 
                    ? $currentLiveNote . "\n\n" . $text 
                    : $text;
                
                $upsertDraft = ClinicalHistoryRepository::upsertDraft($store, $draft);
                $store = $upsertDraft['store'];
            }
        }

        $event = [
            'type' => 'openclaw_evolution',
            'caseId' => $caseId,
            'sessionId' => $sessionId,
            'message' => $text,
            'metadata' => [
                'cie10Code' => $payload['cie10Code'] ?? '',
                'doctor' => $payload['doctorId'] ?? 'System',
                'doctorName' => $payload['doctorName'] ?? ($payload['doctorId'] ?? 'System'),
                'doctorSpecialty' => $payload['doctorSpecialty'] ?? '',
                'doctorMsp' => $payload['doctorMsp'] ?? '',
                'source' => $payload['source'] ?? 'openclaw',
            ],
            'status' => 'closed',
        ];

        $upsertEvent = ClinicalHistoryRepository::upsertEvent($store, $event);
        $store = $upsertEvent['store'];

        return [
            'ok' => true,
            'store' => $store,
            'id' => $upsertEvent['event']['id'] ?? 0,
            'eventId' => $upsertEvent['event']['eventId'] ?? '',
        ];
    }

public function  reconcilePendingSessions(array $store, array $options = []): array
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

public function  buildChatCompletionPayload(array $result): array
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

public function  buildPublicPayload(array $session, array $draft, array $response = [], array $ai = []): array
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

public function  buildAdminPayload(array $store, array $session, array $draft): array
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
            'interconsultations' => $payload['interconsultations'] ?? [],
            'activeInterconsultationId' => $payload['activeInterconsultationId'] ?? '',
            'activeInterconsultation' => $payload['activeInterconsultation'] ?? [],
            'labOrders' => $payload['labOrders'] ?? [],
            'activeLabOrderId' => $payload['activeLabOrderId'] ?? '',
            'activeLabOrder' => $payload['activeLabOrder'] ?? [],
            'imagingOrders' => $payload['imagingOrders'] ?? [],
            'activeImagingOrderId' => $payload['activeImagingOrderId'] ?? '',
            'activeImagingOrder' => $payload['activeImagingOrder'] ?? [],
            'consentPackets' => $payload['consentPackets'] ?? [],
            'activeConsentPacketId' => $payload['activeConsentPacketId'] ?? '',
            'activeConsentPacket' => $payload['activeConsentPacket'] ?? [],
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
            'caseMediaAssets' => $payload['caseMediaAssets'] ?? [],
            'legacyBridge' => [
                'session' => $payload['session'] ?? [],
                'draft' => $payload['draft'] ?? [],
                'events' => $payload['events'] ?? [],
            ],
        ];
    }

public function  buildClinicalRecordPayload(array $store, array $session, array $draft): array
    {
        $session = ClinicalHistoryRepository::adminSession($session);
        $draft = $this->synchronizeDraftClinicalState(
            ClinicalHistoryRepository::adminDraft($draft),
            $session
        );
        $events = ClinicalHistoryRepository::findEventsBySessionId(
            $store,
            (string) ($session['sessionId'] ?? '')
        );
        $legalReadiness = ClinicalHistoryLegalReadiness::build($session, $draft, $events);
        $documents = ClinicalHistoryRepository::normalizeClinicalDocuments(
            is_array($draft['documents'] ?? null) ? $draft['documents'] : []
        );
        $interconsultations = ClinicalHistoryRepository::normalizeInterconsultations(
            $draft['interconsultations'] ?? []
        );
        $activeInterconsultationId = ClinicalHistoryRepository::trimString(
            $draft['activeInterconsultationId'] ?? ''
        );
        $activeInterconsultation = [];
        foreach ($interconsultations as $interconsultation) {
            if (ClinicalHistoryRepository::trimString($interconsultation['interconsultId'] ?? '') === $activeInterconsultationId) {
                $activeInterconsultation = $interconsultation;
                break;
            }
        }
        $labOrders = ClinicalHistoryRepository::normalizeLabOrders(
            $draft['labOrders'] ?? []
        );
        $activeLabOrderId = ClinicalHistoryRepository::trimString(
            $draft['activeLabOrderId'] ?? ''
        );
        $activeLabOrder = [];
        foreach ($labOrders as $labOrder) {
            if (ClinicalHistoryRepository::trimString($labOrder['labOrderId'] ?? '') === $activeLabOrderId) {
                $activeLabOrder = $labOrder;
                break;
            }
        }
        $imagingOrders = ClinicalHistoryRepository::normalizeImagingOrders(
            $draft['imagingOrders'] ?? []
        );
        $activeImagingOrderId = ClinicalHistoryRepository::trimString(
            $draft['activeImagingOrderId'] ?? ''
        );
        $activeImagingOrder = [];
        foreach ($imagingOrders as $imagingOrder) {
            if (ClinicalHistoryRepository::trimString($imagingOrder['imagingOrderId'] ?? '') === $activeImagingOrderId) {
                $activeImagingOrder = $imagingOrder;
                break;
            }
        }
        $consentPackets = ClinicalHistoryRepository::normalizeConsentPackets(
            $draft['consentPackets'] ?? []
        );
        $activeConsentPacketId = ClinicalHistoryRepository::trimString(
            $draft['activeConsentPacketId'] ?? ''
        );
        $activeConsentPacket = [];
        foreach ($consentPackets as $packet) {
            if (ClinicalHistoryRepository::trimString($packet['packetId'] ?? '') === $activeConsentPacketId) {
                $activeConsentPacket = $packet;
                break;
            }
        }
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
        $admission001 = ClinicalHistoryRepository::normalizeAdmission001(
            is_array($draft['admission001'] ?? null) ? $draft['admission001'] : [],
            is_array($session['patient'] ?? null) ? $session['patient'] : [],
            is_array($draft['intake'] ?? null) ? $draft['intake'] : [],
            ['draft' => $draft]
        );
        $patient = ClinicalHistoryRepository::buildPatientMirrorFromAdmission(
            is_array($session['patient'] ?? null) ? $session['patient'] : [],
            $admission001,
            is_array($draft['intake'] ?? null) ? $draft['intake'] : []
        );
        $session['patient'] = $patient;
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
        $hcu001Status = is_array($legalReadiness['hcu001Status'] ?? null)
            ? $legalReadiness['hcu001Status']
            : ['status' => 'missing', 'label' => 'HCU-001 faltante', 'summary' => ''];
        $hcu005Status = is_array($legalReadiness['hcu005Status'] ?? null)
            ? $legalReadiness['hcu005Status']
            : ['status' => 'missing', 'label' => 'HCU-005 pendiente', 'summary' => ''];
        $hcu007Status = is_array($legalReadiness['hcu007Status'] ?? null)
            ? $legalReadiness['hcu007Status']
            : ['status' => 'not_applicable', 'label' => 'HCU-007 no aplica', 'summary' => ''];
        $hcu010AStatus = is_array($legalReadiness['hcu010AStatus'] ?? null)
            ? $legalReadiness['hcu010AStatus']
            : ['status' => 'not_applicable', 'label' => 'HCU-010A no aplica', 'summary' => ''];
        $hcu012AStatus = is_array($legalReadiness['hcu012AStatus'] ?? null)
            ? $legalReadiness['hcu012AStatus']
            : ['status' => 'not_applicable', 'label' => 'HCU-012A no aplica', 'summary' => ''];
        $hcu012AReportStatus = is_array($legalReadiness['hcu012AReportStatus'] ?? null)
            ? $legalReadiness['hcu012AReportStatus']
            : ['status' => 'not_received', 'label' => 'Resultado radiologico no recibido', 'summary' => ''];
        $hcu024Status = is_array($legalReadiness['hcu024Status'] ?? null)
            ? $legalReadiness['hcu024Status']
            : ['status' => 'not_applicable', 'label' => 'HCU-024 no aplica', 'summary' => ''];
        $admissionHistory = ClinicalHistoryRepository::normalizeAdmissionHistory(
            $admission001['history']['admissionHistory'] ?? []
        );
        $changeLog = ClinicalHistoryRepository::normalizeAdmissionChangeLog(
            $admission001['history']['changeLog'] ?? []
        );

        $caseMediaAssets = [];
        $caseId = (string) ($session['caseId'] ?? '');
        if ($caseId !== '') {
            foreach (($store['clinical_uploads'] ?? []) as $upload) {
                if (is_array($upload) && (string) ($upload['patientCaseId'] ?? '') === $caseId) {
                    $caseMediaAssets[] = [
                        'uploadId' => (int) ($upload['id'] ?? 0),
                        'kind' => (string) ($upload['kind'] ?? ''),
                        'privatePath' => (string) ($upload['privatePath'] ?? ''),
                        'url' => '/api.php?resource=media-flow-private-asset&assetId=' . urlencode((string) ($upload['assetId'] ?? $upload['privatePath'] ?? '')),
                        'bodyZone' => (string) ($upload['bodyZone'] ?? ''),
                        'createdAt' => (string) ($upload['createdAt'] ?? ''),
                    ];
                }
            }
        }
        $accountStatement = $this->buildAccountStatement($store, $session, $draft);

        return [
            'session' => $session,
            'draft' => $draft,
            'events' => $events,
            'patientRecord' => [
                'recordId' => (string) ($draft['patientRecordId'] ?? ''),
                'patient' => ClinicalHistoryRepository::normalizePatient($patient),
                'admission001' => $admission001,
                'admissionHistory' => $admissionHistory,
                'changeLog' => $changeLog,
                'admission001Status' => $hcu001Status,
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
                'hcu001Status' => $hcu001Status,
                'hcu005Status' => $hcu005Status,
                'hcu007Status' => $hcu007Status,
                'hcu010AStatus' => $hcu010AStatus,
                'hcu012AStatus' => $hcu012AStatus,
                'hcu012AReportStatus' => $hcu012AReportStatus,
                'hcu024Status' => $hcu024Status,
            ],
            'documents' => $documents,
            'interconsultations' => $interconsultations,
            'activeInterconsultationId' => $activeInterconsultationId,
            'activeInterconsultation' => $activeInterconsultation,
            'labOrders' => $labOrders,
            'activeLabOrderId' => $activeLabOrderId,
            'activeLabOrder' => $activeLabOrder,
            'imagingOrders' => $imagingOrders,
            'activeImagingOrderId' => $activeImagingOrderId,
            'activeImagingOrder' => $activeImagingOrder,
            'consentPackets' => $consentPackets,
            'activeConsentPacketId' => $activeConsentPacketId,
            'activeConsentPacket' => $activeConsentPacket,
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
            'accountStatement' => $accountStatement,
            'caseMediaAssets' => $caseMediaAssets,
        ];
    }

    private function buildAccountStatement(array $store, array $session, array $draft): array
    {
        $currency = function_exists('payment_currency')
            ? strtoupper((string) payment_currency())
            : 'USD';
        $identity = $this->extractAccountStatementIdentity($session, $draft);
        $appointmentId = (int) ($draft['appointmentId'] ?? $session['appointmentId'] ?? 0);
        $entries = [];

        foreach ((array) ($store['appointments'] ?? []) as $appointment) {
            if (!is_array($appointment) || !$this->matchesAppointmentAccountIdentity($appointment, $identity, $appointmentId)) {
                continue;
            }

            $entry = $this->buildAppointmentAccountStatementEntry($appointment, $currency);
            if ($entry !== []) {
                $entries[] = $entry;
            }
        }

        foreach ((array) ($store['checkout_orders'] ?? []) as $order) {
            if (!is_array($order) || !$this->matchesCheckoutOrderAccountIdentity($order, $identity)) {
                continue;
            }

            $entry = $this->buildCheckoutOrderAccountStatementEntry($order, $currency);
            if ($entry !== []) {
                $entries[] = $entry;
            }
        }

        usort($entries, function (array $left, array $right): int {
            $byStamp = $this->accountStatementTimestampValue((string) ($right['effectiveAt'] ?? ''))
                <=> $this->accountStatementTimestampValue((string) ($left['effectiveAt'] ?? ''));
            if ($byStamp !== 0) {
                return $byStamp;
            }

            return strcmp(
                (string) ($right['entryId'] ?? ''),
                (string) ($left['entryId'] ?? '')
            );
        });

        $paidCents = 0;
        $pendingCents = 0;
        $overdueCents = 0;
        $paidCount = 0;
        $pendingCount = 0;
        $overdueCount = 0;
        $lastPaidAt = '';

        foreach ($entries as $entry) {
            $amountCents = max(0, (int) ($entry['amountCents'] ?? 0));
            if (($entry['isPaid'] ?? false) === true) {
                $paidCents += $amountCents;
                $paidCount++;
                $paidAt = (string) ($entry['paidAt'] ?? '');
                if ($paidAt !== '' && $this->accountStatementTimestampValue($paidAt) > $this->accountStatementTimestampValue($lastPaidAt)) {
                    $lastPaidAt = $paidAt;
                }
                continue;
            }

            if (($entry['isPending'] ?? false) !== true) {
                continue;
            }

            $pendingCents += $amountCents;
            $pendingCount++;
            if (($entry['isOverdue'] ?? false) === true) {
                $overdueCents += $amountCents;
                $overdueCount++;
            }
        }

        $upcomingEntries = array_values(array_filter(
            $entries,
            static fn (array $entry): bool =>
                ($entry['isPending'] ?? false) === true
                && ClinicalHistoryRepository::trimString($entry['dueAt'] ?? '') !== ''
        ));
        usort($upcomingEntries, function (array $left, array $right): int {
            return $this->accountStatementTimestampValue((string) ($left['dueAt'] ?? ''))
                <=> $this->accountStatementTimestampValue((string) ($right['dueAt'] ?? ''));
        });
        $upcomingEntries = array_slice($upcomingEntries, 0, 3);

        return [
            'currency' => $currency,
            'summary' => [
                'entriesCount' => count($entries),
                'paidCents' => $paidCents,
                'pendingCents' => $pendingCents,
                'overdueCents' => $overdueCents,
                'paidCount' => $paidCount,
                'pendingCount' => $pendingCount,
                'overdueCount' => $overdueCount,
                'lastPaidAt' => $lastPaidAt,
                'nextDueAt' => (string) ($upcomingEntries[0]['dueAt'] ?? ''),
            ],
            'entries' => $entries,
            'upcomingEntries' => $upcomingEntries,
        ];
    }

    private function extractAccountStatementIdentity(array $session, array $draft): array
    {
        $patient = isset($session['patient']) && is_array($session['patient'])
            ? $session['patient']
            : [];
        $admission = isset($draft['admission001']) && is_array($draft['admission001'])
            ? $draft['admission001']
            : [];
        $residence = isset($admission['residence']) && is_array($admission['residence'])
            ? $admission['residence']
            : [];
        $intake = isset($draft['intake']) && is_array($draft['intake'])
            ? $draft['intake']
            : [];
        $patientFacts = isset($intake['datosPaciente']) && is_array($intake['datosPaciente'])
            ? $intake['datosPaciente']
            : [];

        return [
            'name' => $this->normalizeAccountStatementName(
                (string) ($patient['legalName'] ?? $patient['name'] ?? '')
            ),
            'email' => strtolower(ClinicalHistoryRepository::trimString($patient['email'] ?? '')),
            'phone' => $this->normalizeAccountStatementPhone(
                (string) ($patient['phone'] ?? $residence['phone'] ?? $patientFacts['telefono'] ?? '')
            ),
        ];
    }

    private function matchesAppointmentAccountIdentity(array $appointment, array $identity, int $appointmentId): bool
    {
        $candidateId = (int) ($appointment['id'] ?? 0);
        if ($appointmentId > 0 && $candidateId === $appointmentId) {
            return true;
        }

        $candidateEmail = strtolower(ClinicalHistoryRepository::trimString($appointment['email'] ?? ''));
        if ($identity['email'] !== '' && $candidateEmail !== '' && hash_equals($identity['email'], $candidateEmail)) {
            return true;
        }

        $candidatePhone = $this->normalizeAccountStatementPhone((string) ($appointment['phone'] ?? ''));
        if ($identity['phone'] !== '' && $candidatePhone !== '' && $identity['phone'] === $candidatePhone) {
            return true;
        }

        $candidateName = $this->normalizeAccountStatementName((string) ($appointment['name'] ?? ''));
        return $identity['name'] !== ''
            && $candidateName !== ''
            && $identity['email'] === ''
            && $identity['phone'] === ''
            && $identity['name'] === $candidateName;
    }

    private function matchesCheckoutOrderAccountIdentity(array $order, array $identity): bool
    {
        $candidateEmail = strtolower(ClinicalHistoryRepository::trimString($order['payerEmail'] ?? ''));
        if ($identity['email'] !== '' && $candidateEmail !== '' && hash_equals($identity['email'], $candidateEmail)) {
            return true;
        }

        $candidatePhone = $this->normalizeAccountStatementPhone((string) ($order['payerWhatsapp'] ?? ''));
        if ($identity['phone'] !== '' && $candidatePhone !== '' && $identity['phone'] === $candidatePhone) {
            return true;
        }

        $candidateName = $this->normalizeAccountStatementName((string) ($order['payerName'] ?? ''));
        return $identity['name'] !== ''
            && $candidateName !== ''
            && $identity['email'] === ''
            && $identity['phone'] === ''
            && $identity['name'] === $candidateName;
    }

    private function buildAppointmentAccountStatementEntry(array $appointment, string $defaultCurrency): array
    {
        $paymentStatus = strtolower(ClinicalHistoryRepository::trimString($appointment['paymentStatus'] ?? 'pending'));
        if ($paymentStatus === '') {
            $paymentStatus = 'pending';
        }

        $appointmentStatus = strtolower(ClinicalHistoryRepository::trimString($appointment['status'] ?? ''));
        $isPaid = $paymentStatus === 'paid';
        $isPending = in_array(
            $paymentStatus,
            ['pending', 'pending_cash', 'pending_transfer', 'pending_transfer_review', 'pending_gateway'],
            true
        );
        if ($appointmentStatus === 'cancelled' && !$isPaid) {
            return [];
        }

        $service = ClinicalHistoryRepository::trimString($appointment['service'] ?? '');
        $date = ClinicalHistoryRepository::trimString($appointment['date'] ?? '');
        $time = ClinicalHistoryRepository::trimString($appointment['time'] ?? '');
        $tenantId = ClinicalHistoryRepository::trimString($appointment['tenantId'] ?? '');
        $amountCents = 0;
        if (function_exists('payment_expected_amount_cents') && $service !== '') {
            try {
                $amountCents = max(0, (int) payment_expected_amount_cents($service, $date !== '' ? $date : null, $time !== '' ? $time : null, $tenantId !== '' ? $tenantId : null));
            } catch (\Throwable $e) {
                $amountCents = 0;
            }
        }
        if ($amountCents <= 0) {
            return [];
        }

        $dueAt = $this->buildAppointmentAccountStatementDueAt($appointment);
        $paidAt = ClinicalHistoryRepository::trimString($appointment['paymentPaidAt'] ?? '');
        $createdAt = ClinicalHistoryRepository::trimString($appointment['dateBooked'] ?? '');
        $updatedAt = ClinicalHistoryRepository::trimString($appointment['updatedAt'] ?? $createdAt);
        $effectiveAt = $paidAt !== ''
            ? $paidAt
            : ($dueAt !== '' ? $dueAt : ($updatedAt !== '' ? $updatedAt : $createdAt));
        $doctor = ClinicalHistoryRepository::trimString($appointment['doctor'] ?? '');
        $serviceLabel = function_exists('get_service_label')
            ? (string) get_service_label($service)
            : ($service !== '' ? $service : 'Cita');
        $doctorLabel = function_exists('get_doctor_label')
            ? (string) get_doctor_label($doctor)
            : $doctor;

        return [
            'entryId' => 'appointment:' . (string) ($appointment['id'] ?? $serviceLabel),
            'source' => 'appointment',
            'reference' => (int) ($appointment['id'] ?? 0) > 0
                ? 'APT-' . (string) ($appointment['id'] ?? '')
                : '',
            'concept' => trim($serviceLabel . ($doctorLabel !== '' ? ' · ' . $doctorLabel : '')),
            'amountCents' => $amountCents,
            'currency' => strtoupper(ClinicalHistoryRepository::trimString($appointment['currency'] ?? $defaultCurrency)),
            'paymentMethod' => strtolower(ClinicalHistoryRepository::trimString($appointment['paymentMethod'] ?? 'unpaid')),
            'paymentStatus' => $paymentStatus,
            'paymentProvider' => ClinicalHistoryRepository::trimString($appointment['paymentProvider'] ?? ''),
            'createdAt' => $createdAt,
            'updatedAt' => $updatedAt,
            'paidAt' => $paidAt,
            'dueAt' => $dueAt,
            'effectiveAt' => $effectiveAt,
            'isPaid' => $isPaid,
            'isPending' => $isPending,
            'isOverdue' => $isPending && $dueAt !== '' && $this->timestampIsPast($dueAt),
            'status' => $appointmentStatus,
            'notes' => trim(implode(' • ', array_filter([
                $date !== '' ? $date : '',
                $time !== '' ? $time : '',
                $appointmentStatus !== '' ? $appointmentStatus : '',
            ]))),
        ];
    }

    private function buildCheckoutOrderAccountStatementEntry(array $order, string $defaultCurrency): array
    {
        $amountCents = max(0, (int) ($order['amountCents'] ?? 0));
        if ($amountCents <= 0) {
            return [];
        }

        $paymentStatus = strtolower(ClinicalHistoryRepository::trimString($order['paymentStatus'] ?? 'pending'));
        if ($paymentStatus === '') {
            $paymentStatus = 'pending';
        }

        $createdAt = ClinicalHistoryRepository::trimString($order['createdAt'] ?? '');
        $updatedAt = ClinicalHistoryRepository::trimString($order['updatedAt'] ?? $createdAt);
        $paidAt = ClinicalHistoryRepository::trimString($order['paymentPaidAt'] ?? '');
        $dueAt = '';
        if ($paymentStatus === 'pending_transfer' && $createdAt !== '') {
            $dueAt = $this->addHoursToTimestamp($createdAt, 48);
        }
        $isPaid = $paymentStatus === 'paid';
        $isPending = in_array(
            $paymentStatus,
            ['pending', 'pending_transfer', 'pending_cash', 'pending_gateway'],
            true
        );
        $effectiveAt = $paidAt !== ''
            ? $paidAt
            : ($dueAt !== '' ? $dueAt : ($updatedAt !== '' ? $updatedAt : $createdAt));

        return [
            'entryId' => 'checkout_order:' . ClinicalHistoryRepository::trimString($order['id'] ?? ''),
            'source' => 'checkout_order',
            'reference' => ClinicalHistoryRepository::trimString($order['receiptNumber'] ?? $order['id'] ?? ''),
            'concept' => ClinicalHistoryRepository::trimString($order['concept'] ?? 'Pago Aurora Derm'),
            'amountCents' => $amountCents,
            'currency' => strtoupper(ClinicalHistoryRepository::trimString($order['currency'] ?? $defaultCurrency)),
            'paymentMethod' => strtolower(ClinicalHistoryRepository::trimString($order['paymentMethod'] ?? '')),
            'paymentStatus' => $paymentStatus,
            'paymentProvider' => ClinicalHistoryRepository::trimString($order['paymentProvider'] ?? ''),
            'createdAt' => $createdAt,
            'updatedAt' => $updatedAt,
            'paidAt' => $paidAt,
            'dueAt' => $dueAt,
            'effectiveAt' => $effectiveAt,
            'isPaid' => $isPaid,
            'isPending' => $isPending,
            'isOverdue' => $isPending && $dueAt !== '' && $this->timestampIsPast($dueAt),
            'status' => '',
            'notes' => ClinicalHistoryRepository::trimString($order['transferReference'] ?? ''),
        ];
    }

    private function buildAppointmentAccountStatementDueAt(array $appointment): string
    {
        $date = ClinicalHistoryRepository::trimString($appointment['date'] ?? '');
        $time = ClinicalHistoryRepository::trimString($appointment['time'] ?? '');
        if ($date === '') {
            return '';
        }

        $safeTime = $time !== '' ? $time : '00:00';
        try {
            return (new \DateTimeImmutable($date . ' ' . $safeTime))->format('c');
        } catch (\Throwable $e) {
            return '';
        }
    }

    private function normalizeAccountStatementPhone(string $value): string
    {
        return preg_replace('/\D+/', '', $value) ?? '';
    }

    private function normalizeAccountStatementName(string $value): string
    {
        $normalized = strtolower(trim($value));
        if ($normalized === '') {
            return '';
        }

        return preg_replace('/\s+/', ' ', $normalized) ?? $normalized;
    }

    private function accountStatementTimestampValue(string $stamp): int
    {
        try {
            return (new \DateTimeImmutable($stamp))->getTimestamp();
        } catch (\Throwable $e) {
            return 0;
        }
    }

public function  openEpisode(array $store, array $payload): array
    {
        [$store, $session, $draft, $created] = $this->resolveSessionContext($store, $payload, true);
        $draft = $this->ensureAdmissionHistoryForEpisode($draft, $session);
        $session['patient'] = ClinicalHistoryRepository::buildPatientMirrorFromAdmission(
            is_array($session['patient'] ?? null) ? $session['patient'] : [],
            is_array($draft['admission001'] ?? null) ? $draft['admission001'] : [],
            is_array($draft['intake'] ?? null) ? $draft['intake'] : []
        );

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

public function  mutateClinicalRecord(array $store, array $payload, string $mode): array
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

        $beforeAdmission = ClinicalHistoryRepository::normalizeAdmission001(
            is_array($draft['admission001'] ?? null) ? $draft['admission001'] : [],
            is_array($session['patient'] ?? null) ? $session['patient'] : [],
            is_array($draft['intake'] ?? null) ? $draft['intake'] : [],
            ['draft' => $draft]
        );
        $draft = $this->applyDraftPatches($draft, $payload);
        $modeAuditReason = '';
        $modeAuditAction = $this->accessAuditActionForMode($mode);
        $modeAuditMeta = [];
        $afterAdmission = ClinicalHistoryRepository::normalizeAdmission001(
            is_array($draft['admission001'] ?? null) ? $draft['admission001'] : [],
            is_array($session['patient'] ?? null) ? $session['patient'] : [],
            is_array($draft['intake'] ?? null) ? $draft['intake'] : [],
            ['draft' => $draft]
        );
        $changedAdmissionFields = $this->admissionChangedFields(
            $beforeAdmission,
            $afterAdmission
        );
        if ($changedAdmissionFields !== []) {
            $draft = $this->appendAdmissionChangeLog(
                $draft,
                $changedAdmissionFields
            );
            $modeAuditAction = 'edit_admission_record';
            $modeAuditMeta['changedFields'] = $changedAdmissionFields;
        }
        $session['patient'] = ClinicalHistoryRepository::buildPatientMirrorFromAdmission(
            is_array($session['patient'] ?? null) ? $session['patient'] : [],
            $afterAdmission,
            is_array($draft['intake'] ?? null) ? $draft['intake'] : []
        );

        if (array_key_exists('requiresHumanReview', $payload)) {
            $draft['requiresHumanReview'] = (bool) $payload['requiresHumanReview'];
        }

        $question = ClinicalHistoryRepository::trimString(
            $payload['requestAdditionalQuestion'] ?? $payload['followUpQuestion'] ?? ''
        );
        if ($question === '' && $mode === 'schedule-follow-up') {
            $question = 'Coordinar la siguiente cita de seguimiento post-consulta.';
        }
        if ($question === '' && $mode === 'deliver-care-plan') {
            $question = 'Enviar guia e indicaciones post-consulta al paciente.';
        }
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
        } elseif (
            in_array($mode, ['schedule-follow-up', 'deliver-care-plan'], true)
            && $question !== ''
        ) {
            $session = ClinicalHistoryRepository::appendTranscriptMessage($session, [
                'role' => 'assistant',
                'actor' => 'queue_operator',
                'content' => ClinicalHistoryGuardrails::sanitizePatientText($question),
                'surface' => 'queue_operator',
                'meta' => [
                    'requestedBy' => $this->currentClinicalActor(),
                    'operatorAction' => $this->accessAuditActionForMode($mode),
                ],
            ]);
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
        } elseif ($mode === 'create-consent-packet') {
            $consentPacketResult = $this->applyCreateConsentPacketAction($session, $draft, $payload);
            if (($consentPacketResult['ok'] ?? false) !== true) {
                return $consentPacketResult;
            }
            $draft = $consentPacketResult['draft'];
            $modeAuditReason = 'consent_packet_created';
            $modeAuditMeta = $consentPacketResult['meta'] ?? [];
        } elseif ($mode === 'select-consent-packet') {
            $consentPacketResult = $this->applySelectConsentPacketAction($draft, $payload);
            if (($consentPacketResult['ok'] ?? false) !== true) {
                return $consentPacketResult;
            }
            $draft = $consentPacketResult['draft'];
            $modeAuditReason = 'consent_packet_selected';
            $modeAuditMeta = $consentPacketResult['meta'] ?? [];
        } elseif ($mode === 'create-interconsultation') {
            $interconsultationResult = $this->applyCreateInterconsultationAction($session, $draft, $payload);
            if (($interconsultationResult['ok'] ?? false) !== true) {
                return $interconsultationResult;
            }
            $draft = $interconsultationResult['draft'];
            $modeAuditReason = 'interconsultation_created';
            $modeAuditMeta = $interconsultationResult['meta'] ?? [];
        } elseif ($mode === 'select-interconsultation') {
            $interconsultationResult = $this->applySelectInterconsultationAction($draft, $payload);
            if (($interconsultationResult['ok'] ?? false) !== true) {
                return $interconsultationResult;
            }
            $draft = $interconsultationResult['draft'];
            $modeAuditReason = 'interconsultation_selected';
            $modeAuditMeta = $interconsultationResult['meta'] ?? [];
        } elseif ($mode === 'issue-interconsultation') {
            $interconsultationResult = $this->applyIssueInterconsultationAction($session, $draft, $payload);
            if (($interconsultationResult['ok'] ?? false) !== true) {
                return $interconsultationResult;
            }
            $draft = $interconsultationResult['draft'];
            $modeAuditReason = 'interconsultation_issued';
            $modeAuditMeta = $interconsultationResult['meta'] ?? [];
        } elseif ($mode === 'cancel-interconsultation') {
            $interconsultationResult = $this->applyCancelInterconsultationAction($session, $draft, $payload);
            if (($interconsultationResult['ok'] ?? false) !== true) {
                return $interconsultationResult;
            }
            $draft = $interconsultationResult['draft'];
            $modeAuditReason = 'interconsultation_cancelled';
            $modeAuditMeta = $interconsultationResult['meta'] ?? [];
        } elseif ($mode === 'receive-interconsult-report') {
            $interconsultationResult = $this->applyReceiveInterconsultReportAction($session, $draft, $payload);
            if (($interconsultationResult['ok'] ?? false) !== true) {
                return $interconsultationResult;
            }
            $draft = $interconsultationResult['draft'];
            $modeAuditReason = 'interconsult_report_received';
            $modeAuditMeta = $interconsultationResult['meta'] ?? [];
        } elseif ($mode === 'create-lab-order') {
            $labOrderResult = $this->applyCreateLabOrderAction($session, $draft, $payload);
            if (($labOrderResult['ok'] ?? false) !== true) {
                return $labOrderResult;
            }
            $draft = $labOrderResult['draft'];
            $modeAuditReason = 'lab_order_created';
            $modeAuditMeta = $labOrderResult['meta'] ?? [];
        } elseif ($mode === 'select-lab-order') {
            $labOrderResult = $this->applySelectLabOrderAction($draft, $payload);
            if (($labOrderResult['ok'] ?? false) !== true) {
                return $labOrderResult;
            }
            $draft = $labOrderResult['draft'];
            $modeAuditReason = 'lab_order_selected';
            $modeAuditMeta = $labOrderResult['meta'] ?? [];
        } elseif ($mode === 'issue-lab-order') {
            $labOrderResult = $this->applyIssueLabOrderAction($session, $draft, $payload);
            if (($labOrderResult['ok'] ?? false) !== true) {
                return $labOrderResult;
            }
            $draft = $labOrderResult['draft'];
            $modeAuditReason = 'lab_order_issued';
            $modeAuditMeta = $labOrderResult['meta'] ?? [];
        } elseif ($mode === 'cancel-lab-order') {
            $labOrderResult = $this->applyCancelLabOrderAction($session, $draft, $payload);
            if (($labOrderResult['ok'] ?? false) !== true) {
                return $labOrderResult;
            }
            $draft = $labOrderResult['draft'];
            $modeAuditReason = 'lab_order_cancelled';
            $modeAuditMeta = $labOrderResult['meta'] ?? [];
        } elseif ($mode === 'create-imaging-order') {
            $imagingOrderResult = $this->applyCreateImagingOrderAction($session, $draft, $payload);
            if (($imagingOrderResult['ok'] ?? false) !== true) {
                return $imagingOrderResult;
            }
            $draft = $imagingOrderResult['draft'];
            $modeAuditReason = 'imaging_order_created';
            $modeAuditMeta = $imagingOrderResult['meta'] ?? [];
        } elseif ($mode === 'select-imaging-order') {
            $imagingOrderResult = $this->applySelectImagingOrderAction($draft, $payload);
            if (($imagingOrderResult['ok'] ?? false) !== true) {
                return $imagingOrderResult;
            }
            $draft = $imagingOrderResult['draft'];
            $modeAuditReason = 'imaging_order_selected';
            $modeAuditMeta = $imagingOrderResult['meta'] ?? [];
        } elseif ($mode === 'issue-imaging-order') {
            $imagingOrderResult = $this->applyIssueImagingOrderAction($session, $draft, $payload);
            if (($imagingOrderResult['ok'] ?? false) !== true) {
                return $imagingOrderResult;
            }
            $draft = $imagingOrderResult['draft'];
            $modeAuditReason = 'imaging_order_issued';
            $modeAuditMeta = $imagingOrderResult['meta'] ?? [];
        } elseif ($mode === 'cancel-imaging-order') {
            $imagingOrderResult = $this->applyCancelImagingOrderAction($session, $draft, $payload);
            if (($imagingOrderResult['ok'] ?? false) !== true) {
                return $imagingOrderResult;
            }
            $draft = $imagingOrderResult['draft'];
            $modeAuditReason = 'imaging_order_cancelled';
            $modeAuditMeta = $imagingOrderResult['meta'] ?? [];
        } elseif ($mode === 'receive-imaging-report') {
            $imagingOrderResult = $this->applyReceiveImagingReportAction($session, $draft, $payload);
            if (($imagingOrderResult['ok'] ?? false) !== true) {
                return $imagingOrderResult;
            }
            $draft = $imagingOrderResult['draft'];
            $modeAuditReason = 'imaging_report_received';
            $modeAuditMeta = $imagingOrderResult['meta'] ?? [];
        } elseif (in_array($mode, ['declare-consent', 'deny-consent', 'revoke-consent'], true)) {
            $consentDecisionResult = $this->applyConsentDecisionAction($session, $draft, $payload, $mode);
            if (($consentDecisionResult['ok'] ?? false) !== true) {
                return $consentDecisionResult;
            }
            $draft = $consentDecisionResult['draft'];
            $modeAuditReason = $consentDecisionResult['reason'] ?? $mode;
            $modeAuditMeta = $consentDecisionResult['meta'] ?? [];
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

            // S4-04: Enviar resumen post-consulta por WhatsApp
            if (!class_exists('LeadOpsService', false) && file_exists(__DIR__ . '/../LeadOpsService.php')) {
                require_once __DIR__ . '/../LeadOpsService.php';
            }
            if (class_exists('LeadOpsService', false)) {
                LeadOpsService::dispatchPostConsultationSummary($session, $draft);
            }

            audit_log_event('clinical_history.approved', [
                'sessionId' => (string) ($session['sessionId'] ?? ''),
                'caseId' => (string) ($session['caseId'] ?? ''),
                'approvedBy' => (string) ($draft['approval']['approvedBy'] ?? ''),
                'finalDraftVersion' => (int) ($draft['approval']['finalDraftVersion'] ?? 0),
            ]);
        } else {
            $resolveEvents = in_array($mode, ['save', 'declare-consent', 'deny-consent', 'revoke-consent', 'create-interconsultation', 'issue-interconsultation', 'cancel-interconsultation', 'receive-interconsult-report', 'create-lab-order', 'issue-lab-order', 'cancel-lab-order', 'create-imaging-order', 'issue-imaging-order', 'cancel-imaging-order', 'receive-imaging-report', 'prescription', 'certificate', 'schedule-follow-up', 'deliver-care-plan'], true)
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
            } elseif ($mode === 'schedule-follow-up') {
                audit_log_event('clinical_history.follow_up_scheduling_requested', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                    'question' => $question,
                ]);
            } elseif ($mode === 'deliver-care-plan') {
                audit_log_event('clinical_history.care_plan_delivery_requested', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                    'question' => $question,
                ]);
            } elseif ($mode === 'review-required') {
                audit_log_event('clinical_history.review_required', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                ]);
            } elseif ($mode === 'declare-consent') {
                audit_log_event('clinical_history.consent_declared', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                    'status' => (string) ($draft['consent']['status'] ?? ''),
                    'packetId' => (string) ($modeAuditMeta['packetId'] ?? ''),
                ]);
            } elseif ($mode === 'deny-consent') {
                audit_log_event('clinical_history.consent_denied', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                    'packetId' => (string) ($modeAuditMeta['packetId'] ?? ''),
                ]);
            } elseif ($mode === 'revoke-consent') {
                audit_log_event('clinical_history.consent_revoked', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                    'packetId' => (string) ($modeAuditMeta['packetId'] ?? ''),
                ]);
            } elseif ($mode === 'create-consent-packet') {
                audit_log_event('clinical_history.consent_packet_created', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                    'packetId' => (string) ($modeAuditMeta['packetId'] ?? ''),
                    'templateKey' => (string) ($modeAuditMeta['templateKey'] ?? ''),
                ]);
            } elseif ($mode === 'select-consent-packet') {
                audit_log_event('clinical_history.consent_packet_selected', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                    'packetId' => (string) ($modeAuditMeta['packetId'] ?? ''),
                ]);
            } elseif ($mode === 'create-interconsultation') {
                audit_log_event('clinical_history.interconsultation_created', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                    'interconsultId' => (string) ($modeAuditMeta['interconsultId'] ?? ''),
                ]);
            } elseif ($mode === 'select-interconsultation') {
                audit_log_event('clinical_history.interconsultation_selected', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                    'interconsultId' => (string) ($modeAuditMeta['interconsultId'] ?? ''),
                ]);
            } elseif ($mode === 'issue-interconsultation') {
                audit_log_event('clinical_history.interconsultation_issued', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                    'interconsultId' => (string) ($modeAuditMeta['interconsultId'] ?? ''),
                    'destinationService' => (string) ($modeAuditMeta['destinationService'] ?? ''),
                ]);
            } elseif ($mode === 'cancel-interconsultation') {
                audit_log_event('clinical_history.interconsultation_cancelled', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                    'interconsultId' => (string) ($modeAuditMeta['interconsultId'] ?? ''),
                    'cancelReason' => (string) ($modeAuditMeta['cancelReason'] ?? ''),
                ]);
            } elseif ($mode === 'receive-interconsult-report') {
                audit_log_event('clinical_history.interconsult_report_received', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                    'interconsultId' => (string) ($modeAuditMeta['interconsultId'] ?? ''),
                    'consultantProfessionalName' => (string) ($modeAuditMeta['consultantProfessionalName'] ?? ''),
                ]);
            } elseif ($mode === 'create-lab-order') {
                audit_log_event('clinical_history.lab_order_created', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                    'labOrderId' => (string) ($modeAuditMeta['labOrderId'] ?? ''),
                ]);
            } elseif ($mode === 'select-lab-order') {
                audit_log_event('clinical_history.lab_order_selected', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                    'labOrderId' => (string) ($modeAuditMeta['labOrderId'] ?? ''),
                ]);
            } elseif ($mode === 'issue-lab-order') {
                audit_log_event('clinical_history.lab_order_issued', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                    'labOrderId' => (string) ($modeAuditMeta['labOrderId'] ?? ''),
                    'status' => (string) ($modeAuditMeta['status'] ?? ''),
                ]);
            } elseif ($mode === 'cancel-lab-order') {
                audit_log_event('clinical_history.lab_order_cancelled', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                    'labOrderId' => (string) ($modeAuditMeta['labOrderId'] ?? ''),
                    'cancelReason' => (string) ($modeAuditMeta['cancelReason'] ?? ''),
                ]);
            } elseif ($mode === 'create-imaging-order') {
                audit_log_event('clinical_history.imaging_order_created', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                    'imagingOrderId' => (string) ($modeAuditMeta['imagingOrderId'] ?? ''),
                ]);
            } elseif ($mode === 'select-imaging-order') {
                audit_log_event('clinical_history.imaging_order_selected', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                    'imagingOrderId' => (string) ($modeAuditMeta['imagingOrderId'] ?? ''),
                ]);
            } elseif ($mode === 'issue-imaging-order') {
                audit_log_event('clinical_history.imaging_order_issued', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                    'imagingOrderId' => (string) ($modeAuditMeta['imagingOrderId'] ?? ''),
                    'status' => (string) ($modeAuditMeta['status'] ?? ''),
                ]);
            } elseif ($mode === 'cancel-imaging-order') {
                audit_log_event('clinical_history.imaging_order_cancelled', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                    'imagingOrderId' => (string) ($modeAuditMeta['imagingOrderId'] ?? ''),
                    'cancelReason' => (string) ($modeAuditMeta['cancelReason'] ?? ''),
                ]);
            } elseif ($mode === 'receive-imaging-report') {
                audit_log_event('clinical_history.imaging_report_received', [
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'caseId' => (string) ($session['caseId'] ?? ''),
                    'imagingOrderId' => (string) ($modeAuditMeta['imagingOrderId'] ?? ''),
                    'radiologistProfessionalName' => (string) ($modeAuditMeta['radiologistProfessionalName'] ?? ''),
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
            $modeAuditAction,
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

public function  applyDraftPatches(array $draft, array $payload): array
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

        if (isset($payload['admission001']) && is_array($payload['admission001'])) {
            $draftPatch['admission001'] = array_merge(
                isset($draftPatch['admission001']) && is_array($draftPatch['admission001']) ? $draftPatch['admission001'] : [],
                $payload['admission001']
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

        if (isset($draftPatch['admission001']) && is_array($draftPatch['admission001'])) {
            $draft['admission001'] = ClinicalHistoryRepository::normalizeAdmission001(
                array_replace_recursive(
                    is_array($draft['admission001'] ?? null) ? $draft['admission001'] : [],
                    $draftPatch['admission001']
                ),
                [],
                is_array($draft['intake'] ?? null) ? $draft['intake'] : [],
                ['draft' => $draft]
            );
        }

        if (isset($payload['documents']) && is_array($payload['documents'])) {
            $draft['documents'] = ClinicalHistoryRepository::normalizeClinicalDocuments(array_replace_recursive(
                is_array($draft['documents'] ?? null) ? $draft['documents'] : [],
                $payload['documents']
            ));
        }

        if (isset($payload['interconsultations']) && is_array($payload['interconsultations'])) {
            $draft['interconsultations'] = ClinicalHistoryRepository::normalizeInterconsultations(
                $payload['interconsultations']
            );
        }

        if (array_key_exists('activeInterconsultationId', $payload)) {
            $draft['activeInterconsultationId'] = ClinicalHistoryRepository::trimString(
                $payload['activeInterconsultationId'] ?? ''
            );
        }

        if (isset($payload['labOrders']) && is_array($payload['labOrders'])) {
            $draft['labOrders'] = ClinicalHistoryRepository::normalizeLabOrders(
                $payload['labOrders']
            );
        }

        if (array_key_exists('activeLabOrderId', $payload)) {
            $draft['activeLabOrderId'] = ClinicalHistoryRepository::trimString(
                $payload['activeLabOrderId'] ?? ''
            );
        }

        if (isset($payload['imagingOrders']) && is_array($payload['imagingOrders'])) {
            $draft['imagingOrders'] = ClinicalHistoryRepository::normalizeImagingOrders(
                $payload['imagingOrders']
            );
        }

        if (array_key_exists('activeImagingOrderId', $payload)) {
            $draft['activeImagingOrderId'] = ClinicalHistoryRepository::trimString(
                $payload['activeImagingOrderId'] ?? ''
            );
        }

        if (isset($payload['consentPackets']) && is_array($payload['consentPackets'])) {
            $draft['consentPackets'] = ClinicalHistoryRepository::normalizeConsentPackets(
                $payload['consentPackets']
            );
        }

        if (array_key_exists('activeConsentPacketId', $payload)) {
            $draft['activeConsentPacketId'] = ClinicalHistoryRepository::trimString(
                $payload['activeConsentPacketId'] ?? ''
            );
        }

        if (isset($payload['consent']) && is_array($payload['consent'])) {
            $draft = ClinicalHistoryRepository::applyConsentBridgePatch(
                $draft,
                array_merge(
                    is_array($draft['consent'] ?? null) ? $draft['consent'] : [],
                    $payload['consent']
                )
            );
        }

        if (isset($payload['recordMeta']) && is_array($payload['recordMeta'])) {
            $draft['recordMeta'] = ClinicalHistoryRepository::normalizeRecordMeta(array_merge(
                is_array($draft['recordMeta'] ?? null) ? $draft['recordMeta'] : [],
                $payload['recordMeta']
            ));
        }

        return $this->synchronizeDraftClinicalState($draft);
    }

public function  buildFinalNoteContent(array $session, array $draft): string
    {
        $patient = is_array($session['patient'] ?? null) ? $session['patient'] : [];
        $intake = is_array($draft['intake'] ?? null) ? $draft['intake'] : [];
        $admission001 = ClinicalHistoryRepository::normalizeAdmission001(
            is_array($draft['admission001'] ?? null) ? $draft['admission001'] : [],
            $patient,
            $intake,
            ['draft' => $draft]
        );
        $patient = ClinicalHistoryRepository::buildPatientMirrorFromAdmission(
            $patient,
            $admission001,
            $intake
        );
        $clinicianDraft = ClinicalHistoryRepository::normalizeClinicianDraft(
            is_array($draft['clinicianDraft'] ?? null) ? $draft['clinicianDraft'] : []
        );
        $hcu005 = ClinicalHistoryRepository::normalizeHcu005Draft(
            $clinicianDraft['hcu005'] ?? []
        );
        $consent = ClinicalHistoryRepository::normalizeConsentRecord(
            is_array($draft['consent'] ?? null) ? $draft['consent'] : []
        );
        $activeConsentPacket = [];
        foreach (ClinicalHistoryRepository::normalizeConsentPackets($draft['consentPackets'] ?? []) as $packet) {
            if (ClinicalHistoryRepository::trimString($packet['packetId'] ?? '') === ClinicalHistoryRepository::trimString($draft['activeConsentPacketId'] ?? '')) {
                $activeConsentPacket = $packet;
                break;
            }
        }
        $activeInterconsultation = [];
        foreach (ClinicalHistoryRepository::normalizeInterconsultations($draft['interconsultations'] ?? []) as $interconsultation) {
            if (ClinicalHistoryRepository::trimString($interconsultation['interconsultId'] ?? '') === ClinicalHistoryRepository::trimString($draft['activeInterconsultationId'] ?? '')) {
                $activeInterconsultation = $interconsultation;
                break;
            }
        }
        $activeLabOrder = [];
        foreach (ClinicalHistoryRepository::normalizeLabOrders($draft['labOrders'] ?? []) as $labOrder) {
            if (ClinicalHistoryRepository::trimString($labOrder['labOrderId'] ?? '') === ClinicalHistoryRepository::trimString($draft['activeLabOrderId'] ?? '')) {
                $activeLabOrder = $labOrder;
                break;
            }
        }
        $activeImagingOrder = [];
        foreach (ClinicalHistoryRepository::normalizeImagingOrders($draft['imagingOrders'] ?? []) as $imagingOrder) {
            if (ClinicalHistoryRepository::trimString($imagingOrder['imagingOrderId'] ?? '') === ClinicalHistoryRepository::trimString($draft['activeImagingOrderId'] ?? '')) {
                $activeImagingOrder = $imagingOrder;
                break;
            }
        }

        $parts = [
            'Paciente: ' . (
                ClinicalHistoryRepository::buildAdmissionLegalName($admission001, $patient) !== ''
                    ? ClinicalHistoryRepository::buildAdmissionLegalName($admission001, $patient)
                    : 'Sin identificacion visible'
            ),
            'Documento: ' . trim(implode(' ', array_filter([
                ClinicalHistoryRepository::trimString($admission001['identity']['documentType'] ?? ''),
                ClinicalHistoryRepository::trimString($admission001['identity']['documentNumber'] ?? ''),
            ]))),
            'Motivo de consulta: ' . ClinicalHistoryRepository::trimString($intake['motivoConsulta'] ?? ''),
            'Fecha de admision: ' . ClinicalHistoryRepository::trimString($admission001['admissionMeta']['admissionDate'] ?? ''),
            'Tipo de admision: ' . ClinicalHistoryRepository::trimString($admission001['admissionMeta']['admissionKind'] ?? ''),
            'Telefono: ' . ClinicalHistoryRepository::trimString($admission001['residence']['phone'] ?? ''),
            'Enfermedad actual: ' . ClinicalHistoryRepository::trimString($intake['enfermedadActual'] ?? ''),
            'Evolucion clinica: ' . ClinicalHistoryRepository::trimString($hcu005['evolutionNote'] ?? ''),
            'Impresion diagnostica: ' . ClinicalHistoryRepository::trimString($hcu005['diagnosticImpression'] ?? ''),
            'Plan terapeutico: ' . ClinicalHistoryRepository::trimString($hcu005['therapeuticPlan'] ?? ''),
            'Indicaciones / cuidados: ' . ClinicalHistoryRepository::trimString($hcu005['careIndications'] ?? ''),
            'Interconsulta HCU-007: ' . trim(implode(' • ', array_filter([
                ClinicalHistoryRepository::trimString($activeInterconsultation['destinationService'] ?? ''),
                ClinicalHistoryRepository::trimString($activeInterconsultation['destinationEstablishment'] ?? ''),
                ClinicalHistoryRepository::trimString($activeInterconsultation['status'] ?? ''),
            ]))),
            'Laboratorio HCU-010A: ' . trim(implode(' • ', array_filter([
                ClinicalHistoryRepository::trimString($activeLabOrder['status'] ?? ''),
                ClinicalHistoryRepository::trimString($activeLabOrder['sampleDate'] ?? ''),
                implode(', ', ClinicalHistoryRepository::flattenLabOrderStudySelections(
                    is_array($activeLabOrder['studySelections'] ?? null) ? $activeLabOrder['studySelections'] : []
                )),
            ]))),
            'Imagenologia HCU-012A: ' . trim(implode(' • ', array_filter([
                ClinicalHistoryRepository::trimString($activeImagingOrder['status'] ?? ''),
                ClinicalHistoryRepository::trimString($activeImagingOrder['studyDate'] ?? ''),
                implode(', ', ClinicalHistoryRepository::flattenImagingStudySelections(
                    is_array($activeImagingOrder['studySelections'] ?? null) ? $activeImagingOrder['studySelections'] : []
                )),
            ]))),
            'Consentimiento HCU-024: ' . trim(implode(' • ', array_filter([
                ClinicalHistoryRepository::trimString($activeConsentPacket['procedureLabel'] ?? ''),
                ClinicalHistoryRepository::trimString($consent['status'] ?? 'not_required'),
            ]))),
        ];

        return trim(implode("\n", array_filter($parts, static function ($item): bool {
            return is_string($item) && trim($item) !== '';
        })));
    }

public function  synchronizeDraftClinicalState(array $draft, array $session = []): array
    {
        $draft = ClinicalHistoryRepository::adminDraft($draft);
        $admission001 = ClinicalHistoryRepository::normalizeAdmission001(
            is_array($draft['admission001'] ?? null) ? $draft['admission001'] : [],
            [],
            is_array($draft['intake'] ?? null) ? $draft['intake'] : [],
            ['draft' => $draft]
        );
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
            'hcu001' => $admission001,
            'hcu005' => ClinicalHistoryRepository::normalizeHcu005Section($hcu005),
        ];
        $documents['finalNote']['summary'] = ClinicalHistoryRepository::renderHcu005Summary($hcu005);
        $documents['finalNote']['content'] = $this->buildFinalNoteContent([], [
            'intake' => $draft['intake'] ?? [],
            'admission001' => $admission001,
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

        $draft['admission001'] = $admission001;
        $draft['intake']['datosPaciente'] = ClinicalHistoryRepository::buildPatientFactsMirrorFromAdmission(
            is_array($draft['intake']['datosPaciente'] ?? null) ? $draft['intake']['datosPaciente'] : [],
            $admission001
        );
        $draft['clinicianDraft'] = $clinicianDraft;
        $draft['documents'] = $documents;
        $draft = ClinicalHistoryRepository::syncInterconsultationArtifacts($draft, $session);
        $draft = ClinicalHistoryRepository::syncLabOrderArtifacts($draft, $session);
        $draft = ClinicalHistoryRepository::syncImagingOrderArtifacts($draft, $session);
        $draft = ClinicalHistoryRepository::syncConsentArtifacts($draft, $session);
        $draft['documents'] = ClinicalHistoryRepository::normalizeClinicalDocuments(
            is_array($draft['documents'] ?? null) ? $draft['documents'] : []
        );
        $draft['documents']['finalNote']['content'] = $this->buildFinalNoteContent($session, $draft);
        $draft = ClinicalHistoryGuardrails::synchronizeDerivedReviewSignals($draft);

        return $draft;
    }

public function  ensureAdmissionHistoryForEpisode(array $draft, array $session): array
    {
        $draft = ClinicalHistoryRepository::adminDraft($draft);
        $admission001 = ClinicalHistoryRepository::normalizeAdmission001(
            is_array($draft['admission001'] ?? null) ? $draft['admission001'] : [],
            is_array($session['patient'] ?? null) ? $session['patient'] : [],
            is_array($draft['intake'] ?? null) ? $draft['intake'] : [],
            ['draft' => $draft]
        );
        $history = ClinicalHistoryRepository::normalizeAdmissionHistory(
            $admission001['history']['admissionHistory'] ?? []
        );
        $episodeId = ClinicalHistoryRepository::trimString($draft['episodeId'] ?? '');
        if ($episodeId === '') {
            return $draft;
        }

        foreach ($history as $item) {
            if (ClinicalHistoryRepository::trimString($item['episodeId'] ?? '') === $episodeId) {
                return $draft;
            }
        }

        $admission001['admissionMeta']['transitionMode'] = 'new_required';
        $admissionKind = ClinicalHistoryRepository::trimString($admission001['admissionMeta']['admissionKind'] ?? '');
        if (!in_array($admissionKind, ['first', 'subsequent'], true)) {
            $admissionKind = $history === [] ? 'first' : 'subsequent';
        }
        $admissionDate = ClinicalHistoryRepository::trimString($admission001['admissionMeta']['admissionDate'] ?? '');
        if ($admissionDate === '') {
            $admissionDate = ClinicalHistoryRepository::trimString(
                $session['createdAt'] ?? $draft['createdAt'] ?? local_date('c')
            );
        }

        $history[] = [
            'entryId' => ClinicalHistoryRepository::newOpaqueId('adm'),
            'episodeId' => $episodeId,
            'caseId' => ClinicalHistoryRepository::trimString($session['caseId'] ?? $draft['caseId'] ?? ''),
            'admissionDate' => $admissionDate,
            'admissionKind' => $admissionKind,
            'admittedBy' => ClinicalHistoryRepository::trimString(
                $admission001['admissionMeta']['admittedBy'] ?? ''
            ) !== ''
                ? ClinicalHistoryRepository::trimString($admission001['admissionMeta']['admittedBy'] ?? '')
                : $this->currentClinicalActor(),
            'createdAt' => local_date('c'),
        ];

        $admission001['admissionMeta']['admissionKind'] = $admissionKind;
        $admission001['admissionMeta']['admissionDate'] = $admissionDate;
        if (ClinicalHistoryRepository::trimString($admission001['admissionMeta']['admittedBy'] ?? '') === '') {
            $admission001['admissionMeta']['admittedBy'] = $this->currentClinicalActor();
        }
        $admission001['history']['admissionHistory'] = ClinicalHistoryRepository::normalizeAdmissionHistory($history);
        $draft['admission001'] = $admission001;

        return $draft;
    }

public function  admissionChangedFields(array $before, array $after): array
    {
        $beforeFlat = $this->flattenAdmissionFields($before);
        $afterFlat = $this->flattenAdmissionFields($after);
        $fields = [];

        foreach (array_unique(array_merge(array_keys($beforeFlat), array_keys($afterFlat))) as $key) {
            if (($beforeFlat[$key] ?? null) === ($afterFlat[$key] ?? null)) {
                continue;
            }
            $fields[] = $key;
        }

        return array_values($fields);
    }

public function  flattenAdmissionFields(array $admission): array
    {
        $normalized = ClinicalHistoryRepository::normalizeAdmission001($admission);

        return [
            'identity.documentType' => ClinicalHistoryRepository::trimString($normalized['identity']['documentType'] ?? ''),
            'identity.documentNumber' => ClinicalHistoryRepository::trimString($normalized['identity']['documentNumber'] ?? ''),
            'identity.apellidoPaterno' => ClinicalHistoryRepository::trimString($normalized['identity']['apellidoPaterno'] ?? ''),
            'identity.apellidoMaterno' => ClinicalHistoryRepository::trimString($normalized['identity']['apellidoMaterno'] ?? ''),
            'identity.primerNombre' => ClinicalHistoryRepository::trimString($normalized['identity']['primerNombre'] ?? ''),
            'identity.segundoNombre' => ClinicalHistoryRepository::trimString($normalized['identity']['segundoNombre'] ?? ''),
            'demographics.birthDate' => ClinicalHistoryRepository::trimString($normalized['demographics']['birthDate'] ?? ''),
            'demographics.ageYears' => $normalized['demographics']['ageYears'] ?? null,
            'demographics.sexAtBirth' => ClinicalHistoryRepository::trimString($normalized['demographics']['sexAtBirth'] ?? ''),
            'demographics.maritalStatus' => ClinicalHistoryRepository::trimString($normalized['demographics']['maritalStatus'] ?? ''),
            'demographics.educationLevel' => ClinicalHistoryRepository::trimString($normalized['demographics']['educationLevel'] ?? ''),
            'demographics.occupation' => ClinicalHistoryRepository::trimString($normalized['demographics']['occupation'] ?? ''),
            'demographics.employer' => ClinicalHistoryRepository::trimString($normalized['demographics']['employer'] ?? ''),
            'demographics.nationalityCountry' => ClinicalHistoryRepository::trimString($normalized['demographics']['nationalityCountry'] ?? ''),
            'demographics.culturalGroup' => ClinicalHistoryRepository::trimString($normalized['demographics']['culturalGroup'] ?? ''),
            'demographics.birthPlace' => ClinicalHistoryRepository::trimString($normalized['demographics']['birthPlace'] ?? ''),
            'residence.addressLine' => ClinicalHistoryRepository::trimString($normalized['residence']['addressLine'] ?? ''),
            'residence.neighborhood' => ClinicalHistoryRepository::trimString($normalized['residence']['neighborhood'] ?? ''),
            'residence.zoneType' => ClinicalHistoryRepository::trimString($normalized['residence']['zoneType'] ?? ''),
            'residence.parish' => ClinicalHistoryRepository::trimString($normalized['residence']['parish'] ?? ''),
            'residence.canton' => ClinicalHistoryRepository::trimString($normalized['residence']['canton'] ?? ''),
            'residence.province' => ClinicalHistoryRepository::trimString($normalized['residence']['province'] ?? ''),
            'residence.phone' => ClinicalHistoryRepository::trimString($normalized['residence']['phone'] ?? ''),
            'coverage.healthInsuranceType' => ClinicalHistoryRepository::trimString($normalized['coverage']['healthInsuranceType'] ?? ''),
            'referral.referredBy' => ClinicalHistoryRepository::trimString($normalized['referral']['referredBy'] ?? ''),
            'emergencyContact.name' => ClinicalHistoryRepository::trimString($normalized['emergencyContact']['name'] ?? ''),
            'emergencyContact.kinship' => ClinicalHistoryRepository::trimString($normalized['emergencyContact']['kinship'] ?? ''),
            'emergencyContact.phone' => ClinicalHistoryRepository::trimString($normalized['emergencyContact']['phone'] ?? ''),
            'admissionMeta.admissionDate' => ClinicalHistoryRepository::trimString($normalized['admissionMeta']['admissionDate'] ?? ''),
            'admissionMeta.admissionKind' => ClinicalHistoryRepository::trimString($normalized['admissionMeta']['admissionKind'] ?? ''),
            'admissionMeta.admittedBy' => ClinicalHistoryRepository::trimString($normalized['admissionMeta']['admittedBy'] ?? ''),
        ];
    }

public function  appendAdmissionChangeLog(array $draft, array $fields): array
    {
        $draft = ClinicalHistoryRepository::adminDraft($draft);
        $admission001 = ClinicalHistoryRepository::normalizeAdmission001(
            is_array($draft['admission001'] ?? null) ? $draft['admission001'] : [],
            [],
            is_array($draft['intake'] ?? null) ? $draft['intake'] : [],
            ['draft' => $draft]
        );
        $changeLog = ClinicalHistoryRepository::normalizeAdmissionChangeLog(
            $admission001['history']['changeLog'] ?? []
        );
        $changeLog[] = [
            'changeId' => ClinicalHistoryRepository::newOpaqueId('admchg'),
            'actor' => $this->currentClinicalActor(),
            'actorRole' => 'clinician_admin',
            'changedAt' => local_date('c'),
            'fields' => $fields,
            'summary' => 'Regularización de admisión HCU-001 actualizada.',
        ];
        $admission001['history']['changeLog'] = ClinicalHistoryRepository::normalizeAdmissionChangeLog($changeLog);
        $draft['admission001'] = $admission001;

        return $draft;
    }

public function  buildLiveNoteSummary(array $draft): string
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

public function  buildAiTraceSnapshot(array $session, array $draft): array
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

public function  buildArchiveReadiness(array $recordMeta): array
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

public function  buildRecordsGovernance(
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

public function  applyDisclosureAction(array $session, array $draft, array $payload): array
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

public function  applyArchiveStateAction(array $draft, array $payload): array
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

public function  applyCreateInterconsultationAction(array $session, array $draft, array $payload): array
    {
        $draft = ClinicalHistoryRepository::syncInterconsultationArtifacts($draft, $session);
        $seed = is_array($payload['interconsultation'] ?? null)
            ? $payload['interconsultation']
            : [];
        $now = local_date('c');

        $interconsultation = ClinicalHistoryRepository::normalizeInterconsultation(array_merge(
            $seed,
            [
                'interconsultId' => ClinicalHistoryRepository::newOpaqueId('interconsult'),
                'status' => 'draft',
                'priority' => ClinicalHistoryRepository::trimString($payload['priority'] ?? $seed['priority'] ?? 'normal') ?: 'normal',
                'requiredForCurrentPlan' => array_key_exists('requiredForCurrentPlan', $payload)
                    ? (bool) $payload['requiredForCurrentPlan']
                    : (array_key_exists('requiredForCurrentPlan', $seed) ? (bool) $seed['requiredForCurrentPlan'] : false),
                'requestedAt' => ClinicalHistoryRepository::trimString($seed['requestedAt'] ?? $now) ?: $now,
                'issuedBy' => ClinicalHistoryRepository::trimString($seed['issuedBy'] ?? $this->currentClinicalActor()),
                'history' => [[
                    'eventId' => ClinicalHistoryRepository::newOpaqueId('interconsult-history'),
                    'type' => 'created',
                    'status' => 'draft',
                    'actor' => $this->currentClinicalActor(),
                    'actorRole' => 'clinician_admin',
                    'at' => $now,
                    'notes' => 'Interconsulta HCU-007 creada para el episodio.',
                ]],
            ]
        ));

        $interconsultations = ClinicalHistoryRepository::normalizeInterconsultations($draft['interconsultations'] ?? []);
        array_unshift($interconsultations, $interconsultation);
        $draft['interconsultations'] = $interconsultations;
        $draft['activeInterconsultationId'] = (string) ($interconsultation['interconsultId'] ?? '');
        $draft = ClinicalHistoryRepository::syncInterconsultationArtifacts($draft, $session);

        return [
            'ok' => true,
            'draft' => $draft,
            'meta' => [
                'interconsultId' => (string) ($interconsultation['interconsultId'] ?? ''),
                'priority' => (string) ($interconsultation['priority'] ?? ''),
            ],
        ];
    }

public function  applySelectInterconsultationAction(array $draft, array $payload): array
    {
        $interconsultId = ClinicalHistoryRepository::trimString(
            $payload['interconsultId'] ?? $payload['activeInterconsultationId'] ?? ''
        );
        if ($interconsultId === '') {
            return [
                'ok' => false,
                'statusCode' => 400,
                'error' => 'interconsultId es obligatorio para seleccionar la interconsulta.',
                'errorCode' => 'clinical_interconsultation_required',
            ];
        }

        $exists = false;
        foreach (ClinicalHistoryRepository::normalizeInterconsultations($draft['interconsultations'] ?? []) as $interconsultation) {
            if (ClinicalHistoryRepository::trimString($interconsultation['interconsultId'] ?? '') === $interconsultId) {
                $exists = true;
                break;
            }
        }
        if (!$exists) {
            return [
                'ok' => false,
                'statusCode' => 404,
                'error' => 'No existe la interconsulta seleccionada para este episodio.',
                'errorCode' => 'clinical_interconsultation_not_found',
            ];
        }

        $draft['activeInterconsultationId'] = $interconsultId;
        $draft = ClinicalHistoryRepository::syncInterconsultationArtifacts($draft);

        return [
            'ok' => true,
            'draft' => $draft,
            'meta' => [
                'interconsultId' => $interconsultId,
            ],
        ];
    }

public function  applyIssueInterconsultationAction(array $session, array $draft, array $payload): array
    {
        $draft = ClinicalHistoryRepository::syncInterconsultationArtifacts($draft, $session);
        $interconsultations = ClinicalHistoryRepository::normalizeInterconsultations($draft['interconsultations'] ?? []);
        $interconsultId = ClinicalHistoryRepository::trimString(
            $payload['interconsultId'] ?? $draft['activeInterconsultationId'] ?? ''
        );
        if ($interconsultId === '') {
            return [
                'ok' => false,
                'statusCode' => 404,
                'error' => 'No existe una interconsulta activa para emitir.',
                'errorCode' => 'clinical_interconsultation_not_found',
            ];
        }

        $targetIndex = null;
        foreach ($interconsultations as $index => $interconsultation) {
            if (ClinicalHistoryRepository::trimString($interconsultation['interconsultId'] ?? '') === $interconsultId) {
                $targetIndex = $index;
                break;
            }
        }
        if ($targetIndex === null) {
            return [
                'ok' => false,
                'statusCode' => 404,
                'error' => 'No existe la interconsulta indicada para este episodio.',
                'errorCode' => 'clinical_interconsultation_not_found',
            ];
        }

        $interconsultation = ClinicalHistoryRepository::normalizeInterconsultation($interconsultations[$targetIndex]);
        if (ClinicalHistoryRepository::trimString($interconsultation['issuedBy'] ?? '') === '') {
            $interconsultation['issuedBy'] = $this->currentClinicalActor();
        }
        $evaluation = ClinicalHistoryRepository::evaluateInterconsultation($interconsultation);
        if (($evaluation['readyToIssue'] ?? false) !== true) {
            return [
                'ok' => false,
                'statusCode' => 409,
                'error' => 'La interconsulta HCU-007 aún no cubre los campos mínimos para emisión.',
                'errorCode' => 'clinical_interconsultation_incomplete',
            ];
        }

        $now = local_date('c');
        $interconsultation['status'] = 'issued';
        $interconsultation['issuedAt'] = ClinicalHistoryRepository::trimString($interconsultation['issuedAt'] ?? '') ?: $now;
        $interconsultation['issuedBy'] = ClinicalHistoryRepository::trimString($interconsultation['issuedBy'] ?? '') ?: $this->currentClinicalActor();
        $interconsultation['updatedAt'] = $now;
        $interconsultation['history'][] = [
            'eventId' => ClinicalHistoryRepository::newOpaqueId('interconsult-history'),
            'type' => 'issued',
            'status' => 'issued',
            'actor' => $this->currentClinicalActor(),
            'actorRole' => 'clinician_admin',
            'at' => $now,
            'notes' => 'Interconsulta HCU-007 emitida.',
        ];

        $interconsultations[$targetIndex] = ClinicalHistoryRepository::normalizeInterconsultation($interconsultation);
        $draft['interconsultations'] = $interconsultations;
        $draft['activeInterconsultationId'] = $interconsultId;
        $draft = ClinicalHistoryRepository::syncInterconsultationArtifacts($draft, $session);

        return [
            'ok' => true,
            'draft' => $draft,
            'meta' => [
                'interconsultId' => $interconsultId,
                'destinationService' => (string) ($interconsultation['destinationService'] ?? ''),
                'status' => 'issued',
            ],
        ];
    }

public function  applyCancelInterconsultationAction(array $session, array $draft, array $payload): array
    {
        $draft = ClinicalHistoryRepository::syncInterconsultationArtifacts($draft, $session);
        $interconsultations = ClinicalHistoryRepository::normalizeInterconsultations($draft['interconsultations'] ?? []);
        $interconsultId = ClinicalHistoryRepository::trimString(
            $payload['interconsultId'] ?? $draft['activeInterconsultationId'] ?? ''
        );
        if ($interconsultId === '') {
            return [
                'ok' => false,
                'statusCode' => 404,
                'error' => 'No existe una interconsulta activa para cancelar.',
                'errorCode' => 'clinical_interconsultation_not_found',
            ];
        }

        $targetIndex = null;
        foreach ($interconsultations as $index => $interconsultation) {
            if (ClinicalHistoryRepository::trimString($interconsultation['interconsultId'] ?? '') === $interconsultId) {
                $targetIndex = $index;
                break;
            }
        }
        if ($targetIndex === null) {
            return [
                'ok' => false,
                'statusCode' => 404,
                'error' => 'No existe la interconsulta indicada para este episodio.',
                'errorCode' => 'clinical_interconsultation_not_found',
            ];
        }

        $interconsultation = ClinicalHistoryRepository::normalizeInterconsultation($interconsultations[$targetIndex]);
        $now = local_date('c');
        $cancelReason = ClinicalHistoryRepository::trimString(
            $payload['cancelReason'] ?? $interconsultation['cancelReason'] ?? ''
        );
        $interconsultation['status'] = 'cancelled';
        $interconsultation['cancelledAt'] = ClinicalHistoryRepository::trimString($interconsultation['cancelledAt'] ?? '') ?: $now;
        $interconsultation['cancelReason'] = $cancelReason;
        $interconsultation['updatedAt'] = $now;
        $interconsultation['history'][] = [
            'eventId' => ClinicalHistoryRepository::newOpaqueId('interconsult-history'),
            'type' => 'cancelled',
            'status' => 'cancelled',
            'actor' => $this->currentClinicalActor(),
            'actorRole' => 'clinician_admin',
            'at' => $now,
            'notes' => $cancelReason !== ''
                ? 'Interconsulta cancelada: ' . $cancelReason
                : 'Interconsulta HCU-007 cancelada.',
        ];

        $interconsultations[$targetIndex] = ClinicalHistoryRepository::normalizeInterconsultation($interconsultation);
        $draft['interconsultations'] = $interconsultations;
        $draft['activeInterconsultationId'] = $interconsultId;
        $draft = ClinicalHistoryRepository::syncInterconsultationArtifacts($draft, $session);

        return [
            'ok' => true,
            'draft' => $draft,
            'meta' => [
                'interconsultId' => $interconsultId,
                'cancelReason' => $cancelReason,
                'status' => 'cancelled',
            ],
        ];
    }

public function  applyReceiveInterconsultReportAction(array $session, array $draft, array $payload): array
    {
        $draft = ClinicalHistoryRepository::syncInterconsultationArtifacts($draft, $session);
        $interconsultations = ClinicalHistoryRepository::normalizeInterconsultations($draft['interconsultations'] ?? []);
        $interconsultId = ClinicalHistoryRepository::trimString(
            $payload['interconsultId'] ?? $draft['activeInterconsultationId'] ?? ''
        );
        if ($interconsultId === '') {
            return [
                'ok' => false,
                'statusCode' => 404,
                'error' => 'No existe una interconsulta activa para recibir informe.',
                'errorCode' => 'clinical_interconsultation_not_found',
            ];
        }

        $targetIndex = null;
        foreach ($interconsultations as $index => $interconsultation) {
            if (ClinicalHistoryRepository::trimString($interconsultation['interconsultId'] ?? '') === $interconsultId) {
                $targetIndex = $index;
                break;
            }
        }
        if ($targetIndex === null) {
            return [
                'ok' => false,
                'statusCode' => 404,
                'error' => 'No existe la interconsulta indicada para este episodio.',
                'errorCode' => 'clinical_interconsultation_not_found',
            ];
        }

        $interconsultation = ClinicalHistoryRepository::normalizeInterconsultation($interconsultations[$targetIndex]);
        if (ClinicalHistoryRepository::trimString($interconsultation['status'] ?? '') !== 'issued') {
            return [
                'ok' => false,
                'statusCode' => 409,
                'error' => 'Solo se puede recibir informe sobre una interconsulta ya emitida.',
                'errorCode' => 'clinical_interconsultation_report_requires_issued',
            ];
        }

        $report = ClinicalHistoryRepository::normalizeInterconsultReport(
            isset($interconsultation['report']) && is_array($interconsultation['report']) ? $interconsultation['report'] : []
        );
        $evaluation = ClinicalHistoryRepository::evaluateInterconsultReport($report);
        if (($evaluation['readyToReceive'] ?? false) !== true) {
            return [
                'ok' => false,
                'statusCode' => 409,
                'error' => 'El informe del consultado todavía no cubre los campos mínimos para recepción.',
                'errorCode' => 'clinical_interconsultation_report_incomplete',
            ];
        }

        $now = local_date('c');
        $report['status'] = 'received';
        $report['receivedBy'] = $this->currentClinicalActor();
        $report['updatedAt'] = $now;
        $report['history'][] = [
            'eventId' => ClinicalHistoryRepository::newOpaqueId('interconsult-report-history'),
            'type' => 'received',
            'status' => 'received',
            'actor' => $this->currentClinicalActor(),
            'actorRole' => 'clinician_admin',
            'at' => $now,
            'notes' => 'Informe del consultado recibido y anexado al HCU-007.',
        ];

        $interconsultation['report'] = ClinicalHistoryRepository::normalizeInterconsultReport($report);
        $interconsultation['reportStatus'] = 'received';
        $interconsultation['updatedAt'] = $now;
        $interconsultation['history'][] = [
            'eventId' => ClinicalHistoryRepository::newOpaqueId('interconsult-history'),
            'type' => 'report_received',
            'status' => 'received',
            'actor' => $this->currentClinicalActor(),
            'actorRole' => 'clinician_admin',
            'at' => $now,
            'notes' => 'Informe del consultado recibido sobre la interconsulta emitida.',
        ];

        $interconsultations[$targetIndex] = ClinicalHistoryRepository::normalizeInterconsultation($interconsultation);
        $draft['interconsultations'] = $interconsultations;
        $draft['activeInterconsultationId'] = $interconsultId;
        $draft = ClinicalHistoryRepository::syncInterconsultationArtifacts($draft, $session);

        return [
            'ok' => true,
            'draft' => $draft,
            'meta' => [
                'interconsultId' => $interconsultId,
                'consultantProfessionalName' => (string) ($interconsultation['report']['consultantProfessionalName'] ?? ''),
                'status' => 'received',
            ],
        ];
    }

public function  applyCreateLabOrderAction(array $session, array $draft, array $payload): array
    {
        $draft = ClinicalHistoryRepository::syncLabOrderArtifacts($draft, $session);
        $seed = is_array($payload['labOrder'] ?? null)
            ? $payload['labOrder']
            : [];
        $now = local_date('c');

        $labOrder = ClinicalHistoryRepository::normalizeLabOrder(array_merge(
            $seed,
            [
                'labOrderId' => ClinicalHistoryRepository::newOpaqueId('lab-order'),
                'status' => 'draft',
                'priority' => ClinicalHistoryRepository::trimString($payload['priority'] ?? $seed['priority'] ?? 'routine') ?: 'routine',
                'requiredForCurrentPlan' => array_key_exists('requiredForCurrentPlan', $payload)
                    ? (bool) $payload['requiredForCurrentPlan']
                    : (array_key_exists('requiredForCurrentPlan', $seed) ? (bool) $seed['requiredForCurrentPlan'] : false),
                'requestedAt' => ClinicalHistoryRepository::trimString($seed['requestedAt'] ?? $now) ?: $now,
                'requestedBy' => ClinicalHistoryRepository::trimString($seed['requestedBy'] ?? $this->currentClinicalActor()),
                'history' => [[
                    'eventId' => ClinicalHistoryRepository::newOpaqueId('lab-order-history'),
                    'type' => 'created',
                    'status' => 'draft',
                    'actor' => $this->currentClinicalActor(),
                    'actorRole' => 'clinician_admin',
                    'at' => $now,
                    'notes' => 'Solicitud HCU-010A creada para el episodio.',
                ]],
            ]
        ));

        $labOrders = ClinicalHistoryRepository::normalizeLabOrders($draft['labOrders'] ?? []);
        array_unshift($labOrders, $labOrder);
        $draft['labOrders'] = $labOrders;
        $draft['activeLabOrderId'] = (string) ($labOrder['labOrderId'] ?? '');
        $draft = ClinicalHistoryRepository::syncLabOrderArtifacts($draft, $session);

        return [
            'ok' => true,
            'draft' => $draft,
            'meta' => [
                'labOrderId' => (string) ($labOrder['labOrderId'] ?? ''),
                'priority' => (string) ($labOrder['priority'] ?? ''),
            ],
        ];
    }

public function  applySelectLabOrderAction(array $draft, array $payload): array
    {
        $labOrderId = ClinicalHistoryRepository::trimString(
            $payload['labOrderId'] ?? $payload['activeLabOrderId'] ?? ''
        );
        if ($labOrderId === '') {
            return [
                'ok' => false,
                'statusCode' => 400,
                'error' => 'labOrderId es obligatorio para seleccionar la solicitud de laboratorio.',
                'errorCode' => 'clinical_lab_order_required',
            ];
        }

        $exists = false;
        foreach (ClinicalHistoryRepository::normalizeLabOrders($draft['labOrders'] ?? []) as $labOrder) {
            if (ClinicalHistoryRepository::trimString($labOrder['labOrderId'] ?? '') === $labOrderId) {
                $exists = true;
                break;
            }
        }
        if (!$exists) {
            return [
                'ok' => false,
                'statusCode' => 404,
                'error' => 'No existe la solicitud de laboratorio seleccionada para este episodio.',
                'errorCode' => 'clinical_lab_order_not_found',
            ];
        }

        $draft['activeLabOrderId'] = $labOrderId;
        $draft = ClinicalHistoryRepository::syncLabOrderArtifacts($draft);

        return [
            'ok' => true,
            'draft' => $draft,
            'meta' => [
                'labOrderId' => $labOrderId,
            ],
        ];
    }

public function  applyIssueLabOrderAction(array $session, array $draft, array $payload): array
    {
        $draft = ClinicalHistoryRepository::syncLabOrderArtifacts($draft, $session);
        $labOrders = ClinicalHistoryRepository::normalizeLabOrders($draft['labOrders'] ?? []);
        $labOrderId = ClinicalHistoryRepository::trimString(
            $payload['labOrderId'] ?? $draft['activeLabOrderId'] ?? ''
        );
        if ($labOrderId === '') {
            return [
                'ok' => false,
                'statusCode' => 404,
                'error' => 'No existe una solicitud de laboratorio activa para emitir.',
                'errorCode' => 'clinical_lab_order_not_found',
            ];
        }

        $targetIndex = null;
        foreach ($labOrders as $index => $labOrder) {
            if (ClinicalHistoryRepository::trimString($labOrder['labOrderId'] ?? '') === $labOrderId) {
                $targetIndex = $index;
                break;
            }
        }
        if ($targetIndex === null) {
            return [
                'ok' => false,
                'statusCode' => 404,
                'error' => 'No existe la solicitud de laboratorio indicada para este episodio.',
                'errorCode' => 'clinical_lab_order_not_found',
            ];
        }

        $labOrder = ClinicalHistoryRepository::normalizeLabOrder($labOrders[$targetIndex]);
        if (ClinicalHistoryRepository::trimString($labOrder['requestedBy'] ?? '') === '') {
            $labOrder['requestedBy'] = $this->currentClinicalActor();
        }
        $evaluation = ClinicalHistoryRepository::evaluateLabOrder($labOrder);
        if (($evaluation['readyToIssue'] ?? false) !== true) {
            return [
                'ok' => false,
                'statusCode' => 409,
                'error' => 'La solicitud HCU-010A aún no cubre los campos mínimos para emisión.',
                'errorCode' => 'clinical_lab_order_incomplete',
            ];
        }

        $now = local_date('c');
        $labOrder['status'] = 'issued';
        $labOrder['issuedAt'] = ClinicalHistoryRepository::trimString($labOrder['issuedAt'] ?? '') ?: $now;
        $labOrder['updatedAt'] = $now;
        $labOrder['history'][] = [
            'eventId' => ClinicalHistoryRepository::newOpaqueId('lab-order-history'),
            'type' => 'issued',
            'status' => 'issued',
            'actor' => $this->currentClinicalActor(),
            'actorRole' => 'clinician_admin',
            'at' => $now,
            'notes' => 'Solicitud HCU-010A emitida.',
        ];

        $labOrders[$targetIndex] = ClinicalHistoryRepository::normalizeLabOrder($labOrder);
        $draft['labOrders'] = $labOrders;
        $draft['activeLabOrderId'] = $labOrderId;
        $draft = ClinicalHistoryRepository::syncLabOrderArtifacts($draft, $session);

        return [
            'ok' => true,
            'draft' => $draft,
            'meta' => [
                'labOrderId' => $labOrderId,
                'status' => 'issued',
            ],
        ];
    }

public function  applyCancelLabOrderAction(array $session, array $draft, array $payload): array
    {
        $draft = ClinicalHistoryRepository::syncLabOrderArtifacts($draft, $session);
        $labOrders = ClinicalHistoryRepository::normalizeLabOrders($draft['labOrders'] ?? []);
        $labOrderId = ClinicalHistoryRepository::trimString(
            $payload['labOrderId'] ?? $draft['activeLabOrderId'] ?? ''
        );
        if ($labOrderId === '') {
            return [
                'ok' => false,
                'statusCode' => 404,
                'error' => 'No existe una solicitud de laboratorio activa para cancelar.',
                'errorCode' => 'clinical_lab_order_not_found',
            ];
        }

        $targetIndex = null;
        foreach ($labOrders as $index => $labOrder) {
            if (ClinicalHistoryRepository::trimString($labOrder['labOrderId'] ?? '') === $labOrderId) {
                $targetIndex = $index;
                break;
            }
        }
        if ($targetIndex === null) {
            return [
                'ok' => false,
                'statusCode' => 404,
                'error' => 'No existe la solicitud de laboratorio indicada para este episodio.',
                'errorCode' => 'clinical_lab_order_not_found',
            ];
        }

        $labOrder = ClinicalHistoryRepository::normalizeLabOrder($labOrders[$targetIndex]);
        $now = local_date('c');
        $cancelReason = ClinicalHistoryRepository::trimString(
            $payload['cancelReason'] ?? $labOrder['cancelReason'] ?? ''
        );
        $labOrder['status'] = 'cancelled';
        $labOrder['cancelledAt'] = ClinicalHistoryRepository::trimString($labOrder['cancelledAt'] ?? '') ?: $now;
        $labOrder['cancelReason'] = $cancelReason;
        $labOrder['updatedAt'] = $now;
        $labOrder['history'][] = [
            'eventId' => ClinicalHistoryRepository::newOpaqueId('lab-order-history'),
            'type' => 'cancelled',
            'status' => 'cancelled',
            'actor' => $this->currentClinicalActor(),
            'actorRole' => 'clinician_admin',
            'at' => $now,
            'notes' => $cancelReason !== ''
                ? 'Solicitud HCU-010A cancelada: ' . $cancelReason
                : 'Solicitud HCU-010A cancelada.',
        ];

        $labOrders[$targetIndex] = ClinicalHistoryRepository::normalizeLabOrder($labOrder);
        $draft['labOrders'] = $labOrders;
        $draft['activeLabOrderId'] = $labOrderId;
        $draft = ClinicalHistoryRepository::syncLabOrderArtifacts($draft, $session);

        return [
            'ok' => true,
            'draft' => $draft,
            'meta' => [
                'labOrderId' => $labOrderId,
                'cancelReason' => $cancelReason,
                'status' => 'cancelled',
            ],
        ];
    }

public function  applyCreateImagingOrderAction(array $session, array $draft, array $payload): array
    {
        $draft = ClinicalHistoryRepository::syncImagingOrderArtifacts($draft, $session);
        $seed = is_array($payload['imagingOrder'] ?? null)
            ? $payload['imagingOrder']
            : [];
        $now = local_date('c');

        $imagingOrder = ClinicalHistoryRepository::normalizeImagingOrder(array_merge(
            $seed,
            [
                'imagingOrderId' => ClinicalHistoryRepository::newOpaqueId('imaging-order'),
                'status' => 'draft',
                'priority' => ClinicalHistoryRepository::trimString($payload['priority'] ?? $seed['priority'] ?? 'routine') ?: 'routine',
                'requiredForCurrentPlan' => array_key_exists('requiredForCurrentPlan', $payload)
                    ? (bool) $payload['requiredForCurrentPlan']
                    : (array_key_exists('requiredForCurrentPlan', $seed) ? (bool) $seed['requiredForCurrentPlan'] : false),
                'requestedAt' => ClinicalHistoryRepository::trimString($seed['requestedAt'] ?? $now) ?: $now,
                'requestedBy' => ClinicalHistoryRepository::trimString($seed['requestedBy'] ?? $this->currentClinicalActor()),
                'history' => [[
                    'eventId' => ClinicalHistoryRepository::newOpaqueId('imaging-order-history'),
                    'type' => 'created',
                    'status' => 'draft',
                    'actor' => $this->currentClinicalActor(),
                    'actorRole' => 'clinician_admin',
                    'at' => $now,
                    'notes' => 'Solicitud HCU-012A creada para el episodio.',
                ]],
            ]
        ));

        $imagingOrders = ClinicalHistoryRepository::normalizeImagingOrders($draft['imagingOrders'] ?? []);
        array_unshift($imagingOrders, $imagingOrder);
        $draft['imagingOrders'] = $imagingOrders;
        $draft['activeImagingOrderId'] = (string) ($imagingOrder['imagingOrderId'] ?? '');
        $draft = ClinicalHistoryRepository::syncImagingOrderArtifacts($draft, $session);

        return [
            'ok' => true,
            'draft' => $draft,
            'meta' => [
                'imagingOrderId' => (string) ($imagingOrder['imagingOrderId'] ?? ''),
                'priority' => (string) ($imagingOrder['priority'] ?? ''),
            ],
        ];
    }

public function  applySelectImagingOrderAction(array $draft, array $payload): array
    {
        $imagingOrderId = ClinicalHistoryRepository::trimString(
            $payload['imagingOrderId'] ?? $payload['activeImagingOrderId'] ?? ''
        );
        if ($imagingOrderId === '') {
            return [
                'ok' => false,
                'statusCode' => 400,
                'error' => 'imagingOrderId es obligatorio para seleccionar la solicitud de imagenología.',
                'errorCode' => 'clinical_imaging_order_required',
            ];
        }

        $exists = false;
        foreach (ClinicalHistoryRepository::normalizeImagingOrders($draft['imagingOrders'] ?? []) as $imagingOrder) {
            if (ClinicalHistoryRepository::trimString($imagingOrder['imagingOrderId'] ?? '') === $imagingOrderId) {
                $exists = true;
                break;
            }
        }
        if (!$exists) {
            return [
                'ok' => false,
                'statusCode' => 404,
                'error' => 'No existe la solicitud de imagenología seleccionada para este episodio.',
                'errorCode' => 'clinical_imaging_order_not_found',
            ];
        }

        $draft['activeImagingOrderId'] = $imagingOrderId;
        $draft = ClinicalHistoryRepository::syncImagingOrderArtifacts($draft);

        return [
            'ok' => true,
            'draft' => $draft,
            'meta' => [
                'imagingOrderId' => $imagingOrderId,
            ],
        ];
    }

public function  applyIssueImagingOrderAction(array $session, array $draft, array $payload): array
    {
        $draft = ClinicalHistoryRepository::syncImagingOrderArtifacts($draft, $session);
        $imagingOrders = ClinicalHistoryRepository::normalizeImagingOrders($draft['imagingOrders'] ?? []);
        $imagingOrderId = ClinicalHistoryRepository::trimString(
            $payload['imagingOrderId'] ?? $draft['activeImagingOrderId'] ?? ''
        );
        if ($imagingOrderId === '') {
            return [
                'ok' => false,
                'statusCode' => 404,
                'error' => 'No existe una solicitud de imagenología activa para emitir.',
                'errorCode' => 'clinical_imaging_order_not_found',
            ];
        }

        $targetIndex = null;
        foreach ($imagingOrders as $index => $imagingOrder) {
            if (ClinicalHistoryRepository::trimString($imagingOrder['imagingOrderId'] ?? '') === $imagingOrderId) {
                $targetIndex = $index;
                break;
            }
        }
        if ($targetIndex === null) {
            return [
                'ok' => false,
                'statusCode' => 404,
                'error' => 'No existe la solicitud de imagenología indicada para este episodio.',
                'errorCode' => 'clinical_imaging_order_not_found',
            ];
        }

        $imagingOrder = ClinicalHistoryRepository::normalizeImagingOrder($imagingOrders[$targetIndex]);
        if (ClinicalHistoryRepository::trimString($imagingOrder['requestedBy'] ?? '') === '') {
            $imagingOrder['requestedBy'] = $this->currentClinicalActor();
        }
        $evaluation = ClinicalHistoryRepository::evaluateImagingOrder($imagingOrder);
        if (($evaluation['readyToIssue'] ?? false) !== true) {
            return [
                'ok' => false,
                'statusCode' => 409,
                'error' => 'La solicitud HCU-012A aún no cubre los campos mínimos para emisión.',
                'errorCode' => 'clinical_imaging_order_incomplete',
            ];
        }

        $now = local_date('c');
        $imagingOrder['status'] = 'issued';
        $imagingOrder['issuedAt'] = ClinicalHistoryRepository::trimString($imagingOrder['issuedAt'] ?? '') ?: $now;
        $imagingOrder['updatedAt'] = $now;
        $imagingOrder['history'][] = [
            'eventId' => ClinicalHistoryRepository::newOpaqueId('imaging-order-history'),
            'type' => 'issued',
            'status' => 'issued',
            'actor' => $this->currentClinicalActor(),
            'actorRole' => 'clinician_admin',
            'at' => $now,
            'notes' => 'Solicitud HCU-012A emitida.',
        ];

        $imagingOrders[$targetIndex] = ClinicalHistoryRepository::normalizeImagingOrder($imagingOrder);
        $draft['imagingOrders'] = $imagingOrders;
        $draft['activeImagingOrderId'] = $imagingOrderId;
        $draft = ClinicalHistoryRepository::syncImagingOrderArtifacts($draft, $session);

        return [
            'ok' => true,
            'draft' => $draft,
            'meta' => [
                'imagingOrderId' => $imagingOrderId,
                'status' => 'issued',
            ],
        ];
    }

public function  applyCancelImagingOrderAction(array $session, array $draft, array $payload): array
    {
        $draft = ClinicalHistoryRepository::syncImagingOrderArtifacts($draft, $session);
        $imagingOrders = ClinicalHistoryRepository::normalizeImagingOrders($draft['imagingOrders'] ?? []);
        $imagingOrderId = ClinicalHistoryRepository::trimString(
            $payload['imagingOrderId'] ?? $draft['activeImagingOrderId'] ?? ''
        );
        if ($imagingOrderId === '') {
            return [
                'ok' => false,
                'statusCode' => 404,
                'error' => 'No existe una solicitud de imagenología activa para cancelar.',
                'errorCode' => 'clinical_imaging_order_not_found',
            ];
        }

        $targetIndex = null;
        foreach ($imagingOrders as $index => $imagingOrder) {
            if (ClinicalHistoryRepository::trimString($imagingOrder['imagingOrderId'] ?? '') === $imagingOrderId) {
                $targetIndex = $index;
                break;
            }
        }
        if ($targetIndex === null) {
            return [
                'ok' => false,
                'statusCode' => 404,
                'error' => 'No existe la solicitud de imagenología indicada para este episodio.',
                'errorCode' => 'clinical_imaging_order_not_found',
            ];
        }

        $imagingOrder = ClinicalHistoryRepository::normalizeImagingOrder($imagingOrders[$targetIndex]);
        $now = local_date('c');
        $cancelReason = ClinicalHistoryRepository::trimString(
            $payload['cancelReason'] ?? $imagingOrder['cancelReason'] ?? ''
        );
        $imagingOrder['status'] = 'cancelled';
        $imagingOrder['cancelledAt'] = ClinicalHistoryRepository::trimString($imagingOrder['cancelledAt'] ?? '') ?: $now;
        $imagingOrder['cancelReason'] = $cancelReason;
        $imagingOrder['updatedAt'] = $now;
        $imagingOrder['history'][] = [
            'eventId' => ClinicalHistoryRepository::newOpaqueId('imaging-order-history'),
            'type' => 'cancelled',
            'status' => 'cancelled',
            'actor' => $this->currentClinicalActor(),
            'actorRole' => 'clinician_admin',
            'at' => $now,
            'notes' => $cancelReason !== ''
                ? 'Solicitud HCU-012A cancelada: ' . $cancelReason
                : 'Solicitud HCU-012A cancelada.',
        ];

        $imagingOrders[$targetIndex] = ClinicalHistoryRepository::normalizeImagingOrder($imagingOrder);
        $draft['imagingOrders'] = $imagingOrders;
        $draft['activeImagingOrderId'] = $imagingOrderId;
        $draft = ClinicalHistoryRepository::syncImagingOrderArtifacts($draft, $session);

        return [
            'ok' => true,
            'draft' => $draft,
            'meta' => [
                'imagingOrderId' => $imagingOrderId,
                'cancelReason' => $cancelReason,
                'status' => 'cancelled',
            ],
        ];
    }

public function  applyReceiveImagingReportAction(array $session, array $draft, array $payload): array
    {
        $draft = ClinicalHistoryRepository::syncImagingOrderArtifacts($draft, $session);
        $imagingOrders = ClinicalHistoryRepository::normalizeImagingOrders($draft['imagingOrders'] ?? []);
        $imagingOrderId = ClinicalHistoryRepository::trimString(
            $payload['imagingOrderId'] ?? $draft['activeImagingOrderId'] ?? ''
        );
        if ($imagingOrderId === '') {
            return [
                'ok' => false,
                'statusCode' => 404,
                'error' => 'No existe una solicitud de imagenología activa para recibir resultado.',
                'errorCode' => 'clinical_imaging_order_not_found',
            ];
        }

        $targetIndex = null;
        foreach ($imagingOrders as $index => $imagingOrder) {
            if (ClinicalHistoryRepository::trimString($imagingOrder['imagingOrderId'] ?? '') === $imagingOrderId) {
                $targetIndex = $index;
                break;
            }
        }
        if ($targetIndex === null) {
            return [
                'ok' => false,
                'statusCode' => 404,
                'error' => 'No existe la solicitud de imagenología indicada para este episodio.',
                'errorCode' => 'clinical_imaging_order_not_found',
            ];
        }

        $imagingOrder = ClinicalHistoryRepository::normalizeImagingOrder($imagingOrders[$targetIndex]);
        if (ClinicalHistoryRepository::trimString($imagingOrder['status'] ?? '') !== 'issued') {
            return [
                'ok' => false,
                'statusCode' => 409,
                'error' => 'Solo se puede recibir resultado sobre una solicitud HCU-012A ya emitida.',
                'errorCode' => 'clinical_imaging_report_requires_issued',
            ];
        }

        $report = ClinicalHistoryRepository::normalizeImagingReport(
            isset($imagingOrder['result']) && is_array($imagingOrder['result']) ? $imagingOrder['result'] : []
        );
        $evaluation = ClinicalHistoryRepository::evaluateImagingReport($report);
        if (($evaluation['readyToReceive'] ?? false) !== true) {
            return [
                'ok' => false,
                'statusCode' => 409,
                'error' => 'El resultado radiológico todavía no cubre los campos mínimos para recepción.',
                'errorCode' => 'clinical_imaging_report_incomplete',
            ];
        }

        $now = local_date('c');
        $report['status'] = 'received';
        $report['receivedBy'] = $this->currentClinicalActor();
        $report['updatedAt'] = $now;
        $report['history'][] = [
            'eventId' => ClinicalHistoryRepository::newOpaqueId('imaging-report-history'),
            'type' => 'received',
            'status' => 'received',
            'actor' => $this->currentClinicalActor(),
            'actorRole' => 'clinician_admin',
            'at' => $now,
            'notes' => 'Resultado radiológico recibido y anexado al HCU-012A.',
        ];

        $imagingOrder['result'] = ClinicalHistoryRepository::normalizeImagingReport($report);
        $imagingOrder['resultStatus'] = 'received';
        $imagingOrder['updatedAt'] = $now;
        $imagingOrder['history'][] = [
            'eventId' => ClinicalHistoryRepository::newOpaqueId('imaging-order-history'),
            'type' => 'report_received',
            'status' => 'received',
            'actor' => $this->currentClinicalActor(),
            'actorRole' => 'clinician_admin',
            'at' => $now,
            'notes' => 'Resultado radiológico recibido sobre la solicitud emitida.',
        ];

        $imagingOrders[$targetIndex] = ClinicalHistoryRepository::normalizeImagingOrder($imagingOrder);
        $draft['imagingOrders'] = $imagingOrders;
        $draft['activeImagingOrderId'] = $imagingOrderId;
        $draft = ClinicalHistoryRepository::syncImagingOrderArtifacts($draft, $session);

        return [
            'ok' => true,
            'draft' => $draft,
            'meta' => [
                'imagingOrderId' => $imagingOrderId,
                'radiologistProfessionalName' => (string) ($imagingOrder['result']['radiologistProfessionalName'] ?? ''),
                'status' => 'received',
            ],
        ];
    }

public function  addHoursToTimestamp(string $stamp, int $hours): string
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

public function  timestampIsPast(string $stamp): bool
    {
        try {
            return (new \DateTimeImmutable($stamp)) <= new \DateTimeImmutable(local_date('c'));
        } catch (\Throwable $e) {
            return false;
        }
    }

public function  currentClinicalActor(): string
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

public function  resolveSessionContext(array $store, array $payload, bool $createIfMissing): array
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
            $draft = ClinicalHistoryRepository::defaultDraft(
                $session,
                $created
                    ? [
                          'admission001' => [
                              'admissionMeta' => [
                                  'transitionMode' => 'new_required',
                              ],
                          ],
                      ]
                    : []
            );
        } else {
            $draft = ClinicalHistoryRepository::adminDraft($draft);
        }

        $draft['sessionId'] = (string) ($session['sessionId'] ?? '');
        $draft['caseId'] = (string) ($session['caseId'] ?? '');
        $draft['appointmentId'] = $session['appointmentId'] ?? null;

        return [$store, $session, $draft, $created];
    }

public function  findContext(array $store, array $payload): array
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

public function  extractPatientMessage(array $payload): string
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

public function  isReplay(array $session, string $clientMessageId, string $messageHash): bool
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

public function  attachUploads(array $store, array $session, array $draft, array $payload): array
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

public function  reconcilePendingAi(array $store, array $session, array $draft): array
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

public function  buildPendingAi(
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

public function  clearPendingAi(array $session, array $draft, string $reason): array
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

public function  closePendingAi(array $session, array $draft, array $pending, string $status, string $reason, array $options = []): array
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

public function  assistantContentFromResponse(array $response): string
    {
        return trim(implode("\n\n", array_filter([
            ClinicalHistoryRepository::trimString($response['reply'] ?? ''),
            ClinicalHistoryRepository::trimString($response['nextQuestion'] ?? ''),
        ])));
    }

public function  replaceAssistantTranscriptMessage(
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

public function  removeQuestionFieldFromHistory(array $history, string $fieldKey): array
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

public function  touchSession(array $session): array
    {
        $session['updatedAt'] = local_date('c');
        $session['version'] = max(1, (int) ($session['version'] ?? 1)) + 1;
        return $session;
    }

public function  touchDraft(array $draft): array
    {
        $draft['updatedAt'] = local_date('c');
        $draft['version'] = max(1, (int) ($draft['version'] ?? 1)) + 1;
        return $draft;
    }

public function  recordPendingAiLifecycleEvent(
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

public function  publicAiPayload(array $aiResult): array
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
