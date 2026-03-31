<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 * @preserveGlobalState disabled
 */
final class NotificationControllerTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_POST = [];
        $_FILES = [];
        $_SERVER = [
            'REQUEST_METHOD' => 'GET',
            'REMOTE_ADDR' => '127.0.0.1',
            'HTTP_HOST' => '127.0.0.1:8011',
            'HTTP_USER_AGENT' => 'PHPUnit Portal Push',
        ];

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'notification-controller-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0777, true);

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('AURORADERM_SKIP_ENV_FILE=1');
        putenv('PIELARMONIA_SKIP_ENV_FILE=1');
        putenv('AURORADERM_PATIENT_PORTAL_JWT_SECRET=test-patient-portal-secret');
        putenv('AURORADERM_PATIENT_PORTAL_EXPOSE_OTP=1');
        putenv('AURORADERM_VAPID_PUBLIC_KEY=test_public_key');
        putenv('AURORADERM_VAPID_PRIVATE_KEY=test_private_key');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../controllers/NotificationController.php';

        \ensure_data_file();

        $store = \read_store();
        $store['appointments'][] = \normalize_appointment([
            'id' => 101,
            'service' => 'consulta',
            'doctor' => 'rosero',
            'date' => '2099-04-02',
            'time' => '10:30',
            'name' => 'Lucia Portal',
            'phone' => '0991234567',
            'patientId' => 'pt_lucia_001',
            'patientCaseId' => 'pc_lucia_001',
            'status' => 'confirmed',
        ]);
        $store['patient_cases'][] = [
            'id' => 'pc_lucia_001',
            'tenantId' => 'aurora-derm',
            'patientId' => 'pt_lucia_001',
            'status' => 'lead_captured',
            'latestActivityAt' => '2026-03-30T10:00:00-05:00',
            'summary' => [
                'patientLabel' => 'Lucia Portal',
                'contactPhone' => '0991234567',
            ],
        ];

        \write_store($store, false);
    }

    protected function tearDown(): void
    {
        foreach ([
            'PIELARMONIA_DATA_DIR',
            'AURORADERM_SKIP_ENV_FILE',
            'PIELARMONIA_SKIP_ENV_FILE',
            'AURORADERM_PATIENT_PORTAL_JWT_SECRET',
            'AURORADERM_PATIENT_PORTAL_EXPOSE_OTP',
            'AURORADERM_VAPID_PUBLIC_KEY',
            'AURORADERM_VAPID_PRIVATE_KEY',
        ] as $key) {
            putenv($key);
        }

        $this->removeDirectory($this->tempDir);
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_POST = [];
        $_FILES = [];
        $_SERVER = [];
    }

    public function testPortalPatientCanSubscribeAndUnsubscribePushNotifications(): void
    {
        $token = $this->issuePortalToken();
        $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $token;

        $configBefore = $this->captureJsonResponse(function (): void {
            $_SERVER['REQUEST_METHOD'] = 'GET';
            \NotificationController::config(['store' => \read_store()]);
        });

        self::assertSame(200, $configBefore['status']);
        self::assertTrue((bool) ($configBefore['payload']['ok'] ?? false));
        self::assertFalse((bool) ($configBefore['payload']['data']['subscribed'] ?? true));
        self::assertSame('test_public_key', (string) ($configBefore['payload']['data']['publicKey'] ?? ''));

        $subscribe = $this->captureJsonResponse(function (): void {
            $_SERVER['REQUEST_METHOD'] = 'POST';
            $GLOBALS['__TEST_JSON_BODY'] = json_encode([
                'locale' => 'es',
                'subscription' => [
                    'endpoint' => 'https://push.example.test/subscriptions/portal-001',
                    'keys' => [
                        'p256dh' => 'test_p256dh_key',
                        'auth' => 'test_auth_key',
                    ],
                ],
            ], JSON_UNESCAPED_UNICODE);

            \NotificationController::subscribe(['store' => \read_store()]);
        });

        self::assertSame(200, $subscribe['status']);
        self::assertTrue((bool) ($subscribe['payload']['ok'] ?? false));
        self::assertSame(1, (int) ($subscribe['payload']['data']['subscriptions'] ?? 0));

        $service = new \PushService();
        self::assertSame(
            1,
            $service->subscriptionsCount([
                'channel' => 'patient_portal',
                'patientId' => 'pt_lucia_001',
                'scope' => \NotificationService::scope(),
            ])
        );

        $configAfter = $this->captureJsonResponse(function (): void {
            $_SERVER['REQUEST_METHOD'] = 'GET';
            \NotificationController::config(['store' => \read_store()]);
        });

        self::assertTrue((bool) ($configAfter['payload']['data']['subscribed'] ?? false));

        $unsubscribe = $this->captureJsonResponse(function (): void {
            $_SERVER['REQUEST_METHOD'] = 'POST';
            $GLOBALS['__TEST_JSON_BODY'] = json_encode([
                'endpoint' => 'https://push.example.test/subscriptions/portal-001',
            ], JSON_UNESCAPED_UNICODE);

            \NotificationController::unsubscribe(['store' => \read_store()]);
        });

        self::assertSame(200, $unsubscribe['status']);
        self::assertTrue((bool) ($unsubscribe['payload']['ok'] ?? false));
        self::assertSame(
            0,
            $service->subscriptionsCount([
                'channel' => 'patient_portal',
                'patientId' => 'pt_lucia_001',
                'scope' => \NotificationService::scope(),
            ])
        );
    }

    private function issuePortalToken(): string
    {
        $start = \PatientPortalAuth::startLogin(\read_store(), '0991234567');
        self::assertTrue((bool) ($start['ok'] ?? false));

        $complete = \PatientPortalAuth::completeLogin(
            \read_store(),
            '0991234567',
            (string) ($start['data']['debugCode'] ?? ''),
            (string) ($start['data']['challengeId'] ?? '')
        );
        self::assertTrue((bool) ($complete['ok'] ?? false));

        return (string) ($complete['data']['token'] ?? '');
    }

    private function captureJsonResponse(callable $callable): array
    {
        try {
            $callable();
            self::fail('Expected TestingExitException');
        } catch (\TestingExitException $exception) {
            return [
                'payload' => $exception->payload,
                'status' => $exception->status,
            ];
        }
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
