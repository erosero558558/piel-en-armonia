<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
final class BirthdayReminderCronTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'birthday-cron-' . bin2hex(random_bytes(6));
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
        $store['clinical_history_sessions'] = [
            [
                'id' => 9001,
                'sessionId' => 'chs-birthday-001',
                'caseId' => 'case-birthday-001',
                'patient' => [
                    'name' => 'Ana Cumple',
                    'phone' => '0990001234',
                ],
                'createdAt' => '2026-03-20T09:00:00-05:00',
                'updatedAt' => '2026-03-29T09:00:00-05:00',
            ],
            [
                'id' => 9002,
                'sessionId' => 'chs-birthday-002',
                'caseId' => 'case-birthday-002',
                'patient' => [
                    'name' => 'Paciente Otro Dia',
                    'phone' => '0990009999',
                ],
                'createdAt' => '2026-03-20T09:00:00-05:00',
                'updatedAt' => '2026-03-29T09:00:00-05:00',
            ],
        ];
        $store['clinical_history_drafts'] = [
            [
                'id' => 9101,
                'sessionId' => 'chs-birthday-001',
                'caseId' => 'case-birthday-001',
                'admission001' => [
                    'identity' => [
                        'documentNumber' => '0912345678',
                        'primerNombre' => 'Ana',
                        'apellidoPaterno' => 'Cumple',
                    ],
                    'demographics' => [
                        'birthDate' => '1991-03-30',
                    ],
                    'residence' => [
                        'phone' => '0990001234',
                    ],
                ],
                'updatedAt' => '2026-03-29T10:00:00-05:00',
            ],
            [
                'id' => 9102,
                'sessionId' => 'chs-birthday-002',
                'caseId' => 'case-birthday-002',
                'admission001' => [
                    'identity' => [
                        'documentNumber' => '0922222222',
                        'primerNombre' => 'Otro',
                        'apellidoPaterno' => 'Dia',
                    ],
                    'demographics' => [
                        'birthDate' => '1992-04-15',
                    ],
                    'residence' => [
                        'phone' => '0990009999',
                    ],
                ],
                'updatedAt' => '2026-03-29T10:00:00-05:00',
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

    public function testReminderCronQueuesBirthdayGreetingOncePerYearWithoutMarketingCopy(): void
    {
        $result = \cron_task_reminders([
            'today' => '2026-03-30',
        ]);

        self::assertTrue((bool) ($result['ok'] ?? false));
        self::assertSame(1, (int) ($result['birthdays']['queued'] ?? 0));
        self::assertSame(1, (int) ($result['birthdays']['notBirthday'] ?? 0));

        $outbox = \whatsapp_openclaw_repository()->listPendingOutbox(10);
        self::assertCount(1, $outbox);
        self::assertStringContainsString('cumpleaños', (string) ($outbox[0]['text'] ?? ''));
        self::assertStringContainsString('Aurora Derm', (string) ($outbox[0]['text'] ?? ''));
        self::assertStringNotContainsString('descuento', strtolower((string) ($outbox[0]['text'] ?? '')));
        self::assertStringNotContainsString('promoc', strtolower((string) ($outbox[0]['text'] ?? '')));

        $store = \read_store();
        self::assertCount(1, $store['patient_birthday_messages'] ?? []);
        self::assertSame('2026', (string) ($store['patient_birthday_messages'][0]['sentYear'] ?? ''));
        self::assertSame('doc:0912345678', (string) ($store['patient_birthday_messages'][0]['patientKey'] ?? ''));

        $secondRun = \cron_task_reminders([
            'today' => '2026-03-30',
        ]);

        self::assertTrue((bool) ($secondRun['ok'] ?? false));
        self::assertSame(0, (int) ($secondRun['birthdays']['queued'] ?? 0));
        self::assertSame(1, (int) ($secondRun['birthdays']['alreadySent'] ?? 0));
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
