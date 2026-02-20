<?php
declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
class BookingFlowTest extends TestCase
{
    private $tempDir;

    protected function setUp(): void
    {
        // Ensure globals are clean
        unset($GLOBALS['__TEST_JSON_BODY']);
        unset($GLOBALS['__TEST_RESPONSE']);

        $this->tempDir = sys_get_temp_dir() . '/test_booking_' . bin2hex(random_bytes(6));
        if (!is_dir($this->tempDir)) {
            mkdir($this->tempDir, 0777, true);
        }
        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../lib/common.php';
        require_once __DIR__ . '/../../lib/storage.php';
        require_once __DIR__ . '/../../lib/business.php';
        require_once __DIR__ . '/../../lib/http.php';
        require_once __DIR__ . '/../../lib/ratelimit.php';
        require_once __DIR__ . '/../../lib/validation.php';
        require_once __DIR__ . '/../../lib/models.php';
        require_once __DIR__ . '/../../lib/email.php';
        require_once __DIR__ . '/../../payment-lib.php';

        require_once __DIR__ . '/../../controllers/AppointmentController.php';

        ensure_data_file();
    }

    protected function tearDown(): void
    {
        putenv('PIELARMONIA_DATA_DIR');
        $this->removeDirectory($this->tempDir);
        unset($GLOBALS['__TEST_JSON_BODY']);
        unset($GLOBALS['__TEST_RESPONSE']);
    }

    private function removeDirectory($dir)
    {
        if (!is_dir($dir)) {
            return;
        }
        $files = array_diff(scandir($dir), ['.', '..']);
        foreach ($files as $file) {
            $path = "$dir/$file";
            (is_dir($path)) ? $this->removeDirectory($path) : unlink($path);
        }
        rmdir($dir);
    }

    public function testBookingStoreSuccess(): void
    {
        $futureDate = date('Y-m-d', strtotime('+2 days'));
        $payload = [
            'name' => 'Integration Test',
            'email' => 'integration@example.com',
            'phone' => '0999999999',
            'date' => $futureDate,
            'time' => '10:00',
            'doctor' => 'rosero',
            'service' => 'consulta',
            'privacyConsent' => true,
            'paymentMethod' => 'unpaid'
        ];
        $GLOBALS['__TEST_JSON_BODY'] = json_encode($payload);

        $store = \read_store();
        $store['appointments'] = []; // Clear migrated data
        $store['availability'][$futureDate] = ['10:00'];
        \write_store($store);

        $context = ['store' => $store];

        try {
            \AppointmentController::store($context);
            $this->fail('Should have thrown TestingExitException');
        } catch (\TestingExitException $e) {
            $response = ['payload' => $e->payload, 'status' => $e->status];
        }

        $this->assertEquals(201, $response['status']);
        $this->assertTrue($response['payload']['ok']);
        $this->assertEquals('Integration Test', $response['payload']['data']['name']);

        $updatedStore = \read_store();
        $this->assertCount(1, $updatedStore['appointments']);
        $this->assertEquals('Integration Test', $updatedStore['appointments'][0]['name']);
    }

    public function testBookingStoreValidationFail(): void
    {
        $payload = [
            'email' => 'fail@example.com'
        ];
        $GLOBALS['__TEST_JSON_BODY'] = json_encode($payload);

        $context = ['store' => \read_store()];

        try {
            \AppointmentController::store($context);
            $this->fail('Should have thrown TestingExitException');
        } catch (\TestingExitException $e) {
            $response = ['payload' => $e->payload, 'status' => $e->status];
        }

        $this->assertEquals(400, $response['status']);
        $this->assertFalse($response['payload']['ok']);
    }
}
