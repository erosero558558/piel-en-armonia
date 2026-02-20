<?php
declare(strict_types=1);

namespace Tests\Unit\Booking;

use BookingService;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../../lib/BookingService.php';

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

    private function futureDate(int $days = 1): string
    {
        return date('Y-m-d', strtotime('+' . $days . ' day'));
    }

    public function testCreateAppointmentSuccessWithCash(): void
    {
        $date = $this->futureDate(1);
        $store = $this->emptyStore;
        $store['availability'][$date] = ['10:00'];

        $payload = [
            'name' => 'John Doe',
            'email' => 'john@example.com',
            'phone' => '0981234567',
            'date' => $date,
            'time' => '10:00',
            'doctor' => 'rosero',
            'service' => 'consulta',
            'privacyConsent' => true,
            'paymentMethod' => 'cash'
        ];

        $result = $this->service->create($store, $payload);

        $this->assertTrue($result['ok']);
        $this->assertSame(201, $result['code']);
        $this->assertCount(1, $result['store']['appointments']);
        $this->assertSame('pending_cash', $result['data']['paymentStatus']);
    }

    public function testCreateAppointmentFailsWhenSlotTaken(): void
    {
        $date = $this->futureDate(1);
        $store = $this->emptyStore;
        $store['availability'][$date] = ['10:00'];
        $store['appointments'][] = [
            'id' => 1,
            'date' => $date,
            'time' => '10:00',
            'doctor' => 'rosero',
            'status' => 'confirmed'
        ];

        $payload = [
            'name' => 'Jane Doe',
            'email' => 'jane@example.com',
            'phone' => '0995550000',
            'date' => $date,
            'time' => '10:00',
            'doctor' => 'rosero',
            'service' => 'consulta',
            'privacyConsent' => true,
            'paymentMethod' => 'cash'
        ];

        $result = $this->service->create($store, $payload);

        $this->assertFalse($result['ok']);
        $this->assertSame(409, $result['code']);
        $this->assertStringContainsString('reservado', strtolower((string) $result['error']));
    }

    public function testCreateAppointmentFailsWithoutPrivacyConsent(): void
    {
        $date = $this->futureDate(2);
        $store = $this->emptyStore;
        $store['availability'][$date] = ['11:00'];

        $payload = [
            'name' => 'No Consent',
            'email' => 'noconsent@example.com',
            'phone' => '0980000000',
            'date' => $date,
            'time' => '11:00',
            'doctor' => 'rosero',
            'service' => 'consulta',
            'privacyConsent' => false,
            'paymentMethod' => 'cash'
        ];

        $result = $this->service->create($store, $payload);

        $this->assertFalse($result['ok']);
        $this->assertSame(400, $result['code']);
        $this->assertStringContainsString('datos', strtolower((string) $result['error']));
    }

    public function testCancelAppointmentChangesStatus(): void
    {
        $store = $this->emptyStore;
        $store['appointments'][] = [
            'id' => 123,
            'date' => $this->futureDate(4),
            'time' => '09:00',
            'doctor' => 'rosero',
            'status' => 'confirmed'
        ];

        $result = $this->service->cancel($store, 123);

        $this->assertTrue($result['ok']);
        $this->assertSame(200, $result['code']);
        $this->assertSame('cancelled', $result['data']['status']);
    }

    public function testRescheduleAppointmentSuccess(): void
    {
        $originalDate = $this->futureDate(2);
        $newDate = $this->futureDate(3);

        $store = $this->emptyStore;
        $store['availability'][$newDate] = ['11:00'];
        $store['appointments'][] = [
            'id' => 123,
            'date' => $originalDate,
            'time' => '10:00',
            'doctor' => 'rosero',
            'status' => 'confirmed',
            'rescheduleToken' => 'token_1234567890abcd'
        ];

        $result = $this->service->reschedule($store, 'token_1234567890abcd', $newDate, '11:00');

        $this->assertTrue($result['ok']);
        $this->assertSame(200, $result['code']);
        $this->assertSame($newDate, $result['data']['date']);
        $this->assertSame('11:00', $result['data']['time']);
    }
}
