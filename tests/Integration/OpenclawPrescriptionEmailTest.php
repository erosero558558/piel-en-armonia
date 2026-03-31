<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 * @preserveGlobalState disabled
 */
final class OpenclawPrescriptionEmailTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_EMAIL_OUTBOX'], $GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_POST = [];
        $_FILES = [];
        $_SESSION = [
            'admin_logged_in' => true,
            'admin_email' => 'dra.aurora@example.com',
        ];
        $_SERVER = [
            'REQUEST_METHOD' => 'POST',
            'REMOTE_ADDR' => '127.0.0.1',
            'HTTP_HOST' => '127.0.0.1:8011',
        ];

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'openclaw-prescription-email-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0777, true);

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('AURORADERM_SKIP_ENV_FILE=1');
        putenv('PIELARMONIA_SKIP_ENV_FILE=1');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../lib/ClinicProfileStore.php';
        require_once __DIR__ . '/../../lib/DoctorProfileStore.php';
        require_once __DIR__ . '/../../lib/clinical_history/ClinicalHistoryRepository.php';
        require_once __DIR__ . '/../../controllers/OpenclawController.php';

        \ensure_data_file();

        \write_clinic_profile([
            'clinicName' => 'Aurora Derm Centro Dermatologico',
            'address' => 'Av. Demo 123, Quito',
            'phone' => '0991112233',
            'logoImage' => '',
            'software_plan' => 'Pro',
        ]);
        \write_doctor_profile([
            'fullName' => 'Dra. Aurora Demo',
            'specialty' => 'Dermatologia clinica',
            'mspNumber' => 'MSP-445566',
            'signatureImage' => '',
            'updatedAt' => '2026-03-31T08:00:00-05:00',
        ]);

        $caseId = 'pc_openclaw_rx_001';
        $session = \ClinicalHistoryRepository::defaultSession([
            'id' => 401,
            'sessionId' => 'chs_openclaw_rx_001',
            'caseId' => $caseId,
            'appointmentId' => 9101,
            'surface' => 'admin',
            'status' => 'active',
            'patient' => [
                'name' => 'Lucia Demo',
                'email' => 'lucia.demo@example.com',
                'phone' => '0995556677',
                'documentNumber' => '0102030405',
            ],
            'createdAt' => '2026-03-31T09:00:00-05:00',
            'updatedAt' => '2026-03-31T09:15:00-05:00',
        ]);
        $draft = \ClinicalHistoryRepository::defaultDraft($session, [
            'id' => 402,
            'draftId' => 'chd_openclaw_rx_001',
            'caseId' => $caseId,
            'appointmentId' => 9101,
            'requiresHumanReview' => false,
            'reviewStatus' => 'ready_for_review',
            'status' => 'draft',
            'clinicianDraft' => [
                'hcu005' => [
                    'prescriptionItems' => [],
                ],
            ],
            'documents' => [
                'prescription' => [
                    'items' => [],
                    'medication' => '',
                    'directions' => '',
                    'status' => 'draft',
                ],
            ],
            'createdAt' => '2026-03-31T09:00:00-05:00',
            'updatedAt' => '2026-03-31T09:15:00-05:00',
        ]);

        $store = \read_store();
        $store['patient_cases'][] = [
            'id' => $caseId,
            'patientId' => 'pt_openclaw_rx_001',
            'status' => 'completed',
            'latestActivityAt' => '2026-03-31T09:15:00-05:00',
            'summary' => [
                'patientLabel' => 'Lucia Demo',
                'contactPhone' => '0995556677',
                'contactEmail' => 'lucia.demo@example.com',
                'serviceName' => 'Consulta Dermatologica',
            ],
        ];
        $store['patients'][$caseId] = [
            'firstName' => 'Lucia',
            'lastName' => 'Demo',
            'ci' => '0102030405',
            'birthDate' => '1990-04-10',
            'phone' => '0995556677',
        ];
        $store['appointments'][] = \normalize_appointment([
            'id' => 9101,
            'patientCaseId' => $caseId,
            'patientId' => 'pt_openclaw_rx_001',
            'name' => 'Lucia Demo',
            'email' => 'lucia.demo@example.com',
            'phone' => '0995556677',
            'service' => 'consulta',
            'serviceName' => 'Consulta Dermatologica',
            'doctor' => 'rosero',
            'date' => '2026-03-31',
            'time' => '09:00',
            'status' => 'completed',
        ]);
        $store['clinical_history_sessions'] = [$session];
        $store['clinical_history_drafts'] = [$draft];
        $store['prescriptions'] = [];

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

        if (\function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
        unset($GLOBALS['__TEST_EMAIL_OUTBOX'], $GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_POST = [];
        $_FILES = [];
        $_SESSION = [];
        $_SERVER = [];
    }

    public function testSavePrescriptionPersistsRecordAndSendsBrandedEmail(): void
    {
        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'case_id' => 'pc_openclaw_rx_001',
            'medications' => [[
                'medication' => 'Doxiciclina 100 mg',
                'dose' => '1 capsula',
                'frequency' => 'cada 12 horas',
                'duration' => '14 dias',
                'instructions' => 'Tomar despues de alimentos.',
            ]],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        try {
            \OpenclawController::savePrescription([]);
            self::fail('Expected TestingExitException');
        } catch (\TestingExitException $exception) {
            $payload = is_array($exception->payload) ? $exception->payload : [];
            $status = (int) $exception->status;
        } finally {
            unset($GLOBALS['__TEST_JSON_BODY']);
        }

        self::assertSame(200, $status);
        self::assertTrue((bool) ($payload['ok'] ?? false));
        self::assertTrue((bool) ($payload['email_sent'] ?? false));

        $prescriptionId = (string) ($payload['prescription_id'] ?? '');
        self::assertNotSame('', $prescriptionId);
        self::assertStringContainsString($prescriptionId, (string) ($payload['pdf_url'] ?? ''));

        $store = \read_store();
        self::assertArrayHasKey($prescriptionId, $store['prescriptions']);
        self::assertSame('pc_openclaw_rx_001', (string) ($store['prescriptions'][$prescriptionId]['caseId'] ?? ''));
        self::assertNotSame('', (string) ($store['prescriptions'][$prescriptionId]['emailSentAt'] ?? ''));
        self::assertSame('email', (string) ($store['prescriptions'][$prescriptionId]['emailChannel'] ?? ''));
        self::assertSame(
            'Doxiciclina 100 mg',
            (string) ($store['prescriptions'][$prescriptionId]['medications'][0]['medication'] ?? '')
        );

        $outbox = $GLOBALS['__TEST_EMAIL_OUTBOX'] ?? [];
        self::assertCount(1, $outbox);
        self::assertSame('lucia.demo@example.com', (string) ($outbox[0]['to'] ?? ''));
        self::assertSame(\build_email_subject('Tu receta esta lista'), (string) ($outbox[0]['subject'] ?? ''));
        self::assertTrue((bool) ($outbox[0]['isHtml'] ?? false));
        self::assertSame(1, (int) ($outbox[0]['attachmentsCount'] ?? 0));
        self::assertSame(
            'receta-' . $prescriptionId . '.pdf',
            (string) (($outbox[0]['attachments'][0]['name'] ?? ''))
        );
        self::assertStringContainsString('Tu receta ya está lista', (string) ($outbox[0]['body'] ?? ''));
        self::assertStringContainsString('/es/portal/receta/', (string) ($outbox[0]['body'] ?? ''));
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
