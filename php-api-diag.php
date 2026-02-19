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

echo "api-diag-start\n";
$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET['resource'] = 'health';

require __DIR__ . '/api.php';

echo "api-diag-done\n";
