<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/clinical_history/bootstrap.php';
require_once __DIR__ . '/../lib/InternalConsoleReadiness.php';
require_once __DIR__ . '/../lib/telemedicine/ClinicalMediaService.php';
require_once __DIR__ . '/../lib/DoctorProfileStore.php';
require_once __DIR__ . '/../lib/ClinicProfileStore.php';

final class ClinicalHistoryController
{
    private static function sessionGet(array $context): void
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

    private static function sessionPost(array $context): void
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

    private static function saveEvolution(array $context): void
    {
        require_doctor_auth();
        $payload = require_json_body();

        $caseId     = trim((string) ($payload['caseId'] ?? ''));
        $note       = trim((string) ($payload['note'] ?? ''));
        $type       = trim((string) ($payload['type'] ?? 'soap'));
        $findings   = trim((string) ($payload['findings'] ?? ''));
        $procedures = trim((string) ($payload['procedures'] ?? ''));
        $plan       = trim((string) ($payload['plan'] ?? ''));

        // S37-01: SOAP 4 campos con validación de completitud
        $soapSubjective = trim((string) ($payload['soap']['subjective'] ?? ($payload['note_subjective'] ?? '')));
        $soapObjective  = trim((string) ($payload['soap']['objective']  ?? ($payload['note_objective']  ?? '')));
        $soapAssessment = trim((string) ($payload['soap']['assessment'] ?? ($payload['note_assessment'] ?? '')));
        $soapPlan       = trim((string) ($payload['soap']['plan']       ?? $plan));

        if ($caseId === '') {
            json_response(['ok' => false, 'error' => 'caseId requerido'], 400);
        }

        if ($note === '' && $soapSubjective === '' && $soapObjective === '' && $soapAssessment === '') {
            json_response(['ok' => false, 'error' => 'La nota de la evolucion clinica no puede estar vacia'], 400);
        }

        // S37-01: Si type=soap validar que los 4 campos estén presentes
        if ($type === 'soap') {
            $missing = [];
            if ($soapSubjective === '') $missing[] = 'subjective';
            if ($soapObjective  === '') $missing[] = 'objective';
            if ($soapAssessment === '') $missing[] = 'assessment';
            if ($soapPlan       === '') $missing[] = 'plan';
            if ($missing !== []) {
                json_response(['ok' => false, 'error' => 'Nota SOAP incompleta', 'missing' => $missing], 400);
            }
        }

        $doctorData = doctor_profile_document_fields([
            'name' => trim((string) ($_SESSION['admin_email'] ?? '')),
        ]);

        $evolutionRecord = [
            'id' => 'ev_' . substr(hash('sha256', random_bytes(16)), 0, 16),
            'caseId' => $caseId,
            'type' => $type,
            'note' => $note,
            // S37-01: 4 campos SOAP estructurados
            'soap' => [
                'subjective'  => $soapSubjective ?: $note,
                'objective'   => $soapObjective,
                'assessment'  => $soapAssessment,
                'plan'        => $soapPlan ?: $plan,
                // legacy compat
                'findings'    => $findings,
                'procedures'  => $procedures,
            ],
            'author' => [
                'email' => trim((string) ($_SESSION['admin_email'] ?? '')),
                'name' => $doctorData['name'] ?? '',
                'specialty' => $doctorData['specialty'] ?? '',
                'msp' => $doctorData['msp'] ?? '',
            ],
            'createdAt' => local_date('c'),
        ];

        $tenantId = get_current_tenant_id();
        $casesDir = __DIR__ . '/../data/cases';
        if (!is_dir($casesDir)) {
            @mkdir($casesDir, 0750, true);
        }

        $patientSlug = preg_replace('/[^a-zA-Z0-9_-]/', '', $caseId);
        $caseDir = $casesDir . DIRECTORY_SEPARATOR . $patientSlug;
        if (!is_dir($caseDir)) {
            @mkdir($caseDir, 0750, true);
        }

        // S37-10: Compute integrity hash before persisting (allows tamper detection on read)
        $evolutionRecord['integrityHash'] = hash(
            'sha256',
            json_encode($evolutionRecord, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
        );

        $evolutionsPath = $caseDir . DIRECTORY_SEPARATOR . 'evolutions.jsonl';
        $entryLine = json_encode($evolutionRecord, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";

        $bytes = @file_put_contents($evolutionsPath, $entryLine, FILE_APPEND | LOCK_EX);
        if ($bytes === false) {
            json_response(['ok' => false, 'error' => 'No se pudo almacenar la evolucion clinica en el registro inmutable'], 500);
        }

        // Emit an event to timeline
        $now = local_date('c');
        $lockResult = with_store_lock(static function () use ($caseId, $tenantId, $now, $evolutionRecord): array {
            $store = read_store();
            
            $eventId = 'pte_' . substr(hash('sha1', 'pte|' . microtime(true) . '|' . bin2hex(random_bytes(8))), 0, 16);
            $store['patient_case_timeline_events'] = isset($store['patient_case_timeline_events']) && is_array($store['patient_case_timeline_events'])
                ? array_values($store['patient_case_timeline_events'])
                : [];
            
            $store['patient_case_timeline_events'][] = [
                'id' => $eventId,
                'tenantId' => $tenantId,
                'patientCaseId' => $caseId,
                'type' => 'clinical_evolution_added',
                'title' => 'Evolución clínica anexada (' . strtoupper($evolutionRecord['type']) . ')',
                'payload' => [
                    'evolutionId' => $evolutionRecord['id'],
                    'author' => $evolutionRecord['author']['name'] ?: $evolutionRecord['author']['email'],
                ],
                'createdAt' => $now,
            ];

            if (isset($store['cases'][$caseId])) {
                $store['cases'][$caseId]['latestActivityAt'] = $now;
            } elseif (isset($store['patient_cases'][$caseId])) {
                $store['patient_cases'][$caseId]['latestActivityAt'] = $now;
            }

            if (!write_store($store, false)) {
                return ['ok' => false];
            }
            return ['ok' => true];
        });

        json_response([
            'ok' => true,
            'savedAt' => $evolutionRecord['createdAt'],
            'evolution' => $evolutionRecord,
            'timeline_updated' => ($lockResult['ok'] ?? false) === true || (($lockResult['result']['ok'] ?? false) === true)
        ], 201);
    }

    /**
     * S37-03: GET clinical-evolution?caseId={id}&limit=10&offset=0
     * Reads evolutions.jsonl for the given case, paginated, newest first.
     * Verifies integrity hash per record and marks tampered entries.
     */
    private static function listEvolutions(array $context): void
    {
        require_doctor_auth();

        $caseId = trim((string) ($_GET['caseId'] ?? ''));
        if ($caseId === '') {
            json_response(['ok' => false, 'error' => 'caseId requerido'], 400);
        }

        $limit  = max(1, min(50, (int) ($_GET['limit']  ?? 10)));
        $offset = max(0, (int) ($_GET['offset'] ?? 0));

        $patientSlug = preg_replace('/[^a-zA-Z0-9_-]/', '', $caseId);
        $casesDir    = __DIR__ . '/../data/cases';
        $jsonlPath   = $casesDir . DIRECTORY_SEPARATOR . $patientSlug . DIRECTORY_SEPARATOR . 'evolutions.jsonl';

        if (!is_file($jsonlPath)) {
            json_response(['ok' => true, 'evolutions' => [], 'total' => 0, 'caseId' => $caseId]);
        }

        // Read all lines and parse — JSONL is append-only so newest = last line
        $lines = file($jsonlPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) {
            json_response(['ok' => false, 'error' => 'No se pudo leer el archivo de evoluciones'], 500);
        }

        $total = count($lines);
        // Newest first: reverse, slice, parse
        $lines   = array_reverse($lines);
        $sliced  = array_slice($lines, $offset, $limit);

        $evolutions = [];
        foreach ($sliced as $line) {
            $record = json_decode($line, true);
            if (!is_array($record)) {
                continue;
            }
            // S37-10: Integrity hash verification
            if (isset($record['integrityHash'])) {
                $hash         = $record['integrityHash'];
                $recordNoHash = $record;
                unset($recordNoHash['integrityHash']);
                $expected = hash('sha256', json_encode($recordNoHash, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
                if (!hash_equals($expected, $hash)) {
                    $record['tampered'] = true;
                    // Log integrity violation
                    $logEntry = json_encode([
                        'action'      => 'integrity_violation',
                        'caseId'      => $caseId,
                        'evolutionId' => $record['id'] ?? 'unknown',
                        'ts'          => date('c'),
                    ], JSON_UNESCAPED_UNICODE) . "\n";
                    @file_put_contents(__DIR__ . '/../data/hce-access-log.jsonl', $logEntry, FILE_APPEND | LOCK_EX);
                }
            }
            $evolutions[] = $record;
        }

        // Log read access (S37-11)
        $accessEntry = json_encode([
            'action'      => 'read_evolution',
            'caseId'      => $caseId,
            'accessed_by' => trim((string) ($_SESSION['admin_email'] ?? 'unknown')),
            'accessed_at' => date('c'),
            'ip'          => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        ], JSON_UNESCAPED_UNICODE) . "\n";
        @file_put_contents(__DIR__ . '/../data/hce-access-log.jsonl', $accessEntry, FILE_APPEND | LOCK_EX);

        json_response([
            'ok'         => true,
            'evolutions' => $evolutions,
            'total'      => $total,
            'limit'      => $limit,
            'offset'     => $offset,
            'caseId'     => $caseId,
        ]);
    }

    /**
     * S37-02: POST clinical-anamnesis
     * Saves structured anamnesis (antecedentes, alergias, medicamentos, habitos)
     * into draft.intake.structured_anamnesis for use by OpenClaw context.
     */
    private static function saveAnamnesis(array $context): void
    {
        require_doctor_auth();
        $payload = require_json_body();

        $caseId    = trim((string) ($payload['caseId']    ?? ''));
        $sessionId = trim((string) ($payload['sessionId'] ?? ''));

        if ($caseId === '') {
            json_response(['ok' => false, 'error' => 'caseId requerido'], 400);
        }

        $structuredAnamnesis = [
            'motivo_consulta'         => trim((string) ($payload['motivo_consulta']    ?? '')),
            'enfermedad_actual'       => trim((string) ($payload['enfermedad_actual']  ?? '')),
            'antecedentes_personales' => array_values(array_filter(
                (array) ($payload['antecedentes_personales'] ?? []),
                static fn ($x) => is_array($x) && isset($x['type'])
            )),
            'antecedentes_familiares' => array_values(array_filter(
                (array) ($payload['antecedentes_familiares'] ?? []),
                static fn ($x) => is_array($x) && isset($x['type'])
            )),
            'medicamentos_actuales'   => array_values(array_filter(
                (array) ($payload['medicamentos_actuales'] ?? []),
                static fn ($x) => is_array($x) && !empty($x['name'])
            )),
            'alergias'                => array_values(array_filter(
                (array) ($payload['alergias'] ?? []),
                static fn ($x) => is_array($x) && !empty($x['allergen'])
            )),
            'habitos'                 => is_array($payload['habitos'] ?? null)
                ? $payload['habitos']
                : [],
            'recorded_at'             => date('c'),
            'recorded_by'             => trim((string) ($_SESSION['admin_email'] ?? '')),
        ];

        // Persist into the session draft via store lock
        $tenantId  = get_current_tenant_id();
        $result = mutate_store(static function (array $store) use ($caseId, $sessionId, $structuredAnamnesis, $tenantId): array {
            // Try to find the active session for this case
            $sessions = $store['clinical_history_sessions'] ?? [];
            $found    = false;
            foreach ($sessions as $sid => $session) {
                $matchCase    = (string) ($session['caseId'] ?? $session['case_id'] ?? '') === $caseId;
                $matchSession = $sessionId === '' || (string) ($session['id'] ?? $sid) === $sessionId;
                $isOpen       = in_array($session['status'] ?? '', ['open', 'active', 'draft', ''], true);
                if ($matchCase && $matchSession && $isOpen) {
                    $store['clinical_history_sessions'][$sid]['draft']['intake']['structured_anamnesis'] = $structuredAnamnesis;
                    $store['clinical_history_sessions'][$sid]['anamnesis_updated_at'] = date('c');
                    $found = true;
                    break;
                }
            }
            return ['ok' => true, 'store' => $store, 'storeDirty' => $found, 'found' => $found];
        });

        // Log write access (S37-11)
        $accessEntry = json_encode([
            'action'      => 'write_anamnesis',
            'caseId'      => $caseId,
            'accessed_by' => trim((string) ($_SESSION['admin_email'] ?? 'unknown')),
            'accessed_at' => date('c'),
            'ip'          => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        ], JSON_UNESCAPED_UNICODE) . "\n";
        @file_put_contents(__DIR__ . '/../data/hce-access-log.jsonl', $accessEntry, FILE_APPEND | LOCK_EX);

        json_response([
            'ok'          => true,
            'caseId'      => $caseId,
            'savedAt'     => $structuredAnamnesis['recorded_at'],
            'fields_saved' => array_keys(array_filter($structuredAnamnesis, static fn ($v) => $v !== '' && $v !== [])),
        ], 201);
    }

    private static function messagePost(array $context): void
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

    private static function reviewGet(array $context): void
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

    private static function reviewPatch(array $context): void
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

    private static function recordGet(array $context): void
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

    private static function recordPatch(array $context): void
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

    private static function episodeActionPost(array $context): void
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

    private static function getCarePlanPdf(array $context): void
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

    private static function uploadMedia(array $context): void
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

    private static function getClinicalPhotos(array $context): void
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

    private static function uploadClinicalPhoto(array $context): void
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
    private static function saveVitals(array $context): void
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
    private static function vitalsHistory(array $context): void
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
    private static function receiveLabResult(array $context): void
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
                        $scriptPath = realpath(__DIR__ . '/../bin/notify-lab-critical.php');
                        if ($scriptPath !== false && file_exists($scriptPath)) {
                            $cmd = 'php ' . escapeshellarg($scriptPath) . ' --case_id=' . escapeshellarg($localCaseId) . ' --test=' . $argTest . ' --value=' . $argValue . ' > /dev/null 2>&1 &';
                            @exec($cmd);
                        } else {
                            error_log('[S30-07] notify-lab-critical.php not found — skipping exec, audit_log only');
                        }
                    }
                }
            }
        }

        // S34-05: Push Notification Patient
        require_once __DIR__ . '/../lib/clinical_history/ClinicalHistorySessionRepository.php';
        $session = \ClinicalHistorySessionRepository::findSessionBySessionId(read_store(), $sessionId);
        $patient = [];
        if ($session && isset($session['patientId'])) {
            $store = read_store();
            foreach (($store['patients'] ?? []) as $p) {
                if (($p['id'] ?? '') === $session['patientId']) {
                    $patient = $p;
                    break;
                }
            }
        }
        $pushSent = false;
        if (!empty($patient)) {
            require_once __DIR__ . '/../lib/NotificationService.php';
            \NotificationService::sendLabResultReadyPush($patient, $labName);
            $pushSent = true;
        }

        json_response([
            'ok'             => true,
            'result_saved'   => true,
            'critical_values'=> $criticalValues,
            'alert_sent'     => !empty($criticalValues),
            'push_sent'      => $pushSent,
            'patient_notified_at' => gmdate('c'),
        ]);
    }

    /**
     * S30-09: Ingesta de resultado de imagen (radiología)
     * POST receive-imaging-result
     * Payload: { session_id, imaging_order_id, result_date, radiologist_name, modality, report_text, impression }
     */
    private static function receiveImagingResult(array $context): void
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
    private static function receiveInterconsultReport(array $context): void
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
    private static function uploadClinicalLabPdf(array $context): void
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
    private static function reportAdverseReaction(array $context): void
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
            $scriptPath = realpath(__DIR__ . '/../bin/notify-lab-critical.php');
            if ($scriptPath !== false && file_exists($scriptPath)) {
                $cmd = sprintf(
                    'php %s --case_id=%s --test=%s --value=%s > /dev/null 2>&1 &',
                    escapeshellarg($scriptPath),
                    escapeshellarg($caseId),
                    escapeshellarg('RAM: ' . $medication),
                    escapeshellarg($reaction . ' (' . $severity . ')')
                );
                @exec($cmd);
            } else {
                error_log('[S30-18] notify-lab-critical.php not found — RAM severa sin notificación push');
            }
        }

        json_response([
            'ok' => true,
            'event' => $result['event'] ?? []
        ]);
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
    private static function getAuditLog(array $context): void
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
    private static function adminLabShare(array $context): void
    {
        require_doctor_auth();
        $payload    = require_json_body();
        $sessionId  = trim((string) ($payload['session_id']   ?? ''));
        $labOrderId = trim((string) ($payload['lab_order_id'] ?? ''));
        $shared     = (bool) ($payload['shared'] ?? false);
        if ($sessionId === '' || $labOrderId === '') {
            json_response(['ok' => false, 'error' => 'session_id y lab_order_id requeridos'], 400);
            return;
        }
        $result = mutate_store(static function (array $store) use ($sessionId, $labOrderId, $shared): array {
            $found = false;
            foreach (array_keys($store['clinical_history_sessions'] ?? []) as $sid) {
                $sess = $store['clinical_history_sessions'][$sid];
                if (trim((string) ($sess['sessionId'] ?? $sid)) !== $sessionId) {
                    continue;
                }
                $orders = $store['clinical_history_sessions'][$sid]['draft']['documents']['labOrders'] ?? [];
                foreach (array_keys($orders) as $oidx) {
                    $oid = trim((string) ($orders[$oidx]['labOrderId'] ?? $orders[$oidx]['id'] ?? ''));
                    if ($oid !== $labOrderId) {
                        continue;
                    }
                    $store['clinical_history_sessions'][$sid]['draft']['documents']['labOrders'][$oidx]['shared_with_patient'] = $shared;
                    $store['clinical_history_sessions'][$sid]['draft']['documents']['labOrders'][$oidx]['shared_updated_at']   = gmdate('c');
                    $found = true;
                    break 2;
                }
            }
            return ['ok' => $found, 'store' => $store, 'storeDirty' => $found, 'found' => $found];
        });
        if (!($result['found'] ?? false)) {
            json_response(['ok' => false, 'error' => 'lab_order_id no encontrado'], 404);
            return;
        }
        json_response([
            'ok'                  => true,
            'lab_order_id'        => $labOrderId,
            'shared_with_patient' => $shared,
            'updated_at'          => gmdate('c'),
        ]);
    }
}
