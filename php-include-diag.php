<?php
declare(strict_types=1);

header('Content-Type: text/plain; charset=utf-8');

function diag_step(string $label): void
{
    echo "OK: {$label}\n";
    if (function_exists('flush')) {
        @flush();
    }
}

diag_step('start');

$autoloadFile = __DIR__ . DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR . 'autoload.php';
if (is_file($autoloadFile)) {
    require_once $autoloadFile;
    diag_step('vendor/autoload.php');
}

$envFile = __DIR__ . DIRECTORY_SEPARATOR . 'env.php';
if (is_file($envFile) && is_readable($envFile)) {
    $loaded = 0;
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
            if (strpos($pair, '=') === false) {
                continue;
            }
            @putenv($pair);
            $loaded++;
        }
    }
    diag_step("env.php(parsed={$loaded})");
}

require_once __DIR__ . '/lib/common.php';
diag_step('lib/common.php');

require_once __DIR__ . '/lib/validation.php';
diag_step('lib/validation.php');

require_once __DIR__ . '/lib/http.php';
diag_step('lib/http.php');

require_once __DIR__ . '/lib/models.php';
diag_step('lib/models.php');

require_once __DIR__ . '/lib/business.php';
diag_step('lib/business.php');

require_once __DIR__ . '/lib/storage.php';
diag_step('lib/storage.php');

require_once __DIR__ . '/lib/audit.php';
diag_step('lib/audit.php');

require_once __DIR__ . '/lib/auth.php';
diag_step('lib/auth.php');

require_once __DIR__ . '/lib/email.php';
diag_step('lib/email.php');

require_once __DIR__ . '/lib/ratelimit.php';
diag_step('lib/ratelimit.php');

diag_step('done');
