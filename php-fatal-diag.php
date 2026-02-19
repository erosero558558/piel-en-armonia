<?php
declare(strict_types=1);

header('Content-Type: text/plain; charset=utf-8');
@ini_set('display_errors', '1');
@ini_set('display_startup_errors', '1');
error_reporting(E_ALL);

register_shutdown_function(static function (): void {
    $error = error_get_last();
    if ($error === null) {
        return;
    }

    echo "\nSHUTDOWN_FATAL:\n";
    echo 'type=' . ($error['type'] ?? 'unknown') . "\n";
    echo 'message=' . ($error['message'] ?? '') . "\n";
    echo 'file=' . ($error['file'] ?? '') . "\n";
    echo 'line=' . ($error['line'] ?? '') . "\n";
});

$step = static function (string $label): void {
    echo $label . "\n";
    if (function_exists('flush')) {
        @flush();
    }
};

$step('diag-start');
$step('php=' . PHP_VERSION);
$step('try-api-lib');

require_once __DIR__ . '/api-lib.php';

$step('api-lib-ok');
$step('done');

