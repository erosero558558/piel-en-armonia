<?php
declare(strict_types=1);

/**
 * Session and authentication logic.
 */

const ADMIN_PASSWORD_ENV = 'PIELARMONIA_ADMIN_PASSWORD';
const ADMIN_PASSWORD_HASH_ENV = 'PIELARMONIA_ADMIN_PASSWORD_HASH';
const APP_TIMEZONE = 'America/Guayaquil';
const SESSION_TIMEOUT = 1800; // 30 minutos de inactividad

function app_runtime_version(): string
{
    static $resolved = null;
    if (is_string($resolved) && $resolved !== '') {
        return $resolved;
    }

    $candidates = [
        getenv('PIELARMONIA_APP_VERSION'),
        getenv('APP_VERSION')
    ];

    foreach ($candidates as $candidate) {
        if (is_string($candidate) && trim($candidate) !== '') {
            $resolved = trim($candidate);
            return $resolved;
        }
    }

    $versionSources = [
        __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'index.html',
        __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'script.js',
        __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'styles.css',
        __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'api.php',
        __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'figo-chat.php'
    ];

    $latestMtime = 0;
    foreach ($versionSources as $source) {
        if (!is_file($source)) {
            continue;
        }
        $mtime = @filemtime($source);
        if (is_int($mtime) && $mtime > $latestMtime) {
            $latestMtime = $mtime;
        }
    }

    if ($latestMtime > 0) {
        $resolved = gmdate('YmdHis', $latestMtime);
    } else {
        $resolved = 'dev';
    }

    return $resolved;
}

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
    $hash = getenv(ADMIN_PASSWORD_HASH_ENV);
    if (is_string($hash) && $hash !== '') {
        return password_verify($password, $hash);
    }

    $plain = getenv(ADMIN_PASSWORD_ENV);
    if (is_string($plain) && $plain !== '') {
        return hash_equals($plain, $password);
    }

    return false;
}
