<?php

declare(strict_types=1);

function api_bootstrap_require(string $path, bool $optional = false): void
{
    if (!$optional) {
        require_once $path;
        return;
    }

    if (!is_file($path)) {
        error_log('Aurora Derm API bootstrap skipped missing optional module: ' . $path);
        return;
    }

    try {
        @require_once $path;
    } catch (Throwable $bootstrapError) {
        error_log('Aurora Derm API bootstrap skipped optional module ' . $path . ' - ' . $bootstrapError->getMessage());
    }
}

require_once __DIR__ . '/api-lib.php';
require_once __DIR__ . '/payment-lib.php';
require_once __DIR__ . '/lib/monitoring.php';
require_once __DIR__ . '/lib/prediction.php';
require_once __DIR__ . '/lib/figo_utils.php';

// New Libs
require_once __DIR__ . '/lib/ApiConfig.php';
require_once __DIR__ . '/lib/api_helpers.php';
require_once __DIR__ . '/lib/ApiKernel.php';
api_bootstrap_require(__DIR__ . '/lib/clinical_history/bootstrap.php', true);
api_bootstrap_require(__DIR__ . '/lib/whatsapp_openclaw/bootstrap.php', true);
api_bootstrap_require(__DIR__ . '/lib/flow_os_manifest.php', true);
api_bootstrap_require(__DIR__ . '/lib/FlowOsJourney.php', true);

// Router
require_once __DIR__ . '/lib/Router.php';

// S37-09: Controller autoloader — eliminates manual require_once per controller.
// Convention: ClassName → /controllers/ClassName.php
// Any new controller added to routes.php is automatically loadable without touching api.php.
spl_autoload_register(function (string $className) {
    $controllerFile = __DIR__ . '/controllers/' . $className . '.php';
    if (file_exists($controllerFile)) {
        require_once $controllerFile;
        return;
    }
    // Fallback: some controllers may live in a subdirectory (e.g. queue sub-controllers)
    $subdirFile = __DIR__ . '/controllers/' . $className . '/' . $className . '.php';
    if (file_exists($subdirFile)) {
        require_once $subdirFile;
    }
});

// Instantiate and Handle
$kernel = new ApiKernel();
$kernel->handleRequest();
