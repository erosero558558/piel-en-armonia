<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 * @preserveGlobalState disabled
 */
final class PatientPortalControllerTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_POST = [];
        $_FILES = [];
        $_SERVER = [
            'REQUEST_METHOD' => 'POST',
            'REMOTE_ADDR' => '127.0.0.1',
            'HTTP_HOST' => '127.0.0.1:8011',
        ];

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'patient-portal-auth-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0777, true);

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('AURORADERM_SKIP_ENV_FILE=1');
        putenv('PIELARMONIA_SKIP_ENV_FILE=1');
        putenv('AURORADERM_PATIENT_PORTAL_JWT_SECRET=test-patient-portal-secret');
        putenv('AURORADERM_PATIENT_PORTAL_EXPOSE_OTP=1');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../controllers/PatientPortalController.php';

        \ensure_data_file();
        $store = \read_store();
        $store['appointments'][] = \normalize_appointment([
            'id' => 101,
            'service' => 'consulta',
            'doctor' => 'rosero',
            'date' => '2026-04-02',
            'time' => '10:30',
            'name' => 'Lucia Portal',
            'email' => 'lucia@example.com',
            'phone' => '0991234567',
            'patientId' => 'pt_lucia_001',
            'patientCaseId' => 'pc_lucia_001',
            'status' => 'confirmed',
            'dateBooked' => '2026-03-30T10:00:00-05:00',
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

    public function testStartCompleteAndStatusFlowWithWhatsappOtp(): void
    {
        $start = $this->captureJsonResponse(function (): void {
            $GLOBALS['__TEST_JSON_BODY'] = json_encode([
                'phone' => '0991234567',
            ], JSON_UNESCAPED_UNICODE);
            \PatientPortalController::start(['store' => \read_store()]);
        });

        self::assertSame(200, $start['status']);
        self::assertTrue((bool) ($start['payload']['ok'] ?? false));
        self::assertSame('*******4567', (string) ($start['payload']['data']['maskedPhone'] ?? ''));
        self::assertSame('pt_lucia_001', (string) ($start['payload']['data']['patient']['patientId'] ?? ''));

        $outbox = \whatsapp_openclaw_repository()->listPendingOutbox(10);
        self::assertCount(1, $outbox);
        $text = (string) (($outbox[0]['payload']['text'] ?? ''));
        self::assertMatchesRegularExpression('/\*(\d{6})\*/', $text);
        preg_match('/\*(\d{6})\*/', $text, $matches);
        $otp = (string) ($matches[1] ?? '');
        self::assertSame(6, strlen($otp));

        $complete = $this->captureJsonResponse(function () use ($otp, $start): void {
            $GLOBALS['__TEST_JSON_BODY'] = json_encode([
                'phone' => '0991234567',
                'challengeId' => $start['payload']['data']['challengeId'] ?? '',
                'code' => $otp,
            ], JSON_UNESCAPED_UNICODE);
            \PatientPortalController::complete(['store' => \read_store()]);
        });

        self::assertSame(200, $complete['status']);
        self::assertTrue((bool) ($complete['payload']['ok'] ?? false));
        self::assertNotSame('', (string) ($complete['payload']['data']['token'] ?? ''));
        self::assertSame(
            'pt_lucia_001',
            (string) ($complete['payload']['data']['patient']['patientId'] ?? '')
        );

        $_SERVER['REQUEST_METHOD'] = 'GET';
        $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . (string) ($complete['payload']['data']['token'] ?? '');

        $status = $this->captureJsonResponse(function (): void {
            \PatientPortalController::status(['store' => \read_store()]);
        });

        self::assertSame(200, $status['status']);
        self::assertTrue((bool) ($status['payload']['data']['authenticated'] ?? false));
        self::assertSame(
            'Lucia Portal',
            (string) ($status['payload']['data']['patient']['name'] ?? '')
        );
    }

    public function testStartRejectsUnknownWhatsapp(): void
    {
        $response = $this->captureJsonResponse(function (): void {
            $GLOBALS['__TEST_JSON_BODY'] = json_encode([
                'phone' => '0990000000',
            ], JSON_UNESCAPED_UNICODE);
            \PatientPortalController::start(['store' => \read_store()]);
        });

        self::assertSame(404, $response['status']);
        self::assertFalse((bool) ($response['payload']['ok'] ?? true));
        self::assertSame(
            'patient_portal_not_found',
            (string) ($response['payload']['code'] ?? '')
        );
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
