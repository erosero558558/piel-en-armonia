<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/clinical_history/ClinicalMediaService.php';
require_once __DIR__ . '/../lib/clinical_history/ClinicalVitalsService.php';
require_once __DIR__ . '/../lib/clinical_history/ClinicalExternalResultsService.php';
require_once __DIR__ . '/../lib/clinical_history/ClinicalEvolutionService.php';


require_once __DIR__ . '/../lib/clinical_history/bootstrap.php';
require_once __DIR__ . '/../lib/InternalConsoleReadiness.php';
require_once __DIR__ . '/../lib/telemedicine/ClinicalMediaService.php';
require_once __DIR__ . '/../lib/DoctorProfileStore.php';
require_once __DIR__ . '/../lib/ClinicProfileStore.php';

final class ClinicalHistoryController
{

    private static function readStore(callable $reader): array
    {
        return $reader(read_store());
    }

    private static function mutateStore(callable $mutation): array
    {
        return mutate_store($mutation);
    }

    private static function emitMutationResponse(array $result): void
    {
        if (($result['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'Falló la persistencia en historia clinica'),
                'code' => (string) ($result['errorCode'] ?? 'clinical_error')
            ], (int) ($result['statusCode'] ?? 500));
        }

        json_response([
            'ok' => true,
            'data' => is_array($result['data'] ?? null) ? $result['data'] : []
        ]);
    }

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

    public static function saveEvolution(array $params): void
    {
        ClinicalEvolutionService::saveEvolution($params);
    }

    public static function listEvolutions(array $params): void
    {
        ClinicalEvolutionService::listEvolutions($params);
    }

    public static function saveAnamnesis(array $params): void
    {
        ClinicalEvolutionService::saveAnamnesis($params);
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

    public static function reviewGet(array $params): void
    {
        ClinicalEvolutionService::reviewGet($params);
    }

    public static function reviewPatch(array $params): void
    {
        ClinicalEvolutionService::reviewPatch($params);
    }

    public static function galleryGet(array $params): void
    {
        ClinicalMediaService::galleryGet($params);
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

    public static function uploadMedia(array $params): void
    {
        ClinicalMediaService::uploadMedia($params);
    }

    public static function getClinicalPhotos(array $params): void
    {
        ClinicalMediaService::getClinicalPhotos($params);
    }

    public static function uploadClinicalPhoto(array $params): void
    {
        ClinicalMediaService::uploadClinicalPhoto($params);
    }

    public static function saveVitals(array $params): void
    {
        ClinicalVitalsService::saveVitals($params);
    }

    public static function vitalsHistory(array $params): void
    {
        ClinicalVitalsService::vitalsHistory($params);
    }

    public static function receiveLabResult(array $params): void
    {
        ClinicalExternalResultsService::receiveLabResult($params);
    }

    public static function receiveImagingResult(array $params): void
    {
        ClinicalExternalResultsService::receiveImagingResult($params);
    }

    public static function receiveInterconsultReport(array $params): void
    {
        ClinicalExternalResultsService::receiveInterconsultReport($params);
    }

public static function requireClinicalStorageReady(array $data): void
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

    public static function uploadClinicalLabPdf(array $params): void
    {
        ClinicalExternalResultsService::uploadClinicalLabPdf($params);
    }

    public static function reportAdverseReaction(array $params): void
    {
        ClinicalVitalsService::reportAdverseReaction($params);
    }

public static function handle(array $context): void
    {
        $resource = $context['resource'] ?? '';
        $method = $context['method'] ?? 'GET';
        $key = "$method:$resource";
        
        switch ($key) {
            case 'GET:clinical-history-session':
                self::sessionGet($context);
                return;
            case 'POST:clinical-history-session':
                self::sessionPost($context);
                return;
            case 'POST:clinical-evolution':
                self::saveEvolution($context);
                return;
            case 'GET:clinical-evolution':
                self::listEvolutions($context);
                return;
            case 'POST:clinical-anamnesis':
                self::saveAnamnesis($context);
                return;
            case 'GET:hce-audit-log':          // S37-11
                self::getAuditLog($context);
                return;
            case 'POST:admin-lab-result-share': // S37-06
                self::adminLabShare($context);
                return;
            case 'POST:clinical-history-message':
                self::messagePost($context);
                return;
            case 'GET:clinical-history-review':
                self::reviewGet($context);
                return;
            case 'PATCH:clinical-history-review':
                self::reviewPatch($context);
                return;
            case 'GET:clinical-record':
                self::recordGet($context);
                return;
            case 'PATCH:clinical-record':
                self::recordPatch($context);
                return;
            case 'POST:clinical-episode-action':
                self::episodeActionPost($context);
                return;
            case 'GET:care-plan-pdf':
                self::getCarePlanPdf($context);
                return;
            case 'POST:clinical-media-upload':
                self::uploadMedia($context);
                return;
            case 'GET:clinical-photos':
                self::getClinicalPhotos($context);
                return;
            case 'POST:clinical-photo-upload':
                self::uploadClinicalPhoto($context);
                return;
            case 'POST:clinical-vitals':
                self::saveVitals($context);
                return;
            case 'GET:patient-vitals-history':
                self::vitalsHistory($context);
                return;
            case 'POST:receive-lab-result':
                self::receiveLabResult($context);
                return;
            case 'POST:clinical-lab-pdf-upload':
                self::uploadClinicalLabPdf($context);
                return;
            case 'POST:receive-imaging-result':
                self::receiveImagingResult($context);
                return;
            case 'POST:receive-interconsult-report':
                self::receiveInterconsultReport($context);
                return;
            case 'POST:adverse-reaction-report':
                self::reportAdverseReaction($context);
                return;
            default:
                if (isset($context['action'])) {
                    $action = $context['action'];
                    switch ($action) {
                        case 'sessionGet':
                            self::sessionGet($context);
                            return;
                        case 'sessionPost':
                            self::sessionPost($context);
                            return;
                        case 'saveEvolution':
                            self::saveEvolution($context);
                            return;
                        case 'listEvolutions':
                            self::listEvolutions($context);
                            return;
                        case 'saveAnamnesis':
                            self::saveAnamnesis($context);
                            return;
                        case 'messagePost':
                            self::messagePost($context);
                            return;
                        case 'reviewGet':
                            self::reviewGet($context);
                            return;
                        case 'reviewPatch':
                            self::reviewPatch($context);
                            return;
                        case 'recordGet':
                            self::recordGet($context);
                            return;
                        case 'recordPatch':
                            self::recordPatch($context);
                            return;
                        case 'episodeActionPost':
                            self::episodeActionPost($context);
                            return;
                        case 'getCarePlanPdf':
                            self::getCarePlanPdf($context);
                            return;
                        case 'uploadMedia':
                            self::uploadMedia($context);
                            return;
                        case 'getClinicalPhotos':
                            self::getClinicalPhotos($context);
                            return;
                        case 'uploadClinicalPhoto':
                            self::uploadClinicalPhoto($context);
                            return;
                        case 'saveVitals':
                            self::saveVitals($context);
                            return;
                        case 'vitalsHistory':
                            self::vitalsHistory($context);
                            return;
                        case 'receiveLabResult':
                            self::receiveLabResult($context);
                            return;
                        case 'uploadClinicalLabPdf':
                            self::uploadClinicalLabPdf($context);
                            return;
                        case 'receiveImagingResult':
                            self::receiveImagingResult($context);
                            return;
                        case 'receiveInterconsultReport':
                            self::receiveInterconsultReport($context);
                            return;
                        case 'reportAdverseReaction':
                            self::reportAdverseReaction($context);
                            return;
                    }
                }
                json_response(['ok' => false, 'error' => 'Not found in controller dispatch: ' . $key], 404);
        }
    }

    // ── S37-11: GET hce-audit-log ─────────────────────────────────────────────

public static function getAuditLog(array $context): void
    {
        require_doctor_auth();
        $caseId = trim((string) ($context['query']['caseId'] ?? $context['query']['case_id'] ?? ''));
        $limit  = max(1, min(100, (int) ($context['query']['limit']  ?? 20)));
        $offset = max(0,          (int) ($context['query']['offset'] ?? 0));
        $logPath = __DIR__ . '/../data/hce-access-log.jsonl';
        if (!file_exists($logPath)) {
            json_response(['ok' => true, 'entries' => [], 'total' => 0]);
            return;
        }
        $lines = file($logPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) {
            json_response(['ok' => true, 'entries' => [], 'total' => 0]);
            return;
        }
        $entries = [];
        foreach ($lines as $line) {
            $decoded = json_decode($line, true);
            if (!is_array($decoded)) {
                continue;
            }
            if ($caseId !== '' && ($decoded['case_id'] ?? $decoded['caseId'] ?? '') !== $caseId) {
                continue;
            }
            $entries[] = $decoded;
        }
        $entries = array_reverse($entries);
        $total   = count($entries);
        $paged   = array_values(array_slice($entries, $offset, $limit));
        json_response([
            'ok'      => true,
            'entries' => $paged,
            'total'   => $total,
            'limit'   => $limit,
            'offset'  => $offset,
            'has_more'=> ($offset + $limit) < $total,
        ]);
    }

    // ── S37-06: POST admin-lab-result-share ───────────────────────────────────

    public static function adminLabShare(array $params): void
    {
        ClinicalExternalResultsService::adminLabShare($params);
    }

}
