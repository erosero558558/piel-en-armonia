<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
final class AppointmentUpdateClinicalGateTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_JSON_BODY'], $GLOBALS['__TEST_RESPONSE']);
        $_GET = [];
        $_SERVER['REMOTE_ADDR'] = '10.0.0.20';

        $this->tempDir = sys_get_temp_dir() . '/test_appointment_update_' . bin2hex(random_bytes(6));
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
    }

    protected function tearDown(): void
    {
        foreach ([
            'PIELARMONIA_DATA_DIR',
            'PIELARMONIA_AVAILABILITY_SOURCE',
            'PIELARMONIA_REQUIRE_GOOGLE_CALENDAR',
            'PIELARMONIA_REQUIRE_DATA_ENCRYPTION',
            'PIELARMONIA_FORCE_SQLITE_UNAVAILABLE',
            'PIELARMONIA_DATA_ENCRYPTION_KEY',
        ] as $key) {
            putenv($key);
        }

        if (\function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        unset($GLOBALS['__TEST_JSON_BODY'], $GLOBALS['__TEST_RESPONSE']);
        $_GET = [];
        unset($_SERVER['REMOTE_ADDR']);
        $this->removeDirectory($this->tempDir);
    }

    public function testUpdateHydratesPatientCaseWhenClinicalStorageIsReady(): void
    {
        $appointmentId = $this->seedAppointment();
        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'id' => $appointmentId,
            'paymentStatus' => 'pending_transfer_review',
        ], JSON_UNESCAPED_UNICODE);

        try {
            \AppointmentController::update(['store' => \read_store()]);
            self::fail('Se esperaba TestingExitException');
        } catch (\TestingExitException $e) {
            self::assertSame(200, $e->status);
            self::assertTrue((bool) ($e->payload['ok'] ?? false));
        }

        $store = \read_store();
        self::assertSame('pending_transfer_review', (string) ($store['appointments'][0]['paymentStatus'] ?? ''));
        self::assertNotSame('', (string) ($store['appointments'][0]['patientCaseId'] ?? ''));
        self::assertCount(1, $store['patient_cases'] ?? []);
    }

    public function testUpdateSkipsPatientCaseHydrationWhenClinicalStorageIsNotReady(): void
    {
        $this->enableClinicalStorageGate();

        $appointmentId = $this->seedAppointment();
        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'id' => $appointmentId,
            'paymentStatus' => 'pending_transfer_review',
        ], JSON_UNESCAPED_UNICODE);

        try {
            \AppointmentController::update(['store' => \read_store()]);
            self::fail('Se esperaba TestingExitException');
        } catch (\TestingExitException $e) {
            self::assertSame(200, $e->status);
            self::assertTrue((bool) ($e->payload['ok'] ?? false));
        }

        $store = \read_store();
        self::assertSame('pending_transfer_review', (string) ($store['appointments'][0]['paymentStatus'] ?? ''));
        self::assertSame('', (string) ($store['appointments'][0]['patientCaseId'] ?? ''));
        self::assertCount(0, $store['patient_cases'] ?? []);
        self::assertCount(0, $store['patient_case_links'] ?? []);
        self::assertCount(0, $store['patient_case_timeline_events'] ?? []);
    }

    private function seedAppointment(): int
    {
        $futureDate = date('Y-m-d', strtotime('+2 day'));
        $store = \read_store();
        $store['appointments'] = [[
            'id' => 101,
            'date' => $futureDate,
            'time' => '10:00',
            'doctor' => 'rosero',
            'service' => 'consulta',
            'status' => 'confirmed',
            'name' => 'Paciente Update',
            'email' => 'update@example.com',
            'phone' => '0991234567',
            'paymentMethod' => 'transfer',
            'paymentStatus' => 'pending',
            'privacyConsent' => true,
        ]];
        \write_store($store, false);

        return 101;
    }

    private function enableClinicalStorageGate(): void
    {
        putenv('PIELARMONIA_REQUIRE_DATA_ENCRYPTION=1');
        putenv('PIELARMONIA_FORCE_SQLITE_UNAVAILABLE=1');
        putenv('PIELARMONIA_DATA_ENCRYPTION_KEY');

        if (\function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }
    }

    private function removeDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }

        $files = array_diff(scandir($dir) ?: [], ['.', '..']);
        foreach ($files as $file) {
            $path = $dir . DIRECTORY_SEPARATOR . $file;
            if (is_dir($path)) {
                $this->removeDirectory($path);
            } else {
                @unlink($path);
            }
        }

        @rmdir($dir);
    }
}
