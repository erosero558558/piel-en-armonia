<?php
declare(strict_types=1);

/**
 * Shared helpers for lightweight JSON API persistence.
 *
 * Refactored into modular libraries in /lib
 */

require_once __DIR__ . '/lib/env.php';
require_once __DIR__ . '/lib/http.php';
require_once __DIR__ . '/lib/storage.php';
require_once __DIR__ . '/lib/ratelimit.php';
require_once __DIR__ . '/lib/validation.php';
require_once __DIR__ . '/lib/auth.php';
require_once __DIR__ . '/lib/models.php';
require_once __DIR__ . '/lib/email.php';
