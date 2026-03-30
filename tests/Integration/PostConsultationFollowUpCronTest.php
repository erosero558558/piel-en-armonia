<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
final class PostConsultationFollowUpCronTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'post-consult-follow-up-cron-' . bin2hex(random_bytes(6));
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
                'id' => 5111,
                'status' => 'completed',
                'name' => 'Ana Seguimiento',
                'phone' => '0990003210',
                'date' => '2026-03-28',
                'time' => '09:00',
                'doctor' => 'rosero',
                'service' => 'consulta',
                'followUpSentAt' => '',
            ],
            [
                'id' => 5112,
                'status' => 'completed',
                'name' => 'Paciente Reciente',
                'phone' => '0990006543',
                'date' => '2026-03-29',
                'time' => '15:00',
                'doctor' => 'narvaez',
                'service' => 'consulta',
                'followUpSentAt' => '',
            ],
            [
                'id' => 5113,
                'status' => 'confirmed',
                'name' => 'Paciente Pendiente',
                'phone' => '0990009999',
                'date' => '2026-03-28',
                'time' => '08:00',
                'doctor' => 'rosero',
                'service' => 'consulta',
                'followUpSentAt' => '',
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

    public function testReminderCronQueuesPostConsultationFollowUpAfterFortyEightHours(): void
    {
        $result = \cron_task_reminders([
            'today' => '2026-03-30',
            'tomorrow' => '2026-03-31',
            'now' => '2026-03-30T12:00:00-05:00',
        ]);

        self::assertTrue((bool) ($result['ok'] ?? false));
        self::assertSame(1, (int) ($result['postConsultationFollowUps']['queued'] ?? 0));
        self::assertSame(1, (int) ($result['postConsultationFollowUps']['notDue'] ?? 0));
        self::assertSame(1, (int) ($result['postConsultationFollowUps']['notCompleted'] ?? 0));

        $outbox = \whatsapp_openclaw_repository()->listPendingOutbox(10);
        self::assertCount(1, $outbox);
        self::assertStringContainsString('como se ha sentido despues de su consulta', strtolower((string) ($outbox[0]['text'] ?? '')));
        self::assertStringContainsString('/es/portal/', (string) ($outbox[0]['text'] ?? ''));
        self::assertStringContainsString('escribanos por este medio', strtolower((string) ($outbox[0]['text'] ?? '')));

        $store = \read_store();
        self::assertNotSame('', (string) ($store['appointments'][0]['followUpSentAt'] ?? ''));
        self::assertSame('whatsapp', (string) ($store['appointments'][0]['followUpChannel'] ?? ''));
        self::assertSame('', (string) ($store['appointments'][1]['followUpSentAt'] ?? ''));
        self::assertSame('', (string) ($store['appointments'][2]['followUpSentAt'] ?? ''));

        $secondRun = \cron_task_reminders([
            'today' => '2026-03-30',
            'tomorrow' => '2026-03-31',
            'now' => '2026-03-30T12:00:00-05:00',
        ]);

        self::assertTrue((bool) ($secondRun['ok'] ?? false));
        self::assertSame(0, (int) ($secondRun['postConsultationFollowUps']['queued'] ?? 0));
        self::assertSame(1, (int) ($secondRun['postConsultationFollowUps']['alreadySent'] ?? 0));
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
