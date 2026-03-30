<?php

declare(strict_types=1);

namespace Tests\Integration;

use BookingService;
use BookingWaitlistService;
use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 * @preserveGlobalState disabled
 */
final class BookingWaitlistControllerTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_JSON_BODY'], $GLOBALS['__TEST_RESPONSE']);
        $_GET = [];
        $_POST = [];
        $_FILES = [];
        $_SERVER = [
            'REMOTE_ADDR' => '127.0.0.1',
            'REQUEST_METHOD' => 'POST',
        ];

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'booking-waitlist-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0777, true);

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');
        ini_set('log_errors', '1');
        ini_set('error_log', $this->tempDir . DIRECTORY_SEPARATOR . 'php-error.log');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../controllers/BookingWaitlistController.php';
        require_once __DIR__ . '/../../controllers/AppointmentController.php';
        require_once __DIR__ . '/../../lib/BookingService.php';
        require_once __DIR__ . '/../../lib/BookingWaitlistService.php';
        require_once __DIR__ . '/../../lib/whatsapp_openclaw/bootstrap.php';

        \ensure_data_file();
    }

    protected function tearDown(): void
    {
        foreach ([
            'PIELARMONIA_DATA_DIR',
            'PIELARMONIA_AVAILABILITY_SOURCE',
        ] as $key) {
            putenv($key);
        }

        if (\function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
        unset($GLOBALS['__TEST_JSON_BODY'], $GLOBALS['__TEST_RESPONSE']);
        $_GET = [];
        $_POST = [];
        $_FILES = [];
        $_SERVER = [];
    }

    public function testStoreCreatesWaitlistEntryAndDeduplicatesActiveRequest(): void
    {
        $payload = [
            'name' => 'Paciente Waitlist',
            'email' => 'waitlist@example.com',
            'phone' => '+593999111222',
            'date' => date('Y-m-d', strtotime('+2 day')),
            'service' => 'consulta',
            'doctor' => 'rosero',
            'privacyConsent' => true,
        ];

        $first = $this->postWaitlist($payload);
        self::assertSame(201, $first['status']);
        self::assertTrue((bool) ($first['payload']['ok'] ?? false));
        self::assertTrue((bool) ($first['payload']['created'] ?? false));

        $second = $this->postWaitlist($payload);
        self::assertSame(200, $second['status']);
        self::assertTrue((bool) ($second['payload']['ok'] ?? false));
        self::assertFalse((bool) ($second['payload']['created'] ?? true));

        $store = \read_store();
        self::assertCount(1, $store['booking_waitlist'] ?? []);
        self::assertSame('pending', (string) ($store['booking_waitlist'][0]['status'] ?? ''));
    }

    public function testCancellationNotifiesFirstMatchingWaitlistEntryByWhatsapp(): void
    {
        $date = date('Y-m-d', strtotime('+3 day'));
        $store = \read_store();
        $store['availability'][$date] = ['10:00', '11:00'];
        \write_store($store);

        $bookingService = new BookingService();
        $bookingResult = $bookingService->create(\read_store(), [
            'name' => 'Paciente Agenda',
            'email' => 'agenda@example.com',
            'phone' => '+593999111223',
            'date' => $date,
            'time' => '10:00',
            'doctor' => 'rosero',
            'service' => 'consulta',
            'privacyConsent' => true,
            'paymentMethod' => 'cash',
        ]);

        self::assertTrue((bool) ($bookingResult['ok'] ?? false));
        \write_store($bookingResult['store']);
        $appointment = $bookingResult['data'];

        $waitlistService = new BookingWaitlistService();
        $waitlistResult = $waitlistService->create(\read_store(), [
            'name' => 'Paciente En Espera',
            'email' => 'espera@example.com',
            'phone' => '+593999111224',
            'date' => $date,
            'service' => 'consulta',
            'doctor' => 'rosero',
            'privacyConsent' => true,
        ]);

        self::assertTrue((bool) ($waitlistResult['ok'] ?? false));
        \write_store($waitlistResult['store']);

        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'id' => (int) ($appointment['id'] ?? 0),
            'status' => 'cancelled',
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $response = $this->captureJsonResponse(static function (): void {
            \AppointmentController::update([
                'store' => \read_store(),
            ]);
        });

        self::assertSame(200, $response['status']);
        self::assertTrue((bool) ($response['payload']['ok'] ?? false));

        $updatedStore = \read_store();
        self::assertCount(1, $updatedStore['booking_waitlist'] ?? []);
        self::assertSame('notified', (string) ($updatedStore['booking_waitlist'][0]['status'] ?? ''));
        self::assertSame('whatsapp', (string) ($updatedStore['booking_waitlist'][0]['notificationChannel'] ?? ''));
        self::assertSame('10:00', (string) ($updatedStore['booking_waitlist'][0]['offeredSlot']['time'] ?? ''));

        $outbox = \whatsapp_openclaw_repository()->listPendingOutbox(10);
        self::assertCount(1, $outbox);
        self::assertSame('593999111224', (string) ($outbox[0]['phone'] ?? ''));
        self::assertStringContainsString('Se liberó un espacio en la agenda', (string) ($outbox[0]['payload']['text'] ?? ''));
    }

    /**
     * @param array<string,mixed> $payload
     * @return array{payload:array<string,mixed>,status:int}
     */
    private function postWaitlist(array $payload): array
    {
        $GLOBALS['__TEST_JSON_BODY'] = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        return $this->captureJsonResponse(static function (): void {
            \BookingWaitlistController::store([
                'store' => \read_store(),
            ]);
        });
    }

    /**
     * @return array{payload:array<string,mixed>,status:int}
     */
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
        } finally {
            unset($GLOBALS['__TEST_JSON_BODY']);
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
