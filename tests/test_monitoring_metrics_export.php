<?php

declare(strict_types=1);

define('TESTING_ENV', true);

$tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'aurora-monitoring-test-' . bin2hex(random_bytes(6));
mkdir($tempDir, 0777, true);

putenv('PIELARMONIA_DATA_DIR=' . $tempDir);
ini_set('log_errors', '1');
ini_set('error_log', $tempDir . DIRECTORY_SEPARATOR . 'php-error.log');

require_once __DIR__ . '/../api-lib.php';
require_once __DIR__ . '/../controllers/SystemController.php';

ensure_data_file();

$store = read_store();
$store['appointments'] = [];
$store['queue_tickets'] = [
    ['id' => 1, 'ticketCode' => 'A-001', 'status' => 'waiting'],
    ['id' => 2, 'ticketCode' => 'A-002', 'status' => 'called'],
    ['id' => 3, 'ticketCode' => 'A-003', 'status' => 'completed'],
];
$store['queue_help_requests'] = [
    ['id' => 10, 'status' => 'pending'],
    ['id' => 11, 'status' => 'attending'],
    ['id' => 12, 'status' => 'resolved'],
];
write_store($store, false);

ob_start();
SystemController::metrics([
    'store' => read_store(),
    'diagnosticsAuthorized' => true,
]);
$output = (string) ob_get_clean();

foreach ([
    'auroraderm_queue_size 2',
    'auroraderm_queue_waiting_total 1',
    'auroraderm_queue_called_total 1',
    'auroraderm_queue_help_requests_pending_total 2',
    'auroraderm_queue_tickets_total{status="waiting"} 1',
    'pielarmonia_queue_size 2',
] as $needle) {
    if (strpos($output, $needle) === false) {
        fwrite(STDERR, "missing metric: {$needle}\n");
        exit(1);
    }
}

echo "monitoring metrics export harness OK\n";
