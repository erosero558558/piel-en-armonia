<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 * @preserveGlobalState disabled
 */
final class PatientCaseFlowTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_SERVER = [
            'REMOTE_ADDR' => '127.0.0.1',
            'REQUEST_METHOD' => 'GET',
        ];

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'patient-case-flow-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0777, true);

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('AURORADERM_SKIP_ENV_FILE=1');
        putenv('PIELARMONIA_SKIP_ENV_FILE=1');
        putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');
        ini_set('log_errors', '1');
        ini_set('error_log', $this->tempDir . DIRECTORY_SEPARATOR . 'php-error.log');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../lib/BookingService.php';
        require_once __DIR__ . '/../../lib/QueueService.php';
        require_once __DIR__ . '/../../controllers/AdminDataController.php';
        require_once __DIR__ . '/../../controllers/FlowOsController.php';
        require_once __DIR__ . '/../../controllers/HealthController.php';
        require_once __DIR__ . '/../../controllers/PatientCaseController.php';

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
        ] as $key) {
            putenv($key);
        }

        if (\function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_SERVER = [];
    }

    public function testBookingAndQueueLifecycleHydratesSinglePatientCase(): void
    {
        $futureDate = date('Y-m-d', strtotime('+2 day'));
        $store = \read_store();
        $store['availability'][$futureDate] = ['09:00', '09:30'];
        \write_store($store, false);

        $bookingService = new \BookingService();
        $create = $bookingService->create(\read_store(), [
            'name' => 'Paciente Canonico',
            'email' => 'paciente@example.com',
            'phone' => '0991234567',
            'date' => $futureDate,
            'time' => '09:00',
            'doctor' => 'rosero',
            'service' => 'consulta',
            'privacyConsent' => true,
            'paymentMethod' => 'cash',
        ]);

        $this->assertTrue(
            $create['ok'],
            is_string($create['error'] ?? null)
                ? (string) $create['error']
                : json_encode($create, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
        );
        $appointment = $create['data'];
        $this->assertNotSame('', (string) ($appointment['patientCaseId'] ?? ''));
        \write_store($create['store'], false);

        $store = \read_store();
        $this->assertSame(1, count($store['patient_cases'] ?? []));
        $this->assertSame('booked', (string) ($store['patient_cases'][0]['status'] ?? ''));
        $this->assertSame(
            (string) ($appointment['patientCaseId'] ?? ''),
            (string) ($store['appointments'][0]['patientCaseId'] ?? '')
        );

        $queueService = new \QueueService();
        $checkIn = $queueService->checkInAppointment($store, [
            'telefono' => '0991234567',
            'hora' => '09:00',
            'fecha' => $futureDate,
        ], 'kiosk');
        $this->assertTrue($checkIn['ok']);
        $this->assertFalse((bool) ($checkIn['replay'] ?? true));
        $this->assertSame(
            (string) ($appointment['patientCaseId'] ?? ''),
            (string) ($checkIn['ticket']['patientCaseId'] ?? '')
        );
        \write_store($checkIn['store'], false);

        $store = \read_store();
        $this->assertSame('checked_in', (string) ($store['patient_cases'][0]['status'] ?? ''));

        $call = $queueService->callNext($store, 1);
        $this->assertTrue($call['ok']);
        \write_store($call['store'], false);

        $store = \read_store();
        $this->assertSame('called', (string) ($store['patient_cases'][0]['status'] ?? ''));

        $complete = $queueService->patchTicket($store, [
            'id' => (int) ($call['ticket']['id'] ?? 0),
            'action' => 'completar',
        ]);
        $this->assertTrue($complete['ok']);
        \write_store($complete['store'], false);

        $store = \read_store();
        $case = $store['patient_cases'][0] ?? [];
        $timeline = $store['patient_case_timeline_events'] ?? [];

        $this->assertSame('completed', (string) ($case['status'] ?? ''));
        $this->assertNotSame('', (string) ($case['closedAt'] ?? ''));
        $this->assertSame(
            (string) ($appointment['patientCaseId'] ?? ''),
            (string) ($store['queue_tickets'][0]['patientCaseId'] ?? '')
        );
        $this->assertGreaterThanOrEqual(4, count($timeline));
        $this->assertContains('queue_called', array_column($timeline, 'type'));
        $this->assertContains('visit_completed', array_column($timeline, 'type'));

        $journey = \flow_os_build_store_journey_preview($store);
        $journeyCase = $this->findJourneyCaseByCaseId(
            $journey['cases'] ?? [],
            (string) ($appointment['patientCaseId'] ?? '')
        );
        $this->assertNotNull($journeyCase);
        $this->assertSame('care_plan_ready', (string) ($journeyCase['stage'] ?? ''));
        $this->assertSame('care_plan', (string) ($journeyCase['displayStage'] ?? ''));
        $journeyHistory = is_array($journeyCase['journeyHistory'] ?? null)
            ? $journeyCase['journeyHistory']
            : [];
        $this->assertGreaterThanOrEqual(3, count($journeyHistory));
        $this->assertSame(
            ['lead_captured', 'scheduled', 'care_plan_ready'],
            array_column(array_slice($journeyHistory, 0, 3), 'stage')
        );
        $this->assertContains(
            (string) (($journeyHistory[2]['sourceLabel'] ?? '')),
            ['Paciente llamado a consultorio', 'Turno completado']
        );
        $this->assertTrue((bool) ($journeyHistory[2]['isCurrentStage'] ?? false));
        $this->assertSame('care_plan_ready', (string) ($journey['stage'] ?? ''));
        $this->assertNotEmpty($journey['activityFeed'] ?? []);
        $this->assertSame(
            'care_plan_ready',
            (string) (($journey['activityFeed'][0]['stage'] ?? ''))
        );
        $this->assertContains(
            (string) (($journey['activityFeed'][0]['actorLabel'] ?? '')),
            ['Consultorio', 'Clínico']
        );
        $this->assertNotSame(
            '',
            (string) (($journey['activityFeed'][0]['timestamp'] ?? ''))
        );
    }

    public function testAdminAndHealthExposePatientFlowReadModels(): void
    {
        $ticketCode = 'Z-901';
        $store = \read_store();
        $store['queue_tickets'][] = \normalize_queue_ticket([
            'id' => 91001,
            'ticketCode' => $ticketCode,
            'dailySeq' => 1,
            'queueType' => 'walk_in',
            'patientInitials' => 'EC',
            'status' => 'waiting',
            'createdAt' => date('c'),
            'createdSource' => 'kiosk',
        ]);
        $store['queue_help_requests'][] = \normalize_queue_help_request([
            'id' => 92001,
            'ticketId' => 91001,
            'ticketCode' => $ticketCode,
            'patientInitials' => 'EC',
            'reason' => 'human_help',
            'status' => 'pending',
            'createdAt' => date('c'),
            'updatedAt' => date('c'),
        ]);
        \write_store($store, false);

        $adminResponse = $this->captureJsonResponse(static function (): void {
            \AdminDataController::index([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
        });

        $this->assertTrue($adminResponse['payload']['ok']);
        $this->assertGreaterThanOrEqual(1, (int) ($adminResponse['payload']['data']['patientFlowMeta']['casesTotal'] ?? 0));
        $this->assertArrayHasKey('internalConsoleMeta', $adminResponse['payload']['data']);
        $this->assertArrayHasKey('overall', $adminResponse['payload']['data']['internalConsoleMeta'] ?? []);
        $this->assertGreaterThanOrEqual(1, count($adminResponse['payload']['data']['patient_cases'] ?? []));
        $queueCase = $this->findCaseByTicketCode($adminResponse['payload']['data']['patient_cases'] ?? [], $ticketCode);
        $this->assertNotNull($queueCase);
        $this->assertSame('waiting', (string) (($queueCase['summary']['queueStatus'] ?? '')));
        $journeyCase = $this->findJourneyCaseByCaseId(
            $adminResponse['payload']['data']['patientFlowMeta']['journeyPreview']['cases'] ?? [],
            (string) ($queueCase['id'] ?? '')
        );
        $this->assertNotNull($journeyCase);
        $this->assertSame('scheduled', (string) ($journeyCase['displayStage'] ?? ''));
        $this->assertSame('Agenda', (string) ($journeyCase['ownerLabel'] ?? ''));
        $this->assertNotEmpty($journeyCase['journeyHistory'] ?? []);
        $this->assertContains(
            'scheduled',
            array_column($journeyCase['journeyHistory'] ?? [], 'displayStage')
        );

        $_GET['caseId'] = (string) ($queueCase['id'] ?? '');
        $patientCaseResponse = $this->captureJsonResponse(static function (): void {
            \PatientCaseController::index([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
        });

        $this->assertTrue($patientCaseResponse['payload']['ok']);
        $this->assertSame(1, count($patientCaseResponse['payload']['data']['cases'] ?? []));
        $this->assertGreaterThanOrEqual(1, count($patientCaseResponse['payload']['data']['timeline'] ?? []));

        $healthResponse = $this->captureJsonResponse(static function (): void {
            \HealthController::check([
                'store' => \read_store(),
                'method' => 'GET',
                'resource' => 'health',
                'diagnosticsAuthorized' => true,
            ]);
        });

        $this->assertTrue($healthResponse['payload']['ok']);
        $this->assertGreaterThanOrEqual(1, (int) ($healthResponse['payload']['checks']['patientFlow']['casesTotal'] ?? 0));
        $this->assertSame(1, (int) ($healthResponse['payload']['checks']['patientFlow']['activeHelpRequests'] ?? 0));
        $this->assertGreaterThanOrEqual(1, (int) ($healthResponse['payload']['checks']['storeCounts']['patientCases'] ?? 0));

        $_GET = [];
        $journeyResponse = $this->captureJsonResponse(static function (): void {
            \FlowOsController::journeyPreview([
                'store' => \read_store(),
            ]);
        });

        $this->assertTrue($journeyResponse['payload']['ok']);
        $this->assertGreaterThanOrEqual(
            1,
            count($journeyResponse['payload']['data']['journey']['cases'] ?? [])
        );
        $this->assertSame(
            'scheduled',
            (string) ($journeyResponse['payload']['data']['journey']['cases'][0]['displayStage'] ?? '')
        );
        $this->assertNotEmpty($journeyResponse['payload']['data']['journey']['activityFeed'] ?? []);
        $this->assertNotSame(
            '',
            (string) (($journeyResponse['payload']['data']['journey']['activityFeed'][0]['actorLabel'] ?? ''))
        );
    }

    public function testExplicitIntakeCaseMovesToScheduledWhenAppointmentExists(): void
    {
        $store = \read_store();
        $futureDate = date('Y-m-d', strtotime('+3 day'));
        $caseId = 'pc-intake-001';
        $patientId = 'pt-intake-001';

        $store['patient_cases'] = [[
            'id' => $caseId,
            'tenantId' => 'pielarmonia',
            'patientId' => $patientId,
            'status' => 'booked',
            'journeyStage' => 'intake_completed',
            'journeyEnteredAt' => date('c', strtotime('-1 day')),
            'openedAt' => date('c', strtotime('-2 day')),
            'latestActivityAt' => date('c', strtotime('-1 day')),
            'lastInboundAt' => date('c', strtotime('-1 day')),
            'summary' => [
                'patientLabel' => 'Paciente Intake',
                'latestCallbackId' => 'cb-001',
                'milestones' => [
                    'bookedAt' => date('c'),
                ],
            ],
        ]];
        $store['patient_case_approvals'] = [];
        $store['appointments'] = [[
            'id' => 3301,
            'tenantId' => 'pielarmonia',
            'patientCaseId' => $caseId,
            'patientId' => $patientId,
            'name' => 'Paciente Intake',
            'email' => 'intake@example.com',
            'phone' => '0997654321',
            'service' => 'consulta',
            'doctor' => 'rosero',
            'date' => $futureDate,
            'time' => '10:30',
            'dateBooked' => date('c'),
            'status' => 'confirmed',
        ]];
        \write_store($store, false);

        $journey = \flow_os_build_store_journey_preview(\read_store());
        $journeyCase = $this->findJourneyCaseByCaseId($journey['cases'] ?? [], $caseId);

        $this->assertNotNull($journeyCase);
        $this->assertSame('scheduled', (string) ($journeyCase['stage'] ?? ''));
        $this->assertSame('scheduled', (string) ($journeyCase['displayStage'] ?? ''));
        $this->assertSame('Confirmar cita', (string) ($journeyCase['nextActionLabel'] ?? ''));
        $this->assertSame('scheduled', (string) ($journey['stage'] ?? ''));
    }

    public function testStandalonePreconsultationCaseKeepsContinuityWhenAppointmentArrivesLater(): void
    {
        $store = \read_store();
        $futureDate = date('Y-m-d', strtotime('+4 day'));
        $caseId = 'pc-pre-001';
        $patientId = 'pt-pre-001';

        $store['patient_cases'] = [[
            'id' => $caseId,
            'tenantId' => 'pielarmonia',
            'patientId' => $patientId,
            'status' => 'lead_captured',
            'journeyStage' => 'lead_captured',
            'journeyEnteredAt' => date('c', strtotime('-2 hour')),
            'journeyAdvancedAt' => date('c', strtotime('-2 hour')),
            'journeyAdvancedReason' => 'public_preconsultation_created',
            'openedAt' => date('c', strtotime('-2 hour')),
            'latestActivityAt' => date('c', strtotime('-2 hour')),
            'summary' => [
                'patientLabel' => 'Paciente Preconsulta',
                'contactPhone' => '0991234567',
                'contactEmail' => '',
                'source' => 'public_preconsultation',
                'milestones' => [],
            ],
        ]];
        $store['appointments'] = [[
            'id' => 3401,
            'tenantId' => 'pielarmonia',
            'patientCaseId' => '',
            'patientId' => '',
            'name' => 'Paciente Preconsulta',
            'email' => '',
            'phone' => '0991234567',
            'service' => 'consulta',
            'doctor' => 'rosero',
            'date' => $futureDate,
            'time' => '11:30',
            'dateBooked' => date('c'),
            'status' => 'confirmed',
        ]];
        \write_store($store, false);

        $patientCaseService = new \PatientCaseService();
        $hydrated = $patientCaseService->hydrateStore(\read_store());

        $this->assertSame($caseId, (string) ($hydrated['appointments'][0]['patientCaseId'] ?? ''));
        $this->assertSame($patientId, (string) ($hydrated['appointments'][0]['patientId'] ?? ''));
        $this->assertSame($caseId, (string) ($hydrated['patient_cases'][0]['id'] ?? ''));

        $journey = \flow_os_build_store_journey_preview($hydrated);
        $journeyCase = $this->findJourneyCaseByCaseId($journey['cases'] ?? [], $caseId);

        $this->assertNotNull($journeyCase);
        $this->assertSame('scheduled', (string) ($journeyCase['stage'] ?? ''));
        $this->assertSame('scheduled', (string) ($journeyCase['displayStage'] ?? ''));
        $this->assertSame('scheduled', (string) ($journey['stage'] ?? ''));
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

    private function findCaseByTicketCode(array $cases, string $ticketCode): ?array
    {
        foreach ($cases as $case) {
            if (!is_array($case)) {
                continue;
            }
            if ((string) ($case['summary']['latestTicketCode'] ?? '') === $ticketCode) {
                return $case;
            }
        }

        return null;
    }

    private function findJourneyCaseByCaseId(array $cases, string $caseId): ?array
    {
        foreach ($cases as $case) {
            if (!is_array($case)) {
                continue;
            }
            if ((string) ($case['caseId'] ?? '') === $caseId) {
                return $case;
            }
        }

        return null;
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
