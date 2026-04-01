<?php

declare(strict_types=1);

require_once __DIR__ . '/api-lib.php';
require_once __DIR__ . '/payment-lib.php';
require_once __DIR__ . '/lib/monitoring.php';
require_once __DIR__ . '/lib/prediction.php';
require_once __DIR__ . '/lib/figo_utils.php';

// New Libs
require_once __DIR__ . '/lib/ApiConfig.php';
require_once __DIR__ . '/lib/api_helpers.php';
require_once __DIR__ . '/lib/ApiKernel.php';
require_once __DIR__ . '/lib/clinical_history/bootstrap.php';
require_once __DIR__ . '/lib/whatsapp_openclaw/bootstrap.php';
require_once __DIR__ . '/lib/flow_os_manifest.php';
require_once __DIR__ . '/lib/FlowOsJourney.php';

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
}, /* throw */ false, /* prepend */ false);

// Instantiate and Handle
$kernel = new ApiKernel();
$kernel->handleRequest();
