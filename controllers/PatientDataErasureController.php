<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/ApiKernel.php';
require_once __DIR__ . '/../lib/DataAccessAudit.php';

class PatientDataErasureController
{
    public static function process(array $request): array
    {
        $method = strtoupper((string)($request['method'] ?? 'DELETE'));
        if ($method !== 'DELETE') {
            return ['statusCode' => 405, 'json' => ['ok' => false, 'error' => 'Metodo no soportado']];
        }

        if (!legacy_admin_is_authenticated() && !operator_auth_is_authenticated()) {
            return ['statusCode' => 401, 'json' => ['ok' => false, 'error' => 'No autorizado']];
        }

        $query = $request['query'] ?? [];
        $patientId = trim((string)($query['patient_id'] ?? ''));

        if ($patientId === '') {
            return ['statusCode' => 400, 'json' => ['ok' => false, 'error' => 'Falta patient_id']];
        }

        $erasedFields = [];
        $retainedFields = [];

        $result = with_store_lock(function() use ($patientId, &$erasedFields, &$retainedFields) {
            $store = read_store();
            $patient = $store['patients'][$patientId] ?? null;

            if ($patient === null) {
                return ['ok' => false, 'error' => 'Paciente no encontrado'];
            }

            // Erasure of PII
            $fieldsToErase = ['name', 'firstName', 'lastName', 'email', 'phone', 'whatsapp', 'whatsappNumber', 'idCard', 'dni', 'avatar', 'avatar_url', 'address', 'city'];
            foreach ($fieldsToErase as $field) {
                if (isset($patient[$field]) && $patient[$field] !== '') {
                    $erasedFields[] = $field;
                    $patient[$field] = '[ELIMINADO LOPD]';
                }
            }

            // Mark as wiped
            $patient['lopd_erased'] = true;
            $patient['lopd_erased_at'] = gmdate('c');

            $store['patients'][$patientId] = $patient;

            // Invalidate auth mapping if exists
            if (isset($store['patient_auth']) && is_array($store['patient_auth'])) {
                foreach ($store['patient_auth'] as $key => $auth) {
                    if (isset($auth['id']) && (string)$auth['id'] === $patientId) {
                        unset($store['patient_auth'][$key]);
                        $erasedFields[] = 'auth_credential';
                    }
                }
            }

            // Count retained legal records
            $appointmentsCount = 0;
            if (isset($store['appointments']) && is_array($store['appointments'])) {
                foreach ($store['appointments'] as $appt) {
                    if (isset($appt['patientId']) && (string)$appt['patientId'] === $patientId) {
                        $appointmentsCount++;
                    }
                }
            }
            if ($appointmentsCount > 0) {
                $retainedFields[] = ['field' => 'appointments', 'count' => $appointmentsCount, 'reason' => 'Retención médica legal (10 años)'];
            }

            $casesCount = 0;
            if (isset($store['patient_cases']) && is_array($store['patient_cases'])) {
                foreach ($store['patient_cases'] as $pc) {
                    if (isset($pc['patientId']) && (string)$pc['patientId'] === $patientId) {
                        $casesCount++;
                    }
                }
            }
            if ($casesCount > 0) {
                $retainedFields[] = ['field' => 'patient_cases', 'count' => $casesCount, 'reason' => 'Historia Clínica (Retención LOPD)'];
            }

            $storeDirty = true;
            return ['ok' => true, 'store' => $store, 'storeDirty' => $storeDirty];
        });

        if ($result['ok'] === false) {
            return ['statusCode' => 404, 'json' => ['ok' => false, 'error' => $result['error']]];
        }

        // Audit Trail 
        DataAccessAudit::logAccess('patient_data_erasure', $patientId);

        return [
            'statusCode' => 200,
            'json' => [
                'ok' => true,
                'message' => 'Datos PII eliminados o anonimizados correctamente',
                'erased_fields' => $erasedFields,
                'retained_fields' => $retainedFields
            ]
        ];
    }
}
