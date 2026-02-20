<?php
declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../tests/helpers/StripeMock.php';

/**
 * @runInSeparateProcess
 */
class PaymentFlowTest extends TestCase
{
    private $tempDir;

    protected function setUp(): void
    {
        // Ensure globals are clean
        unset($GLOBALS['__TEST_JSON_BODY']);
        unset($GLOBALS['__TEST_RESPONSE']);

        $this->tempDir = sys_get_temp_dir() . '/test_payment_' . bin2hex(random_bytes(6));
        if (!is_dir($this->tempDir)) {
            mkdir($this->tempDir, 0777, true);
        }
        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_STRIPE_SECRET_KEY=sk_test_mock');
        putenv('PIELARMONIA_STRIPE_PUBLISHABLE_KEY=pk_test_mock');
        putenv('PIELARMONIA_VAT_RATE=15');
        putenv('PIELARMONIA_STRIPE_WEBHOOK_SECRET=whsec_mock');

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
        require_once __DIR__ . '/../../payment-lib.php';
        require_once __DIR__ . '/../../controllers/PaymentController.php';

        \ensure_data_file();
    }

    protected function tearDown(): void
    {
        putenv('PIELARMONIA_DATA_DIR');
        putenv('PIELARMONIA_STRIPE_SECRET_KEY');
        putenv('PIELARMONIA_STRIPE_PUBLISHABLE_KEY');
        putenv('PIELARMONIA_VAT_RATE');
        putenv('PIELARMONIA_STRIPE_WEBHOOK_SECRET');

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

    public function testCreateIntentSuccess(): void
    {
        // Use 'next tuesday' to ensure a weekday and avoid weekend surcharge (10%)
        $futureDate = date('Y-m-d', strtotime('next tuesday'));
        $payload = [
            'name' => 'Payment Test',
            'email' => 'payment@example.com',
            'phone' => '0999999999',
            'date' => $futureDate,
            'time' => '10:00',
            'doctor' => 'rosero',
            'service' => 'consulta',
            'privacyConsent' => true
        ];
        $GLOBALS['__TEST_JSON_BODY'] = json_encode($payload);

        $store = \read_store();
        $store['appointments'] = []; // Clear migrated data
        $store['availability'][$futureDate] = ['10:00'];
        \write_store($store);

        $context = ['store' => $store];

        try {
            \PaymentController::createIntent($context);
            $this->fail('Should have thrown TestingExitException');
        } catch (\TestingExitException $e) {
            $response = ['payload' => $e->payload, 'status' => $e->status];
        }

        $this->assertEquals(200, $response['status']);
        $this->assertTrue($response['payload']['ok']);
        $this->assertStringStartsWith('pi_mock_', $response['payload']['paymentIntentId']);
        $this->assertEquals(4000, $response['payload']['amount']);
    }
}
