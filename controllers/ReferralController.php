<?php

declare(strict_types=1);

require_once __DIR__ . '/../api-lib.php';
require_once __DIR__ . '/../lib/referrals/ReferralService.php';

class ReferralController
{
    /**
     * Endpoint: GET /api.php?resource=referral-link&patient_id=X
     * Devuelve el código único asignado al paciente.
     */
    public static function getLink(): void
    {
        // En un escenario productivo esto probablemente requiera sesión,
        // pero por ahora dependemos del parámetro crudo `patient_id`.
        $patientId = $_GET['patient_id'] ?? null;
        if (!$patientId) {
            http_response_code(400);
            echo json_encode(["error" => "Se requiere patient_id"]);
            return;
        }
        
        $patientId = (string)$patientId;

        try {
            $code = ReferralService::getOrCreateLink($patientId);
            
            echo json_encode([
                'status' => 'success',
                'data' => [
                    'patient_id' => $patientId,
                    'code' => $code,
                    'share_url' => getenv('PIELARMONIA_BASE_URL') ? rtrim(getenv('PIELARMONIA_BASE_URL'), '/') . "/es/referidos/?ref=" . $code : "https://pielarmonia.com/es/referidos/?ref=" . $code
                ]
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'No se pudo generar el enlace de referidos', 'exception' => $e->getMessage()]);
        }
    }

    /**
     * Endpoint: POST /api.php?resource=referral-click
     * Payload: { "code": "REF-XXXX" }
     * Invocado de manera transparente por el frontend público al detectar el ID.
     */
    public static function trackClick(): void
    {
        $inputData = file_get_contents('php://input');
        $payload = json_decode($inputData, true);
        $code = trim((string)($payload['code'] ?? ''));

        if ($code === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Código vacío o inválido']);
            return;
        }

        try {
            $success = ReferralService::registerClick($code);
            echo json_encode(['status' => 'success', 'data' => ['tracked' => $success]]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error tracking click', 'exception' => $e->getMessage()]);
        }
    }

    /**
     * Endpoint: GET /api.php?resource=referral-stats&patient_id=X
     * Devuelve los contadores de referidos (clics, conversiones, beneficio ganado y util).
     */
    public static function getStats(): void
    {
        $patientId = $_GET['patient_id'] ?? null;
        if (!$patientId) {
            http_response_code(400);
            echo json_encode(["error" => "Se requiere patient_id"]);
            return;
        }

        $patientId = (string)$patientId;

        try {
            $stats = ReferralService::getStats($patientId);
            echo json_encode([
                'status' => 'success',
                'data' => [
                    'patient_id' => $patientId,
                    'stats' => $stats,
                    'share_url' => getenv('PIELARMONIA_BASE_URL') ? rtrim(getenv('PIELARMONIA_BASE_URL'), '/') . "/es/referidos/?ref=" . $stats['code'] : "https://pielarmonia.com/es/referidos/?ref=" . $stats['code']
                ]
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'No se pudo generar la estadistica de referidos', 'exception' => $e->getMessage()]);
        }
    }

    public static function handle(array $context): void
    {
        $resource = $context['resource'] ?? '';
        $method = $context['method'] ?? 'GET';
        $key = "$method:$resource";
        
        switch ($key) {
            case 'GET:referral-link':
                self::getLink($context);
                return;
            case 'GET:referral-stats':
                self::getStats($context);
                return;
            case 'POST:referral-click':
                self::trackClick($context);
                return;
            default:
                if (isset($context['action'])) {
                    $action = $context['action'];
                    switch ($action) {
                        case 'getLink':
                            self::getLink($context);
                            return;
                        case 'getStats':
                            self::getStats($context);
                            return;
                        case 'trackClick':
                            self::trackClick($context);
                            return;
                    }
                }
                json_response(['ok' => false, 'error' => 'Not found in controller dispatch: ' . $key], 404);
        }
    }
}
