<?php

declare(strict_types=1);

/**
 * Compatibility bootstrap restored after backend-only cleanup.
 *
 * This file intentionally loads the minimum shared runtime needed by the
 * root entrypoints and legacy tests without hard-requiring subsystems that
 * were partially pruned or are currently under refactor.
 */

$autoloadFile = __DIR__ . DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR . 'autoload.php';
if (is_file($autoloadFile)) {
    try {
        require_once $autoloadFile;
    } catch (Throwable $autoloadError) {
        error_log('Aurora Derm: composer autoload skipped - ' . $autoloadError->getMessage());
    }
}

$skipEnvFileRaw = getenv('AURORADERM_SKIP_ENV_FILE');
if (!is_string($skipEnvFileRaw) || trim($skipEnvFileRaw) === '') {
    $skipEnvFileRaw = getenv('PIELARMONIA_SKIP_ENV_FILE');
}
$skipEnvFile = is_string($skipEnvFileRaw)
    && in_array(strtolower(trim($skipEnvFileRaw)), ['1', 'true', 'yes', 'on'], true);

$envFile = __DIR__ . DIRECTORY_SEPARATOR . 'env.php';
if (!$skipEnvFile && is_file($envFile)) {
    try {
        require_once $envFile;
    } catch (Throwable $envError) {
        error_log('Aurora Derm: env.php skipped - ' . $envError->getMessage());
    }
}

require_once __DIR__ . '/lib/common.php';
require_once __DIR__ . '/lib/captcha.php';
require_once __DIR__ . '/lib/logger.php';
require_once __DIR__ . '/lib/metrics.php';
require_once __DIR__ . '/lib/features.php';
require_once __DIR__ . '/lib/validation.php';
require_once __DIR__ . '/lib/http.php';
require_once __DIR__ . '/lib/security.php';
require_once __DIR__ . '/lib/models.php';
require_once __DIR__ . '/lib/business.php';
require_once __DIR__ . '/lib/storage.php';
require_once __DIR__ . '/lib/calendar/runtime.php';
require_once __DIR__ . '/lib/backup.php';
require_once __DIR__ . '/lib/audit.php';
require_once __DIR__ . '/lib/figo_utils.php';
require_once __DIR__ . '/lib/figo_queue.php';
require_once __DIR__ . '/lib/ratelimit.php';
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/email.php';

if (!function_exists('get_event_dispatcher')) {
    function get_event_dispatcher()
    {
        static $nullDispatcher = null;
        if (!is_object($nullDispatcher)) {
            $nullDispatcher = new class () {
                public function addListener(string $eventName, callable $listener): void
                {
                }

                public function dispatch($event)
                {
                    return $event;
                }
            };
        }

        return $nullDispatcher;
    }
}
