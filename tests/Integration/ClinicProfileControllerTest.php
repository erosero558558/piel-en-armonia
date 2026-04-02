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
    private string $catalogPath;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_JSON_BODY'], $GLOBALS['__TEST_RESPONSE']);

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'clinic-profile-controller-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0777, true);
        $this->catalogPath = $this->tempDir . DIRECTORY_SEPARATOR . 'services.json';

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_SKIP_ENV_FILE=true');
        putenv('PIELARMONIA_SERVICES_CATALOG_FILE=' . $this->catalogPath);

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
        putenv('PIELARMONIA_SERVICES_CATALOG_FILE');

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

    public function testShowReturnsPublicPortalSnapshotWithoutAdminAuth(): void
    {
        file_put_contents($this->catalogPath, json_encode([
            'version' => '2026.04-clinic-profile',
            'timezone' => 'America/Guayaquil',
            'services' => [
                [
                    'slug' => 'diagnostico-integral',
                    'catalog_scope' => 'public_route',
                    'name' => 'Diagnóstico integral',
                    'summary' => 'Consulta clínica completa',
                    'category' => 'clinical',
                    'duration' => '30 min',
                    'price_from' => 40,
                    'doctor_profile' => ['rosero'],
                ],
                [
                    'slug' => 'acne-rosacea',
                    'catalog_scope' => 'public_route',
                    'name' => 'Control de acné y rosácea',
                    'summary' => 'Seguimiento médico',
                    'category' => 'clinical',
                    'duration' => '30 min',
                    'price_from' => 80,
                    'doctor_profile' => ['narvaez'],
                ],
            ],
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

        \write_clinic_profile([
            'clinicName' => 'Clinica Portal Demo',
            'address' => 'Av. Portal 123, Quito',
            'phone' => '+593999123123',
            'logoImage' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==',
            'updatedAt' => '2026-04-01T09:00:00-05:00',
        ]);

        \write_doctor_profile([
            'fullName' => 'Dra. Lucia Portal',
            'specialty' => 'Dermatologia clinica',
            'mspNumber' => 'MSP-778899',
            'signatureImage' => '',
            'updatedAt' => '2026-04-01T09:05:00-05:00',
        ]);

        $response = $this->captureControllerExit(static function (): void {
            \ClinicProfileController::show([]);
        });

        self::assertSame(200, $response['status']);
        self::assertTrue((bool) ($response['payload']['ok'] ?? false));
        self::assertSame('public', (string) ($response['payload']['meta']['scope'] ?? ''));

        $data = is_array($response['payload']['data'] ?? null)
            ? $response['payload']['data']
            : [];

        self::assertSame('Clinica Portal Demo', (string) ($data['clinicName'] ?? ''));
        self::assertSame('Clinica Portal Demo', (string) ($data['name'] ?? ''));
        self::assertSame('Av. Portal 123, Quito', (string) ($data['address'] ?? ''));
        self::assertSame('+593999123123', (string) ($data['phone'] ?? ''));
        self::assertStringStartsWith('data:image/png;base64,', (string) ($data['logoImage'] ?? ''));
        self::assertMatchesRegularExpression('/^#[a-f0-9]{6}$/', (string) ($data['colors']['primary'] ?? ''));
        self::assertMatchesRegularExpression('/^#[a-f0-9]{6}$/', (string) ($data['colors']['accent'] ?? ''));
        self::assertNotEmpty($data['businessHours'] ?? []);
        self::assertCount(3, $data['activeDoctors'] ?? []);
        self::assertSame('Dra. Lucia Portal', (string) ($data['activeDoctors'][0]['name'] ?? ''));
        self::assertCount(2, $data['services'] ?? []);
        self::assertSame('diagnostico-integral', (string) ($data['services'][0]['slug'] ?? ''));
        self::assertSame('/es/servicios/diagnostico-integral/', (string) ($data['services'][0]['href'] ?? ''));
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
