<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
class AppointmentErrorCodesTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_JSON_BODY']);
        unset($GLOBALS['__TEST_RESPONSE']);
        $_GET = [];
        unset($_SERVER['HTTP_IDEMPOTENCY_KEY'], $_SERVER['HTTP_X_IDEMPOTENCY_KEY']);
        $_SERVER['REMOTE_ADDR'] = '10.0.0.10';

        $this->tempDir = sys_get_temp_dir() . '/test_appointment_errors_' . bin2hex(random_bytes(6));
        if (!is_dir($this->tempDir)) {
            mkdir($this->tempDir, 0777, true);
        }

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');
        putenv('PIELARMONIA_REQUIRE_GOOGLE_CALENDAR=false');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../lib/common.php';
        require_once __DIR__ . '/../../lib/storage.php';
        require_once __DIR__ . '/../../lib/business.php';
        require_once __DIR__ . '/../../lib/http.php';
        require_once __DIR__ . '/../../lib/ratelimit.php';
        require_once __DIR__ . '/../../lib/validation.php';
        require_once __DIR__ . '/../../lib/models.php';
        require_once __DIR__ . '/../../lib/event_setup.php';
        require_once __DIR__ . '/../../controllers/AppointmentController.php';

        \ensure_data_file();
        \reset_rate_limit('appointments');
    }

    protected function tearDown(): void
    {
        putenv('PIELARMONIA_DATA_DIR');
        putenv('PIELARMONIA_AVAILABILITY_SOURCE');
        putenv('PIELARMONIA_REQUIRE_GOOGLE_CALENDAR');

        unset($GLOBALS['__TEST_JSON_BODY']);
        unset($GLOBALS['__TEST_RESPONSE']);
        $_GET = [];
        unset($_SERVER['HTTP_IDEMPOTENCY_KEY'], $_SERVER['HTTP_X_IDEMPOTENCY_KEY']);
        unset($_SERVER['REMOTE_ADDR']);
        $this->removeDirectory($this->tempDir);
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

    private function buildValidPayload(string $date, string $time = '10:00'): array
    {
        return [
            'service' => 'consulta',
            'doctor' => 'rosero',
            'date' => $date,
            'time' => $time,
            'name' => 'Paciente Error Test',
            'email' => 'paciente.error.test@example.com',
            'phone' => '+593999000111',
            'reason' => 'Prueba de codigos',
            'privacyConsent' => true,
            'paymentMethod' => 'cash',
        ];
    }

    public function testStoreNormalizesConflictAsSlotConflict(): void
    {
        $futureDate = date('Y-m-d', strtotime('+2 day'));
        $store = \read_store();
        $store['appointments'] = [];
        $store['callbacks'] = [];
        $store['reviews'] = [];
        $store['availability'][$futureDate] = ['10:00', '10:30'];
        \write_store($store);

        $payload = $this->buildValidPayload($futureDate, '10:00');

        $GLOBALS['__TEST_JSON_BODY'] = json_encode($payload, JSON_UNESCAPED_UNICODE);
        try {
            \AppointmentController::store(['store' => \read_store()]);
            $this->fail('Expected TestingExitException for first booking');
        } catch (\TestingExitException $e) {
            $this->assertSame(201, $e->status);
            $this->assertTrue((bool) ($e->payload['ok'] ?? false));
        }

        $GLOBALS['__TEST_JSON_BODY'] = json_encode($payload, JSON_UNESCAPED_UNICODE);
        try {
            \AppointmentController::store(['store' => \read_store()]);
            $this->fail('Expected TestingExitException for slot conflict');
        } catch (\TestingExitException $e) {
            $this->assertSame(409, $e->status);
            $this->assertFalse((bool) ($e->payload['ok'] ?? true));
            $this->assertSame('slot_conflict', (string) ($e->payload['code'] ?? ''));
        }
    }

    public function testStoreKeepsCalendarUnreachableCodeWhenGoogleIsRequired(): void
    {
        putenv('PIELARMONIA_REQUIRE_GOOGLE_CALENDAR=true');

        $futureDate = date('Y-m-d', strtotime('+3 day'));
        $store = \read_store();
        $store['appointments'] = [];
        $store['callbacks'] = [];
        $store['reviews'] = [];
        $store['availability'][$futureDate] = ['11:00'];
        \write_store($store);

        $payload = $this->buildValidPayload($futureDate, '11:00');
        $GLOBALS['__TEST_JSON_BODY'] = json_encode($payload, JSON_UNESCAPED_UNICODE);

        try {
            \AppointmentController::store(['store' => \read_store()]);
            $this->fail('Expected TestingExitException for calendar requirement failure');
        } catch (\TestingExitException $e) {
            $this->assertSame(503, $e->status);
            $this->assertFalse((bool) ($e->payload['ok'] ?? true));
            $this->assertSame('calendar_unreachable', (string) ($e->payload['code'] ?? ''));
        }
    }

    public function testBookedSlotsRejectsMissingDateWithCalendarBadRequest(): void
    {
        $_GET = [
            'doctor' => 'rosero',
            'service' => 'consulta',
        ];

        try {
            \AppointmentController::bookedSlots(['store' => \read_store()]);
            $this->fail('Expected TestingExitException for missing date');
        } catch (\TestingExitException $e) {
            $this->assertSame(400, $e->status);
            $this->assertFalse((bool) ($e->payload['ok'] ?? true));
            $this->assertSame('calendar_bad_request', (string) ($e->payload['code'] ?? ''));
        }
    }

    public function testBookedSlotsKeepsCalendarUnreachableWhenGoogleIsRequired(): void
    {
        putenv('PIELARMONIA_REQUIRE_GOOGLE_CALENDAR=true');
        $futureDate = date('Y-m-d', strtotime('+4 day'));

        $_GET = [
            'date' => $futureDate,
            'doctor' => 'rosero',
            'service' => 'consulta',
        ];

        try {
            \AppointmentController::bookedSlots(['store' => \read_store()]);
            $this->fail('Expected TestingExitException for booked-slots calendar requirement failure');
        } catch (\TestingExitException $e) {
            $this->assertSame(503, $e->status);
            $this->assertFalse((bool) ($e->payload['ok'] ?? true));
            $this->assertSame('calendar_unreachable', (string) ($e->payload['code'] ?? ''));
        }
    }

    public function testStoreReplaysExistingAppointmentForSameIdempotencyKey(): void
    {
        $futureDate = date('Y-m-d', strtotime('+5 day'));
        $store = \read_store();
        $store['appointments'] = [];
        $store['callbacks'] = [];
        $store['reviews'] = [];
        $store['availability'][$futureDate] = ['09:00', '09:30'];
        \write_store($store);

        $payload = $this->buildValidPayload($futureDate, '09:00');
        $_SERVER['HTTP_IDEMPOTENCY_KEY'] = 'appt-key-replay-001';

        $firstId = 0;
        $GLOBALS['__TEST_JSON_BODY'] = json_encode($payload, JSON_UNESCAPED_UNICODE);
        try {
            \AppointmentController::store(['store' => \read_store()]);
            $this->fail('Expected TestingExitException for first booking');
        } catch (\TestingExitException $e) {
            $this->assertSame(201, $e->status);
            $this->assertTrue((bool) ($e->payload['ok'] ?? false));
            $this->assertFalse((bool) ($e->payload['idempotentReplay'] ?? true));
            $firstId = (int) ($e->payload['data']['id'] ?? 0);
            $this->assertGreaterThan(0, $firstId);
        }

        $GLOBALS['__TEST_JSON_BODY'] = json_encode($payload, JSON_UNESCAPED_UNICODE);
        try {
            \AppointmentController::store(['store' => \read_store()]);
            $this->fail('Expected TestingExitException for idempotent replay');
        } catch (\TestingExitException $e) {
            $this->assertSame(200, $e->status);
            $this->assertTrue((bool) ($e->payload['ok'] ?? false));
            $this->assertTrue((bool) ($e->payload['idempotentReplay'] ?? false));
            $this->assertSame($firstId, (int) ($e->payload['data']['id'] ?? 0));
        }

        $after = \read_store();
        $this->assertCount(1, $after['appointments']);
        $this->assertSame('appt-key-replay-001', (string) ($after['appointments'][0]['idempotencyKey'] ?? ''));
    }

    public function testStoreRejectsIdempotencyKeyReuseWithDifferentFingerprint(): void
    {
        $futureDate = date('Y-m-d', strtotime('+6 day'));
        $store = \read_store();
        $store['appointments'] = [];
        $store['callbacks'] = [];
        $store['reviews'] = [];
        $store['availability'][$futureDate] = ['12:00', '12:30'];
        \write_store($store);

        $_SERVER['HTTP_IDEMPOTENCY_KEY'] = 'appt-key-conflict-001';
        $payload = $this->buildValidPayload($futureDate, '12:00');
        $GLOBALS['__TEST_JSON_BODY'] = json_encode($payload, JSON_UNESCAPED_UNICODE);
        try {
            \AppointmentController::store(['store' => \read_store()]);
            $this->fail('Expected TestingExitException for first booking');
        } catch (\TestingExitException $e) {
            $this->assertSame(201, $e->status);
            $this->assertTrue((bool) ($e->payload['ok'] ?? false));
        }

        $changed = $payload;
        $changed['time'] = '12:30';
        $GLOBALS['__TEST_JSON_BODY'] = json_encode($changed, JSON_UNESCAPED_UNICODE);
        try {
            \AppointmentController::store(['store' => \read_store()]);
            $this->fail('Expected TestingExitException for idempotency conflict');
        } catch (\TestingExitException $e) {
            $this->assertSame(409, $e->status);
            $this->assertFalse((bool) ($e->payload['ok'] ?? true));
            $this->assertSame('idempotency_conflict', (string) ($e->payload['code'] ?? ''));
        }

        $after = \read_store();
        $this->assertCount(1, $after['appointments']);
    }
}
