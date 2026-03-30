<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
final class AppointmentReminderCronTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'appointment-reminder-cron-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0777, true);

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_SKIP_ENV_FILE=true');
        putenv('PIELARMONIA_WHATSAPP_OPENCLAW_ENABLED=true');
        putenv('PIELARMONIA_WHATSAPP_OPENCLAW_MODE=live');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }
        if (!defined('AURORADERM_CRON_BOOTSTRAP_ONLY')) {
            define('AURORADERM_CRON_BOOTSTRAP_ONLY', true);
        }

        require_once __DIR__ . '/../../cron.php';

        $store = \read_store();
        $store['appointments'] = [
            [
                'id' => 5101,
                'status' => 'confirmed',
                'name' => 'Ana Agenda',
                'email' => 'ana@example.test',
                'phone' => '0990001234',
                'date' => '2026-03-31',
                'time' => '10:00',
                'doctor' => 'rosero',
                'service' => 'consulta',
                'reminderSentAt' => '',
            ],
            [
                'id' => 5102,
                'status' => 'confirmed',
                'name' => 'Paciente Lejano',
                'phone' => '0990005678',
                'date' => '2026-04-02',
                'time' => '11:00',
                'doctor' => 'narvaez',
                'service' => 'consulta',
                'reminderSentAt' => '',
            ],
        ];
        $store['clinical_history_sessions'] = [];
        $store['clinical_history_drafts'] = [];

        \write_store($store, false);
    }

    protected function tearDown(): void
    {
        foreach ([
            'PIELARMONIA_DATA_DIR',
            'PIELARMONIA_SKIP_ENV_FILE',
            'PIELARMONIA_WHATSAPP_OPENCLAW_ENABLED',
            'PIELARMONIA_WHATSAPP_OPENCLAW_MODE',
        ] as $key) {
            putenv($key);
        }

        if (\function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
    }

    public function testReminderCronQueuesWhatsappReminderTwentyFourHoursBeforeAppointment(): void
    {
        $result = \cron_task_reminders([
            'today' => '2026-03-30',
            'tomorrow' => '2026-03-31',
        ]);

        self::assertTrue((bool) ($result['ok'] ?? false));
        self::assertSame(1, (int) ($result['sent'] ?? 0));
        self::assertSame(1, (int) ($result['appointmentReminders']['queued'] ?? 0));
        self::assertSame(1, (int) ($result['appointmentReminders']['tokensCreated'] ?? 0));
        self::assertSame(1, (int) ($result['appointmentReminders']['notTomorrow'] ?? 0));
        self::assertSame(0, (int) ($result['appointmentReminders']['emailFallbackSent'] ?? 0));

        $outbox = \whatsapp_openclaw_repository()->listPendingOutbox(10);
        self::assertCount(1, $outbox);
        self::assertStringContainsString('manana tiene consulta', (string) ($outbox[0]['text'] ?? ''));
        self::assertStringContainsString('Dr. Javier Rosero', (string) ($outbox[0]['text'] ?? ''));
        self::assertStringContainsString('responder a este mensaje', (string) ($outbox[0]['text'] ?? ''));
        self::assertStringContainsString('?reschedule=', (string) ($outbox[0]['text'] ?? ''));

        $store = \read_store();
        self::assertNotSame('', (string) ($store['appointments'][0]['reminderSentAt'] ?? ''));
        self::assertSame('whatsapp', (string) ($store['appointments'][0]['reminderChannel'] ?? ''));
        self::assertNotSame('', (string) ($store['appointments'][0]['rescheduleToken'] ?? ''));
        self::assertSame('', (string) ($store['appointments'][1]['reminderSentAt'] ?? ''));

        $secondRun = \cron_task_reminders([
            'today' => '2026-03-30',
            'tomorrow' => '2026-03-31',
        ]);

        self::assertTrue((bool) ($secondRun['ok'] ?? false));
        self::assertSame(0, (int) ($secondRun['appointmentReminders']['queued'] ?? 0));
        self::assertSame(1, (int) ($secondRun['appointmentReminders']['alreadySent'] ?? 0));
        self::assertCount(1, \whatsapp_openclaw_repository()->listPendingOutbox(10));
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
