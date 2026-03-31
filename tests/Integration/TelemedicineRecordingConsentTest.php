<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
final class TelemedicineRecordingConsentTest extends TestCase
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

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'telemedicine-recording-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0777, true);

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('AURORADERM_SKIP_ENV_FILE=1');
        putenv('PIELARMONIA_SKIP_ENV_FILE=1');
        ini_set('log_errors', '1');
        ini_set('error_log', $this->tempDir . DIRECTORY_SEPARATOR . 'php-error.log');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../controllers/TelemedicineRoomController.php';

        \ensure_data_file();

        $store = \read_store();
        $store['appointments'] = [
            \normalize_appointment([
                'id' => 701,
                'service' => 'video',
                'serviceName' => 'Teleconsulta de seguimiento',
                'doctor' => 'rosero',
                'doctorAssigned' => 'Dra Ana Rosero',
                'date' => '2099-04-15',
                'time' => '10:40',
                'name' => 'Lucia Grabacion',
                'email' => 'lucia.grabacion@example.com',
                'phone' => '0991234567',
                'status' => 'confirmed',
                'visitMode' => 'telemedicine_video',
                'patientCaseId' => 'pc-tele-701',
                'patientId' => 'pt-tele-701',
                'rescheduleToken' => 'rec-token-701',
                'dateBooked' => '2026-03-31T09:00:00-05:00',
            ]),
        ];
        $store['telemedicine_intakes'] = [[
            'id' => 801,
            'channel' => 'secure_video',
            'status' => 'booked',
            'suitability' => 'fit',
            'reviewRequired' => false,
            'linkedAppointmentId' => 701,
            'requestedDate' => '2099-04-15',
            'requestedTime' => '10:40',
            'requestedDoctor' => 'rosero',
            'patient' => [
                'name' => 'Lucia Grabacion',
                'email' => 'lucia.grabacion@example.com',
                'phone' => '0991234567',
            ],
            'createdAt' => '2026-03-31T09:00:00-05:00',
            'updatedAt' => '2026-03-31T09:00:00-05:00',
        ]];
        $store['clinical_uploads'] = [];
        $store['patient_case_timeline_events'] = [];
        \write_store($store, false);
    }

    protected function tearDown(): void
    {
        foreach ([
            'PIELARMONIA_DATA_DIR',
            'AURORADERM_SKIP_ENV_FILE',
            'PIELARMONIA_SKIP_ENV_FILE',
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

    public function testRecordingConsentFlowPersistsConsentMetadataAndArchive(): void
    {
        $_SERVER['REQUEST_METHOD'] = 'POST';
        $_GET = ['id' => '701'];
        $_POST = ['id' => '701', 'action' => 'request'];

        $request = $this->captureJsonResponse(function (): void {
            \TelemedicineRoomController::recordingConsent([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
        });

        self::assertSame(200, $request['status']);
        $requestId = (string) ($request['payload']['data']['consent']['requestId'] ?? '');
        self::assertNotSame('', $requestId);
        self::assertSame('requested', (string) ($request['payload']['data']['consent']['status'] ?? ''));

        $_SERVER['REQUEST_METHOD'] = 'POST';
        $_GET = ['token' => 'rec-token-701'];
        $_POST = [
            'token' => 'rec-token-701',
            'action' => 'grant',
            'requestId' => $requestId,
        ];

        $grant = $this->captureJsonResponse(function (): void {
            \TelemedicineRoomController::recordingConsent([
                'store' => \read_store(),
            ]);
        });

        self::assertSame(200, $grant['status']);
        self::assertSame('granted', (string) ($grant['payload']['data']['consent']['status'] ?? ''));

        $fixturePath = $this->tempDir . DIRECTORY_SEPARATOR . 'recording-fixture.mp4';
        file_put_contents($fixturePath, (string) hex2bin('00000018667479706D703432000000006D70343269736F6D'));

        $_SERVER['REQUEST_METHOD'] = 'POST';
        $_GET = ['id' => '701'];
        $_POST = ['id' => '701'];
        $_FILES['video'] = [
            'name' => 'teleconsulta.mp4',
            'type' => 'video/mp4',
            'tmp_name' => $fixturePath,
            'error' => UPLOAD_ERR_OK,
            'size' => filesize($fixturePath),
        ];

        $upload = $this->captureJsonResponse(function (): void {
            \TelemedicineRoomController::uploadRecording([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
        });

        self::assertSame(200, $upload['status']);
        self::assertTrue((bool) ($upload['payload']['ok'] ?? false));

        $store = \read_store();
        self::assertCount(1, $store['clinical_uploads']);

        $savedUpload = $store['clinical_uploads'][0];
        self::assertSame('telemedicine_recording', (string) ($savedUpload['kind'] ?? ''));
        self::assertSame('private_clinical', (string) ($savedUpload['storageMode'] ?? ''));
        self::assertSame('recorded', (string) ($savedUpload['recordingConsentSnapshot']['status'] ?? ''));
        self::assertSame($requestId, (string) ($savedUpload['recordingRequestId'] ?? ''));
        self::assertSame('granted', (string) ($savedUpload['recordingConsentSnapshot']['doctorConsent']['status'] ?? ''));
        self::assertSame('granted', (string) ($savedUpload['recordingConsentSnapshot']['patientConsent']['status'] ?? ''));

        self::assertSame('recorded', (string) ($store['appointments'][0]['telemedicineRecordingConsent']['status'] ?? ''));
        self::assertSame(
            (int) ($savedUpload['id'] ?? 0),
            (int) ($store['appointments'][0]['telemedicineRecordingConsent']['recordingUploadId'] ?? 0)
        );
        self::assertSame('recorded', (string) ($store['telemedicine_intakes'][0]['telemedicineRecordingConsent']['status'] ?? ''));

        $timelineTypes = array_column($store['patient_case_timeline_events'] ?? [], 'type');
        self::assertContains('telemedicine_recording_consent_requested', $timelineTypes);
        self::assertContains('telemedicine_recording_consent_granted', $timelineTypes);
        self::assertContains('telemedicine_recording_saved', $timelineTypes);
    }

    public function testRecordingUploadRequiresGrantedConsent(): void
    {
        $fixturePath = $this->tempDir . DIRECTORY_SEPARATOR . 'recording-without-consent.mp4';
        file_put_contents($fixturePath, (string) hex2bin('00000018667479706D703432000000006D70343269736F6D'));

        $_SERVER['REQUEST_METHOD'] = 'POST';
        $_GET = ['id' => '701'];
        $_POST = ['id' => '701'];
        $_FILES['video'] = [
            'name' => 'teleconsulta.mp4',
            'type' => 'video/mp4',
            'tmp_name' => $fixturePath,
            'error' => UPLOAD_ERR_OK,
            'size' => filesize($fixturePath),
        ];

        $upload = $this->captureJsonResponse(function (): void {
            \TelemedicineRoomController::uploadRecording([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
        });

        self::assertSame(409, $upload['status']);
        self::assertStringContainsString(
            'consentimiento explicito de ambas partes',
            strtolower((string) ($upload['payload']['error'] ?? ''))
        );
        self::assertCount(0, \read_store()['clinical_uploads'] ?? []);
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
