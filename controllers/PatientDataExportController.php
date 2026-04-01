<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/ApiKernel.php';
require_once __DIR__ . '/../lib/DataAccessAudit.php';

class PatientDataExportController
{
    public static function process(array $request): array
    {
        $method = strtoupper((string)($request['method'] ?? 'GET'));
        if ($method !== 'GET') {
            return ['statusCode' => 405, 'json' => ['ok' => false, 'error' => 'Metodo no soportado']];
        }

        // Permitimos exportar a admins, o al paciente autenticado (si implemento auth para el portal futuro)
        // Por ahora, solo admin exporta por LOPD
        if (!legacy_admin_is_authenticated() && !operator_auth_is_authenticated()) {
            return ['statusCode' => 401, 'json' => ['ok' => false, 'error' => 'No autorizado']];
        }

        $query = $request['query'] ?? [];
        $patientId = trim((string)($query['patient_id'] ?? ''));

        if ($patientId === '') {
            return ['statusCode' => 400, 'json' => ['ok' => false, 'error' => 'Falta patient_id']];
        }

        $store = read_store();
        $patient = $store['patients'][$patientId] ?? null;

        if ($patient === null) {
            return ['statusCode' => 404, 'json' => ['ok' => false, 'error' => 'Paciente no encontrado']];
        }

        DataAccessAudit::logAccess('patient_data_export', $patientId);

        $exportData = [
            'profile' => $patient,
            'appointments' => [],
            'cases' => [],
            'clinical_history' => [],
            'prescriptions' => [],
            'payments' => [] // as a placeholder
        ];

        if (isset($store['appointments']) && is_array($store['appointments'])) {
            foreach ($store['appointments'] as $appt) {
                if (isset($appt['patientId']) && (string)$appt['patientId'] === $patientId) {
                    $exportData['appointments'][] = $appt;
                }
            }
        }

        if (isset($store['patient_cases']) && is_array($store['patient_cases'])) {
            foreach ($store['patient_cases'] as $pc) {
                if (isset($pc['patientId']) && (string)$pc['patientId'] === $patientId) {
                    $exportData['cases'][] = $pc;
                }
            }
        }

        // Recolectar history y precriptions si el namespace es global
        if (isset($store['clinical_history_events']) && is_array($store['clinical_history_events'])) {
            foreach ($store['clinical_history_events'] as $event) {
                if (isset($event['patientId']) && (string)$event['patientId'] === $patientId) {
                    $exportData['clinical_history'][] = $event;
                }
            }
        }

        if (isset($store['prescriptions']) && is_array($store['prescriptions'])) {
            foreach ($store['prescriptions'] as $rx) {
                if (isset($rx['patientId']) && (string)$rx['patientId'] === $patientId) {
                    $exportData['prescriptions'][] = $rx;
                }
            }
        }

        $format = strtolower(trim((string)($query['format'] ?? 'zip')));

        if ($format === 'json' || !class_exists('ZipArchive')) {
            // Direct JSON return
            return [
                'statusCode' => 200,
                'json' => [
                    'ok' => true,
                    'patient_id' => $patientId,
                    'exported_at' => gmdate('c'),
                    'data' => $exportData
                ]
            ];
        }

        // ZIP return
        $zip = new \ZipArchive();
        $tmpf = tempnam(sys_get_temp_dir(), 'export_') . '.zip';
        if ($zip->open($tmpf, ZipArchive::CREATE) !== true) {
            return ['statusCode' => 500, 'json' => ['ok' => false, 'error' => 'Could not create zip archive']];
        }

        $zip->addFromString('profile.json', json_encode($exportData['profile'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        $zip->addFromString('appointments.json', json_encode($exportData['appointments'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        $zip->addFromString('clinical_cases.json', json_encode($exportData['cases'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        $zip->addFromString('history.json', json_encode($exportData['clinical_history'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        $zip->addFromString('prescriptions.json', json_encode($exportData['prescriptions'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        
        $meta = [
            'exported_by' => DataAccessAudit::detectAccessor(),
            'exported_at' => gmdate('c'),
            'patient_id' => $patientId,
            'reason' => 'Data Portability Rights (LOPD)',
            'clinic' => 'Aurora Derm'
        ];
        $zip->addFromString('_metadata.json', json_encode($meta, JSON_PRETTY_PRINT));
        $zip->close();

        // Emit zip directly using a custom struct so api.php doesn't wrap it in json
        header('Content-Type: application/zip');
        header('Content-Disposition: attachment; filename="aurora_export_' . $patientId . '.zip"');
        header('Content-Length: ' . filesize($tmpf));
        readfile($tmpf);
        unlink($tmpf);

        // Terminar el script porque es una descarga binaria
        exit(0);
    }
}
