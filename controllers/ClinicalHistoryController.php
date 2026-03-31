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

    private static function mutateStore(callable $callback): array
    {
        $lockResult = with_store_lock(static function () use ($callback): array {
            $store = read_store();
            $result = $callback($store);
            if (($result['ok'] ?? false) !== true) {
                return $result;
            }

            $nextStore = isset($result['store']) && is_array($result['store']) ? $result['store'] : $store;
            if (!write_store($nextStore, false)) {
                return [
                    'ok' => false,
                    'statusCode' => 503,
                    'error' => 'No se pudo guardar la historia clinica',
                    'errorCode' => 'clinical_history_store_failed',
                ];
            }

            $result['store'] = $nextStore;
            return $result;
        });

        if (($lockResult['ok'] ?? false) !== true) {
            return [
                'ok' => false,
                'statusCode' => (int) ($lockResult['code'] ?? 503),
                'error' => (string) ($lockResult['error'] ?? 'Store lock failed'),
                'errorCode' => 'clinical_history_lock_failed',
            ];
        }

        return isset($lockResult['result']) && is_array($lockResult['result'])
            ? $lockResult['result']
            : [
                'ok' => false,
                'statusCode' => 500,
                'error' => 'Respuesta invalida de historia clinica',
                'errorCode' => 'clinical_history_internal_error',
            ];
    }

    private static function readStore(callable $callback): array
    {
        $lockResult = with_store_lock(static function () use ($callback): array {
            $store = read_store();
            $result = $callback($store);
            if (($result['ok'] ?? false) !== true) {
                return $result;
            }

            $nextStore = isset($result['store']) && is_array($result['store']) ? $result['store'] : $store;
            if (($result['mutated'] ?? false) === true && !write_store($nextStore, false)) {
                return [
                    'ok' => false,
                    'statusCode' => 503,
                    'error' => 'No se pudo guardar la historia clinica',
                    'errorCode' => 'clinical_history_store_failed',
                ];
            }

            $result['store'] = $nextStore;
            return $result;
        });

        if (($lockResult['ok'] ?? false) !== true) {
            return [
                'ok' => false,
                'statusCode' => (int) ($lockResult['code'] ?? 503),
                'error' => (string) ($lockResult['error'] ?? 'Store lock failed'),
                'errorCode' => 'clinical_history_lock_failed',
            ];
        }

        return isset($lockResult['result']) && is_array($lockResult['result'])
            ? $lockResult['result']
            : [
                'ok' => false,
                'statusCode' => 500,
                'error' => 'Respuesta invalida de historia clinica',
                'errorCode' => 'clinical_history_internal_error',
            ];
    }

    private static function emitMutationResponse(array $result): void
    {
        if (($result['ok'] ?? false) !== true) {
            $payload = [
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'Error de historia clinica'),
                'code' => (string) ($result['errorCode'] ?? 'clinical_history_error'),
            ];
            if (array_key_exists('data', $result)) {
                $payload['data'] = $result['data'];
            }
            if (array_key_exists('blockingReasons', $result)) {
                $payload['blockingReasons'] = $result['blockingReasons'];
            }
            json_response($payload, (int) ($result['statusCode'] ?? 500));
        }

        $payload = [
            'ok' => true,
            'data' => $result['data'] ?? [],
        ];
        if (array_key_exists('replay', $result)) {
            $payload['replay'] = (bool) $result['replay'];
        }

        json_response($payload, (int) ($result['statusCode'] ?? 200));
    }

    public static function galleryGet(array $context): void
    {
        if (($context['isAdmin'] ?? false) !== true) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }

        $caseId = ClinicalHistoryRepository::trimString($_GET['case_id'] ?? '');
        if ($caseId === '') {
            json_response(['ok' => false, 'error' => 'Case ID requerido'], 400);
        }

        self::requireClinicalStorageReady([
            'gallery' => [],
        ]);

        $service = new ClinicalHistoryService();
        $result = self::readStore(static function (array $store) use ($service, $caseId): array {
            return $service->getPatientGallery($store, $caseId);
        });

        json_response([
            'ok' => true,
            'data' => $result['data'] ?? [],
        ]);
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
}
