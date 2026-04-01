<?php

declare(strict_types=1);

/**
 * ZONA DE RIESGO: Rutas de contraseña estáticas (Legacy Password Path)
 * Encapsula la verificación de hashes obsoletos y el login manual de contingencia.
 * Extraído por Refactor S8-20.
 *
 * S7-01: Rate-limit y audit logging añadidos.
 * Activación controlada por: AURORADERM_INTERNAL_CONSOLE_AUTH_ALLOW_LEGACY_FALLBACK=true
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

/**
 * S7-01: Wrapper con logging y rate-limit.
 * Máximo 5 intentos por IP en 15 minutos.
 */
function verify_admin_password_rate_limited(string $password, string $callerContext = 'admin'): bool
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

    // Rate-limit: max 5 intentos/15min por IP (APCu si disponible, session fallback)
    $maxAttempts = 5;
    $windowSecs  = 900; // 15 min
    $cacheKey    = 'legacy_auth_attempts_' . md5($ip);

    if (function_exists('apcu_fetch')) {
        $attempts = (int) (apcu_fetch($cacheKey) ?: 0);
        if ($attempts >= $maxAttempts) {
            error_log(sprintf(
                '[AURORA-SEC][LEGACY-AUTH] RATE_LIMITED ip=%s caller=%s attempts=%d',
                $ip, $callerContext, $attempts
            ));
            return false;
        }
        apcu_store($cacheKey, $attempts + 1, $windowSecs);
    }

    $result = verify_admin_password($password);

    // Audit log siempre — exitoso o fallido
    error_log(sprintf(
        '[AURORA-SEC][LEGACY-AUTH] result=%s ip=%s caller=%s ts=%s',
        $result ? 'OK' : 'FAIL',
        $ip,
        $callerContext,
        date('c')
    ));

    return $result;
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
        'enabled'     => $enabled,
        'configured'  => $configured,
        'requires2FA' => true,
        'available'   => $available,
        'reason'      => $reason,
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
    $isAuth = isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true;

    // S7-01: Audit log cuando se usa la sesión legacy — una vez por request
    if ($isAuth) {
        static $logged = false;
        if (!$logged) {
            $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
            error_log(sprintf(
                '[AURORA-SEC][LEGACY-SESSION] active ip=%s uri=%s ts=%s',
                $ip,
                $_SERVER['REQUEST_URI'] ?? '?',
                date('c')
            ));
            $logged = true;
        }
    }

    return $isAuth;
}

function require_admin_auth(): void
{
    if (legacy_admin_is_authenticated() || operator_auth_is_authenticated()) {
        $strict = false;
        $profilePath = dirname(__DIR__) . '/data/config/clinic-profile.json';
        if (is_file($profilePath)) {
            $raw = @file_get_contents($profilePath);
            if (is_string($raw)) {
                $data = json_decode($raw, true);
                $strict = !empty($data['operatorConcurrencyStrict']);
            }
        }

        if ($strict) {
            $tabId = $_SERVER['HTTP_X_TAB_SESSION_ID'] ?? '';
            if ($tabId !== '') {
                if (!isset($_SESSION['active_tab_session_id'])) {
                    $_SESSION['active_tab_session_id'] = $tabId;
                } elseif ($_SESSION['active_tab_session_id'] !== $tabId) {
                    json_response([
                        'ok'    => false,
                        'error' => 'session_transferred',
                        'code'  => 'session_transferred',
                        'message' => 'Sesión transferida a otra ventana o dispositivo.'
                    ], 409);
                }
            }
        }

        return;
    }

    json_response([
        'ok'    => false,
        'error' => 'No autorizado',
    ], 401);
}
