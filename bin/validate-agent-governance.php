<?php

declare(strict_types=1);

// Agent Governance Validation Tool

require_once __DIR__ . '/governance/Utils.php';
require_once __DIR__ . '/governance/Parsers.php';
require_once __DIR__ . '/governance/Validators/DocsValidator.php';
require_once __DIR__ . '/governance/Validators/BoardValidator.php';
require_once __DIR__ . '/governance/Validators/HandoffsValidator.php';
require_once __DIR__ . '/governance/Validators/SignalsValidator.php';
require_once __DIR__ . '/governance/Validators/PolicyValidator.php';
require_once __DIR__ . '/governance/Validators/CodexValidator.php';
require_once __DIR__ . '/governance/Validators/QueuesValidator.php';
require_once __DIR__ . '/governance/Runner.php';

use Governance\Runner;

$root = dirname(__DIR__);
$runner = new Runner($root);
$runner->run();
