<?php

declare(strict_types=1);

class PatientPortalConsentController
{
    public static function consent(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $session = PatientPortalAuth::authenticateSession(
            $store,
            PatientPortalAuth::bearerTokenFromRequest()
        );

        if (($session['ok'] ?? false) !== true) {
            PatientPortalController::emit($session);
            return;
        }

        $sessionData = is_array($session['data'] ?? null) ? $session['data'] : [];
        $snapshot = is_array($sessionData['snapshot'] ?? null) ? $sessionData['snapshot'] : [];
        $patient = is_array($sessionData['patient'] ?? null) ? $sessionData['patient'] : [];

        PatientPortalController::emit([
            'ok' => true,
            'data' => [
                'authenticated' => true,
                'patient' => $patient,
                'consent' => self::buildPortalConsentSummary($store, $snapshot),
                'generatedAt' => local_date('c'),
            ],
        ]);
    }


    public static function signConsent(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $session = PatientPortalAuth::authenticateSession(
            $store,
            PatientPortalAuth::bearerTokenFromRequest()
        );

        if (($session['ok'] ?? false) !== true) {
            PatientPortalController::emit($session);
            return;
        }

        $payload = require_json_body();
        $sessionData = is_array($session['data'] ?? null) ? $session['data'] : [];
        $snapshot = is_array($sessionData['snapshot'] ?? null) ? $sessionData['snapshot'] : [];
        $portalPatient = is_array($sessionData['patient'] ?? null) ? $sessionData['patient'] : [];

        $consentContext = self::resolvePortalConsentContext($store, $snapshot);
        if ($consentContext === null) {
            PatientPortalController::emit([
                'ok' => false,
                'statusCode' => 404,
                'error' => 'No tienes un consentimiento activo para firmar.',
                'code' => 'patient_portal_consent_not_found',
            ]);
            return;
        }

        $state = (string) ($consentContext['state'] ?? '');
        if ($state === 'signed') {
            PatientPortalController::emit([
                'ok' => true,
                'data' => [
                    'authenticated' => true,
                    'patient' => $portalPatient,
                    'consent' => self::buildPortalConsentPayloadFromContext($store, $consentContext),
                    'generatedAt' => local_date('c'),
                ],
            ]);
            return;
        }

        $packet = is_array($consentContext['packet'] ?? null) ? $consentContext['packet'] : [];
        $packetId = trim((string) ($packet['packetId'] ?? ''));
        if ($packetId === '') {
            PatientPortalController::emit([
                'ok' => false,
                'statusCode' => 409,
                'error' => 'El consentimiento activo no está listo para firma digital.',
                'code' => 'patient_portal_consent_unavailable',
            ]);
            return;
        }

        $requestedPacketId = trim((string) ($payload['packetId'] ?? ''));
        if ($requestedPacketId !== '' && !hash_equals($packetId, $requestedPacketId)) {
            PatientPortalController::emit([
                'ok' => false,
                'statusCode' => 409,
                'error' => 'El formulario cambió. Recarga la página para firmar la versión vigente.',
                'code' => 'patient_portal_consent_stale',
            ]);
            return;
        }

        $patientName = trim((string) ($payload['patientName'] ?? ''));
        $patientDocumentNumber = trim((string) ($payload['patientDocumentNumber'] ?? ''));
        $signatureDataUrl = trim((string) ($payload['signatureDataUrl'] ?? ''));
        $accepted = ($payload['accepted'] ?? false) === true;

        if ($patientName === '') {
            PatientPortalController::emit([
                'ok' => false,
                'statusCode' => 400,
                'error' => 'Tu nombre es obligatorio para firmar.',
                'code' => 'patient_portal_consent_name_required',
            ]);
            return;
        }

        if ($patientDocumentNumber === '') {
            PatientPortalController::emit([
                'ok' => false,
                'statusCode' => 400,
                'error' => 'El documento del paciente es obligatorio para firmar.',
                'code' => 'patient_portal_consent_document_required',
            ]);
            return;
        }

        if (!self::isPortalSignatureDataUrl($signatureDataUrl)) {
            PatientPortalController::emit([
                'ok' => false,
                'statusCode' => 400,
                'error' => 'Necesitamos una firma táctil válida para guardar el consentimiento.',
                'code' => 'patient_portal_consent_signature_required',
            ]);
            return;
        }

        if ($accepted !== true) {
            PatientPortalController::emit([
                'ok' => false,
                'statusCode' => 400,
                'error' => 'Debes confirmar que leíste y aceptas el consentimiento.',
                'code' => 'patient_portal_consent_acceptance_required',
            ]);
            return;
        }

        $draft = is_array($consentContext['draft'] ?? null) ? $consentContext['draft'] : [];
        $sessionRecord = is_array($consentContext['session'] ?? null) ? $consentContext['session'] : [];
        $sessionId = trim((string) ($sessionRecord['sessionId'] ?? ''));
        if ($sessionId === '') {
            PatientPortalController::emit([
                'ok' => false,
                'statusCode' => 409,
                'error' => 'No pudimos enlazar este consentimiento con tu historia clínica activa.',
                'code' => 'patient_portal_consent_session_missing',
            ]);
            return;
        }

        if (ClinicalHistorySessionRepository::findSessionBySessionId($store, $sessionId) === null) {
            $sessionSave = ClinicalHistorySessionRepository::upsertSession($store, $sessionRecord);
            $store = is_array($sessionSave['store'] ?? null) ? $sessionSave['store'] : $store;
            $sessionRecord = is_array($sessionSave['session'] ?? null) ? $sessionSave['session'] : $sessionRecord;
        }

        $preparedPacket = self::preparePortalConsentPacketForSignature(
            $packet,
            $draft,
            $patientName,
            $patientDocumentNumber,
            $signatureDataUrl
        );

        $mutation = mutate_store(static function(array $store) use ($sessionId, $packetId, $preparedPacket, $signatureDataUrl, $portalPatient) {
            $clinicalHistory = new ClinicalHistoryService();
            $actionResult = $clinicalHistory->episodeAction($store, [
                'action' => 'declare_consent',
                'sessionId' => $sessionId,
                'consentPackets' => [$preparedPacket],
                'activeConsentPacketId' => $packetId,
            ]);

            if (($actionResult['ok'] ?? false) !== true) {
                return ['ok' => false, 'errorPayload' => [
                    'ok' => false,
                    'statusCode' => (int) ($actionResult['statusCode'] ?? 409),
                    'error' => (string) ($actionResult['error'] ?? 'No pudimos guardar el consentimiento firmado.'),
                    'code' => (string) ($actionResult['errorCode'] ?? 'patient_portal_consent_sign_failed'),
                ]];
            }

            $nextStore = is_array($actionResult['store'] ?? null) ? $actionResult['store'] : $store;
            $nextSession = is_array($actionResult['session'] ?? null) ? $actionResult['session'] : [];
            $nextDraft = is_array($actionResult['draft'] ?? null) ? $actionResult['draft'] : [];
            $signedSnapshot = self::findSignedConsentSnapshotForPacket($nextDraft, $packetId);

            if ($signedSnapshot === null) {
                return ['ok' => false, 'errorPayload' => [
                    'ok' => false,
                    'statusCode' => 500,
                    'error' => 'La firma se guardó, pero no pudimos localizar el PDF del consentimiento.',
                    'code' => 'patient_portal_consent_snapshot_missing',
                ]];
            }

            $signedPacket = is_array($signedSnapshot['snapshot'] ?? null) ? $signedSnapshot['snapshot'] : [];
            $snapshotId = trim((string) ($signedPacket['snapshotId'] ?? ''));
            $caseId = trim((string) ($nextDraft['caseId'] ?? ($nextSession['caseId'] ?? '')));
            $resolvedPatient = PatientPortalController::resolveCasePatient($nextStore, $caseId);
            $pdfBytes = self::generateConsentPdfBytes($signedPacket, $resolvedPatient);
            $pdfBase64 = base64_encode($pdfBytes);
            $pdfFileName = self::buildConsentFileName($signedPacket, $snapshotId);
            $pdfGeneratedAt = local_date('c');

            $nextDraft = self::attachPortalConsentPdfArtifacts(
                $nextDraft,
                $packetId,
                $snapshotId,
                $signatureDataUrl,
                $pdfBase64,
                $pdfFileName,
                $pdfGeneratedAt
            );
            $draftSave = ClinicalHistorySessionRepository::upsertDraft($nextStore, $nextDraft);
            $nextStore = is_array($draftSave['store'] ?? null) ? $draftSave['store'] : $nextStore;

            $pId = trim((string) ($portalPatient['id'] ?? ''));
            if ($pId !== '' && isset($nextStore['patients'][$pId])) {
                $nextStore['patients'][$pId]['consent_version'] = defined('LOPD_CONSENT_VERSION') ? LOPD_CONSENT_VERSION : 'v1.0.0';
                $nextStore['patients'][$pId]['consent_signed_at'] = local_date('c');
            }

            return ['ok' => true, 'store' => $nextStore, 'storeDirty' => true];
        });

        if (($mutation['ok'] ?? false) !== true) {
            $err = $mutation['errorPayload'] ?? [
                'ok' => false,
                'statusCode' => 500,
                'error' => 'Error de concurrencia al guardar consentimiento',
                'code' => 'patient_portal_consent_store_mutex_failed',
            ];
            PatientPortalController::emit($err);
            return;
        }

        $nextStore = $mutation['store'] ?? $store;
        $summary = self::buildPortalConsentSummary($nextStore, $snapshot);

        PatientPortalController::emit([
            'ok' => true,
            'data' => [
                'authenticated' => true,
                'patient' => $portalPatient,
                'consent' => $summary,
                'generatedAt' => local_date('c'),
            ],
        ]);
    }


    public static function buildPortalConsentSummary(array $store, array $snapshot): ?array
    {
        $context = self::resolvePortalConsentContext($store, $snapshot);
        if ($context === null) {
            return null;
        }

        return self::buildPortalConsentPayloadFromContext($store, $context);
    }


    public static function resolvePortalConsentContext(array $store, array $snapshot): ?array
    {
        $caseIds = PatientPortalController::collectPatientCaseIds($store, $snapshot);
        $draftContexts = [];

        foreach ($caseIds as $caseId) {
            foreach (ClinicalHistorySessionRepository::findAllDraftsByCaseId($store, (string) $caseId) as $draft) {
                if (!is_array($draft)) {
                    continue;
                }

                $resolvedDraft = ClinicalHistorySessionRepository::syncConsentArtifacts(
                    $draft,
                    self::resolvePortalConsentSession($store, $draft)
                );
                $draftContexts[] = [
                    'draft' => $resolvedDraft,
                    'caseId' => (string) ($resolvedDraft['caseId'] ?? $caseId),
                    'sortTimestamp' => PatientPortalController::recordTimestamp($resolvedDraft),
                ];
            }
        }

        usort($draftContexts, static function (array $left, array $right): int {
            return ((int) ($right['sortTimestamp'] ?? 0)) <=> ((int) ($left['sortTimestamp'] ?? 0));
        });

        $signedFallback = null;
        foreach ($draftContexts as $entry) {
            $draft = is_array($entry['draft'] ?? null) ? $entry['draft'] : [];
            $caseId = trim((string) ($entry['caseId'] ?? ''));
            $session = self::resolvePortalConsentSession($store, $draft);
            $packet = self::findPortalActiveConsentPacket($draft);

            if ($packet !== null) {
                $status = strtolower(trim((string) ($packet['status'] ?? 'draft')));
                if ($status === 'accepted') {
                    $snapshotEntry = self::findSignedConsentSnapshotForPacket($draft, (string) ($packet['packetId'] ?? ''));
                    if ($snapshotEntry !== null) {
                        return [
                            'state' => 'signed',
                            'caseId' => $caseId,
                            'sessionId' => (string) ($session['sessionId'] ?? ''),
                            'session' => $session,
                            'draft' => $draft,
                            'packet' => is_array($snapshotEntry['snapshot'] ?? null)
                                ? $snapshotEntry['snapshot']
                                : $packet,
                        ];
                    }
                }

                if (!in_array($status, ['declined', 'revoked'], true)) {
                    return [
                        'state' => 'pending',
                        'caseId' => $caseId,
                        'sessionId' => (string) ($session['sessionId'] ?? ''),
                        'session' => $session,
                        'draft' => $draft,
                        'packet' => $packet,
                    ];
                }
            }

            $latestSigned = self::findLatestAcceptedConsentSnapshot($draft);
            if ($latestSigned !== null && $signedFallback === null) {
                $signedFallback = [
                    'state' => 'signed',
                    'caseId' => $caseId,
                    'sessionId' => (string) ($session['sessionId'] ?? ''),
                    'session' => $session,
                    'draft' => $draft,
                    'packet' => $latestSigned,
                ];
            }
        }

        return $signedFallback;
    }


    public static function buildPortalConsentPayloadFromContext(array $store, array $context): array
    {
        $packet = is_array($context['packet'] ?? null) ? $context['packet'] : [];
        $state = trim((string) ($context['state'] ?? 'pending'));
        $caseId = trim((string) ($context['caseId'] ?? ''));
        $sessionId = trim((string) ($context['sessionId'] ?? ''));
        $packetId = trim((string) ($packet['packetId'] ?? ''));
        $evaluation = ClinicalHistorySessionRepository::evaluateConsentPacket($packet);
        $portalDocument = is_array($packet['portalDocument'] ?? null) ? $packet['portalDocument'] : [];
        $snapshotId = trim((string) ($packet['snapshotId'] ?? ''));
        $downloadUrl = '';
        if ($snapshotId !== '' && trim((string) ($portalDocument['pdfBase64'] ?? '')) !== '') {
            $downloadUrl = '/api.php?resource=patient-portal-document&type=consent&id=' . rawurlencode($snapshotId);
        }

        $patientName = PatientPortalController::firstNonEmptyString(
            (string) ($packet['patientAttestation']['name'] ?? ''),
            (string) ($packet['patientName'] ?? ''),
            PatientPortalController::buildPatientDisplayName(PatientPortalController::resolveCasePatient($store, $caseId))
        );
        $patientDocumentNumber = PatientPortalController::firstNonEmptyString(
            (string) ($packet['patientAttestation']['documentNumber'] ?? ''),
            (string) ($packet['patientDocumentNumber'] ?? ''),
            (string) (PatientPortalController::resolveCasePatient($store, $caseId)['ci'] ?? '')
        );
        $signedAt = PatientPortalController::firstNonEmptyString(
            (string) ($packet['patientAttestation']['signedAt'] ?? ''),
            (string) ($packet['finalizedAt'] ?? '')
        );

        return [
            'status' => $state === 'signed' ? 'signed' : 'pending',
            'statusLabel' => $state === 'signed' ? 'Firmado y archivado' : 'Pendiente de firma',
            'state' => $state,
            'readyForSignature' => ($evaluation['readyForDeclaration'] ?? false) === true,
            'missingFields' => array_values($evaluation['missingFields'] ?? []),
            'title' => (string) ($packet['title'] ?? 'Consentimiento informado digital'),
            'serviceLabel' => (string) ($packet['serviceLabel'] ?? ''),
            'procedureName' => PatientPortalController::firstNonEmptyString(
                (string) ($packet['procedureName'] ?? ''),
                (string) ($packet['procedureLabel'] ?? '')
            ),
            'diagnosisLabel' => (string) ($packet['diagnosisLabel'] ?? ''),
            'durationEstimate' => (string) ($packet['durationEstimate'] ?? ''),
            'procedureWhatIsIt' => (string) ($packet['procedureWhatIsIt'] ?? ''),
            'procedureHowItIsDone' => (string) ($packet['procedureHowItIsDone'] ?? ''),
            'benefits' => (string) ($packet['benefits'] ?? ''),
            'frequentRisks' => (string) ($packet['frequentRisks'] ?? ''),
            'rareSeriousRisks' => (string) ($packet['rareSeriousRisks'] ?? ''),
            'alternatives' => (string) ($packet['alternatives'] ?? ''),
            'postProcedureCare' => (string) ($packet['postProcedureCare'] ?? ''),
            'packetId' => $packetId,
            'caseId' => $caseId,
            'sessionId' => $sessionId,
            'patientName' => $patientName,
            'patientDocumentNumber' => $patientDocumentNumber,
            'doctorName' => (string) ($packet['professionalAttestation']['name'] ?? ''),
            'signedAt' => $signedAt,
            'signedAtLabel' => PatientPortalController::buildPortalDateTimeLabel($signedAt, ''),
            'snapshotId' => $snapshotId,
            'pdfAvailable' => $downloadUrl !== '',
            'pdfFileName' => (string) ($portalDocument['pdfFileName'] ?? ''),
            'pdfGeneratedAt' => (string) ($portalDocument['pdfGeneratedAt'] ?? ''),
            'downloadUrl' => $downloadUrl,
        ];
    }


    public static function resolvePortalConsentSession(array $store, array $draft): array
    {
        $sessionId = trim((string) ($draft['sessionId'] ?? ''));
        if ($sessionId !== '') {
            $session = ClinicalHistorySessionRepository::findSessionBySessionId($store, $sessionId);
            if (is_array($session)) {
                return $session;
            }
        }

        $caseId = trim((string) ($draft['caseId'] ?? ''));
        $seed = [
            'sessionId' => $sessionId,
            'caseId' => $caseId,
            'appointmentId' => $draft['appointmentId'] ?? null,
            'patient' => PatientPortalController::resolveCasePatient($store, $caseId),
            'surface' => 'patient_portal',
            'status' => 'active',
        ];

        return ClinicalHistorySessionRepository::defaultSession($seed);
    }


    public static function findPortalActiveConsentPacket(array $draft): ?array
    {
        $packets = ClinicalHistorySessionRepository::normalizeConsentPackets($draft['consentPackets'] ?? []);
        if ($packets === []) {
            return null;
        }

        $activePacketId = trim((string) ($draft['activeConsentPacketId'] ?? ''));
        foreach ($packets as $packet) {
            if (trim((string) ($packet['packetId'] ?? '')) === $activePacketId) {
                return $packet;
            }
        }

        return is_array($packets[0] ?? null) ? $packets[0] : null;
    }


    public static function findLatestAcceptedConsentSnapshot(array $draft): ?array
    {
        $documents = ClinicalHistorySessionRepository::normalizeClinicalDocuments(
            is_array($draft['documents'] ?? null) ? $draft['documents'] : []
        );

        foreach (($documents['consentForms'] ?? []) as $snapshot) {
            if (!is_array($snapshot)) {
                continue;
            }

            if (strtolower(trim((string) ($snapshot['status'] ?? ''))) === 'accepted') {
                return $snapshot;
            }
        }

        return null;
    }


    public static function preparePortalConsentPacketForSignature(
        array $packet,
        array $draft,
        string $patientName,
        string $patientDocumentNumber,
        string $signatureDataUrl
    ): array {
        $prepared = ClinicalHistorySessionRepository::normalizeConsentPacket($packet);
        $now = local_date('c');

        $prepared['patientName'] = $patientName;
        $prepared['patientDocumentNumber'] = $patientDocumentNumber;
        $prepared['patientAttestation']['name'] = $patientName;
        $prepared['patientAttestation']['documentNumber'] = $patientDocumentNumber;
        $prepared['patientAttestation']['signatureDataUrl'] = $signatureDataUrl;
        $prepared['patientAttestation']['signatureCapturedAt'] = $now;
        $prepared['declaration']['declaredAt'] = trim((string) ($prepared['declaration']['declaredAt'] ?? '')) !== ''
            ? (string) ($prepared['declaration']['declaredAt'] ?? '')
            : $now;

        if (trim((string) ($prepared['patientRecordId'] ?? '')) === '') {
            $prepared['patientRecordId'] = trim((string) ($draft['patientRecordId'] ?? ''));
        }

        if (trim((string) ($prepared['encounterDateTime'] ?? '')) === '') {
            $prepared['encounterDateTime'] = PatientPortalController::firstNonEmptyString(
                (string) ($draft['updatedAt'] ?? ''),
                (string) ($draft['createdAt'] ?? ''),
                $now
            );
        }

        return $prepared;
    }


    public static function attachPortalConsentPdfArtifacts(
        array $draft,
        string $packetId,
        string $snapshotId,
        string $signatureDataUrl,
        string $pdfBase64,
        string $pdfFileName,
        string $pdfGeneratedAt
    ): array {
        $draft = ClinicalHistorySessionRepository::syncConsentArtifacts($draft);
        $packets = ClinicalHistorySessionRepository::normalizeConsentPackets($draft['consentPackets'] ?? []);

        foreach ($packets as $index => $packet) {
            if (trim((string) ($packet['packetId'] ?? '')) !== $packetId) {
                continue;
            }

            $packets[$index]['patientAttestation']['signatureDataUrl'] = $signatureDataUrl;
            $packets[$index]['portalDocument'] = [
                'pdfBase64' => $pdfBase64,
                'pdfFileName' => $pdfFileName,
                'pdfGeneratedAt' => $pdfGeneratedAt,
            ];
        }

        $documents = ClinicalHistorySessionRepository::normalizeClinicalDocuments(
            is_array($draft['documents'] ?? null) ? $draft['documents'] : []
        );
        $consentForms = is_array($documents['consentForms'] ?? null) ? $documents['consentForms'] : [];
        foreach ($consentForms as $index => $snapshot) {
            if (trim((string) ($snapshot['snapshotId'] ?? '')) !== $snapshotId) {
                continue;
            }

            $consentForms[$index]['patientAttestation']['signatureDataUrl'] = $signatureDataUrl;
            $consentForms[$index]['portalDocument'] = [
                'pdfBase64' => $pdfBase64,
                'pdfFileName' => $pdfFileName,
                'pdfGeneratedAt' => $pdfGeneratedAt,
            ];
        }

        $draft['consentPackets'] = $packets;
        $documents['consentForms'] = $consentForms;
        $draft['documents'] = $documents;

        return ClinicalHistorySessionRepository::syncConsentArtifacts($draft);
    }


    public static function findSignedConsentSnapshotForPacket(array $draft, string $packetId): ?array
    {
        $documents = ClinicalHistorySessionRepository::normalizeClinicalDocuments(
            is_array($draft['documents'] ?? null) ? $draft['documents'] : []
        );

        foreach (($documents['consentForms'] ?? []) as $snapshot) {
            if (!is_array($snapshot)) {
                continue;
            }

            if (
                trim((string) ($snapshot['packetId'] ?? '')) === trim($packetId)
                && strtolower(trim((string) ($snapshot['status'] ?? ''))) === 'accepted'
            ) {
                return [
                    'snapshot' => $snapshot,
                    'caseId' => trim((string) ($draft['caseId'] ?? '')),
                ];
            }
        }

        return null;
    }


    public static function findPortalConsentSnapshotById(array $store, array $caseIds, string $snapshotId): ?array
    {
        $caseMap = [];
        foreach ($caseIds as $caseId) {
            $caseId = trim((string) $caseId);
            if ($caseId !== '') {
                $caseMap[$caseId] = true;
            }
        }

        foreach (($store['clinical_history_drafts'] ?? []) as $draft) {
            if (!is_array($draft)) {
                continue;
            }

            $caseId = trim((string) ($draft['caseId'] ?? ''));
            if ($caseId === '' || !isset($caseMap[$caseId])) {
                continue;
            }

            $documents = ClinicalHistorySessionRepository::normalizeClinicalDocuments(
                is_array($draft['documents'] ?? null) ? $draft['documents'] : []
            );
            foreach (($documents['consentForms'] ?? []) as $snapshot) {
                if (trim((string) ($snapshot['snapshotId'] ?? '')) !== trim($snapshotId)) {
                    continue;
                }

                return [
                    'caseId' => $caseId,
                    'snapshot' => $snapshot,
                ];
            }
        }

        return null;
    }


    public static function isPortalSignatureDataUrl(string $signatureDataUrl): bool
    {
        if ($signatureDataUrl === '') {
            return false;
        }

        if (preg_match('/^data:image\/png;base64,([A-Za-z0-9+\/=]+)$/', $signatureDataUrl, $matches) !== 1) {
            return false;
        }

        $binary = base64_decode((string) ($matches[1] ?? ''), true);
        return is_string($binary) && $binary !== '';
    }


    public static function buildConsentFileName(array $consentSnapshot, string $documentId): string
    {
        $suffix = PatientPortalController::firstNonEmptyString(
            (string) ($consentSnapshot['procedureName'] ?? ''),
            (string) ($consentSnapshot['packetId'] ?? ''),
            (string) ($consentSnapshot['snapshotId'] ?? ''),
            $documentId
        );
        $suffix = preg_replace('/[^a-zA-Z0-9_-]/', '-', strtolower($suffix));
        return 'consentimiento-' . ($suffix !== '' ? $suffix : 'portal') . '.pdf';
    }


    public static function generateConsentPdfBytes(array $consentSnapshot, array $patient): string
    {
        $html = self::buildConsentHtml($consentSnapshot, $patient);

        $autoloadPath = __DIR__ . '/../vendor/autoload.php';
        if (file_exists($autoloadPath)) {
            require_once $autoloadPath;
        }

        $dompdfPath = __DIR__ . '/../vendor/dompdf/dompdf/src/Dompdf.php';
        if (file_exists($dompdfPath)) {
            require_once $dompdfPath;
        }

        if (class_exists(\Dompdf\Dompdf::class)) {
            try {
                $dompdf = new \Dompdf\Dompdf([
                    'isHtml5ParserEnabled' => true,
                    'isRemoteEnabled' => true,
                ]);
                $dompdf->loadHtml($html, 'UTF-8');
                $dompdf->setPaper('A4', 'portrait');
                $dompdf->render();
                return $dompdf->output();
            } catch (\Throwable $error) {
                // Ignore dompdf errors and use the text fallback below.
            }
        }

        return PatientPortalController::buildFallbackPdf($html);
    }


    public static function buildConsentHtml(array $consentSnapshot, array $patient): string
    {
        $clinicProfile = read_clinic_profile();
        $patientName = PatientPortalController::escapeHtml(PatientPortalController::firstNonEmptyString(
            (string) ($consentSnapshot['patientAttestation']['name'] ?? ''),
            (string) ($consentSnapshot['patientName'] ?? ''),
            PatientPortalController::buildPatientDisplayName($patient)
        ));
        $patientDocument = PatientPortalController::escapeHtml(PatientPortalController::firstNonEmptyString(
            (string) ($consentSnapshot['patientAttestation']['documentNumber'] ?? ''),
            (string) ($consentSnapshot['patientDocumentNumber'] ?? ''),
            (string) ($patient['ci'] ?? '')
        ));
        $procedureName = PatientPortalController::escapeHtml(PatientPortalController::firstNonEmptyString(
            (string) ($consentSnapshot['procedureName'] ?? ''),
            (string) ($consentSnapshot['procedureLabel'] ?? ''),
            'Procedimiento dermatológico'
        ));
        $diagnosis = PatientPortalController::escapeHtml((string) ($consentSnapshot['diagnosisLabel'] ?? ''));
        $serviceLabel = PatientPortalController::escapeHtml((string) ($consentSnapshot['serviceLabel'] ?? ''));
        $establishmentLabel = PatientPortalController::escapeHtml(PatientPortalController::firstNonEmptyString(
            (string) ($consentSnapshot['establishmentLabel'] ?? ''),
            (string) ($clinicProfile['clinicName'] ?? ''),
            'Aurora Derm'
        ));
        $encounterDateLabel = PatientPortalController::escapeHtml(PatientPortalController::buildPortalDateTimeLabel(
            (string) ($consentSnapshot['encounterDateTime'] ?? ''),
            'Fecha por confirmar'
        ));
        $durationEstimate = PatientPortalController::escapeHtml((string) ($consentSnapshot['durationEstimate'] ?? ''));
        $whatIsIt = PatientPortalController::escapeHtml((string) ($consentSnapshot['procedureWhatIsIt'] ?? ''));
        $howItIsDone = PatientPortalController::escapeHtml((string) ($consentSnapshot['procedureHowItIsDone'] ?? ''));
        $benefits = PatientPortalController::escapeHtml((string) ($consentSnapshot['benefits'] ?? ''));
        $frequentRisks = PatientPortalController::escapeHtml((string) ($consentSnapshot['frequentRisks'] ?? ''));
        $rareSeriousRisks = PatientPortalController::escapeHtml((string) ($consentSnapshot['rareSeriousRisks'] ?? ''));
        $alternatives = PatientPortalController::escapeHtml((string) ($consentSnapshot['alternatives'] ?? ''));
        $aftercare = PatientPortalController::escapeHtml((string) ($consentSnapshot['postProcedureCare'] ?? ''));
        $doctorName = PatientPortalController::escapeHtml(PatientPortalController::firstNonEmptyString(
            (string) ($consentSnapshot['professionalAttestation']['name'] ?? ''),
            'Equipo clínico Aurora Derm'
        ));
        $doctorRole = PatientPortalController::escapeHtml(PatientPortalController::humanizeValue(
            (string) ($consentSnapshot['professionalAttestation']['role'] ?? 'medico_tratante'),
            'Médico tratante'
        ));
        $signedAtLabel = PatientPortalController::escapeHtml(PatientPortalController::buildPortalDateTimeLabel(
            (string) ($consentSnapshot['patientAttestation']['signedAt'] ?? ''),
            'Firma digital archivada'
        ));
        $signatureDataUrl = PatientPortalController::escapeHtml((string) ($consentSnapshot['patientAttestation']['signatureDataUrl'] ?? ''));
        $signatureHtml = $signatureDataUrl !== ''
            ? '<img src="' . $signatureDataUrl . '" alt="Firma del paciente" style="max-width:220px; max-height:90px; display:block; margin-bottom:12px; object-fit:contain;">'
            : '';

        return '
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="utf-8">
            <title>Consentimiento informado</title>
            <style>
                body { font-family: Helvetica, Arial, sans-serif; margin: 0; padding: 40px; color: #111827; }
                .header { border-bottom: 2px solid #248a65; padding-bottom: 16px; margin-bottom: 24px; }
                .header h1 { margin: 0 0 6px; font-size: 24px; }
                .header p { margin: 0; color: #475569; font-size: 13px; }
                .hero { margin-bottom: 18px; }
                .hero span { display: inline-block; padding: 6px 12px; border-radius: 999px; background: #ecfdf5; color: #166534; font-size: 12px; font-weight: bold; letter-spacing: 0.03em; text-transform: uppercase; }
                .meta, .section { border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px; margin-bottom: 16px; background: #f8fafc; }
                .meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
                .meta-grid div strong, .section strong { display: block; margin-bottom: 6px; font-size: 12px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; }
                .section p { margin: 0; line-height: 1.65; }
                .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; align-items: end; }
                .signature-box { border: 1px solid #cbd5e1; border-radius: 16px; padding: 16px; min-height: 140px; background: #fff; }
                .signature-line { border-top: 1px solid #0f172a; margin-top: 12px; padding-top: 8px; }
                .footer { margin-top: 20px; padding-top: 14px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>' . $establishmentLabel . '</h1>
                <p>Consentimiento informado digital archivado desde el portal del paciente.</p>
            </div>
            <div class="hero">
                <span>Consentimiento firmado</span>
            </div>
            <div class="meta">
                <div class="meta-grid">
                    <div>
                        <strong>Paciente</strong>
                        <span>' . $patientName . '</span>
                    </div>
                    <div>
                        <strong>Documento</strong>
                        <span>' . $patientDocument . '</span>
                    </div>
                    <div>
                        <strong>Servicio</strong>
                        <span>' . $serviceLabel . '</span>
                    </div>
                    <div>
                        <strong>Procedimiento</strong>
                        <span>' . $procedureName . '</span>
                    </div>
                    <div>
                        <strong>Diagnóstico</strong>
                        <span>' . $diagnosis . '</span>
                    </div>
                    <div>
                        <strong>Fecha de firma</strong>
                        <span>' . $signedAtLabel . '</span>
                    </div>
                    <div>
                        <strong>Duración estimada</strong>
                        <span>' . $durationEstimate . '</span>
                    </div>
                    <div>
                        <strong>Encuentro clínico</strong>
                        <span>' . $encounterDateLabel . '</span>
                    </div>
                </div>
            </div>
            <div class="section">
                <strong>¿Qué es?</strong>
                <p>' . $whatIsIt . '</p>
            </div>
            <div class="section">
                <strong>¿Cómo se realiza?</strong>
                <p>' . $howItIsDone . '</p>
            </div>
            <div class="section">
                <strong>Beneficios esperados</strong>
                <p>' . $benefits . '</p>
            </div>
            <div class="section">
                <strong>Riesgos frecuentes y poco frecuentes</strong>
                <p>' . $frequentRisks . '</p>
                ' . ($rareSeriousRisks !== '' ? '<p style="margin-top:10px;"><b>Riesgos poco frecuentes:</b> ' . $rareSeriousRisks . '</p>' : '') . '
            </div>
            <div class="section">
                <strong>Alternativas y cuidados posteriores</strong>
                <p>' . $alternatives . '</p>
                ' . ($aftercare !== '' ? '<p style="margin-top:10px;"><b>Cuidados posteriores:</b> ' . $aftercare . '</p>' : '') . '
            </div>
            <div class="signature-grid">
                <div class="signature-box">
                    <strong>Firma del paciente</strong>
                    ' . $signatureHtml . '
                    <div class="signature-line">' . $patientName . '</div>
                </div>
                <div class="signature-box">
                    <strong>Validación clínica</strong>
                    <div class="signature-line">' . $doctorName . '<br>' . $doctorRole . '</div>
                </div>
            </div>
            <div class="footer">Documento PDF archivado automáticamente dentro de la historia clínica Aurora Derm.</div>
        </body>
        </html>';
    }

}
