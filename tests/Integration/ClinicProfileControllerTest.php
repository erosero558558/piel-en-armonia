<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
final class ClinicProfileControllerTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_JSON_BODY'], $GLOBALS['__TEST_RESPONSE']);

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'clinic-profile-controller-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0777, true);

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_SKIP_ENV_FILE=true');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../lib/common.php';
        require_once __DIR__ . '/../../lib/storage.php';
        require_once __DIR__ . '/../../lib/http.php';
        require_once __DIR__ . '/../../lib/auth.php';
        require_once __DIR__ . '/../../lib/audit.php';
        require_once __DIR__ . '/../../lib/ClinicProfileStore.php';
        require_once __DIR__ . '/../../controllers/ClinicProfileController.php';

        \ensure_data_file();
    }

    protected function tearDown(): void
    {
        putenv('PIELARMONIA_DATA_DIR');
        putenv('PIELARMONIA_SKIP_ENV_FILE');

        if (\function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
        unset($GLOBALS['__TEST_JSON_BODY'], $GLOBALS['__TEST_RESPONSE']);
        $_SERVER['HTTP_X_CSRF_TOKEN'] = '';
        $_SESSION = [];
    }

    public function testFirstClinicProfileSaveStartsProTrialAutomatically(): void
    {
        \start_secure_session();
        $_SESSION['admin_logged_in'] = true;
        $_SESSION['csrf_token'] = 'csrf_trial_token';
        $_SERVER['HTTP_X_CSRF_TOKEN'] = 'csrf_trial_token';

        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'clinicProfile' => [
                'clinicName' => 'Clinica Trial Demo',
                'address' => 'Av. Trial 123',
                'phone' => '+593999000111',
                'software_plan' => 'Starter',
            ],
        ]);

        $response = $this->captureControllerExit(static function (): void {
            \ClinicProfileController::update([]);
        });

        self::assertSame(200, $response['status']);
        self::assertTrue((bool) ($response['payload']['ok'] ?? false));

        $profile = is_array($response['payload']['data'] ?? null)
            ? $response['payload']['data']
            : [];
        self::assertSame('Pro', (string) ($profile['software_plan'] ?? ''));
        self::assertSame('trialing', (string) ($profile['software_subscription']['status'] ?? ''));
        self::assertSame('pro', (string) ($profile['software_subscription']['planKey'] ?? ''));
        self::assertNotSame('', (string) ($profile['software_subscription']['startedAt'] ?? ''));
        self::assertNotSame('', (string) ($profile['software_subscription']['trialEndsAt'] ?? ''));
        self::assertSame('', (string) ($profile['software_subscription']['trialReminderSentAt'] ?? ''));

        $stored = \read_clinic_profile();
        self::assertSame('Clinica Trial Demo', (string) ($stored['clinicName'] ?? ''));
        self::assertSame('trialing', (string) ($stored['software_subscription']['status'] ?? ''));
        self::assertSame('pro', (string) ($stored['software_subscription']['planKey'] ?? ''));
    }

    private function captureControllerExit(callable $callback): array
    {
        try {
            $callback();
            self::fail('Expected TestingExitException');
        } catch (\TestingExitException $error) {
            return [
                'payload' => $error->payload,
                'status' => $error->status,
            ];
        }
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
