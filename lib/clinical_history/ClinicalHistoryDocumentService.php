<?php
declare(strict_types=1);

class ClinicalHistoryDocumentService
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

public function  exportClinicalRecord(array $store, array $payload): array
    {
        [$session, $draft] = $this->findContext($store, $payload);
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

        if (($reconciled['mutated'] ?? false) === true) {
            $sessionSave = ClinicalHistoryRepository::upsertSession($store, $session);
            $store = $sessionSave['store'];
            $session = $sessionSave['session'];

            $draftSave = ClinicalHistoryRepository::upsertDraft($store, $draft);
            $store = $draftSave['store'];
            $draft = $draftSave['draft'];
        }

        $events = ClinicalHistoryRepository::findEventsBySessionId(
            $store,
            (string) ($session['sessionId'] ?? '')
        );
        $legalReadiness = ClinicalHistoryLegalReadiness::build($session, $draft, $events);
        $approval = ClinicalHistoryRepository::normalizeApprovalRecord(
            is_array($draft['approval'] ?? null) ? $draft['approval'] : []
        );
        $blockingReasons = isset($legalReadiness['blockingReasons']) && is_array($legalReadiness['blockingReasons'])
            ? array_values($legalReadiness['blockingReasons'])
            : [];

        $store = $this->recordAccessAudit(
            $store,
            $session,
            $draft,
            'export_full_record',
            'authorized_clinical_record_export',
            [
                'surface' => 'clinical-record-export',
                'approvalStatus' => (string) ($approval['status'] ?? 'pending'),
                'legalReadinessStatus' => (string) ($legalReadiness['status'] ?? 'blocked'),
                'legalReadinessReady' => ($legalReadiness['ready'] ?? false) === true,
                'blockingReasonsCount' => count($blockingReasons),
            ]
        );

        audit_log_event('clinical_history.record_exported', [
            'sessionId' => (string) ($session['sessionId'] ?? ''),
            'caseId' => (string) ($session['caseId'] ?? ''),
            'recordId' => (string) ($draft['patientRecordId'] ?? ''),
            'approvalStatus' => (string) ($approval['status'] ?? 'pending'),
            'legalReadinessStatus' => (string) ($legalReadiness['status'] ?? 'blocked'),
        ]);

        return [
            'ok' => true,
            'statusCode' => 200,
            'store' => $store,
            'session' => $session,
            'draft' => $draft,
            'data' => $this->buildClinicalRecordPayload($store, $session, $draft),
        ];
    }

public function  decorateCopyRequest(array $request): array
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

public function  resolveCopyRequestEffectiveStatus(array $request): string
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

public function  applyCertifiedCopyRequest(array $session, array $draft, array $payload): array
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

public function  applyCertifiedCopyDelivery(array $session, array $draft, array $payload): array
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

}
