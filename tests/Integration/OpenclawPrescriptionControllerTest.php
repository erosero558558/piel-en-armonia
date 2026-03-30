<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

if (!function_exists('require_admin_auth')) {
    function require_admin_auth(): void
    {
        $_SESSION['admin_logged_in'] = true;
    }
}

/**
 * @runInSeparateProcess
 */
final class OpenclawPrescriptionControllerTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_POST = [];
        $_SESSION = [
            'admin_logged_in' => true,
            'admin_email' => 'doctor@example.com',
        ];
        $_SERVER = [
            'REQUEST_METHOD' => 'GET',
            'REMOTE_ADDR' => '127.0.0.1',
            'HTTP_HOST' => '127.0.0.1:8011',
        ];

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'openclaw-rx-' . bin2hex(random_bytes(6));
        if (!is_dir($this->tempDir)) {
            mkdir($this->tempDir, 0777, true);
        }

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_SKIP_ENV_FILE=true');
        putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');
        putenv('AURORADERM_PRIMARY_DOCTOR_NAME=Dra. Lucia Andrade');
        putenv('AURORADERM_PRIMARY_DOCTOR_MSP=MSP-45821');
        putenv('AURORADERM_CLINIC_NAME=Aurora Derm');
        putenv('AURORADERM_CLINIC_ADDRESS=Av. Amazonas y Colon, Quito');
        putenv('AURORADERM_CLINIC_PHONE=022500123');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../lib/clinical_history/ClinicalHistoryRepository.php';
        require_once __DIR__ . '/../../controllers/OpenclawController.php';

        $this->seedClinicalRecord();
    }

    protected function tearDown(): void
    {
        foreach ([
            'PIELARMONIA_DATA_DIR',
            'PIELARMONIA_SKIP_ENV_FILE',
            'PIELARMONIA_AVAILABILITY_SOURCE',
            'AURORADERM_PRIMARY_DOCTOR_NAME',
            'AURORADERM_PRIMARY_DOCTOR_MSP',
            'AURORADERM_CLINIC_NAME',
            'AURORADERM_CLINIC_ADDRESS',
            'AURORADERM_CLINIC_PHONE',
        ] as $key) {
            putenv($key);
        }

        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_POST = [];
        $_SESSION = [];
        $_SERVER = [];

        if (function_exists('get_db_connection')) {
            get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
    }

    public function testSavePrescriptionPersistsIssuedSnapshotAndReturnsDownloadArtifacts(): void
    {
        $response = $this->issuePrescription();

        self::assertSame(201, $response['status']);
        self::assertTrue((bool) ($response['payload']['ok'] ?? false));
        self::assertNotSame('', (string) ($response['payload']['prescription_id'] ?? ''));
        self::assertMatchesRegularExpression(
            '/^RX-' . preg_quote(date('Y'), '/') . '-\d{4}$/',
            (string) ($response['payload']['folio'] ?? '')
        );
        self::assertStringContainsString(
            'openclaw-prescription&id=' . (string) ($response['payload']['prescription_id'] ?? ''),
            (string) ($response['payload']['pdf_url'] ?? '')
        );
        self::assertStringContainsString('wa.me', (string) ($response['payload']['whatsapp_url'] ?? ''));

        $store = read_store();
        $prescriptionId = (string) ($response['payload']['prescription_id'] ?? '');
        $record = $store['openclaw_prescriptions'][$prescriptionId] ?? null;

        self::assertIsArray($record);
        self::assertSame('MSP-45821', (string) ($record['doctor']['msp'] ?? ''));
        self::assertStringContainsString('Ana', (string) ($record['patient']['name'] ?? ''));
        self::assertSame('+593981110123', (string) ($record['patient']['phone'] ?? ''));
        self::assertSame(2, count($record['medications'] ?? []));
        self::assertSame(
            'Evitar rascado, usar emoliente cada 8 horas y acudir a control en 72 horas.',
            (string) ($record['careIndications'] ?? '')
        );
    }

    public function testPrescriptionPdfDownloadReturnsPdfPayloadInTestingMode(): void
    {
        $response = $this->issuePrescription();
        $prescriptionId = (string) ($response['payload']['prescription_id'] ?? '');

        $_GET = [
            'id' => $prescriptionId,
            'format' => 'pdf',
        ];

        $download = $this->captureResponse(
            static fn () => \OpenclawController::prescription([])
        );

        self::assertSame(200, $download['status']);
        self::assertTrue((bool) ($download['payload']['ok'] ?? false));
        self::assertSame('application/pdf', (string) ($download['payload']['content_type'] ?? ''));
        self::assertStringContainsString('receta-RX-', (string) ($download['payload']['filename'] ?? ''));

        $pdfRaw = base64_decode((string) ($download['payload']['pdf_base64'] ?? ''), true);
        self::assertIsString($pdfRaw);
        self::assertStringStartsWith('%PDF-', $pdfRaw);

        $document = is_array($download['payload']['document'] ?? null) ? $download['payload']['document'] : [];
        self::assertSame('Dra. Lucia Andrade', (string) ($document['doctor']['name'] ?? ''));
        self::assertSame('MSP-45821', (string) ($document['doctor']['msp'] ?? ''));
        self::assertSame(2, count($document['medications'] ?? []));
        self::assertSame(
            'Evitar rascado, usar emoliente cada 8 horas y acudir a control en 72 horas.',
            (string) ($document['careIndications'] ?? '')
        );
    }

    private function issuePrescription(): array
    {
        return $this->captureResponse(
            static fn () => \OpenclawController::savePrescription([]),
            'POST',
            [
                'case_id' => 'case-rx-001',
                'medications' => [
                    [
                        'name' => 'Prednisona',
                        'dose' => '20 mg',
                        'frequency' => 'Cada 12 horas',
                        'duration' => '5 dias',
                        'instructions' => 'Tomar despues de alimentos.',
                    ],
                    [
                        'name' => 'Cetirizina',
                        'dose' => '10 mg',
                        'frequency' => 'Cada noche',
                        'duration' => '10 dias',
                        'instructions' => 'Evitar alcohol.',
                    ],
                ],
            ]
        );
    }

    private function seedClinicalRecord(): void
    {
        $session = ClinicalHistoryRepository::defaultSession([
            'sessionId' => 'chs-rx-001',
            'caseId' => 'case-rx-001',
            'surface' => 'admin',
            'status' => 'active',
            'patient' => [
                'name' => 'Ana Perez',
                'email' => 'ana@example.com',
                'phone' => '+593981110123',
                'birthDate' => '1994-04-03',
                'sexAtBirth' => 'femenino',
                'documentType' => 'CEDULA',
                'documentNumber' => '1717171717',
            ],
        ]);

        $draft = ClinicalHistoryRepository::defaultDraft($session, [
            'draftId' => 'chd-rx-001',
            'sessionId' => 'chs-rx-001',
            'caseId' => 'case-rx-001',
            'patientRecordId' => 'HCU-0001',
            'requiresHumanReview' => false,
            'reviewStatus' => 'ready',
            'intake' => [
                'motivoConsulta' => 'Placas pruriginosas',
                'enfermedadActual' => 'Brotes en flexuras desde hace 2 semanas.',
                'alergias' => 'Alergia a penicilina',
                'medicacionActual' => 'Cetirizina',
                'datosPaciente' => [
                    'edadAnios' => 31,
                    'sexoBiologico' => 'femenino',
                    'telefono' => '+593981110123',
                    'fechaNacimiento' => '1994-04-03',
                ],
            ],
            'admission001' => [
                'identity' => [
                    'primerNombre' => 'Ana',
                    'segundoNombre' => 'Maria',
                    'apellidoPaterno' => 'Perez',
                    'apellidoMaterno' => 'Loja',
                    'documentType' => 'CEDULA',
                    'documentNumber' => '1717171717',
                ],
                'demographics' => [
                    'ageYears' => 31,
                    'sexAtBirth' => 'femenino',
                    'birthDate' => '1994-04-03',
                ],
                'residence' => [
                    'phone' => '+593981110123',
                    'address' => 'Quito',
                ],
            ],
            'clinicianDraft' => [
                'cie10Sugeridos' => ['L20.9'],
                'hcu005' => [
                    'diagnosticImpression' => 'Dermatitis atopica en brote',
                    'therapeuticPlan' => 'Corticoide oral por 5 dias y antihistaminico nocturno.',
                    'careIndications' => 'Evitar rascado, usar emoliente cada 8 horas y acudir a control en 72 horas.',
                    'prescriptionItems' => [],
                ],
            ],
        ]);

        $store = read_store();
        $store['clinical_history_sessions'] = [$session];
        $store['clinical_history_drafts'] = [$draft];
        $store['doctors'] = [
            'doc-main' => [
                'name' => 'Dra. Lucia Andrade',
                'specialty' => 'Dermatologia',
                'msp' => 'MSP-45821',
            ],
        ];

        write_store($store, false);
    }

    private function captureResponse(callable $callable, string $method = 'GET', ?array $body = null): array
    {
        $_SERVER['REQUEST_METHOD'] = strtoupper($method);

        if ($body !== null) {
            $GLOBALS['__TEST_JSON_BODY'] = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } else {
            unset($GLOBALS['__TEST_JSON_BODY']);
        }

        try {
            $callable();
            self::fail('Expected TestingExitException');
        } catch (TestingExitException $exception) {
            return [
                'payload' => is_array($exception->payload) ? $exception->payload : [],
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
