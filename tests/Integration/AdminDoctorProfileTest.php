<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
final class AdminDoctorProfileTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_SERVER = [
            'REMOTE_ADDR' => '127.0.0.1',
            'REQUEST_METHOD' => 'GET',
        ];
        $_SESSION = [
            'admin_logged_in' => true,
        ];

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'doctor-profile-' . bin2hex(random_bytes(6));
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
        require_once __DIR__ . '/../../controllers/DoctorProfileController.php';

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
        $_SERVER = [];
        $_SESSION = [];
    }

    public function testAdminDataIncludesDoctorProfileFromConfigFile(): void
    {
        \write_doctor_profile([
            'fullName' => '  Dra. Aurora Demo  ',
            'specialty' => ' Dermatologia clinica ',
            'mspNumber' => ' MSP-100200 ',
            'signatureImage' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==',
            'updatedAt' => '2026-03-29T12:00:00-05:00',
        ]);

        try {
            \AdminDataController::index([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
            self::fail('Expected TestingExitException');
        } catch (\TestingExitException $exception) {
            $payload = $exception->payload;
        }

        $this->assertTrue($payload['ok']);
        $this->assertArrayHasKey('doctorProfile', $payload['data']);
        $this->assertSame(
            'Dra. Aurora Demo',
            (string) ($payload['data']['doctorProfile']['fullName'] ?? '')
        );
        $this->assertSame(
            'Dermatologia clinica',
            (string) ($payload['data']['doctorProfile']['specialty'] ?? '')
        );
        $this->assertSame(
            'MSP-100200',
            (string) ($payload['data']['doctorProfile']['mspNumber'] ?? '')
        );
        $this->assertStringStartsWith(
            'data:image/png;base64,',
            (string) ($payload['data']['doctorProfile']['signatureImage'] ?? '')
        );
    }

    public function testDoctorProfileEndpointPersistsNormalizedPayload(): void
    {
        $_SERVER['REQUEST_METHOD'] = 'POST';
        $_SERVER['HTTP_X_CSRF_TOKEN'] = 'test-csrf';
        $_SESSION['csrf_token'] = 'test-csrf';
        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'fullName' => '  Dra. Lucia Rosero  ',
            'specialty' => ' Dermatologia medico quirurgica ',
            'mspNumber' => ' MSP-445566 ',
            'signatureImage' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==',
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        try {
            \DoctorProfileController::update([
                'isAdmin' => true,
            ]);
            self::fail('Expected TestingExitException');
        } catch (\TestingExitException $exception) {
            $payload = $exception->payload;
        } finally {
            unset($GLOBALS['__TEST_JSON_BODY']);
        }

        $this->assertTrue($payload['ok']);
        $this->assertSame(
            'Dra. Lucia Rosero',
            (string) ($payload['data']['fullName'] ?? '')
        );
        $this->assertSame(
            'Dermatologia medico quirurgica',
            (string) ($payload['data']['specialty'] ?? '')
        );
        $this->assertSame(
            'MSP-445566',
            (string) ($payload['data']['mspNumber'] ?? '')
        );

        $saved = \read_doctor_profile();
        $this->assertSame('Dra. Lucia Rosero', (string) ($saved['fullName'] ?? ''));
        $this->assertSame('MSP-445566', (string) ($saved['mspNumber'] ?? ''));
        $this->assertFileExists(\doctor_profile_config_path());
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
