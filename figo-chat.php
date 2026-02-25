<?php

declare(strict_types=1);

require_once __DIR__ . '/api-lib.php';
require_once __DIR__ . '/figo-brain.php';
require_once __DIR__ . '/lib/FigoChatHandler.php';

apply_security_headers(false);

/**
 * Figo chat endpoint.
 * Frontend -> /figo-chat.php -> configured Figo backend.
 */

(new FigoChatHandler())->handle();
