<?php

declare(strict_types=1);

/**
 * ZONA DE RIESGO: Puente remoto (Operator Auth Bridge).
 * Firma, validación de M2M y sincronización de sesiones vía helper remoto.
 * Extraído por Refactor S8-20.
 */

function operator_auth_bridge_timestamp_skew_seconds(): int
{
    $raw = app_env('AURORADERM_OPERATOR_AUTH_BRIDGE_MAX_SKEW_SECONDS');
    $value = is_string($raw) && trim($raw) !== '' ? (int) trim($raw) : 300;
    return max(30, min(1800, $value));
}

function operator_auth_bridge_token(): string
{
    $raw = app_env('AURORADERM_OPERATOR_AUTH_BRIDGE_TOKEN');
    return is_string($raw) ? trim($raw) : '';
}

function operator_auth_bridge_signature_secret(): string
{
    $raw = app_env('AURORADERM_OPERATOR_AUTH_BRIDGE_SECRET');
    $secret = is_string($raw) ? trim($raw) : '';
    if ($secret !== '') {
        return $secret;
    }

    return operator_auth_bridge_token();
}

function operator_auth_bridge_token_header(): string
{
    $raw = app_env('AURORADERM_OPERATOR_AUTH_BRIDGE_TOKEN_HEADER');
    return is_string($raw) && trim($raw) !== '' ? trim($raw) : 'Authorization';
}

function operator_auth_bridge_token_prefix(): string
{
    $raw = app_env('AURORADERM_OPERATOR_AUTH_BRIDGE_TOKEN_PREFIX');
    return is_string($raw) && trim($raw) !== '' ? trim($raw) : 'Bearer';
}

function operator_auth_bridge_signature_payload(array $payload): string
{
    $status = strtolower(trim((string) ($payload['status'] ?? 'completed')));
    $timestamp = trim((string) ($payload['timestamp'] ?? ''));
    $challengeId = trim((string) ($payload['challengeId'] ?? ''));
    $nonce = trim((string) ($payload['nonce'] ?? ''));
    $deviceId = trim((string) ($payload['deviceId'] ?? ''));

    if ($status === 'error') {
        return implode("\n", [
            $challengeId,
            $nonce,
            $status,
            trim((string) ($payload['errorCode'] ?? '')),
            trim((string) ($payload['error'] ?? '')),
            $deviceId,
            $timestamp,
        ]);
    }

    return implode("\n", [
        $challengeId,
        $nonce,
        $status,
        operator_auth_normalize_email((string) ($payload['email'] ?? '')),
        trim((string) ($payload['profileId'] ?? '')),
        trim((string) ($payload['accountId'] ?? '')),
        $deviceId,
        $timestamp,
    ]);
}

function operator_auth_validate_bridge_signature(array $payload): bool
{
    $secret = operator_auth_bridge_signature_secret();
    $signature = trim((string) ($payload['signature'] ?? ''));
    if ($secret === '' || $signature === '') {
        return false;
    }

    $expected = hash_hmac('sha256', operator_auth_bridge_signature_payload($payload), $secret);
    return hash_equals($expected, $signature);
}

function operator_auth_complete_from_bridge(array $payload): array
{
    operator_auth_purge_expired_challenges();

    $challengeId = trim((string) ($payload['challengeId'] ?? ''));
    $nonce = trim((string) ($payload['nonce'] ?? ''));
    $deviceId = trim((string) ($payload['deviceId'] ?? ''));
    $timestamp = trim((string) ($payload['timestamp'] ?? ''));
    $status = strtolower(trim((string) ($payload['status'] ?? 'completed')));

    if (!operator_auth_is_enabled()) {
        return ['payload' => operator_auth_config_error_payload(), 'status' => 503];
    }
    if (!operator_auth_is_valid_challenge_id($challengeId)) {
        return ['payload' => ['ok' => false, 'error' => 'challengeId invalido'], 'status' => 400];
    }
    if ($nonce === '' || $deviceId === '' || $timestamp === '') {
        return ['payload' => ['ok' => false, 'error' => 'Faltan campos obligatorios del bridge'], 'status' => 400];
    }

    $challenge = operator_auth_read_challenge($challengeId);
    if (!is_array($challenge)) {
        return ['payload' => ['ok' => false, 'error' => 'Challenge no encontrado'], 'status' => 404];
    }
    if (((string) ($challenge['nonce'] ?? '')) !== $nonce) {
        return ['payload' => ['ok' => false, 'error' => 'Nonce invalido'], 'status' => 400];
    }

    $expiresAt = isset($challenge['expiresAt']) ? strtotime((string) $challenge['expiresAt']) : false;
    if (($expiresAt !== false) && ((int) $expiresAt) <= time()) {
        operator_auth_mark_challenge($challenge, 'expired', [
            'errorCode' => 'challenge_expirado',
            'error' => 'El challenge ya expiro.',
        ]);
        return ['payload' => ['ok' => false, 'error' => 'Challenge expirado'], 'status' => 410];
    }

    if ((string) ($challenge['status'] ?? '') !== 'pending') {
        return ['payload' => ['ok' => false, 'error' => 'El challenge ya no acepta cambios'], 'status' => 409];
    }

    if (!operator_auth_validate_bridge_signature($payload)) {
        return ['payload' => ['ok' => false, 'error' => 'Firma del bridge invalida'], 'status' => 401];
    }

    $reportedAt = strtotime($timestamp);
    if ($reportedAt === false || abs(time() - (int) $reportedAt) > operator_auth_bridge_timestamp_skew_seconds()) {
        return ['payload' => ['ok' => false, 'error' => 'Timestamp del bridge fuera de ventana'], 'status' => 400];
    }

    $status = $status === 'error' ? 'error' : 'completed';
    if ($status === 'error') {
        $errorCode = trim((string) ($payload['errorCode'] ?? 'helper_no_disponible'));
        $errorMessage = trim((string) ($payload['error'] ?? 'El helper local no pudo completar la autenticacion.'));
        $updated = operator_auth_mark_challenge($challenge, 'error', [
            'errorCode' => $errorCode,
            'error' => $errorMessage,
            'deviceId' => $deviceId,
            'completedAt' => operator_auth_now_iso(),
            'bridgeTimestamp' => $timestamp,
        ]);

        if (function_exists('audit_log_event')) {
            audit_log_event('operator_auth.denied', [
                'challengeId' => $challengeId,
                'deviceId' => $deviceId,
                'reason' => $errorCode,
            ]);
        }

        return [
            'payload' => [
                'ok' => true,
                'accepted' => true,
                'status' => operator_auth_map_error_code_to_status($errorCode),
                'challenge' => operator_auth_challenge_public_payload($updated),
            ],
            'status' => 202,
        ];
    }

    $email = operator_auth_normalize_email((string) ($payload['email'] ?? ''));
    $profileId = trim((string) ($payload['profileId'] ?? ''));
    $accountId = trim((string) ($payload['accountId'] ?? ''));

    if ($email === '' || $profileId === '') {
        $updated = operator_auth_mark_challenge($challenge, 'error', [
            'errorCode' => 'openclaw_email_missing',
            'error' => 'El broker de autenticacion no expuso un email resoluble para este perfil.',
            'deviceId' => $deviceId,
            'completedAt' => operator_auth_now_iso(),
            'bridgeTimestamp' => $timestamp,
        ]);

        if (function_exists('audit_log_event')) {
            audit_log_event('operator_auth.denied', [
                'challengeId' => $challengeId,
                'deviceId' => $deviceId,
                'reason' => 'openclaw_email_missing',
            ]);
        }

        return [
            'payload' => [
                'ok' => true,
                'accepted' => true,
                'status' => 'helper_no_disponible',
                'challenge' => operator_auth_challenge_public_payload($updated),
            ],
            'status' => 202,
        ];
    }

    if (!operator_auth_is_email_allowed($email)) {
        $updated = operator_auth_mark_challenge($challenge, 'denied', [
            'email' => $email,
            'profileId' => $profileId,
            'accountId' => $accountId,
            'deviceId' => $deviceId,
            'errorCode' => 'email_no_permitido',
            'error' => 'El email autenticado no esta autorizado para operar este panel.',
            'completedAt' => operator_auth_now_iso(),
            'bridgeTimestamp' => $timestamp,
        ]);

        if (function_exists('audit_log_event')) {
            audit_log_event('operator_auth.denied', [
                'challengeId' => $challengeId,
                'email' => $email,
                'deviceId' => $deviceId,
                'reason' => 'email_no_permitido',
            ]);
        }

        return [
            'payload' => [
                'ok' => false,
                'accepted' => false,
                'status' => 'email_no_permitido',
                'error' => 'El email autenticado no esta autorizado para operar este panel.',
                'challenge' => operator_auth_challenge_public_payload($updated),
            ],
            'status' => 403,
        ];
    }

    $updated = operator_auth_mark_challenge($challenge, 'completed', [
        'email' => $email,
        'profileId' => $profileId,
        'accountId' => $accountId,
        'deviceId' => $deviceId,
        'completedAt' => operator_auth_now_iso(),
        'bridgeTimestamp' => $timestamp,
    ]);

    if (function_exists('audit_log_event')) {
        audit_log_event('operator_auth.completed', [
            'challengeId' => $challengeId,
            'email' => $email,
            'profileId' => $profileId,
            'deviceId' => $deviceId,
        ]);
    }

    return [
        'payload' => [
            'ok' => true,
            'accepted' => true,
            'status' => 'completed',
            'challenge' => operator_auth_challenge_public_payload($updated),
        ],
        'status' => 202,
    ];
}
