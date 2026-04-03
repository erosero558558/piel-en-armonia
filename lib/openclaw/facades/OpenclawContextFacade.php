<?php

declare(strict_types=1);

require_once __DIR__ . '/../../clinical_history/ClinicalHistoryService.php';
require_once __DIR__ . '/../../clinical_history/ClinicalHistorySessionRepository.php';

final class OpenclawContextFacade
{
    public static function buildPatientContext(array $store, string $patientId, string $caseId, callable $calculateAge): array
    {
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
            return ['ok' => false, 'error' => 'Caso no encontrado', 'statusCode' => 404];
        }

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

        $activeSession = ClinicalHistorySessionRepository::findSessionByCaseId($store, $case['id'] ?? $caseId);
        $vitalAlerts = [];
        $vitalAlertCritical = false;
        $integrityWarning = false;
        $draft = null;
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

        return [
            'ok' => true,
            'integrity_warning'  => $integrityWarning,
            'vital_alerts'       => $vitalAlerts,
            'vital_alert_critical' => $vitalAlertCritical,
            'patient_id'       => $patientId,
            'case_id'          => $case['id'] ?? $caseId,
            'name'             => trim(($case['firstName'] ?? '') . ' ' . ($case['lastName'] ?? '')),
            'age'              => $calculateAge($case['birthDate'] ?? ''),
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
        ];
    }
}
