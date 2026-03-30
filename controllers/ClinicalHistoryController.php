<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/clinical_history/bootstrap.php';
require_once __DIR__ . '/../lib/InternalConsoleReadiness.php';

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
        $doctorStr = htmlspecialchars($_SESSION['admin_email'] ?? 'Médico Tratante', ENT_QUOTES, 'UTF-8');

        $html = "
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset=\"utf-8\">
            <title>Plan de Tratamiento</title>
            <style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 40px; color: #111; }
                .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #c9a96e; padding-bottom: 20px; }
                .header h1 { margin: 0; font-size: 24px; color: #07090c; font-weight: bold; }
                .header p { margin: 5px 0 0 0; font-size: 14px; color: #666; }
                .title { font-size: 20px; font-weight: bold; text-align: center; margin-bottom: 30px; }
                .patient-info { margin-bottom: 30px; padding: 15px; background: #f9f9f9; border-radius: 4px; font-size: 14px; }
                .patient-info strong { display: inline-block; width: 100px; }
                .section { margin-bottom: 20px; }
                .section h3 { margin: 0 0 10px 0; font-size: 16px; color: #c9a96e; border-bottom: 1px solid #eee; padding-bottom: 5px; }
                .section p { margin: 0; font-size: 14px; line-height: 1.5; white-space: pre-wrap; }
                .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
                .signature { margin-top: 60px; text-align: right; }
                .signature-line { border-top: 1px solid #000; width: 200px; display: inline-block; margin-bottom: 5px; }
            </style>
        </head>
        <body>
            <div class=\"header\">
                <h1>Aurora Derm</h1>
                <p>Clínica Dermatológica Especializada</p>
                <p>Tel: +593 98 245 3672 | Quito, Ecuador</p>
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
                <div class=\"signature-line\"></div>
                <div><strong>{$doctorStr}</strong></div>
                <div style=\"font-size: 12px; color: #666;\">Registro MSP / Firma Autorizada</div>
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
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'Error de historia clinica'),
                'code' => (string) ($result['errorCode'] ?? 'clinical_history_error'),
            ], (int) ($result['statusCode'] ?? 500));
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
