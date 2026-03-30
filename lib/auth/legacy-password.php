<?php

declare(strict_types=1);

/**
 * ZONA DE RIESGO: Rutas de contraseña estáticas (Legacy Password Path)
 * Encapsula la verificación de hashes obsoletos y el login manual de contingencia.
 * Extraído por Refactor S8-20.
 */

function verify_admin_password(string $password): bool
{
    $hash = app_env('AURORADERM_ADMIN_PASSWORD_HASH');
    if (is_string($hash) && $hash !== '') {
        return password_verify($password, $hash);
    }

    $plain = app_env('AURORADERM_ADMIN_PASSWORD');
    if (is_string($plain) && $plain !== '') {
        return hash_equals($plain, $password);
    }

    return false;
}

function admin_password_is_configured(): bool
{
    $hash = app_env('AURORADERM_ADMIN_PASSWORD_HASH');
    if (is_string($hash) && trim($hash) !== '') {
        return true;
    }

    $plain = app_env('AURORADERM_ADMIN_PASSWORD');
    return is_string($plain) && trim($plain) !== '';
}

function internal_console_legacy_fallback_enabled(): bool
{
    $raw = app_env('AURORADERM_INTERNAL_CONSOLE_AUTH_ALLOW_LEGACY_FALLBACK');
    if (!is_string($raw)) {
        return false;
    }

    return in_array(strtolower(trim($raw)), ['1', 'true', 'yes', 'on'], true);
}

function internal_console_legacy_fallback_payload(): array
{
    $enabled = internal_console_legacy_fallback_enabled();
    $passwordConfigured = admin_password_is_configured();
    $twoFactorConfigured = admin_two_factor_is_configured();
    $configured = $passwordConfigured && $twoFactorConfigured;
    $available = $enabled && $configured;
    $reason = 'fallback_available';

    if (!$enabled) {
        $reason = 'fallback_disabled';
    } elseif (!$passwordConfigured) {
        $reason = 'admin_password_not_configured';
    } elseif (!$twoFactorConfigured) {
        $reason = 'admin_2fa_not_configured';
    }

    return [
        'enabled' => $enabled,
        'configured' => $configured,
        'requires2FA' => true,
        'available' => $available,
        'reason' => $reason,
    ];
}

function internal_console_auth_fallbacks_payload(): array
{
    return [
        'legacy_password' => internal_console_legacy_fallback_payload(),
    ];
}

function legacy_admin_is_authenticated(): bool
{
    return isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true;
}

function require_admin_auth(): void
{
    if (legacy_admin_is_authenticated() || operator_auth_is_authenticated()) {
        return;
    }

    json_response([
        'ok' => false,
        'error' => 'No autorizado',
    ], 401);
}
