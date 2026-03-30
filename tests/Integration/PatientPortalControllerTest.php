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
            'doctorAssigned' => 'dra ana rosero',
            'date' => '2099-04-02',
            'time' => '10:30',
            'name' => 'Lucia Portal',
            'email' => 'lucia@example.com',
            'phone' => '0991234567',
            'patientId' => 'pt_lucia_001',
            'patientCaseId' => 'pc_lucia_001',
            'status' => 'confirmed',
            'visitMode' => 'in_person',
            'dateBooked' => '2026-03-30T10:00:00-05:00',
        ]);
        $store['appointments'][] = \normalize_appointment([
            'id' => 89,
            'service' => 'consulta',
            'doctor' => 'rosero',
            'doctorAssigned' => 'dra ana rosero',
            'date' => '2026-03-12',
            'time' => '09:00',
            'name' => 'Lucia Portal',
            'email' => 'lucia@example.com',
            'phone' => '0991234567',
            'patientId' => 'pt_lucia_001',
            'patientCaseId' => 'pc_lucia_002',
            'status' => 'completed',
            'visitMode' => 'in_person',
            'dateBooked' => '2026-03-11T08:00:00-05:00',
        ]);
        $store['appointments'][] = \normalize_appointment([
            'id' => 90,
            'service' => 'control',
            'doctor' => 'rosero',
            'doctorAssigned' => 'dra ana rosero',
            'date' => '2026-03-18',
            'time' => '16:15',
            'name' => 'Lucia Portal',
            'email' => 'lucia@example.com',
            'phone' => '0991234567',
            'patientId' => 'pt_lucia_001',
            'patientCaseId' => 'pc_lucia_003',
            'status' => 'completed',
            'visitMode' => 'in_person',
            'dateBooked' => '2026-03-18T15:00:00-05:00',
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
        $store['patient_cases'][] = [
            'id' => 'pc_lucia_002',
            'tenantId' => 'aurora-derm',
            'patientId' => 'pt_lucia_001',
            'status' => 'completed',
            'latestActivityAt' => '2026-03-12T10:00:00-05:00',
            'summary' => [
                'patientLabel' => 'Lucia Portal',
                'contactPhone' => '0991234567',
                'serviceName' => 'Consulta Dermatológica',
            ],
        ];
        $store['patient_cases'][] = [
            'id' => 'pc_lucia_003',
            'tenantId' => 'aurora-derm',
            'patientId' => 'pt_lucia_001',
            'status' => 'completed',
            'latestActivityAt' => '2026-03-18T18:00:00-05:00',
            'summary' => [
                'patientLabel' => 'Lucia Portal',
                'contactPhone' => '0991234567',
                'serviceName' => 'Control dermatológico',
            ],
        ];
        $store['patient_cases'][] = [
            'id' => 'pc_other_001',
            'tenantId' => 'aurora-derm',
            'patientId' => 'pt_other_001',
            'status' => 'completed',
            'latestActivityAt' => '2026-03-10T09:00:00-05:00',
            'summary' => [
                'patientLabel' => 'Paciente Ajeno',
                'contactPhone' => '0988888888',
            ],
        ];
        $store['patients']['pc_lucia_002'] = [
            'firstName' => 'Lucia',
            'lastName' => 'Portal',
            'phone' => '0991234567',
            'ci' => '0102030405',
        ];
        $store['patients']['pc_lucia_003'] = [
            'firstName' => 'Lucia',
            'lastName' => 'Portal',
            'phone' => '0991234567',
            'ci' => '0102030405',
        ];
        $store['patients']['pc_other_001'] = [
            'firstName' => 'Paciente',
            'lastName' => 'Ajeno',
            'phone' => '0988888888',
            'ci' => '1790011122',
        ];
        $store['prescriptions']['rx_portal_002'] = [
            'id' => 'rx_portal_002',
            'caseId' => 'pc_lucia_002',
            'medications' => [[
                'medication' => 'Doxiciclina 100 mg',
                'dose' => '1 cápsula',
                'frequency' => 'cada 12 horas',
                'duration' => '14 días',
                'instructions' => 'Tomar después del desayuno y la cena.',
            ]],
            'issued_at' => '2026-03-12T14:10:00-05:00',
            'issued_by' => 'Dra Ana Rosero',
            'doctor' => [
                'name' => 'Dra Ana Rosero',
                'specialty' => 'Dermatología',
                'msp' => '12345',
            ],
        ];
        $store['prescriptions']['rx_other_001'] = [
            'id' => 'rx_other_001',
            'caseId' => 'pc_other_001',
            'medications' => [[
                'medication' => 'Prednisona 10 mg',
                'dose' => '1 tableta',
                'frequency' => 'cada 24 horas',
                'duration' => '5 días',
                'instructions' => 'Tomar después del desayuno.',
            ]],
            'issued_at' => '2026-03-10T10:00:00-05:00',
            'issued_by' => 'Dr Otro',
        ];
        $store['certificates']['cert_portal_003'] = [
            'id' => 'cert_portal_003',
            'folio' => 'AD-2026-00021',
            'caseId' => 'pc_lucia_003',
            'type' => 'reposo_laboral',
            'typeLabel' => 'CERTIFICADO DE REPOSO',
            'restDays' => 3,
            'diagnosisText' => 'Dermatitis irritativa',
            'restrictions' => 'Reposo relativo por 72 horas',
            'observations' => 'Control recomendado al tercer día',
            'issuedAt' => '2026-03-18T17:15:00-05:00',
            'doctor' => [
                'name' => 'Dra Ana Rosero',
                'specialty' => 'Dermatología',
                'msp' => '12345',
            ],
            'clinicName' => 'Aurora Derm',
            'clinicAddress' => 'Quito, Ecuador',
            'clinicPhone' => '0999999999',
            'patient' => [
                'name' => 'Lucia Portal',
                'identification' => '0102030405',
            ],
        ];
        $store['clinical_history_drafts'][] = [
            'draftId' => 'chd_portal_003',
            'sessionId' => 'chs_portal_003',
            'caseId' => 'pc_lucia_003',
            'appointmentId' => 90,
            'status' => 'draft',
            'reviewStatus' => 'pending_review',
            'documents' => [
                'prescription' => [
                    'status' => 'issued',
                    'items' => [[
                        'medication' => 'Cetirizina 10 mg',
                        'instructions' => 'Tomar una vez al día durante 7 días.',
                    ]],
                ],
                'certificate' => [
                    'status' => 'issued',
                    'summary' => 'Reposo por 3 días',
                    'restDays' => 3,
                ],
            ],
            'updatedAt' => '2026-03-18T18:20:00-05:00',
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
        self::assertSame('******4567', (string) ($start['payload']['data']['maskedPhone'] ?? ''));
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

    public function testDashboardReturnsNextAppointmentSummaryForAuthenticatedPatient(): void
    {
        $token = $this->authenticatePortalSession();

        $_SERVER['REQUEST_METHOD'] = 'GET';
        $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $token;

        $dashboard = $this->captureJsonResponse(function (): void {
            \PatientPortalController::dashboard(['store' => \read_store()]);
        });

        self::assertSame(200, $dashboard['status']);
        self::assertTrue((bool) ($dashboard['payload']['ok'] ?? false));
        self::assertTrue((bool) ($dashboard['payload']['data']['authenticated'] ?? false));
        self::assertSame(
            'Lucia Portal',
            (string) ($dashboard['payload']['data']['patient']['name'] ?? '')
        );
        self::assertSame(
            '2 abr 2099',
            substr((string) ($dashboard['payload']['data']['nextAppointment']['dateLabel'] ?? ''), 4)
        );
        self::assertSame(
            '10:30',
            (string) ($dashboard['payload']['data']['nextAppointment']['timeLabel'] ?? '')
        );
        self::assertSame(
            'Dra Ana Rosero',
            (string) ($dashboard['payload']['data']['nextAppointment']['doctorName'] ?? '')
        );
        self::assertSame(
            'Consulta presencial',
            (string) ($dashboard['payload']['data']['nextAppointment']['appointmentTypeLabel'] ?? '')
        );
        self::assertSame(
            'Consulta Dermatológica',
            (string) ($dashboard['payload']['data']['nextAppointment']['serviceName'] ?? '')
        );
        self::assertStringContainsString(
            'Llega 10 minutos antes',
            (string) ($dashboard['payload']['data']['nextAppointment']['preparation'] ?? '')
        );
        self::assertStringContainsString(
            '/?reschedule=',
            (string) ($dashboard['payload']['data']['nextAppointment']['rescheduleUrl'] ?? '')
        );
        self::assertStringContainsString(
            'https://wa.me/',
            (string) ($dashboard['payload']['data']['nextAppointment']['whatsappUrl'] ?? '')
        );
    }

    public function testDashboardRejectsMissingPortalSession(): void
    {
        $_SERVER['REQUEST_METHOD'] = 'GET';
        unset($_SERVER['HTTP_AUTHORIZATION']);

        $dashboard = $this->captureJsonResponse(function (): void {
            \PatientPortalController::dashboard(['store' => \read_store()]);
        });

        self::assertSame(401, $dashboard['status']);
        self::assertFalse((bool) ($dashboard['payload']['ok'] ?? true));
        self::assertSame(
            'patient_portal_auth_required',
            (string) ($dashboard['payload']['code'] ?? '')
        );
    }

    public function testHistoryReturnsPortalDocumentStatusesForAuthenticatedPatient(): void
    {
        $token = $this->authenticatePortalSession();

        $_SERVER['REQUEST_METHOD'] = 'GET';
        $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $token;

        $history = $this->captureJsonResponse(function (): void {
            \PatientPortalController::history(['store' => \read_store()]);
        });

        self::assertSame(200, $history['status']);
        self::assertTrue((bool) ($history['payload']['ok'] ?? false));

        $consultations = $history['payload']['data']['consultations'] ?? null;
        self::assertIsArray($consultations);
        self::assertCount(2, $consultations);

        $first = $this->findConsultationByCaseId($consultations, 'pc_lucia_003');
        $second = $this->findConsultationByCaseId($consultations, 'pc_lucia_002');

        self::assertSame('pending', (string) ($first['documents']['prescription']['status'] ?? ''));
        self::assertSame('available', (string) ($first['documents']['certificate']['status'] ?? ''));
        self::assertStringContainsString(
            'patient-portal-document&type=certificate&id=cert_portal_003',
            (string) ($first['documents']['certificate']['downloadUrl'] ?? '')
        );

        self::assertSame('available', (string) ($second['documents']['prescription']['status'] ?? ''));
        self::assertStringContainsString(
            'patient-portal-document&type=prescription&id=rx_portal_002',
            (string) ($second['documents']['prescription']['downloadUrl'] ?? '')
        );
        self::assertSame('not_issued', (string) ($second['documents']['certificate']['status'] ?? ''));
    }

    public function testDocumentEndpointReturnsPdfBinaryForOwnedCertificate(): void
    {
        $token = $this->authenticatePortalSession();

        $_SERVER['REQUEST_METHOD'] = 'GET';
        $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $token;
        $_GET['type'] = 'certificate';
        $_GET['id'] = 'cert_portal_003';

        $document = $this->captureJsonResponse(function (): void {
            \PatientPortalController::document(['store' => \read_store()]);
        });

        self::assertSame(200, $document['status']);
        self::assertTrue((bool) ($document['payload']['ok'] ?? false));
        self::assertSame('pdf', (string) ($document['payload']['format'] ?? ''));
        self::assertSame('application/pdf', (string) ($document['payload']['contentType'] ?? ''));
        self::assertStringContainsString('certificado-', (string) ($document['payload']['filename'] ?? ''));
        self::assertGreaterThan(100, (int) ($document['payload']['contentLength'] ?? 0));
        self::assertStringStartsWith('%PDF-', (string) ($document['payload']['binary'] ?? ''));
    }

    public function testDocumentEndpointRejectsForeignPortalPrescription(): void
    {
        $token = $this->authenticatePortalSession();

        $_SERVER['REQUEST_METHOD'] = 'GET';
        $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $token;
        $_GET['type'] = 'prescription';
        $_GET['id'] = 'rx_other_001';

        $document = $this->captureJsonResponse(function (): void {
            \PatientPortalController::document(['store' => \read_store()]);
        });

        self::assertSame(404, $document['status']);
        self::assertFalse((bool) ($document['payload']['ok'] ?? true));
        self::assertStringContainsString(
            'Documento no disponible',
            (string) ($document['payload']['error'] ?? '')
        );
    }

    private function authenticatePortalSession(): string
    {
        $start = $this->captureJsonResponse(function (): void {
            $GLOBALS['__TEST_JSON_BODY'] = json_encode([
                'phone' => '0991234567',
            ], JSON_UNESCAPED_UNICODE);
            \PatientPortalController::start(['store' => \read_store()]);
        });

        $outbox = \whatsapp_openclaw_repository()->listPendingOutbox(10);
        self::assertCount(1, $outbox);
        preg_match('/\*(\d{6})\*/', (string) (($outbox[0]['payload']['text'] ?? '')), $matches);
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

        return (string) ($complete['payload']['data']['token'] ?? '');
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

    private function findConsultationByCaseId(array $consultations, string $caseId): array
    {
        foreach ($consultations as $consultation) {
            if ((string) ($consultation['caseId'] ?? '') === $caseId) {
                return $consultation;
            }
        }

        self::fail('Consultation for case ' . $caseId . ' was not found.');
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
