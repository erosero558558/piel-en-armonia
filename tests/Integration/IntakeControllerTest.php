<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 * @preserveGlobalState disabled
 */
final class IntakeControllerTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY'], $GLOBALS['__TEST_EMAIL_OUTBOX']);
        $_GET = [];
        $_POST = [];
        $_FILES = [];
        $_SERVER = [
            'REQUEST_METHOD' => 'POST',
            'REMOTE_ADDR' => '127.0.0.1',
            'HTTP_HOST' => '127.0.0.1:8011',
        ];

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'intake-controller-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0777, true);

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('AURORADERM_SKIP_ENV_FILE=1');
        putenv('PIELARMONIA_SKIP_ENV_FILE=1');
        putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');
        putenv('AURORADERM_ADMIN_EMAIL=frontdesk@example.com');
        ini_set('log_errors', '1');
        ini_set('error_log', $this->tempDir . DIRECTORY_SEPARATOR . 'php-error.log');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../controllers/IntakeController.php';

        if (\function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        \ensure_data_file();
    }

    protected function tearDown(): void
    {
        foreach ([
            'PIELARMONIA_DATA_DIR',
            'AURORADERM_SKIP_ENV_FILE',
            'PIELARMONIA_SKIP_ENV_FILE',
            'PIELARMONIA_AVAILABILITY_SOURCE',
            'AURORADERM_ADMIN_EMAIL',
        ] as $key) {
            putenv($key);
        }

        if (\function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY'], $GLOBALS['__TEST_EMAIL_OUTBOX']);
        $_GET = [];
        $_POST = [];
        $_FILES = [];
        $_SERVER = [];
    }

    public function testStoreCreatesLeadCapturedCaseUploadsTimelineAndAdminNotification(): void
    {
        $uploadPath = $this->createTinyPng('preconsulta.png');
        $uploadSize = filesize($uploadPath);
        self::assertIsInt($uploadSize);
        self::assertGreaterThan(0, $uploadSize);

        $_POST = [
            'nombre' => 'Paciente Preconsulta',
            'whatsapp' => '0991234567',
            'tipo_piel' => 'mixta',
            'condicion' => 'Manchas y picazon desde hace dos semanas.',
        ];
        $_FILES['fotos'] = [
            'name' => ['preconsulta.png'],
            'type' => ['image/png'],
            'tmp_name' => [$uploadPath],
            'error' => [UPLOAD_ERR_OK],
            'size' => [$uploadSize],
        ];

        $response = $this->captureJsonResponse(static function (): void {
            \IntakeController::store(['store' => \read_store()]);
        });

        self::assertSame(201, $response['status']);
        self::assertTrue((bool) ($response['payload']['ok'] ?? false));

        $store = \read_store();
        self::assertCount(1, $store['patient_cases'] ?? []);
        self::assertCount(1, $store['clinical_uploads'] ?? []);
        self::assertCount(1, $store['patient_case_timeline_events'] ?? []);
        self::assertCount(1, $store['patient_case_links'] ?? []);

        $case = $store['patient_cases'][0];
        $upload = $store['clinical_uploads'][0];
        $event = $store['patient_case_timeline_events'][0];
        $link = $store['patient_case_links'][0];

        self::assertSame('lead_captured', (string) ($case['status'] ?? ''));
        self::assertSame('lead_captured', (string) ($case['journeyStage'] ?? ''));
        self::assertSame('Paciente Preconsulta', (string) ($case['summary']['patientLabel'] ?? ''));
        self::assertSame('0991234567', (string) ($case['summary']['contactPhone'] ?? ''));
        self::assertSame('mixta', (string) ($case['summary']['intakeSkinType'] ?? ''));
        self::assertSame('public_preconsultation', (string) ($case['summary']['source'] ?? ''));
        self::assertSame(1, (int) ($case['summary']['intakePhotoCount'] ?? 0));
        self::assertSame(
            (string) ($case['id'] ?? ''),
            (string) ($response['payload']['data']['caseId'] ?? '')
        );

        self::assertSame('case_photo', (string) ($upload['kind'] ?? ''));
        self::assertSame('private_clinical', (string) ($upload['storageMode'] ?? ''));
        self::assertSame((string) ($case['id'] ?? ''), (string) ($upload['patientCaseId'] ?? ''));
        self::assertNotSame('', (string) ($upload['privatePath'] ?? ''));
        self::assertFileExists($this->tempDir . DIRECTORY_SEPARATOR . (string) ($upload['privatePath'] ?? ''));

        self::assertSame('public_intake_created', (string) ($event['type'] ?? ''));
        self::assertSame((string) ($case['id'] ?? ''), (string) ($event['patientCaseId'] ?? ''));
        self::assertSame('Preconsulta digital recibida', (string) ($event['title'] ?? ''));
        self::assertSame('flow_event', (string) ($link['entityType'] ?? ''));
        self::assertSame((string) ($event['id'] ?? ''), (string) ($link['entityId'] ?? ''));
        self::assertSame((string) ($case['id'] ?? ''), (string) ($link['patientCaseId'] ?? ''));

        $outbox = $GLOBALS['__TEST_EMAIL_OUTBOX'] ?? [];
        self::assertCount(1, $outbox);
        self::assertSame('frontdesk@example.com', (string) ($outbox[0]['to'] ?? ''));
        self::assertStringContainsString(
            'Nueva preconsulta digital',
            (string) ($outbox[0]['subject'] ?? '')
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

    private function createTinyPng(string $filename): string
    {
        $path = $this->tempDir . DIRECTORY_SEPARATOR . $filename;
        $binary = base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAF/gLRRHFqWQAAAABJRU5ErkJggg==',
            true
        );
        self::assertNotFalse($binary);
        file_put_contents($path, $binary);

        return $path;
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
