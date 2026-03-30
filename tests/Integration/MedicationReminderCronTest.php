<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
final class MedicationReminderCronTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'medication-reminder-cron-' . bin2hex(random_bytes(6));
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
        $store['appointments'] = [];
        $store['prescriptions'] = [
            'rx-001' => [
                'id' => 'rx-001',
                'caseId' => 'case-rx-001',
                'issued_at' => '2026-03-23T08:00:00-05:00',
                'patient' => [
                    'name' => 'Ana Tratamiento',
                    'phone' => '0990007777',
                ],
                'medications' => [
                    [
                        'medication' => 'Doxiciclina 100 mg',
                        'dose' => '1 tableta cada 12h',
                        'duration' => '14 dias',
                    ],
                    [
                        'medication' => 'Adapaleno 0.1%',
                        'dose' => 'aplicar nocturno',
                        'duration' => '8 semanas',
                    ],
                    [
                        'medication' => 'Protector solar',
                        'dose' => 'cada manana',
                        'duration' => 'continuo',
                    ],
                ],
            ],
            'rx-002' => [
                'id' => 'rx-002',
                'caseId' => 'case-rx-002',
                'issued_at' => '2026-03-23T08:00:00-05:00',
                'medications' => [
                    [
                        'medication' => 'Cetirizina 10 mg',
                        'dose' => '1 tableta diaria',
                        'duration' => '14 dias',
                    ],
                ],
            ],
        ];

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

    public function testReminderCronQueuesMedicationReminderAtTreatmentHalfway(): void
    {
        $result = \cron_task_reminders([
            'today' => '2026-03-30',
            'tomorrow' => '2026-03-31',
            'now' => '2026-03-30T12:00:00-05:00',
        ]);

        self::assertTrue((bool) ($result['ok'] ?? false));
        self::assertSame(1, (int) ($result['medicationReminders']['queued'] ?? 0));
        self::assertSame(1, (int) ($result['medicationReminders']['medicationsQueued'] ?? 0));
        self::assertSame(1, (int) ($result['medicationReminders']['missingPhone'] ?? 0));
        self::assertSame(1, (int) ($result['medicationReminders']['unsupportedDuration'] ?? 0));
        self::assertSame(1, (int) ($result['medicationReminders']['notDue'] ?? 0));

        $outbox = \whatsapp_openclaw_repository()->listPendingOutbox(10);
        self::assertCount(1, $outbox);
        self::assertStringContainsString('recuerde continuar con', strtolower((string) ($outbox[0]['text'] ?? '')));
        self::assertStringContainsString('Doxiciclina 100 mg', (string) ($outbox[0]['text'] ?? ''));
        self::assertStringContainsString('hasta', strtolower((string) ($outbox[0]['text'] ?? '')));

        $store = \read_store();
        self::assertArrayHasKey('rx-001', $store['prescriptions'] ?? []);
        self::assertNotSame(
            '',
            (string) ($store['prescriptions']['rx-001']['medications'][0]['halfwayReminderSentAt'] ?? '')
        );
        self::assertSame(
            'whatsapp',
            (string) ($store['prescriptions']['rx-001']['medications'][0]['halfwayReminderChannel'] ?? '')
        );
        self::assertSame(
            '',
            (string) ($store['prescriptions']['rx-001']['medications'][1]['halfwayReminderSentAt'] ?? '')
        );
        self::assertSame(
            '',
            (string) ($store['prescriptions']['rx-001']['medications'][2]['halfwayReminderSentAt'] ?? '')
        );

        $secondRun = \cron_task_reminders([
            'today' => '2026-03-30',
            'tomorrow' => '2026-03-31',
            'now' => '2026-03-30T12:00:00-05:00',
        ]);

        self::assertTrue((bool) ($secondRun['ok'] ?? false));
        self::assertSame(0, (int) ($secondRun['medicationReminders']['queued'] ?? 0));
        self::assertSame(1, (int) ($secondRun['medicationReminders']['alreadySent'] ?? 0));
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
