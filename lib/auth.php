<?php
declare(strict_types=1);

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/http.php';

/**
 * Session and authentication logic.
 */

const SESSION_TIMEOUT = 1800; // 30 minutos de inactividad

function start_secure_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $secure = is_https_request();

    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_strict_mode', '1');
    ini_set('session.cookie_httponly', '1');
    ini_set('session.cookie_secure', $secure ? '1' : '0');

    if (PHP_VERSION_ID >= 70300) {
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'domain' => '',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Strict'
        ]);
    } else {
        ini_set('session.cookie_samesite', 'Strict');
        session_set_cookie_params(0, '/; samesite=Strict', '', $secure, true);
    }

    session_start();

    // Expirar sesion por inactividad
    if (isset($_SESSION['last_activity']) && (time() - $_SESSION['last_activity']) > SESSION_TIMEOUT) {
        destroy_secure_session();
        start_secure_session();
    }
    $_SESSION['last_activity'] = time();
}

function destroy_secure_session(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        return;
    }

    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        if (PHP_VERSION_ID >= 70300) {
            setcookie(session_name(), '', [
                'expires' => time() - 42000,
                'path' => $params['path'] ?? '/',
                'domain' => $params['domain'] ?? '',
                'secure' => (bool) ($params['secure'] ?? false),
                'httponly' => (bool) ($params['httponly'] ?? true),
                'samesite' => 'Strict'
            ]);
        } else {
            setcookie(session_name(), '', time() - 42000, ($params['path'] ?? '/') . '; samesite=Strict', $params['domain'] ?? '', (bool) ($params['secure'] ?? false), (bool) ($params['httponly'] ?? true));
        }
    }

    session_destroy();
}

function verify_admin_password(string $password): bool
{
    $hash = getenv('PIELARMONIA_ADMIN_PASSWORD_HASH');
    if (is_string($hash) && $hash !== '') {
        return password_verify($password, $hash);
    }

    $plain = getenv('PIELARMONIA_ADMIN_PASSWORD');
    if (is_string($plain) && $plain !== '') {
        return hash_equals($plain, $password);
    }

    return false;
}
