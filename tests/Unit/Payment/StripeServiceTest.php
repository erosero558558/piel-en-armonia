<?php
declare(strict_types=1);

namespace Tests\Unit\Payment;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../../tests/helpers/StripeMock.php';
require_once __DIR__ . '/../../../payment-lib.php';

class StripeServiceTest extends TestCase
{
    protected function setUp(): void
    {
        // Set default env vars for tests
        putenv('PIELARMONIA_STRIPE_SECRET_KEY=sk_test_mock');
        putenv('PIELARMONIA_STRIPE_PUBLISHABLE_KEY=pk_test_mock');
        putenv('PIELARMONIA_STRIPE_WEBHOOK_SECRET=whsec_mock');
        putenv('PIELARMONIA_PAYMENT_CURRENCY=USD');
        putenv('PIELARMONIA_VAT_RATE=0');
    }

    protected function tearDown(): void
    {
        // Clean up env vars
        putenv('PIELARMONIA_STRIPE_SECRET_KEY');
        putenv('PIELARMONIA_STRIPE_PUBLISHABLE_KEY');
        putenv('PIELARMONIA_STRIPE_WEBHOOK_SECRET');
        putenv('PIELARMONIA_PAYMENT_CURRENCY');
        putenv('PIELARMONIA_VAT_RATE');
    }

    public function testCreatePaymentIntentSuccess(): void
    {
        $appointment = [
            'service' => 'consulta',
            'date' => '2024-03-20',
            'time' => '10:00',
            'email' => 'test@example.com',
            'doctor' => 'Dr. Test',
            'name' => 'Test Patient',
            'phone' => '123456789'
        ];

        $result = \stripe_create_payment_intent($appointment);

        $this->assertIsArray($result);
        $this->assertArrayHasKey('id', $result);
        $this->assertStringStartsWith('pi_mock_', $result['id']);
        $this->assertEquals('usd', $result['currency']);
        $this->assertEquals('Test Patient', $result['metadata']['name']);
    }

    public function testCreatePaymentIntentFailsWithoutConfiguration(): void
    {
        putenv('PIELARMONIA_STRIPE_SECRET_KEY'); // Unset

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('La pasarela de pagos no esta configurada');

        $appointment = ['service' => 'consulta'];
        \stripe_create_payment_intent($appointment);
    }

    public function testRetrievePaymentIntentSuccess(): void
    {
        $id = 'pi_test_123';
        $result = \stripe_get_payment_intent($id);

        $this->assertIsArray($result);
        $this->assertEquals($id, $result['id']);
        $this->assertEquals('succeeded', $result['status']);
    }

    public function testRetrievePaymentIntentFailsMissingId(): void
    {
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('paymentIntentId es obligatorio');

        \stripe_get_payment_intent('   ');
    }

    public function testVerifyWebhookSignature(): void
    {
        $payload = json_encode(['id' => 'evt_test']);
        $sigHeader = 'valid_signature'; // Matches StripeMock check
        $secret = 'whsec_mock';

        $event = \stripe_verify_webhook_signature($payload, $sigHeader, $secret);

        $this->assertIsArray($event);
        $this->assertEquals('payment_intent.succeeded', $event['type']);
    }

     public function testVerifyWebhookSignatureFails(): void
    {
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Firma de webhook no coincide');

        $payload = json_encode(['id' => 'evt_test']);
        $sigHeader = 'invalid_signature';
        $secret = 'whsec_mock';

        \stripe_verify_webhook_signature($payload, $sigHeader, $secret);
    }
}
