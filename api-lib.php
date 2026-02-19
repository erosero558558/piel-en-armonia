<?php
declare(strict_types=1);

/**
 * Shared helpers for lightweight JSON API persistence.
 */

// Autoloader de Composer (para PHPMailer y otras dependencias)
$autoloadFile = __DIR__ . DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR . 'autoload.php';
if (is_file($autoloadFile)) {
    require_once $autoloadFile;
}

// Cargar variables de entorno desde env.php sin ejecutarlo directamente.
// Esto evita que un error de sintaxis en env.php tumbe toda la aplicacion.
$envFile = __DIR__ . DIRECTORY_SEPARATOR . 'env.php';
if (is_file($envFile) && is_readable($envFile)) {
    $envLines = @file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (is_array($envLines)) {
        foreach ($envLines as $rawLine) {
            $line = trim((string) $rawLine);
            $prefix2 = substr($line, 0, 2);
            $prefix1 = substr($line, 0, 1);
            if ($line === '' || $prefix2 === '//' || $prefix1 === '#' || $prefix2 === '/*' || $prefix1 === '*') {
                continue;
            }

            if (!preg_match('/^putenv\(\s*([\'"])(.+)\1\s*\)\s*;\s*$/', $line, $matches)) {
                continue;
            }

            $pair = $matches[2];
            $equalPos = strpos($pair, '=');
            if ($equalPos === false || $equalPos === 0) {
                continue;
            }

            $key = substr($pair, 0, $equalPos);
            $value = substr($pair, $equalPos + 1);

            // No sobreescribir variables ya definidas a nivel servidor.
            if (getenv($key) !== false) {
                continue;
            }

            @putenv($pair);
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
        }
    }
}

// Cargar librerias modularizadas
require_once __DIR__ . '/lib/common.php';
require_once __DIR__ . '/lib/validation.php';
require_once __DIR__ . '/lib/http.php';
require_once __DIR__ . '/lib/models.php';
require_once __DIR__ . '/lib/business.php';
require_once __DIR__ . '/lib/storage.php';
require_once __DIR__ . '/lib/audit.php';
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/email.php';
require_once __DIR__ . '/lib/ratelimit.php';
