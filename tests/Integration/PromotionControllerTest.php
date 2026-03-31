<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
final class PromotionControllerTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_POST = [];
        $_SERVER = [
            'REMOTE_ADDR' => '127.0.0.1',
            'REQUEST_METHOD' => 'GET',
        ];
        $_SESSION = [];

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'promotion-controller-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0777, true);

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');
        ini_set('log_errors', '1');
        ini_set('error_log', $this->tempDir . DIRECTORY_SEPARATOR . 'php-error.log');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../controllers/PromotionController.php';

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
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_POST = [];
        $_SERVER = [];
        $_SESSION = [];
    }

    public function testNewPatientSeesFirstConsultPromotion(): void
    {
        \write_store([
            'appointments' => [],
            'patient_cases' => [],
            'memberships' => [],
        ], false);

        $_SERVER['REQUEST_METHOD'] = 'GET';
        $_GET = [
            'resource' => 'active-promotions',
            'email' => 'nueva@auroraderm.test',
            'phone' => '+593 98 245 3672',
            'name' => 'Paciente Nueva',
        ];

        try {
            \PromotionController::active([
                'store' => \read_store(),
            ]);
            self::fail('Expected TestingExitException');
        } catch (\TestingExitException $exception) {
            $payload = $exception->payload;
        }

        $promotions = is_array($payload['data']['promotions'] ?? null)
            ? $payload['data']['promotions']
            : [];

        $this->assertTrue($payload['ok'] ?? false);
        $this->assertContains('first_consult', array_column($promotions, 'id'));
        $this->assertTrue((bool) ($payload['data']['patient']['isFirstVisit'] ?? false));
        $this->assertFalse((bool) ($payload['data']['patient']['isMember'] ?? true));
    }

    public function testMemberDoesNotSeeFirstConsultPromotion(): void
    {
        $store = \storage_default_store_payload();
        $store['appointments'] = [[
            'id' => 101,
            'patientId' => 'pt_member_001',
            'name' => 'Paciente Miembro',
            'email' => 'miembro@auroraderm.test',
            'phone' => '+593982453672',
            'date' => '2026-03-20',
            'time' => '09:00',
            'status' => 'completed',
        ]];
        $store['memberships'] = [[
            'id' => 'mbr-001',
            'patient_id' => 'pt_member_001',
            'plan' => 'pro',
            'status' => 'active',
            'issued_at' => '2026-03-01T10:00:00-05:00',
            'expires_at' => '2026-12-31T23:59:59-05:00',
        ]];

        \write_store($store, false);

        $_SERVER['REQUEST_METHOD'] = 'GET';
        $_GET = [
            'resource' => 'active-promotions',
            'email' => 'miembro@auroraderm.test',
            'phone' => '+593982453672',
            'name' => 'Paciente Miembro',
        ];

        try {
            \PromotionController::active([
                'store' => \read_store(),
            ]);
            self::fail('Expected TestingExitException');
        } catch (\TestingExitException $exception) {
            $payload = $exception->payload;
        }

        $promotions = is_array($payload['data']['promotions'] ?? null)
            ? $payload['data']['promotions']
            : [];

        $this->assertTrue($payload['ok'] ?? false);
        $this->assertNotContains('first_consult', array_column($promotions, 'id'));
        $this->assertTrue((bool) ($payload['data']['patient']['isMember'] ?? false));
        $this->assertFalse((bool) ($payload['data']['patient']['isFirstVisit'] ?? true));
    }

    public function testAdminCanTogglePromotionConfig(): void
    {
        $_SERVER['REQUEST_METHOD'] = 'POST';
        $_SERVER['HTTP_X_CSRF_TOKEN'] = 'promotion-csrf';
        $_SESSION = [
            'admin_logged_in' => true,
            'csrf_token' => 'promotion-csrf',
        ];
        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'promotions' => [
                [
                    'id' => 'first_consult',
                    'active' => false,
                ],
            ],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        try {
            \PromotionController::configUpdate([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
            self::fail('Expected TestingExitException');
        } catch (\TestingExitException $exception) {
            $payload = $exception->payload;
        } finally {
            unset($GLOBALS['__TEST_JSON_BODY']);
        }

        $this->assertTrue($payload['ok'] ?? false);
        $rules = is_array($payload['data']['promotions'] ?? null)
            ? $payload['data']['promotions']
            : [];
        $firstConsult = null;
        foreach ($rules as $rule) {
            if ((string) ($rule['id'] ?? '') === 'first_consult') {
                $firstConsult = $rule;
                break;
            }
        }

        $this->assertNotNull($firstConsult);
        $this->assertFalse((bool) ($firstConsult['active'] ?? true));

        $store = \read_store();
        $this->assertFalse((bool) ($store['promotion_config']['promotions']['first_consult']['active'] ?? true));
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
