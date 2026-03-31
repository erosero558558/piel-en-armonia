<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
final class AuroraMonitoringMetricsExportTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'aurora-monitoring-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0777, true);

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        ini_set('log_errors', '1');
        ini_set('error_log', $this->tempDir . DIRECTORY_SEPARATOR . 'php-error.log');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../controllers/SystemController.php';

        \ensure_data_file();
    }

    protected function tearDown(): void
    {
        putenv('PIELARMONIA_DATA_DIR');

        if (function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
    }

    public function testMetricsExportIncludesQueueBacklogGauges(): void
    {
        $store = \read_store();
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
        \write_store($store, false);

        ob_start();
        \SystemController::metrics([
            'store' => \read_store(),
            'diagnosticsAuthorized' => true,
        ]);
        $output = (string) ob_get_clean();

        $this->assertStringContainsString('auroraderm_queue_size 2', $output);
        $this->assertStringContainsString('auroraderm_queue_waiting_total 1', $output);
        $this->assertStringContainsString('auroraderm_queue_called_total 1', $output);
        $this->assertStringContainsString('auroraderm_queue_help_requests_pending_total 2', $output);
        $this->assertStringContainsString('auroraderm_queue_tickets_total{status="waiting"} 1', $output);
        $this->assertStringContainsString('auroraderm_queue_tickets_total{status="called"} 1', $output);
        $this->assertStringContainsString('pielarmonia_queue_size 2', $output);
    }

    private function removeDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }

        $entries = array_diff(scandir($dir) ?: [], ['.', '..']);
        foreach ($entries as $entry) {
            $path = $dir . DIRECTORY_SEPARATOR . $entry;
            if (is_dir($path)) {
                $this->removeDirectory($path);
            } else {
                @unlink($path);
            }
        }

        @rmdir($dir);
    }
}
