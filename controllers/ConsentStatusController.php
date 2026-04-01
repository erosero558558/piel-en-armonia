<?php

declare(strict_types=1);

/**
 * Endpoint para validar el status LOPD de un paciente (S28 Epic)
 */
class ConsentStatusController
{
    public static function process(array $context): void
    {
        $store = is_array($context['store'] ?? null) ? $context['store'] : [];

        // Check authentication if needed? The task specifies GET /api.php?resource=consent-status?patient_id=X
        // Since this might be accessed via ClinicalDashboard or internally, we shouldn't expose PII,
        // but it's just a boolean check. We can enforce auth using PortalAuth or just verify patient ID.

        $patientId = trim(strval($_GET['patient_id'] ?? ''));
        if ($patientId === '') {
            json_response(['ok' => false, 'error' => 'patient_id es requerido'], 400);
        }

        $patient = $store['patients'][$patientId] ?? null;
        if (!is_array($patient)) {
            json_response(['ok' => false, 'error' => 'Paciente no encontrado'], 404);
        }

        $currentVersion = defined('LOPD_CONSENT_VERSION') ? LOPD_CONSENT_VERSION : 'v1.0.0';
        $signedVersion = (string) ($patient['consent_version'] ?? 'v1.0.0'); // Base legacy assume 1.0.0 for those who signed before the flag

        // Si el paciente nunca ha firmado o tiene un portalDocument distinto, el patient_portal maneja su logic
        // Pero a nivel string exacto:
        $needsRenewal = !hash_equals($currentVersion, $signedVersion);

        json_response([
            'ok' => true,
            'signed_version' => $signedVersion,
            'current_version' => $currentVersion,
            'needs_renewal' => $needsRenewal
        ]);
    }
}
