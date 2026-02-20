<?php
declare(strict_types=1);

namespace Tests\Unit\Booking;

use PHPUnit\Framework\TestCase;

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
    }
}
