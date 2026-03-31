<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
final class AdminMultiClinicOverviewTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE']);

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'admin-multi-clinic-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0777, true);

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');
        ini_set('log_errors', '1');
        ini_set('error_log', $this->tempDir . DIRECTORY_SEPARATOR . 'php-error.log');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../controllers/AdminDataController.php';

        \ensure_data_file();
    }

    protected function tearDown(): void
    {
        foreach ([
            'PIELARMONIA_DATA_DIR',
            'PIELARMONIA_AVAILABILITY_SOURCE',
        ] as $key) {
            putenv($key);
        }

        if (\function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
        unset($GLOBALS['__TEST_RESPONSE']);
    }

    public function testAdminDataIncludesMultiClinicOverviewWithCrossBranchComparison(): void
    {
        $activeClinicId = (string) (\read_turnero_clinic_profile()['clinic_id'] ?? 'default-clinic');
        $today = \local_date('Y-m-d');
        $store = \read_store();
        $store['appointments'] = [
            [
                'id' => 101,
                'tenantId' => \get_current_tenant_id(),
                'service' => 'consulta',
                'doctor' => 'rosero',
                'date' => $today,
                'time' => '09:00',
                'name' => 'Paciente Activa',
                'email' => 'activa@example.com',
                'phone' => '+593999000111',
                'status' => 'confirmed',
            ],
            [
                'id' => 102,
                'tenantId' => \get_current_tenant_id(),
                'clinicId' => 'clinica-norte-demo',
                'service' => 'laser',
                'doctor' => 'narvaez',
                'date' => $today,
                'time' => '11:00',
                'name' => 'Paciente Norte',
                'email' => 'norte@example.com',
                'phone' => '+593999000222',
                'status' => 'confirmed',
            ],
        ];
        $store['checkout_orders'] = [
            [
                'id' => 'co_active',
                'tenantId' => \get_current_tenant_id(),
                'amountCents' => 12000,
                'currency' => 'USD',
                'paymentStatus' => 'paid',
                'payerName' => 'Paciente Activa',
                'payerEmail' => 'activa@example.com',
                'payerWhatsapp' => '+593999000111',
                'createdAt' => \local_date('c'),
                'updatedAt' => \local_date('c'),
            ],
            [
                'id' => 'co_north',
                'tenantId' => \get_current_tenant_id(),
                'clinicId' => 'clinica-norte-demo',
                'amountCents' => 27500,
                'currency' => 'USD',
                'paymentStatus' => 'applied',
                'payerName' => 'Paciente Norte',
                'payerEmail' => 'norte@example.com',
                'payerWhatsapp' => '+593999000222',
                'createdAt' => \local_date('c'),
                'updatedAt' => \local_date('c'),
            ],
        ];

        try {
            \AdminDataController::index([
                'store' => $store,
                'isAdmin' => true,
            ]);
            self::fail('Se esperaba TestingExitException');
        } catch (\TestingExitException $exception) {
            $payload = $exception->payload;
        }

        $this->assertTrue($payload['ok']);
        $this->assertArrayHasKey('multiClinicOverview', $payload['data']);

        $overview = $payload['data']['multiClinicOverview'];
        $this->assertSame(2, (int) ($overview['summary']['todayAppointments'] ?? 0));
        $this->assertSame(2, (int) ($overview['summary']['patientCount'] ?? 0));
        $this->assertGreaterThanOrEqual(2, (int) ($overview['summary']['clinicCount'] ?? 0));
        $this->assertSame(2, (int) ($overview['summary']['fallbackAssignedRecords'] ?? 0));
        $this->assertSame(
            'clinica-norte-demo',
            (string) ($overview['comparative']['leaderByRevenue']['clinicId'] ?? '')
        );
        $this->assertSame(
            '$395.00',
            (string) ($overview['summary']['settledRevenueLabel'] ?? '')
        );

        $clinics = is_array($overview['clinics'] ?? null) ? $overview['clinics'] : [];
        $activeClinic = $this->findClinic($clinics, $activeClinicId);
        $northClinic = $this->findClinic($clinics, 'clinica-norte-demo');

        $this->assertNotNull($activeClinic);
        $this->assertNotNull($northClinic);
        $this->assertSame(1, (int) ($activeClinic['todayAppointments'] ?? 0));
        $this->assertSame(2, (int) ($activeClinic['fallbackAssignedRecords'] ?? 0));
        $this->assertSame('$120.00', (string) ($activeClinic['settledRevenueLabel'] ?? ''));
        $this->assertSame(1, (int) ($northClinic['todayAppointments'] ?? 0));
        $this->assertSame('$275.00', (string) ($northClinic['settledRevenueLabel'] ?? ''));
        $this->assertTrue(($northClinic['isRevenueLeader'] ?? false) === true);
    }

    /**
     * @param array<int,array<string,mixed>> $clinics
     * @return array<string,mixed>|null
     */
    private function findClinic(array $clinics, string $clinicId): ?array
    {
        foreach ($clinics as $clinic) {
            if ((string) ($clinic['clinicId'] ?? '') === $clinicId) {
                return $clinic;
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
