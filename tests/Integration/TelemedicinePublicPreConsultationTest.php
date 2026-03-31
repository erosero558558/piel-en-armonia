<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
final class TelemedicinePublicPreConsultationTest extends TestCase
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
        ];

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'telemedicine-public-pre-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0777, true);

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('AURORADERM_SKIP_ENV_FILE=1');
        putenv('PIELARMONIA_SKIP_ENV_FILE=1');
        putenv('PIELARMONIA_TELEMED_V2_SHADOW=true');
        ini_set('log_errors', '1');
        ini_set('error_log', $this->tempDir . DIRECTORY_SEPARATOR . 'php-error.log');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../controllers/TelemedicinePublicController.php';

        \ensure_data_file();

        $store = \read_store();
        $store['appointments'] = [
            \normalize_appointment([
                'id' => 301,
                'service' => 'video',
                'serviceName' => 'Teleconsulta de control',
                'doctor' => 'rosero',
                'doctorAssigned' => 'dra ana rosero',
                'date' => '2099-04-12',
                'time' => '10:10',
                'name' => 'Lucia Telemed',
                'email' => 'lucia.telemed@example.com',
                'phone' => '0991234567',
                'status' => 'confirmed',
                'visitMode' => 'telemedicine_video',
                'rescheduleToken' => 'tele-pre-token',
                'dateBooked' => '2026-03-31T09:00:00-05:00',
            ]),
        ];
        $store['telemedicine_intakes'] = [];
        $store['clinical_uploads'] = [];
        \write_store($store, false);
    }

    protected function tearDown(): void
    {
        foreach ([
            'PIELARMONIA_DATA_DIR',
            'AURORADERM_SKIP_ENV_FILE',
            'PIELARMONIA_SKIP_ENV_FILE',
            'PIELARMONIA_TELEMED_V2_SHADOW',
        ] as $key) {
            putenv($key);
        }

        if (function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_POST = [];
        $_FILES = [];
    }

    public function testGetPreConsultationLoadsAppointmentByToken(): void
    {
        $store = \read_store();
        $store['telemedicine_intakes'][] = [
            'id' => 801,
            'channel' => 'secure_video',
            'status' => 'booked',
            'suitability' => 'fit',
            'reviewRequired' => false,
            'linkedAppointmentId' => 301,
            'requestedDate' => '2099-04-12',
            'requestedTime' => '10:10',
            'requestedDoctor' => 'dra ana rosero',
            'patient' => [
                'name' => 'Lucia Telemed',
                'phone' => '0991234567',
                'email' => 'lucia.telemed@example.com',
            ],
            'latestPatientConcern' => 'Desde ayer la lesión arde más.',
            'telemedicinePreConsultation' => [
                'status' => 'submitted',
                'statusLabel' => 'Pre-consulta enviada',
                'concern' => 'Desde ayer la lesión arde más.',
                'hasNewLesion' => true,
                'photoCount' => 1,
                'mediaIds' => [901],
                'photos' => [],
                'submittedAt' => '2026-03-31T09:55:00-05:00',
                'updatedAt' => '2026-03-31T09:55:00-05:00',
            ],
            'createdAt' => '2026-03-31T09:00:00-05:00',
            'updatedAt' => '2026-03-31T09:55:00-05:00',
        ];
        \write_store($store, false);

        $_SERVER['REQUEST_METHOD'] = 'GET';
        $_GET['token'] = 'tele-pre-token';

        $response = $this->captureJsonResponse(function (): void {
            \TelemedicinePublicController::preConsultation(['store' => \read_store()]);
        });

        self::assertSame(200, $response['status']);
        self::assertTrue((bool) ($response['payload']['ok'] ?? false));
        self::assertSame(
            'Lucia Telemed',
            (string) ($response['payload']['data']['appointment']['patientName'] ?? '')
        );
        self::assertSame(
            'Dra Ana Rosero',
            (string) ($response['payload']['data']['appointment']['doctorName'] ?? '')
        );
        self::assertSame(
            'Teleconsulta de control',
            (string) ($response['payload']['data']['appointment']['serviceName'] ?? '')
        );
        self::assertSame(
            'Desde ayer la lesión arde más.',
            (string) ($response['payload']['data']['preConsultation']['concern'] ?? '')
        );
        self::assertStringContainsString(
            'token=tele-pre-token',
            (string) ($response['payload']['data']['roomUrl'] ?? '')
        );
    }

    public function testSubmitPreConsultationPersistsConcernAndPhoto(): void
    {
        $fixturePath = $this->tempDir . DIRECTORY_SEPARATOR . 'tele-pre-upload.png';
        file_put_contents(
            $fixturePath,
            (string) base64_decode(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0WQAAAAASUVORK5CYII='
            )
        );

        $_SERVER['REQUEST_METHOD'] = 'POST';
        $_POST = [
            'token' => 'tele-pre-token',
            'concern' => 'Hoy amaneció más roja y pica.',
            'hasNewLesion' => '1',
        ];
        $_FILES['photos'] = [
            'name' => 'lesion-hoy.png',
            'type' => 'image/png',
            'tmp_name' => $fixturePath,
            'error' => UPLOAD_ERR_OK,
            'size' => filesize($fixturePath),
        ];

        $response = $this->captureJsonResponse(function (): void {
            \TelemedicinePublicController::submitPreConsultation(['store' => \read_store()]);
        });

        self::assertSame(200, $response['status']);
        self::assertTrue((bool) ($response['payload']['ok'] ?? false));
        self::assertSame(
            'Hoy amaneció más roja y pica.',
            (string) ($response['payload']['data']['preConsultation']['concern'] ?? '')
        );
        self::assertSame(
            1,
            (int) ($response['payload']['data']['preConsultation']['photoCount'] ?? 0)
        );
        self::assertStringContainsString(
            'token=tele-pre-token',
            (string) ($response['payload']['data']['roomUrl'] ?? '')
        );

        $store = \read_store();
        self::assertCount(1, $store['telemedicine_intakes']);
        self::assertCount(1, $store['clinical_uploads']);
        self::assertSame(
            'Hoy amaneció más roja y pica.',
            (string) ($store['telemedicine_intakes'][0]['latestPatientConcern'] ?? '')
        );
        self::assertSame(
            'submitted',
            (string) ($store['telemedicine_intakes'][0]['telemedicinePreConsultation']['status'] ?? '')
        );
        self::assertSame(
            1,
            count($store['telemedicine_intakes'][0]['clinicalMediaIds'] ?? [])
        );
        self::assertSame(
            'Hoy amaneció más roja y pica.',
            (string) ($store['appointments'][0]['latestPatientConcern'] ?? '')
        );
        self::assertSame(
            'submitted',
            (string) ($store['appointments'][0]['telemedicinePreConsultation']['status'] ?? '')
        );
    }

    private function captureJsonResponse(callable $callable): array
    {
        try {
            $callable();
            self::fail('Expected TestingExitException');
        } catch (\TestingExitException $exception) {
            return [
                'status' => $exception->status,
                'payload' => $exception->payload,
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
