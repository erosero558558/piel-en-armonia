<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
final class CertificateControllerPdfTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_SESSION = [
            'admin_logged_in' => true,
        ];
        $_SERVER = [
            'REMOTE_ADDR' => '127.0.0.1',
            'REQUEST_METHOD' => 'GET',
        ];

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'certificate-pdf-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0777, true);

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../controllers/CertificateController.php';

        \ensure_data_file();

        \write_clinic_profile([
            'clinicName' => 'Aurora Derm Centro Dermatologico',
            'address' => 'Av. 6 de Diciembre y Portugal',
            'phone' => '+593 2 600 0000',
            'logoImage' => '',
        ]);
        \write_doctor_profile([
            'fullName' => 'Dra. Aurora Demo',
            'specialty' => 'Dermatologia clinica',
            'mspNumber' => 'MSP-445566',
            'signatureImage' => '',
            'updatedAt' => '2026-03-30T09:00:00-05:00',
        ]);
        \write_store([
            'patient_cases' => [
                [
                    'id' => 'CASE-CERT-001',
                    'patientId' => 'pt-cert-001',
                    'ci' => '1712345678',
                    'phone' => '+593999111222',
                    'birthDate' => '1990-04-10',
                    'summary' => [
                        'patientLabel' => 'Lucia Perez',
                        'contactPhone' => '+593999111222',
                        'patientDocumentNumber' => '1712345678',
                    ],
                ],
            ],
            'certificates' => [],
            '_last_cert_folio' => 0,
        ]);
    }

    protected function tearDown(): void
    {
        putenv('PIELARMONIA_DATA_DIR');
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_SESSION = [];
        $_SERVER = [];

        if (\function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
    }

    public function testCertificatePdfEndpointReturnsRealPdfBinaryWhenDompdfIsAvailable(): void
    {
        self::assertFileExists(
            __DIR__ . '/../../vendor/dompdf/dompdf/src/Dompdf.php',
            'dompdf debe estar instalada para esta prueba.'
        );

        $_SERVER['REQUEST_METHOD'] = 'POST';
        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'case_id' => 'CASE-CERT-001',
            'type' => 'reposo_laboral',
            'rest_days' => 3,
            'diagnosis_text' => 'Dermatitis de contacto',
            'cie10_code' => 'L23.9',
            'observations' => 'Reposo y control en 72 horas.',
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $createResponse = $this->captureResponse(static function (): void {
            \CertificateController::store([
                'isAdmin' => true,
            ]);
        });

        $this->assertSame(200, $createResponse['status']);
        $this->assertTrue($createResponse['payload']['ok']);

        $pdfBase64 = (string) ($createResponse['payload']['pdf_base64'] ?? '');
        $createdPdf = base64_decode($pdfBase64, true);
        $this->assertIsString($createdPdf);
        $this->assertStringStartsWith('%PDF', $createdPdf);

        $certificateId = (string) ($createResponse['payload']['certificate_id'] ?? '');
        $this->assertNotSame('', $certificateId);

        $_SERVER['REQUEST_METHOD'] = 'GET';
        $_GET = [
            'id' => $certificateId,
            'format' => 'pdf',
        ];

        $serveResponse = $this->captureResponse(static function (): void {
            \CertificateController::index([
                'isAdmin' => true,
            ]);
        });

        $this->assertSame(200, $serveResponse['status']);
        $this->assertSame(
            'application/pdf',
            (string) ($serveResponse['payload']['contentType'] ?? '')
        );
        $this->assertStringContainsString(
            '.pdf',
            (string) ($serveResponse['payload']['filename'] ?? '')
        );

        $binary = (string) ($serveResponse['payload']['binary'] ?? '');
        $this->assertStringStartsWith('%PDF', $binary);
        $this->assertGreaterThan(2000, strlen($binary));
    }

    /**
     * @return array{payload: array<string,mixed>, status: int}
     */
    private function captureResponse(callable $callable): array
    {
        try {
            $callable();
            self::fail('Expected TestingExitException');
        } catch (\TestingExitException $exception) {
            return [
                'payload' => is_array($exception->payload)
                    ? $exception->payload
                    : [],
                'status' => (int) $exception->status,
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
