<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../tests/helpers/StripeMock.php';

/**
 * @runInSeparateProcess
 */
class CheckoutPaymentControllerTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_JSON_BODY'], $GLOBALS['__TEST_RESPONSE'], $GLOBALS['__STRIPE_MOCK_PAYMENT_INTENTS']);

        $this->tempDir = sys_get_temp_dir() . '/test_checkout_' . bin2hex(random_bytes(6));
        if (!is_dir($this->tempDir)) {
            mkdir($this->tempDir, 0777, true);
        }

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_STRIPE_SECRET_KEY=sk_test_checkout');
        putenv('PIELARMONIA_STRIPE_PUBLISHABLE_KEY=pk_test_checkout');
        putenv('PIELARMONIA_PAYMENT_CURRENCY=USD');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../lib/common.php';
        require_once __DIR__ . '/../../lib/storage.php';
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
        putenv('PIELARMONIA_PAYMENT_CURRENCY');

        if (\function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
        unset($GLOBALS['__TEST_JSON_BODY'], $GLOBALS['__TEST_RESPONSE'], $GLOBALS['__STRIPE_MOCK_PAYMENT_INTENTS']);
    }

    private function removeDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }

        $files = array_diff(scandir($dir), ['.', '..']);
        foreach ($files as $file) {
            $path = $dir . DIRECTORY_SEPARATOR . $file;
            is_dir($path) ? $this->removeDirectory($path) : unlink($path);
        }
        rmdir($dir);
    }

    private function captureControllerExit(callable $callback): array
    {
        try {
            $callback();
            $this->fail('Should have thrown TestingExitException');
        } catch (\TestingExitException $e) {
            return ['payload' => $e->payload, 'status' => $e->status];
        }
    }

    public function testCheckoutConfigPublishesBankAndGatewayMetadata(): void
    {
        $response = $this->captureControllerExit(static function (): void {
            \PaymentController::checkoutConfig([]);
        });

        $this->assertSame(200, $response['status']);
        $this->assertTrue($response['payload']['ok']);
        $this->assertSame('USD', (string) ($response['payload']['data']['currency'] ?? ''));
        $this->assertSame('Banco Pichincha', (string) ($response['payload']['data']['bank']['bankName'] ?? ''));
        $this->assertTrue((bool) ($response['payload']['data']['stripeEnabled'] ?? false));
    }

    public function testCheckoutIntentPersistsPendingGatewayOrder(): void
    {
        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'concept' => 'Consulta dermatologica',
            'amount' => '40.00',
            'name' => 'Paciente Checkout',
            'email' => 'checkout@example.com',
            'whatsapp' => '+593999999999',
        ]);

        $response = $this->captureControllerExit(static function (): void {
            \PaymentController::checkoutIntent([]);
        });

        $this->assertSame(201, $response['status']);
        $this->assertTrue($response['payload']['ok']);
        $this->assertStringStartsWith('pi_mock_', (string) ($response['payload']['data']['paymentIntentId'] ?? ''));
        $this->assertSame('Tarjeta', (string) ($response['payload']['data']['receipt']['paymentMethodLabel'] ?? ''));

        $store = \read_store();
        $this->assertCount(1, $store['checkout_orders']);
        $this->assertSame('pending_gateway', (string) ($store['checkout_orders'][0]['paymentStatus'] ?? ''));
        $this->assertSame('card', (string) ($store['checkout_orders'][0]['paymentMethod'] ?? ''));
    }

    public function testCheckoutConfirmMarksOrderAsPaid(): void
    {
        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'concept' => 'Anticipo laser',
            'amount' => '55.00',
            'name' => 'Paciente Checkout',
            'email' => 'checkout@example.com',
            'whatsapp' => '+593999999999',
        ]);

        $intentResponse = $this->captureControllerExit(static function (): void {
            \PaymentController::checkoutIntent([]);
        });

        $orderId = (string) ($intentResponse['payload']['data']['order']['id'] ?? '');
        $paymentIntentId = (string) ($intentResponse['payload']['data']['paymentIntentId'] ?? '');

        $GLOBALS['__STRIPE_MOCK_PAYMENT_INTENTS'][$paymentIntentId] = [
            'id' => $paymentIntentId,
            'status' => 'succeeded',
            'amount' => 5500,
            'amount_received' => 5500,
            'currency' => 'usd',
            'metadata' => [
                'order_id' => $orderId,
            ],
        ];
        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'orderId' => $orderId,
            'paymentIntentId' => $paymentIntentId,
        ]);

        $response = $this->captureControllerExit(static function (): void {
            \PaymentController::checkoutConfirm([]);
        });

        $this->assertSame(200, $response['status']);
        $this->assertTrue($response['payload']['ok']);
        $this->assertSame('Pagado', (string) ($response['payload']['data']['receipt']['paymentStatusLabel'] ?? ''));

        $store = \read_store();
        $this->assertSame('paid', (string) ($store['checkout_orders'][0]['paymentStatus'] ?? ''));
    }

    public function testCheckoutSubmitCreatesPendingTransferReceipt(): void
    {
        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'concept' => 'Saldo de procedimiento',
            'amount' => '120.00',
            'name' => 'Paciente Transferencia',
            'whatsapp' => '+593988888888',
            'paymentMethod' => 'transfer',
            'transferReference' => 'TRX-2026-44',
        ]);

        $response = $this->captureControllerExit(static function (): void {
            \PaymentController::checkoutSubmit([]);
        });

        $this->assertSame(201, $response['status']);
        $this->assertTrue($response['payload']['ok']);
        $this->assertSame('Transferencia', (string) ($response['payload']['data']['receipt']['paymentMethodLabel'] ?? ''));
        $this->assertSame('Pendiente de transferencia', (string) ($response['payload']['data']['receipt']['paymentStatusLabel'] ?? ''));

        $store = \read_store();
        $this->assertCount(1, $store['checkout_orders']);
        $this->assertSame('pending_transfer', (string) ($store['checkout_orders'][0]['paymentStatus'] ?? ''));
        $this->assertSame('TRX-2026-44', (string) ($store['checkout_orders'][0]['transferReference'] ?? ''));
    }
}
