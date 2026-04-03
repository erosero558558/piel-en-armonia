<?php

declare(strict_types=1);

class PatientPortalDocumentController
{
    public static function document(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];
        $bearer = PatientPortalAuth::bearerTokenFromRequest();
        $getSession = function() use ($store, $bearer) {
            if ($bearer === '' && isset($_GET['t']) && is_string($_GET['t'])) {
                return PatientPortalAuth::authenticateDownloadToken($store, trim($_GET['t']));
            }
            return PatientPortalAuth::authenticateSession($store, $bearer);
        };

        $session = $getSession();

        if (($session['ok'] ?? false) !== true) {
            if ($bearer === '' && isset($_GET['t'])) {
                // Return a friendly HTML error since it's a direct browser redirect
                echo "Enlace de descarga caducado o inválido.";
                exit;
            }
            PatientPortalController::emit($session);
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
        $caseIds = PatientPortalController::collectPatientCaseIds($store, $snapshot);

        if ($type === 'history') {
            $expectedDocumentId = self::buildHistoryExportId($snapshot, $portalPatient);
            if ($expectedDocumentId === '' || $documentId !== $expectedDocumentId) {
                json_response(['ok' => false, 'error' => 'Documento no disponible para esta sesión'], 404);
            }

            $pdfBytes = self::generateHistoryExportPdfBytes($store, $snapshot, $portalPatient);
            PatientPortalController::emitPdfResponse($pdfBytes, self::buildHistoryExportFileName($portalPatient, $snapshot));
            return;
        }

        if ($type === 'prescription') {
            $prescription = self::findPrescriptionById($store, $documentId);
            $caseId = trim((string) ($prescription['caseId'] ?? ''));

            if (!is_array($prescription) || !PatientPortalController::caseBelongsToPortalPatient($caseId, $caseIds, $snapshot)) {
                json_response(['ok' => false, 'error' => 'Documento no disponible para esta sesión'], 404);
            }

            $patient = PatientPortalController::resolveCasePatient($store, $caseId);
            $pdfBytes = PrescriptionPdfRenderer::generatePdfBytes(
                $prescription,
                $patient,
                read_clinic_profile()
            );

            PatientPortalController::emitPdfResponse($pdfBytes, self::buildPrescriptionFileName($documentId));
            return;
        }

        if ($type === 'certificate') {
            $certificate = self::findCertificateById($store, $documentId);
            $caseId = trim((string) ($certificate['caseId'] ?? ''));

            if (!is_array($certificate) || !PatientPortalController::caseBelongsToPortalPatient($caseId, $caseIds, $snapshot)) {
                json_response(['ok' => false, 'error' => 'Documento no disponible para esta sesión'], 404);
            }

            $patient = PatientPortalController::resolveCasePatient($store, $caseId);
            $pdfBytes = self::generateCertificatePdfBytes($certificate, $patient);

            PatientPortalController::emitPdfResponse($pdfBytes, self::buildCertificateFileName($certificate, $documentId));
            return;
        }

        if ($type === 'consent') {
            $consentSnapshot = PatientPortalConsentController::findPortalConsentSnapshotById($store, $caseIds, $documentId);
            $caseId = trim((string) ($consentSnapshot['caseId'] ?? ''));
            $snapshot = is_array($consentSnapshot['snapshot'] ?? null) ? $consentSnapshot['snapshot'] : [];

            if ($snapshot === [] || !PatientPortalController::caseBelongsToPortalPatient($caseId, $caseIds, [])) {
                json_response(['ok' => false, 'error' => 'Documento no disponible para esta sesión'], 404);
            }

            $portalDocument = is_array($snapshot['portalDocument'] ?? null) ? $snapshot['portalDocument'] : [];
            $pdfBase64 = trim((string) ($portalDocument['pdfBase64'] ?? ''));
            $pdfBytes = $pdfBase64 !== '' ? (string) base64_decode($pdfBase64, true) : '';
            if ($pdfBytes === '') {
                $patient = PatientPortalController::resolveCasePatient($store, $caseId);
                $pdfBytes = PatientPortalConsentController::generateConsentPdfBytes($snapshot, $patient);
            }

            PatientPortalController::emitPdfResponse($pdfBytes, PatientPortalConsentController::buildConsentFileName($snapshot, $documentId));
            return;
        }

        json_response(['ok' => false, 'error' => 'Tipo de documento no soportado'], 400);
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
            PatientPortalController::emit([
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
                PatientPortalController::emit([
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
            $patient = PatientPortalController::resolveCasePatient($store, $caseId);
            PatientPortalController::emit([
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
                PatientPortalController::emit([
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
            $patient = PatientPortalController::resolveCasePatient($store, $caseId);
            PatientPortalController::emit([
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

        PatientPortalController::emit([
            'ok' => true,
            'data' => [
                'valid' => false,
                'statusLabel' => 'Tipo no soportado',
                'message' => 'Este código no corresponde a un documento verificable.',
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

        $consultations = PatientPortalController::buildPortalHistory($store, $snapshot, $patient);
        
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

        $labHtml = '';
        $labs = [];
        $patientId = $patient['id'] ?? '';
        foreach (($store['cases'] ?? $store['patient_cases'] ?? []) as $c) {
            if (($c['patientId'] ?? '') === $patientId && !empty($c['labOrders'])) {
                foreach ($c['labOrders'] as $ord) {
                    $labs[] = $ord;
                }
            }
        }
        if (count($labs) > 0) {
            $labHtml = '<h2>Resultados de Laboratorio / Imagenología</h2>';
            foreach ($labs as $l) {
                $lName = htmlspecialchars($l['labName'] ?? 'Examen General', ENT_QUOTES, 'UTF-8');
                $lDate = htmlspecialchars($l['date'] ?? '', ENT_QUOTES, 'UTF-8');
                $lStatus = htmlspecialchars($l['resultStatus'] ?? 'pending', ENT_QUOTES, 'UTF-8');
                $labHtml .= "
                <div class=\"section\">
                    <h3>{$lName} - {$lDate}</h3>
                    <div style=\"margin-bottom: 8px;\"><strong>Estado:</strong> {$lStatus}</div>
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
            
            {$labHtml}

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


    public static function prescription(array $context): void
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
                'prescription' => PatientPortalController::buildActivePrescriptionSummary($store, $snapshot),
                'generatedAt' => local_date('c'),
            ],
        ]);
    }


    public static function buildDocumentVerificationPayload(string $type, array $document, array $patient): array
    {
        $documentId = trim((string) ($document['id'] ?? ''));
        $doctor = self::resolveDocumentDoctor($document);
        $clinicProfile = read_clinic_profile();
        $issuedAt = PatientPortalController::firstNonEmptyString(
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
            'issuedAtLabel' => PatientPortalController::buildDocumentIssuedLabel($issuedAt),
            'patientName' => PatientPortalController::buildPatientDisplayName($patient),
            'doctorName' => (string) ($doctor['name'] ?? ''),
            'doctorSpecialty' => (string) ($doctor['specialty'] ?? ''),
            'doctorMsp' => (string) ($doctor['msp'] ?? ''),
            'clinicName' => PatientPortalController::firstNonEmptyString(
                (string) ($document['clinicName'] ?? ''),
                (string) ($clinicProfile['clinicName'] ?? ''),
                'Aurora Derm'
            ),
        ];

        if ($type === 'prescription') {
            $items = PatientPortalController::normalizePortalPrescriptionItems($document);
            $payload['medicationCount'] = count($items);
            $payload['medicationSummary'] = $items !== []
                ? (string) ($items[0]['medication'] ?? '')
                : 'Sin medicamentos visibles';
        } else {
            $payload['certificateTypeLabel'] = PatientPortalController::firstNonEmptyString(
                (string) ($document['typeLabel'] ?? ''),
                PatientPortalController::humanizeValue((string) ($document['type'] ?? ''), 'Certificado médico')
            );
        }

        return $payload;
    }


    public static function resolveDocumentDoctor(array $document): array
    {
        return function_exists('doctor_profile_document_fields')
            ? doctor_profile_document_fields(
                isset($document['doctor']) && is_array($document['doctor'])
                    ? $document['doctor']
                    : ['name' => (string) ($document['issued_by'] ?? 'Médico tratante')]
            )
            : (is_array($document['doctor'] ?? null) ? $document['doctor'] : []);
    }


    public static function buildPortalDocumentPayload(string $type, ?array $document, bool $pending, string $downloadToken = ''): array
    {
        $title = $type === 'prescription' ? 'Receta médica' : 'Certificado médico';

        if (is_array($document)) {
            $documentId = trim((string) ($document['id'] ?? ''));
            $issuedAt = PatientPortalController::firstNonEmptyString(
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
                    . rawurlencode($documentId)
                    . ($downloadToken !== '' ? '&t=' . rawurlencode($downloadToken) : ''),
                'fileName' => $type === 'prescription'
                    ? self::buildPrescriptionFileName($documentId)
                    : self::buildCertificateFileName($document, $documentId),
                'issuedAt' => $issuedAt,
                'issuedAtLabel' => PatientPortalController::buildDocumentIssuedLabel($issuedAt),
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


    public static function defaultDocumentState(string $caseId): array
    {
        return [
            'prescription' => self::buildPortalDocumentPayload('prescription', null, false),
            'certificate' => self::buildPortalDocumentPayload('certificate', null, false),
        ];
    }


    public static function buildHistoryExportSummary(array $snapshot, array $patient, array $consultations): array
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


    public static function buildHistoryExportId(array $snapshot, array $patient): string
    {
        $raw = PatientPortalController::firstNonEmptyString(
            (string) ($snapshot['patientId'] ?? ''),
            (string) ($patient['patientId'] ?? ''),
            (string) ($snapshot['patientCaseId'] ?? ''),
            'portal-history'
        );

        return PatientPortalController::slugifyPortalFileToken($raw, 'portal-history');
    }


    public static function buildHistoryExportFileName(array $patient, array $snapshot): string
    {
        $suffix = PatientPortalController::slugifyPortalFileToken(
            PatientPortalController::firstNonEmptyString(
                PatientPortalController::buildPatientDisplayName($patient),
                (string) ($snapshot['patientId'] ?? ''),
                (string) ($patient['patientId'] ?? ''),
                'portal'
            ),
            'portal'
        );

        return 'historia-clinica-' . $suffix . '.pdf';
    }


    public static function generateHistoryExportPdfBytes(array $store, array $snapshot, array $patient): string
    {
        $resolvedPatient = PatientPortalController::resolvePortalPatientProfile($store, $snapshot, $patient);
        $consultations = PatientPortalController::buildPortalHistory($store, $snapshot, $resolvedPatient);
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

        return PatientPortalController::buildFallbackPdf($html);
    }


    public static function buildHistoryExportHtml(array $patient, array $snapshot, array $consultations): string
    {
        $clinicProfile = read_clinic_profile();
        $clinicName = PatientPortalController::escapeHtml(PatientPortalController::firstNonEmptyString(
            (string) ($clinicProfile['clinicName'] ?? ''),
            'Aurora Derm'
        ));
        $patientName = PatientPortalController::escapeHtml(PatientPortalController::buildPatientDisplayName($patient));
        $patientDocument = PatientPortalController::escapeHtml(PatientPortalController::firstNonEmptyString(
            (string) ($patient['ci'] ?? ''),
            (string) ($patient['cedula'] ?? ''),
            (string) ($patient['identification'] ?? ''),
            (string) ($patient['documentNumber'] ?? '')
        ));
        $patientPhone = PatientPortalController::escapeHtml(PatientPortalController::firstNonEmptyString(
            (string) ($patient['phone'] ?? ''),
            (string) ($snapshot['phone'] ?? '')
        ));
        $patientId = PatientPortalController::escapeHtml(PatientPortalController::firstNonEmptyString(
            (string) ($snapshot['patientId'] ?? ''),
            (string) ($patient['patientId'] ?? '')
        ));
        $generatedAtLabel = PatientPortalController::escapeHtml(PatientPortalController::buildPortalDateTimeLabel((string) local_date('c'), 'Generado ahora'));
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
                        <span>' . PatientPortalController::escapeHtml((string) $consultationCount) . '</span>
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


    public static function buildHistoryExportConsultationHtml(array $consultation): string
    {
        $serviceName = PatientPortalController::escapeHtml(PatientPortalController::firstNonEmptyString(
            (string) ($consultation['serviceName'] ?? ''),
            'Atención Aurora Derm'
        ));
        $statusLabel = PatientPortalController::escapeHtml(PatientPortalController::firstNonEmptyString(
            (string) ($consultation['statusLabel'] ?? ''),
            'Consulta registrada'
        ));
        $dateLabel = PatientPortalController::escapeHtml(PatientPortalController::firstNonEmptyString(
            (string) ($consultation['dateLabel'] ?? ''),
            'Fecha por confirmar'
        ));
        $timeLabel = PatientPortalController::escapeHtml(trim((string) ($consultation['timeLabel'] ?? '')));
        $doctorName = PatientPortalController::escapeHtml(PatientPortalController::firstNonEmptyString(
            (string) ($consultation['doctorName'] ?? ''),
            'Equipo clínico Aurora Derm'
        ));
        $appointmentTypeLabel = PatientPortalController::escapeHtml(trim((string) ($consultation['appointmentTypeLabel'] ?? '')));
        $locationLabel = PatientPortalController::escapeHtml(trim((string) ($consultation['locationLabel'] ?? '')));

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

            $label = PatientPortalController::escapeHtml(trim((string) ($event['label'] ?? '')));
            if ($label === '') {
                continue;
            }

            $meta = PatientPortalController::escapeHtml(trim((string) ($event['meta'] ?? '')));
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

            $docNormalized = PatientPortalController::normalize_clinical_document($document);

            $titleText = PatientPortalController::escapeHtml(PatientPortalController::firstNonEmptyString(
                $docNormalized['title'],
                'Documento clínico'
            ));
            
            $title = $docNormalized['voided_at'] !== '' ? '<del>' . $titleText . '</del> (Revocado)' : $titleText;

            $status = PatientPortalController::escapeHtml(PatientPortalController::firstNonEmptyString(
                $docNormalized['statusLabel'],
                'Sin estado'
            ));

            $description = PatientPortalController::escapeHtml($docNormalized['description']);
            if ($docNormalized['void_reason'] !== '') {
                $escapedReason = PatientPortalController::escapeHtml($docNormalized['void_reason']);
                $description = ($description !== '' ? $description . '<br>' : '') . '<em>Razón: ' . $escapedReason . '</em>';
            }

            $issuedAt = PatientPortalController::escapeHtml($docNormalized['issuedAtLabel']);

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
            <p>' . PatientPortalController::escapeHtml(implode(' · ', $metaParts)) . '</p>
            <p><strong>Eventos clínicos</strong></p>
            ' . $eventLines . '
            <p><strong>Documentos visibles</strong></p>
            ' . $documentLines . '
        </div>';
    }


    public static function generateCertificatePdfBytes(array $certificate, array $patient): string
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

        return PatientPortalController::buildFallbackPdf($html);
    }


    public static function buildCertificateHtml(array $certificate, array $patient): string
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
        $patientName = PatientPortalController::escapeHtml(PatientPortalController::firstNonEmptyString(
            trim((string) ($certificatePatient['name'] ?? '')),
            trim((string) (($certificatePatient['firstName'] ?? '') . ' ' . ($certificatePatient['lastName'] ?? ''))),
            trim((string) (($patient['firstName'] ?? '') . ' ' . ($patient['lastName'] ?? ''))),
            trim((string) ($patient['name'] ?? '')),
            'Paciente Aurora Derm'
        ));
        $patientId = PatientPortalController::escapeHtml(PatientPortalController::firstNonEmptyString(
            (string) ($certificatePatient['identification'] ?? ''),
            (string) ($certificatePatient['ci'] ?? ''),
            (string) ($patient['ci'] ?? ''),
            (string) ($patient['cedula'] ?? ''),
            (string) ($patient['identification'] ?? '')
        ));
        $doctorName = PatientPortalController::escapeHtml(PatientPortalController::firstNonEmptyString(
            (string) ($doctor['name'] ?? ''),
            (string) ($certificate['issued_by'] ?? ''),
            'Médico tratante'
        ));
        $doctorSpecialty = PatientPortalController::escapeHtml((string) ($doctor['specialty'] ?? ''));
        $doctorMsp = PatientPortalController::escapeHtml((string) ($doctor['msp'] ?? ''));
        $signatureImage = PatientPortalController::escapeHtml((string) ($doctor['signatureImage'] ?? ''));
        $signatureHtml = $signatureImage !== ''
            ? '<img src="' . $signatureImage . '" alt="Firma digital" style="max-width:220px; max-height:80px; display:block; margin-left:auto; margin-bottom:12px; object-fit:contain;">'
            : '';
        $clinicName = PatientPortalController::escapeHtml(PatientPortalController::firstNonEmptyString(
            (string) ($certificate['clinicName'] ?? ''),
            (string) ($clinicProfile['clinicName'] ?? ''),
            'Aurora Derm'
        ));
        $clinicAddress = PatientPortalController::escapeHtml(PatientPortalController::firstNonEmptyString(
            (string) ($certificate['clinicAddress'] ?? ''),
            (string) ($clinicProfile['address'] ?? ''),
            'Quito, Ecuador'
        ));
        $clinicPhone = PatientPortalController::escapeHtml(PatientPortalController::firstNonEmptyString(
            (string) ($certificate['clinicPhone'] ?? ''),
            (string) ($clinicProfile['phone'] ?? '')
        ));
        $typeLabel = PatientPortalController::escapeHtml(PatientPortalController::firstNonEmptyString(
            (string) ($certificate['typeLabel'] ?? ''),
            PatientPortalController::humanizeValue((string) ($certificate['type'] ?? ''), 'Certificado médico')
        ));
        $diagnosis = PatientPortalController::escapeHtml(PatientPortalController::firstNonEmptyString(
            (string) ($certificate['diagnosisText'] ?? ''),
            (string) ($certificate['diagnosis_text'] ?? ''),
            'Sin diagnóstico consignado'
        ));
        $cie10 = PatientPortalController::escapeHtml(PatientPortalController::firstNonEmptyString(
            (string) ($certificate['cie10Code'] ?? ''),
            (string) ($certificate['cie10_code'] ?? '')
        ));
        $restDays = max(
            0,
            (int) PatientPortalController::firstNonEmptyString(
                (string) ($certificate['restDays'] ?? ''),
                (string) ($certificate['rest_days'] ?? '0')
            )
        );
        $restrictions = PatientPortalController::escapeHtml(PatientPortalController::firstNonEmptyString(
            (string) ($certificate['restrictions'] ?? ''),
            'Sin restricciones adicionales'
        ));
        $observations = PatientPortalController::escapeHtml((string) ($certificate['observations'] ?? ''));
        $issuedAt = PatientPortalController::firstNonEmptyString(
            (string) ($certificate['issuedDateLocal'] ?? ''),
            (string) ($certificate['issuedAt'] ?? ''),
            (string) ($certificate['issued_at'] ?? '')
        );
        $issuedDateLabel = PatientPortalController::escapeHtml(PatientPortalController::buildCaseDateLabel($issuedAt));

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
                ' . ($restDays > 0 ? '<p><b>Días de reposo:</b> ' . PatientPortalController::escapeHtml((string) $restDays) . '</p>' : '') . '
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


    public static function buildCertificateFileName(array $certificate, string $documentId): string
    {
        $suffix = PatientPortalController::firstNonEmptyString(
            (string) ($certificate['folio'] ?? ''),
            (string) ($certificate['id'] ?? ''),
            $documentId
        );
        $suffix = preg_replace('/[^a-zA-Z0-9_-]/', '-', $suffix);
        return 'certificado-' . ($suffix !== '' ? $suffix : 'portal') . '.pdf';
    }


    public static function buildPrescriptionFileName(string $documentId): string
    {
        $suffix = preg_replace('/[^a-zA-Z0-9_-]/', '-', $documentId);
        return 'receta-' . ($suffix !== '' ? $suffix : 'portal') . '.pdf';
    }


    public static function findPrescriptionById(array $store, string $documentId): ?array
    {
        $prescription = $store['prescriptions'][$documentId] ?? null;
        if (!is_array($prescription)) {
            return null;
        }

        $prescription['id'] = trim((string) ($prescription['id'] ?? $documentId));
        return $prescription;
    }


    public static function findCertificateById(array $store, string $documentId): ?array
    {
        $certificate = $store['certificates'][$documentId] ?? null;
        if (!is_array($certificate)) {
            return null;
        }

        $certificate['id'] = trim((string) ($certificate['id'] ?? $documentId));
        return $certificate;
    }

}
