<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
final class SoftwareSubscriptionTrialCronTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'software-subscription-trial-cron-' . bin2hex(random_bytes(6));
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
        require_once __DIR__ . '/../../lib/ClinicProfileStore.php';
        require_once __DIR__ . '/../../lib/SoftwareSubscriptionService.php';

        \write_store([
            'appointments' => [],
            'clinical_history_sessions' => [],
            'clinical_history_drafts' => [],
        ], false);
    }

    protected function tearDown(): void
    {
        foreach (
            [
                'PIELARMONIA_DATA_DIR',
                'PIELARMONIA_SKIP_ENV_FILE',
                'PIELARMONIA_WHATSAPP_OPENCLAW_ENABLED',
                'PIELARMONIA_WHATSAPP_OPENCLAW_MODE',
            ] as $key
        ) {
            putenv($key);
        }

        if (\function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
    }

    public function testReminderCronQueuesDayTwelveTrialRenewalWhatsapp(): void
    {
        \write_clinic_profile(
            \SoftwareSubscriptionService::startTrial([
                'clinicName' => 'Clinica Pro Trial',
                'phone' => '+593999111222',
            ], 'pro', 14, '2026-03-01T09:00:00-05:00')
        );

        $result = \cron_task_reminders([
            'today' => '2026-03-13',
            'tomorrow' => '2026-03-14',
            'now' => '2026-03-13T12:00:00-05:00',
        ]);

        self::assertTrue((bool) ($result['ok'] ?? false));
        self::assertSame(1, (int) ($result['softwareSubscriptionTrial']['queued'] ?? 0));
        self::assertSame(0, (int) ($result['softwareSubscriptionTrial']['downgraded'] ?? 0));

        $outbox = \whatsapp_openclaw_repository()->listPendingOutbox(10);
        self::assertCount(1, $outbox);
        self::assertStringContainsString('trial', strtolower((string) ($outbox[0]['text'] ?? '')));
        self::assertStringContainsString('free', strtolower((string) ($outbox[0]['text'] ?? '')));

        $profile = \read_clinic_profile();
        self::assertNotSame('', (string) ($profile['software_subscription']['trialReminderSentAt'] ?? ''));
        self::assertSame('whatsapp', (string) ($profile['software_subscription']['trialReminderChannel'] ?? ''));
        self::assertNotSame('', (string) ($profile['software_subscription']['trialReminderOutboxId'] ?? ''));
        self::assertSame('trialing', (string) ($profile['software_subscription']['status'] ?? ''));
    }

    public function testReminderCronDowngradesExpiredTrialToFree(): void
    {
        \write_clinic_profile(
            \SoftwareSubscriptionService::startTrial([
                'clinicName' => 'Clinica Expirada',
                'phone' => '+593999111222',
            ], 'pro', 14, '2026-03-01T09:00:00-05:00')
        );

        $result = \cron_task_reminders([
            'today' => '2026-03-16',
            'tomorrow' => '2026-03-17',
            'now' => '2026-03-16T08:00:00-05:00',
        ]);

        self::assertTrue((bool) ($result['ok'] ?? false));
        self::assertSame(0, (int) ($result['softwareSubscriptionTrial']['queued'] ?? 0));
        self::assertSame(1, (int) ($result['softwareSubscriptionTrial']['downgraded'] ?? 0));

        $profile = \read_clinic_profile();
        self::assertSame('Free', (string) ($profile['software_plan'] ?? ''));
        self::assertSame('free', (string) ($profile['software_subscription']['status'] ?? ''));
        self::assertSame('free', (string) ($profile['software_subscription']['planKey'] ?? ''));
        self::assertSame('', (string) ($profile['software_subscription']['trialEndsAt'] ?? ''));
        self::assertNotSame('', (string) ($profile['software_subscription']['downgradedAt'] ?? ''));
    }

    private function removeDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }

        foreach (array_diff(scandir($dir) ?: [], ['.', '..']) as $entry) {
            $path = $dir . DIRECTORY_SEPARATOR . $entry;
            if (is_dir($path)) {
                $this->removeDirectory($path);
                continue;
            }
            @unlink($path);
        }

        @rmdir($dir);
    }
}
