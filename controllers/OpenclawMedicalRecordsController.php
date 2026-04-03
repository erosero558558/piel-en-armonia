<?php

require_once __DIR__ . '/OpenclawController.php';

class OpenclawMedicalRecordsController
{
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

    public static function saveDiagnosis(array $context): void
        {
            OpenclawController::requireDoctorAuth();
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
            OpenclawController::logClinicalAiAction([
                'action'       => 'openclaw-save-diagnosis',
                'case_id'      => $caseId,
                'outcome'      => $outcome,
                'saved_value'  => $cie10Code . ' ' . $cie10Desc,
                'ai_suggested' => $aiSuggested,
                'diff'         => ($outcome === 'edited') ? ['from' => $aiSuggested, 'to' => $cie10Code] : null,
            ]);
    
            require_once __DIR__ . '/../lib/clinical_history/ClinicalHistoryService.php';
            $service = new ClinicalHistoryService();
            $result  = OpenclawController::mutateStore(static function (array $store) use ($service, $caseId, $cie10Code, $cie10Desc, $payload): array {
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
            OpenclawController::requireDoctorAuth();
            $payload = require_json_body();
    
            $caseId = trim((string) ($payload['case_id'] ?? ''));
            $cie10Code = trim((string) ($payload['cie10_code'] ?? ''));
            $cie10Desc = trim((string) ($payload['cie10_description'] ?? ''));
            $frequency = (int) ($payload['followup_days'] ?? 90);
    
            if ($caseId === '' || $cie10Code === '') {
                json_response(['ok' => false, 'error' => 'case_id y cie10_code requeridos'], 400);
            }
    
            $result = OpenclawController::mutateStore(static function (array $store) use ($caseId, $cie10Code, $cie10Desc, $frequency): array {
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

    public static function saveEvolution(array $context): void
        {
            OpenclawController::requireDoctorAuth();
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
    
            $result  = OpenclawController::mutateStore(static function (array $store) use ($service, $caseId, $text, $payload, $doctorProfile): array {
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

    public static function saveEvolutionNote(array $context): void
        {
            OpenclawController::saveEvolution($context);
        }

}
