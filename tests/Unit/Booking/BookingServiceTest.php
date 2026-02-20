<?php
declare(strict_types=1);

namespace Tests\Unit\Booking;

use PHPUnit\Framework\TestCase;
<<<<<<< HEAD

// Include the business logic file
// It requires 'common.php' and 'validation.php' so we assume they are present
require_once __DIR__ . '/../../../lib/business.php';

class BookingServiceTest extends TestCase
{
    public function testGetServicesConfigReturnsArray(): void
    {
        $config = get_services_config();
        $this->assertIsArray($config);
        $this->assertArrayHasKey('consulta', $config);
        $this->assertArrayHasKey('laser', $config);
    }

    public function testGetServicePriceBreakdownStructure(): void
    {
        $breakdown = get_service_price_breakdown('consulta');

        $this->assertIsArray($breakdown);
        $this->assertArrayHasKey('service_id', $breakdown);
        $this->assertArrayHasKey('pricing', $breakdown);
        $this->assertArrayHasKey('formatted', $breakdown);

        $this->assertEquals('consulta', $breakdown['service_id']);
        $this->assertEquals(40.0, $breakdown['pricing']['base_amount']);
    }

    public function testComputeTaxCalculation(): void
    {
        // Test with 15% tax
        $base = 100.0;
        $taxRate = 0.15;
        $tax = compute_tax($base, $taxRate);
        $total = compute_total($base, $taxRate);

        $this->assertEquals(15.0, $tax);
        $this->assertEquals(115.0, $total);
    }

    public function testValidatePaymentAmount(): void
    {
        // Consulta base is 40.00, tax 0% -> total 40.00
        $service = 'consulta';
        $amount = 40.00;

        $result = validate_payment_amount($service, $amount);
        $this->assertTrue($result['valid']);

        // Test invalid amount
        $invalidAmount = 30.00;
        $resultInvalid = validate_payment_amount($service, $invalidAmount);
        $this->assertFalse($resultInvalid['valid']);
        $this->assertArrayHasKey('error', $resultInvalid);
    }

    public function testAppointmentSlotTakenLogic(): void
    {
        $appointments = [
            [
                'date' => '2024-01-01',
                'time' => '10:00',
                'status' => 'confirmed',
                'doctor' => 'rosero',
                'id' => 1
            ],
            [
                'date' => '2024-01-01',
                'time' => '11:00',
                'status' => 'cancelled', // Cancelled should be free
                'doctor' => 'rosero',
                'id' => 2
            ]
        ];

        // Slot taken
        $this->assertTrue(
            appointment_slot_taken($appointments, '2024-01-01', '10:00'),
            'Slot 10:00 should be taken'
        );

        // Slot free (cancelled)
        $this->assertFalse(
            appointment_slot_taken($appointments, '2024-01-01', '11:00'),
            'Slot 11:00 should be free because it is cancelled'
        );

        // Slot free (different time)
        $this->assertFalse(
            appointment_slot_taken($appointments, '2024-01-01', '12:00'),
            'Slot 12:00 should be free'
        );

        // Slot free (checking against self excluded)
        $this->assertFalse(
            appointment_slot_taken($appointments, '2024-01-01', '10:00', 1),
            'Slot 10:00 should be free if checking against self (id 1)'
        );
    }

    public function testGetVatRateUsesEnvironmentVariable(): void
    {
        // Save current env
        $original = getenv('PIELARMONIA_VAT_RATE');

        // Set new env
        putenv('PIELARMONIA_VAT_RATE=20'); // 20%

        $rate = get_vat_rate();
        $this->assertEquals(0.20, $rate);

        // Set as decimal
        putenv('PIELARMONIA_VAT_RATE=0.10');
        $rate = get_vat_rate();
        $this->assertEquals(0.10, $rate);

        // Restore
        if ($original !== false) {
            putenv("PIELARMONIA_VAT_RATE=$original");
        } else {
            putenv('PIELARMONIA_VAT_RATE');
        }
=======
use BookingService;

// Ensure BookingService is loaded
require_once __DIR__ . '/../../../lib/BookingService.php';

// Stub global functions for payment if they don't exist
if (!function_exists('payment_gateway_enabled')) {
    function payment_gateway_enabled(): bool {
        return true;
    }
}
if (!function_exists('stripe_get_payment_intent')) {
    function stripe_get_payment_intent(string $id): array {
        if ($id === 'pi_valid') {
            return [
                'status' => 'succeeded',
                'amount' => 4000, // 40 + 0% = 40.00
                'currency' => 'usd',
                'amount_received' => 4000,
                'metadata' => [
                    'site' => 'pielarmonia.com',
                    'service' => 'consulta',
                    'date' => '2025-01-01',
                    'time' => '10:00',
                    'doctor' => 'rosero'
                ]
            ];
        }
        throw new \RuntimeException('Payment error');
    }
}
if (!function_exists('payment_expected_amount_cents')) {
    function payment_expected_amount_cents(string $service): int {
        return 4000;
    }
}
if (!function_exists('payment_currency')) {
    function payment_currency(): string {
        return 'USD';
    }
}
// Override local_date to return a fixed date for past date testing?
// No, we can't redefine existing functions easily.
// We will use relative dates for testing.

class BookingServiceTest extends TestCase
{
    private BookingService $service;
    private array $emptyStore;

    protected function setUp(): void
    {
        $this->service = new BookingService();
        $this->emptyStore = [
            'appointments' => [],
            'availability' => [],
            'reviews' => [],
            'callbacks' => []
        ];
    }

    public function testCreateSuccess(): void
    {
        $futureDate = date('Y-m-d', strtotime('+1 day'));
        $store = $this->emptyStore;
        $store['availability'][$futureDate] = ['10:00'];

        $payload = [
            'name' => 'John Doe',
            'email' => 'john@example.com',
            'phone' => '0991234567',
            'date' => $futureDate,
            'time' => '10:00',
            'doctor' => 'rosero',
            'service' => 'consulta',
            'privacyConsent' => true,
            'paymentMethod' => 'cash'
        ];

        $result = $this->service->create($store, $payload);

        $this->assertTrue($result['ok']);
        $this->assertEquals(201, $result['code']);
        $this->assertCount(1, $result['store']['appointments']);
        $this->assertEquals('pending_cash', $result['data']['paymentStatus']);
    }

    public function testCreateSlotConflict(): void
    {
        $futureDate = date('Y-m-d', strtotime('+1 day'));
        $store = $this->emptyStore;
        $store['availability'][$futureDate] = ['10:00'];

        // Existing appointment
        $store['appointments'][] = [
            'id' => 1,
            'date' => $futureDate,
            'time' => '10:00',
            'doctor' => 'rosero',
            'status' => 'confirmed'
        ];

        $payload = [
            'name' => 'Jane Doe',
            'email' => 'jane@example.com',
            'phone' => '0991234567',
            'date' => $futureDate,
            'time' => '10:00',
            'doctor' => 'rosero',
            'service' => 'consulta',
            'privacyConsent' => true,
            'paymentMethod' => 'cash'
        ];

        $result = $this->service->create($store, $payload);

        $this->assertFalse($result['ok']);
        $this->assertEquals(409, $result['code']);
        $this->assertEquals('Ese horario ya fue reservado', $result['error']);
    }

    public function testCreatePastDate(): void
    {
        $pastDate = date('Y-m-d', strtotime('-1 day'));
        $store = $this->emptyStore;

        $payload = [
            'name' => 'John Doe',
            'email' => 'john@example.com',
            'phone' => '0991234567',
            'date' => $pastDate,
            'time' => '10:00',
            'doctor' => 'rosero',
            'service' => 'consulta',
            'privacyConsent' => true,
            'paymentMethod' => 'cash'
        ];

        $result = $this->service->create($store, $payload);

        $this->assertFalse($result['ok']);
        $this->assertEquals(400, $result['code']);
        $this->assertStringContainsString('pasada', $result['error']);
    }

    public function testCancel(): void
    {
        $store = $this->emptyStore;
        $store['appointments'][] = [
            'id' => 123,
            'date' => '2025-01-01',
            'status' => 'confirmed'
        ];

        $result = $this->service->cancel($store, 123);

        $this->assertTrue($result['ok']);
        $this->assertEquals(200, $result['code']);

        // Verify in store
        $cancelled = null;
        foreach ($result['store']['appointments'] as $appt) {
            if ($appt['id'] === 123) {
                $cancelled = $appt;
                break;
            }
        }
        $this->assertEquals('cancelled', $cancelled['status']);
    }

    public function testRescheduleSuccess(): void
    {
        $futureDate = date('Y-m-d', strtotime('+2 days'));
        $originalDate = date('Y-m-d', strtotime('+1 day'));

        $store = $this->emptyStore;
        $store['availability'][$futureDate] = ['11:00'];
        $store['appointments'][] = [
            'id' => 123,
            'date' => $originalDate,
            'time' => '10:00',
            'doctor' => 'rosero',
            'status' => 'confirmed',
            'rescheduleToken' => 'token_1234567890123456'
        ];

        $result = $this->service->reschedule($store, 'token_1234567890123456', $futureDate, '11:00');

        $this->assertTrue($result['ok']);
        $this->assertEquals(200, $result['code']);

        $updated = null;
        foreach ($result['store']['appointments'] as $appt) {
            if ($appt['id'] === 123) {
                $updated = $appt;
                break;
            }
        }
        $this->assertEquals($futureDate, $updated['date']);
        $this->assertEquals('11:00', $updated['time']);
>>>>>>> origin/test-coverage-and-refactor-17521770790336322433
    }
}
