<?php

declare(strict_types=1);

/**
 * OpenclawClinicalFacade — Facade para guardado de notas clínicas y diagnósticos.
 *
 * Se extrajo de OpenclawController (S42-05) para aislar la persistencia en historia
 * clínica originada desde inferencias del copiloto.
 */
class OpenclawClinicalFacade
{

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
        self::saveEvolution($context);
    }
}
