<?php

declare(strict_types=1);

/**
 * ZONA DE RIESGO: 2FA Temporal Bypass y validaciones TOTP.
 * Encapsula la gestión de ventanas de gracia y validación de tokens de 6 dígitos.
 * Extraído por Refactor S8-20.
 */

function admin_two_factor_is_configured(): bool
{
    $secret = app_env('AURORADERM_ADMIN_2FA_SECRET');
    return is_string($secret) && trim($secret) !== '';
}

function verify_2fa_code(string $code): bool
{
    $secret = app_env('AURORADERM_ADMIN_2FA_SECRET');
    if (!is_string($secret) || trim($secret) === '') {
        return false;
    }
    return TOTP::verify($secret, $code);
}
