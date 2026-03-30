<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../helpers/StripeMock.php';

final class TelemedicineLegacyBridgeTest extends TestCase
{
    private string $tempDir;
    private string $uploadDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_JSON_BODY'], $GLOBALS['__TEST_RESPONSE']);
        $_FILES = [];

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'telemedicine-bridge-' . bin2hex(random_bytes(6));
        $this->uploadDir = $this->tempDir . DIRECTORY_SEPARATOR . 'public-uploads';
        mkdir($this->tempDir, 0777, true);
        mkdir($this->uploadDir, 0777, true);

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_TRANSFER_UPLOAD_DIR=' . $this->uploadDir);
        putenv('PIELARMONIA_TRANSFER_PUBLIC_BASE_URL=/uploads/transfer-proofs');
        putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');
        putenv('PIELARMONIA_STRIPE_SECRET_KEY=sk_test_mock');
        putenv('PIELARMONIA_STRIPE_PUBLISHABLE_KEY=pk_test_mock');
        ini_set('log_errors', '1');
        ini_set('error_log', $this->tempDir . DIRECTORY_SEPARATOR . 'php-error.log');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../lib/common.php';
        require_once __DIR__ . '/../../lib/http.php';
        require_once __DIR__ . '/../../lib/storage.php';
        require_once __DIR__ . '/../../lib/business.php';
        require_once __DIR__ . '/../../lib/ratelimit.php';
        require_once __DIR__ . '/../../lib/validation.php';
        require_once __DIR__ . '/../../lib/models.php';
        require_once __DIR__ . '/../../lib/email.php';
        require_once __DIR__ . '/../../payment-lib.php';
        require_once __DIR__ . '/../../controllers/PaymentController.php';
        require_once __DIR__ . '/../../controllers/AppointmentController.php';
        require_once __DIR__ . '/../../lib/telemedicine/ClinicalMediaService.php';

        \ensure_data_file();
    }

    protected function tearDown(): void
    {
        foreach ([
            'PIELARMONIA_DATA_DIR',
            'PIELARMONIA_TRANSFER_UPLOAD_DIR',
            'PIELARMONIA_TRANSFER_PUBLIC_BASE_URL',
            'PIELARMONIA_AVAILABILITY_SOURCE',
            'PIELARMONIA_STRIPE_SECRET_KEY',
            'PIELARMONIA_STRIPE_PUBLISHABLE_KEY',
            'PIELARMONIA_REQUIRE_DATA_ENCRYPTION',
            'PIELARMONIA_FORCE_SQLITE_UNAVAILABLE',
            'PIELARMONIA_DATA_ENCRYPTION_KEY',
        ] as $key) {
            putenv($key);
        }
        if (function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }
        $this->removeDirectory($this->tempDir);
        unset($GLOBALS['__TEST_JSON_BODY'], $GLOBALS['__TEST_RESPONSE']);
        $_FILES = [];
    }

    /**
     * @runInSeparateProcess
     */
    public function testPaymentIntentCreatesTelemedicineDraftInShadowMode(): void
    {
        $futureDate = date('Y-m-d', strtotime('next monday'));
        $store = \read_store();
        $store['availability'][$futureDate] = ['10:00'];
        \write_store($store, false);

        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'name' => 'Paciente Telemed',
            'email' => 'telemed@example.com',
            'phone' => '0999999999',
            'date' => $futureDate,
            'time' => '10:00',
            'doctor' => 'rosero',
            'service' => 'video',
            'reason' => 'Brote de acne inflamatorio persistente.',
            'affectedArea' => 'rostro',
            'evolutionTime' => '2 semanas',
            'privacyConsent' => true,
        ], JSON_UNESCAPED_UNICODE);

        try {
            \PaymentController::createIntent(['store' => \read_store()]);
            self::fail('Se esperaba TestingExitException');
        } catch (\TestingExitException $e) {
            $this->assertSame(200, $e->status);
        }

        $roundtrip = \read_store();
        $this->assertCount(1, $roundtrip['telemedicine_intakes']);
        $this->assertSame('awaiting_payment', $roundtrip['telemedicine_intakes'][0]['status']);
        $this->assertSame('secure_video', $roundtrip['telemedicine_intakes'][0]['channel']);
    }

    /**
     * @runInSeparateProcess
     */
    public function testPaymentIntentBlocksTelemedicineWhenClinicalStorageIsNotReady(): void
    {
        $this->enableClinicalStorageGate();

        $futureDate = date('Y-m-d', strtotime('next monday'));
        $store = \read_store();
        $store['availability'][$futureDate] = ['10:00'];
        \write_store($store, false);

        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'name' => 'Paciente Telemed Bloqueado',
            'email' => 'telemed-blocked@example.com',
            'phone' => '0999999999',
            'date' => $futureDate,
            'time' => '10:00',
            'doctor' => 'rosero',
            'service' => 'video',
            'reason' => 'Seguimiento telemedicina bloqueado por storage.',
            'privacyConsent' => true,
        ], JSON_UNESCAPED_UNICODE);

        try {
            \PaymentController::createIntent(['store' => \read_store()]);
            self::fail('Se esperaba TestingExitException');
        } catch (\TestingExitException $e) {
            $this->assertSame(409, $e->status);
            $this->assertSame('clinical_storage_not_ready', (string) ($e->payload['code'] ?? ''));
            $this->assertSame('payment_intent', (string) ($e->payload['surface'] ?? ''));
            $this->assertSame('', (string) (($e->payload['data']['paymentIntentId'] ?? '')));
        }

        $roundtrip = \read_store();
        $this->assertCount(0, $roundtrip['telemedicine_intakes']);
    }

    /**
     * @runInSeparateProcess
     */
    public function testTransferProofBlocksWhenClinicalStorageIsNotReady(): void
    {
        $this->enableClinicalStorageGate();

        $_FILES['proof'] = [
            'name' => 'proof.jpg',
            'type' => 'image/jpeg',
            'tmp_name' => $this->tempDir . DIRECTORY_SEPARATOR . 'fake-upload.jpg',
            'error' => UPLOAD_ERR_OK,
            'size' => 128,
        ];

        try {
            \PaymentController::transferProof([]);
            self::fail('Se esperaba TestingExitException');
        } catch (\TestingExitException $e) {
            $this->assertSame(409, $e->status);
            $this->assertSame('clinical_storage_not_ready', (string) ($e->payload['code'] ?? ''));
            $this->assertSame('transfer_proof', (string) ($e->payload['surface'] ?? ''));
            $this->assertSame(0, (int) (($e->payload['data']['transferProofUploadId'] ?? 0)));
        }

        $roundtrip = \read_store();
        $this->assertCount(0, $roundtrip['clinical_uploads']);
        $this->assertSame([], array_values(array_diff(scandir($this->uploadDir) ?: [], ['.', '..'])));
    }

    /**
     * @runInSeparateProcess
     */
    public function testAppointmentStoreBlocksTelemedicineWhenClinicalStorageIsNotReady(): void
    {
        $this->enableClinicalStorageGate();

        $futureDate = date('Y-m-d', strtotime('next tuesday'));
        $store = \read_store();
        $store['availability'][$futureDate] = ['11:00'];
        \write_store($store, false);

        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'name' => 'Paciente Video Bloqueado',
            'email' => 'video-blocked@example.com',
            'phone' => '0988888888',
            'date' => $futureDate,
            'time' => '11:00',
            'doctor' => 'rosero',
            'service' => 'video',
            'reason' => 'Reserva telemedicina bloqueada por storage.',
            'affectedArea' => 'rostro',
            'evolutionTime' => '3 semanas',
            'privacyConsent' => true,
            'paymentMethod' => 'cash',
        ], JSON_UNESCAPED_UNICODE);

        try {
            \AppointmentController::store(['store' => \read_store()]);
            self::fail('Se esperaba TestingExitException');
        } catch (\TestingExitException $e) {
            $this->assertSame(409, $e->status);
            $this->assertSame('clinical_storage_not_ready', (string) ($e->payload['code'] ?? ''));
            $this->assertSame('appointment_store', (string) ($e->payload['surface'] ?? ''));
        }

        $roundtrip = \read_store();
        $this->assertCount(0, $roundtrip['appointments']);
        $this->assertCount(0, $roundtrip['telemedicine_intakes']);
        $this->assertCount(0, $roundtrip['clinical_uploads']);
    }

    /**
     * @runInSeparateProcess
     */
    public function testAppointmentsCreatesLinkedTelemedicineIntakeAndClaimsCasePhoto(): void
    {
        $futureDate = date('Y-m-d', strtotime('next tuesday'));
        $store = \read_store();
        $store['availability'][$futureDate] = ['11:00'];

        $legacyFilename = 'legacy-photo.jpg';
        $legacyPath = '/uploads/transfer-proofs/' . $legacyFilename;
        $legacyDiskPath = $this->uploadDir . DIRECTORY_SEPARATOR . $legacyFilename;
        file_put_contents($legacyDiskPath, 'fake-jpg-content');

        $staged = \ClinicalMediaService::stageLegacyUpload($store, [
            'path' => $legacyPath,
            'url' => 'https://pielarmonia.com/uploads/transfer-proofs/' . $legacyFilename,
            'name' => 'lesion.jpg',
            'originalName' => 'lesion.jpg',
            'mime' => 'image/jpeg',
            'size' => filesize($legacyDiskPath),
            'sha256' => hash_file('sha256', $legacyDiskPath),
            'diskPath' => $legacyDiskPath,
        ], ['source' => 'test']);
        \write_store($staged['store'], false);

        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'name' => 'Paciente Video',
            'email' => 'video@example.com',
            'phone' => '0988888888',
            'date' => $futureDate,
            'time' => '11:00',
            'doctor' => 'rosero',
            'service' => 'video',
            'reason' => 'Brote de acne inflamatorio con placas nuevas en el rostro.',
            'affectedArea' => 'rostro',
            'evolutionTime' => '3 semanas',
            'privacyConsent' => true,
            'paymentMethod' => 'cash',
            'casePhotoCount' => 1,
            'casePhotoNames' => ['lesion.jpg'],
            'casePhotoUrls' => ['https://pielarmonia.com/uploads/transfer-proofs/' . $legacyFilename],
            'casePhotoPaths' => [$legacyPath],
            'casePhotoRoles' => ['close-up'],
        ], JSON_UNESCAPED_UNICODE);

        try {
            \AppointmentController::store(['store' => \read_store()]);
            self::fail('Se esperaba TestingExitException');
        } catch (\TestingExitException $e) {
            $this->assertSame(201, $e->status);
            $appointment = $e->payload['data'];
            $this->assertGreaterThan(0, (int) ($appointment['telemedicineIntakeId'] ?? 0));
        }

        $roundtrip = \read_store();
        $this->assertCount(1, $roundtrip['telemedicine_intakes']);
        $this->assertCount(1, $roundtrip['clinical_uploads']);
        $this->assertSame('case_photo', $roundtrip['clinical_uploads'][0]['kind']);
        $this->assertSame('private_clinical', $roundtrip['clinical_uploads'][0]['storageMode']);
        $this->assertSame('primer_plano', $roundtrip['clinical_uploads'][0]['photoRole']);
        $this->assertSame('Primer plano', $roundtrip['clinical_uploads'][0]['photoRoleLabel']);
        $this->assertFileDoesNotExist($legacyDiskPath);

        $this->assertSame('partial', (string) ($roundtrip['telemedicine_intakes'][0]['photoTriage']['status'] ?? ''));
        $this->assertSame(
            ['primer_plano'],
            $roundtrip['telemedicine_intakes'][0]['photoTriage']['roles'] ?? []
        );
        $this->assertSame(
            ['zona', 'contexto'],
            $roundtrip['telemedicine_intakes'][0]['photoTriage']['missingRoles'] ?? []
        );

        $privatePath = $roundtrip['clinical_uploads'][0]['privatePath'];
        $this->assertNotSame('', $privatePath);
        $this->assertFileExists($this->tempDir . DIRECTORY_SEPARATOR . $privatePath);
    }

    private function enableClinicalStorageGate(): void
    {
        putenv('PIELARMONIA_REQUIRE_DATA_ENCRYPTION=1');
        putenv('PIELARMONIA_FORCE_SQLITE_UNAVAILABLE=1');
        putenv('PIELARMONIA_DATA_ENCRYPTION_KEY');

        if (function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }
    }

    private function removeDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }
        $items = array_diff(scandir($dir) ?: [], ['.', '..']);
        foreach ($items as $item) {
            $path = $dir . DIRECTORY_SEPARATOR . $item;
            if (is_dir($path)) {
                $this->removeDirectory($path);
            } else {
                @unlink($path);
            }
        }
        @rmdir($dir);
    }
}
