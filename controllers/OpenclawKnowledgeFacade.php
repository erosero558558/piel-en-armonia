<?php

declare(strict_types=1);
class OpenclawKnowledgeFacade
{
    // ── patient ──────────────────────────────────────────────────────────────

    /**
     * GET /api.php?resource=openclaw-patient&patient_id=X&case_id=Y
     * Carga el contexto completo del paciente para alimentar la IA.
     * Este es el dato que diferencia a OpenClaw de ChatGPT solo.
     */
    public static function patient(array $context): void
    {
        OpenclawController::requireAuth();

        $patientId = trim((string) ($_GET['patient_id'] ?? ''));
        $caseId    = trim((string) ($_GET['case_id'] ?? ''));

        if ($patientId === '') {
            json_response(['ok' => false, 'error' => 'patient_id requerido'], 400);
        }

        $store   = OpenclawController::readStore();

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
        $knownAllergies = $case['known_allergies'] ?? ($store['patients'][$patientId]['known_allergies'] ?? []);
        if (is_string($knownAllergies) && trim($knownAllergies) !== '') {
            $knownAllergies = array_map('trim', explode(',', $knownAllergies));
        } elseif (!is_array($knownAllergies)) {
            $knownAllergies = [];
        }
        $allergies = array_values(array_unique(array_filter(array_merge($allergies, $knownAllergies))));
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
            'last_diagnosis'      => $lastDx,
            'active_medications'  => $medications,
            'last_evolution_date' => $history['last_evolution'] ?? '',
            'pending_labs'        => $pendingLabs,
            'chronic_status'      => $chronicStatus,
            'self_reported_vitals' => $selfReportedVitals,
            // S37-02: Anamnesis estructurada disponible para el GPT
            'structured_anamnesis' => $draft['intake']['structured_anamnesis'] ?? null,
            // S31-03: Alergias preformateadas para el prompt
            'allergies'           => array_values(array_filter(array_merge(
                is_array($allergies) ? $allergies : [],
                array_map(
                    static fn ($a) => ($a['allergen'] ?? '') . (isset($a['reaction']) ? ' (' . $a['reaction'] . ')' : ''),
                    (array) ($draft['intake']['structured_anamnesis']['alergias'] ?? [])
                )
            ), static fn ($v) => $v !== '')),
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
            'age'              => OpenclawController::calculateAge($case['birthDate'] ?? ''),
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
        OpenclawController::requireAuth();

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

        public static function suggestCie10(array $context): void
    {
        self::cie10Suggest($context);
    }

        /**
     * GET /api.php?resource=openclaw-protocol&code=L20.0
     * Devuelve el protocolo de tratamiento estándar para un diagnóstico CIE-10.
     * Los protocolos se pueden extender en data/protocols/{code}.json
     */
    public static function protocol(array $context): void
    {
        OpenclawController::requireAuth();

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

        public static function getTreatmentProtocol(array $context): void
    {
        self::protocol($context);
    }

        public static function genericProtocol(string $code): array
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

}
