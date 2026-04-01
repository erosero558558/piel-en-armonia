<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/openclaw/AIRouter.php';
require_once __DIR__ . '/../lib/DoctorProfileStore.php';
require_once __DIR__ . '/../lib/ClinicProfileStore.php';
require_once __DIR__ . '/../lib/email.php';

/**
 * OpenclawController — Copiloto clínico de Aurora Derm
 *
 * Endpoints consumidos por:
 *   - js/openclaw-chat.js  (interfaz de consulta embebida en admin)
 *   - openapi-openclaw.yaml (Custom GPT Actions de ChatGPT)
 *
 * Todos los endpoints requieren sesión de médico autenticado (admin).
 * El contexto del paciente viene del store de Flow OS.
 */
final class OpenclawController
{
    // ── patient ──────────────────────────────────────────────────────────────

    /**
     * GET /api.php?resource=openclaw-patient&patient_id=X&case_id=Y
     * Carga el contexto completo del paciente para alimentar la IA.
     * Este es el dato que diferencia a OpenClaw de ChatGPT solo.
     */
    public static function patient(array $context): void
    {
        self::requireAuth();

        $patientId = trim((string) ($_GET['patient_id'] ?? ''));
        $caseId    = trim((string) ($_GET['case_id'] ?? ''));

        if ($patientId === '') {
            json_response(['ok' => false, 'error' => 'patient_id requerido'], 400);
        }

        $store   = self::readStore();

        // Obtener caso: buscar por caseId directo, o por patientId (caso activo)
        $case = null;
        if ($caseId !== '') {
            $case = $store['cases'][$caseId]
                ?? $store['patient_cases'][$caseId]
                ?? null;
            // Fallback: buscar en array plano
            if ($case === null) {
                foreach (array_merge($store['cases'] ?? [], $store['patient_cases'] ?? []) as $c) {
                    if (($c['id'] ?? '') === $caseId) { $case = $c; break; }
                }
            }
        } else {
            foreach (array_merge($store['cases'] ?? [], $store['patient_cases'] ?? []) as $c) {
                if (($c['patientId'] ?? '') === $patientId
                    && in_array($c['status'] ?? $c['stage'] ?? '', ['active', 'open', 'in_consultation'], true)) {
                    $case = $c;
                    break;
                }
            }
        }

        if ($case === null) {
            json_response(['ok' => false, 'error' => 'Caso no encontrado'], 404);
        }

        require_once __DIR__ . '/../lib/clinical_history/ClinicalHistoryService.php';
        $chService = new ClinicalHistoryService();

        // Historial clínico
        $history = $chService->getPatientHistory($store, $patientId);

        // Último diagnóstico
        $lastDx = null;
        foreach (array_reverse($history['episodes'] ?? []) as $ep) {
            if (!empty($ep['cie10_code'])) {
                $lastDx = [
                    'code'        => $ep['cie10_code'],
                    'description' => $ep['cie10_description'] ?? '',
                    'date'        => $ep['date'] ?? '',
                    'doctor'      => $ep['doctor'] ?? '',
                ];
                break;
            }
        }

        // Medicamentos activos (última receta activa)
        $medications = [];
        foreach (array_reverse($history['prescriptions'] ?? []) as $rx) {
            if (($rx['status'] ?? '') === 'active') {
                $medications = $rx['medications'] ?? [];
                break;
            }
        }

        // Alergias del paciente
        $allergies = $history['allergies'] ?? [];

        // Resumen IA de últimas 3 visitas (si existe)
        $lastVisitSummary = $history['ai_summary'] ?? null;

        // Últimas 5 visitas para el contexto
        $visits = array_map(static function (array $ep): array {
            return [
                'date'   => $ep['date'] ?? '',
                'reason' => $ep['reason'] ?? $ep['cie10_description'] ?? 'Consulta',
                'doctor' => $ep['doctor'] ?? '',
            ];
        }, array_slice(array_reverse($history['episodes'] ?? []), 0, 5));

        require_once __DIR__ . '/../lib/clinical_history/ClinicalHistorySessionRepository.php';
        $activeSession = ClinicalHistorySessionRepository::findSessionByCaseId($store, $case['id'] ?? $caseId);
        $vitalAlerts = [];
        $vitalAlertCritical = false;
        $integrityWarning = false;
        if ($activeSession !== null) {
            $draft = ClinicalHistorySessionRepository::findDraftBySessionId($store, (string) ($activeSession['sessionId'] ?? ''));
            if ($draft !== null) {
                $vitalAlerts = $draft['intake']['vitalSigns']['vitalAlerts'] ?? [];
                $vitalAlertCritical = count($vitalAlerts) > 0;
                
                // S31-08: Check clinical session integrity
                if (($draft['status'] ?? '') === 'closed' && ($draft['integrityHash'] ?? '') !== '') {
                    $computed = ClinicalHistorySessionRepository::hashDraft($draft);
                    if ($computed !== $draft['integrityHash']) {
                        $integrityWarning = true;
                    }
                }
            }
        }

        // Labs pendientes o recientes (S30-19)
        $pendingLabs = [];
        $labOrders = $case['labOrders'] ?? [];
        foreach ($labOrders as $order) {
            if (($order['resultStatus'] ?? '') === 'not_received') {
                $pendingLabs[] = $order['labName'] ?? 'Laboratorio pendiente';
            } elseif (($order['resultStatus'] ?? '') === 'received') {
                $daysDiff = (time() - strtotime($order['receivedAt'] ?? date('c'))) / 86400;
                if ($daysDiff <= 30) {
                    $pendingLabs[] = ($order['labName'] ?? 'Laboratorio') . ' (Resultados recientes disponibles)';
                }
            }
        }

        // Estado de condiciones crónicas
        $chronicStatus = [];
        $conditions = $case['chronicConditions'] ?? ($store['patients'][$patientId]['chronicConditions'] ?? []);
        foreach ($conditions as $cond) {
            $statusStr = $cond['cie10Label'] ?? $cond['cie10Code'] ?? 'Condición';
            if (($cond['status'] ?? '') !== 'controlled') {
                $statusStr .= ' (Descontrolado/Vencido)';
            } else {
                $statusStr .= ' (Controlado)';
            }
            $chronicStatus[] = $statusStr;
        }

        $selfReportedVitals = null;
        if (isset($draft['intake']['vitalSigns']['source']) && $draft['intake']['vitalSigns']['source'] === 'patient_self_report') {
            $selfReportedVitals = $draft['intake']['vitalSigns'];
        }

        $interVisitSummary = [
            'last_diagnosis' => $lastDx,
            'active_medications' => $medications,
            'last_evolution_date' => $history['last_evolution'] ?? '',
            'pending_labs' => $pendingLabs,
            'chronic_status' => $chronicStatus,
            'self_reported_vitals' => $selfReportedVitals
        ];

        // S31-09: Log de acceso a HCE por médico
        $logEntry = json_encode([
            'case_id' => $case['id'] ?? $caseId,
            'accessed_by' => $_SESSION['admin_email'] ?? 'unknown',
            'accessed_at' => gmdate('c'),
            'ip' => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
            'action' => 'view_context',
        ], JSON_UNESCAPED_UNICODE) . PHP_EOL;
        file_put_contents(__DIR__ . '/../data/hce-access-log.jsonl', $logEntry, FILE_APPEND | LOCK_EX);

        json_response([
            'ok' => true,
            'integrity_warning'  => $integrityWarning,
            'vital_alerts'       => $vitalAlerts,
            'vital_alert_critical' => $vitalAlertCritical,
            'patient_id'       => $patientId,
            'case_id'          => $case['id'] ?? $caseId,
            'name'             => trim(($case['firstName'] ?? '') . ' ' . ($case['lastName'] ?? '')),
            'age'              => self::calculateAge($case['birthDate'] ?? ''),
            'sex'              => $case['sex'] ?? '',
            'phone'            => $case['phone'] ?? '',
            'allergies'        => $allergies,
            'medications_active' => $medications,
            'diagnoses_history'  => array_slice(array_filter(
                array_map(static fn($ep) => isset($ep['cie10_code']) ? [
                    'cie10_code'         => $ep['cie10_code'],
                    'cie10_description'  => $ep['cie10_description'] ?? '',
                    'date'               => $ep['date'] ?? '',
                    'doctor'             => $ep['doctor'] ?? '',
                ] : null, array_reverse($history['episodes'] ?? []))
            ), 0, 10),
            'last_dx'            => $lastDx,
            'last_evolution'     => $history['last_evolution'] ?? '',
            'last_visit_date'    => $visits[0]['date'] ?? '',
            'visit_count'        => count($history['episodes'] ?? []),
            'photos_available'   => !empty($history['photos']),
            'ai_summary'         => $lastVisitSummary,
            'inter_visit_summary' => $interVisitSummary,
        ]);
    }

    // ── cie10Suggest ──────────────────────────────────────────────────────────

    /**
     * GET /api.php?resource=openclaw-cie10-suggest&q=dermatitis+atopica
     * Búsqueda rápida en el catálogo CIE-10 local.
     * Latencia objetivo: <50ms (es solo búsqueda en JSON).
     */
    public static function cie10Suggest(array $context): void
    {
        self::requireAuth();

        $q = strtolower(trim((string) ($_GET['q'] ?? '')));
        if (strlen($q) < 2) {
            json_response(['ok' => true, 'suggestions' => []]);
        }

        $cie10Path = __DIR__ . '/../data/cie10.json';
        if (!file_exists($cie10Path)) {
            json_response(['ok' => false, 'error' => 'Catálogo CIE-10 no disponible'], 503);
        }

        $data  = json_decode((string) file_get_contents($cie10Path), true) ?? [];
        $codes = $data['codes'] ?? [];

        $suggestions = [];
        $qWords      = explode(' ', $q);

        foreach ($codes as $code => $info) {
            $description = strtolower((string) ($info['d'] ?? ''));
            $category    = strtolower((string) ($info['c'] ?? ''));
            $codeL       = strtolower($code);

            $score = 0;

            // Exact code match
            if ($codeL === $q || str_starts_with($codeL, $q)) {
                $score += 100;
            }

            // All words present in description
            $allFound = true;
            foreach ($qWords as $word) {
                if (!str_contains($description, $word) && !str_contains($category, $word)) {
                    $allFound = false;
                    break;
                }
            }
            if ($allFound && count($qWords) > 1) {
                $score += 80;
            }

            // Partial word match
            foreach ($qWords as $word) {
                if (str_contains($description, $word)) {
                    $score += 20;
                }
                if (str_contains($category, $word)) {
                    $score += 10;
                }
            }

            if ($score > 0) {
                $suggestions[] = [
                    'code'        => $code,
                    'description' => $info['d'],
                    'category'    => $info['c'],
                    'confidence'  => min(1.0, round($score / 100, 2)),
                ];
            }
        }

        // Sort by confidence DESC
        usort($suggestions, static fn($a, $b) => $b['confidence'] <=> $a['confidence']);

        json_response([
            'ok'          => true,
            'suggestions' => array_slice($suggestions, 0, 8),
        ]);
    }

    // ── protocol ─────────────────────────────────────────────────────────────

    /**
     * GET /api.php?resource=openclaw-protocol&code=L20.0
     * Devuelve el protocolo de tratamiento estándar para un diagnóstico CIE-10.
     * Los protocolos se pueden extender en data/protocols/{code}.json
     */
    public static function protocol(array $context): void
    {
        self::requireAuth();

        $code = strtoupper(trim((string) ($_GET['code'] ?? '')));
        if ($code === '') {
            json_response(['ok' => false, 'error' => 'code requerido'], 400);
        }

        // Buscar protocolo específico
        $protocolPath = __DIR__ . '/../data/protocols/' . preg_replace('/[^A-Z0-9.]/', '', $code) . '.json';
        if (file_exists($protocolPath)) {
            $protocol = json_decode((string) file_get_contents($protocolPath), true) ?? [];
            json_response(['ok' => true] + $protocol);
        }

        // Protocolo genérico por categoría CIE-10
        $generic = self::genericProtocol($code);
        json_response(['ok' => true] + $generic);
    }

    // ── chat ─────────────────────────────────────────────────────────────────

    /**
     * POST /api.php?resource=openclaw-chat
     * Proxy al AI Router — Tier 1 (Codex OAuth) → Tier 2 (OpenRouter free) → Tier 3 (local)
     * Streaming support: si ?stream=1, devuelve SSE.
     */
    public static function chat(array $context): void
    {
        self::requireAuth();

        $payload = require_json_body();

        require_once __DIR__ . '/../lib/openclaw/AIRouter.php';
        $router = new OpenclawAIRouter();
        $result = $router->route($payload);

        if (!$result['ok']) {
            json_response([
                'ok'    => false,
                'error' => $result['error'] ?? 'Router error',
                'mode'  => 'failed',
            ], 503);
        }

        $response = [
            'ok'           => true,
            'choices'      => $result['choices'],
            'provider'     => $result['provider_used'] ?? 'unknown',
            'tier'         => $result['provider_tier'] ?? 'unknown',
        ];

        if (!empty($result['degraded_mode'])) {
            $response['degraded']        = true;
            $response['degraded_notice'] = $result['degraded_notice'];
            $response['offline_badge']   = $result['offline_badge'] ?? '';
            $response['offline_mode']    = $result['offline_mode'] ?? 'local_heuristic';
        }

        json_response($response);
    }

    // ── saveDiagnosis ─────────────────────────────────────────────────────────

    public static function saveDiagnosis(array $context): void
    {
        self::requireAuth();
        $payload = require_json_body();

        $caseId      = trim((string) ($payload['case_id'] ?? ''));
        $cie10Code   = trim((string) ($payload['cie10_code'] ?? ''));
        $cie10Desc   = trim((string) ($payload['cie10_description'] ?? ''));

        if ($caseId === '' || $cie10Code === '') {
            json_response(['ok' => false, 'error' => 'case_id y cie10_code requeridos'], 400);
        }

        // S10-02: log SuggestionAccepted antes de guardar
        $aiSuggested = trim((string) ($payload['ai_suggested_code'] ?? ''));
        $outcome = 'manual'; // sin sugerencia previa de IA
        if ($aiSuggested !== '') {
            $outcome = ($aiSuggested === $cie10Code) ? 'accepted_as_is' : 'edited';
        }
        self::logClinicalAiAction([
            'action'       => 'openclaw-save-diagnosis',
            'case_id'      => $caseId,
            'outcome'      => $outcome,
            'saved_value'  => $cie10Code . ' ' . $cie10Desc,
            'ai_suggested' => $aiSuggested,
            'diff'         => ($outcome === 'edited') ? ['from' => $aiSuggested, 'to' => $cie10Code] : null,
        ]);

        require_once __DIR__ . '/../lib/clinical_history/ClinicalHistoryService.php';
        $service = new ClinicalHistoryService();
        $result  = self::mutateStore(static function (array $store) use ($service, $caseId, $cie10Code, $cie10Desc, $payload): array {
            return $service->saveDiagnosis($store, [
                'caseId'            => $caseId,
                'cie10Code'         => $cie10Code,
                'cie10Description'  => $cie10Desc,
                'notes'             => $payload['notes'] ?? '',
                'source'            => 'openclaw',
            ]);
        });

        // S30-10: Detección automática de condición crónica
        $chronicPrefixes = ['I10', 'E11', 'J44', 'E03'];
        $isChronic = false;
        $upperCode = strtoupper($cie10Code);
        foreach ($chronicPrefixes as $prefix) {
            if (str_starts_with($upperCode, $prefix)) {
                $isChronic = true;
                break;
            }
        }

        $response = ['ok' => true, 'saved' => true, 'data' => $result];
        if ($isChronic) {
            $response['chronic_condition_detected'] = true;
            $response['suggested_followup_days'] = 90;
        }

        json_response($response);
    }

    public static function saveChronicCondition(array $context): void
    {
        self::requireAuth();
        $payload = require_json_body();

        $caseId = trim((string) ($payload['case_id'] ?? ''));
        $cie10Code = trim((string) ($payload['cie10_code'] ?? ''));
        $cie10Desc = trim((string) ($payload['cie10_description'] ?? ''));
        $frequency = (int) ($payload['followup_days'] ?? 90);

        if ($caseId === '' || $cie10Code === '') {
            json_response(['ok' => false, 'error' => 'case_id y cie10_code requeridos'], 400);
        }

        $result = self::mutateStore(static function (array $store) use ($caseId, $cie10Code, $cie10Desc, $frequency): array {
            $patients = $store['patients'] ?? [];
            if (!isset($patients[$caseId])) {
                return ['ok' => false, 'error' => 'Paciente no encontrado'];
            }

            $conditions = $patients[$caseId]['chronicConditions'] ?? [];
            $exists = false;
            foreach ($conditions as &$cond) {
                if (($cond['cie10Code'] ?? '') === $cie10Code) {
                    $cond['controlFrequencyDays'] = $frequency;
                    $cond['nextControlDue'] = gmdate('Y-m-d', strtotime('+' . $frequency . ' days'));
                    $exists = true;
                    break;
                }
            }
            unset($cond);

            if (!$exists) {
                $conditions[] = [
                    'cie10Code' => $cie10Code,
                    'cie10Label' => $cie10Desc,
                    'diagnosedAt' => local_date('Y-m-d'),
                    'controlFrequencyDays' => $frequency,
                    'lastControlDate' => local_date('Y-m-d'),
                    'nextControlDue' => gmdate('Y-m-d', strtotime('+' . $frequency . ' days')),
                    'status' => 'controlled',
                ];
            }

            $patients[$caseId]['chronicConditions'] = $conditions;
            $patients[$caseId]['updatedAt'] = gmdate('c');
            $store['patients'] = $patients;

            return ['ok' => true, 'chronicConditions' => $conditions, 'store' => $store];
        });

        if ($result['ok'] ?? false) {
            json_response(['ok' => true, 'chronicConditions' => $result['chronicConditions']]);
        }
        json_response($result, 400);
    }

    // ── saveEvolution ─────────────────────────────────────────────────────────

    public static function saveEvolution(array $context): void
    {
        self::requireAuth();
        $payload = require_json_body();

        $caseId = trim((string) ($payload['case_id'] ?? ''));
        $text   = trim((string) ($payload['text'] ?? ''));

        if ($caseId === '' || $text === '') {
            json_response(['ok' => false, 'error' => 'case_id y texto requeridos'], 400);
        }

        require_once __DIR__ . '/../lib/clinical_history/ClinicalHistoryService.php';
        $service = new ClinicalHistoryService();
        $doctorProfile = doctor_profile_document_fields([
            'name' => trim((string) ($payload['doctor_name'] ?? ($_SESSION['admin_email'] ?? ''))),
        ]);

        $result  = self::mutateStore(static function (array $store) use ($service, $caseId, $text, $payload, $doctorProfile): array {
            return $service->saveEvolutionNote($store, [
                'caseId'    => $caseId,
                'text'      => $text,
                'cie10Code' => $payload['cie10_code'] ?? '',
                'doctorId'  => $payload['doctor_id'] ?? ($doctorProfile['name'] ?? ''),
                'doctorName' => $doctorProfile['name'] ?? '',
                'doctorSpecialty' => $doctorProfile['specialty'] ?? '',
                'doctorMsp' => $doctorProfile['msp'] ?? '',
                'source'    => 'openclaw',
            ]);
        });

        json_response(['ok' => true, 'id' => $result['id'] ?? '', 'saved_at' => gmdate('c')]);
    }

    // ── savePrescription ─────────────────────────────────────────────────────

    public static function savePrescription(array $context): void
    {
        self::requireAuth();
        $payload = require_json_body();

        $caseId      = trim((string) ($payload['case_id'] ?? ''));
        $medications = $payload['medications'] ?? [];

        if ($caseId === '' || empty($medications)) {
            json_response(['ok' => false, 'error' => 'case_id y medications requeridos'], 400);
        }

        // S10-02: log SuggestionAccepted para recetas
        $aiSuggestedMeds = $payload['ai_suggested_medications'] ?? [];
        $rxOutcome = !empty($aiSuggestedMeds) ? 'accepted_as_is' : 'manual';
        if (!empty($aiSuggestedMeds)) {
            $savedNames    = array_map(static fn($m) => trim((string) ($m['medication'] ?? $m['name'] ?? '')), $medications);
            $suggestedNames = array_map(static fn($m) => trim((string) ($m['medication'] ?? $m['name'] ?? '')), $aiSuggestedMeds);
            sort($savedNames); sort($suggestedNames);
            $rxOutcome = ($savedNames === $suggestedNames) ? 'accepted_as_is' : 'edited';
        }
        self::logClinicalAiAction([
            'action'        => 'openclaw-prescription',
            'case_id'       => $caseId,
            'outcome'       => $rxOutcome,
            'saved_value'   => implode(', ', array_map(static fn($m) => $m['medication'] ?? $m['name'] ?? '?', $medications)),
            'ai_suggested'  => implode(', ', array_map(static fn($m) => $m['medication'] ?? $m['name'] ?? '?', $aiSuggestedMeds)),
            'diff'          => ($rxOutcome === 'edited') ? [
                'from' => $aiSuggestedMeds,
                'to'   => $medications,
            ] : null,
        ]);

        require_once __DIR__ . '/../lib/clinical_history/ClinicalHistoryRepository.php';
        require_once __DIR__ . '/../lib/clinical_history/ClinicalHistoryService.php';
        $service = new ClinicalHistoryService();
        $rxId    = 'rx-' . bin2hex(random_bytes(8));
        $doctorProfile = doctor_profile_document_fields([
            'name' => trim((string) ($_SESSION['admin_email'] ?? '')),
        ]);

        $result = self::mutateStore(static function (array $store) use ($service, $caseId, $medications, $rxId, $doctorProfile): array {
            $session = ClinicalHistoryRepository::findSessionByCaseId($store, $caseId);
            if ($session === null) {
                return [
                    'ok' => false,
                    'store' => $store,
                    'storeDirty' => false,
                    'statusCode' => 404,
                    'error' => 'Sesion clinica no encontrada',
                ];
            }

            $draft = ClinicalHistoryRepository::findDraftBySessionId(
                $store,
                (string) ($session['sessionId'] ?? '')
            );
            $existingItems = ClinicalHistoryRepository::normalizePrescriptionItems(
                $draft['clinicianDraft']['hcu005']['prescriptionItems']
                    ?? $draft['documents']['prescription']['items']
                    ?? []
            );
            $incomingItems = self::normalizePrescriptionItemsPayload($medications);
            $mergedItems = array_values(array_filter(array_merge($existingItems, $incomingItems), static function (array $item): bool {
                return ClinicalHistoryRepository::prescriptionItemIsStarted($item);
            }));

            $actionResult = $service->episodeAction($store, [
                'action' => 'issue_prescription',
                'caseId' => $caseId,
                'draft' => [
                    'clinicianDraft' => [
                        'hcu005' => [
                            'prescriptionItems' => $mergedItems,
                        ],
                    ],
                ],
                'requiresHumanReview' => false,
            ]);

            if (($actionResult['ok'] ?? false) !== true || !isset($actionResult['store']) || !is_array($actionResult['store'])) {
                return [
                    'ok' => false,
                    'store' => $store,
                    'storeDirty' => false,
                    'statusCode' => (int) ($actionResult['statusCode'] ?? 500),
                    'error' => (string) ($actionResult['error'] ?? 'No se pudo guardar la receta'),
                ];
            }

            $newStore = $actionResult['store'];
            if (!isset($newStore['prescriptions'])) {
                $newStore['prescriptions'] = [];
            }
            $newStore['prescriptions'][$rxId] = [
                'id' => $rxId,
                'caseId' => $caseId,
                'medications' => $incomingItems,
                'issued_at' => gmdate('c'),
                'issued_by' => $doctorProfile['name'] ?? 'medico',
                'doctor' => $doctorProfile,
            ];

            return [
                'ok' => true,
                'store' => $newStore,
                'storeDirty' => true,
                'prescriptionItems' => $mergedItems,
            ];
        });

        if (($result['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'No se pudo guardar la receta'),
            ], (int) ($result['statusCode'] ?? 500));
        }

        $pdfUrl      = '/api.php?resource=openclaw-prescription&id=' . $rxId . '&format=pdf';
        $savedStore = isset($result['store']) && is_array($result['store'])
            ? $result['store']
            : self::readStore();
        $patientCtx  = $savedStore['patients'][$caseId] ?? [];
        $phone       = $patientCtx['phone'] ?? '';
        $clinicProfile = read_clinic_profile();
        $clinicName  = $clinicProfile['clinicName'] ?? 'la clínica';
        $waMsg       = urlencode("Su receta médica de {$clinicName} está lista. Para descargarla visite el siguiente enlace o contacte a la clínica.");
        $waUrl       = $phone !== '' ? 'https://wa.me/' . preg_replace('/[^0-9]/', '', $phone) . '?text=' . $waMsg : '';
        $emailSent   = false;

        $deliveryMode = trim((string) ($payload['delivery'] ?? ''));
        if ($deliveryMode === 'email' && isset($savedStore['prescriptions'][$rxId]) && is_array($savedStore['prescriptions'][$rxId])) {
            $emailSent = maybe_send_prescription_ready_email(
                $savedStore,
                $savedStore['prescriptions'][$rxId],
                [],
                [
                    'portalUrl' => AppConfig::BASE_URL . '/es/portal/receta/',
                ]
            );

            if ($emailSent) {
                $savedStore['prescriptions'][$rxId]['deliveryStatus'] = 'email_sent';
                $savedStore['prescriptions'][$rxId]['emailSentAt'] = local_date('c');
                $savedStore['prescriptions'][$rxId]['emailChannel'] = 'email';
                write_store($savedStore, false);
            }
        }

        json_response([
            'ok'              => true,
            'prescription_id' => $rxId,
            'pdf_url'         => $pdfUrl,
            'whatsapp_url'    => $waUrl,
            'email_sent'      => $emailSent,
            'prescription'    => [
                'deliveryStatus' => $emailSent ? 'email_sent' : 'pending',
            ],
        ]);
    }

    // ── getPrescriptionPdf ────────────────────────────────────────────────────

    public static function getPrescriptionPdf(array $context): void
    {
        $rxId = trim((string) ($_GET['id'] ?? ''));
        if ($rxId === '') {
            json_response(['ok' => false, 'error' => 'id requerido'], 400);
        }

        $store = self::readStore();
        $prescription = $store['prescriptions'][$rxId] ?? null;

        if ($prescription === null) {
            json_response(['ok' => false, 'error' => 'Receta no encontrada'], 404);
        }

        $caseId = $prescription['caseId'] ?? '';
        $patient = $store['patients'][$caseId] ?? [];
        require_once __DIR__ . '/../lib/openclaw/PrescriptionPdfRenderer.php';
        $clinicProfile = read_clinic_profile();
        $pdfBytes = PrescriptionPdfRenderer::generatePdfBytes($prescription, $patient, $clinicProfile);

        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="receta-' . $rxId . '.pdf"');
        echo $pdfBytes;
        exit;
    }

    // ── generateCertificate ───────────────────────────────────────────────────

    public static function generateCertificate(array $context): void
    {
        self::requireAuth();
        $payload = require_json_body();

        $caseId = trim((string) ($payload['case_id'] ?? ''));
        $type   = trim((string) ($payload['type'] ?? 'reposo_laboral'));

        if ($caseId === '') {
            json_response(['ok' => false, 'error' => 'case_id requerido'], 400);
        }

        $certId = 'cert-' . bin2hex(random_bytes(8));
        $folio  = 'AD-' . date('Y') . '-' . strtoupper(substr($certId, 5, 6));
        $doctorProfile = doctor_profile_document_fields([
            'name' => trim((string) ($_SESSION['admin_email'] ?? '')),
        ]);

        // Store certificate data for PDF generation
        $certData = [
            'id'                => $certId,
            'folio'             => $folio,
            'caseId'            => $caseId,
            'type'              => $type,
            'rest_days'         => (int) ($payload['rest_days'] ?? 0),
            'diagnosis_text'    => $payload['diagnosis_text'] ?? '',
            'cie10_code'        => $payload['cie10_code'] ?? '',
            'restrictions'      => $payload['restrictions'] ?? '',
            'observations'      => $payload['observations'] ?? '',
            'issued_at'         => gmdate('c'),
            'issued_by'         => $doctorProfile['name'] ?? 'medico',
            'doctor'            => $doctorProfile,
        ];

        self::mutateStore(static function (array $store) use ($certId, $certData): array {
            if (!isset($store['certificates'])) $store['certificates'] = [];
            $store['certificates'][$certId] = $certData;
            return ['ok' => true, 'store' => $store, 'storeDirty' => true];
        });

        $pdfUrl  = '/api.php?resource=openclaw-certificate&id=' . $certId . '&format=pdf';
        $store   = self::readStore();
        $patient = $store['patients'][$caseId] ?? [];
        $phone   = $patient['phone'] ?? '';
        $clinicName = read_clinic_profile()['clinicName'];
        $waMsg   = urlencode("Su certificado médico de {$clinicName} está listo. Folio: {$folio}. " . (($type === 'reposo_laboral') ? "Días de reposo: {$certData['rest_days']}." : ''));
        $waUrl   = $phone !== '' ? 'https://wa.me/' . preg_replace('/[^0-9]/', '', $phone) . '?text=' . $waMsg : '';

        json_response([
            'ok'             => true,
            'certificate_id' => $certId,
            'folio'          => $folio,
            'pdf_url'        => $pdfUrl,
            'whatsapp_url'   => $waUrl,
        ]);
    }

    public static function getCertificatePdf(array $context): void
    {
        self::requireAuth();

        $certId = trim((string) ($_GET['id'] ?? ''));
        if ($certId === '') {
            json_response(['ok' => false, 'error' => 'id requerido'], 400);
        }

        $store = self::readStore();
        $certificate = $store['certificates'][$certId] ?? null;
        if (!is_array($certificate)) {
            json_response(['ok' => false, 'error' => 'Certificado no encontrado'], 404);
        }

        $caseId = trim((string) ($certificate['caseId'] ?? ''));
        $patient = [];
        if ($caseId !== '' && isset($store['patients'][$caseId]) && is_array($store['patients'][$caseId])) {
            $patient = $store['patients'][$caseId];
        }

        $html = self::buildCertificatePdfHtml($certificate, $patient);
        $pdfPath = __DIR__ . '/../vendor/dompdf/dompdf/src/Dompdf.php';
        if (file_exists($pdfPath)) {
            require_once $pdfPath;
            $dompdf = new \Dompdf\Dompdf(['isHtml5ParserEnabled' => true, 'isRemoteEnabled' => true]);
            $dompdf->loadHtml($html, 'UTF-8');
            $dompdf->setPaper('A4', 'portrait');
            $dompdf->render();
            $pdfBytes = $dompdf->output();
        } else {
            $pdfBytes = self::buildFallbackPdf($html);
        }

        $fileName = preg_replace('/[^a-zA-Z0-9_-]/', '-', (string) ($certificate['folio'] ?? $certId));
        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="certificado-' . $fileName . '.pdf"');
        echo $pdfBytes;
        exit;
    }

    // ── checkInteractions ────────────────────────────────────────────────────

    public static function checkInteractions(array $context): void
    {
        self::requireAuth();
        $payload = require_json_body();

        $caseId = trim((string) ($payload['case_id'] ?? $payload['caseId'] ?? ''));
        $proposed = self::normalizeMedicationNameList($payload['proposed_medications'] ?? []);

        if ($caseId === '' || $proposed === []) {
            json_response(['ok' => false, 'error' => 'case_id y proposed_medications requeridos'], 400);
        }

        $active = self::normalizeMedicationNameList($payload['active_medications'] ?? []);
        if ($active === []) {
            $active = self::resolveActiveMedicationsForCase($caseId);
        }

        // Load interactions DB
        $dbPath = __DIR__ . '/../data/drug-interactions.json';
        if (!file_exists($dbPath)) {
            json_response([
                'ok' => true,
                'has_interactions' => false,
                'active_medications' => $active,
                'interactions' => [],
            ]);
        }

        $db           = json_decode((string) file_get_contents($dbPath), true) ?? [];
        $interactions = [];

        foreach ($db['pairs'] ?? [] as $pair) {
            $pairA = self::normalizeMedicationKey((string) ($pair['drug_a'] ?? ''));
            $pairB = self::normalizeMedicationKey((string) ($pair['drug_b'] ?? ''));
            if ($pairA === '' || $pairB === '') {
                continue;
            }

            foreach ($proposed as $proposedMedication) {
                $proposedKey = self::normalizeMedicationKey($proposedMedication);
                if ($proposedKey === '') {
                    continue;
                }

                $proposedMatchesA = self::medicationMatchesInteraction($proposedKey, $pairA);
                $proposedMatchesB = self::medicationMatchesInteraction($proposedKey, $pairB);
                if (!$proposedMatchesA && !$proposedMatchesB) {
                    continue;
                }

                foreach ($active as $activeMedication) {
                    $activeKey = self::normalizeMedicationKey($activeMedication);
                    if ($activeKey === '') {
                        continue;
                    }

                    $activeMatchesA = self::medicationMatchesInteraction($activeKey, $pairA);
                    $activeMatchesB = self::medicationMatchesInteraction($activeKey, $pairB);

                    $isPairMatch =
                        ($proposedMatchesA && $activeMatchesB) ||
                        ($proposedMatchesB && $activeMatchesA);

                    if ($isPairMatch) {
                        $interactions[] = [
                            'drug_a' => (string) ($pair['drug_a'] ?? ''),
                            'drug_b' => (string) ($pair['drug_b'] ?? ''),
                            'severity' => (string) ($pair['severity'] ?? 'medium'),
                            'description' => (string) ($pair['description'] ?? ''),
                            'proposed_medication' => $proposedMedication,
                            'active_medication' => $activeMedication,
                        ];
                    }
                }
            }
        }

        $interactions = array_values(array_unique($interactions, SORT_REGULAR));

        // S30-16: Check de teratogenicidad
        // El GPT "Aurora Derm Clinica" NECESITA esto antes de prescribir a paciente femenina en edad fértil
        $teratogenicityWarning = false;
        $teratogenicDrugsAtRisk = [];
        $pregnancyStatus = null;

        if ($caseId !== '') {
            $store = read_store();
            $weightKg = null;
            // Buscar la sesión activa del caso para obtener datos de la paciente
            foreach (($store['clinical_history_drafts'] ?? []) as $draft) {
                if (trim((string) ($draft['caseId'] ?? '')) === $caseId) {
                    $pregnancyStatus = $draft['intake']['datosPaciente']['embarazo'] ?? null;
                    if (isset($draft['intake']['vitalSigns']['weightKg'])) {
                        $weightKg = (float) $draft['intake']['vitalSigns']['weightKg'];
                    }
                    break;
                }
            }
            // También buscar sexo y edad en el store de appointments/cases
            $patientAgeYears = null;
            $patientSex = '';
            foreach (($store['cases'] ?? $store['patient_cases'] ?? []) as $case) {
                if (trim((string) ($case['id'] ?? $case['caseId'] ?? '')) === $caseId) {
                    $patientAgeYears = isset($case['ageYears']) ? (int) $case['ageYears'] : null;
                    $patientSex = strtolower(trim((string) ($case['sexAtBirth'] ?? $case['sex'] ?? $case['gender'] ?? '')));
                    if ($patientAgeYears === null && isset($case['birthDate']) && $case['birthDate'] !== '') {
                        try {
                            $dob = new DateTimeImmutable($case['birthDate']);
                            $patientAgeYears = (int) $dob->diff(new DateTimeImmutable())->y;
                        } catch (\Throwable $e) {}
                    }
                    break;
                }
            }

            // Lista MSP-validada de teratógenos frecuentes en dermatología y medicina general
            $knownTeratogens = [
                'isotretinoina', 'isotretinoin', 'isotretinoína', 'roaccutan', 'acnotin',
                'metotrexato', 'methotrexate', 'metotrexate',
                'warfarina', 'warfarin', 'acenocumarol',
                'acido valproico', 'valproato', 'valproic acid', 'valproate', 'depakene',
                'talidomida', 'thalidomide',
                'litio', 'lithium', 'carbolit',
                'tetraciclina', 'tetracicline', 'doxiciclina', 'doxycycline', 'minociclina', 'minocycline',
                'misoprostol', 'cytotec',
                'finasterida', 'finasteride', 'propecia',
                'fluconazol', 'fluconazole', // dosis altas
                'ribavirin', 'ribavirina',
                'retinol', 'vitamina a', 'vitamin a', // dosis farmacológicas
            ];

            $isFemaleChilbearing = (
                ($patientSex === 'female' || $patientSex === 'femenino' || $patientSex === 'f' || $patientSex === 'mujer')
                && $patientAgeYears !== null
                && $patientAgeYears >= 14
                && $patientAgeYears <= 55
            );

            if ($isFemaleChilbearing && $pregnancyStatus === null) {
                foreach ($proposed as $proposedMed) {
                    $propKey = strtolower(trim($proposedMed));
                    foreach ($knownTeratogens as $teratogen) {
                        if (str_contains($propKey, $teratogen) || str_contains($teratogen, $propKey)) {
                            $teratogenicDrugsAtRisk[] = $proposedMed;
                            $teratogenicityWarning = true;
                            break;
                        }
                    }
                }
                $teratogenicDrugsAtRisk = array_values(array_unique($teratogenicDrugsAtRisk));
            }
        }

        // S31-06: Pediatric Dose Validation
        $doseWarning = null;
        if (isset($patientAgeYears) && $patientAgeYears < 12) {
            $hasAmoxi = false;
            foreach ($proposed as $med) {
                if (stripos($med, 'amoxicilina') !== false) {
                    $hasAmoxi = true;
                    break;
                }
            }
            
            if ($hasAmoxi) {
                if (isset($weightKg) && $weightKg > 0) {
                    $doseWarning = "Paciente pediátrico: verificar dosis según peso ({$weightKg} kg). Dosis máxima recomendada para amoxicilina: 80-90 mg/kg/día.";
                } else {
                    $doseWarning = "Paciente pediátrico (< 12 años): verificar dosis de amoxicilina. Peso no registrado en signos vitales.";
                }
            }
        }

        json_response([
            'ok'                    => true,
            'has_interactions'      => count($interactions) > 0,
            'active_medications'    => $active,
            'interactions'          => $interactions,
            'teratogenicity_warning'=> $teratogenicityWarning,
            'drugs_at_risk'         => $teratogenicDrugsAtRisk,
            'pregnancy_status'      => $pregnancyStatus,
            'teratogenicity_note'   => $teratogenicityWarning
                ? 'ADVERTENCIA: medicamento(s) teratogénico(s) detectado(s). Confirme que la paciente no está embarazada antes de prescribir.'
                : null,
            'dose_warning'          => $doseWarning,
        ]);
    }

    // ── summarizeSession ─────────────────────────────────────────────────────

    public static function summarizeSession(array $context): void
    {
        self::requireAuth();
        $payload     = require_json_body();
        $chatSummary = trim((string) ($payload['chat_summary'] ?? ''));
        $caseId      = trim((string) ($payload['case_id'] ?? ''));

        if ($chatSummary === '') {
            json_response(['ok' => false, 'error' => 'chat_summary requerido'], 400);
        }

        // Ask the AI router to generate a structured summary
        $router  = new OpenclawAIRouter();
        $aiResult = $router->route([
            'messages' => [
                [
                    'role'    => 'system',
                    'content' => 'Eres un asistente médico. Genera un resumen estructurado de la consulta. Responde SOLO con JSON válido con estas claves: evolution_text (nota clínica para HCE), patient_summary_wa (resumen en lenguaje no técnico para el paciente, MÁXIMO 300 palabras, incluyendo: diagnóstico simple, 3 instrucciones de medicación más importantes, fecha de próximo control, y señal de alarma para consulta urgente), pending_actions (array de tareas pendientes).',
                ],
                [
                    'role'    => 'user',
                    'content' => "Resumen de la consulta:\n{$chatSummary}\n\nGenera el JSON de cierre.",
                ],
            ],
            'max_tokens'  => 800,
            'temperature' => 0.2,
        ]);

        $evolutionText    = '';
        $patientSummary   = '';
        $pendingActions   = [];

        if ($aiResult['ok'] && isset($aiResult['choices'][0]['message']['content'])) {
            $raw = trim((string) $aiResult['choices'][0]['message']['content']);
            // Extract JSON if wrapped in markdown
            if (preg_match('/```(?:json)?\s*(\{.*?\})\s*```/s', $raw, $m)) {
                $raw = $m[1];
            }
            $parsed = @json_decode($raw, true);
            if (is_array($parsed)) {
                $evolutionText  = (string) ($parsed['evolution_text'] ?? '');
                $patientSummary = (string) ($parsed['patient_summary_wa'] ?? $parsed['patient_summary'] ?? '');
                $pendingActions = (array) ($parsed['pending_actions'] ?? []);
            }
        }

        // Fallback if AI couldn't parse
        if ($evolutionText === '') {
            $evolutionText = "Consulta realizada. {$chatSummary}";
        }

        $waUrl = '';
        if ($caseId !== '' && $patientSummary !== '') {
            $patientCtx = self::readStore()['patients'][$caseId] ?? [];
            $phone      = trim((string) ($patientCtx['phone'] ?? ''));
            if ($phone !== '') {
                $waUrl = 'https://wa.me/' . preg_replace('/[^0-9]/', '', $phone) . '?text=' . urlencode($patientSummary);
            }
        }

        json_response([
            'ok'              => true,
            'evolution_text'  => $evolutionText,
            'patient_summary_wa' => $patientSummary,
            'pending_actions' => $pendingActions,
            'whatsapp_url'    => $waUrl,
        ]);
    }

    public static function closeTelemedicine(array $context): void
    {
        self::requireAuth();
        $payload     = require_json_body();
        $chatSummary = trim((string) ($payload['chat_summary'] ?? ''));
        $caseId      = trim((string) ($payload['case_id'] ?? ''));

        if ($chatSummary === '' || $caseId === '') {
            json_response(['ok' => false, 'error' => 'chat_summary y case_id requeridos'], 400);
        }

        $router  = new OpenclawAIRouter();
        $aiResult = $router->route([
            'messages' => [
                [
                    'role'    => 'system',
                    'content' => 'Eres un asistente médico inteligente. Genera el resumen estructurado de la teleconsulta. Responde SOLO con JSON válido con estas claves: evolution_text (nota clínica profesional), patient_summary_wa (resumen simplificado y amigable para WhatsApp de MÁXIMO 300 palabras: incluye diagnóstico simple, plan, fecha proxy o sugerida de control, señal de alarma), suggested_followup_days (int, días sugeridos para control si es necesario, 0 si no) y pending_actions (array de tareas internas).',
                ],
                [
                    'role'    => 'user',
                    'content' => "Resumen de la consulta:\n{$chatSummary}\n\nGenera el JSON de cierre.",
                ],
            ],
            'max_tokens'  => 900,
            'temperature' => 0.2,
        ]);

        $evolutionText = '';
        $patientSummary = '';
        $pendingActions = [];
        $followupDays = 0;

        if ($aiResult['ok'] && isset($aiResult['choices'][0]['message']['content'])) {
            $raw = trim((string) $aiResult['choices'][0]['message']['content']);
            if (preg_match('/```(?:json)?\s*(\{.*?\})\s*```/s', $raw, $m)) {
                $raw = $m[1];
            }
            $parsed = @json_decode($raw, true);
            if (is_array($parsed)) {
                $evolutionText  = (string) ($parsed['evolution_text'] ?? '');
                $patientSummary = (string) ($parsed['patient_summary_wa'] ?? $parsed['patient_summary'] ?? '');
                $pendingActions = (array) ($parsed['pending_actions'] ?? []);
                $followupDays   = (int) ($parsed['suggested_followup_days'] ?? 0);
            }
        }

        if ($evolutionText === '') {
            $evolutionText = "Atención de Telemedicina completada. {$chatSummary}";
        }

        require_once __DIR__ . '/../lib/clinical_history/ClinicalHistoryService.php';
        $service = new ClinicalHistoryService();
        $doctorProfile = doctor_profile_document_fields([
            'name' => trim((string) ($_SESSION['admin_email'] ?? '')),
        ]);

        $result = self::mutateStore(static function (array $store) use ($service, $caseId, $evolutionText, $doctorProfile, $followupDays): array {
            $evolutionResult = $service->saveEvolutionNote($store, [
                'caseId'          => $caseId,
                'text'            => $evolutionText,
                'cie10Code'       => '',
                'doctorId'        => $doctorProfile['name'] ?? '',
                'doctorName'      => $doctorProfile['name'] ?? '',
                'doctorSpecialty' => $doctorProfile['specialty'] ?? '',
                'doctorMsp'       => $doctorProfile['msp'] ?? '',
                'source'          => 'openclaw-close-telemedicine',
            ]);

            $store = $evolutionResult['store'] ?? $store;

            $session = ClinicalHistorySessionRepository::findSessionByCaseId($store, $caseId);
            if ($session !== null) {
                $session['status'] = 'closed';
                $saveSession = ClinicalHistorySessionRepository::upsertSession($store, $session);
                $store = $saveSession['store'];
                
                $draft = ClinicalHistorySessionRepository::findDraftBySessionId($store, (string) $session['sessionId']);
                if ($draft !== null) {
                    $draft['status'] = 'closed';
                    $saveDraft = ClinicalHistorySessionRepository::upsertDraft($store, $draft);
                    $store = $saveDraft['store'];
                }
            }

            $patientId = '';
            if (isset($store['cases'][$caseId])) {
                $store['cases'][$caseId]['stage'] = 'completed';
                $store['cases'][$caseId]['closed_at'] = local_date('c');
                $patientId = $store['cases'][$caseId]['patientId'] ?? '';
            } elseif (isset($store['patient_cases'][$caseId])) {
                $store['patient_cases'][$caseId]['status'] = 'completed';
                $patientId = $store['patient_cases'][$caseId]['patientId'] ?? '';
            }

            if ($patientId !== '') {
                foreach (($store['appointments'] ?? []) as $i => $apt) {
                    if (($apt['patientId'] ?? '') === $patientId && ($apt['status'] ?? '') === 'active') {
                        $store['appointments'][$i]['status'] = 'completed';
                    }
                }
            }

            if ($followupDays > 0) {
                $store['pending_followups'] = is_array($store['pending_followups'] ?? null) ? $store['pending_followups'] : [];
                $store['pending_followups'][] = [
                    'id'             => 'fu_' . uniqid(),
                    'caseId'         => $caseId,
                    'patientId'      => $patientId,
                    'reason'         => 'Control clínico diferido por teleconsulta',
                    'due_date'       => date('Y-m-d', time() + ($followupDays * 86400)),
                    'contact_method' => 'whatsapp',
                    'status'         => 'pending',
                    'createdAt'      => local_date('c'),
                ];
            }

            return ['ok' => true, 'store' => $store, 'storeDirty' => true];
        });

        $waUrl = '';
        if ($caseId !== '' && $patientSummary !== '') {
            $patientCtx = self::readStore()['patients'][$caseId] ?? [];
            $phone      = trim((string) ($patientCtx['phone'] ?? ''));
            if ($phone !== '') {
                $waUrl = 'https://wa.me/' . preg_replace('/[^0-9]/', '', $phone) . '?text=' . urlencode($patientSummary);
            }
        }

        json_response([
            'ok'                 => true,
            'hce_updated'        => true,
            'appointment_closed' => true,
            'wa_summary_sent'    => $waUrl !== '', 
            'evolution_text'     => $evolutionText,
            'patient_summary_wa' => $patientSummary,
            'pending_actions'    => $pendingActions,
            'followup_days'      => $followupDays,
            'whatsapp_url'       => $waUrl,
        ]);
    }

    // ── routerStatus ─────────────────────────────────────────────────────────

    public static function routerStatus(array $context): void
    {
        self::requireAuth();
        $router = new OpenclawAIRouter();
        json_response(['ok' => true, 'router' => $router->getStatus()]);
    }

    // ── Utilities ─────────────────────────────────────────────────────────────

    private static function requireAuth(): void
    {
        require_admin_auth();
    }

    private static function buildCertificatePdfHtml(array $certificate, array $patient): string
    {
        $issuedDate = (new DateTimeImmutable('now', new DateTimeZone('America/Guayaquil')))->format('d/m/Y H:i');
        $issuedAt = trim((string) ($certificate['issued_at'] ?? ''));
        if ($issuedAt !== '') {
            try {
                $issuedDate = (new DateTimeImmutable($issuedAt))
                    ->setTimezone(new DateTimeZone('America/Guayaquil'))
                    ->format('d/m/Y H:i');
            } catch (\Throwable $e) {
            }
        }

        $patientName = trim((string) ($patient['name'] ?? (($patient['firstName'] ?? '') . ' ' . ($patient['lastName'] ?? ''))));
        if ($patientName === '') {
            $patientName = 'Paciente';
        }

        $patientId = trim((string) ($patient['ci'] ?? $patient['identification'] ?? ''));
        $typeLabels = [
            'reposo_laboral' => 'Certificado de reposo',
            'aptitud_medica' => 'Certificado de aptitud medica',
            'constancia_tratamiento' => 'Constancia de tratamiento',
            'control_salud' => 'Constancia de control de salud',
            'incapacidad_temporal' => 'Certificado de incapacidad temporal',
        ];
        $type = trim((string) ($certificate['type'] ?? ''));
        $typeLabel = $typeLabels[$type] ?? 'Certificado medico';
        $diagnosis = trim((string) ($certificate['diagnosis_text'] ?? ''));
        $cie10 = trim((string) ($certificate['cie10_code'] ?? ''));
        $restDays = (int) ($certificate['rest_days'] ?? 0);
        $restrictions = trim((string) ($certificate['restrictions'] ?? ''));
        $observations = trim((string) ($certificate['observations'] ?? ''));
        $doctorData = doctor_profile_document_fields(
            isset($certificate['doctor']) && is_array($certificate['doctor'])
                ? $certificate['doctor']
                : ['name' => (string) ($certificate['issued_by'] ?? 'Medico tratante')]
        );
        $doctor = trim((string) ($doctorData['name'] ?? 'Medico tratante'));
        $doctorSpecialty = trim((string) ($doctorData['specialty'] ?? ''));
        $doctorMsp = trim((string) ($doctorData['msp'] ?? ''));
        $doctorSignatureImage = trim((string) ($doctorData['signatureImage'] ?? ''));
        $folio = trim((string) ($certificate['folio'] ?? $certificate['id'] ?? ''));

        $details = [];
        if ($diagnosis !== '') {
            $details[] = '<p><strong>Diagnostico:</strong> ' . htmlspecialchars($diagnosis, ENT_QUOTES, 'UTF-8') . '</p>';
        }
        if ($cie10 !== '') {
            $details[] = '<p><strong>CIE-10:</strong> ' . htmlspecialchars($cie10, ENT_QUOTES, 'UTF-8') . '</p>';
        }
        if ($restDays > 0) {
            $details[] = '<p><strong>Dias de reposo:</strong> ' . $restDays . '</p>';
        }
        if ($restrictions !== '') {
            $details[] = '<p><strong>Restricciones:</strong> ' . htmlspecialchars($restrictions, ENT_QUOTES, 'UTF-8') . '</p>';
        }
        if ($observations !== '') {
            $details[] = '<p><strong>Observaciones:</strong> ' . htmlspecialchars($observations, ENT_QUOTES, 'UTF-8') . '</p>';
        }

        $patientIdHtml = $patientId !== ''
            ? '<p><strong>Identificacion:</strong> ' . htmlspecialchars($patientId, ENT_QUOTES, 'UTF-8') . '</p>'
            : '';
        $signatureHtml = $doctorSignatureImage !== ''
            ? '<img src="' . htmlspecialchars($doctorSignatureImage, ENT_QUOTES, 'UTF-8') . '" alt="Firma digital del medico" style="max-width: 220px; max-height: 80px; display: block; margin-bottom: 10px; object-fit: contain;">'
            : '';
        $clinicName = read_clinic_profile()['clinicName'];
        $doctorSubtitle = $doctorSpecialty !== ''
            ? htmlspecialchars($doctorSpecialty, ENT_QUOTES, 'UTF-8')
            : 'Flow OS - Copiloto Clinico ' . htmlspecialchars($clinicName, ENT_QUOTES, 'UTF-8');
        $doctorMspHtml = $doctorMsp !== ''
            ? '<p>Registro MSP: ' . htmlspecialchars($doctorMsp, ENT_QUOTES, 'UTF-8') . '</p>'
            : '';

        return "<!DOCTYPE html>
<html lang=\"es\">
<head>
  <meta charset=\"utf-8\">
  <title>Certificado medico {$folio}</title>
  <style>
    body { font-family: DejaVu Sans, Arial, sans-serif; color: #1f2937; margin: 32px; line-height: 1.5; }
    h1 { font-size: 22px; margin-bottom: 8px; }
    .meta { color: #4b5563; margin-bottom: 24px; }
    .card { border: 1px solid #d1d5db; border-radius: 10px; padding: 20px; }
    .signature { margin-top: 48px; }
  </style>
</head>
<body>
  <h1>" . htmlspecialchars($typeLabel, ENT_QUOTES, 'UTF-8') . "</h1>
  <div class=\"meta\">
    <div><strong>Folio:</strong> " . htmlspecialchars($folio, ENT_QUOTES, 'UTF-8') . "</div>
    <div><strong>Emitido:</strong> " . htmlspecialchars($issuedDate, ENT_QUOTES, 'UTF-8') . "</div>
  </div>
  <div class=\"card\">
    <p><strong>Paciente:</strong> " . htmlspecialchars($patientName, ENT_QUOTES, 'UTF-8') . "</p>
    {$patientIdHtml}
    " . implode("\n    ", $details) . "
  </div>
  <div class=\"signature\">
    {$signatureHtml}
    <p><strong>" . htmlspecialchars($doctor, ENT_QUOTES, 'UTF-8') . "</strong></p>
    <p>{$doctorSubtitle}</p>
    {$doctorMspHtml}
  </div>
</body>
</html>";
    }

    private static function readStore(): array
    {
        return read_store();
    }

    private static function mutateStore(callable $fn): array
    {
        return mutate_store($fn);
    }

    private static function calculateAge(string $birthDate): ?int
    {
        if ($birthDate === '') return null;
        try {
            $dob  = new DateTime($birthDate);
            $now  = new DateTime();
            return (int) $now->diff($dob)->y;
        } catch (\Throwable $e) {
            return null;
        }
    }

    private static function normalizePrescriptionItemsPayload(array $medications): array
    {
        require_once __DIR__ . '/../lib/clinical_history/ClinicalHistoryRepository.php';

        $items = array_map(static function ($medication): array {
            if (is_string($medication)) {
                return [
                    'medication' => trim($medication),
                ];
            }

            if (!is_array($medication)) {
                return [];
            }

            return [
                'medication' => trim((string) ($medication['medication'] ?? $medication['name'] ?? '')),
                'dose' => trim((string) ($medication['dose'] ?? '')),
                'frequency' => trim((string) ($medication['frequency'] ?? '')),
                'duration' => trim((string) ($medication['duration'] ?? '')),
                'durationDays' => (int) ($medication['duration_days'] ?? $medication['durationDays'] ?? 0),
                'instructions' => trim((string) ($medication['instructions'] ?? $medication['notes'] ?? '')),
            ];
        }, $medications);

        return ClinicalHistoryRepository::normalizePrescriptionItems($items);
    }

    private static function normalizeMedicationNameList($medications): array
    {
        if (!is_array($medications)) {
            return [];
        }

        $normalized = [];
        foreach ($medications as $medication) {
            if (is_string($medication)) {
                $label = trim($medication);
            } elseif (is_array($medication)) {
                $name = trim((string) ($medication['name'] ?? $medication['medication'] ?? ''));
                $dose = trim((string) ($medication['dose'] ?? ''));
                $label = trim($name . ($dose !== '' ? ' ' . $dose : ''));
            } else {
                $label = '';
            }

            if ($label !== '') {
                $normalized[] = $label;
            }
        }

        return array_values(array_unique($normalized));
    }

    private static function resolveActiveMedicationsForCase(string $caseId): array
    {
        try {
            require_once __DIR__ . '/../lib/PatientCaseService.php';
            require_once __DIR__ . '/../lib/clinical_history/ClinicalHistoryService.php';

            $store = self::readStore();
            $case = $store['cases'][$caseId]
                ?? $store['patient_cases'][$caseId]
                ?? null;
            if ($case === null) {
                foreach (array_merge($store['cases'] ?? [], $store['patient_cases'] ?? []) as $c) {
                    if (($c['id'] ?? '') === $caseId) { $case = $c; break; }
                }
            }
            if (!is_array($case)) {
                return [];
            }

            $patientId = trim((string) ($case['patientId'] ?? ''));
            if ($patientId === '') {
                return [];
            }

            $historyService = new ClinicalHistoryService();
            $history = $historyService->getPatientHistory($store, $patientId);
            $prescriptions = is_array($history['prescriptions'] ?? null) ? array_reverse($history['prescriptions']) : [];
            foreach ($prescriptions as $prescription) {
                if (trim((string) ($prescription['status'] ?? '')) !== 'active') {
                    continue;
                }

                $active = self::normalizeMedicationNameList($prescription['medications'] ?? []);
                if ($active !== []) {
                    return $active;
                }
            }
        } catch (Throwable $error) {
            return [];
        }

        return [];
    }

    private static function normalizeMedicationKey(string $value): string
    {
        $normalized = strtolower(trim($value));
        $normalized = preg_replace('/[^a-z0-9]+/i', ' ', $normalized) ?? '';
        return trim((string) $normalized);
    }

    private static function medicationMatchesInteraction(string $medication, string $interactionDrug): bool
    {
        if ($medication === '' || $interactionDrug === '') {
            return false;
        }

        if ($medication === $interactionDrug) {
            return true;
        }

        if (str_contains($medication, $interactionDrug) || str_contains($interactionDrug, $medication)) {
            return true;
        }

        $medicationTokens = array_values(array_filter(explode(' ', $medication)));
        $interactionTokens = array_values(array_filter(explode(' ', $interactionDrug)));
        if ($medicationTokens === [] || $interactionTokens === []) {
            return false;
        }

        return in_array($interactionTokens[0], $medicationTokens, true)
            || in_array($medicationTokens[0], $interactionTokens, true);
    }

    private static function genericProtocol(string $code): array
    {
        $prefix = substr($code, 0, 1);

        $protocols = [
            'L' => [
                'cie10_code'          => $code,
                'first_line'          => [
                    ['medication' => 'Emoliente', 'dose' => 'aplicar 2-3 veces/día', 'duration' => 'continuo'],
                    ['medication' => 'Hidrocortisona 1%', 'dose' => 'aplicar bid', 'duration' => '14 días'],
                ],
                'alternatives'        => ['Betametasona 0.05% si respuesta pobre', 'Tacrolimus 0.1% para mantenimiento'],
                'follow_up'           => '4 semanas. Si no mejora: biopsia o interconsulta dermatología.',
                'referral_criteria'   => 'Afección >30% superficie corporal, signos sistémicos, sin respuesta a 8 semanas',
                'patient_instructions'=> 'Evitar rascado. Baños cortos con agua tibia. Ropa de algodón.',
            ],
            'B' => [
                'cie10_code'        => $code,
                'first_line'        => [
                    ['medication' => 'Según infección específica', 'dose' => 'ver protocolo', 'duration' => 'variable'],
                ],
                'alternatives'      => ['Consultar protocolo específico'],
                'follow_up'         => '2 semanas post-tratamiento.',
                'referral_criteria' => 'Infección diseminada, inmunocompromiso.',
                'patient_instructions'=> 'Completar tratamiento. Higiene estricta. Evitar contacto.',
            ],
            'C' => [
                'cie10_code'        => $code,
                'first_line'        => [
                    ['medication' => 'Derivación oncología urgente', 'dose' => '-', 'duration' => '<2 semanas'],
                ],
                'alternatives'      => [],
                'follow_up'         => 'Oncología dermatológica.',
                'referral_criteria' => 'SIEMPRE derivar',
                'patient_instructions'=> 'Evitar exposición solar. Acudir urgente a especialista.',
            ],
        ];

        return $protocols[$prefix] ?? [
            'cie10_code'         => $code,
            'first_line'         => [],
            'alternatives'       => [],
            'follow_up'          => 'Evaluación clínica.',
            'referral_criteria'  => 'Según criterio médico.',
            'patient_instructions'=> '',
        ];
    }

    // ── fastClose (S24 — Un click cierra la consulta) ─────────────────────

    /**
     * Fast Close: guarda diagnóstico + nota de evolución + cierra la consulta
     * en una sola request atómica.
     *
     * Payload mínimo:
     *   case_id      (string)  requerido
     *   cie10_code   (string)  requerido
     *   evolution    (string)  requerido (al menos 10 chars)
     *
     * Payload opcional:
     *   cie10_description  (string)
     *   notes              (string)  notas adicionales de diagnóstico
     *   post_instructions  (string)  indicaciones para el paciente
     *   close_stage        (string)  default: 'completed'
     *
     * Respuesta: { ok, closed_at, diagnosis_saved, evolution_id, stage }
     */
    public static function fastClose(array $context): void
    {
        self::requireAuth();
        $payload = require_json_body();

        $caseId     = trim((string) ($payload['case_id'] ?? ''));
        $cie10Code  = trim((string) ($payload['cie10_code'] ?? ''));
        $evolution  = trim((string) ($payload['evolution'] ?? ''));

        if ($caseId === '') {
            json_response(['ok' => false, 'error' => 'case_id requerido'], 400);
        }
        if ($cie10Code === '') {
            json_response(['ok' => false, 'error' => 'cie10_code requerido para cerrar la consulta'], 400);
        }
        if (strlen($evolution) < 10) {
            json_response(['ok' => false, 'error' => 'La nota de evolución debe tener al menos 10 caracteres'], 400);
        }

        $cie10Desc   = trim((string) ($payload['cie10_description'] ?? ''));
        $closeStage  = in_array($payload['close_stage'] ?? '', ['completed', 'follow_up', 'referred'], true)
            ? $payload['close_stage']
            : 'completed';

        // S10-02: audit de sugestión de IA en fast-close
        $aiSuggested = trim((string) ($payload['ai_suggested_code'] ?? ''));
        $outcome = $aiSuggested === '' ? 'manual' : ($aiSuggested === $cie10Code ? 'accepted_as_is' : 'edited');
        self::logClinicalAiAction([
            'action'       => 'openclaw-fast-close',
            'case_id'      => $caseId,
            'outcome'      => $outcome,
            'saved_value'  => $cie10Code . ' ' . $cie10Desc,
            'ai_suggested' => $aiSuggested,
            'diff'         => ($outcome === 'edited') ? ['from' => $aiSuggested, 'to' => $cie10Code] : null,
        ]);

        require_once __DIR__ . '/../lib/clinical_history/ClinicalHistoryService.php';
        $service      = new ClinicalHistoryService();
        $doctorProfile = doctor_profile_document_fields([
            'name' => trim((string) ($payload['doctor_name'] ?? ($_SESSION['admin_email'] ?? ''))),
        ]);

        $closedAt    = gmdate('c');
        $evolutionId = null;

        $result = self::mutateStore(static function (array $store) use (
            $service, $caseId, $cie10Code, $cie10Desc, $evolution,
            $closeStage, $closedAt, $doctorProfile, $payload, &$evolutionId
        ): array {
            // 1. Guardar diagnóstico
            $store = $service->saveDiagnosis($store, [
                'caseId'           => $caseId,
                'cie10Code'        => $cie10Code,
                'cie10Description' => $cie10Desc,
                'notes'            => $payload['notes'] ?? '',
                'source'           => 'openclaw-fast-close',
            ]);

            // 2. Guardar nota de evolución (incluyendo indicaciones si vienen)
            $evolutionText = $evolution;
            $postInstructions = trim((string) ($payload['post_instructions'] ?? ''));
            if ($postInstructions !== '') {
                $evolutionText .= "\n\n**Indicaciones para el paciente:**\n" . $postInstructions;
            }
            $evolutionResult = $service->saveEvolutionNote($store, [
                'caseId'          => $caseId,
                'text'            => $evolutionText,
                'cie10Code'       => $cie10Code,
                'doctorId'        => $payload['doctor_id'] ?? ($doctorProfile['name'] ?? ''),
                'doctorName'      => $doctorProfile['name'] ?? '',
                'doctorSpecialty' => $doctorProfile['specialty'] ?? '',
                'doctorMsp'       => $doctorProfile['msp'] ?? '',
                'source'          => 'openclaw-fast-close',
            ]);
            $evolutionId = $evolutionResult['id'] ?? null;
            $store       = $evolutionResult['store'] ?? $store;

            // 3. Cambiar el stage del caso a closed
            if (isset($store['cases'][$caseId])) {
                $store['cases'][$caseId]['stage']     = $closeStage;
                $store['cases'][$caseId]['closed_at'] = $closedAt;
            }

            return $store;
        });

        json_response([
            'ok'              => true,
            'closed_at'       => $closedAt,
            'diagnosis_saved' => true,
            'evolution_id'    => $evolutionId,
            'stage'           => $closeStage,
        ]);
    }

    // ── logClinicalAiAction (S10-02) ─────────────────────────────────────────

    /**
     * Escribe un evento de auditoría de IA clínica en data/clinical_ai_actions.jsonl
     *
     * Formato JSONL: un JSON por línea, append-only, nunca se modifica.
     * Campos: action, case_id, outcome, saved_value, ai_suggested, diff, doctor, ts.
     *
     * outcome: 'accepted_as_is' | 'edited' | 'rejected' | 'manual'
     */
    private static function logClinicalAiAction(array $event): void
    {
        try {
            $logPath = __DIR__ . '/../data/clinical_ai_actions.jsonl';
            $doctor  = trim((string) ($_SESSION['admin_email'] ?? 'unknown'));
            $entry   = json_encode(array_merge($event, [
                'doctor' => $doctor,
                'ts'     => gmdate('c'),
                'ip'     => trim((string) ($_SERVER['REMOTE_ADDR'] ?? '')),
            ]), JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . "\n";

            // Atomic append — usa file_put_contents con LOCK_EX
            file_put_contents($logPath, $entry, FILE_APPEND | LOCK_EX);
        } catch (\Throwable) {
            // El log de auditoría nunca debe interrumpir el flujo clínico
        }
    }
}
