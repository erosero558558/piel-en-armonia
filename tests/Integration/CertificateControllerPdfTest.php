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

        $createResponse = $this->issueCertificate([
            'rest_days' => 3,
            'diagnosis_text' => 'Dermatitis de contacto',
            'cie10_code' => 'L23.9',
            'observations' => 'Reposo y control en 72 horas.',
        ]);

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

    public function testCertificateIndexListsCertificatesByCaseSortedNewestFirst(): void
    {
        $firstResponse = $this->issueCertificate([
            'rest_days' => 2,
            'diagnosis_text' => 'Rosacea papulopustulosa',
            'cie10_code' => 'L71.9',
            'observations' => 'Control en una semana.',
        ]);
        usleep(1100000);
        $secondResponse = $this->issueCertificate([
            'rest_days' => 5,
            'diagnosis_text' => 'Dermatitis atopica',
            'cie10_code' => 'L20.9',
            'observations' => 'Reposo y seguimiento fotografico.',
        ]);

        $firstCertificateId = (string) ($firstResponse['payload']['certificate_id'] ?? '');
        $secondCertificateId = (string) ($secondResponse['payload']['certificate_id'] ?? '');

        $_SERVER['REQUEST_METHOD'] = 'GET';
        $_GET = [
            'case_id' => 'CASE-CERT-001',
        ];

        $listResponse = $this->captureResponse(static function (): void {
            \CertificateController::index([
                'isAdmin' => true,
            ]);
        });

        $this->assertSame(200, $listResponse['status']);
        $this->assertTrue($listResponse['payload']['ok']);

        $certificates = $listResponse['payload']['certificates'] ?? null;
        $this->assertIsArray($certificates);
        $this->assertCount(2, $certificates);
        $this->assertSame($secondCertificateId, (string) ($certificates[0]['id'] ?? ''));
        $this->assertSame($firstCertificateId, (string) ($certificates[1]['id'] ?? ''));
        $this->assertSame('CASE-CERT-001', (string) ($certificates[0]['caseId'] ?? ''));
        $this->assertSame(
            'CERTIFICADO DE REPOSO',
            (string) ($certificates[0]['typeLabel'] ?? '')
        );
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

    /**
     * @param array<string,mixed> $overrides
     * @return array{payload: array<string,mixed>, status: int}
     */
    private function issueCertificate(array $overrides = []): array
    {
        $_SERVER['REQUEST_METHOD'] = 'POST';
        $GLOBALS['__TEST_JSON_BODY'] = json_encode(
            array_merge([
                'case_id' => 'CASE-CERT-001',
                'type' => 'reposo_laboral',
                'rest_days' => 1,
                'diagnosis_text' => 'Dermatitis de contacto',
                'cie10_code' => 'L23.9',
                'observations' => '',
            ], $overrides),
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        );

        return $this->captureResponse(static function (): void {
            \CertificateController::store([
                'isAdmin' => true,
            ]);
        });
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
