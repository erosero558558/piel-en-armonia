<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/PatientPortalAuth.php';

final class PatientPortalController
{
    public static function start(array $context): void
    {
        $payload = require_json_body();
        $phone = trim((string) ($payload['phone'] ?? ($payload['whatsapp'] ?? '')));

        $result = PatientPortalAuth::startLogin(
            is_array($context['store'] ?? null) ? $context['store'] : [],
            $phone
        );

        self::emit($result);
    }

    public static function complete(array $context): void
    {
        $payload = require_json_body();
        $phone = trim((string) ($payload['phone'] ?? ($payload['whatsapp'] ?? '')));
        $code = trim((string) ($payload['code'] ?? ($payload['otp'] ?? '')));
        $challengeId = trim((string) ($payload['challengeId'] ?? ''));

        $result = PatientPortalAuth::completeLogin(
            is_array($context['store'] ?? null) ? $context['store'] : [],
            $phone,
            $code,
            $challengeId
        );

        self::emit($result);
    }

    public static function status(array $context): void
    {
        $result = PatientPortalAuth::readStatus(
            is_array($context['store'] ?? null) ? $context['store'] : [],
            PatientPortalAuth::bearerTokenFromRequest()
        );

        self::emit($result);
    }

    private static function emit(array $result): void
    {
        if (($result['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'No se pudo completar la autenticacion del portal'),
                'code' => (string) ($result['code'] ?? 'patient_portal_error'),
            ], (int) ($result['status'] ?? 500));
        }

        json_response([
            'ok' => true,
            'data' => is_array($result['data'] ?? null) ? $result['data'] : [],
        ]);
    }
}
