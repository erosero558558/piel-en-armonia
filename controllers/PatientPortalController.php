<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/PatientPortalAuth.php';
require_once __DIR__ . '/../lib/business.php';
require_once __DIR__ . '/../lib/ClinicProfileStore.php';
require_once __DIR__ . '/../lib/DocumentVerificationService.php';
require_once __DIR__ . '/../lib/api_helpers.php';
require_once __DIR__ . '/../lib/openclaw/PrescriptionPdfRenderer.php';
require_once __DIR__ . '/../lib/clinical_history/ClinicalHistoryService.php';
require_once __DIR__ . '/../lib/clinical_history/ClinicalHistorySessionRepository.php';
require_once __DIR__ . '/../payment-lib.php';

final class PatientPortalController
{
    public static function start(array $context): void
    {
        $payload = require_json_body();
        $phone = trim((string) ($payload['phone'] ?? ($payload['whatsapp'] ?? '')));

        $result = PatientPortalAuth::startLogin(
            is_array($context['store'] ?? null) ? $context['store'] : [],
            $phone
        );

        self::emit($result);
    }

    public static function complete(array $context): void
    {
        $payload = require_json_body();
        $phone = trim((string) ($payload['phone'] ?? ($payload['whatsapp'] ?? '')));
        $code = trim((string) ($payload['code'] ?? ($payload['otp'] ?? '')));
        $challengeId = trim((string) ($payload['challengeId'] ?? ''));

        $result = PatientPortalAuth::completeLogin(
            is_array($context['store'] ?? null) ? $context['store'] : [],
            $phone,
            $code,
            $challengeId
        );

        self::emit($result);
    }

    public static function status(array $context): void
    {
        $result = PatientPortalAuth::readStatus(
            is_array($context['store'] ?? null) ? $context['store'] : [],
            PatientPortalAuth::bearerTokenFromRequest()
        );

        self::emit($result);
    }

    public static function dashboard(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $session = PatientPortalAuth::authenticateSession(
            $store,
            PatientPortalAuth::bearerTokenFromRequest()
        );

        if (($session['ok'] ?? false) !== true) {
            self::emit($session);
            return;
        }

        $sessionData = is_array($session['data'] ?? null) ? $session['data'] : [];
        $snapshot = is_array($sessionData['snapshot'] ?? null) ? $sessionData['snapshot'] : [];
        $patient = is_array($sessionData['patient'] ?? null) ? $sessionData['patient'] : [];
        $nextAppointment = self::findNextAppointment($store, $snapshot);

        self::emit([
            'ok' => true,
            'data' => [
                'authenticated' => true,
                'patient' => $patient,
                'nextAppointment' => $nextAppointment === []
                    ? null
                    : self::buildAppointmentSummary($nextAppointment, $patient),
                'treatmentPlan' => self::buildTreatmentPlanSummary($store, $snapshot, $patient, $nextAppointment),
                'billing' => self::buildBillingSummary($store, $snapshot),
                'evolution' => self::buildEvolutionSummary($store, $snapshot),
                'alerts' => self::buildPatientRedFlags($store, $snapshot),
                'pendingSurvey' => self::findPendingSurvey($store, $snapshot, $patient),
                'support' => [
                    'bookingUrl' => '/#citas',
                    'historyUrl' => '/es/portal/historial/',
                    'planUrl' => '/es/portal/plan/',
                    'prescriptionUrl' => '/es/portal/receta/',
                    'photosUrl' => '/es/portal/fotos/',
                    'whatsappUrl' => self::buildSupportWhatsappUrl($patient, $nextAppointment),
                ],
                'generatedAt' => local_date('c'),
            ],
        ]);
    }

    public static function submitSurvey(array $context): void
    {
        $payload = require_json_body();
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $session = PatientPortalAuth::authenticateSession(
            $store,
            PatientPortalAuth::bearerTokenFromRequest()
        );

        if (($session['ok'] ?? false) !== true) {
            self::emit($session);
            return;
        }

        $sessionData = is_array($session['data'] ?? null) ? $session['data'] : [];
        $patient = is_array($sessionData['patient'] ?? null) ? $sessionData['patient'] : [];
        $patientId = trim((string) ($patient['documentNumber'] ?? ''));

        $appointmentId = (int) ($payload['appointmentId'] ?? 0);
        $rating = (int) ($payload['rating'] ?? 0);
        $text = trim((string) ($payload['text'] ?? ''));

        if ($appointmentId <= 0 || $rating < 1 || $rating > 5) {
            self::emit(['ok' => false, 'error' => 'Datos de encuesta inválidos']);
            return;
        }

        $snapshot = is_array($sessionData['snapshot'] ?? null) ? $sessionData['snapshot'] : [];
        $appointments = is_array($snapshot['appointments'] ?? null) ? $snapshot['appointments'] : [];
        $validAppointment = null;

        foreach ($appointments as $apt) {
            if (isset($apt['id']) && (int) $apt['id'] === $appointmentId) {
                $validAppointment = $apt;
                break;
            }
        }

        if (!$validAppointment || trim((string) ($validAppointment['patientId'] ?? '')) !== $patientId) {
            self::emit(['ok' => false, 'error' => 'Cita no encontrada o no autorizada']);
            return;
        }

        $surveys = is_array($store['nps_surveys'] ?? null) ? $store['nps_surveys'] : [];
        foreach ($surveys as $survey) {
            if (isset($survey['appointmentId']) && (int) $survey['appointmentId'] === $appointmentId) {
                self::emit(['ok' => false, 'error' => 'Esta cita ya fue evaluada']);
                return;
            }
        }

        $store['nps_surveys'][] = normalize_nps_survey([
            'appointmentId' => $appointmentId,
            'patientId' => $patientId,
            'doctor' => $validAppointment['doctor'] ?? '',
            'rating' => $rating,
            'text' => $text,
            'name' => $patient['fullName'] ?? 'Anónimo',
        ]);

        if (write_store($store, false)) {
            self::emit(['ok' => true]);
        } else {
            self::emit(['ok' => false, 'error' => 'No se pudo guardar la encuesta']);
        }
    }

    public static function history(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $session = PatientPortalAuth::authenticateSession(
            $store,
            PatientPortalAuth::bearerTokenFromRequest()
        );

        if (($session['ok'] ?? false) !== true) {
            self::emit($session);
            return;
        }

        $sessionData = is_array($session['data'] ?? null) ? $session['data'] : [];
        $snapshot = is_array($sessionData['snapshot'] ?? null) ? $sessionData['snapshot'] : [];
        $patient = is_array($sessionData['patient'] ?? null) ? $sessionData['patient'] : [];
        $consultations = self::buildPortalHistory($store, $snapshot, $patient);

        self::emit([
            'ok' => true,
            'data' => [
                'authenticated' => true,
                'patient' => $patient,
                'consultations' => $consultations,
                'export' => self::buildHistoryExportSummary($snapshot, $patient, $consultations),
                'generatedAt' => local_date('c'),
            ],
        ]);
    }

    public static function historyPdf(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $session = PatientPortalAuth::authenticateSession(
            $store,
            PatientPortalAuth::bearerTokenFromRequest()
        );

        if (($session['ok'] ?? false) !== true) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }

        $sessionData = is_array($session['data'] ?? null) ? $session['data'] : [];
        $snapshot = is_array($sessionData['snapshot'] ?? null) ? $sessionData['snapshot'] : [];
        $patient = is_array($sessionData['patient'] ?? null) ? $sessionData['patient'] : [];

        $consultations = self::buildPortalHistory($store, $snapshot, $patient);
        
        $patientName = htmlspecialchars($patient['fullName'] ?? 'Paciente', ENT_QUOTES, 'UTF-8');
        $patientDocument = htmlspecialchars($patient['documentNumber'] ?? '', ENT_QUOTES, 'UTF-8');
        $dateStr = local_date('d/m/Y');

        $clinicProfile = read_clinic_profile();
        $clinicName = htmlspecialchars($clinicProfile['clinicName'] ?: 'Aurora Derm');
        $clinicAddress = htmlspecialchars($clinicProfile['address'] ?: 'Quito, Ecuador');
        $clinicPhone = htmlspecialchars($clinicProfile['phone'] ?: '');
        $clinicLogoHtml = $clinicProfile['logoImage'] !== '' 
            ? '<img src="' . htmlspecialchars($clinicProfile['logoImage'], ENT_QUOTES, 'UTF-8') . '" style="max-height: 50px; display:inline-block; margin-right:10px; vertical-align:middle;" />' 
            : '';

        $historyHtml = '';
        if (count($consultations) === 0) {
            $historyHtml = '<p>No hay consultas registradas en este portal.</p>';
        } else {
            foreach ($consultations as $c) {
                $fecha = htmlspecialchars($c['dateLabel'] ?? '', ENT_QUOTES, 'UTF-8');
                $medico = htmlspecialchars($c['doctorName'] ?? '', ENT_QUOTES, 'UTF-8');
                $diagnostico = htmlspecialchars($c['diagnosis'] ?? 'No especificado', ENT_QUOTES, 'UTF-8');
                $plan = htmlspecialchars($c['treatmentPlan'] ?? 'No especificado', ENT_QUOTES, 'UTF-8');
                
                $historyHtml .= "
                <div class=\"section\">
                    <h3>Consulta: {$fecha}</h3>
                    <div style=\"margin-bottom: 8px; font-size: 13px; color: #555;\"><strong>Médico Tratante:</strong> {$medico}</div>
                    <div style=\"margin-bottom: 8px;\"><strong>Diagnóstico:</strong><br> {$diagnostico}</div>
                    <div style=\"margin-bottom: 8px;\"><strong>Plan/Tratamiento:</strong><br> {$plan}</div>
                </div>";
            }
        }

        $html = "
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset=\"utf-8\">
            <title>Historia Clínica Digital</title>
            <style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 40px; color: #111; }
                .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #c9a96e; padding-bottom: 20px; }
                .header-wrapper { display: inline-flex; align-items: center; justify-content: center; }
                .header h1 { margin: 0; font-size: 24px; color: #07090c; font-weight: bold; display: inline-block; vertical-align: middle; }
                .header p { margin: 5px 0 0 0; font-size: 14px; color: #666; }
                .title { font-size: 20px; font-weight: bold; text-align: center; margin-bottom: 30px; }
                .patient-info { margin-bottom: 30px; padding: 15px; background: #f9f9f9; border-radius: 4px; font-size: 14px; }
                .patient-info strong { display: inline-block; width: 100px; }
                .section { margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px dotted #ccc; }
                .section h3 { margin: 0 0 10px 0; font-size: 16px; color: #c9a96e; }
                .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
            </style>
        </head>
        <body>
            <div class=\"header\">
                <div class=\"header-wrapper\">
                    {$clinicLogoHtml}
                    <h1>{$clinicName}</h1>
                </div>
                <p>Clínica Especializada</p>
                <p>{$clinicAddress} | Telf: {$clinicPhone}</p>
            </div>
            
            <div class=\"title\">HISTORIA CLÍNICA - REPORTE DIGITAL</div>

            <div class=\"patient-info\">
                <div style=\"margin-bottom: 8px;\"><strong>Paciente:</strong> {$patientName}</div>
                <div style=\"margin-bottom: 8px;\"><strong>Documento:</strong> {$patientDocument}</div>
                <div><strong>Fecha de emisión:</strong> {$dateStr}</div>
            </div>

            {$historyHtml}

            <div class=\"footer\">
                Documento generado electrónicamente a través de Flow OS Patient Portal.<br>
                Este documento es una vista simplificada de sus atenciones como paciente.
            </div>
        </body>
        </html>
        ";

        $pdfPath = __DIR__ . '/../vendor/dompdf/dompdf/src/Dompdf.php';
        if (file_exists($pdfPath)) {
            require_once $pdfPath;
            libxml_use_internal_errors(true);
            $dompdf = new \Dompdf\Dompdf(['isHtml5ParserEnabled' => true, 'isRemoteEnabled' => true]);
            $dompdf->loadHtml($html, 'UTF-8');
            $dompdf->setPaper('A4', 'portrait');
            $dompdf->render();
            $pdfBytes = $dompdf->output();
        } else {
            $text = strip_tags(str_replace(['<br>', '</div>', '</p>', '</h1>', '</h3>', '</li>'], "\n", $html));
            $text = mb_convert_encoding(trim($text), 'ISO-8859-1', 'UTF-8');
            
            $lines = [];
            $lines[] = '%PDF-1.4';
            $lines[] = '1 0 obj<< /Type /Catalog /Pages 2 0 R >> endobj';
            $lines[] = '2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >> endobj';
            $lines[] = '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj';
            
            $content = "BT\n/F1 12 Tf\n20 800 Td\n15 TL\n";
            foreach (explode("\n", $text) as $rawLine) {
                $cl = trim($rawLine);
                if ($cl === '') {
                    $content .= "T*\n";
                    continue;
                }
                $clean = strtr($cl, ['(' => '\(', ')' => '\)', '\\' => '\\\\']);
                $content .= "({$clean}) Tj T*\n";
            }
            $content .= "ET";
            
            $len = strlen($content);
            $lines[] = "4 0 obj<< /Length {$len} >>\nstream\n{$content}\nendstream\nendobj";
            $lines[] = '5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj';
            
            $pdf = implode("\n", $lines);
            $pdf .= "\nxref\n0 6\n0000000000 65535 f \n";
            $pdf .= "trailer<</Size 6/Root 1 0 R>>\nstartxref\n9\n%%EOF";
            $pdfBytes = $pdf;
        }

        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="historia-clinica-' . preg_replace('/[^a-zA-Z0-9]/', '', $patientName) . '.pdf"');
        echo $pdfBytes;
        exit;
    }

    public static function plan(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $session = PatientPortalAuth::authenticateSession(
            $store,
            PatientPortalAuth::bearerTokenFromRequest()
        );

        if (($session['ok'] ?? false) !== true) {
            self::emit($session);
            return;
        }

        $sessionData = is_array($session['data'] ?? null) ? $session['data'] : [];
        $snapshot = is_array($sessionData['snapshot'] ?? null) ? $sessionData['snapshot'] : [];
        $patient = is_array($sessionData['patient'] ?? null) ? $sessionData['patient'] : [];
        $nextAppointment = self::findNextAppointment($store, $snapshot);

        self::emit([
            'ok' => true,
            'data' => [
                'authenticated' => true,
                'patient' => $patient,
                'treatmentPlan' => self::buildTreatmentPlanDetail($store, $snapshot, $patient, $nextAppointment),
                'generatedAt' => local_date('c'),
            ],
        ]);
    }

    public static function photos(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $session = PatientPortalAuth::authenticateSession(
            $store,
            PatientPortalAuth::bearerTokenFromRequest()
        );

        if (($session['ok'] ?? false) !== true) {
            self::emit($session);
            return;
        }

        $sessionData = is_array($session['data'] ?? null) ? $session['data'] : [];
        $snapshot = is_array($sessionData['snapshot'] ?? null) ? $sessionData['snapshot'] : [];
        $patient = is_array($sessionData['patient'] ?? null) ? $sessionData['patient'] : [];

        self::emit([
            'ok' => true,
            'data' => [
                'authenticated' => true,
                'patient' => $patient,
                'gallery' => self::buildPortalPhotoGallery($store, $snapshot),
                'generatedAt' => local_date('c'),
            ],
        ]);
    }

    public static function prescription(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $session = PatientPortalAuth::authenticateSession(
            $store,
            PatientPortalAuth::bearerTokenFromRequest()
        );

        if (($session['ok'] ?? false) !== true) {
            self::emit($session);
            return;
        }

        $sessionData = is_array($session['data'] ?? null) ? $session['data'] : [];
        $snapshot = is_array($sessionData['snapshot'] ?? null) ? $sessionData['snapshot'] : [];
        $patient = is_array($sessionData['patient'] ?? null) ? $sessionData['patient'] : [];

        self::emit([
            'ok' => true,
            'data' => [
                'authenticated' => true,
                'patient' => $patient,
                'prescription' => self::buildActivePrescriptionSummary($store, $snapshot),
                'generatedAt' => local_date('c'),
            ],
        ]);
    }

    public static function consent(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $session = PatientPortalAuth::authenticateSession(
            $store,
            PatientPortalAuth::bearerTokenFromRequest()
        );

        if (($session['ok'] ?? false) !== true) {
            self::emit($session);
            return;
        }

        $sessionData = is_array($session['data'] ?? null) ? $session['data'] : [];
        $snapshot = is_array($sessionData['snapshot'] ?? null) ? $sessionData['snapshot'] : [];
        $patient = is_array($sessionData['patient'] ?? null) ? $sessionData['patient'] : [];

        self::emit([
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
            self::emit($session);
            return;
        }

        $payload = require_json_body();
        $sessionData = is_array($session['data'] ?? null) ? $session['data'] : [];
        $snapshot = is_array($sessionData['snapshot'] ?? null) ? $sessionData['snapshot'] : [];
        $portalPatient = is_array($sessionData['patient'] ?? null) ? $sessionData['patient'] : [];

        $consentContext = self::resolvePortalConsentContext($store, $snapshot);
        if ($consentContext === null) {
            self::emit([
                'ok' => false,
                'statusCode' => 404,
                'error' => 'No tienes un consentimiento activo para firmar.',
                'code' => 'patient_portal_consent_not_found',
            ]);
            return;
        }

        $state = (string) ($consentContext['state'] ?? '');
        if ($state === 'signed') {
            self::emit([
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
            self::emit([
                'ok' => false,
                'statusCode' => 409,
                'error' => 'El consentimiento activo no está listo para firma digital.',
                'code' => 'patient_portal_consent_unavailable',
            ]);
            return;
        }

        $requestedPacketId = trim((string) ($payload['packetId'] ?? ''));
        if ($requestedPacketId !== '' && !hash_equals($packetId, $requestedPacketId)) {
            self::emit([
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
            self::emit([
                'ok' => false,
                'statusCode' => 400,
                'error' => 'Tu nombre es obligatorio para firmar.',
                'code' => 'patient_portal_consent_name_required',
            ]);
            return;
        }

        if ($patientDocumentNumber === '') {
            self::emit([
                'ok' => false,
                'statusCode' => 400,
                'error' => 'El documento del paciente es obligatorio para firmar.',
                'code' => 'patient_portal_consent_document_required',
            ]);
            return;
        }

        if (!self::isPortalSignatureDataUrl($signatureDataUrl)) {
            self::emit([
                'ok' => false,
                'statusCode' => 400,
                'error' => 'Necesitamos una firma táctil válida para guardar el consentimiento.',
                'code' => 'patient_portal_consent_signature_required',
            ]);
            return;
        }

        if ($accepted !== true) {
            self::emit([
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
            self::emit([
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

        $clinicalHistory = new ClinicalHistoryService();
        $actionResult = $clinicalHistory->episodeAction($store, [
            'action' => 'declare_consent',
            'sessionId' => $sessionId,
            'consentPackets' => [$preparedPacket],
            'activeConsentPacketId' => $packetId,
        ]);

        if (($actionResult['ok'] ?? false) !== true) {
            self::emit([
                'ok' => false,
                'statusCode' => (int) ($actionResult['statusCode'] ?? 409),
                'error' => (string) ($actionResult['error'] ?? 'No pudimos guardar el consentimiento firmado.'),
                'code' => (string) ($actionResult['errorCode'] ?? 'patient_portal_consent_sign_failed'),
            ]);
            return;
        }

        $nextStore = is_array($actionResult['store'] ?? null) ? $actionResult['store'] : $store;
        $nextSession = is_array($actionResult['session'] ?? null) ? $actionResult['session'] : $sessionRecord;
        $nextDraft = is_array($actionResult['draft'] ?? null) ? $actionResult['draft'] : $draft;
        $signedSnapshot = self::findSignedConsentSnapshotForPacket($nextDraft, $packetId);

        if ($signedSnapshot === null) {
            self::emit([
                'ok' => false,
                'statusCode' => 500,
                'error' => 'La firma se guardó, pero no pudimos localizar el PDF del consentimiento.',
                'code' => 'patient_portal_consent_snapshot_missing',
            ]);
            return;
        }

        $signedPacket = is_array($signedSnapshot['snapshot'] ?? null) ? $signedSnapshot['snapshot'] : [];
        $snapshotId = trim((string) ($signedPacket['snapshotId'] ?? ''));
        $caseId = trim((string) ($nextDraft['caseId'] ?? ($nextSession['caseId'] ?? '')));
        $resolvedPatient = self::resolveCasePatient($nextStore, $caseId);
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

        if (!write_store($nextStore, false)) {
            self::emit([
                'ok' => false,
                'statusCode' => 500,
                'error' => 'No pudimos guardar el consentimiento firmado en este momento.',
                'code' => 'patient_portal_consent_store_failed',
            ]);
            return;
        }

        $summary = self::buildPortalConsentSummary($nextStore, $snapshot);

        self::emit([
            'ok' => true,
            'data' => [
                'authenticated' => true,
                'patient' => $portalPatient,
                'consent' => $summary,
                'generatedAt' => local_date('c'),
            ],
        ]);
    }

    public static function document(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $session = PatientPortalAuth::authenticateSession(
            $store,
            PatientPortalAuth::bearerTokenFromRequest()
        );

        if (($session['ok'] ?? false) !== true) {
            self::emit($session);
            return;
        }

        $type = strtolower(trim((string) ($_GET['type'] ?? '')));
        $documentId = trim((string) ($_GET['id'] ?? ''));
        if ($type === '' || $documentId === '') {
            json_response(['ok' => false, 'error' => 'type e id son requeridos'], 400);
        }

        $sessionData = is_array($session['data'] ?? null) ? $session['data'] : [];
        $snapshot = is_array($sessionData['snapshot'] ?? null) ? $sessionData['snapshot'] : [];
        $portalPatient = is_array($sessionData['patient'] ?? null) ? $sessionData['patient'] : [];
        $caseIds = self::collectPatientCaseIds($store, $snapshot);

        if ($type === 'history') {
            $expectedDocumentId = self::buildHistoryExportId($snapshot, $portalPatient);
            if ($expectedDocumentId === '' || $documentId !== $expectedDocumentId) {
                json_response(['ok' => false, 'error' => 'Documento no disponible para esta sesión'], 404);
            }

            $pdfBytes = self::generateHistoryExportPdfBytes($store, $snapshot, $portalPatient);
            self::emitPdfResponse($pdfBytes, self::buildHistoryExportFileName($portalPatient, $snapshot));
            return;
        }

        if ($type === 'prescription') {
            $prescription = self::findPrescriptionById($store, $documentId);
            $caseId = trim((string) ($prescription['caseId'] ?? ''));

            if (!is_array($prescription) || !self::caseBelongsToPortalPatient($caseId, $caseIds, $snapshot)) {
                json_response(['ok' => false, 'error' => 'Documento no disponible para esta sesión'], 404);
            }

            $patient = self::resolveCasePatient($store, $caseId);
            $pdfBytes = PrescriptionPdfRenderer::generatePdfBytes(
                $prescription,
                $patient,
                read_clinic_profile()
            );

            self::emitPdfResponse($pdfBytes, self::buildPrescriptionFileName($documentId));
            return;
        }

        if ($type === 'certificate') {
            $certificate = self::findCertificateById($store, $documentId);
            $caseId = trim((string) ($certificate['caseId'] ?? ''));

            if (!is_array($certificate) || !self::caseBelongsToPortalPatient($caseId, $caseIds, $snapshot)) {
                json_response(['ok' => false, 'error' => 'Documento no disponible para esta sesión'], 404);
            }

            $patient = self::resolveCasePatient($store, $caseId);
            $pdfBytes = self::generateCertificatePdfBytes($certificate, $patient);

            self::emitPdfResponse($pdfBytes, self::buildCertificateFileName($certificate, $documentId));
            return;
        }

        if ($type === 'consent') {
            $consentSnapshot = self::findPortalConsentSnapshotById($store, $caseIds, $documentId);
            $caseId = trim((string) ($consentSnapshot['caseId'] ?? ''));
            $snapshot = is_array($consentSnapshot['snapshot'] ?? null) ? $consentSnapshot['snapshot'] : [];

            if ($snapshot === [] || !self::caseBelongsToPortalPatient($caseId, $caseIds, [])) {
                json_response(['ok' => false, 'error' => 'Documento no disponible para esta sesión'], 404);
            }

            $portalDocument = is_array($snapshot['portalDocument'] ?? null) ? $snapshot['portalDocument'] : [];
            $pdfBase64 = trim((string) ($portalDocument['pdfBase64'] ?? ''));
            $pdfBytes = $pdfBase64 !== '' ? (string) base64_decode($pdfBase64, true) : '';
            if ($pdfBytes === '') {
                $patient = self::resolveCasePatient($store, $caseId);
                $pdfBytes = self::generateConsentPdfBytes($snapshot, $patient);
            }

            self::emitPdfResponse($pdfBytes, self::buildConsentFileName($snapshot, $documentId));
            return;
        }

        json_response(['ok' => false, 'error' => 'Tipo de documento no soportado'], 400);
    }

    public static function photoFile(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $session = PatientPortalAuth::authenticateSession(
            $store,
            PatientPortalAuth::bearerTokenFromRequest()
        );

        if (($session['ok'] ?? false) !== true) {
            self::emit($session);
            return;
        }

        $photoId = trim((string) ($_GET['id'] ?? ''));
        if ($photoId === '') {
            json_response(['ok' => false, 'error' => 'id requerido'], 400);
        }

        $sessionData = is_array($session['data'] ?? null) ? $session['data'] : [];
        $snapshot = is_array($sessionData['snapshot'] ?? null) ? $sessionData['snapshot'] : [];
        $caseIds = self::collectPatientCaseIds($store, $snapshot);

        $upload = self::findPortalVisiblePhotoUpload($store, $caseIds, $photoId);
        if (!is_array($upload)) {
            json_response(['ok' => false, 'error' => 'Foto no disponible para esta sesión'], 404);
        }

        $asset = self::resolvePortalPhotoAsset($upload);
        if (($asset['path'] ?? '') === '') {
            json_response(['ok' => false, 'error' => 'Foto no disponible para esta sesión'], 404);
        }

        self::emitBinaryResponse(
            (string) file_get_contents((string) $asset['path']),
            (string) ($asset['contentType'] ?? 'application/octet-stream'),
            (string) ($asset['fileName'] ?? 'foto-clinica.jpg')
        );
    }

    public static function documentVerify(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $token = trim((string) ($_GET['token'] ?? ''));
        if ($token === '') {
            json_response(['ok' => false, 'error' => 'token requerido'], 400);
        }

        $claims = DocumentVerificationService::decodeToken($token);
        if ($claims === []) {
            self::emit([
                'ok' => true,
                'data' => [
                    'valid' => false,
                    'statusLabel' => 'No pudimos validar este documento',
                    'message' => 'El código de verificación no es válido o fue alterado.',
                ],
            ]);
            return;
        }

        $type = (string) ($claims['type'] ?? '');
        $documentId = (string) ($claims['id'] ?? '');

        if ($type === 'prescription') {
            $document = self::findPrescriptionById($store, $documentId);
            if (!is_array($document)) {
                self::emit([
                    'ok' => true,
                    'data' => [
                        'valid' => false,
                        'statusLabel' => 'Documento no encontrado',
                        'message' => 'Esta receta ya no está disponible para verificación.',
                    ],
                ]);
                return;
            }

            $caseId = trim((string) ($document['caseId'] ?? ''));
            $patient = self::resolveCasePatient($store, $caseId);
            self::emit([
                'ok' => true,
                'data' => [
                    'valid' => true,
                    'document' => self::buildDocumentVerificationPayload(
                        'prescription',
                        $document,
                        $patient
                    ),
                ],
            ]);
            return;
        }

        if ($type === 'certificate') {
            $document = self::findCertificateById($store, $documentId);
            if (!is_array($document)) {
                self::emit([
                    'ok' => true,
                    'data' => [
                        'valid' => false,
                        'statusLabel' => 'Documento no encontrado',
                        'message' => 'Este certificado ya no está disponible para verificación.',
                    ],
                ]);
                return;
            }

            $caseId = trim((string) ($document['caseId'] ?? ''));
            $patient = self::resolveCasePatient($store, $caseId);
            self::emit([
                'ok' => true,
                'data' => [
                    'valid' => true,
                    'document' => self::buildDocumentVerificationPayload(
                        'certificate',
                        $document,
                        $patient
                    ),
                ],
            ]);
            return;
        }

        self::emit([
            'ok' => true,
            'data' => [
                'valid' => false,
                'statusLabel' => 'Tipo no soportado',
                'message' => 'Este código no corresponde a un documento verificable.',
            ],
        ]);
    }

    public static function getPushPreferences(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $session = PatientPortalAuth::authenticateSession(
            $store,
            PatientPortalAuth::bearerTokenFromRequest()
        );

        if (($session['ok'] ?? false) !== true) {
            self::emit($session);
            return;
        }

        require_once __DIR__ . '/../lib/PushPreferencesService.php';
        
        $sessionData = is_array($session['data'] ?? null) ? $session['data'] : [];
        $patient = is_array($sessionData['patient'] ?? null) ? $sessionData['patient'] : [];
        $patientId = trim((string) ($patient['patientId'] ?? ''));

        $service = new PushPreferencesService();
        $preferences = $service->getPreferences($patientId);

        self::emit([
            'ok' => true,
            'data' => [
                'preferences' => $preferences
            ]
        ]);
    }

    public static function setPushPreferences(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $session = PatientPortalAuth::authenticateSession(
            $store,
            PatientPortalAuth::bearerTokenFromRequest()
        );

        if (($session['ok'] ?? false) !== true) {
            self::emit($session);
            return;
        }

        require_once __DIR__ . '/../lib/PushPreferencesService.php';

        $payload = require_json_body();
        $sessionData = is_array($session['data'] ?? null) ? $session['data'] : [];
        $patient = is_array($sessionData['patient'] ?? null) ? $sessionData['patient'] : [];
        $patientId = trim((string) ($patient['patientId'] ?? ''));

        $service = new PushPreferencesService();
        if (!$service->setPreferences($patientId, $payload)) {
            json_response([
                'ok' => false,
                'error' => 'No se pudieron guardar las preferencias'
            ], 500);
        }

        self::emit([
            'ok' => true,
            'data' => [
                'preferences' => $service->getPreferences($patientId)
            ]
        ]);
    }


    private static function findPendingSurvey(array $store, array $snapshot, array $patient): ?array
    {
        $patientId = trim((string) ($patient['documentNumber'] ?? ''));
        if ($patientId === '') {
            return null;
        }

        $surveys = is_array($store['nps_surveys'] ?? null) ? $store['nps_surveys'] : [];
        $surveyedAppointments = [];
        foreach ($surveys as $survey) {
            $appointmentId = (int) ($survey['appointmentId'] ?? 0);
            if ($appointmentId > 0) {
                $surveyedAppointments[$appointmentId] = true;
            }
        }

        $appointments = is_array($snapshot['appointments'] ?? null) ? $snapshot['appointments'] : [];
        $now = time();
        $targetDelay = 72 * 3600;

        foreach ($appointments as $apt) {
            if (!is_array($apt) || trim((string) ($apt['patientId'] ?? '')) !== $patientId || trim((string) ($apt['status'] ?? '')) !== 'completed') {
                continue;
            }

            $aptId = (int) ($apt['id'] ?? 0);
            if ($aptId <= 0 || isset($surveyedAppointments[$aptId])) {
                continue;
            }

            // Using date and time to find if 72 hours have passed
            $date = trim((string) ($apt['date'] ?? ''));
            $time = trim((string) ($apt['time'] ?? '00:00:00'));
            if ($date === '') {
                continue;
            }

            $aptTime = strtotime("$date $time");
            if ($aptTime > 0 && ($now - $aptTime) >= $targetDelay) {
                return [
                    'appointmentId' => $aptId,
                    'doctor' => get_doctor_label(trim((string) ($apt['doctor'] ?? ''))),
                    'dateLabel' => format_date_label($date),
                ];
            }
        }

        return null;
    }

    private static function findNextAppointment(array $store, array $snapshot): array
    {
        $matches = [];
        $now = time();

        foreach (($store['appointments'] ?? []) as $appointment) {
            if (!is_array($appointment) || !self::appointmentMatchesPatient($appointment, $snapshot)) {
                continue;
            }

            $status = function_exists('map_appointment_status')
                ? map_appointment_status((string) ($appointment['status'] ?? 'confirmed'))
                : strtolower(trim((string) ($appointment['status'] ?? 'confirmed')));
            if (in_array($status, ['cancelled', 'completed', 'no_show'], true)) {
                continue;
            }

            $timestamp = self::appointmentTimestamp($appointment);
            if ($timestamp === null || $timestamp < $now) {
                continue;
            }

            $matches[] = [
                'timestamp' => $timestamp,
                'appointment' => $appointment,
            ];
        }

        usort($matches, static function (array $left, array $right): int {
            return ((int) ($left['timestamp'] ?? 0)) <=> ((int) ($right['timestamp'] ?? 0));
        });

        return is_array($matches[0]['appointment'] ?? null) ? $matches[0]['appointment'] : [];
    }

    private static function buildPortalHistory(array $store, array $snapshot, array $patient): array
    {
        $caseIds = self::collectPatientCaseIds($store, $snapshot);
        $documentsByCase = self::buildDocumentsByCaseId($store, $caseIds);
        $photoSummaryByCase = self::buildCasePhotoSummaryByCaseId($store, $caseIds);
        $consultations = [];
        $representedCaseIds = [];

        foreach (($store['appointments'] ?? []) as $appointment) {
            if (!is_array($appointment) || !self::appointmentMatchesPatient($appointment, $snapshot)) {
                continue;
            }

            $status = function_exists('map_appointment_status')
                ? map_appointment_status((string) ($appointment['status'] ?? 'confirmed'))
                : strtolower(trim((string) ($appointment['status'] ?? 'confirmed')));
            if ($status === 'cancelled') {
                continue;
            }

            $caseId = self::resolveAppointmentCaseId($appointment, $snapshot);
            $documents = $documentsByCase[$caseId] ?? self::defaultDocumentState($caseId);
            $timestamp = self::appointmentTimestamp($appointment) ?? self::recordTimestamp($appointment);

            if (!self::shouldIncludeConsultationInHistory($status, $timestamp, $documents)) {
                continue;
            }

            $consultations[] = self::buildHistoryConsultationFromAppointment(
                $store,
                $appointment,
                $patient,
                $caseId,
                $documents,
                $timestamp,
                $photoSummaryByCase[$caseId] ?? []
            );

            if ($caseId !== '') {
                $representedCaseIds[$caseId] = true;
            }
        }

        foreach ($caseIds as $caseId) {
            if ($caseId === '' || isset($representedCaseIds[$caseId])) {
                continue;
            }

            $documents = $documentsByCase[$caseId] ?? self::defaultDocumentState($caseId);
            if (!self::documentsHavePortalSignal($documents)) {
                continue;
            }

            $caseRecord = self::findPatientCaseRecord($store, $caseId);
            $consultations[] = self::buildHistoryConsultationFromCase(
                $caseRecord,
                $patient,
                $caseId,
                $documents,
                $photoSummaryByCase[$caseId] ?? []
            );
        }

        usort($consultations, static function (array $left, array $right): int {
            return ((int) ($right['sortTimestamp'] ?? 0)) <=> ((int) ($left['sortTimestamp'] ?? 0));
        });

        $upcomingAppointment = self::findNextAppointment($store, $snapshot);
        if ($consultations !== [] && $upcomingAppointment !== []) {
            if (!isset($consultations[0]['events']) || !is_array($consultations[0]['events'])) {
                $consultations[0]['events'] = [];
            }

            $consultations[0]['events'][] = self::buildPortalNextControlEvent(
                self::buildAppointmentSummary($upcomingAppointment, $patient)
            );
        }

        return array_values(array_map(static function (array $consultation): array {
            unset($consultation['sortTimestamp']);
            return $consultation;
        }, $consultations));
    }

    private static function buildPatientRedFlags(array $store, array $snapshot): array
    {
        $caseIds = self::collectPatientCaseIds($store, $snapshot);
        $caseMap = [];
        foreach ($caseIds as $caseId) {
            $caseId = trim((string) $caseId);
            if ($caseId !== '') {
                $caseMap[$caseId] = true;
            }
        }

        $flags = [];
        $cutoff = time() - (30 * 86400); // 30 days

        foreach (($store['clinical_history_drafts'] ?? []) as $draft) {
            if (!is_array($draft)) {
                continue;
            }

            $caseId = trim((string) ($draft['caseId'] ?? ''));
            if ($caseId === '' || !isset($caseMap[$caseId])) {
                continue;
            }

            // Check if draft is within the last 30 days
            $candidateDate = self::firstNonEmptyString(
                (string) ($draft['updatedAt'] ?? ''),
                (string) ($draft['createdAt'] ?? '')
            );
            $ts = strtotime($candidateDate);
            if ($ts === false || $ts < $cutoff) {
                continue;
            }

            // Extract note texts
            $documents = is_array($draft['documents'] ?? null) ? $draft['documents'] : [];
            $finalNote = is_array($documents['finalNote'] ?? null) ? $documents['finalNote'] : [];
            $sections = is_array($finalNote['sections'] ?? null) ? $finalNote['sections'] : [];
            $hcu005 = is_array($sections['hcu005'] ?? null) ? $sections['hcu005'] : [];

            $summary = trim((string) ($finalNote['summary'] ?? ''));
            $evo = trim((string) ($hcu005['evolutionNote'] ?? ''));
            $diag = trim((string) ($hcu005['diagnosticImpression'] ?? ''));

            $fullText = mb_strtolower($summary . ' ' . $evo . ' ' . $diag, 'UTF-8');
            
            // Checking exact 'cambio sospechoso' flag
            if (mb_strpos($fullText, 'cambio sospechoso', 0, 'UTF-8') !== false) {
                $flags[] = [
                    'id' => 'redflag_suspicious_change',
                    'rule' => 'cambio_sospechoso_30d',
                    'message' => 'Su seguimiento recomienda una consulta pronto.',
                ];
                break; // One flag of this type is enough per patient
            }
        }

        return $flags;
    }

    private static function buildTreatmentPlanSummary(
        array $store,
        array $snapshot,
        array $patient,
        array $nextAppointment
    ): ?array {
        $caseIds = self::collectPatientCaseIds($store, $snapshot);
        $activeDraft = self::findLatestCarePlanDraft($store, $caseIds);

        if (!is_array($activeDraft)) {
            return null;
        }

        $documents = is_array($activeDraft['documents'] ?? null) ? $activeDraft['documents'] : [];
        $carePlan = is_array($documents['carePlan'] ?? null) ? $documents['carePlan'] : [];
        if (!self::carePlanHasContent($carePlan)) {
            return null;
        }

        $planStartedAt = self::recordTimestamp([
            'updatedAt' => (string) ($carePlan['generatedAt'] ?? ''),
            'createdAt' => (string) ($activeDraft['updatedAt'] ?? $activeDraft['createdAt'] ?? ''),
        ]);
        $sessionMetrics = self::countTreatmentSessions($store, $snapshot, $planStartedAt);
        $plannedSessions = self::resolvePlannedSessions($carePlan, $sessionMetrics);
        $completedSessions = (int) ($sessionMetrics['completed'] ?? 0);
        $scheduledSessions = (int) ($sessionMetrics['scheduled'] ?? 0);
        $adherencePercent = $plannedSessions > 0
            ? max(0, min(100, (int) round(($completedSessions / $plannedSessions) * 100)))
            : 0;

        $caseId = trim((string) ($activeDraft['caseId'] ?? ''));
        $prescription = self::findLatestPrescriptionForCase($store, $caseId);
        $tasks = self::buildTreatmentPlanTasks($carePlan, $prescription, $nextAppointment);
        $nextSession = $nextAppointment === [] ? null : self::buildAppointmentSummary($nextAppointment, $patient);

        return [
            'status' => trim((string) ($carePlan['status'] ?? 'draft')) ?: 'draft',
            'diagnosis' => trim((string) ($carePlan['diagnosis'] ?? 'Plan de tratamiento activo')) ?: 'Plan de tratamiento activo',
            'followUpFrequency' => trim((string) ($carePlan['followUpFrequency'] ?? 'A requerimiento')),
            'generatedAt' => trim((string) ($carePlan['generatedAt'] ?? '')),
            'generatedAtLabel' => self::buildDocumentIssuedLabel((string) ($carePlan['generatedAt'] ?? '')),
            'completedSessions' => $completedSessions,
            'plannedSessions' => $plannedSessions,
            'scheduledSessions' => $scheduledSessions,
            'adherencePercent' => $adherencePercent,
            'adherenceLabel' => $adherencePercent . '%',
            'progressLabel' => $completedSessions . ' de ' . $plannedSessions . ' sesiones',
            'nextSession' => $nextSession,
            'tasks' => $tasks,
        ];
    }

    private static function buildTreatmentPlanDetail(
        array $store,
        array $snapshot,
        array $patient,
        array $nextAppointment
    ): ?array {
        $caseIds = self::collectPatientCaseIds($store, $snapshot);
        $activeDraft = self::findLatestCarePlanDraft($store, $caseIds);

        if (!is_array($activeDraft)) {
            return null;
        }

        $documents = is_array($activeDraft['documents'] ?? null) ? $activeDraft['documents'] : [];
        $carePlan = is_array($documents['carePlan'] ?? null) ? $documents['carePlan'] : [];
        if (!self::carePlanHasContent($carePlan)) {
            return null;
        }

        $planStartedAt = self::recordTimestamp([
            'updatedAt' => (string) ($carePlan['generatedAt'] ?? ''),
            'createdAt' => (string) ($activeDraft['updatedAt'] ?? $activeDraft['createdAt'] ?? ''),
        ]);
        $sessionMetrics = self::countTreatmentSessions($store, $snapshot, $planStartedAt);
        $plannedSessions = self::resolvePlannedSessions($carePlan, $sessionMetrics);
        $completedSessions = (int) ($sessionMetrics['completed'] ?? 0);
        $scheduledSessions = (int) ($sessionMetrics['scheduled'] ?? 0);
        $futureSessions = max(0, (int) ($sessionMetrics['future'] ?? 0));
        $adherencePercent = $plannedSessions > 0
            ? max(0, min(100, (int) round(($completedSessions / $plannedSessions) * 100)))
            : 0;

        $caseId = trim((string) ($activeDraft['caseId'] ?? ''));
        $prescription = self::findLatestPrescriptionForCase($store, $caseId);
        $tasks = self::buildTreatmentPlanTasks($carePlan, $prescription, $nextAppointment);
        $nextSession = $nextAppointment === [] ? null : self::buildAppointmentSummary($nextAppointment, $patient);
        $timeline = self::buildTreatmentPlanTimeline($store, $snapshot, $patient, $planStartedAt, $plannedSessions);
        $unscheduledSessions = max(0, $plannedSessions - $scheduledSessions);

        return [
            'status' => trim((string) ($carePlan['status'] ?? 'draft')) ?: 'draft',
            'diagnosis' => trim((string) ($carePlan['diagnosis'] ?? 'Plan de tratamiento activo')) ?: 'Plan de tratamiento activo',
            'followUpFrequency' => trim((string) ($carePlan['followUpFrequency'] ?? 'A requerimiento')),
            'generatedAt' => trim((string) ($carePlan['generatedAt'] ?? '')),
            'generatedAtLabel' => self::buildDocumentIssuedLabel((string) ($carePlan['generatedAt'] ?? '')),
            'completedSessions' => $completedSessions,
            'plannedSessions' => $plannedSessions,
            'scheduledSessions' => $scheduledSessions,
            'futureSessions' => $futureSessions,
            'unscheduledSessions' => $unscheduledSessions,
            'adherencePercent' => $adherencePercent,
            'adherenceLabel' => $adherencePercent . '%',
            'progressLabel' => $completedSessions . ' de ' . $plannedSessions . ' sesiones',
            'nextSession' => $nextSession,
            'tasks' => $tasks,
            'treatmentsText' => trim((string) ($carePlan['treatments'] ?? '')),
            'goalsText' => trim((string) ($carePlan['goals'] ?? '')),
            'timeline' => $timeline,
            'timelineCount' => count($timeline),
            'timelineLabel' => count($timeline) === 1 ? '1 hito del plan' : count($timeline) . ' hitos del plan',
            'scheduledSessionsLabel' => $scheduledSessions === 1
                ? '1 sesión ya definida'
                : $scheduledSessions . ' sesiones ya definidas',
            'unscheduledSessionsLabel' => $unscheduledSessions === 1
                ? '1 sesión pendiente por agendar'
                : $unscheduledSessions . ' sesiones pendientes por agendar',
        ];
    }

    private static function findLatestCarePlanDraft(array $store, array $caseIds): ?array
    {
        $latestDraft = null;
        $latestTimestamp = 0;

        foreach ($caseIds as $caseId) {
            foreach (ClinicalHistorySessionRepository::findAllDraftsByCaseId($store, $caseId) as $draft) {
                $documents = is_array($draft['documents'] ?? null) ? $draft['documents'] : [];
                $carePlan = is_array($documents['carePlan'] ?? null) ? $documents['carePlan'] : [];
                if (!self::carePlanHasContent($carePlan)) {
                    continue;
                }

                $timestamp = self::recordTimestamp([
                    'updatedAt' => (string) ($carePlan['generatedAt'] ?? ''),
                    'createdAt' => (string) ($draft['updatedAt'] ?? $draft['createdAt'] ?? ''),
                ]);
                if ($timestamp >= $latestTimestamp) {
                    $latestTimestamp = $timestamp;
                    $latestDraft = $draft;
                }
            }
        }

        return is_array($latestDraft) ? $latestDraft : null;
    }

    private static function carePlanHasContent(array $carePlan): bool
    {
        return trim((string) ($carePlan['diagnosis'] ?? '')) !== ''
            || trim((string) ($carePlan['treatments'] ?? '')) !== ''
            || trim((string) ($carePlan['followUpFrequency'] ?? '')) !== ''
            || trim((string) ($carePlan['goals'] ?? '')) !== '';
    }

    private static function countTreatmentSessions(array $store, array $snapshot, int $planStartedAt): array
    {
        $completed = 0;
        $future = 0;
        $now = time();

        foreach (($store['appointments'] ?? []) as $appointment) {
            if (!is_array($appointment) || !self::appointmentMatchesPatient($appointment, $snapshot)) {
                continue;
            }

            $timestamp = self::appointmentTimestamp($appointment) ?? self::recordTimestamp($appointment);
            if ($timestamp > 0 && $planStartedAt > 0 && $timestamp < $planStartedAt) {
                continue;
            }

            $status = function_exists('map_appointment_status')
                ? map_appointment_status((string) ($appointment['status'] ?? 'confirmed'))
                : strtolower(trim((string) ($appointment['status'] ?? 'confirmed')));

            if ($status === 'cancelled' || $status === 'no_show') {
                continue;
            }

            if ($status === 'completed' || ($timestamp > 0 && $timestamp < $now)) {
                $completed++;
                continue;
            }

            $future++;
        }

        return [
            'completed' => $completed,
            'future' => $future,
            'scheduled' => $completed + $future,
        ];
    }

    private static function buildTreatmentPlanTimeline(
        array $store,
        array $snapshot,
        array $patient,
        int $planStartedAt,
        int $plannedSessions
    ): array {
        $appointments = [];
        foreach (($store['appointments'] ?? []) as $appointment) {
            if (!is_array($appointment) || !self::appointmentMatchesPatient($appointment, $snapshot)) {
                continue;
            }

            $timestamp = self::appointmentTimestamp($appointment) ?? self::recordTimestamp($appointment);
            if ($timestamp > 0 && $planStartedAt > 0 && $timestamp < $planStartedAt) {
                continue;
            }

            $status = function_exists('map_appointment_status')
                ? map_appointment_status((string) ($appointment['status'] ?? 'confirmed'))
                : strtolower(trim((string) ($appointment['status'] ?? 'confirmed')));
            if (in_array($status, ['cancelled', 'no_show'], true)) {
                continue;
            }

            $appointments[] = [
                'appointment' => $appointment,
                'status' => $status,
                'timestamp' => $timestamp,
            ];
        }

        usort($appointments, static function (array $left, array $right): int {
            return ((int) ($left['timestamp'] ?? 0)) <=> ((int) ($right['timestamp'] ?? 0));
        });

        $timeline = [];
        $now = time();
        $sessionNumber = 0;
        $nextMarked = false;

        foreach ($appointments as $entry) {
            $appointment = is_array($entry['appointment'] ?? null) ? $entry['appointment'] : [];
            $timestamp = (int) ($entry['timestamp'] ?? 0);
            $status = trim((string) ($entry['status'] ?? ''));
            $sessionNumber++;

            $summary = self::buildAppointmentSummary($appointment, $patient);
            $isCompleted = $status === 'completed' || ($timestamp > 0 && $timestamp < $now);
            $isNext = !$isCompleted && !$nextMarked;
            if ($isNext) {
                $nextMarked = true;
            }

            $timeline[] = [
                'id' => 'session-' . $sessionNumber . '-' . (string) ($summary['id'] ?? $sessionNumber),
                'sessionNumber' => $sessionNumber,
                'label' => 'Sesión ' . $sessionNumber,
                'status' => $isCompleted ? 'completed' : 'scheduled',
                'statusLabel' => $isCompleted ? 'Realizada' : ($isNext ? 'Próxima' : 'Agendada'),
                'tone' => $isCompleted ? 'good' : ($isNext ? 'warning' : 'idle'),
                'isNext' => $isNext,
                'dateLabel' => (string) ($summary['dateLabel'] ?? ''),
                'timeLabel' => (string) ($summary['timeLabel'] ?? ''),
                'doctorName' => (string) ($summary['doctorName'] ?? ''),
                'serviceName' => (string) ($summary['serviceName'] ?? ''),
                'appointmentTypeLabel' => (string) ($summary['appointmentTypeLabel'] ?? ''),
                'locationLabel' => (string) ($summary['locationLabel'] ?? ''),
                'preparation' => (string) ($summary['preparation'] ?? ''),
                'rescheduleUrl' => (string) ($summary['rescheduleUrl'] ?? ''),
                'whatsappUrl' => (string) ($summary['whatsappUrl'] ?? ''),
            ];
        }

        $targetSessions = max($plannedSessions, count($timeline));
        for ($sessionNumber = count($timeline) + 1; $sessionNumber <= $targetSessions; $sessionNumber++) {
            $timeline[] = [
                'id' => 'session-pending-' . $sessionNumber,
                'sessionNumber' => $sessionNumber,
                'label' => 'Sesión ' . $sessionNumber,
                'status' => 'pending',
                'statusLabel' => 'Por agendar',
                'tone' => 'idle',
                'isNext' => false,
                'dateLabel' => '',
                'timeLabel' => '',
                'doctorName' => '',
                'serviceName' => '',
                'appointmentTypeLabel' => '',
                'locationLabel' => '',
                'preparation' => '',
                'rescheduleUrl' => '',
                'whatsappUrl' => '',
            ];
        }

        return $timeline;
    }

    private static function resolvePlannedSessions(array $carePlan, array $sessionMetrics): int
    {
        $parsed = self::parsePlannedSessions(
            trim((string) ($carePlan['treatments'] ?? '')) . "\n" . trim((string) ($carePlan['goals'] ?? ''))
        );
        $scheduled = max(1, (int) ($sessionMetrics['scheduled'] ?? 0));

        if ($parsed !== null && $parsed > 0) {
            return max($parsed, $scheduled);
        }

        return $scheduled;
    }

    private static function parsePlannedSessions(string $text): ?int
    {
        if ($text === '') {
            return null;
        }

        if (preg_match('/(\d+)\s+sesion(?:es)?/i', $text, $matches) === 1) {
            return max(1, (int) ($matches[1] ?? 0));
        }

        return null;
    }

    private static function findLatestPrescriptionForCase(array $store, string $caseId): ?array
    {
        $latestPrescription = null;
        $latestTimestamp = 0;

        foreach (($store['prescriptions'] ?? []) as $prescriptionId => $prescription) {
            if (!is_array($prescription) || trim((string) ($prescription['caseId'] ?? '')) !== $caseId) {
                continue;
            }

            $prescription['id'] = trim((string) ($prescription['id'] ?? (string) $prescriptionId));
            $timestamp = self::documentTimestamp($prescription, ['issued_at', 'issuedAt', 'createdAt']);
            if ($timestamp >= $latestTimestamp) {
                $latestTimestamp = $timestamp;
                $latestPrescription = $prescription;
            }
        }

        return is_array($latestPrescription) ? $latestPrescription : null;
    }

    private static function findLatestPrescriptionForCases(array $store, array $caseIds): ?array
    {
        $caseMap = [];
        foreach ($caseIds as $caseId) {
            $caseId = trim((string) $caseId);
            if ($caseId !== '') {
                $caseMap[$caseId] = true;
            }
        }

        $latestPrescription = null;
        $latestTimestamp = 0;

        foreach (($store['prescriptions'] ?? []) as $prescriptionId => $prescription) {
            if (!is_array($prescription)) {
                continue;
            }

            $caseId = trim((string) ($prescription['caseId'] ?? ''));
            if ($caseId === '' || !isset($caseMap[$caseId]) || !self::isIssuedPortalPrescription($prescription)) {
                continue;
            }

            $prescription['id'] = trim((string) ($prescription['id'] ?? (string) $prescriptionId));
            $timestamp = self::documentTimestamp($prescription, ['issued_at', 'issuedAt', 'createdAt']);
            if ($timestamp >= $latestTimestamp) {
                $latestTimestamp = $timestamp;
                $latestPrescription = $prescription;
            }
        }

        return is_array($latestPrescription) ? $latestPrescription : null;
    }

    private static function isIssuedPortalPrescription(array $prescription): bool
    {
        $status = strtolower(trim((string) ($prescription['status'] ?? '')));
        if ($status === '') {
            return true;
        }

        return !in_array($status, ['draft', 'pending', 'not_issued', 'cancelled', 'revoked', 'voided', 'replaced'], true);
    }

    private static function hasPendingPrescriptionDraftsForCases(array $store, array $caseIds): bool
    {
        foreach ($caseIds as $caseId) {
            foreach (ClinicalHistorySessionRepository::findAllDraftsByCaseId($store, (string) $caseId) as $draft) {
                $documents = is_array($draft['documents'] ?? null) ? $draft['documents'] : [];
                $prescription = is_array($documents['prescription'] ?? null) ? $documents['prescription'] : [];
                $status = strtolower(trim((string) ($prescription['status'] ?? '')));
                $items = is_array($prescription['items'] ?? null) ? $prescription['items'] : [];
                $medication = trim((string) ($prescription['medication'] ?? ''));
                $directions = trim((string) ($prescription['directions'] ?? ''));

                if ($items !== [] || $medication !== '' || $directions !== '') {
                    return true;
                }

                if ($status !== '' && !in_array($status, ['draft', 'not_issued'], true)) {
                    return true;
                }
            }
        }

        return false;
    }

    private static function buildActivePrescriptionSummary(array $store, array $snapshot): array
    {
        $caseIds = self::collectPatientCaseIds($store, $snapshot);
        $prescription = self::findLatestPrescriptionForCases($store, $caseIds);
        $hasPendingUpdate = self::hasPendingPrescriptionDraftsForCases($store, $caseIds);

        if (!is_array($prescription)) {
            return [
                'title' => 'Mi receta activa',
                'status' => $hasPendingUpdate ? 'pending' : 'not_issued',
                'statusLabel' => $hasPendingUpdate ? 'En preparación' : 'Sin receta activa',
                'description' => $hasPendingUpdate
                    ? 'Tu receta se está terminando de firmar y aparecerá aquí cuando quede lista.'
                    : 'Todavía no hay una receta emitida visible para esta cuenta.',
                'medications' => [],
                'medicationCount' => 0,
                'medicationCountLabel' => '0 medicamentos activos',
                'downloadUrl' => '',
                'fileName' => '',
                'issuedAt' => '',
                'issuedAtLabel' => '',
                'doctorName' => '',
                'doctorSpecialty' => '',
                'doctorMsp' => '',
                'verificationUrl' => '',
                'verificationApiUrl' => '',
                'verificationQrImageUrl' => '',
                'verificationCode' => '',
                'hasPendingUpdate' => false,
                'pendingUpdateLabel' => '',
            ];
        }

        $document = self::buildPortalDocumentPayload('prescription', $prescription, false);
        $caseId = trim((string) ($prescription['caseId'] ?? ''));
        $caseRecord = self::findPatientCaseRecord($store, $caseId);
        $doctor = self::resolveDocumentDoctor($prescription);
        $medications = self::normalizePortalPrescriptionItems($prescription);
        $medicationCount = count($medications);
        $consultationDate = self::firstNonEmptyString(
            (string) ($caseRecord['latestActivityAt'] ?? ''),
            (string) ($prescription['issued_at'] ?? ''),
            (string) ($prescription['issuedAt'] ?? '')
        );
        $serviceName = self::firstNonEmptyString(
            (string) (($caseRecord['summary']['serviceName'] ?? '')),
            'Consulta dermatológica'
        );

        return array_merge($document, [
            'title' => 'Mi receta activa',
            'status' => 'available',
            'statusLabel' => 'Activa',
            'description' => $hasPendingUpdate
                ? 'Esta es tu última receta emitida. Si tu consulta más reciente generó cambios, la actualización aparecerá aquí cuando quede firmada.'
                : 'PDF listo para descargar y consultar desde tu teléfono cuando lo necesites.',
            'patientName' => self::buildPatientDisplayName(self::resolveCasePatient($store, $caseId)),
            'doctorName' => (string) ($doctor['name'] ?? ''),
            'doctorSpecialty' => (string) ($doctor['specialty'] ?? ''),
            'doctorMsp' => (string) ($doctor['msp'] ?? ''),
            'serviceName' => $serviceName,
            'consultationDateLabel' => self::buildCaseDateLabel($consultationDate),
            'medications' => $medications,
            'medicationCount' => $medicationCount,
            'medicationCountLabel' => $medicationCount === 1
                ? '1 medicamento activo'
                : $medicationCount . ' medicamentos activos',
            'hasPendingUpdate' => $hasPendingUpdate,
            'pendingUpdateLabel' => $hasPendingUpdate
                ? 'Hay una actualización clínica en preparación desde tu atención más reciente.'
                : '',
            'verificationUrl' => (string) ($document['verificationUrl'] ?? ''),
            'verificationApiUrl' => (string) ($document['verificationApiUrl'] ?? ''),
            'verificationQrImageUrl' => (string) ($document['verificationQrImageUrl'] ?? ''),
            'verificationCode' => (string) ($document['verificationCode'] ?? ''),
        ]);
    }

    private static function normalizePortalPrescriptionItems(array $prescription): array
    {
        $rawItems = [];
        if (is_array($prescription['medications'] ?? null)) {
            $rawItems = $prescription['medications'];
        } elseif (is_array($prescription['items'] ?? null)) {
            $rawItems = $prescription['items'];
        }

        if ($rawItems !== [] && array_values($rawItems) !== $rawItems) {
            $rawItems = [$rawItems];
        }

        if ($rawItems === []) {
            $fallbackMedication = self::firstNonEmptyString(
                (string) ($prescription['medication'] ?? ''),
                (string) ($prescription['name'] ?? '')
            );
            if ($fallbackMedication !== '') {
                $rawItems = [[
                    'medication' => $fallbackMedication,
                    'dose' => (string) ($prescription['dose'] ?? ''),
                    'frequency' => (string) ($prescription['frequency'] ?? ''),
                    'duration' => (string) ($prescription['duration'] ?? ''),
                    'instructions' => self::firstNonEmptyString(
                        (string) ($prescription['instructions'] ?? ''),
                        (string) ($prescription['directions'] ?? '')
                    ),
                ]];
            }
        }

        $items = [];
        foreach ($rawItems as $index => $item) {
            if (!is_array($item)) {
                continue;
            }

            $medication = self::firstNonEmptyString(
                (string) ($item['medication'] ?? ''),
                (string) ($item['name'] ?? ''),
                (string) ($item['genericName'] ?? ''),
                (string) ($item['drug'] ?? ''),
                (string) ($item['title'] ?? '')
            );
            if ($medication === '') {
                continue;
            }

            $dose = self::firstNonEmptyString(
                (string) ($item['dose'] ?? ''),
                (string) ($item['dosage'] ?? ''),
                (string) ($item['presentation'] ?? '')
            );
            $frequency = self::firstNonEmptyString(
                (string) ($item['frequency'] ?? ''),
                (string) ($item['schedule'] ?? '')
            );
            $duration = self::firstNonEmptyString(
                (string) ($item['duration'] ?? ''),
                (string) ($item['length'] ?? ''),
                (string) ($item['days'] ?? '')
            );
            $instructions = self::firstNonEmptyString(
                (string) ($item['instructions'] ?? ''),
                (string) ($item['directions'] ?? ''),
                (string) ($item['indications'] ?? '')
            );
            $chips = array_values(array_filter([$dose, $frequency, $duration], static function ($value): bool {
                return trim((string) $value) !== '';
            }));

            $items[] = [
                'id' => (string) ($item['id'] ?? ('rx-item-' . ($index + 1))),
                'medication' => $medication,
                'dose' => $dose,
                'frequency' => $frequency,
                'duration' => $duration,
                'instructions' => $instructions,
                'summary' => implode(' · ', $chips),
                'chips' => $chips,
            ];
        }

        return $items;
    }

    private static function buildPortalConsentSummary(array $store, array $snapshot): ?array
    {
        $context = self::resolvePortalConsentContext($store, $snapshot);
        if ($context === null) {
            return null;
        }

        return self::buildPortalConsentPayloadFromContext($store, $context);
    }

    private static function buildPortalConsentPayloadFromContext(array $store, array $context): array
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

        $patientName = self::firstNonEmptyString(
            (string) ($packet['patientAttestation']['name'] ?? ''),
            (string) ($packet['patientName'] ?? ''),
            self::buildPatientDisplayName(self::resolveCasePatient($store, $caseId))
        );
        $patientDocumentNumber = self::firstNonEmptyString(
            (string) ($packet['patientAttestation']['documentNumber'] ?? ''),
            (string) ($packet['patientDocumentNumber'] ?? ''),
            (string) (self::resolveCasePatient($store, $caseId)['ci'] ?? '')
        );
        $signedAt = self::firstNonEmptyString(
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
            'procedureName' => self::firstNonEmptyString(
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
            'signedAtLabel' => self::buildPortalDateTimeLabel($signedAt, ''),
            'snapshotId' => $snapshotId,
            'pdfAvailable' => $downloadUrl !== '',
            'pdfFileName' => (string) ($portalDocument['pdfFileName'] ?? ''),
            'pdfGeneratedAt' => (string) ($portalDocument['pdfGeneratedAt'] ?? ''),
            'downloadUrl' => $downloadUrl,
        ];
    }

    private static function resolvePortalConsentContext(array $store, array $snapshot): ?array
    {
        $caseIds = self::collectPatientCaseIds($store, $snapshot);
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
                    'sortTimestamp' => self::recordTimestamp($resolvedDraft),
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

    private static function resolvePortalConsentSession(array $store, array $draft): array
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
            'patient' => self::resolveCasePatient($store, $caseId),
            'surface' => 'patient_portal',
            'status' => 'active',
        ];

        return ClinicalHistorySessionRepository::defaultSession($seed);
    }

    private static function findPortalActiveConsentPacket(array $draft): ?array
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

    private static function findLatestAcceptedConsentSnapshot(array $draft): ?array
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

    private static function preparePortalConsentPacketForSignature(
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
            $prepared['encounterDateTime'] = self::firstNonEmptyString(
                (string) ($draft['updatedAt'] ?? ''),
                (string) ($draft['createdAt'] ?? ''),
                $now
            );
        }

        return $prepared;
    }

    private static function attachPortalConsentPdfArtifacts(
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

    private static function findSignedConsentSnapshotForPacket(array $draft, string $packetId): ?array
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

    private static function findPortalConsentSnapshotById(array $store, array $caseIds, string $snapshotId): ?array
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

    private static function isPortalSignatureDataUrl(string $signatureDataUrl): bool
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

    private static function buildDocumentVerificationPayload(string $type, array $document, array $patient): array
    {
        $documentId = trim((string) ($document['id'] ?? ''));
        $doctor = self::resolveDocumentDoctor($document);
        $clinicProfile = read_clinic_profile();
        $issuedAt = self::firstNonEmptyString(
            (string) ($document['issued_at'] ?? ''),
            (string) ($document['issuedAt'] ?? ''),
            (string) ($document['createdAt'] ?? '')
        );
        $payload = [
            'type' => $type,
            'typeLabel' => $type === 'prescription' ? 'Receta médica' : 'Certificado médico',
            'documentId' => $documentId,
            'verificationCode' => DocumentVerificationService::verificationCode($documentId),
            'statusLabel' => 'Documento válido',
            'message' => 'La firma digital de este documento coincide con el registro actual de Aurora Derm.',
            'issuedAt' => $issuedAt,
            'issuedAtLabel' => self::buildDocumentIssuedLabel($issuedAt),
            'patientName' => self::buildPatientDisplayName($patient),
            'doctorName' => (string) ($doctor['name'] ?? ''),
            'doctorSpecialty' => (string) ($doctor['specialty'] ?? ''),
            'doctorMsp' => (string) ($doctor['msp'] ?? ''),
            'clinicName' => self::firstNonEmptyString(
                (string) ($document['clinicName'] ?? ''),
                (string) ($clinicProfile['clinicName'] ?? ''),
                'Aurora Derm'
            ),
        ];

        if ($type === 'prescription') {
            $items = self::normalizePortalPrescriptionItems($document);
            $payload['medicationCount'] = count($items);
            $payload['medicationSummary'] = $items !== []
                ? (string) ($items[0]['medication'] ?? '')
                : 'Sin medicamentos visibles';
        } else {
            $payload['certificateTypeLabel'] = self::firstNonEmptyString(
                (string) ($document['typeLabel'] ?? ''),
                self::humanizeValue((string) ($document['type'] ?? ''), 'Certificado médico')
            );
        }

        return $payload;
    }

    private static function resolveDocumentDoctor(array $document): array
    {
        return function_exists('doctor_profile_document_fields')
            ? doctor_profile_document_fields(
                isset($document['doctor']) && is_array($document['doctor'])
                    ? $document['doctor']
                    : ['name' => (string) ($document['issued_by'] ?? 'Médico tratante')]
            )
            : (is_array($document['doctor'] ?? null) ? $document['doctor'] : []);
    }

    private static function buildPatientDisplayName(array $patient): string
    {
        return self::firstNonEmptyString(
            trim((string) (($patient['firstName'] ?? '') . ' ' . ($patient['lastName'] ?? ''))),
            trim((string) ($patient['name'] ?? '')),
            'Paciente Aurora Derm'
        );
    }

    private static function buildHistoryExportSummary(array $snapshot, array $patient, array $consultations): array
    {
        $exportId = self::buildHistoryExportId($snapshot, $patient);
        $consultationCount = count($consultations);

        return [
            'available' => true,
            'ctaLabel' => 'Exportar mi historia completa',
            'description' => $consultationCount > 0
                ? 'Descarga un PDF con tus consultas, eventos clínicos y documentos visibles del portal.'
                : 'Descarga un PDF con tu historial visible del portal, incluso si todavía no hay atenciones registradas.',
            'downloadUrl' => '/api.php?resource=patient-portal-document&type=history&id=' . rawurlencode($exportId),
            'fileName' => self::buildHistoryExportFileName($patient, $snapshot),
            'consultationCount' => $consultationCount,
        ];
    }

    private static function buildHistoryExportId(array $snapshot, array $patient): string
    {
        $raw = self::firstNonEmptyString(
            (string) ($snapshot['patientId'] ?? ''),
            (string) ($patient['patientId'] ?? ''),
            (string) ($snapshot['patientCaseId'] ?? ''),
            'portal-history'
        );

        return self::slugifyPortalFileToken($raw, 'portal-history');
    }

    private static function buildHistoryExportFileName(array $patient, array $snapshot): string
    {
        $suffix = self::slugifyPortalFileToken(
            self::firstNonEmptyString(
                self::buildPatientDisplayName($patient),
                (string) ($snapshot['patientId'] ?? ''),
                (string) ($patient['patientId'] ?? ''),
                'portal'
            ),
            'portal'
        );

        return 'historia-clinica-' . $suffix . '.pdf';
    }

    private static function slugifyPortalFileToken(string $value, string $fallback): string
    {
        $value = strtolower(trim($value));
        $slug = preg_replace('/[^a-z0-9_-]+/', '-', $value);
        $slug = trim((string) $slug, '-_');

        return $slug !== '' ? $slug : $fallback;
    }

    private static function resolvePortalPatientProfile(array $store, array $snapshot, array $patient): array
    {
        $resolved = [];
        $caseIds = self::collectPatientCaseIds($store, $snapshot);

        foreach ($caseIds as $caseId) {
            $candidate = self::resolveCasePatient($store, $caseId);
            if ($candidate !== []) {
                $resolved = $candidate;
                break;
            }
        }

        $merged = array_merge($resolved, $patient);
        $merged['name'] = self::buildPatientDisplayName($merged);
        return $merged;
    }

    private static function buildTreatmentPlanTasks(
        array $carePlan,
        ?array $prescription,
        array $nextAppointment
    ): array {
        $tasks = [];
        foreach ([
            self::splitPlanTasks((string) ($carePlan['treatments'] ?? '')),
            self::splitPlanTasks((string) ($carePlan['goals'] ?? '')),
        ] as $taskGroup) {
            foreach ($taskGroup as $label) {
                self::rememberTask($tasks, $label);
            }
        }

        if (is_array($prescription)) {
            $medications = is_array($prescription['medications'] ?? null) ? $prescription['medications'] : [];
            $firstMedication = is_array($medications[0] ?? null) ? $medications[0] : [];
            $medicationName = trim((string) ($firstMedication['medication'] ?? ''));
            $instructions = trim((string) ($firstMedication['instructions'] ?? ''));
            $medicationTask = $medicationName !== ''
                ? 'Tomar ' . $medicationName . ($instructions !== '' ? ' · ' . $instructions : ' según la receta.')
                : '';
            self::rememberTask($tasks, $medicationTask);
        }

        if ($nextAppointment !== []) {
            $summary = self::buildAppointmentSummary($nextAppointment, []);
            $nextTask = 'Asistir a tu próxima sesión';
            $dateLabel = trim((string) ($summary['dateLabel'] ?? ''));
            $timeLabel = trim((string) ($summary['timeLabel'] ?? ''));
            if ($dateLabel !== '' || $timeLabel !== '') {
                $nextTask .= ' el ' . trim($dateLabel . ' ' . $timeLabel);
            }
            self::rememberTask($tasks, $nextTask . '.');
        }

        return array_values(array_slice($tasks, 0, 4));
    }

    private static function splitPlanTasks(string $text): array
    {
        $text = trim($text);
        if ($text === '') {
            return [];
        }

        $normalized = preg_replace('/[•\-]+/u', "\n", $text);
        $parts = preg_split('/[\n\r;]+/', (string) $normalized) ?: [];
        $tasks = [];

        foreach ($parts as $part) {
            $label = trim($part);
            if ($label === '') {
                continue;
            }

            $label = preg_replace('/^\d+\.\s*/', '', $label) ?? $label;
            $tasks[] = rtrim($label, " .") . '.';
        }

        return $tasks;
    }

    private static function rememberTask(array &$tasks, string $label): void
    {
        $label = trim($label);
        if ($label === '') {
            return;
        }

        $key = strtolower($label);
        if (!isset($tasks[$key])) {
            $tasks[$key] = [
                'label' => $label,
            ];
        }
    }

    private static function buildBillingSummary(array $store, array $snapshot): array
    {
        $orders = self::collectPortalBillingOrders($store, $snapshot);
        $currency = self::portalPaymentCurrency();

        if ($orders === []) {
            return [
                'tone' => 'good',
                'statusLabel' => 'Sin saldo pendiente',
                'statusDetail' => 'No encontramos cobros activos asociados a tu portal por ahora.',
                'totalPendingCents' => 0,
                'totalPendingLabel' => self::formatPortalCurrency(0, $currency),
                'reviewBalanceCents' => 0,
                'reviewBalanceLabel' => self::formatPortalCurrency(0, $currency),
                'lastPayment' => null,
                'nextObligation' => null,
                'payNowUrl' => '/es/pago/',
            ];
        }

        $outstandingBalanceCents = 0;
        $reviewBalanceCents = 0;
        $outstandingCount = 0;
        $overdueCount = 0;

        foreach ($orders as $order) {
            $amountCents = (int) ($order['amountCents'] ?? 0);
            $bucket = (string) ($order['statusBucket'] ?? '');
            if ($bucket === 'outstanding') {
                $outstandingBalanceCents += $amountCents;
                $outstandingCount += 1;
                if ((string) ($order['dueState'] ?? '') === 'overdue') {
                    $overdueCount += 1;
                }
            } elseif ($bucket === 'reconciliating') {
                $reviewBalanceCents += $amountCents;
            }
        }

        $totalPendingCents = $outstandingBalanceCents + $reviewBalanceCents;
        $lastPayment = self::findLatestPortalBillingOrder($orders, 'settled');
        $nextObligation = self::findNextPortalBillingOrder($orders);

        [$tone, $statusLabel, $statusDetail] = self::resolveBillingStatus(
            $outstandingBalanceCents,
            $reviewBalanceCents,
            $outstandingCount,
            $overdueCount,
            $lastPayment,
            $nextObligation
        );

        return [
            'tone' => $tone,
            'statusLabel' => $statusLabel,
            'statusDetail' => $statusDetail,
            'totalPendingCents' => $totalPendingCents,
            'totalPendingLabel' => self::formatPortalCurrency($totalPendingCents, $currency),
            'reviewBalanceCents' => $reviewBalanceCents,
            'reviewBalanceLabel' => self::formatPortalCurrency($reviewBalanceCents, $currency),
            'lastPayment' => $lastPayment,
            'nextObligation' => $nextObligation,
            'payNowUrl' => '/es/pago/',
        ];
    }

    private static function buildEvolutionSummary(array $store, array $snapshot): ?array
    {
        $caseIds = self::collectPatientCaseIds($store, $snapshot);
        $caseMap = [];
        foreach ($caseIds as $caseId) {
            $caseId = trim((string) $caseId);
            if ($caseId !== '') {
                $caseMap[$caseId] = true;
            }
        }

        $photosByGroup = [];
        foreach (($store['clinical_uploads'] ?? []) as $upload) {
            if (!is_array($upload)) {
                continue;
            }

            $caseId = self::firstNonEmptyString(
                (string) ($upload['patientCaseId'] ?? ''),
                (string) ($upload['clinicalHistoryCaseId'] ?? '')
            );
            if ($caseId === '' || !isset($caseMap[$caseId])) {
                continue;
            }

            if (strtolower(trim((string) ($upload['kind'] ?? ''))) !== 'case_photo') {
                continue;
            }

            $bodyZone = trim((string) ($upload['bodyZone'] ?? 'rostro'));
            $groupId = $caseId . '|' . strtolower($bodyZone);
            if (!isset($photosByGroup[$groupId])) {
                $photosByGroup[$groupId] = [];
            }
            $photosByGroup[$groupId][] = $upload;
        }

        $bestEvolution = null;
        $maxDiff = 0;

        foreach ($photosByGroup as $groupId => $photos) {
            if (count($photos) < 2) {
                continue;
            }

            usort($photos, static function (array $a, array $b): int {
                return strtotime((string) ($a['createdAt'] ?? '')) <=> strtotime((string) ($b['createdAt'] ?? ''));
            });

            $firstPhoto = $photos[0];
            $lastPhoto = $photos[count($photos) - 1];

            $firstTs = strtotime((string) ($firstPhoto['createdAt'] ?? '')) ?: 0;
            $lastTs = strtotime((string) ($lastPhoto['createdAt'] ?? '')) ?: 0;
            $diffSeconds = $lastTs - $firstTs;

            // Al menos 1 día de diferencia
            if ($diffSeconds >= 86400 && $diffSeconds > $maxDiff) {
                $maxDiff = $diffSeconds;
                
                $days = (int) floor($diffSeconds / 86400);
                $weeks = (int) floor($days / 7);
                $afterLabel = $weeks > 0 ? "Semana $weeks" : "Día $days";

                $bestEvolution = [
                    'before' => [
                        'url' => (string) ($firstPhoto['optimizedUrl'] ?? $firstPhoto['url'] ?? ''),
                        'label' => 'Día 1',
                        'date' => (string) ($firstPhoto['createdAt'] ?? ''),
                    ],
                    'after' => [
                        'url' => (string) ($lastPhoto['optimizedUrl'] ?? $lastPhoto['url'] ?? ''),
                        'label' => $afterLabel,
                        'date' => (string) ($lastPhoto['createdAt'] ?? ''),
                    ],
                    'bodyZone' => trim((string) ($firstPhoto['bodyZone'] ?? 'Seguimiento general')),
                    'diffDays' => $days,
                ];
            }
        }

        return $bestEvolution;
    }

    private static function buildPortalPhotoGallery(array $store, array $snapshot): array
    {
        $caseIds = self::collectPatientCaseIds($store, $snapshot);
        $caseMap = [];
        foreach ($caseIds as $caseId) {
            $caseId = trim((string) $caseId);
            if ($caseId !== '') {
                $caseMap[$caseId] = true;
            }
        }

        $groups = [];
        $totalPhotos = 0;
        $latestTimestamp = 0;
        $latestCreatedAt = '';

        foreach (($store['clinical_uploads'] ?? []) as $upload) {
            if (!is_array($upload) || !self::portalPhotoBelongsToCaseMap($upload, $caseMap)) {
                continue;
            }

            if (!self::isPortalVisiblePhoto($upload)) {
                continue;
            }

            $normalized = self::normalizePortalPhotoItem($upload);
            if ($normalized === null) {
                continue;
            }

            $groupKey = strtolower(trim((string) ($normalized['bodyZone'] ?? 'general')));
            if (!isset($groups[$groupKey])) {
                $groups[$groupKey] = [
                    'bodyZone' => (string) ($normalized['bodyZone'] ?? 'general'),
                    'bodyZoneLabel' => (string) ($normalized['bodyZoneLabel'] ?? 'Seguimiento general'),
                    'photoCount' => 0,
                    'latestCreatedAt' => '',
                    'latestCreatedAtLabel' => '',
                    'items' => [],
                    'sortTimestamp' => 0,
                ];
            }

            $groups[$groupKey]['items'][] = $normalized;
            $groups[$groupKey]['photoCount']++;
            $itemTimestamp = (int) ($normalized['sortTimestamp'] ?? 0);
            if ($itemTimestamp >= (int) ($groups[$groupKey]['sortTimestamp'] ?? 0)) {
                $groups[$groupKey]['sortTimestamp'] = $itemTimestamp;
                $groups[$groupKey]['latestCreatedAt'] = (string) ($normalized['createdAt'] ?? '');
                $groups[$groupKey]['latestCreatedAtLabel'] = (string) ($normalized['createdAtLabel'] ?? '');
            }

            $totalPhotos++;
            if ($itemTimestamp >= $latestTimestamp) {
                $latestTimestamp = $itemTimestamp;
                $latestCreatedAt = (string) ($normalized['createdAt'] ?? '');
            }
        }

        foreach ($groups as &$group) {
            usort($group['items'], static function (array $left, array $right): int {
                return ((int) ($right['sortTimestamp'] ?? 0)) <=> ((int) ($left['sortTimestamp'] ?? 0));
            });

            $group['items'] = array_values(array_map(static function (array $item): array {
                unset($item['sortTimestamp']);
                return $item;
            }, $group['items']));
        }
        unset($group);

        usort($groups, static function (array $left, array $right): int {
            return ((int) ($right['sortTimestamp'] ?? 0)) <=> ((int) ($left['sortTimestamp'] ?? 0));
        });

        $groups = array_values(array_map(static function (array $group): array {
            unset($group['sortTimestamp']);
            return $group;
        }, $groups));

        return [
            'totalPhotos' => $totalPhotos,
            'bodyZoneCount' => count($groups),
            'latestCreatedAt' => $latestCreatedAt,
            'latestCreatedAtLabel' => self::buildPortalDateTimeLabel($latestCreatedAt, ''),
            'groups' => $groups,
        ];
    }

    private static function collectPortalBillingOrders(array $store, array $snapshot): array
    {
        $orders = [];
        $portalPhone = trim((string) ($snapshot['phone'] ?? ''));
        $portalEmail = self::normalizePortalEmail((string) ($snapshot['email'] ?? ''));

        foreach (($store['checkout_orders'] ?? []) as $order) {
            if (!is_array($order) || !self::checkoutOrderMatchesPortalPatient($order, $portalPhone, $portalEmail)) {
                continue;
            }

            $amountCents = (int) ($order['amountCents'] ?? 0);
            if ($amountCents <= 0) {
                continue;
            }

            $status = strtolower(trim((string) ($order['paymentStatus'] ?? 'pending')));
            $paymentMethod = strtolower(trim((string) ($order['paymentMethod'] ?? '')));
            $currency = strtoupper(trim((string) ($order['currency'] ?? self::portalPaymentCurrency())));
            $dueAt = self::resolvePortalBillingDueAt($order);
            $activityAt = self::resolvePortalBillingActivityAt($order);
            $statusBucket = self::resolvePortalBillingBucket($status);
            $dueState = self::resolvePortalBillingDueState($statusBucket, $dueAt);

            $orders[] = [
                'id' => (string) ($order['id'] ?? ''),
                'concept' => trim((string) ($order['concept'] ?? 'Saldo pendiente')),
                'amountCents' => $amountCents,
                'amountLabel' => self::formatPortalCurrency($amountCents, $currency),
                'currency' => $currency,
                'paymentStatus' => $status,
                'paymentStatusLabel' => self::portalPaymentStatusLabel($status, $order),
                'paymentMethod' => $paymentMethod,
                'paymentMethodLabel' => self::portalPaymentMethodLabel($paymentMethod),
                'statusBucket' => $statusBucket,
                'dueAt' => $dueAt,
                'dueAtLabel' => self::buildPortalDateTimeLabel($dueAt, 'Por confirmar'),
                'dueState' => $dueState,
                'activityAt' => $activityAt,
                'activityAtLabel' => self::buildPortalDateTimeLabel($activityAt, 'Sin fecha'),
            ];
        }

        return $orders;
    }

    private static function checkoutOrderMatchesPortalPatient(array $order, string $portalPhone, string $portalEmail): bool
    {
        $payerEmail = self::normalizePortalEmail((string) ($order['payerEmail'] ?? ''));
        if ($portalEmail !== '' && $payerEmail !== '' && $portalEmail === $payerEmail) {
            return true;
        }

        $payerWhatsapp = trim((string) ($order['payerWhatsapp'] ?? ''));
        if ($portalPhone !== '' && $payerWhatsapp !== '' && PatientPortalAuth::matchesPatientPhone($payerWhatsapp, $portalPhone)) {
            return true;
        }

        return false;
    }

    private static function normalizePortalEmail(string $value): string
    {
        return strtolower(trim($value));
    }

    private static function resolvePortalBillingBucket(string $status): string
    {
        return match ($status) {
            'paid', 'applied' => 'settled',
            'verified_transfer' => 'reconciliating',
            default => 'outstanding',
        };
    }

    private static function resolvePortalBillingDueAt(array $order): string
    {
        $dueAt = self::normalizePortalIsoDateTime((string) ($order['dueAt'] ?? ''));
        if ($dueAt !== '') {
            return $dueAt;
        }

        $createdAt = self::normalizePortalIsoDateTime((string) ($order['createdAt'] ?? ''));
        if ($createdAt === '') {
            return '';
        }

        $modifier = strtolower(trim((string) ($order['paymentMethod'] ?? ''))) === 'card'
            ? '+60 minutes'
            : '+72 hours';

        try {
            return (new \DateTimeImmutable($createdAt))->modify($modifier)->format('c');
        } catch (\Throwable $error) {
            return '';
        }
    }

    private static function resolvePortalBillingActivityAt(array $order): string
    {
        return self::firstNonEmptyString(
            self::normalizePortalIsoDateTime((string) ($order['transferAppliedAt'] ?? '')),
            self::normalizePortalIsoDateTime((string) ($order['paymentPaidAt'] ?? '')),
            self::normalizePortalIsoDateTime((string) ($order['transferVerifiedAt'] ?? '')),
            self::normalizePortalIsoDateTime((string) ($order['updatedAt'] ?? '')),
            self::normalizePortalIsoDateTime((string) ($order['createdAt'] ?? ''))
        );
    }

    private static function resolvePortalBillingDueState(string $bucket, string $dueAt): string
    {
        if ($bucket !== 'outstanding' || $dueAt === '') {
            return 'none';
        }

        $dueTs = strtotime($dueAt);
        if ($dueTs === false) {
            return 'scheduled';
        }

        return $dueTs <= time() ? 'overdue' : 'scheduled';
    }

    private static function findLatestPortalBillingOrder(array $orders, string $bucket): ?array
    {
        $match = null;
        $matchTs = 0;

        foreach ($orders as $order) {
            if ((string) ($order['statusBucket'] ?? '') !== $bucket) {
                continue;
            }

            $activityTs = strtotime((string) ($order['activityAt'] ?? '')) ?: 0;
            if ($activityTs >= $matchTs) {
                $match = $order;
                $matchTs = $activityTs;
            }
        }

        if (!is_array($match)) {
            return null;
        }

        return [
            'concept' => (string) ($match['concept'] ?? ''),
            'amountLabel' => (string) ($match['amountLabel'] ?? ''),
            'paidAt' => (string) ($match['activityAt'] ?? ''),
            'paidAtLabel' => (string) ($match['activityAtLabel'] ?? ''),
            'paymentMethodLabel' => (string) ($match['paymentMethodLabel'] ?? ''),
        ];
    }

    private static function findNextPortalBillingOrder(array $orders): ?array
    {
        $match = null;
        $matchTs = 0;

        foreach ($orders as $order) {
            if ((string) ($order['statusBucket'] ?? '') !== 'outstanding') {
                continue;
            }

            $dueAt = (string) ($order['dueAt'] ?? '');
            $dueTs = strtotime($dueAt) ?: 0;
            if ($match === null) {
                $match = $order;
                $matchTs = $dueTs;
                continue;
            }

            if ($dueTs > 0 && ($matchTs === 0 || $dueTs < $matchTs)) {
                $match = $order;
                $matchTs = $dueTs;
            }
        }

        if (!is_array($match)) {
            return null;
        }

        return [
            'concept' => (string) ($match['concept'] ?? ''),
            'amountLabel' => (string) ($match['amountLabel'] ?? ''),
            'dueAt' => (string) ($match['dueAt'] ?? ''),
            'dueAtLabel' => (string) ($match['dueAtLabel'] ?? ''),
            'statusLabel' => (string) ($match['paymentStatusLabel'] ?? ''),
            'dueState' => (string) ($match['dueState'] ?? 'scheduled'),
        ];
    }

    private static function resolveBillingStatus(
        int $outstandingBalanceCents,
        int $reviewBalanceCents,
        int $outstandingCount,
        int $overdueCount,
        ?array $lastPayment,
        ?array $nextObligation
    ): array {
        if ($overdueCount > 0) {
            return [
                'attention',
                'Pago vencido',
                $nextObligation !== null
                    ? 'Tienes un cobro vencido. Regularízalo desde el checkout seguro para evitar retrasos en tu atención.'
                    : 'Tienes un cobro vencido pendiente de regularización.',
            ];
        }

        if ($outstandingBalanceCents > 0) {
            return [
                'warning',
                'Saldo pendiente',
                $nextObligation !== null
                    ? 'Tu próxima obligación ya está visible en el portal. Puedes pagarla sin exponer datos bancarios.'
                    : 'Tienes un saldo pendiente disponible para pago seguro.',
            ];
        }

        if ($reviewBalanceCents > 0) {
            return [
                'warning',
                'Pago en revisión',
                'Ya recibimos tu comprobante y el equipo lo está validando antes de aplicarlo a tu saldo.',
            ];
        }

        return [
            'good',
            'Al día',
            $lastPayment !== null
                ? 'Tu último pago quedó aplicado y no tienes obligaciones pendientes por ahora.'
                : 'No tienes obligaciones pendientes asociadas a este portal.',
        ];
    }

    private static function portalPaymentCurrency(): string
    {
        if (function_exists('payment_currency')) {
            $currency = strtoupper(trim((string) payment_currency()));
            if ($currency !== '') {
                return $currency;
            }
        }

        return 'USD';
    }

    private static function formatPortalCurrency(int $amountCents, string $currency): string
    {
        $safeCurrency = strtoupper(trim($currency));
        if ($safeCurrency === '') {
            $safeCurrency = 'USD';
        }

        $prefix = $safeCurrency === 'USD' ? '$' : $safeCurrency . ' ';
        return $prefix . number_format($amountCents / 100, 2, '.', ',');
    }

    private static function portalPaymentMethodLabel(string $method): string
    {
        return match ($method) {
            'card' => 'Tarjeta',
            'transfer' => 'Transferencia',
            'cash' => 'Efectivo en consultorio',
            default => 'Pendiente',
        };
    }

    private static function portalPaymentStatusLabel(string $status, array $order): string
    {
        if (
            $status === 'pending_transfer' &&
            trim((string) ($order['transferProofUploadedAt'] ?? '')) !== ''
        ) {
            return 'Pendiente de verificación';
        }

        return match ($status) {
            'paid' => 'Pagado',
            'pending_gateway' => 'Esperando confirmación',
            'pending_transfer' => 'Pendiente de transferencia',
            'pending_cash' => 'Pendiente de pago en consultorio',
            'verified_transfer' => 'En revisión',
            'applied' => 'Aplicado',
            'failed' => 'Fallido',
            default => 'Pendiente',
        };
    }

    private static function normalizePortalIsoDateTime(string $value): string
    {
        $value = trim($value);
        if ($value === '') {
            return '';
        }

        try {
            return (new \DateTimeImmutable($value))->format('c');
        } catch (\Throwable $error) {
            return '';
        }
    }

    private static function buildPortalDateTimeLabel(string $value, string $fallback): string
    {
        $normalized = self::normalizePortalIsoDateTime($value);
        if ($normalized === '') {
            return $fallback;
        }

        try {
            $dateTime = new \DateTimeImmutable($normalized);
            return self::buildDateLabel($dateTime->format('Y-m-d')) . ' · ' . self::buildTimeLabel($dateTime->format('H:i'));
        } catch (\Throwable $error) {
            return $fallback;
        }
    }

    private static function collectPatientCaseIds(array $store, array $snapshot): array
    {
        $caseIds = [];
        $remember = static function (string $caseId) use (&$caseIds): void {
            $caseId = trim($caseId);
            if ($caseId !== '') {
                $caseIds[$caseId] = true;
            }
        };

        $remember((string) ($snapshot['patientCaseId'] ?? ''));

        foreach (($store['appointments'] ?? []) as $appointment) {
            if (!is_array($appointment) || !self::appointmentMatchesPatient($appointment, $snapshot)) {
                continue;
            }

            $remember((string) ($appointment['patientCaseId'] ?? ''));
        }

        foreach (($store['patient_cases'] ?? []) as $caseRecord) {
            if (!is_array($caseRecord)) {
                continue;
            }

            if (self::patientCaseMatchesSnapshot($caseRecord, $snapshot)) {
                $remember((string) ($caseRecord['id'] ?? ''));
            }
        }

        return array_keys($caseIds);
    }

    private static function patientCaseMatchesSnapshot(array $caseRecord, array $snapshot): bool
    {
        $caseId = trim((string) ($snapshot['patientCaseId'] ?? ''));
        if ($caseId !== '' && $caseId === trim((string) ($caseRecord['id'] ?? ''))) {
            return true;
        }

        $patientId = trim((string) ($snapshot['patientId'] ?? ''));
        if ($patientId !== '' && $patientId === trim((string) ($caseRecord['patientId'] ?? ''))) {
            return true;
        }

        $summary = is_array($caseRecord['summary'] ?? null) ? $caseRecord['summary'] : [];
        $candidatePhones = [
            (string) ($summary['contactPhone'] ?? ''),
            (string) ($caseRecord['contactPhone'] ?? ''),
            (string) ($summary['patientPhone'] ?? ''),
        ];
        $phone = trim((string) ($snapshot['phone'] ?? ''));

        foreach ($candidatePhones as $candidatePhone) {
            if ($phone !== '' && PatientPortalAuth::matchesPatientPhone($candidatePhone, $phone)) {
                return true;
            }
        }

        return false;
    }

    private static function resolveAppointmentCaseId(array $appointment, array $snapshot): string
    {
        $caseId = trim((string) ($appointment['patientCaseId'] ?? ''));
        if ($caseId !== '') {
            return $caseId;
        }

        return trim((string) ($snapshot['patientCaseId'] ?? ''));
    }

    private static function shouldIncludeConsultationInHistory(string $status, ?int $timestamp, array $documents): bool
    {
        if ($status === 'completed') {
            return true;
        }

        if ($timestamp !== null && $timestamp <= time()) {
            return true;
        }

        return self::documentsHavePortalSignal($documents);
    }

    private static function documentsHavePortalSignal(array $documents): bool
    {
        foreach (['prescription', 'certificate'] as $type) {
            $status = (string) ($documents[$type]['status'] ?? '');
            if ($status !== '' && $status !== 'not_issued') {
                return true;
            }
        }

        return false;
    }

    private static function buildDocumentsByCaseId(array $store, array $caseIds): array
    {
        $caseMap = [];
        foreach ($caseIds as $caseId) {
            $caseId = trim((string) $caseId);
            if ($caseId !== '') {
                $caseMap[$caseId] = true;
            }
        }

        $latestPrescriptions = [];
        foreach (($store['prescriptions'] ?? []) as $prescriptionId => $prescription) {
            if (!is_array($prescription)) {
                continue;
            }

            $caseId = trim((string) ($prescription['caseId'] ?? ''));
            if ($caseId === '' || !isset($caseMap[$caseId])) {
                continue;
            }

            $prescription['id'] = trim((string) ($prescription['id'] ?? (string) $prescriptionId));
            $candidateTimestamp = self::documentTimestamp($prescription, ['issued_at', 'issuedAt', 'createdAt']);
            $currentTimestamp = isset($latestPrescriptions[$caseId])
                ? self::documentTimestamp($latestPrescriptions[$caseId], ['issued_at', 'issuedAt', 'createdAt'])
                : 0;

            if ($candidateTimestamp >= $currentTimestamp) {
                $latestPrescriptions[$caseId] = $prescription;
            }
        }

        $latestCertificates = [];
        foreach (($store['certificates'] ?? []) as $certificateId => $certificate) {
            if (!is_array($certificate)) {
                continue;
            }

            $caseId = trim((string) ($certificate['caseId'] ?? ''));
            if ($caseId === '' || !isset($caseMap[$caseId])) {
                continue;
            }

            $certificate['id'] = trim((string) ($certificate['id'] ?? (string) $certificateId));
            $candidateTimestamp = self::documentTimestamp($certificate, ['issued_at', 'issuedAt', 'createdAt']);
            $currentTimestamp = isset($latestCertificates[$caseId])
                ? self::documentTimestamp($latestCertificates[$caseId], ['issued_at', 'issuedAt', 'createdAt'])
                : 0;

            if ($candidateTimestamp >= $currentTimestamp) {
                $latestCertificates[$caseId] = $certificate;
            }
        }

        $documentsByCase = [];
        foreach (array_keys($caseMap) as $caseId) {
            $drafts = ClinicalHistorySessionRepository::findAllDraftsByCaseId($store, $caseId);
            $documentsByCase[$caseId] = [
                'prescription' => self::buildPortalDocumentPayload(
                    'prescription',
                    $latestPrescriptions[$caseId] ?? null,
                    self::hasPendingPrescriptionDraft($drafts)
                ),
                'certificate' => self::buildPortalDocumentPayload(
                    'certificate',
                    $latestCertificates[$caseId] ?? null,
                    self::hasPendingCertificateDraft($drafts)
                ),
            ];
        }

        return $documentsByCase;
    }

    private static function hasPendingPrescriptionDraft(array $drafts): bool
    {
        foreach ($drafts as $draft) {
            $documents = is_array($draft['documents'] ?? null) ? $draft['documents'] : [];
            $prescription = is_array($documents['prescription'] ?? null) ? $documents['prescription'] : [];
            $status = strtolower(trim((string) ($prescription['status'] ?? '')));
            $items = is_array($prescription['items'] ?? null) ? $prescription['items'] : [];
            $medication = trim((string) ($prescription['medication'] ?? ''));
            $directions = trim((string) ($prescription['directions'] ?? ''));

            if ($items !== [] || $medication !== '' || $directions !== '') {
                return true;
            }

            if ($status !== '' && !in_array($status, ['draft', 'not_issued'], true)) {
                return true;
            }
        }

        return false;
    }

    private static function hasPendingCertificateDraft(array $drafts): bool
    {
        foreach ($drafts as $draft) {
            $documents = is_array($draft['documents'] ?? null) ? $draft['documents'] : [];
            $certificate = is_array($documents['certificate'] ?? null) ? $documents['certificate'] : [];
            $status = strtolower(trim((string) ($certificate['status'] ?? '')));
            $summary = trim((string) ($certificate['summary'] ?? ''));
            $restDays = (int) ($certificate['restDays'] ?? 0);

            if ($summary !== '' || $restDays > 0) {
                return true;
            }

            if ($status !== '' && !in_array($status, ['draft', 'not_issued'], true)) {
                return true;
            }
        }

        return false;
    }

    private static function buildPortalDocumentPayload(string $type, ?array $document, bool $pending): array
    {
        $title = $type === 'prescription' ? 'Receta médica' : 'Certificado médico';

        if (is_array($document)) {
            $documentId = trim((string) ($document['id'] ?? ''));
            $issuedAt = self::firstNonEmptyString(
                (string) ($document['issued_at'] ?? ''),
                (string) ($document['issuedAt'] ?? ''),
                (string) ($document['createdAt'] ?? '')
            );
            $verificationUrl = DocumentVerificationService::verificationPageUrlForDocument($type, $documentId);

            return [
                'type' => $type,
                'title' => $title,
                'status' => 'available',
                'statusLabel' => 'Disponible',
                'description' => 'PDF listo para descargar en un toque.',
                'documentId' => $documentId,
                'downloadUrl' => '/api.php?resource=patient-portal-document&type='
                    . rawurlencode($type)
                    . '&id='
                    . rawurlencode($documentId),
                'fileName' => $type === 'prescription'
                    ? self::buildPrescriptionFileName($documentId)
                    : self::buildCertificateFileName($document, $documentId),
                'issuedAt' => $issuedAt,
                'issuedAtLabel' => self::buildDocumentIssuedLabel($issuedAt),
                'verificationUrl' => $verificationUrl,
                'verificationApiUrl' => DocumentVerificationService::apiVerificationUrlForDocument($type, $documentId),
                'verificationQrImageUrl' => DocumentVerificationService::qrImageUrlForDocument($type, $documentId),
                'verificationCode' => DocumentVerificationService::verificationCode($documentId),
            ];
        }

        return [
            'type' => $type,
            'title' => $title,
            'status' => $pending ? 'pending' : 'not_issued',
            'statusLabel' => $pending ? 'Pendiente' : 'No emitido',
            'description' => $pending
                ? 'Tu documento está en preparación y aparecerá aquí cuando quede firmado.'
                : 'En esta consulta todavía no se emitió este documento.',
            'documentId' => '',
            'downloadUrl' => '',
            'fileName' => '',
            'issuedAt' => '',
            'issuedAtLabel' => '',
            'verificationUrl' => '',
            'verificationApiUrl' => '',
            'verificationQrImageUrl' => '',
            'verificationCode' => '',
        ];
    }

    private static function defaultDocumentState(string $caseId): array
    {
        return [
            'prescription' => self::buildPortalDocumentPayload('prescription', null, false),
            'certificate' => self::buildPortalDocumentPayload('certificate', null, false),
        ];
    }

    private static function buildHistoryConsultationFromAppointment(
        array $store,
        array $appointment,
        array $patient,
        string $caseId,
        array $documents,
        ?int $timestamp,
        array $photoSummary
    ): array {
        $summary = self::buildAppointmentSummary($appointment, $patient);
        $status = (string) ($summary['status'] ?? 'confirmed');
        $caseRecord = self::findPatientCaseRecord($store, $caseId);
        $caseSummary = is_array($caseRecord['summary'] ?? null) ? $caseRecord['summary'] : [];
        $serviceName = self::firstNonEmptyString(
            (string) ($caseSummary['serviceName'] ?? ''),
            (string) ($caseSummary['reasonLabel'] ?? ''),
            (string) ($summary['serviceName'] ?? ''),
            'Consulta Aurora Derm'
        );

        return [
            'id' => 'appt-' . (string) ($appointment['id'] ?? $caseId),
            'caseId' => $caseId,
            'appointmentId' => (int) ($appointment['id'] ?? 0),
            'status' => $status,
            'statusLabel' => self::historyStatusLabel($status),
            'date' => (string) ($summary['date'] ?? ''),
            'dateLabel' => (string) ($summary['dateLabel'] ?? self::buildDateLabel((string) ($appointment['date'] ?? ''))),
            'time' => (string) ($summary['time'] ?? ''),
            'timeLabel' => (string) ($summary['timeLabel'] ?? self::buildTimeLabel((string) ($appointment['time'] ?? ''))),
            'doctorName' => (string) ($summary['doctorName'] ?? 'Equipo clínico Aurora Derm'),
            'serviceName' => $serviceName,
            'appointmentTypeLabel' => (string) ($summary['appointmentTypeLabel'] ?? ''),
            'locationLabel' => (string) ($summary['locationLabel'] ?? ''),
            'events' => self::buildPortalTimelineEvents([
                'dateLabel' => (string) ($summary['dateLabel'] ?? self::buildDateLabel((string) ($appointment['date'] ?? ''))),
                'timeLabel' => (string) ($summary['timeLabel'] ?? self::buildTimeLabel((string) ($appointment['time'] ?? ''))),
                'serviceName' => $serviceName,
            ], $documents, $photoSummary),
            'documents' => $documents,
            'sortTimestamp' => $timestamp ?? 0,
        ];
    }

    private static function buildHistoryConsultationFromCase(
        array $caseRecord,
        array $patient,
        string $caseId,
        array $documents,
        array $photoSummary
    ): array {
        $summary = is_array($caseRecord['summary'] ?? null) ? $caseRecord['summary'] : [];
        $rawDate = self::firstNonEmptyString(
            (string) ($caseRecord['latestActivityAt'] ?? ''),
            (string) ($caseRecord['createdAt'] ?? '')
        );
        $timestamp = self::recordTimestamp($caseRecord);
        $serviceName = self::firstNonEmptyString(
            (string) ($summary['serviceName'] ?? ''),
            (string) ($summary['reasonLabel'] ?? ''),
            'Atención Aurora Derm'
        );
        $patientName = trim((string) ($patient['name'] ?? ''));

        return [
            'id' => 'case-' . $caseId,
            'caseId' => $caseId,
            'appointmentId' => 0,
            'status' => 'completed',
            'statusLabel' => 'Atención registrada',
            'date' => $rawDate,
            'dateLabel' => self::buildCaseDateLabel($rawDate),
            'time' => '',
            'timeLabel' => '',
            'doctorName' => 'Equipo clínico Aurora Derm',
            'serviceName' => $serviceName !== '' ? $serviceName : ('Atención de ' . ($patientName !== '' ? $patientName : 'portal')),
            'appointmentTypeLabel' => '',
            'locationLabel' => 'Portal del paciente',
            'events' => self::buildPortalTimelineEvents([
                'dateLabel' => self::buildCaseDateLabel($rawDate),
                'timeLabel' => '',
                'serviceName' => $serviceName !== '' ? $serviceName : 'Atención Aurora Derm',
            ], $documents, $photoSummary),
            'documents' => $documents,
            'sortTimestamp' => $timestamp,
        ];
    }

    private static function buildCasePhotoSummaryByCaseId(array $store, array $caseIds): array
    {
        $caseMap = [];
        foreach ($caseIds as $caseId) {
            $caseId = trim((string) $caseId);
            if ($caseId !== '') {
                $caseMap[$caseId] = true;
            }
        }

        $summaryByCase = [];
        foreach (($store['clinical_uploads'] ?? []) as $upload) {
            if (!is_array($upload)) {
                continue;
            }

            $caseId = self::firstNonEmptyString(
                (string) ($upload['patientCaseId'] ?? ''),
                (string) ($upload['clinicalHistoryCaseId'] ?? '')
            );
            if ($caseId === '' || !isset($caseMap[$caseId])) {
                continue;
            }

            if (strtolower(trim((string) ($upload['kind'] ?? ''))) !== 'case_photo') {
                continue;
            }

            if (!isset($summaryByCase[$caseId])) {
                $summaryByCase[$caseId] = [
                    'count' => 0,
                    'latestCreatedAt' => '',
                    'bodyZone' => '',
                ];
            }

            $summaryByCase[$caseId]['count']++;
            $createdAt = trim((string) ($upload['createdAt'] ?? ''));
            $currentLatest = trim((string) ($summaryByCase[$caseId]['latestCreatedAt'] ?? ''));
            if ($currentLatest === '' || strtotime($createdAt) >= strtotime($currentLatest)) {
                $summaryByCase[$caseId]['latestCreatedAt'] = $createdAt;
                $summaryByCase[$caseId]['bodyZone'] = trim((string) ($upload['bodyZone'] ?? ''));
            }
        }

        return $summaryByCase;
    }

    private static function buildPortalTimelineEvents(
        array $consultation,
        array $documents,
        array $photoSummary
    ): array {
        $events = [[
            'type' => 'consultation',
            'icon' => 'visit',
            'label' => self::buildPortalConsultationEventLabel((string) ($consultation['serviceName'] ?? '')),
            'meta' => trim(
                (string) ($consultation['dateLabel'] ?? '')
                . ((string) ($consultation['timeLabel'] ?? '') !== '' ? ' · ' . (string) ($consultation['timeLabel'] ?? '') : '')
            ),
            'tone' => 'idle',
        ]];

        $prescriptionEvent = self::buildPortalDocumentTimelineEvent(
            is_array($documents['prescription'] ?? null) ? $documents['prescription'] : []
        );
        if ($prescriptionEvent !== null) {
            $events[] = $prescriptionEvent;
        }

        $certificateEvent = self::buildPortalDocumentTimelineEvent(
            is_array($documents['certificate'] ?? null) ? $documents['certificate'] : []
        );
        if ($certificateEvent !== null) {
            $events[] = $certificateEvent;
        }

        $photoEvent = self::buildPortalPhotoTimelineEvent($photoSummary);
        if ($photoEvent !== null) {
            $events[] = $photoEvent;
        }

        return $events;
    }

    private static function buildPortalConsultationEventLabel(string $serviceName): string
    {
        $serviceName = trim($serviceName);
        if ($serviceName === '') {
            return 'Consulta registrada';
        }

        $lower = function_exists('mb_strtolower')
            ? mb_strtolower($serviceName, 'UTF-8')
            : strtolower($serviceName);

        if (str_starts_with($lower, 'consulta')) {
            return $serviceName;
        }

        return 'Consulta por ' . $lower;
    }

    private static function buildPortalDocumentTimelineEvent(array $document): ?array
    {
        $status = strtolower(trim((string) ($document['status'] ?? '')));
        $type = strtolower(trim((string) ($document['type'] ?? 'document')));
        if (!in_array($status, ['available', 'pending'], true)) {
            return null;
        }

        $isPrescription = $type === 'prescription';
        $label = $status === 'available'
            ? ($isPrescription ? 'Receta lista' : 'Certificado listo')
            : ($isPrescription ? 'Receta en preparación' : 'Certificado en preparación');

        return [
            'type' => $isPrescription ? 'prescription' : 'certificate',
            'icon' => $isPrescription ? 'prescription' : 'document',
            'label' => $label,
            'meta' => trim((string) ($document['issuedAtLabel'] ?? $document['description'] ?? '')),
            'tone' => $status === 'available' ? 'good' : 'warning',
        ];
    }

    private static function buildPortalPhotoTimelineEvent(array $photoSummary): ?array
    {
        $count = (int) ($photoSummary['count'] ?? 0);
        if ($count <= 0) {
            return null;
        }

        $bodyZone = trim((string) ($photoSummary['bodyZone'] ?? ''));
        $createdAt = trim((string) ($photoSummary['latestCreatedAt'] ?? ''));
        $label = $count > 1 ? $count . ' fotos de control enviadas' : 'Foto de control enviada';
        $metaParts = [];
        if ($bodyZone !== '') {
            $metaParts[] = self::humanizeValue($bodyZone, '');
        }
        if ($createdAt !== '') {
            $metaParts[] = self::buildPortalDateTimeLabel($createdAt, '');
        }

        return [
            'type' => 'photo',
            'icon' => 'photo',
            'label' => $label,
            'meta' => trim(implode(' · ', array_filter($metaParts))),
            'tone' => 'good',
        ];
    }

    private static function buildPortalNextControlEvent(array $appointmentSummary): array
    {
        $dateLabel = trim((string) ($appointmentSummary['dateLabel'] ?? ''));
        $timeLabel = trim((string) ($appointmentSummary['timeLabel'] ?? ''));
        $serviceName = trim((string) ($appointmentSummary['serviceName'] ?? 'Próximo control'));
        $meta = trim($serviceName . ($timeLabel !== '' ? ' · ' . $timeLabel : ''));

        return [
            'type' => 'appointment',
            'icon' => 'calendar',
            'label' => $dateLabel !== '' ? 'Próximo control: ' . $dateLabel : 'Próximo control agendado',
            'meta' => $meta,
            'tone' => 'warning',
        ];
    }

    private static function historyStatusLabel(string $status): string
    {
        if ($status === 'completed') {
            return 'Atención finalizada';
        }

        if ($status === 'pending') {
            return 'Consulta en seguimiento';
        }

        return 'Consulta registrada';
    }

    private static function buildCaseDateLabel(string $value): string
    {
        $value = trim($value);
        if ($value === '') {
            return 'Fecha por confirmar';
        }

        $timestamp = strtotime($value);
        if ($timestamp === false) {
            return $value;
        }

        return self::buildDateLabel(date('Y-m-d', $timestamp));
    }

    private static function findPatientCaseRecord(array $store, string $caseId): array
    {
        foreach (($store['patient_cases'] ?? []) as $caseRecord) {
            if (!is_array($caseRecord)) {
                continue;
            }

            if ($caseId === trim((string) ($caseRecord['id'] ?? ''))) {
                return $caseRecord;
            }
        }

        return [];
    }

    private static function findPrescriptionById(array $store, string $documentId): ?array
    {
        $prescription = $store['prescriptions'][$documentId] ?? null;
        if (!is_array($prescription)) {
            return null;
        }

        $prescription['id'] = trim((string) ($prescription['id'] ?? $documentId));
        return $prescription;
    }

    private static function findCertificateById(array $store, string $documentId): ?array
    {
        $certificate = $store['certificates'][$documentId] ?? null;
        if (!is_array($certificate)) {
            return null;
        }

        $certificate['id'] = trim((string) ($certificate['id'] ?? $documentId));
        return $certificate;
    }

    private static function caseBelongsToPortalPatient(string $caseId, array $caseIds, array $snapshot): bool
    {
        $caseId = trim($caseId);
        if ($caseId === '') {
            return false;
        }

        if (in_array($caseId, $caseIds, true)) {
            return true;
        }

        return $caseId === trim((string) ($snapshot['patientCaseId'] ?? ''));
    }

    private static function resolveCasePatient(array $store, string $caseId): array
    {
        if (
            $caseId !== ''
            && isset($store['patients'][$caseId])
            && is_array($store['patients'][$caseId])
        ) {
            return $store['patients'][$caseId];
        }

        $caseRecord = self::findPatientCaseRecord($store, $caseId);
        $summary = is_array($caseRecord['summary'] ?? null) ? $caseRecord['summary'] : [];

        return [
            'firstName' => trim((string) ($summary['patientLabel'] ?? 'Paciente')),
            'lastName' => '',
            'phone' => trim((string) ($summary['contactPhone'] ?? '')),
            'email' => trim((string) ($summary['contactEmail'] ?? '')),
        ];
    }

    private static function buildPrescriptionFileName(string $documentId): string
    {
        $suffix = preg_replace('/[^a-zA-Z0-9_-]/', '-', $documentId);
        return 'receta-' . ($suffix !== '' ? $suffix : 'portal') . '.pdf';
    }

    private static function buildConsentFileName(array $consentSnapshot, string $documentId): string
    {
        $suffix = self::firstNonEmptyString(
            (string) ($consentSnapshot['procedureName'] ?? ''),
            (string) ($consentSnapshot['packetId'] ?? ''),
            (string) ($consentSnapshot['snapshotId'] ?? ''),
            $documentId
        );
        $suffix = preg_replace('/[^a-zA-Z0-9_-]/', '-', strtolower($suffix));
        return 'consentimiento-' . ($suffix !== '' ? $suffix : 'portal') . '.pdf';
    }

    private static function buildCertificateFileName(array $certificate, string $documentId): string
    {
        $suffix = self::firstNonEmptyString(
            (string) ($certificate['folio'] ?? ''),
            (string) ($certificate['id'] ?? ''),
            $documentId
        );
        $suffix = preg_replace('/[^a-zA-Z0-9_-]/', '-', $suffix);
        return 'certificado-' . ($suffix !== '' ? $suffix : 'portal') . '.pdf';
    }

    private static function buildDocumentIssuedLabel(string $issuedAt): string
    {
        $issuedAt = trim($issuedAt);
        if ($issuedAt === '') {
            return '';
        }

        $timestamp = strtotime($issuedAt);
        if ($timestamp === false) {
            return '';
        }

        return 'Emitido el ' . self::buildDateLabel(date('Y-m-d', $timestamp));
    }

    private static function documentTimestamp(array $document, array $keys): int
    {
        foreach ($keys as $key) {
            $value = trim((string) ($document[$key] ?? ''));
            if ($value === '') {
                continue;
            }

            $timestamp = strtotime($value);
            if ($timestamp !== false) {
                return $timestamp;
            }
        }

        return 0;
    }

    private static function recordTimestamp(array $record): int
    {
        $candidates = [
            (string) ($record['latestActivityAt'] ?? ''),
            (string) ($record['updatedAt'] ?? ''),
            (string) ($record['createdAt'] ?? ''),
            trim((string) ($record['date'] ?? '') . ' ' . (string) ($record['time'] ?? '')),
            (string) ($record['dateBooked'] ?? ''),
        ];

        foreach ($candidates as $candidate) {
            $candidate = trim($candidate);
            if ($candidate === '') {
                continue;
            }

            $timestamp = strtotime($candidate);
            if ($timestamp !== false) {
                return $timestamp;
            }
        }

        return 0;
    }

    private static function generateConsentPdfBytes(array $consentSnapshot, array $patient): string
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

        return self::buildFallbackPdf($html);
    }

    private static function generateHistoryExportPdfBytes(array $store, array $snapshot, array $patient): string
    {
        $resolvedPatient = self::resolvePortalPatientProfile($store, $snapshot, $patient);
        $consultations = self::buildPortalHistory($store, $snapshot, $resolvedPatient);
        $html = self::buildHistoryExportHtml($resolvedPatient, $snapshot, $consultations);

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

        return self::buildFallbackPdf($html);
    }

    private static function buildHistoryExportHtml(array $patient, array $snapshot, array $consultations): string
    {
        $clinicProfile = read_clinic_profile();
        $clinicName = self::escapeHtml(self::firstNonEmptyString(
            (string) ($clinicProfile['clinicName'] ?? ''),
            'Aurora Derm'
        ));
        $patientName = self::escapeHtml(self::buildPatientDisplayName($patient));
        $patientDocument = self::escapeHtml(self::firstNonEmptyString(
            (string) ($patient['ci'] ?? ''),
            (string) ($patient['cedula'] ?? ''),
            (string) ($patient['identification'] ?? ''),
            (string) ($patient['documentNumber'] ?? '')
        ));
        $patientPhone = self::escapeHtml(self::firstNonEmptyString(
            (string) ($patient['phone'] ?? ''),
            (string) ($snapshot['phone'] ?? '')
        ));
        $patientId = self::escapeHtml(self::firstNonEmptyString(
            (string) ($snapshot['patientId'] ?? ''),
            (string) ($patient['patientId'] ?? '')
        ));
        $generatedAtLabel = self::escapeHtml(self::buildPortalDateTimeLabel((string) local_date('c'), 'Generado ahora'));
        $consultationCount = count($consultations);

        $consultationBlocks = '';
        foreach ($consultations as $consultation) {
            if (!is_array($consultation)) {
                continue;
            }

            $consultationBlocks .= self::buildHistoryExportConsultationHtml($consultation);
        }

        if ($consultationBlocks === '') {
            $consultationBlocks = '
            <div class="section">
                <strong>Sin atenciones visibles</strong>
                <p>Al momento de exportar todavía no existen consultas visibles dentro del portal del paciente.</p>
            </div>';
        }

        return '
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="utf-8">
            <title>Historia clínica exportada</title>
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
                .section p { margin: 0 0 10px; line-height: 1.65; }
                .section p:last-child { margin-bottom: 0; }
                .muted { color: #64748b; }
                .footer { margin-top: 20px; padding-top: 14px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>' . $clinicName . '</h1>
                <p>Exportación de historia clínica visible en el portal del paciente.</p>
            </div>
            <div class="hero">
                <span>Historia clínica propia</span>
            </div>
            <div class="meta">
                <div class="meta-grid">
                    <div>
                        <strong>Paciente</strong>
                        <span>' . $patientName . '</span>
                    </div>
                    <div>
                        <strong>Consultas incluidas</strong>
                        <span>' . self::escapeHtml((string) $consultationCount) . '</span>
                    </div>
                    ' . ($patientDocument !== '' ? '
                    <div>
                        <strong>Documento</strong>
                        <span>' . $patientDocument . '</span>
                    </div>' : '') . '
                    ' . ($patientPhone !== '' ? '
                    <div>
                        <strong>Teléfono</strong>
                        <span>' . $patientPhone . '</span>
                    </div>' : '') . '
                    ' . ($patientId !== '' ? '
                    <div>
                        <strong>ID de paciente</strong>
                        <span>' . $patientId . '</span>
                    </div>' : '') . '
                    <div>
                        <strong>Generado</strong>
                        <span>' . $generatedAtLabel . '</span>
                    </div>
                </div>
            </div>
            <div class="section">
                <strong>Alcance del documento</strong>
                <p>Este PDF consolida las consultas, eventos clínicos y estados documentales visibles para el paciente dentro del portal de Aurora Derm.</p>
            </div>
            ' . $consultationBlocks . '
            <div class="footer">Documento generado automáticamente desde el portal del paciente Aurora Derm.</div>
        </body>
        </html>';
    }

    private static function buildHistoryExportConsultationHtml(array $consultation): string
    {
        $serviceName = self::escapeHtml(self::firstNonEmptyString(
            (string) ($consultation['serviceName'] ?? ''),
            'Atención Aurora Derm'
        ));
        $statusLabel = self::escapeHtml(self::firstNonEmptyString(
            (string) ($consultation['statusLabel'] ?? ''),
            'Consulta registrada'
        ));
        $dateLabel = self::escapeHtml(self::firstNonEmptyString(
            (string) ($consultation['dateLabel'] ?? ''),
            'Fecha por confirmar'
        ));
        $timeLabel = self::escapeHtml(trim((string) ($consultation['timeLabel'] ?? '')));
        $doctorName = self::escapeHtml(self::firstNonEmptyString(
            (string) ($consultation['doctorName'] ?? ''),
            'Equipo clínico Aurora Derm'
        ));
        $appointmentTypeLabel = self::escapeHtml(trim((string) ($consultation['appointmentTypeLabel'] ?? '')));
        $locationLabel = self::escapeHtml(trim((string) ($consultation['locationLabel'] ?? '')));

        $metaParts = array_values(array_filter([
            $statusLabel,
            $dateLabel,
            $timeLabel,
            $doctorName,
            $appointmentTypeLabel,
            $locationLabel,
        ], static fn ($value): bool => trim((string) $value) !== ''));

        $eventLines = '';
        foreach (($consultation['events'] ?? []) as $event) {
            if (!is_array($event)) {
                continue;
            }

            $label = self::escapeHtml(trim((string) ($event['label'] ?? '')));
            if ($label === '') {
                continue;
            }

            $meta = self::escapeHtml(trim((string) ($event['meta'] ?? '')));
            $eventLines .= '<p><strong>' . $label . '</strong>' . ($meta !== '' ? ' — ' . $meta : '') . '</p>';
        }

        if ($eventLines === '') {
            $eventLines = '<p class="muted">No hay eventos adicionales visibles para esta consulta.</p>';
        }

        $documentLines = '';
        foreach (($consultation['documents'] ?? []) as $document) {
            if (!is_array($document)) {
                continue;
            }

            $title = self::escapeHtml(self::firstNonEmptyString(
                (string) ($document['title'] ?? ''),
                'Documento clínico'
            ));
            $status = self::escapeHtml(self::firstNonEmptyString(
                (string) ($document['statusLabel'] ?? ''),
                'Sin estado'
            ));
            $description = self::escapeHtml(trim((string) ($document['description'] ?? '')));
            $issuedAt = self::escapeHtml(trim((string) ($document['issuedAtLabel'] ?? '')));

            $line = '<p><strong>' . $title . '</strong> — ' . $status;
            if ($issuedAt !== '') {
                $line .= ' · ' . $issuedAt;
            }
            $line .= '</p>';
            if ($description !== '') {
                $line .= '<p class="muted">' . $description . '</p>';
            }

            $documentLines .= $line;
        }

        if ($documentLines === '') {
            $documentLines = '<p class="muted">No hay documentos visibles para esta consulta.</p>';
        }

        return '
        <div class="section">
            <strong>' . $serviceName . '</strong>
            <p>' . self::escapeHtml(implode(' · ', $metaParts)) . '</p>
            <p><strong>Eventos clínicos</strong></p>
            ' . $eventLines . '
            <p><strong>Documentos visibles</strong></p>
            ' . $documentLines . '
        </div>';
    }

    private static function buildConsentHtml(array $consentSnapshot, array $patient): string
    {
        $clinicProfile = read_clinic_profile();
        $patientName = self::escapeHtml(self::firstNonEmptyString(
            (string) ($consentSnapshot['patientAttestation']['name'] ?? ''),
            (string) ($consentSnapshot['patientName'] ?? ''),
            self::buildPatientDisplayName($patient)
        ));
        $patientDocument = self::escapeHtml(self::firstNonEmptyString(
            (string) ($consentSnapshot['patientAttestation']['documentNumber'] ?? ''),
            (string) ($consentSnapshot['patientDocumentNumber'] ?? ''),
            (string) ($patient['ci'] ?? '')
        ));
        $procedureName = self::escapeHtml(self::firstNonEmptyString(
            (string) ($consentSnapshot['procedureName'] ?? ''),
            (string) ($consentSnapshot['procedureLabel'] ?? ''),
            'Procedimiento dermatológico'
        ));
        $diagnosis = self::escapeHtml((string) ($consentSnapshot['diagnosisLabel'] ?? ''));
        $serviceLabel = self::escapeHtml((string) ($consentSnapshot['serviceLabel'] ?? ''));
        $establishmentLabel = self::escapeHtml(self::firstNonEmptyString(
            (string) ($consentSnapshot['establishmentLabel'] ?? ''),
            (string) ($clinicProfile['clinicName'] ?? ''),
            'Aurora Derm'
        ));
        $encounterDateLabel = self::escapeHtml(self::buildPortalDateTimeLabel(
            (string) ($consentSnapshot['encounterDateTime'] ?? ''),
            'Fecha por confirmar'
        ));
        $durationEstimate = self::escapeHtml((string) ($consentSnapshot['durationEstimate'] ?? ''));
        $whatIsIt = self::escapeHtml((string) ($consentSnapshot['procedureWhatIsIt'] ?? ''));
        $howItIsDone = self::escapeHtml((string) ($consentSnapshot['procedureHowItIsDone'] ?? ''));
        $benefits = self::escapeHtml((string) ($consentSnapshot['benefits'] ?? ''));
        $frequentRisks = self::escapeHtml((string) ($consentSnapshot['frequentRisks'] ?? ''));
        $rareSeriousRisks = self::escapeHtml((string) ($consentSnapshot['rareSeriousRisks'] ?? ''));
        $alternatives = self::escapeHtml((string) ($consentSnapshot['alternatives'] ?? ''));
        $aftercare = self::escapeHtml((string) ($consentSnapshot['postProcedureCare'] ?? ''));
        $doctorName = self::escapeHtml(self::firstNonEmptyString(
            (string) ($consentSnapshot['professionalAttestation']['name'] ?? ''),
            'Equipo clínico Aurora Derm'
        ));
        $doctorRole = self::escapeHtml(self::humanizeValue(
            (string) ($consentSnapshot['professionalAttestation']['role'] ?? 'medico_tratante'),
            'Médico tratante'
        ));
        $signedAtLabel = self::escapeHtml(self::buildPortalDateTimeLabel(
            (string) ($consentSnapshot['patientAttestation']['signedAt'] ?? ''),
            'Firma digital archivada'
        ));
        $signatureDataUrl = self::escapeHtml((string) ($consentSnapshot['patientAttestation']['signatureDataUrl'] ?? ''));
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

    private static function firstNonEmptyString(string ...$values): string
    {
        foreach ($values as $value) {
            $value = trim($value);
            if ($value !== '') {
                return $value;
            }
        }

        return '';
    }

    private static function emitPdfResponse(string $pdfBytes, string $fileName): void
    {
        if (defined('TESTING_ENV')) {
            $payload = [
                'ok' => true,
                'format' => 'pdf',
                'filename' => $fileName,
                'contentType' => 'application/pdf',
                'contentLength' => strlen($pdfBytes),
                'binary' => $pdfBytes,
            ];
            $GLOBALS['__TEST_RESPONSE'] = ['payload' => $payload, 'status' => 200];
            if (!defined('TESTING_FORCE_EXIT')) {
                throw new TestingExitException($payload, 200);
            }
        }

        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="' . $fileName . '"');
        header('Content-Length: ' . strlen($pdfBytes));
        header('Cache-Control: private, max-age=3600');
        echo $pdfBytes;
        exit;
    }

    private static function generateCertificatePdfBytes(array $certificate, array $patient): string
    {
        $html = self::buildCertificateHtml($certificate, $patient);

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

        return self::buildFallbackPdf($html);
    }

    private static function buildCertificateHtml(array $certificate, array $patient): string
    {
        $clinicProfile = read_clinic_profile();
        $doctor = function_exists('doctor_profile_document_fields')
            ? doctor_profile_document_fields(
                isset($certificate['doctor']) && is_array($certificate['doctor'])
                    ? $certificate['doctor']
                    : ['name' => (string) ($certificate['issued_by'] ?? 'Medico tratante')]
            )
            : (is_array($certificate['doctor'] ?? null) ? $certificate['doctor'] : []);

        $certificatePatient = is_array($certificate['patient'] ?? null) ? $certificate['patient'] : [];
        $patientName = self::escapeHtml(self::firstNonEmptyString(
            trim((string) ($certificatePatient['name'] ?? '')),
            trim((string) (($certificatePatient['firstName'] ?? '') . ' ' . ($certificatePatient['lastName'] ?? ''))),
            trim((string) (($patient['firstName'] ?? '') . ' ' . ($patient['lastName'] ?? ''))),
            trim((string) ($patient['name'] ?? '')),
            'Paciente Aurora Derm'
        ));
        $patientId = self::escapeHtml(self::firstNonEmptyString(
            (string) ($certificatePatient['identification'] ?? ''),
            (string) ($certificatePatient['ci'] ?? ''),
            (string) ($patient['ci'] ?? ''),
            (string) ($patient['cedula'] ?? ''),
            (string) ($patient['identification'] ?? '')
        ));
        $doctorName = self::escapeHtml(self::firstNonEmptyString(
            (string) ($doctor['name'] ?? ''),
            (string) ($certificate['issued_by'] ?? ''),
            'Médico tratante'
        ));
        $doctorSpecialty = self::escapeHtml((string) ($doctor['specialty'] ?? ''));
        $doctorMsp = self::escapeHtml((string) ($doctor['msp'] ?? ''));
        $signatureImage = self::escapeHtml((string) ($doctor['signatureImage'] ?? ''));
        $signatureHtml = $signatureImage !== ''
            ? '<img src="' . $signatureImage . '" alt="Firma digital" style="max-width:220px; max-height:80px; display:block; margin-left:auto; margin-bottom:12px; object-fit:contain;">'
            : '';
        $clinicName = self::escapeHtml(self::firstNonEmptyString(
            (string) ($certificate['clinicName'] ?? ''),
            (string) ($clinicProfile['clinicName'] ?? ''),
            'Aurora Derm'
        ));
        $clinicAddress = self::escapeHtml(self::firstNonEmptyString(
            (string) ($certificate['clinicAddress'] ?? ''),
            (string) ($clinicProfile['address'] ?? ''),
            'Quito, Ecuador'
        ));
        $clinicPhone = self::escapeHtml(self::firstNonEmptyString(
            (string) ($certificate['clinicPhone'] ?? ''),
            (string) ($clinicProfile['phone'] ?? '')
        ));
        $typeLabel = self::escapeHtml(self::firstNonEmptyString(
            (string) ($certificate['typeLabel'] ?? ''),
            self::humanizeValue((string) ($certificate['type'] ?? ''), 'Certificado médico')
        ));
        $diagnosis = self::escapeHtml(self::firstNonEmptyString(
            (string) ($certificate['diagnosisText'] ?? ''),
            (string) ($certificate['diagnosis_text'] ?? ''),
            'Sin diagnóstico consignado'
        ));
        $cie10 = self::escapeHtml(self::firstNonEmptyString(
            (string) ($certificate['cie10Code'] ?? ''),
            (string) ($certificate['cie10_code'] ?? '')
        ));
        $restDays = max(
            0,
            (int) self::firstNonEmptyString(
                (string) ($certificate['restDays'] ?? ''),
                (string) ($certificate['rest_days'] ?? '0')
            )
        );
        $restrictions = self::escapeHtml(self::firstNonEmptyString(
            (string) ($certificate['restrictions'] ?? ''),
            'Sin restricciones adicionales'
        ));
        $observations = self::escapeHtml((string) ($certificate['observations'] ?? ''));
        $issuedAt = self::firstNonEmptyString(
            (string) ($certificate['issuedDateLocal'] ?? ''),
            (string) ($certificate['issuedAt'] ?? ''),
            (string) ($certificate['issued_at'] ?? '')
        );
        $issuedDateLabel = self::escapeHtml(self::buildCaseDateLabel($issuedAt));

        return '
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="utf-8">
            <title>Certificado médico</title>
            <style>
                body { font-family: Helvetica, Arial, sans-serif; margin: 0; padding: 42px; color: #111827; }
                .header { border-bottom: 2px solid #248a65; padding-bottom: 16px; margin-bottom: 28px; }
                .header h1 { margin: 0 0 6px; font-size: 24px; }
                .header p { margin: 0; color: #475569; font-size: 13px; }
                .hero { margin-bottom: 22px; }
                .hero span { display: inline-block; padding: 6px 12px; border-radius: 999px; background: #ecfdf5; color: #166534; font-size: 12px; font-weight: bold; letter-spacing: 0.03em; text-transform: uppercase; }
                .patient-box, .detail-box { border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px; margin-bottom: 18px; background: #f8fafc; }
                .patient-box strong, .detail-box strong { display: block; margin-bottom: 10px; font-size: 13px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; }
                .detail-box p { margin: 0 0 10px; line-height: 1.6; }
                .signature { margin-top: 40px; text-align: right; }
                .signature-line { border-top: 1px solid #0f172a; width: 220px; display: inline-block; margin-bottom: 8px; }
                .footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>' . $clinicName . '</h1>
                <p>' . $clinicAddress . ($clinicPhone !== '' ? ' · ' . $clinicPhone : '') . '</p>
            </div>
            <div class="hero">
                <span>' . $typeLabel . '</span>
            </div>
            <div class="patient-box">
                <strong>Paciente</strong>
                <p><b>Nombre:</b> ' . $patientName . '</p>
                ' . ($patientId !== '' ? '<p><b>Identificación:</b> ' . $patientId . '</p>' : '') . '
                <p><b>Fecha de emisión:</b> ' . $issuedDateLabel . '</p>
            </div>
            <div class="detail-box">
                <strong>Detalle clínico</strong>
                <p><b>Diagnóstico:</b> ' . $diagnosis . '</p>
                ' . ($cie10 !== '' ? '<p><b>CIE-10:</b> ' . $cie10 . '</p>' : '') . '
                ' . ($restDays > 0 ? '<p><b>Días de reposo:</b> ' . self::escapeHtml((string) $restDays) . '</p>' : '') . '
                <p><b>Restricciones:</b> ' . $restrictions . '</p>
                ' . ($observations !== '' ? '<p><b>Observaciones:</b> ' . $observations . '</p>' : '') . '
            </div>
            <div class="signature">
                ' . $signatureHtml . '
                <div class="signature-line"></div>
                <div><strong>' . $doctorName . '</strong></div>
                ' . ($doctorSpecialty !== '' ? '<div>' . $doctorSpecialty . '</div>' : '') . '
                ' . ($doctorMsp !== '' ? '<div>Registro MSP: ' . $doctorMsp . '</div>' : '') . '
            </div>
            <div class="footer">Documento generado desde el portal del paciente Aurora Derm.</div>
        </body>
        </html>';
    }

    private static function buildFallbackPdf(string $html): string
    {
        $text = strip_tags(str_replace(['<br>', '</div>', '</p>', '</h1>', '</h2>', '</strong>'], "\n", $html));
        if (function_exists('mb_convert_encoding')) {
            $text = mb_convert_encoding(trim($text), 'ISO-8859-1', 'UTF-8');
        } else {
            $text = trim($text);
        }

        $lines = [];
        $lines[] = '%PDF-1.4';
        $lines[] = '1 0 obj<< /Type /Catalog /Pages 2 0 R >> endobj';
        $lines[] = '2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >> endobj';
        $lines[] = '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj';

        $content = "BT\n/F1 12 Tf\n20 800 Td\n15 TL\n";
        foreach (explode("\n", $text) as $rawLine) {
            $line = trim($rawLine);
            if ($line === '') {
                $content .= "T*\n";
                continue;
            }

            $clean = strtr($line, ['\\' => '\\\\', '(' => '\\(', ')' => '\\)']);
            $content .= '(' . $clean . ") Tj T*\n";
        }
        $content .= "ET";

        $length = strlen($content);
        $lines[] = "4 0 obj<< /Length {$length} >>\nstream\n{$content}\nendstream\nendobj";
        $lines[] = '5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj';

        $pdf = implode("\n", $lines);
        $pdf .= "\nxref\n0 6\n0000000000 65535 f \n";
        $pdf .= "trailer<</Size 6/Root 1 0 R>>\nstartxref\n9\n%%EOF";
        return $pdf;
    }

    private static function escapeHtml(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
    }

    private static function appointmentMatchesPatient(array $appointment, array $snapshot): bool
    {
        $patientId = trim((string) ($snapshot['patientId'] ?? ''));
        if ($patientId !== '' && $patientId === trim((string) ($appointment['patientId'] ?? ''))) {
            return true;
        }

        $patientCaseId = trim((string) ($snapshot['patientCaseId'] ?? ''));
        if ($patientCaseId !== '' && $patientCaseId === trim((string) ($appointment['patientCaseId'] ?? ''))) {
            return true;
        }

        $lastAppointmentId = (int) ($snapshot['lastAppointmentId'] ?? 0);
        if ($lastAppointmentId > 0 && $lastAppointmentId === (int) ($appointment['id'] ?? 0)) {
            return true;
        }

        $phone = trim((string) ($snapshot['phone'] ?? ''));
        if ($phone !== '' && PatientPortalAuth::matchesPatientPhone((string) ($appointment['phone'] ?? ''), $phone)) {
            return true;
        }

        return false;
    }

    private static function appointmentTimestamp(array $appointment): ?int
    {
        $date = trim((string) ($appointment['date'] ?? ''));
        $time = trim((string) ($appointment['time'] ?? ''));
        if ($date === '' || $time === '') {
            return null;
        }

        $timestamp = strtotime($date . ' ' . $time);
        return $timestamp === false ? null : $timestamp;
    }

    private static function buildAppointmentSummary(array $appointment, array $patient): array
    {
        $serviceId = trim((string) ($appointment['service'] ?? ''));
        $tenantId = trim((string) ($appointment['tenantId'] ?? ''));
        $serviceConfig = $serviceId !== '' ? get_service_config($serviceId, $tenantId !== '' ? $tenantId : null) : null;
        $typeKey = self::resolveAppointmentTypeKey($appointment, $serviceConfig);
        $rescheduleToken = trim((string) ($appointment['rescheduleToken'] ?? ''));
        // Prefer explicit serviceName if already resolved (e.g. by normalize_appointment or fixture).
        $explicitServiceName = trim((string) ($appointment['serviceName'] ?? ''));
        if ($explicitServiceName !== '') {
            $serviceName = $explicitServiceName;
        } else {
            $serviceName = is_array($serviceConfig)
                ? trim((string) ($serviceConfig['name'] ?? ''))
                : self::humanizeValue($serviceId, 'Consulta Aurora Derm');
        }

        return [
            'id' => (int) ($appointment['id'] ?? 0),
            'status' => function_exists('map_appointment_status')
                ? map_appointment_status((string) ($appointment['status'] ?? 'confirmed'))
                : trim((string) ($appointment['status'] ?? 'confirmed')),
            'date' => trim((string) ($appointment['date'] ?? '')),
            'dateLabel' => self::buildDateLabel((string) ($appointment['date'] ?? '')),
            'time' => trim((string) ($appointment['time'] ?? '')),
            'timeLabel' => self::buildTimeLabel((string) ($appointment['time'] ?? '')),
            'doctorName' => self::formatDoctorName(
                (string) ($appointment['doctorAssigned'] ?? ''),
                (string) ($appointment['doctorRequested'] ?? ''),
                (string) ($appointment['doctor'] ?? '')
            ),
            'appointmentType' => $typeKey,
            'appointmentTypeLabel' => self::resolveAppointmentTypeLabel($appointment, $serviceConfig),
            'locationLabel' => self::resolveLocationLabel($appointment, $serviceConfig),
            'serviceId' => $serviceId,
            'serviceName' => $serviceName,
            'preparation' => self::resolvePreparationRequired($appointment, $serviceConfig),
            'rescheduleUrl' => self::buildRescheduleUrl($rescheduleToken),
            'roomUrl' => $typeKey === 'telemedicine'
                ? self::buildTelemedicineRoomUrl((int) ($appointment['id'] ?? 0), $rescheduleToken)
                : '',
            'preConsultationUrl' => $typeKey === 'telemedicine'
                ? self::buildTelemedicinePreConsultationUrl((int) ($appointment['id'] ?? 0), $rescheduleToken)
                : '',
            'telemedicinePreConsultation' => isset($appointment['telemedicinePreConsultation']) && is_array($appointment['telemedicinePreConsultation'])
                ? $appointment['telemedicinePreConsultation']
                : [],
            'whatsappUrl' => self::buildSupportWhatsappUrl($patient, $appointment),
        ];
    }

    private static function buildRescheduleUrl(string $token): string
    {
        $token = trim($token);
        return $token !== '' ? '/?reschedule=' . rawurlencode($token) : '';
    }

    private static function buildSupportWhatsappUrl(array $patient, array $appointment): string
    {
        $digits = preg_replace('/\D+/', '', AppConfig::WHATSAPP_NUMBER);
        if (!is_string($digits) || $digits === '') {
            return '';
        }

        $patientName = trim((string) ($patient['name'] ?? 'Paciente'));
        $serviceName = self::humanizeValue((string) ($appointment['service'] ?? ''), 'mi cita');
        $date = trim((string) ($appointment['date'] ?? ''));
        $time = trim((string) ($appointment['time'] ?? ''));

        $parts = ['Hola, necesito ayuda con mi cita del portal Aurora Derm.'];
        if ($patientName !== '') {
            $parts[] = 'Paciente: ' . $patientName . '.';
        }
        if ($serviceName !== 'mi cita' || $date !== '' || $time !== '') {
            $parts[] = 'Referencia: ' . trim($serviceName . ' ' . $date . ' ' . $time) . '.';
        }

        return 'https://wa.me/' . $digits . '?text=' . rawurlencode(implode(' ', $parts));
    }

    private static function buildTelemedicineRoomUrl(int $appointmentId, string $token): string
    {
        if ($token !== '') {
            return '/es/telemedicina/sala/index.html?token=' . rawurlencode($token);
        }
        if ($appointmentId > 0) {
            return '/es/telemedicina/sala/index.html?id=' . rawurlencode((string) $appointmentId);
        }

        return '/es/telemedicina/sala/index.html';
    }

    private static function buildTelemedicinePreConsultationUrl(int $appointmentId, string $token): string
    {
        if ($token !== '') {
            return '/es/telemedicina/pre-consulta/?token=' . rawurlencode($token);
        }
        if ($appointmentId > 0) {
            return '/es/telemedicina/pre-consulta/?id=' . rawurlencode((string) $appointmentId);
        }

        return '/es/telemedicina/pre-consulta/';
    }

    private static function resolveAppointmentTypeKey(array $appointment, ?array $serviceConfig): string
    {
        $visitMode = strtolower(trim((string) ($appointment['visitMode'] ?? '')));
        $telemedicineChannel = strtolower(trim((string) ($appointment['telemedicineChannel'] ?? '')));
        $serviceCategory = strtolower(trim((string) ($serviceConfig['category'] ?? '')));
        $serviceId = strtolower(trim((string) ($appointment['service'] ?? '')));

        if (
            str_contains($visitMode, 'tele')
            || str_contains($visitMode, 'video')
            || str_contains($telemedicineChannel, 'video')
            || str_contains($telemedicineChannel, 'tele')
            || in_array($serviceCategory, ['telemedicina'], true)
            || in_array($serviceId, ['video', 'telefono'], true)
        ) {
            return 'telemedicine';
        }

        return 'in_person';
    }

    private static function resolveAppointmentTypeLabel(array $appointment, ?array $serviceConfig): string
    {
        if (self::resolveAppointmentTypeKey($appointment, $serviceConfig) === 'telemedicine') {
            return 'Teleconsulta';
        }

        $serviceCategory = strtolower(trim((string) ($serviceConfig['category'] ?? '')));
        if (in_array($serviceCategory, ['procedimiento', 'estetico'], true)) {
            return 'Procedimiento presencial';
        }

        return 'Consulta presencial';
    }

    private static function resolveLocationLabel(array $appointment, ?array $serviceConfig): string
    {
        if (self::resolveAppointmentTypeKey($appointment, $serviceConfig) === 'telemedicine') {
            return 'Atencion virtual por enlace seguro';
        }

        return 'Consultorio Aurora Derm';
    }

    private static function resolvePreparationRequired(array $appointment, ?array $serviceConfig): string
    {
        $serviceId = strtolower(trim((string) ($appointment['service'] ?? '')));
        $catalogPreparation = service_catalog_preparation_for($serviceId);
        if ($catalogPreparation !== '') {
            return $catalogPreparation;
        }

        $serviceName = strtolower(trim((string) ($serviceConfig['name'] ?? '')));
        $serviceCategory = strtolower(trim((string) ($serviceConfig['category'] ?? '')));
        $typeKey = self::resolveAppointmentTypeKey($appointment, $serviceConfig);
        $haystack = $serviceId . ' ' . $serviceName;

        if ($typeKey === 'telemedicine') {
            return 'Ten tu celular con buena conexion, fotos de apoyo y resultados recientes a la mano 10 minutos antes.';
        }

        if (str_contains($haystack, 'laser')) {
            return 'Llega con la piel limpia, evita bronceado reciente y no apliques cremas irritantes en la zona el mismo dia.';
        }

        if (
            str_contains($haystack, 'botox')
            || str_contains($haystack, 'peeling')
            || $serviceCategory === 'estetico'
            || $serviceCategory === 'procedimiento'
        ) {
            return 'Llega sin maquillaje en la zona a tratar y avisa si usaste retinoides, exfoliantes o recibiste otro procedimiento reciente.';
        }

        return 'Llega 10 minutos antes y trae tus medicamentos, examenes o fotos previas si ayudan a explicar la evolucion.';
    }

    private static function formatDoctorName(string ...$candidates): string
    {
        foreach ($candidates as $candidate) {
            $candidate = trim($candidate);
            if ($candidate === '') {
                continue;
            }

            $candidate = str_replace(['_', '-'], ' ', $candidate);
            if (function_exists('mb_convert_case')) {
                return mb_convert_case($candidate, MB_CASE_TITLE, 'UTF-8');
            }

            return ucwords(strtolower($candidate));
        }

        return 'Especialista Aurora Derm';
    }

    private static function buildDateLabel(string $date): string
    {
        $timestamp = strtotime(trim($date) . ' 00:00:00');
        if ($timestamp === false) {
            return trim($date);
        }

        $days = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
        $months = [
            1 => 'ene',
            2 => 'feb',
            3 => 'mar',
            4 => 'abr',
            5 => 'may',
            6 => 'jun',
            7 => 'jul',
            8 => 'ago',
            9 => 'sep',
            10 => 'oct',
            11 => 'nov',
            12 => 'dic',
        ];

        $dayLabel = $days[(int) date('w', $timestamp)] ?? '';
        $monthLabel = $months[(int) date('n', $timestamp)] ?? trim((string) date('m', $timestamp));

        return trim(sprintf(
            '%s %s %s %s',
            $dayLabel,
            date('j', $timestamp),
            $monthLabel,
            date('Y', $timestamp)
        ));
    }

    private static function buildTimeLabel(string $time): string
    {
        $time = trim($time);
        if ($time === '') {
            return 'Por confirmar';
        }

        if (preg_match('/^\d{2}:\d{2}/', $time) === 1) {
            return substr($time, 0, 5);
        }

        return $time;
    }

    private static function humanizeValue(string $value, string $fallback): string
    {
        $value = trim($value);
        if ($value === '') {
            return $fallback;
        }

        $value = str_replace(['_', '-'], ' ', $value);
        if (function_exists('mb_convert_case')) {
            return mb_convert_case($value, MB_CASE_TITLE, 'UTF-8');
        }

        return ucwords(strtolower($value));
    }

    private static function portalPhotoBelongsToCaseMap(array $upload, array $caseMap): bool
    {
        $caseId = self::firstNonEmptyString(
            (string) ($upload['patientCaseId'] ?? ''),
            (string) ($upload['clinicalHistoryCaseId'] ?? ''),
            (string) ($upload['caseId'] ?? '')
        );

        if ($caseId === '' || !isset($caseMap[$caseId])) {
            return false;
        }

        return strtolower(trim((string) ($upload['kind'] ?? ''))) === 'case_photo';
    }

    private static function isPortalVisiblePhoto(array $upload): bool
    {
        $directFlags = [
            $upload['visibleToPatient'] ?? null,
            $upload['visible_to_patient'] ?? null,
            $upload['patientVisible'] ?? null,
            $upload['portalVisible'] ?? null,
            $upload['portal_visible'] ?? null,
            $upload['sharedWithPatient'] ?? null,
            $upload['showInPortal'] ?? null,
            $upload['patientPortalVisible'] ?? null,
        ];

        foreach ($directFlags as $flag) {
            $normalized = self::normalizePortalVisibilityFlag($flag);
            if ($normalized !== null) {
                return $normalized;
            }
        }

        foreach (['visibility', 'sharing', 'portal', 'patientPortal'] as $containerKey) {
            $container = is_array($upload[$containerKey] ?? null) ? $upload[$containerKey] : [];
            foreach (['patient', 'portal', 'visible', 'patientVisible', 'visibleToPatient'] as $nestedKey) {
                $normalized = self::normalizePortalVisibilityFlag($container[$nestedKey] ?? null);
                if ($normalized !== null) {
                    return $normalized;
                }
            }
        }

        return false;
    }

    private static function normalizePortalVisibilityFlag($value): ?bool
    {
        if (is_bool($value)) {
            return $value;
        }

        if (is_int($value) || is_float($value)) {
            return ((int) $value) === 1;
        }

        if (!is_string($value)) {
            return null;
        }

        $normalized = strtolower(trim($value));
        if ($normalized === '') {
            return null;
        }

        if (in_array($normalized, ['1', 'true', 'yes', 'si', 'visible', 'shared', 'show'], true)) {
            return true;
        }

        if (in_array($normalized, ['0', 'false', 'no', 'hidden', 'private', 'internal'], true)) {
            return false;
        }

        return null;
    }

    private static function normalizePortalPhotoItem(array $upload): ?array
    {
        $id = trim((string) ($upload['id'] ?? ''));
        if ($id === '') {
            return null;
        }

        $createdAt = trim((string) ($upload['createdAt'] ?? $upload['updatedAt'] ?? ''));
        $timestamp = self::recordTimestamp([
            'createdAt' => $createdAt,
            'updatedAt' => (string) ($upload['updatedAt'] ?? ''),
        ]);
        $bodyZone = trim((string) ($upload['bodyZone'] ?? $upload['body_zone'] ?? ''));
        $bodyZoneLabel = self::humanizeValue($bodyZone, 'Seguimiento general');
        $photoRole = trim((string) ($upload['photoRole'] ?? ''));
        $photoRoleLabel = trim((string) ($upload['photoRoleLabel'] ?? self::humanizeValue($photoRole, '')));
        $createdAtLabel = self::buildPortalDateTimeLabel(
            $createdAt,
            $timestamp > 0 ? self::buildDateLabel(date('Y-m-d', $timestamp)) : 'Sin fecha'
        );

        return [
            'id' => $id,
            'bodyZone' => $bodyZone !== '' ? $bodyZone : 'general',
            'bodyZoneLabel' => $bodyZoneLabel,
            'createdAt' => $createdAt,
            'createdAtLabel' => $createdAtLabel,
            'dateLabel' => $timestamp > 0 ? self::buildDateLabel(date('Y-m-d', $timestamp)) : '',
            'timeLabel' => $timestamp > 0 ? self::buildTimeLabel(date('H:i', $timestamp)) : '',
            'photoRole' => $photoRole,
            'photoRoleLabel' => $photoRoleLabel,
            'fileName' => trim((string) ($upload['originalName'] ?? ('foto-' . $id . '.jpg'))),
            'imageUrl' => '/api.php?resource=patient-portal-photo-file&id=' . rawurlencode($id),
            'alt' => trim($bodyZoneLabel . ($createdAtLabel !== '' ? ' · ' . $createdAtLabel : '')),
            'sortTimestamp' => $timestamp,
        ];
    }

    private static function findPortalVisiblePhotoUpload(array $store, array $caseIds, string $photoId): ?array
    {
        $caseMap = [];
        foreach ($caseIds as $caseId) {
            $caseId = trim((string) $caseId);
            if ($caseId !== '') {
                $caseMap[$caseId] = true;
            }
        }

        foreach (($store['clinical_uploads'] ?? []) as $upload) {
            if (!is_array($upload)) {
                continue;
            }

            if (trim((string) ($upload['id'] ?? '')) !== $photoId) {
                continue;
            }

            if (!self::portalPhotoBelongsToCaseMap($upload, $caseMap)) {
                return null;
            }

            if (!self::isPortalVisiblePhoto($upload)) {
                return null;
            }

            return $upload;
        }

        return null;
    }

    private static function resolvePortalPhotoAsset(array $upload): array
    {
        $path = self::resolvePortalPhotoDiskPath($upload);
        if ($path === '' || !is_file($path)) {
            return [];
        }

        $mime = self::safePortalMime((string) ($upload['mime'] ?? ''), $path);
        $extension = pathinfo($path, PATHINFO_EXTENSION);
        $fileName = trim((string) ($upload['originalName'] ?? ''));
        if ($fileName === '') {
            $fileName = 'foto-clinica' . ($extension !== '' ? '.' . strtolower($extension) : '.jpg');
        }

        return [
            'path' => $path,
            'contentType' => $mime,
            'fileName' => $fileName,
        ];
    }

    private static function resolvePortalPhotoDiskPath(array $upload): string
    {
        $privatePath = ltrim(str_replace(['\\', '//'], '/', trim((string) ($upload['privatePath'] ?? ''))), '/');
        if ($privatePath !== '') {
            if (str_starts_with($privatePath, 'clinical-media/')) {
                return data_dir_path() . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $privatePath);
            }

            return clinical_media_dir_path() . DIRECTORY_SEPARATOR . basename($privatePath);
        }

        $diskPath = trim((string) ($upload['diskPath'] ?? ''));
        if ($diskPath !== '' && is_file($diskPath)) {
            return $diskPath;
        }

        $legacyPublicPath = trim((string) ($upload['legacyPublicPath'] ?? ''));
        if ($legacyPublicPath !== '' && function_exists('transfer_proof_upload_dir')) {
            return rtrim(transfer_proof_upload_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . basename($legacyPublicPath);
        }

        return '';
    }

    private static function safePortalMime(string $mime, string $path): string
    {
        $mime = trim($mime);
        if ($mime !== '') {
            return $mime;
        }

        if (function_exists('mime_content_type')) {
            $detected = @mime_content_type($path);
            if (is_string($detected) && trim($detected) !== '') {
                return trim($detected);
            }
        }

        return 'application/octet-stream';
    }

    private static function emitBinaryResponse(
        string $bytes,
        string $contentType,
        string $fileName,
        string $disposition = 'inline'
    ): void {
        if (defined('TESTING_ENV')) {
            $payload = [
                'ok' => true,
                'format' => 'binary',
                'filename' => $fileName,
                'contentType' => $contentType,
                'contentLength' => strlen($bytes),
                'binary' => $bytes,
            ];
            $GLOBALS['__TEST_RESPONSE'] = ['payload' => $payload, 'status' => 200];
            if (!defined('TESTING_FORCE_EXIT')) {
                throw new TestingExitException($payload, 200);
            }
        }

        header('Content-Type: ' . $contentType);
        header('Content-Disposition: ' . $disposition . '; filename="' . $fileName . '"');
        header('Content-Length: ' . strlen($bytes));
        header('Cache-Control: private, max-age=3600');
        echo $bytes;
        exit;
    }

    private static function emit(array $result): void
    {
        if (($result['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'No se pudo completar la autenticacion del portal'),
                'code' => (string) ($result['code'] ?? 'patient_portal_error'),
            ], (int) ($result['status'] ?? 500));
        }

        json_response([
            'ok' => true,
            'data' => is_array($result['data'] ?? null) ? $result['data'] : [],
        ]);
    }
}
