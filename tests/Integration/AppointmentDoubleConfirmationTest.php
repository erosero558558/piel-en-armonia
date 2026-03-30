<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
final class AppointmentDoubleConfirmationTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_JSON_BODY'], $GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_EMAIL_OUTBOX']);
        $_GET = [];
        $_SERVER['REMOTE_ADDR'] = '10.0.0.11';
        unset($_SERVER['HTTP_IDEMPOTENCY_KEY'], $_SERVER['HTTP_X_IDEMPOTENCY_KEY']);

        $this->tempDir = sys_get_temp_dir() . '/test_appointment_double_confirmation_' . bin2hex(random_bytes(6));
        if (!is_dir($this->tempDir)) {
            mkdir($this->tempDir, 0777, true);
        }

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');
        putenv('PIELARMONIA_REQUIRE_GOOGLE_CALENDAR=false');
        putenv('PIELARMONIA_WHATSAPP_OPENCLAW_ENABLED=true');
        putenv('PIELARMONIA_WHATSAPP_OPENCLAW_MODE=dry_run');
        putenv('AURORADERM_ADMIN_EMAIL=frontdesk@example.com');

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
        foreach (
            [
                'PIELARMONIA_DATA_DIR',
                'PIELARMONIA_AVAILABILITY_SOURCE',
                'PIELARMONIA_REQUIRE_GOOGLE_CALENDAR',
                'PIELARMONIA_WHATSAPP_OPENCLAW_ENABLED',
                'PIELARMONIA_WHATSAPP_OPENCLAW_MODE',
                'AURORADERM_ADMIN_EMAIL',
            ] as $key
        ) {
            putenv($key);
        }

        unset($GLOBALS['__TEST_JSON_BODY'], $GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_EMAIL_OUTBOX']);
        $_GET = [];
        unset($_SERVER['REMOTE_ADDR'], $_SERVER['HTTP_IDEMPOTENCY_KEY'], $_SERVER['HTTP_X_IDEMPOTENCY_KEY']);

        $this->removeDirectory($this->tempDir);
    }

    public function testStoreQueuesWhatsAppConfirmationWithPrepInstructions(): void
    {
        $futureDate = date('Y-m-d', strtotime('+2 day'));
        $store = \read_store();
        $store['availability'][$futureDate] = ['10:00', '10:30'];
        \write_store($store);

        $payload = $this->buildPayload($futureDate, '10:00', 'laser');
        $appointment = [];

        $GLOBALS['__TEST_JSON_BODY'] = json_encode($payload, JSON_UNESCAPED_UNICODE);
        try {
            \AppointmentController::store(['store' => \read_store()]);
            self::fail('Expected TestingExitException for appointment creation');
        } catch (\TestingExitException $e) {
            self::assertSame(201, $e->status);
            self::assertTrue((bool) ($e->payload['ok'] ?? false));
            self::assertFalse((bool) ($e->payload['emailSent'] ?? true));
            self::assertTrue((bool) ($e->payload['whatsappQueued'] ?? false));
            self::assertNotSame('', (string) ($e->payload['whatsappOutboxId'] ?? ''));
            $appointment = is_array($e->payload['data'] ?? null) ? $e->payload['data'] : [];
        }

        $emailOutbox = $GLOBALS['__TEST_EMAIL_OUTBOX'] ?? [];
        self::assertCount(2, $emailOutbox);
        self::assertSame('paciente.confirmacion@example.com', (string) ($emailOutbox[0]['to'] ?? ''));
        self::assertSame('frontdesk@example.com', (string) ($emailOutbox[1]['to'] ?? ''));

        $outbox = \whatsapp_openclaw_repository()->listPendingOutbox(10);
        self::assertCount(1, $outbox);

        $whatsappText = (string) ($outbox[0]['text'] ?? '');
        self::assertStringContainsString('Tratamiento Laser', $whatsappText);
        self::assertStringContainsString('Dr. Javier Rosero', $whatsappText);
        self::assertStringContainsString('Direccion: Valparaiso 13-183 y Sodiro, Quito, Ecuador', $whatsappText);
        self::assertStringContainsString('Evita exposicion intensa al sol', $whatsappText);
        self::assertStringContainsString('No depiles con cera o pinza', $whatsappText);

        $emailText = \build_appointment_email_text($appointment);
        self::assertStringContainsString('Direccion: Valparaiso 13-183 y Sodiro, Quito, Ecuador', $emailText);
        self::assertStringContainsString('Preparacion sugerida:', $emailText);
        self::assertStringContainsString('Llega con la piel limpia, sin maquillaje ni cremas irritantes', $emailText);

        $manualWhatsAppText = \build_appointment_whatsapp_confirmation_text($appointment);
        self::assertStringContainsString('tu cita en Aurora Derm fue confirmada', $manualWhatsAppText);
        self::assertStringContainsString('Tratamiento Laser', $manualWhatsAppText);
    }

    public function testIdempotentReplayDoesNotQueueDuplicateNotifications(): void
    {
        $futureDate = date('Y-m-d', strtotime('+3 day'));
        $store = \read_store();
        $store['availability'][$futureDate] = ['11:00'];
        \write_store($store);

        $payload = $this->buildPayload($futureDate, '11:00', 'consulta');
        $_SERVER['HTTP_IDEMPOTENCY_KEY'] = 'appt-double-confirm-001';

        $firstAppointmentId = 0;

        $GLOBALS['__TEST_JSON_BODY'] = json_encode($payload, JSON_UNESCAPED_UNICODE);
        try {
            \AppointmentController::store(['store' => \read_store()]);
            self::fail('Expected TestingExitException for first appointment');
        } catch (\TestingExitException $e) {
            self::assertSame(201, $e->status);
            self::assertFalse((bool) ($e->payload['idempotentReplay'] ?? true));
            self::assertTrue((bool) ($e->payload['whatsappQueued'] ?? false));
            $firstAppointmentId = (int) ($e->payload['data']['id'] ?? 0);
            self::assertGreaterThan(0, $firstAppointmentId);
        }

        $GLOBALS['__TEST_JSON_BODY'] = json_encode($payload, JSON_UNESCAPED_UNICODE);
        try {
            \AppointmentController::store(['store' => \read_store()]);
            self::fail('Expected TestingExitException for replay');
        } catch (\TestingExitException $e) {
            self::assertSame(200, $e->status);
            self::assertTrue((bool) ($e->payload['idempotentReplay'] ?? false));
            self::assertSame($firstAppointmentId, (int) ($e->payload['data']['id'] ?? 0));
            self::assertFalse((bool) ($e->payload['emailSent'] ?? true));
            self::assertFalse((bool) ($e->payload['whatsappQueued'] ?? true));
            self::assertSame('', (string) ($e->payload['whatsappOutboxId'] ?? ''));
        }

        $emailOutbox = $GLOBALS['__TEST_EMAIL_OUTBOX'] ?? [];
        self::assertCount(2, $emailOutbox);
        self::assertCount(1, \whatsapp_openclaw_repository()->listPendingOutbox(10));
    }

    /**
     * @return array<string,mixed>
     */
    private function buildPayload(string $date, string $time, string $service): array
    {
        return [
            'service' => $service,
            'doctor' => 'rosero',
            'date' => $date,
            'time' => $time,
            'name' => 'Paciente Confirmacion',
            'email' => 'paciente.confirmacion@example.com',
            'phone' => '+593999000111',
            'reason' => 'Necesito confirmar detalles de la cita.',
            'privacyConsent' => true,
            'paymentMethod' => 'cash',
        ];
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
