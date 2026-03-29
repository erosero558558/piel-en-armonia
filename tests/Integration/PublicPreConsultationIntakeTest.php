<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 * @preserveGlobalState disabled
 */
final class PublicPreConsultationIntakeTest extends TestCase
{
    private string $tempDir;
    private string $uploadDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_JSON_BODY'], $GLOBALS['__TEST_RESPONSE']);
        $_GET = [];
        $_FILES = [];
        $_SERVER = [
            'REMOTE_ADDR' => '127.0.0.1',
            'REQUEST_METHOD' => 'POST',
        ];

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'public-preconsulta-' . bin2hex(random_bytes(6));
        $this->uploadDir = $this->tempDir . DIRECTORY_SEPARATOR . 'public-uploads';
        mkdir($this->tempDir, 0777, true);
        mkdir($this->uploadDir, 0777, true);

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_TRANSFER_UPLOAD_DIR=' . $this->uploadDir);
        putenv('PIELARMONIA_TRANSFER_PUBLIC_BASE_URL=/uploads/transfer-proofs');
        putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');
        ini_set('log_errors', '1');
        ini_set('error_log', $this->tempDir . DIRECTORY_SEPARATOR . 'php-error.log');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../controllers/PatientCaseController.php';
        require_once __DIR__ . '/../../lib/FlowOsJourney.php';

        \ensure_data_file();
    }

    protected function tearDown(): void
    {
        foreach ([
            'PIELARMONIA_DATA_DIR',
            'PIELARMONIA_TRANSFER_UPLOAD_DIR',
            'PIELARMONIA_TRANSFER_PUBLIC_BASE_URL',
            'PIELARMONIA_AVAILABILITY_SOURCE',
            'PIELARMONIA_REQUIRE_DATA_ENCRYPTION',
            'PIELARMONIA_FORCE_SQLITE_UNAVAILABLE',
            'PIELARMONIA_DATA_ENCRYPTION_KEY',
        ] as $key) {
            putenv($key);
        }

        if (\function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
        unset($GLOBALS['__TEST_JSON_BODY'], $GLOBALS['__TEST_RESPONSE']);
        $_GET = [];
        $_FILES = [];
        $_SERVER = [];
    }

    public function testPublicPreconsultationCreatesLeadCapturedCaseAndClaimsPhotos(): void
    {
        $legacyFilename = 'preconsulta-case.jpg';
        $legacyDiskPath = $this->uploadDir . DIRECTORY_SEPARATOR . $legacyFilename;
        file_put_contents($legacyDiskPath, 'fake-jpg-content');

        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'name' => 'Paciente Demo',
            'whatsapp' => '+593999111222',
            'skinType' => 'sensible',
            'condition' => 'Mancha nueva con picor leve en mejilla derecha desde hace dos semanas.',
            'privacyConsent' => true,
            'casePhotoPaths' => [
                '/uploads/transfer-proofs/' . $legacyFilename,
            ],
            'casePhotoNames' => [
                'lesion.jpg',
            ],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $response = $this->captureJsonResponse(static function (): void {
            \PatientCaseController::store([
                'store' => \read_store(),
            ]);
        });

        $this->assertSame(201, $response['status']);
        $this->assertTrue((bool) ($response['payload']['ok'] ?? false));
        $this->assertSame('lead_captured', (string) ($response['payload']['data']['stage'] ?? ''));
        $this->assertSame('frontdesk', (string) ($response['payload']['data']['owner'] ?? ''));

        $store = \read_store();
        $this->assertCount(1, $store['patient_cases'] ?? []);
        $this->assertCount(1, $store['callbacks'] ?? []);
        $this->assertCount(1, $store['clinical_uploads'] ?? []);
        $this->assertCount(2, $store['patient_case_timeline_events'] ?? []);
        $this->assertSame('lead_captured', \flow_os_detect_stage($store));

        $case = $store['patient_cases'][0];
        $this->assertSame('lead_captured', (string) ($case['status'] ?? ''));
        $this->assertSame('preconsulta_digital', (string) ($case['summary']['serviceLine'] ?? ''));
        $this->assertSame('sensible', (string) ($case['summary']['skinType'] ?? ''));
        $this->assertSame('preconsulta_publica', (string) ($case['summary']['entrySurface'] ?? ''));
        $this->assertSame(1, (int) ($case['summary']['casePhotoCount'] ?? 0));
        $this->assertCount(1, $case['summary']['clinicalMediaIds'] ?? []);

        $callback = $store['callbacks'][0];
        $this->assertSame((string) ($case['id'] ?? ''), (string) ($callback['patientCaseId'] ?? ''));
        $this->assertSame('warm', (string) ($callback['leadOps']['priorityBand'] ?? ''));
        $this->assertSame('preconsultation_form', (string) ($callback['leadOps']['reasonCodes'][0] ?? ''));

        $upload = $store['clinical_uploads'][0];
        $privatePath = (string) ($upload['privatePath'] ?? '');
        $this->assertSame((string) ($case['id'] ?? ''), (string) ($upload['caseId'] ?? ''));
        $this->assertSame('private_clinical', (string) ($upload['storageMode'] ?? ''));
        $this->assertNotSame('', $privatePath);
        $this->assertFileExists($this->tempDir . DIRECTORY_SEPARATOR . $privatePath);
    }

    public function testPublicPreconsultationBlocksPhotoIntakeWhenClinicalStorageIsNotReady(): void
    {
        putenv('PIELARMONIA_REQUIRE_DATA_ENCRYPTION=1');
        putenv('PIELARMONIA_FORCE_SQLITE_UNAVAILABLE=1');
        putenv('PIELARMONIA_DATA_ENCRYPTION_KEY');

        $legacyFilename = 'blocked-case.jpg';
        file_put_contents($this->uploadDir . DIRECTORY_SEPARATOR . $legacyFilename, 'fake-jpg-content');

        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'name' => 'Paciente Bloqueado',
            'whatsapp' => '+593999111223',
            'skinType' => 'mixta',
            'condition' => 'Brote nuevo con fotos adjuntas.',
            'privacyConsent' => true,
            'casePhotoPaths' => [
                '/uploads/transfer-proofs/' . $legacyFilename,
            ],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $response = $this->captureJsonResponse(static function (): void {
            \PatientCaseController::store([
                'store' => \read_store(),
            ]);
        });

        $this->assertSame(409, $response['status']);
        $this->assertFalse((bool) ($response['payload']['ok'] ?? true));
        $this->assertSame('clinical_storage_not_ready', (string) ($response['payload']['code'] ?? ''));
        $this->assertSame('patient_case_intake', (string) ($response['payload']['surface'] ?? ''));
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
        } finally {
            unset($GLOBALS['__TEST_JSON_BODY']);
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
