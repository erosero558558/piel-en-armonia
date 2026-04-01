<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/clinical_history/bootstrap.php';
require_once __DIR__ . '/../lib/InternalConsoleReadiness.php';
require_once __DIR__ . '/../lib/telemedicine/ClinicalMediaService.php';
require_once __DIR__ . '/../lib/DoctorProfileStore.php';
require_once __DIR__ . '/../lib/ClinicProfileStore.php';

final class ClinicalHistoryController
{
    public static function sessionGet(array $context): void
    {
        self::requireClinicalStorageReady([
            'session' => null,
            'draft' => null,
            'response' => null,
            'events' => [],
            'ai' => [
                'mode' => 'blocked',
            ],
        ]);

        $service = new ClinicalHistoryService();
        $result = self::readStore(static function (array $store) use ($service): array {
            return $service->getSession($store, $_GET, false);
        });

        if (($result['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'No se pudo cargar la sesion clinica'),
                'code' => (string) ($result['errorCode'] ?? 'clinical_history_error'),
            ], (int) ($result['statusCode'] ?? 500));
        }

        $caseId = $result['data']['caseId'] ?? ($_GET['case_id'] ?? ($_GET['caseId'] ?? ''));
        if ($caseId !== '') {
            require_once __DIR__ . '/../lib/DataAccessAudit.php';
            DataAccessAudit::logAccess('clinical_session', (string)$caseId);
        }

        json_response([
            'ok' => true,
            'data' => $result['data'] ?? [],
        ], (int) ($result['statusCode'] ?? 200));
    }

    public static function sessionPost(array $context): void
    {
        self::requireClinicalStorageReady([
            'session' => null,
            'draft' => null,
            'response' => null,
            'events' => [],
            'ai' => [
                'mode' => 'blocked',
            ],
        ]);

        $payload = require_json_body();
        $service = new ClinicalHistoryService();
        $result = self::mutateStore(static function (array $store) use ($service, $payload): array {
            return $service->createOrResumeSession($store, $payload);
        });

        self::emitMutationResponse($result);
    }

    public static function messagePost(array $context): void
    {
        self::requireClinicalStorageReady([
            'session' => null,
            'draft' => null,
            'response' => null,
            'events' => [],
            'ai' => [
                'mode' => 'blocked',
            ],
        ]);

        $payload = require_json_body();
        $service = new ClinicalHistoryService();
        $result = self::mutateStore(static function (array $store) use ($service, $payload): array {
            return $service->handlePatientMessage($store, $payload);
        });

        self::emitMutationResponse($result);
    }

    public static function reviewGet(array $context): void
    {
        if (($context['isAdmin'] ?? false) !== true) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }

        self::requireClinicalStorageReady([
            'session' => null,
            'draft' => null,
            'events' => [],
            'response' => null,
            'ai' => [
                'mode' => 'blocked',
            ],
        ]);

        $service = new ClinicalHistoryService();
        $result = self::readStore(static function (array $store) use ($service): array {
            return $service->getSession($store, $_GET, true);
        });

        if (($result['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'No se pudo cargar la revision clinica'),
                'code' => (string) ($result['errorCode'] ?? 'clinical_history_error'),
            ], (int) ($result['statusCode'] ?? 500));
        }

        $caseId = $result['data']['caseId'] ?? ($_GET['case_id'] ?? ($_GET['caseId'] ?? ''));
        if ($caseId !== '') {
            require_once __DIR__ . '/../lib/DataAccessAudit.php';
            DataAccessAudit::logAccess('clinical_review', (string)$caseId);
        }

        json_response([
            'ok' => true,
            'data' => $result['data'] ?? [],
        ]);
    }

    public static function reviewPatch(array $context): void
    {
        if (($context['isAdmin'] ?? false) !== true) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }

        self::requireClinicalStorageReady([
            'session' => null,
            'draft' => null,
            'events' => [],
            'response' => null,
            'ai' => [
                'mode' => 'blocked',
            ],
        ]);

        require_csrf();

        $payload = require_json_body();
        $service = new ClinicalHistoryService();
        $result = self::mutateStore(static function (array $store) use ($service, $payload): array {
            return $service->applyReview($store, $payload);
        });

        self::emitMutationResponse($result);
    }

    public static function recordGet(array $context): void
    {
        if (($context['isAdmin'] ?? false) !== true) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }

        self::requireClinicalStorageReady([
            'session' => null,
            'draft' => null,
            'events' => [],
            'response' => null,
            'ai' => [
                'mode' => 'blocked',
            ],
        ]);

        $service = new ClinicalHistoryService();
        $result = self::readStore(static function (array $store) use ($service): array {
            return $service->getRecord($store, $_GET);
        });

        if (($result['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'No se pudo cargar el registro clinico'),
                'code' => (string) ($result['errorCode'] ?? 'clinical_record_error'),
            ], (int) ($result['statusCode'] ?? 500));
        }

        $caseId = $result['data']['caseId'] ?? ($_GET['case_id'] ?? ($_GET['caseId'] ?? ''));
        if ($caseId !== '') {
            require_once __DIR__ . '/../lib/DataAccessAudit.php';
            DataAccessAudit::logAccess('clinical_record', (string)$caseId);
        }

        json_response([
            'ok' => true,
            'data' => $result['data'] ?? [],
        ]);
    }

    public static function recordPatch(array $context): void
    {
        if (($context['isAdmin'] ?? false) !== true) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }

        self::requireClinicalStorageReady([
            'session' => null,
            'draft' => null,
            'events' => [],
            'response' => null,
            'ai' => [
                'mode' => 'blocked',
            ],
        ]);

        require_csrf();

        $payload = require_json_body();
        $service = new ClinicalHistoryService();
        $result = self::mutateStore(static function (array $store) use ($service, $payload): array {
            return $service->patchRecord($store, $payload);
        });

        self::emitMutationResponse($result);
    }

    public static function episodeActionPost(array $context): void
    {
        if (($context['isAdmin'] ?? false) !== true) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }

        self::requireClinicalStorageReady([
            'session' => null,
            'draft' => null,
            'events' => [],
            'response' => null,
            'ai' => [
                'mode' => 'blocked',
            ],
        ]);

        require_csrf();

        $payload = require_json_body();
        $service = new ClinicalHistoryService();
        $result = self::mutateStore(static function (array $store) use ($service, $payload): array {
            return $service->episodeAction($store, $payload);
        });

        self::emitMutationResponse($result);
    }

    public static function getCarePlanPdf(array $context): void
    {
        if (($context['isAdmin'] ?? false) !== true) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }

        $sessionId = trim((string) ($_GET['session_id'] ?? ''));
        if ($sessionId === '') {
            json_response(['ok' => false, 'error' => 'session_id requerido'], 400);
        }

        $store = read_store();
        $session = $store['clinical_history_sessions'][$sessionId] ?? null;

        if ($session === null) {
            json_response(['ok' => false, 'error' => 'Sesion no encontrada'], 404);
        }

        $caseId = $session['caseId'] ?? '';
        $patient = $store['patients'][$caseId] ?? [];
        $patientName = ClinicalHistoryRepository::trimString(($patient['firstName'] ?? '') . ' ' . ($patient['lastName'] ?? ''));
        
        $draft = $session['draft'] ?? [];
        $documents = $draft['documents'] ?? [];
        $carePlan = $documents['carePlan'] ?? [];

        $diagnosis = htmlspecialchars(ClinicalHistoryRepository::trimString($carePlan['diagnosis'] ?? ''), ENT_QUOTES, 'UTF-8');
        $treatmentsRaw = ClinicalHistoryRepository::trimString($carePlan['treatments'] ?? '');
        $followUp = htmlspecialchars(ClinicalHistoryRepository::trimString($carePlan['followUpFrequency'] ?? ''), ENT_QUOTES, 'UTF-8');
        $goals = htmlspecialchars(ClinicalHistoryRepository::trimString($carePlan['goals'] ?? ''), ENT_QUOTES, 'UTF-8');

        $treatmentsHtml = '';
        foreach (explode("\n", $treatmentsRaw) as $line) {
            $line = trim($line);
            if ($line === '') continue;
            $treatmentsHtml .= "<li>" . htmlspecialchars($line, ENT_QUOTES, 'UTF-8') . "</li>";
        }
        if ($treatmentsHtml !== '') {
            $treatmentsHtml = "<ul>{$treatmentsHtml}</ul>";
        }

        $dateStr = date('d/m/Y');
        $doctorData = doctor_profile_document_fields([
            'name' => trim((string) ($_SESSION['admin_email'] ?? '')),
        ]);
        $doctorStr = htmlspecialchars($doctorData['name'] ?? 'Medico tratante', ENT_QUOTES, 'UTF-8');
        $doctorSpecialty = htmlspecialchars($doctorData['specialty'] ?? '', ENT_QUOTES, 'UTF-8');
        $doctorMsp = htmlspecialchars($doctorData['msp'] ?? '', ENT_QUOTES, 'UTF-8');
        $doctorSignatureImage = htmlspecialchars($doctorData['signatureImage'] ?? '', ENT_QUOTES, 'UTF-8');
        $doctorSignatureHtml = $doctorSignatureImage !== ''
            ? "<img class=\"signature-image\" src=\"{$doctorSignatureImage}\" alt=\"Firma digital del medico\">"
            : '';
        $doctorMspLine = $doctorMsp !== ''
            ? "Registro MSP: {$doctorMsp}"
            : 'Firma autorizada';

        $clinicProfile = read_clinic_profile();
        $clinicName = htmlspecialchars($clinicProfile['clinicName'] ?: 'Aurora Derm');
        $clinicAddress = htmlspecialchars($clinicProfile['address'] ?: 'Quito, Ecuador');
        $clinicPhone = htmlspecialchars($clinicProfile['phone'] ?: '');
        $clinicLogoHtml = $clinicProfile['logoImage'] !== '' 
            ? '<img src="' . htmlspecialchars($clinicProfile['logoImage'], ENT_QUOTES, 'UTF-8') . '" style="max-height: 50px; display:inline-block; margin-right:10px; vertical-align:middle;" />' 
            : '';

        $html = "
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset=\"utf-8\">
            <title>Plan de Tratamiento</title>
            <style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 40px; color: #111; }
                .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #c9a96e; padding-bottom: 20px; }
                .header-wrapper { display: inline-flex; align-items: center; justify-content: center; }
                .header h1 { margin: 0; font-size: 24px; color: #07090c; font-weight: bold; display: inline-block; vertical-align: middle; }
                .header p { margin: 5px 0 0 0; font-size: 14px; color: #666; }
                .title { font-size: 20px; font-weight: bold; text-align: center; margin-bottom: 30px; }
                .patient-info { margin-bottom: 30px; padding: 15px; background: #f9f9f9; border-radius: 4px; font-size: 14px; }
                .patient-info strong { display: inline-block; width: 100px; }
                .section { margin-bottom: 20px; }
                .section h3 { margin: 0 0 10px 0; font-size: 16px; color: #c9a96e; border-bottom: 1px solid #eee; padding-bottom: 5px; }
                .section p { margin: 0; font-size: 14px; line-height: 1.5; white-space: pre-wrap; }
                .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
                .signature { margin-top: 60px; text-align: right; }
                .signature-image { max-width: 220px; max-height: 80px; display: block; margin-left: auto; margin-bottom: 10px; object-fit: contain; }
                .signature-line { border-top: 1px solid #000; width: 200px; display: inline-block; margin-bottom: 5px; }
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
            
            <div class=\"title\">PLAN DE TRATAMIENTO Y SEGUIMIENTO</div>

            <div class=\"patient-info\">
                <div style=\"margin-bottom: 8px;\"><strong>Paciente:</strong> {$patientName}</div>
                <div><strong>Fecha:</strong> {$dateStr}</div>
            </div>

            <div class=\"section\">
                <h3>Diagnóstico</h3>
                <p>{$diagnosis}</p>
            </div>

            <div class=\"section\">
                <h3>Tratamientos, Sesiones y Costos Estimados</h3>
                {$treatmentsHtml}
            </div>

            <div class=\"section\">
                <h3>Frecuencia de Seguimiento</h3>
                <p>{$followUp}</p>
            </div>

            <div class=\"section\">
                <h3>Metas Terapéuticas</h3>
                <p>{$goals}</p>
            </div>

            <div class=\"signature\">
                {$doctorSignatureHtml}
                <div class=\"signature-line\"></div>
                <div><strong>{$doctorStr}</strong></div>
                <div style=\"font-size: 12px; color: #666;\">{$doctorSpecialty}</div>
                <div style=\"font-size: 12px; color: #666;\">{$doctorMspLine}</div>
            </div>

            <div class=\"footer\">
                Generado electrónicamente por Flow OS - Copiloto Clínico
            </div>
        </body>
        </html>
        ";

        require_once __DIR__ . '/CertificateController.php';
        
        $pdfPath = __DIR__ . '/../vendor/dompdf/dompdf/src/Dompdf.php';
        if (file_exists($pdfPath)) {
            require_once $pdfPath;
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
        header('Content-Disposition: inline; filename="plan-tratamiento-' . $sessionId . '.pdf"');
        echo $pdfBytes;
        exit;
    }

    public static function uploadMedia(array $context): void
    {
        if (!($context['isAdmin'] ?? false)) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }

        $caseId = trim((string) ($_POST['caseId'] ?? ''));
        $patientId = trim((string) ($_POST['patientId'] ?? ''));
        $bodyZone = trim((string) ($_POST['bodyZone'] ?? ''));

        if ($caseId === '') {
            json_response(['ok' => false, 'error' => 'caseId es requerido'], 400);
        }

        if (!isset($_FILES['photo']) || (int) ($_FILES['photo']['error']) !== UPLOAD_ERR_OK) {
            json_response(['ok' => false, 'error' => 'No se recibio un archivo valido'], 400);
        }

        $lockResult = with_store_lock(static function () use ($context, $caseId, $patientId, $bodyZone): array {
            $store = read_store();
            $tenantId = get_current_tenant_id();

            $maxId = 0;
            foreach (($store['clinical_uploads'] ?? []) as $upload) {
                if (is_array($upload)) {
                    $maxId = max($maxId, (int) ($upload['id'] ?? 0));
                }
            }
            $nextUploadId = $maxId + 1;

            $file = $_FILES['photo'];
            $tmpName = trim((string) ($file['tmp_name'] ?? ''));
            $size = (int) ($file['size'] ?? 0);

            if ($size > 5242880) {
                return ['ok' => false, 'code' => 400, 'error' => 'Cada foto debe pesar maximo 5 MB.'];
            }

            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mime = $finfo ? (string) finfo_file($finfo, $tmpName) : '';
            if ($finfo) {
                finfo_close($finfo);
            }

            $allowed = [
                'image/jpeg' => 'jpg',
                'image/png' => 'png',
                'image/webp' => 'webp',
            ];
            if (!isset($allowed[$mime])) {
                return ['ok' => false, 'code' => 400, 'error' => 'Las fotos deben ser JPG, PNG o WEBP.'];
            }

            if (!ensure_clinical_media_dir()) {
                return ['ok' => false, 'code' => 500, 'error' => 'Error preparando almacenamiento.'];
            }

            $dateFolder = local_date('Y-m-d');
            $patientSlug = $patientId === '' ? 'general' : preg_replace('/[^a-zA-Z0-9_-]/', '', $patientId);
            $subFolder = $patientSlug . DIRECTORY_SEPARATOR . $dateFolder;
            $fullTargetDir = clinical_media_dir_path() . DIRECTORY_SEPARATOR . $subFolder;

            if (!is_dir($fullTargetDir)) {
                @mkdir($fullTargetDir, 0750, true);
            }

            $suffix = bin2hex(random_bytes(6));
            $filename = 'clinical-' . local_date('His') . '-' . $suffix . '.' . $allowed[$mime];
            $targetDiskPath = $fullTargetDir . DIRECTORY_SEPARATOR . $filename;

            if (is_uploaded_file($tmpName)) {
                if (!@move_uploaded_file($tmpName, $targetDiskPath)) {
                    return ['ok' => false, 'code' => 500, 'error' => 'Error guardando archivo fisico.'];
                }
            } else {
                return ['ok' => false, 'code' => 400, 'error' => 'Archivo invalido.'];
            }

            @chmod($targetDiskPath, 0640);
            $sha256 = @hash_file('sha256', $targetDiskPath);
            $originalName = basename((string) ($file['name'] ?? $filename));
            $safeOriginal = preg_replace('/[^a-zA-Z0-9._ -]/', '_', $originalName);

            $record = [
                'id' => max(1, $nextUploadId),
                'tenantId' => $tenantId,
                'intakeId' => null,
                'appointmentId' => null,
                'patientCaseId' => $caseId,
                'bodyZone' => $bodyZone,
                'kind' => \ClinicalMediaService::KIND_CASE_PHOTO,
                'storageMode' => \ClinicalMediaService::STORAGE_PRIVATE_CLINICAL,
                'privatePath' => 'clinical-media/' . str_replace('\\', '/', $subFolder) . '/' . $filename,
                'legacyPublicPath' => '',
                'legacyPublicUrl' => '',
                'mime' => $mime,
                'size' => $size,
                'sha256' => is_string($sha256) ? $sha256 : '',
                'originalName' => $safeOriginal,
                'createdAt' => local_date('c'),
                'updatedAt' => local_date('c'),
            ];

            $store['clinical_uploads'] = isset($store['clinical_uploads']) && is_array($store['clinical_uploads'])
                ? array_values($store['clinical_uploads'])
                : [];
            
            $store['clinical_uploads'][] = $record;

            if (!write_store($store, false)) {
                @unlink($targetDiskPath);
                return ['ok' => false, 'code' => 500, 'error' => 'No se pudo registrar la subida.'];
            }

            return ['ok' => true, 'record' => $record, 'store' => $store];
        });

        if (($lockResult['ok'] ?? false) !== true || (isset($lockResult['result']) && ($lockResult['result']['ok'] ?? false) !== true)) {
            $result = is_array($lockResult['result'] ?? null) ? $lockResult['result'] : $lockResult;
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'Error desconocido de subida')
            ], (int) ($result['code'] ?? 500));
        }

        $uploadRecord = $lockResult['result']['record'] ?? [];
        json_response([
            'ok' => true,
            'data' => [
                'uploadId' => (int) ($uploadRecord['id'] ?? 0),
                'privatePath' => (string) ($uploadRecord['privatePath'] ?? ''),
                'bodyZone' => (string) ($uploadRecord['bodyZone'] ?? '')
            ]
        ], 201);
    }

    public static function getClinicalPhotos(array $context): void
    {
        if (!($context['isAdmin'] ?? false)) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }

        $caseId = trim((string) ($_GET['case_id'] ?? $_GET['caseId'] ?? ''));
        if ($caseId === '') {
            json_response(['ok' => false, 'error' => 'case_id es requerido'], 400);
        }

        $store = read_store();
        $photosByDate = [];
        $evolutionsByDate = [];

        // Collect all evolution notes for this case, group by date
        foreach (($store['clinical_history_events'] ?? []) as $event) {
            $eCaseId = trim((string) ($event['caseId'] ?? ''));
            if ($eCaseId === $caseId && ($event['type'] ?? '') === 'openclaw_evolution') {
                $dateTs = strtotime($event['createdAt'] ?? $event['occurredAt'] ?? 'now');
                $date = date('Y-m-d', $dateTs);
                if (!isset($evolutionsByDate[$date])) {
                    $evolutionsByDate[$date] = [];
                }
                $evolutionsByDate[$date][] = $event['message'] ?? '';
            }
        }

        foreach (($store['clinical_uploads'] ?? []) as $upload) {
            $uCaseId = trim((string) ($upload['patientCaseId'] ?? ''));
            $uKind = trim((string) ($upload['kind'] ?? ''));
            if ($uCaseId === $caseId && $uKind === 'clinical_photo') {
                $privatePath = $upload['privatePath'] ?? '';
                $url = $privatePath !== '' 
                    ? '/api.php?resource=media-flow-private-asset&type=clinical_media&path=' . urlencode($privatePath)
                    : '';
                
                $capturedAt = $upload['createdAt'] ?? '';
                $dateTs = strtotime($capturedAt);
                if (!$dateTs) $dateTs = time();
                $date = date('Y-m-d', $dateTs);

                if (!isset($photosByDate[$date])) {
                    $photosByDate[$date] = [
                        'session_date' => $date,
                        'evolution_note_excerpt' => implode("\n\n", $evolutionsByDate[$date] ?? []),
                        'photos' => []
                    ];
                }

                $photosByDate[$date]['photos'][] = [
                    'id' => (int) ($upload['id'] ?? 0),
                    'url' => $url,
                    'type' => $upload['mime'] ?? 'image/jpeg',
                    'region' => $upload['bodyZone'] ?? '',
                    'notes' => $upload['notes'] ?? '',
                    'capturedAt' => $capturedAt,
                ];
            }
        }

        $result = array_values($photosByDate);
        usort($result, static function($a, $b) {
            return strcmp($a['session_date'], $b['session_date']);
        });

        json_response([
            'ok' => true,
            'data' => $result
        ]);
    }

    public static function uploadClinicalPhoto(array $context): void
    {
        if (!($context['isAdmin'] ?? false)) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }

        $caseId = trim((string) ($_POST['caseId'] ?? ''));
        $region = trim((string) ($_POST['region'] ?? ''));
        $notes = trim((string) ($_POST['notes'] ?? ''));

        if ($caseId === '' || $region === '') {
            json_response(['ok' => false, 'error' => 'caseId y region son requeridos'], 400);
        }

        if (!isset($_FILES['photo']) || (int) ($_FILES['photo']['error']) !== UPLOAD_ERR_OK) {
            json_response(['ok' => false, 'error' => 'No se recibio un archivo valido'], 400);
        }

        $lockResult = with_store_lock(static function () use ($context, $caseId, $region, $notes): array {
            $store = read_store();
            $tenantId = get_current_tenant_id();

            $maxId = 0;
            $previousPhotoUploads = 0;
            foreach (($store['clinical_uploads'] ?? []) as $upload) {
                if (is_array($upload)) {
                    $maxId = max($maxId, (int) ($upload['id'] ?? 0));
                    $uCaseId = trim((string) ($upload['patientCaseId'] ?? ''));
                    if ($uCaseId === $caseId && ($upload['kind'] ?? '') === 'clinical_photo') {
                        $previousPhotoUploads++;
                    }
                }
            }
            $nextUploadId = $maxId + 1;
            $visitLabel = 'Consulta ' . ($previousPhotoUploads + 1);

            $file = $_FILES['photo'];
            $tmpName = trim((string) ($file['tmp_name'] ?? ''));
            $size = (int) ($file['size'] ?? 0);

            if ($size > 10485760) {
                return ['ok' => false, 'code' => 400, 'error' => 'Cada foto debe pesar maximo 10 MB.'];
            }

            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mime = $finfo ? (string) finfo_file($finfo, $tmpName) : '';
            if ($finfo) {
                finfo_close($finfo);
            }

            $allowed = [
                'image/jpeg' => 'jpg',
                'image/png' => 'png',
                'image/webp' => 'webp',
            ];
            if (!isset($allowed[$mime])) {
                return ['ok' => false, 'code' => 400, 'error' => 'Las fotos deben ser JPG, PNG o WEBP.'];
            }

            if (!ensure_clinical_media_dir()) {
                return ['ok' => false, 'code' => 500, 'error' => 'Error preparando almacenamiento.'];
            }

            $patientSlug = preg_replace('/[^a-zA-Z0-9_-]/', '', $caseId);
            $fullTargetDir = clinical_media_dir_path() . DIRECTORY_SEPARATOR . $patientSlug;
            
            if (!is_dir($fullTargetDir)) {
                @mkdir($fullTargetDir, 0750, true);
            }

            $suffix = substr(hash('sha256', (string) random_bytes(16)), 0, 8);
            $filename = local_date('His') . '-' . $suffix . '.' . $allowed[$mime];
            $targetDiskPath = $fullTargetDir . DIRECTORY_SEPARATOR . $filename;

            if (is_uploaded_file($tmpName)) {
                if (!@move_uploaded_file($tmpName, $targetDiskPath)) {
                    return ['ok' => false, 'code' => 500, 'error' => 'Error guardando archivo fisico.'];
                }
            } else {
                return ['ok' => false, 'code' => 400, 'error' => 'Archivo invalido.'];
            }

            @chmod($targetDiskPath, 0640);
            $sha256 = @hash_file('sha256', $targetDiskPath);

            $record = [
                'id' => max(1, $nextUploadId),
                'tenantId' => $tenantId,
                'patientCaseId' => $caseId,
                'bodyZone' => $region,
                'notes' => $notes,
                'visitLabel' => $visitLabel,
                'kind' => 'clinical_photo',
                'storageMode' => \ClinicalMediaService::STORAGE_PRIVATE_CLINICAL,
                'privatePath' => 'clinical-media/' . $patientSlug . '/' . $filename,
                'mime' => $mime,
                'size' => $size,
                'sha256' => is_string($sha256) ? $sha256 : '',
                'createdAt' => local_date('c'),
                'updatedAt' => local_date('c'),
            ];

            $store['clinical_uploads'] = isset($store['clinical_uploads']) && is_array($store['clinical_uploads'])
                ? array_values($store['clinical_uploads'])
                : [];
            
            $store['clinical_uploads'][] = $record;

            if (!write_store($store, false)) {
                @unlink($targetDiskPath);
                return ['ok' => false, 'code' => 500, 'error' => 'No se pudo registrar la subida.'];
            }

            return ['ok' => true, 'record' => $record];
        });

        if (($lockResult['ok'] ?? false) !== true || (isset($lockResult['result']) && ($lockResult['result']['ok'] ?? false) !== true)) {
            $result = is_array($lockResult['result'] ?? null) ? $lockResult['result'] : $lockResult;
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'Error desconocido de subida')
            ], (int) ($result['code'] ?? 500));
        }

        $uploadRecord = $lockResult['result']['record'] ?? [];
        $privatePath = $uploadRecord['privatePath'] ?? '';
        $url = $privatePath !== '' 
            ? '/api.php?resource=media-flow-private-asset&type=clinical_media&path=' . urlencode($privatePath)
            : '';

        json_response([
            'ok' => true,
            'photo' => [
                'id' => (int) ($uploadRecord['id'] ?? 0),
                'url' => $url,
                'thumbnailUrl' => $url,
                'region' => (string) ($uploadRecord['bodyZone'] ?? ''),
                'notes' => (string) ($uploadRecord['notes'] ?? ''),
                'capturedAt' => (string) ($uploadRecord['createdAt'] ?? ''),
                'visitLabel' => (string) ($uploadRecord['visitLabel'] ?? ''),
            ]
        ], 201);
    }

    /**
     * S30-02: Registro de signos vitales pre-consulta (enfermería)
     * POST clinical-vitals
     * Payload: { session_id, case_id, vital_signs: {...} }
     */
    public static function saveVitals(array $context): void
    {
        if (!($context['isAdmin'] ?? false)) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }

        $payload = require_json_body();
        $sessionId = trim((string) ($payload['session_id'] ?? ''));
        $caseId    = trim((string) ($payload['case_id'] ?? ''));
        $vitals    = $payload['vital_signs'] ?? [];

        if ($sessionId === '' && $caseId === '') {
            json_response(['ok' => false, 'error' => 'session_id o case_id requerido'], 400);
        }

        require_once __DIR__ . '/../lib/clinical_history/ClinicalHistorySessionRepository.php';

        $result = self::mutateStore(static function (array $store) use ($sessionId, $caseId, $vitals): array {
            // Buscar sesión activa
            $session = $sessionId !== ''
                ? ClinicalHistorySessionRepository::findSessionBySessionId($store, $sessionId)
                : ClinicalHistorySessionRepository::findSessionByCaseId($store, $caseId);

            if ($session === null) {
                return ['ok' => false, 'error' => 'Sesión clínica no encontrada', 'statusCode' => 404];
            }

            // Buscar draft de esta sesión y actualizar intake.vitalSigns
            $sid = $session['sessionId'];
            $drafts = $store['clinical_history_drafts'] ?? [];
            $updated = false;
            foreach ($drafts as &$draft) {
                if (trim((string) ($draft['sessionId'] ?? '')) !== $sid) continue;
                // normalizeIntake ya procesa vitalSigns con alertas automáticas
                $currentIntake = $draft['intake'] ?? [];
                $currentIntake['vitalSigns'] = $vitals;
                $draft['intake'] = ClinicalHistorySessionRepository::normalizeIntake($currentIntake);
                $draft['updatedAt'] = gmdate('c');
                $updated = true;
                break;
            }
            unset($draft);

            if (!$updated) {
                return ['ok' => false, 'error' => 'Draft de consulta no encontrado', 'statusCode' => 404];
            }

            $store['clinical_history_drafts'] = array_values($drafts);

            // Extraer alertas del intake normalizado para devolverlas al frontend
            $savedDraft = null;
            foreach ($store['clinical_history_drafts'] as $d) {
                if (trim((string) ($d['sessionId'] ?? '')) === $sid) { $savedDraft = $d; break; }
            }
            $alerts = $savedDraft['intake']['vitalSigns']['vitalAlerts'] ?? [];

            return ['ok' => true, 'store' => $store, 'vital_alerts' => $alerts, 'data' => ['vital_alerts' => $alerts]];
        });

        if (!($result['ok'] ?? false)) {
            json_response(['ok' => false, 'error' => $result['error'] ?? 'Error'], (int) ($result['statusCode'] ?? 500));
        }

        json_response([
            'ok'           => true,
            'vital_alerts' => $result['vital_alerts'] ?? [],
            'saved_at'     => gmdate('c'),
        ]);
    }

    /**
     * S30-03: Historial cronológico de signos vitales del paciente
     * GET patient-vitals-history?case_id=X
     */
    public static function vitalsHistory(array $context): void
    {
        if (!($context['isAdmin'] ?? false)) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }

        $caseId = trim((string) ($_GET['case_id'] ?? ''));
        if ($caseId === '') {
            json_response(['ok' => false, 'error' => 'case_id requerido'], 400);
        }

        require_once __DIR__ . '/../lib/clinical_history/ClinicalHistorySessionRepository.php';
        $store   = read_store();
        $drafts  = ClinicalHistorySessionRepository::findAllDraftsByCaseId($store, $caseId);
        $history = [];

        foreach ($drafts as $draft) {
            $vs = $draft['intake']['vitalSigns'] ?? [];
            // Solo incluir registros donde al menos una vital fue tomada
            $hasMeasurement = ($vs['bloodPressureSystolic'] !== null
                || $vs['heartRate'] !== null
                || $vs['temperatureCelsius'] !== null
                || $vs['spo2Percent'] !== null
                || $vs['weightKg'] !== null);
            if (!$hasMeasurement) continue;
            $history[] = [
                'session_id'             => $draft['sessionId'],
                'appointment_date'       => $draft['createdAt'],
                'taken_at'               => $vs['takenAt'] ?? $draft['createdAt'],
                'taken_by'               => $vs['takenBy'] ?? '',
                'bloodPressureSystolic'  => $vs['bloodPressureSystolic'],
                'bloodPressureDiastolic' => $vs['bloodPressureDiastolic'],
                'heartRate'              => $vs['heartRate'],
                'respiratoryRate'        => $vs['respiratoryRate'],
                'temperatureCelsius'     => $vs['temperatureCelsius'],
                'spo2Percent'            => $vs['spo2Percent'],
                'weightKg'               => $vs['weightKg'],
                'bmi'                    => $vs['bmi'],
                'glucometryMgDl'         => $vs['glucometryMgDl'],
                'painScale'              => $vs['painScale'],
                'vital_alerts'           => $vs['vitalAlerts'] ?? [],
            ];
        }

        usort($history, fn($a, $b) => strcmp($a['appointment_date'], $b['appointment_date']));

        json_response(['ok' => true, 'case_id' => $caseId, 'vitals' => $history]);
    }

    /**
     * S30-05: Ingesta de resultado de laboratorio
     * POST receive-lab-result
     * Payload: { session_id, lab_order_id, result_date, lab_name, values: [{test_name, value, unit, reference_range, status}], summary }
     */
    public static function receiveLabResult(array $context): void
    {
        if (!($context['isAdmin'] ?? false)) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }

        $payload     = require_json_body();
        $sessionId   = trim((string) ($payload['session_id'] ?? ''));
        $labOrderId  = trim((string) ($payload['lab_order_id'] ?? ''));
        $resultDate  = trim((string) ($payload['result_date'] ?? gmdate('c')));
        $labName     = trim((string) ($payload['lab_name'] ?? ''));
        $summary     = trim((string) ($payload['summary'] ?? ''));
        $values      = is_array($payload['values'] ?? null) ? $payload['values'] : [];

        if ($sessionId === '' || $labOrderId === '') {
            json_response(['ok' => false, 'error' => 'session_id y lab_order_id requeridos'], 400);
        }

        $criticalValues = [];
        $normalizedValues = [];
        foreach ($values as $v) {
            if (!is_array($v)) continue;
            $status = trim((string) ($v['status'] ?? 'normal'));
            $normalizedValues[] = [
                'test_name'       => trim((string) ($v['test_name'] ?? '')),
                'value'           => $v['value'] ?? '',
                'unit'            => trim((string) ($v['unit'] ?? '')),
                'reference_range' => trim((string) ($v['reference_range'] ?? '')),
                'status'          => in_array($status, ['normal', 'low', 'high', 'critical'], true) ? $status : 'normal',
            ];
            if ($status === 'critical') {
                $criticalValues[] = trim((string) ($v['test_name'] ?? '')) . ': ' . $v['value'] . ' ' . trim((string) ($v['unit'] ?? ''));
            }
        }

        $result = self::mutateStore(static function (array $store) use (
            $sessionId, $labOrderId, $resultDate, $labName, $summary, $normalizedValues
        ): array {
            $service = new ClinicalHistoryService();
            return $service->episodeAction($store, [
                'action'       => 'receive_lab_result',
                'sessionId'    => $sessionId,
                'labOrderId'   => $labOrderId,
                'resultDate'   => $resultDate,
                'labName'      => $labName,
                'summary'      => $summary,
                'values'       => $normalizedValues,
                'resultStatus' => 'received',
            ]);
        });

        // Si falla el episodeAction (lab order no soportado todavía), persistir directamente en el draft
        if (!($result['ok'] ?? false)) {
            $result = self::mutateStore(static function (array $store) use (
                $sessionId, $labOrderId, $resultDate, $labName, $summary, $normalizedValues
            ): array {
                $drafts = $store['clinical_history_drafts'] ?? [];
                foreach ($drafts as &$draft) {
                    if (trim((string) ($draft['sessionId'] ?? '')) !== $sessionId) continue;
                    $labOrders = $draft['labOrders'] ?? [];
                    foreach ($labOrders as &$order) {
                        if (trim((string) ($order['labOrderId'] ?? '')) !== $labOrderId) continue;
                        $order['resultStatus'] = 'received';
                        $order['result'] = [
                            'receivedAt' => $resultDate,
                            'labName'    => $labName,
                            'summary'    => $summary,
                            'values'     => $normalizedValues,
                        ];
                        break;
                    }
                    unset($order);
                    $draft['labOrders'] = $labOrders;
                    $draft['updatedAt'] = gmdate('c');
                    break;
                }
                unset($draft);
                $store['clinical_history_drafts'] = array_values($drafts);
                return ['ok' => true, 'store' => $store, 'data' => []];
            });
        }

        // S30-07: WhatsApp al médico si hay valores críticos
        if (!empty($criticalValues) && function_exists('whatsapp_wa_link')) {
            $criticalList = implode(', ', $criticalValues);
            audit_log_event('clinical_lab.critical_result', [
                'session_id' => $sessionId,
                'lab_order_id' => $labOrderId,
                'critical_values' => $criticalValues,
            ]);

            require_once __DIR__ . '/../lib/clinical_history/ClinicalHistorySessionRepository.php';
            $session = \ClinicalHistorySessionRepository::findSessionBySessionId(read_store(), $sessionId);
            $localCaseId = $session['caseId'] ?? '';
            
            if ($localCaseId !== '') {
                foreach ($criticalValues as $tempCv) {
                    $parts = explode(':', $tempCv, 2);
                    $argTest = escapeshellarg(trim($parts[0]));
                    $argValue = escapeshellarg(trim($parts[1] ?? ''));
                    if ($argTest !== '' && $argTest !== "''") {
                        $cmd = 'php ' . realpath(__DIR__ . '/../bin/notify-lab-critical.php') . ' --case_id=' . escapeshellarg($localCaseId) . ' --test=' . $argTest . ' --value=' . $argValue . ' > /dev/null 2>&1 &';
                        @exec($cmd);
                    }
                }
            }
        }

        json_response([
            'ok'             => true,
            'result_saved'   => true,
            'critical_values'=> $criticalValues,
            'alert_sent'     => !empty($criticalValues),
        ]);
    }

    /**
     * S30-09: Ingesta de resultado de imagen (radiología)
     * POST receive-imaging-result
     * Payload: { session_id, imaging_order_id, result_date, radiologist_name, modality, report_text, impression }
     */
    public static function receiveImagingResult(array $context): void
    {
        if (!($context['isAdmin'] ?? false)) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }

        $payload        = require_json_body();
        $sessionId      = trim((string) ($payload['session_id'] ?? ''));
        $imagingOrderId = trim((string) ($payload['imaging_order_id'] ?? ''));
        $resultDate     = trim((string) ($payload['result_date'] ?? gmdate('c')));
        $radiologist    = trim((string) ($payload['radiologist_name'] ?? ''));
        $modality       = trim((string) ($payload['modality'] ?? ''));
        $reportText     = trim((string) ($payload['report_text'] ?? ''));
        $impression     = trim((string) ($payload['impression'] ?? ''));

        if ($sessionId === '' || $imagingOrderId === '') {
            json_response(['ok' => false, 'error' => 'session_id e imaging_order_id requeridos'], 400);
        }

        $result = self::mutateStore(static function (array $store) use (
            $sessionId, $imagingOrderId, $resultDate, $radiologist, $modality, $reportText, $impression
        ): array {
            $service = new ClinicalHistoryService();
            return $service->episodeAction($store, [
                'action'       => 'receive_imaging_report',
                'sessionId'    => $sessionId,
                'imagingOrderId' => $imagingOrderId,
                'resultDate'   => $resultDate,
                'radiologistName' => $radiologist,
                'modality'     => $modality,
                'reportText'   => $reportText,
                'impression'   => $impression,
                'resultStatus' => 'received',
            ]);
        });

        if (!($result['ok'] ?? false)) {
            // Fallback: persistir directamente en el draft
            $result = self::mutateStore(static function (array $store) use (
                $sessionId, $imagingOrderId, $resultDate, $radiologist, $modality, $reportText, $impression
            ): array {
                $drafts = $store['clinical_history_drafts'] ?? [];
                foreach ($drafts as &$draft) {
                    if (trim((string) ($draft['sessionId'] ?? '')) !== $sessionId) continue;
                    $imagingOrders = $draft['imagingOrders'] ?? [];
                    foreach ($imagingOrders as &$order) {
                        if (trim((string) ($order['imagingOrderId'] ?? '')) !== $imagingOrderId) continue;
                        $order['resultStatus'] = 'received';
                        $order['result'] = [
                            'receivedAt'     => $resultDate,
                            'radiologistName'=> $radiologist,
                            'modality'       => $modality,
                            'reportText'     => $reportText,
                            'impression'     => $impression,
                        ];
                        break;
                    }
                    unset($order);
                    $draft['imagingOrders'] = $imagingOrders;
                    $draft['updatedAt'] = gmdate('c');
                    break;
                }
                unset($draft);
                $store['clinical_history_drafts'] = array_values($drafts);
                return ['ok' => true, 'store' => $store, 'data' => []];
            });
        }

        json_response([
            'ok'          => true,
            'result_saved'=> true,
            'impression'  => $impression,
        ]);
    }

    /**
     * S30-14: Recepción de reporte de interconsulta (el service ya existía, faltaba la ruta)
     * POST receive-interconsult-report
     * Payload: { session_id, interconsult_id, specialist_name, specialist_specialty, report_date, findings, recommendations }
     */
    public static function receiveInterconsultReport(array $context): void
    {
        if (!($context['isAdmin'] ?? false)) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }

        $payload = require_json_body();
        $service = new ClinicalHistoryService();
        $result = self::mutateStore(static function (array $store) use ($service, $payload): array {
            return $service->episodeAction($store, array_merge($payload, [
                'action' => 'receive_interconsult_report',
            ]));
        });

        self::emitMutationResponse($result);
    }

    /**
     * @param array<string,mixed> $data
     */
    private static function requireClinicalStorageReady(array $data): void
    {
        $readiness = function_exists('internal_console_readiness_snapshot')
            ? internal_console_readiness_snapshot()
            : null;
        $clinicalReady = function_exists('internal_console_clinical_data_ready')
            ? internal_console_clinical_data_ready($readiness)
            : (bool) ($readiness['clinicalData']['ready'] ?? true);

        if ($clinicalReady) {
            return;
        }

        $payload = function_exists('internal_console_clinical_guard_payload')
            ? internal_console_clinical_guard_payload([
                'surface' => 'clinical_history',
                'data' => $data,
            ])
            : [
                'ok' => false,
                'code' => 'clinical_storage_not_ready',
                'error' => 'Historias clinicas bloqueadas hasta habilitar almacenamiento cifrado.',
                'readiness' => $readiness,
                'surface' => 'clinical_history',
                'data' => $data,
            ];

        json_response($payload, 409);
    }

    /**
     * S30-06: Upload de PDF de resultado de laboratorio
     * POST clinical-lab-pdf-upload
     * Payload (multipart/form-data): session_id, lab_order_id, pdf
     */
    public static function uploadClinicalLabPdf(array $context): void
    {
        if (!($context['isAdmin'] ?? false)) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }

        $sessionId = trim((string) ($_POST['session_id'] ?? ''));
        $labOrderId = trim((string) ($_POST['lab_order_id'] ?? ''));

        if ($sessionId === '' || $labOrderId === '') {
            json_response(['ok' => false, 'error' => 'session_id y lab_order_id son requeridos'], 400);
        }

        if (!isset($_FILES['pdf']) || (int) ($_FILES['pdf']['error']) !== UPLOAD_ERR_OK) {
            json_response(['ok' => false, 'error' => 'No se recibio un archivo PDF valido'], 400);
        }

        $file = $_FILES['pdf'];
        $tmpName = trim((string) ($file['tmp_name'] ?? ''));
        $size = (int) ($file['size'] ?? 0);

        if ($size > 10485760) {
            json_response(['ok' => false, 'error' => 'El PDF debe pesar maximo 10 MB.'], 400);
        }

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = $finfo ? (string) finfo_file($finfo, $tmpName) : '';
        if ($finfo) {
            finfo_close($finfo);
        }

        if ($mime !== 'application/pdf') {
            json_response(['ok' => false, 'error' => 'El archivo debe ser un PDF válido (application/pdf).'], 400);
        }

        if (!ensure_clinical_media_dir()) {
            json_response(['ok' => false, 'error' => 'Error preparando almacenamiento.'], 500);
        }

        // Recuperar session_id -> case_id de store memory
        $lockResult = with_store_lock(static function () use ($sessionId, $labOrderId, $tmpName, $size, $mime): array {
            $store = read_store();
            require_once __DIR__ . '/../lib/clinical_history/ClinicalHistorySessionRepository.php';
            $session = \ClinicalHistorySessionRepository::findSessionBySessionId($store, $sessionId);
            if ($session === null) {
                return ['ok' => false, 'code' => 404, 'error' => 'Sesión clínica no encontrada'];
            }

            $caseId = $session['caseId'] ?? '';
            $patientSlug = preg_replace('/[^a-zA-Z0-9_-]/', '', $caseId);
            $fullTargetDir = clinical_media_dir_path() . DIRECTORY_SEPARATOR . $patientSlug . DIRECTORY_SEPARATOR . 'lab-results';
            
            if (!is_dir($fullTargetDir)) {
                @mkdir($fullTargetDir, 0750, true);
            }

            $timestamp = time();
            $safeOrderId = preg_replace('/[^a-zA-Z0-9_-]/', '', $labOrderId);
            $filename = $safeOrderId . '_' . $timestamp . '.pdf';
            $targetDiskPath = $fullTargetDir . DIRECTORY_SEPARATOR . $filename;

            if (is_uploaded_file($tmpName)) {
                if (!@move_uploaded_file($tmpName, $targetDiskPath)) {
                    return ['ok' => false, 'code' => 500, 'error' => 'Error guardando PDF físico.'];
                }
            } else {
                return ['ok' => false, 'code' => 400, 'error' => 'Archivo PDF inválido.'];
            }
            @chmod($targetDiskPath, 0640);

            $privatePath = 'clinical-media/' . $patientSlug . '/lab-results/' . $filename;
            $pdfUrl = '/api.php?resource=media-flow-private-asset&type=clinical_media&path=' . urlencode($privatePath);

            // Actualizar order result en el draft de esta sesion
            $drafts = $store['clinical_history_drafts'] ?? [];
            $updated = false;
            foreach ($drafts as &$draft) {
                if (trim((string) ($draft['sessionId'] ?? '')) !== $sessionId) continue;
                $labOrders = $draft['labOrders'] ?? [];
                foreach ($labOrders as &$order) {
                    if (trim((string) ($order['labOrderId'] ?? '')) !== $labOrderId) continue;
                    if (!isset($order['result']) || !is_array($order['result'])) {
                        $order['result'] = [];
                    }
                    $order['result']['pdfUrl'] = $pdfUrl;
                    $updated = true;
                    break;
                }
                unset($order);
                $draft['labOrders'] = $labOrders;
                $draft['updatedAt'] = gmdate('c');
                break;
            }
            unset($draft);

            if ($updated) {
                $store['clinical_history_drafts'] = array_values($drafts);
                write_store($store, false);
            }

            return ['ok' => true, 'pdfUrl' => $pdfUrl];
        });

        if (($lockResult['ok'] ?? false) !== true || (isset($lockResult['result']) && ($lockResult['result']['ok'] ?? false) !== true)) {
            $result = is_array($lockResult['result'] ?? null) ? $lockResult['result'] : $lockResult;
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'Error desconocido de subida PDF')
            ], (int) ($result['code'] ?? 500));
        }

        json_response([
            'ok' => true,
            'pdf_url' => $lockResult['result']['pdfUrl'] ?? ''
        ]);
    }

    /**
     * S30-18: Registro RAMs (Farmacovigilancia)
     * POST adverse-reaction-report
     */
    public static function reportAdverseReaction(array $context): void
    {
        $payload = require_json_body();
        $caseId = trim((string) ($payload['case_id'] ?? ''));
        $medication = trim((string) ($payload['medication'] ?? ''));
        $reaction = trim((string) ($payload['reaction'] ?? ''));
        $severity = trim((string) ($payload['severity'] ?? 'mild'));

        if ($caseId === '' || $medication === '' || $reaction === '') {
            json_response(['ok' => false, 'error' => 'case_id, medication y reaction son obligatorios'], 400);
        }

        $result = self::mutateStore(static function (array $store) use ($caseId, $medication, $reaction, $severity): array {
            $event = [
                'type' => 'adverse_drug_reaction',
                'caseId' => $caseId,
                'message' => "Reacción adversa reportada: {$reaction} tras uso de {$medication}",
                'metadata' => [
                    'medication' => $medication,
                    'reaction' => $reaction,
                    'severity' => $severity,
                    'reportedBy' => $_SESSION['admin_email'] ?? 'system',
                ],
                'status' => 'closed',
            ];

            require_once __DIR__ . '/../lib/clinical_history/ClinicalHistoryRepository.php';
            $upsertEvent = ClinicalHistoryRepository::upsertEvent($store, $event);
            return [
                'ok' => true,
                'store' => $upsertEvent['store'],
                'storeDirty' => true,
                'event' => $upsertEvent['event']
            ];
        });

        if (($result['ok'] ?? false) === false) {
            json_response(['ok' => false, 'error' => 'Error al guardar reacción'], 500);
        }

        // Add to RAMs registry JSONL for governance
        $ramsFile = __DIR__ . '/../data/adverse-reactions.jsonl';
        $reportData = json_encode([
            'caseId' => $caseId,
            'medication' => $medication,
            'reaction' => $reaction,
            'severity' => $severity,
            'reportedAt' => gmdate('c'),
            'eventId' => $result['event']['id'] ?? ''
        ]);
        file_put_contents($ramsFile, $reportData . "\n", FILE_APPEND);

        if ($severity === 'severe' || $severity === 'critical') {
            $cmd = sprintf(
                'php %s/../bin/notify-lab-critical.php --case_id=%s --test=%s --value=%s > /dev/null 2>&1 &',
                escapeshellarg(__DIR__),
                escapeshellarg($caseId),
                escapeshellarg('Reacción: ' . $medication),
                escapeshellarg($reaction . ' (' . $severity . ')')
            );
            @exec($cmd);
        }

        json_response([
            'ok' => true,
            'event' => $result['event'] ?? []
        ]);
    }
}
