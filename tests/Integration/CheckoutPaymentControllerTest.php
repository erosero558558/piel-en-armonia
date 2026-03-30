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
    private string $uploadDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_JSON_BODY'], $GLOBALS['__TEST_RESPONSE'], $GLOBALS['__STRIPE_MOCK_PAYMENT_INTENTS']);

        $this->tempDir = sys_get_temp_dir() . '/test_checkout_' . bin2hex(random_bytes(6));
        if (!is_dir($this->tempDir)) {
            mkdir($this->tempDir, 0777, true);
        }
        $this->uploadDir = $this->tempDir . DIRECTORY_SEPARATOR . 'transfer-proofs';
        if (!is_dir($this->uploadDir)) {
            mkdir($this->uploadDir, 0777, true);
        }

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_STRIPE_SECRET_KEY=sk_test_checkout');
        putenv('PIELARMONIA_STRIPE_PUBLISHABLE_KEY=pk_test_checkout');
        putenv('PIELARMONIA_PAYMENT_CURRENCY=USD');
        putenv('PIELARMONIA_TRANSFER_UPLOAD_DIR=' . $this->uploadDir);
        putenv('PIELARMONIA_TRANSFER_PUBLIC_BASE_URL=/uploads/transfer-proofs');

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
        putenv('PIELARMONIA_TRANSFER_UPLOAD_DIR');
        putenv('PIELARMONIA_TRANSFER_PUBLIC_BASE_URL');

        if (\function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
        unset($GLOBALS['__TEST_JSON_BODY'], $GLOBALS['__TEST_RESPONSE'], $GLOBALS['__STRIPE_MOCK_PAYMENT_INTENTS']);
        $_POST = [];
        $_FILES = [];
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

    public function testCheckoutTransferProofAttachesUploadedVoucherToTransferOrder(): void
    {
        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'concept' => 'Control laser',
            'amount' => '75.00',
            'name' => 'Paciente Voucher',
            'email' => 'voucher@example.com',
            'paymentMethod' => 'transfer',
            'transferReference' => 'TRX-UP-01',
        ]);

        $submitResponse = $this->captureControllerExit(static function (): void {
            \PaymentController::checkoutSubmit([]);
        });

        $orderId = (string) ($submitResponse['payload']['data']['order']['id'] ?? '');
        $proofPath = $this->tempDir . DIRECTORY_SEPARATOR . 'proof.png';
        file_put_contents(
            $proofPath,
            base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5qv6cAAAAASUVORK5CYII=')
        );

        $_POST = [
            'orderId' => $orderId,
            'transferReference' => 'TRX-UP-01',
        ];
        $_FILES['proof'] = [
            'name' => 'voucher.png',
            'type' => 'image/png',
            'tmp_name' => $proofPath,
            'error' => UPLOAD_ERR_OK,
            'size' => filesize($proofPath),
        ];

        $response = $this->captureControllerExit(static function (): void {
            \PaymentController::checkoutTransferProof([]);
        });

        $this->assertSame(201, $response['status']);
        $this->assertTrue($response['payload']['ok']);
        $this->assertSame(
            'Pendiente de verificacion',
            (string) ($response['payload']['data']['receipt']['paymentStatusLabel'] ?? '')
        );

        $store = \read_store();
        $order = $store['checkout_orders'][0] ?? [];
        $this->assertNotSame('', (string) ($order['transferProofUrl'] ?? ''));
        $this->assertSame('voucher.png', (string) ($order['transferProofName'] ?? ''));
        $this->assertSame('pending_transfer', (string) ($order['paymentStatus'] ?? ''));
        $this->assertNotSame('', (string) ($order['transferProofUploadedAt'] ?? ''));
    }

    public function testAdminCanVerifyAndApplyTransferCheckout(): void
    {
        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'concept' => 'Saldo peeling',
            'amount' => '95.00',
            'name' => 'Paciente Revision',
            'whatsapp' => '+593999777666',
            'paymentMethod' => 'transfer',
            'transferReference' => 'TRX-VERIFY-01',
        ]);

        $submitResponse = $this->captureControllerExit(static function (): void {
            \PaymentController::checkoutSubmit([]);
        });

        $orderId = (string) ($submitResponse['payload']['data']['order']['id'] ?? '');
        $proofPath = $this->tempDir . DIRECTORY_SEPARATOR . 'proof-review.png';
        file_put_contents(
            $proofPath,
            base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5qv6cAAAAASUVORK5CYII=')
        );

        $_POST = [
            'orderId' => $orderId,
            'transferReference' => 'TRX-VERIFY-01',
        ];
        $_FILES['proof'] = [
            'name' => 'review.png',
            'type' => 'image/png',
            'tmp_name' => $proofPath,
            'error' => UPLOAD_ERR_OK,
            'size' => filesize($proofPath),
        ];

        $this->captureControllerExit(static function (): void {
            \PaymentController::checkoutTransferProof([]);
        });

        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'id' => $orderId,
            'action' => 'verify',
        ]);

        $verifyResponse = $this->captureControllerExit(static function (): void {
            \PaymentController::checkoutOrderReview([]);
        });

        $this->assertSame(200, $verifyResponse['status']);
        $this->assertSame(
            'Verificado',
            (string) ($verifyResponse['payload']['data']['receipt']['paymentStatusLabel'] ?? '')
        );

        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'id' => $orderId,
            'action' => 'apply',
        ]);

        $applyResponse = $this->captureControllerExit(static function (): void {
            \PaymentController::checkoutOrderReview([]);
        });

        $this->assertSame(200, $applyResponse['status']);
        $this->assertSame(
            'Aplicado',
            (string) ($applyResponse['payload']['data']['receipt']['paymentStatusLabel'] ?? '')
        );

        $store = \read_store();
        $order = $store['checkout_orders'][0] ?? [];
        $this->assertSame('applied', (string) ($order['paymentStatus'] ?? ''));
        $this->assertNotSame('', (string) ($order['transferVerifiedAt'] ?? ''));
        $this->assertNotSame('', (string) ($order['transferAppliedAt'] ?? ''));
    }

    public function testAdminAccountMetaGroupsBalancesByPatientAndDueState(): void
    {
        $now = new \DateTimeImmutable(\local_date('c'));
        $overdueAt = $now->modify('-4 hours')->format('c');
        $dueSoonAt = $now->modify('+24 hours')->format('c');
        $settledAt = $now->modify('-1 day')->format('c');

        $meta = \CheckoutOrderService::buildAdminAccountMeta([
            'checkout_orders' => [
                [
                    'id' => 'co_ana_pending',
                    'receiptNumber' => 'PAY-ANA-001',
                    'concept' => 'Saldo peeling',
                    'amountCents' => 8000,
                    'currency' => 'USD',
                    'payerName' => 'Ana Test',
                    'payerEmail' => 'ana@example.com',
                    'payerWhatsapp' => '+593999000111',
                    'paymentMethod' => 'transfer',
                    'paymentStatus' => 'pending_transfer',
                    'transferReference' => 'TRX-ANA-01',
                    'dueAt' => $overdueAt,
                    'createdAt' => $now->modify('-2 day')->format('c'),
                    'updatedAt' => $now->modify('-6 hours')->format('c'),
                ],
                [
                    'id' => 'co_ana_paid',
                    'receiptNumber' => 'PAY-ANA-002',
                    'concept' => 'Control laser',
                    'amountCents' => 4500,
                    'currency' => 'USD',
                    'payerName' => 'Ana Test',
                    'payerEmail' => 'ana@example.com',
                    'payerWhatsapp' => '+593999000111',
                    'paymentMethod' => 'card',
                    'paymentStatus' => 'paid',
                    'paymentPaidAt' => $settledAt,
                    'createdAt' => $now->modify('-5 day')->format('c'),
                    'updatedAt' => $settledAt,
                ],
                [
                    'id' => 'co_luis_pending',
                    'receiptNumber' => 'PAY-LUI-001',
                    'concept' => 'Control acne',
                    'amountCents' => 7500,
                    'currency' => 'USD',
                    'payerName' => 'Luis Mora',
                    'payerEmail' => 'luis@example.com',
                    'payerWhatsapp' => '+593999000222',
                    'paymentMethod' => 'cash',
                    'paymentStatus' => 'pending_cash',
                    'dueAt' => $dueSoonAt,
                    'createdAt' => $now->modify('-1 day')->format('c'),
                    'updatedAt' => $now->modify('-2 hours')->format('c'),
                ],
            ],
        ]);

        $this->assertSame(2, (int) ($meta['summary']['patientCount'] ?? -1));
        $this->assertSame(2, (int) ($meta['summary']['outstandingCount'] ?? -1));
        $this->assertSame(1, (int) ($meta['summary']['dueSoonCount'] ?? -1));
        $this->assertSame(1, (int) ($meta['summary']['overdueCount'] ?? -1));
        $this->assertSame('$155.00', (string) ($meta['summary']['outstandingBalanceLabel'] ?? ''));
        $this->assertSame('$45.00', (string) ($meta['summary']['settledBalanceLabel'] ?? ''));

        $patients = $meta['patients'] ?? [];
        $this->assertCount(2, $patients);
        $this->assertSame('Ana Test', (string) ($patients[0]['patientName'] ?? ''));
        $this->assertSame('$80.00', (string) ($patients[0]['outstandingBalanceLabel'] ?? ''));
        $this->assertSame('$45.00', (string) ($patients[0]['settledBalanceLabel'] ?? ''));
        $this->assertSame(1, (int) ($patients[0]['overdueCount'] ?? -1));
        $this->assertSame($overdueAt, (string) ($patients[0]['nextDueAt'] ?? ''));
        $this->assertSame('PAY-ANA-001', (string) ($patients[0]['orders'][0]['receiptNumber'] ?? ''));
        $this->assertSame('outstanding', (string) ($patients[0]['orders'][0]['statusBucket'] ?? ''));
    }
}
