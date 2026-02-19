<?php
declare(strict_types=1);

/**
 * Shared helpers for lightweight JSON API persistence.
 *
 * This file is now a wrapper that aggregates modularized functions from lib/.
 */

// Autoloader de Composer (para PHPMailer y otras dependencias)
$autoloadFile = __DIR__ . DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR . 'autoload.php';
if (is_file($autoloadFile)) {
    require_once $autoloadFile;
}

// Cargar variables de entorno si existe env.php
$envFile = __DIR__ . DIRECTORY_SEPARATOR . 'env.php';
if (is_file($envFile)) {
    require_once $envFile;
}

// Cargar modulos
require_once __DIR__ . '/lib/validation.php';
require_once __DIR__ . '/lib/models.php';
require_once __DIR__ . '/lib/storage.php';
require_once __DIR__ . '/lib/http.php';
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/ratelimit.php';
require_once __DIR__ . '/lib/business.php';
require_once __DIR__ . '/lib/email.php';

// Configurar zona horaria (definida en lib/auth.php)
date_default_timezone_set(APP_TIMEZONE);
