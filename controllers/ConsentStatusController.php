<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/api_helpers.php';
require_once __DIR__ . '/../lib/auth.php';
require_once __DIR__ . '/../lib/consent/ConsentVersioning.php';
require_once __DIR__ . '/../lib/stores/PatientConsentStore.php';

final class ConsentStatusController
{
    public static function process(array $context): void
    {
        $method = $context['method'] ?? $_SERVER['REQUEST_METHOD'] ?? 'GET';
        $request = $_REQUEST;
        $patientId = trim($_GET['patient_id'] ?? $request['patient_id'] ?? '');
        $consentType = trim($_GET['consent_type'] ?? $request['consent_type'] ?? 'privacy_policy');

        if ($patientId === '') {
            json_response(['ok' => false, 'error' => 'El patient_id es requerido.', 'code' => 'consent_patient_required'], 400);
            return;
        }

        if ($method === 'GET') {
            self::readStatus($patientId, $consentType);
        } elseif ($method === 'POST') {
            self::signConsent($patientId, $consentType, $request);
        } else {
            json_response(['ok' => false, 'error' => 'Método no soportado.'], 405);
        }
    }

    public static function readStatus(string $patientId, string $consentType): void
    {
        try {
            $activeVersionData = ConsentVersioning::getActiveVersion($consentType);
            $currentVersion = $activeVersionData['version'];
        } catch (InvalidArgumentException $e) {
            json_response(['ok' => false, 'error' => "El tipo de consentimiento '{$consentType}' no es válido.", 'code' => 'consent_invalid_type'], 400);
            return;
        }

        $signedVersion = PatientConsentStore::readStatus($patientId, $consentType);

        $needsRenewal = ($signedVersion !== $currentVersion);

        json_response([
            'ok' => true,
            'data' => [
                'patient_id' => $patientId,
                'consent_type' => $consentType,
                'current_version' => $currentVersion,
                'signed_version' => $signedVersion,
                'needs_renewal' => $needsRenewal,
            ]
        ]);
    }

    public static function signConsent(string $patientId, string $consentType, array $request): void
    {
        $targetVersion = trim($request['version'] ?? '');
        if ($targetVersion === '') {
            json_response(['ok' => false, 'error' => 'La versión a firmar es requerida.', 'code' => 'consent_version_required'], 400);
            return;
        }

        try {
            $versions = ConsentVersioning::getAllVersions($consentType);
            if (!isset($versions[$targetVersion])) {
                json_response(['ok' => false, 'error' => 'La versión proporcionada no existe.', 'code' => 'consent_version_not_found'], 400);
                return;
            }
        } catch (InvalidArgumentException $e) {
            json_response(['ok' => false, 'error' => "El tipo de consentimiento '{$consentType}' no es válido.", 'code' => 'consent_invalid_type'], 400);
            return;
        }

        PatientConsentStore::markAsSigned($patientId, $consentType, $targetVersion);

        json_response([
            'ok' => true,
            'data' => [
                'message' => 'Consentimiento firmado exitosamente.',
                'patient_id' => $patientId,
                'consent_type' => $consentType,
                'signed_version' => $targetVersion,
            ]
        ]);
    }

    public static function handle(array $context): void
    {
        $resource = $context['resource'] ?? '';
        $method = $context['method'] ?? 'GET';
        $key = "$method:$resource";
        
        switch ($key) {
            case 'GET:consent-status':
                self::process($context);
                return;
            case 'POST:consent-status':
                self::process($context);
                return;
            default:
                if (isset($context['action'])) {
                    $action = $context['action'];
                    switch ($action) {
                        case 'process':
                            self::process($context);
                            return;
                        case 'process':
                            self::process($context);
                            return;
                    }
                }
                json_response(['ok' => false, 'error' => 'Not found in controller dispatch: ' . $key], 404);
        }
    }
}
