<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 * @preserveGlobalState disabled
 */
final class MembershipEnforcementTest extends TestCase
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

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'membership-enforcement-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0777, true);

        foreach ([
            'PIELARMONIA_DATA_DIR' => $this->tempDir,
            'AURORADERM_DATA_DIR' => $this->tempDir,
            'PIELARMONIA_SKIP_ENV_FILE' => '1',
            'AURORADERM_SKIP_ENV_FILE' => '1',
        ] as $key => $value) {
            putenv($key . '=' . $value);
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
        }

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../payment-lib.php';
        require_once __DIR__ . '/../../controllers/PatientCaseController.php';
        require_once __DIR__ . '/../../lib/memberships/MembershipService.php';
        require_once __DIR__ . '/../../lib/clinical_history/ClinicalHistoryRepository.php';
        require_once __DIR__ . '/../../lib/clinical_history/ClinicalHistorySessionService.php';

        if (\function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        \ensure_data_file();
    }

    protected function tearDown(): void
    {
        foreach ([
            'PIELARMONIA_DATA_DIR',
            'AURORADERM_DATA_DIR',
            'PIELARMONIA_SKIP_ENV_FILE',
            'AURORADERM_SKIP_ENV_FILE',
        ] as $key) {
            putenv($key);
            unset($_ENV[$key], $_SERVER[$key]);
        }

        if (\function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_SERVER = [];
    }

    public function testPatientCaseIndexIncludesMembershipStatusAndPriorityBooking(): void
    {
        $this->seedGoldMemberCase();

        $_GET['caseId'] = 'case-member-001';
        $response = $this->captureJsonResponse(static function (): void {
            \PatientCaseController::index([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
        });

        self::assertTrue((bool) ($response['payload']['ok'] ?? false));
        self::assertCount(1, $response['payload']['data']['cases'] ?? []);

        $case = $response['payload']['data']['cases'][0] ?? [];
        self::assertTrue((bool) ($case['membership_status'] ?? false));
        self::assertSame('gold', (string) ($case['membership_plan'] ?? ''));
        self::assertSame(20, (int) ($case['membership_discount_percent'] ?? 0));
        self::assertTrue((bool) ($case['priority_booking'] ?? false));
    }

    public function testClinicalHistoryPayloadIncludesMembershipCloseoutBenefit(): void
    {
        $this->seedGoldMemberCase();

        $session = \ClinicalHistoryRepository::defaultSession([
            'sessionId' => 'chs-member-001',
            'caseId' => 'case-member-001',
            'patient' => [
                'id' => 'pt-member-001',
                'name' => 'Lucia Miembro',
                'email' => 'lucia.member@example.com',
                'phone' => '0991234567',
            ],
        ]);
        $draft = \ClinicalHistoryRepository::defaultDraft($session, [
            'episodeId' => 'episode-member-001',
        ]);

        $payload = (new \ClinicalHistorySessionService())->buildAdminPayload(
            \read_store(),
            $session,
            $draft
        );

        self::assertTrue((bool) ($payload['session']['membership_status'] ?? false));
        self::assertSame('gold', (string) ($payload['session']['membership_plan'] ?? ''));
        self::assertSame(20, (int) ($payload['session']['membership_discount_percent'] ?? 0));
        self::assertSame('⭐ Miembro', (string) ($payload['session']['membership_badge_label'] ?? ''));

        $discount = is_array($payload['session']['membership_closure_discount'] ?? null)
            ? $payload['session']['membership_closure_discount']
            : [];
        $expectedBaseAmount = \payment_expected_amount_cents(
            'consulta',
            '2026-04-05',
            '09:00'
        );

        self::assertTrue((bool) ($discount['eligible'] ?? false));
        self::assertSame(501, (int) ($discount['appointment_id'] ?? 0));
        self::assertSame($expectedBaseAmount, (int) ($discount['base_amount_cents'] ?? -1));
        self::assertSame(20, (int) ($discount['discount_percent'] ?? 0));
        self::assertSame(
            (int) round($expectedBaseAmount * 0.2),
            (int) ($discount['discount_amount_cents'] ?? -1)
        );
        self::assertSame(
            $expectedBaseAmount - (int) round($expectedBaseAmount * 0.2),
            (int) ($discount['final_amount_cents'] ?? -1)
        );
    }

    private function seedGoldMemberCase(): void
    {
        $membershipService = new \MembershipService();
        $membershipService->issue('pt-member-001', 'gold');

        \write_store([
            'appointments' => [
                \normalize_appointment([
                    'id' => 501,
                    'service' => 'consulta',
                    'doctor' => 'rosero',
                    'date' => '2026-04-05',
                    'time' => '09:00',
                    'name' => 'Lucia Miembro',
                    'email' => 'lucia.member@example.com',
                    'phone' => '0991234567',
                    'privacyConsent' => true,
                    'status' => 'confirmed',
                    'paymentMethod' => 'cash',
                    'paymentStatus' => 'pending_cash',
                    'patientCaseId' => 'case-member-001',
                    'patientId' => 'pt-member-001',
                ]),
            ],
            'patient_cases' => [
                [
                    'id' => 'case-member-001',
                    'patientId' => 'pt-member-001',
                    'status' => 'scheduled',
                    'openedAt' => '2026-04-01T10:00:00-05:00',
                    'latestActivityAt' => '2026-04-01T10:00:00-05:00',
                    'summary' => [
                        'patientLabel' => 'Lucia Miembro',
                    ],
                ],
            ],
            'patient_case_links' => [],
            'patient_case_timeline_events' => [],
            'patient_case_approvals' => [],
        ], false);
    }

    /**
     * @return array{payload:array<string,mixed>,status:int}
     */
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
