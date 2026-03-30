<?php
declare(strict_types=1);

class ClinicalHistoryValidationService
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

public function  applyReview(array $store, array $payload): array
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

public function  applyClinicalApproval(array $session, array $draft, array $legalReadiness): array
    {
        $draft = $this->synchronizeDraftClinicalState(
            ClinicalHistoryRepository::adminDraft($draft),
            $session
        );
        $documents = ClinicalHistoryRepository::normalizeClinicalDocuments(
            is_array($draft['documents'] ?? null) ? $draft['documents'] : []
        );
        $clinicianDraft = ClinicalHistoryRepository::normalizeClinicianDraft(
            is_array($draft['clinicianDraft'] ?? null) ? $draft['clinicianDraft'] : []
        );
        $admission001 = ClinicalHistoryRepository::normalizeAdmission001(
            is_array($draft['admission001'] ?? null) ? $draft['admission001'] : [],
            is_array($session['patient'] ?? null) ? $session['patient'] : [],
            is_array($draft['intake'] ?? null) ? $draft['intake'] : [],
            ['draft' => $draft]
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
                'hcu001' => $admission001,
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

public function  applyCreateConsentPacketAction(array $session, array $draft, array $payload): array
    {
        $draft = ClinicalHistoryRepository::syncConsentArtifacts($draft, $session);
        $templateKey = ClinicalHistoryRepository::trimString($payload['templateKey'] ?? 'generic');
        if ($templateKey === '') {
            $templateKey = 'generic';
        }

        $packet = ClinicalHistoryRepository::normalizeConsentPacket([
            'packetId' => ClinicalHistoryRepository::newOpaqueId('consent'),
            'templateKey' => $templateKey,
            'status' => 'draft',
            'history' => [[
                'eventId' => ClinicalHistoryRepository::newOpaqueId('consent-history'),
                'type' => 'created',
                'status' => 'draft',
                'actor' => $this->currentClinicalActor(),
                'actorRole' => 'clinician_admin',
                'at' => local_date('c'),
                'notes' => 'Consentimiento HCU-024 creado para el episodio.',
            ]],
        ], ClinicalHistoryRepository::consentPacketTemplate($templateKey));

        $packets = ClinicalHistoryRepository::normalizeConsentPackets($draft['consentPackets'] ?? []);
        array_unshift($packets, $packet);
        $draft['consentPackets'] = $packets;
        $draft['activeConsentPacketId'] = (string) ($packet['packetId'] ?? '');
        $draft = ClinicalHistoryRepository::syncConsentArtifacts($draft, $session);

        return [
            'ok' => true,
            'draft' => $draft,
            'meta' => [
                'packetId' => (string) ($packet['packetId'] ?? ''),
                'templateKey' => $templateKey,
            ],
        ];
    }

public function  applySelectConsentPacketAction(array $draft, array $payload): array
    {
        $packetId = ClinicalHistoryRepository::trimString(
            $payload['packetId'] ?? $payload['activeConsentPacketId'] ?? ''
        );
        if ($packetId === '') {
            return [
                'ok' => false,
                'statusCode' => 400,
                'error' => 'packetId es obligatorio para seleccionar el consentimiento.',
                'errorCode' => 'clinical_consent_packet_required',
            ];
        }

        $exists = false;
        foreach (ClinicalHistoryRepository::normalizeConsentPackets($draft['consentPackets'] ?? []) as $packet) {
            if (ClinicalHistoryRepository::trimString($packet['packetId'] ?? '') === $packetId) {
                $exists = true;
                break;
            }
        }
        if (!$exists) {
            return [
                'ok' => false,
                'statusCode' => 404,
                'error' => 'No existe el consentimiento seleccionado para este episodio.',
                'errorCode' => 'clinical_consent_packet_not_found',
            ];
        }

        $draft['activeConsentPacketId'] = $packetId;
        $draft = ClinicalHistoryRepository::syncConsentArtifacts($draft);

        return [
            'ok' => true,
            'draft' => $draft,
            'meta' => [
                'packetId' => $packetId,
            ],
        ];
    }

public function  applyConsentDecisionAction(array $session, array $draft, array $payload, string $mode): array
    {
        $draft = ClinicalHistoryRepository::syncConsentArtifacts($draft, $session);
        $packets = ClinicalHistoryRepository::normalizeConsentPackets($draft['consentPackets'] ?? []);
        $packetId = ClinicalHistoryRepository::trimString(
            $payload['packetId'] ?? $draft['activeConsentPacketId'] ?? ''
        );
        if ($packetId === '' && $packets === []) {
            $draft = ClinicalHistoryRepository::applyConsentBridgePatch(
                $draft,
                [
                    'required' => true,
                    'status' => 'draft',
                ],
                $session
            );
            $packets = ClinicalHistoryRepository::normalizeConsentPackets($draft['consentPackets'] ?? []);
            $packetId = ClinicalHistoryRepository::trimString($draft['activeConsentPacketId'] ?? '');
        }

        $targetIndex = null;
        foreach ($packets as $index => $packet) {
            if (ClinicalHistoryRepository::trimString($packet['packetId'] ?? '') === $packetId) {
                $targetIndex = $index;
                break;
            }
        }
        if ($targetIndex === null) {
            return [
                'ok' => false,
                'statusCode' => 404,
                'error' => 'No existe un consentimiento activo para este episodio.',
                'errorCode' => 'clinical_consent_packet_not_found',
            ];
        }

        $packet = ClinicalHistoryRepository::normalizeConsentPacket($packets[$targetIndex]);
        $admission = ClinicalHistoryRepository::normalizeAdmission001(
            is_array($draft['admission001'] ?? null) ? $draft['admission001'] : [],
            is_array($session['patient'] ?? null) ? $session['patient'] : [],
            is_array($draft['intake'] ?? null) ? $draft['intake'] : [],
            ['draft' => $draft]
        );
        $patient = ClinicalHistoryRepository::buildPatientMirrorFromAdmission(
            is_array($session['patient'] ?? null) ? $session['patient'] : [],
            $admission,
            is_array($draft['intake'] ?? null) ? $draft['intake'] : []
        );
        $now = local_date('c');

        if ($mode === 'declare-consent') {
            if (ClinicalHistoryRepository::trimString($packet['declaration']['declaredAt'] ?? '') === '') {
                $packet['declaration']['declaredAt'] = $now;
            }
            if (ClinicalHistoryRepository::trimString($packet['patientAttestation']['name'] ?? '') === '') {
                $packet['patientAttestation']['name'] = ClinicalHistoryRepository::trimString(
                    $packet['patientName'] ?? $patient['legalName'] ?? $patient['name'] ?? ''
                );
            }
            if (ClinicalHistoryRepository::trimString($packet['patientAttestation']['documentNumber'] ?? '') === '') {
                $packet['patientAttestation']['documentNumber'] = ClinicalHistoryRepository::trimString(
                    $packet['patientDocumentNumber'] ?? $admission['identity']['documentNumber'] ?? ''
                );
            }
            if (($packet['declaration']['patientCanConsent'] ?? true) === true
                && ClinicalHistoryRepository::trimString($packet['patientAttestation']['signedAt'] ?? '') === ''
            ) {
                $packet['patientAttestation']['signedAt'] = $now;
            }
            if (($packet['declaration']['patientCanConsent'] ?? true) !== true
                && ClinicalHistoryRepository::trimString($packet['representativeAttestation']['name'] ?? '') !== ''
                && ClinicalHistoryRepository::trimString($packet['representativeAttestation']['signedAt'] ?? '') === ''
            ) {
                $packet['representativeAttestation']['signedAt'] = $now;
            }
            if (ClinicalHistoryRepository::trimString($packet['professionalAttestation']['signedAt'] ?? '') === '') {
                $packet['professionalAttestation']['signedAt'] = $now;
            }
            $evaluation = ClinicalHistoryRepository::evaluateConsentPacket($packet);
            if (($evaluation['readyForDeclaration'] ?? false) !== true) {
                return [
                    'ok' => false,
                    'statusCode' => 409,
                    'error' => 'El consentimiento HCU-024 aun no cubre los bloques obligatorios del formulario.',
                    'errorCode' => 'clinical_consent_packet_incomplete',
                ];
            }
            $packet['status'] = 'accepted';
            $reason = 'consent_declared';
            $historyType = 'accepted';
            $historyNote = 'Consentimiento declarado y aceptado.';
        } elseif ($mode === 'deny-consent') {
            if (($packet['denial']['patientRefusedSignature'] ?? false) === true) {
                $hasWitness = ClinicalHistoryRepository::trimString($packet['witnessAttestation']['name'] ?? '') !== ''
                    && ClinicalHistoryRepository::trimString($packet['witnessAttestation']['documentNumber'] ?? '') !== '';
                if (!$hasWitness) {
                    return [
                        'ok' => false,
                        'statusCode' => 409,
                        'error' => 'La negativa sin firma del paciente exige testigo identificado.',
                        'errorCode' => 'clinical_consent_witness_required',
                    ];
                }
                if (ClinicalHistoryRepository::trimString($packet['witnessAttestation']['signedAt'] ?? '') === '') {
                    $packet['witnessAttestation']['signedAt'] = $now;
                }
            }
            if (($packet['declaration']['patientCanConsent'] ?? true) !== true
                && ClinicalHistoryRepository::trimString($packet['representativeAttestation']['name'] ?? '') === ''
            ) {
                return [
                    'ok' => false,
                    'statusCode' => 409,
                    'error' => 'La negativa requiere representante cuando el paciente no puede consentir.',
                    'errorCode' => 'clinical_consent_representative_required',
                ];
            }
            if (($packet['declaration']['patientCanConsent'] ?? true) !== true
                && ClinicalHistoryRepository::trimString($packet['representativeAttestation']['signedAt'] ?? '') === ''
                && ClinicalHistoryRepository::trimString($packet['representativeAttestation']['name'] ?? '') !== ''
            ) {
                $packet['representativeAttestation']['signedAt'] = $now;
            }
            if (ClinicalHistoryRepository::trimString($packet['denial']['declinedAt'] ?? '') === '') {
                $packet['denial']['declinedAt'] = $now;
            }
            $packet['status'] = 'declined';
            $reason = 'consent_denied';
            $historyType = 'declined';
            $historyNote = 'Consentimiento negado.';
        } else {
            $receivedBy = ClinicalHistoryRepository::trimString(
                $payload['receivedBy']
                    ?? $packet['revocation']['receivedBy']
                    ?? $packet['professionalAttestation']['name']
                    ?? ''
            );
            if ($receivedBy === '') {
                return [
                    'ok' => false,
                    'statusCode' => 409,
                    'error' => 'La revocatoria exige identificar al profesional que la recibe.',
                    'errorCode' => 'clinical_consent_revocation_receiver_required',
                ];
            }
            $packet['revocation']['receivedBy'] = $receivedBy;
            if (ClinicalHistoryRepository::trimString($packet['revocation']['revokedAt'] ?? '') === '') {
                $packet['revocation']['revokedAt'] = $now;
            }
            $packet['status'] = 'revoked';
            $reason = 'consent_revoked';
            $historyType = 'revoked';
            $historyNote = 'Consentimiento revocado.';
        }

        $packet['history'][] = [
            'eventId' => ClinicalHistoryRepository::newOpaqueId('consent-history'),
            'type' => $historyType,
            'status' => (string) ($packet['status'] ?? ''),
            'actor' => $this->currentClinicalActor(),
            'actorRole' => 'clinician_admin',
            'at' => $now,
            'notes' => $historyNote,
        ];
        $packet['updatedAt'] = $now;
        $packets[$targetIndex] = ClinicalHistoryRepository::normalizeConsentPacket($packet);
        $draft['consentPackets'] = $packets;
        $draft['activeConsentPacketId'] = $packetId;
        $draft = ClinicalHistoryRepository::syncConsentArtifacts($draft, $session);

        return [
            'ok' => true,
            'draft' => $draft,
            'reason' => $reason,
            'meta' => [
                'packetId' => $packetId,
                'status' => (string) ($packet['status'] ?? ''),
            ],
        ];
    }

public function  accessAuditActionForMode(string $mode): string
    {
        return match ($mode) {
            'save' => 'edit_record',
            'approve' => 'approve_final_note',
            'follow-up' => 'request_missing_data',
            'schedule-follow-up' => 'schedule_follow_up',
            'deliver-care-plan' => 'deliver_care_plan',
            'review-required' => 'mark_review_required',
            'create-consent-packet' => 'create_consent_packet',
            'select-consent-packet' => 'select_consent_packet',
            'declare-consent' => 'declare_consent',
            'deny-consent' => 'deny_consent',
            'revoke-consent' => 'revoke_consent',
            'create-interconsultation' => 'create_interconsultation',
            'select-interconsultation' => 'select_interconsultation',
            'issue-interconsultation' => 'issue_interconsultation',
            'cancel-interconsultation' => 'cancel_interconsultation',
            'receive-interconsult-report' => 'receive_interconsult_report',
            'create-lab-order' => 'create_lab_order',
            'select-lab-order' => 'select_lab_order',
            'issue-lab-order' => 'issue_lab_order',
            'cancel-lab-order' => 'cancel_lab_order',
            'create-imaging-order' => 'create_imaging_order',
            'select-imaging-order' => 'select_imaging_order',
            'issue-imaging-order' => 'issue_imaging_order',
            'cancel-imaging-order' => 'cancel_imaging_order',
            'receive-imaging-report' => 'receive_imaging_report',
            'prescription' => 'issue_prescription',
            'certificate' => 'issue_certificate',
            'copy-request' => 'request_certified_copy',
            'copy-delivery' => 'deliver_certified_copy',
            'disclosure' => 'log_disclosure',
            'archive-state' => 'set_archive_state',
            default => 'edit_record',
        };
    }

public function  recordAccessAudit(
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

public function  buildAccessAuditEntry(
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

public function  touchSessionEventsForReview(array $store, array $session, bool $resolve): array
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

}
