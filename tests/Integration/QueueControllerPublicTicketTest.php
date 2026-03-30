<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 * @preserveGlobalState disabled
 */
final class QueueControllerPublicTicketTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_POST = [];
        $_FILES = [];
        $_SERVER = [
            'REQUEST_METHOD' => 'GET',
            'REMOTE_ADDR' => '127.0.0.1',
            'HTTP_HOST' => '127.0.0.1:8011',
        ];

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'queue-public-ticket-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0777, true);

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('AURORADERM_SKIP_ENV_FILE=1');
        putenv('PIELARMONIA_SKIP_ENV_FILE=1');
        ini_set('log_errors', '1');
        ini_set('error_log', $this->tempDir . DIRECTORY_SEPARATOR . 'php-error.log');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../lib/QueueService.php';
        require_once __DIR__ . '/../../controllers/QueueController.php';

        if (\function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        \ensure_data_file();
    }

    protected function tearDown(): void
    {
        foreach ([
            'PIELARMONIA_DATA_DIR',
            'AURORADERM_SKIP_ENV_FILE',
            'PIELARMONIA_SKIP_ENV_FILE',
        ] as $key) {
            putenv($key);
        }

        if (\function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_POST = [];
        $_FILES = [];
        $_SERVER = [];
    }

    public function testPublicTicketReturnsExactQueuePosition(): void
    {
        $service = new \QueueService();
        $first = $service->createWalkInTicket(\read_store(), ['patientInitials' => 'AA'], 'kiosk');
        self::assertTrue((bool) ($first['ok'] ?? false));
        $second = $service->createWalkInTicket($first['store'] ?? [], ['patientInitials' => 'BB'], 'kiosk');
        self::assertTrue((bool) ($second['ok'] ?? false));
        \write_store($second['store'] ?? []);

        $_GET = ['ticket' => 'A-002'];

        $response = $this->captureJsonResponse(static function (): void {
            \QueueController::publicTicket(['store' => \read_store()]);
        });

        self::assertSame(200, $response['status']);
        self::assertTrue((bool) ($response['payload']['ok'] ?? false));
        self::assertSame(2, (int) ($response['payload']['data']['position'] ?? 0));
        self::assertSame(1, (int) ($response['payload']['data']['aheadCount'] ?? -1));
        self::assertSame('A-002', (string) ($response['payload']['data']['ticket']['ticketCode'] ?? ''));
    }

    public function testPublicTicketReturnsNotFoundWhenTicketIsMissing(): void
    {
        $_GET = ['ticket' => 'A-999'];

        $response = $this->captureJsonResponse(static function (): void {
            \QueueController::publicTicket(['store' => \read_store()]);
        });

        self::assertSame(404, $response['status']);
        self::assertFalse((bool) ($response['payload']['ok'] ?? true));
        self::assertSame('queue_ticket_not_found', (string) ($response['payload']['code'] ?? ''));
    }

    private function captureJsonResponse(callable $callable): array
    {
        try {
            $callable();
            self::fail('Expected TestingExitException');
        } catch (\TestingExitException $exception) {
            return [
                'payload' => $exception->payload,
                'status' => $exception->status,
            ];
        }
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
