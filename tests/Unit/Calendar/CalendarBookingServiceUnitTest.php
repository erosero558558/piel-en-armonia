<?php

declare(strict_types=1);

namespace Tests\Unit\Calendar;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../../lib/common.php';
require_once __DIR__ . '/../../../lib/metrics.php';
require_once __DIR__ . '/../../../lib/business.php';
require_once __DIR__ . '/../../../lib/models.php';
require_once __DIR__ . '/../../../lib/storage.php';
require_once __DIR__ . '/../../../lib/audit.php';
require_once __DIR__ . '/../../../lib/calendar/GoogleTokenProvider.php';
require_once __DIR__ . '/../../../lib/calendar/GoogleCalendarClient.php';
require_once __DIR__ . '/../../../lib/calendar/CalendarAvailabilityService.php';
require_once __DIR__ . '/../../../lib/calendar/CalendarBookingService.php';

class CalendarBookingServiceUnitTest extends TestCase
{
    private string $tempDir;
    /** @var array<string,string> */
    private array $originalEnv = [];

    protected function setUp(): void
    {
        $this->tempDir = sys_get_temp_dir() . '/pielarmonia-calendar-unit-' . bin2hex(random_bytes(6));
        if (!is_dir($this->tempDir)) {
            mkdir($this->tempDir, 0777, true);
        }

        $this->rememberAndSetEnv('PIELARMONIA_DATA_DIR', $this->tempDir);
        $this->rememberAndSetEnv('PIELARMONIA_AVAILABILITY_SOURCE', 'store');
        $this->rememberAndSetEnv('PIELARMONIA_CALENDAR_SLOT_STEP_MIN', '30');
        $this->rememberAndSetEnv('PIELARMONIA_SERVICE_DURATION_MAP', 'consulta:30,telefono:30,video:30,acne:30,cancer:30,laser:60,rejuvenecimiento:60');
    }

    protected function tearDown(): void
    {
        foreach ($this->originalEnv as $key => $value) {
            putenv($key . '=' . $value);
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
        }

        if (is_dir($this->tempDir)) {
            $this->removeDirectory($this->tempDir);
        }
    }

    public function testServiceDurationMapIsApplied(): void
    {
        $booking = \CalendarBookingService::fromEnv();

        $this->assertSame(30, $booking->getDurationMin('consulta'));
        $this->assertSame(60, $booking->getDurationMin('laser'));
        $this->assertSame(30, $booking->getDurationMin('servicio-desconocido'));
    }

    public function testStoreAvailabilityFiltersInvalidStartsForSixtyMinuteServices(): void
    {
        $availability = \CalendarAvailabilityService::fromEnv();
        $date = date('Y-m-d', strtotime('+2 day'));

        $store = [
            'appointments' => [],
            'callbacks' => [],
            'reviews' => [],
            'availability' => [
                $date => ['09:00', '09:30', '10:30'],
            ],
        ];

        $result = $availability->getAvailability($store, [
            'doctor' => 'indiferente',
            'service' => 'laser',
            'dateFrom' => $date,
            'days' => 1,
        ]);

        $this->assertTrue($result['ok']);
        $this->assertSame(['09:00'], $result['data'][$date]);
    }

    public function testStoreBookedSlotsRespectOverlapAndDuration(): void
    {
        $availability = \CalendarAvailabilityService::fromEnv();
        $date = date('Y-m-d', strtotime('+2 day'));

        $store = [
            'appointments' => [
                [
                    'id' => 99,
                    'date' => $date,
                    'time' => '09:00',
                    'doctor' => 'rosero',
                    'service' => 'laser',
                    'slotDurationMin' => 60,
                    'status' => 'confirmed',
                ],
            ],
            'callbacks' => [],
            'reviews' => [],
            'availability' => [
                $date => ['09:00', '09:30', '10:00', '10:30'],
            ],
        ];

        // 30 min booking:
        // Booked (60m @ 09:00) blocks 09:00-10:00.
        // Slots: 09:00, 09:30, 10:00, 10:30
        // Overlap: 09:00 (blocked), 09:30 (blocked), 10:00 (free), 10:30 (free)
        // Booked list returned should be [09:00, 09:30]
        $resultFor30 = $availability->getBookedSlots($store, $date, 'rosero', 'consulta');
        $this->assertTrue($resultFor30['ok']);
        $this->assertSame(['09:00', '09:30'], $resultFor30['data']);

        // 60 min booking (laser):
        // Duration 60m.
        // Slots: 09:00, 09:30, 10:00, 10:30
        // 09:00: Blocked by appt.
        // 09:30: Blocked by appt.
        // 10:00: Free (10:00-11:00). 10:30 is in availability. 11:00 is implicitly free or not checked?
        // Actually, logic checks if [start, end] is covered by available slots OR not overlapped by busy.
        // `getBookedSlots` returns slots that are BUSY or insufficient.
        // The implementation of `supportsDurationFromTemplate` checks if subsequent slots exist.
        // For 10:00 (60m), it needs 10:00 and 10:30. Both exist in availability.
        // For 10:30 (60m), it needs 10:30 and 11:00. 11:00 is NOT in availability.
        // So 10:30 should be returned as "booked" (unavailable for duration).
        // Booked: 09:00, 09:30, 10:30.
        $resultFor60 = $availability->getBookedSlots($store, $date, 'rosero', 'laser');
        $this->assertTrue($resultFor60['ok']);
        $this->assertSame(['09:00', '09:30', '10:30'], $resultFor60['data']);
    }

    public function testIndiferenteAssignsDoctorWithLeastLoad(): void
    {
        $booking = \CalendarBookingService::fromEnv();
        $date = date('Y-m-d', strtotime('+3 day'));

        $store = [
            'appointments' => [
                [
                    'id' => 1,
                    'date' => $date,
                    'time' => '08:30',
                    'doctor' => 'rosero',
                    'status' => 'confirmed',
                ],
                [
                    'id' => 2,
                    'date' => $date,
                    'time' => '09:30',
                    'doctor' => 'rosero',
                    'status' => 'confirmed',
                ],
            ],
            'callbacks' => [],
            'reviews' => [],
            'availability' => [
                $date => ['10:00', '10:30'],
            ],
            'meta' => [
                'indiferenteCursor' => 'rosero',
            ],
        ];

        $assigned = $booking->assignDoctorForIndiferente($store, $date, '10:00', 'consulta');

        $this->assertTrue($assigned['ok']);
        $this->assertSame('narvaez', $assigned['doctor']);
    }

    public function testIndiferenteTieBreakUsesCursorAndThenAdvances(): void
    {
        $booking = \CalendarBookingService::fromEnv();
        $date = date('Y-m-d', strtotime('+4 day'));

        $store = [
            'appointments' => [],
            'callbacks' => [],
            'reviews' => [],
            'availability' => [
                $date => ['11:00', '11:30'],
            ],
            'meta' => [
                'indiferenteCursor' => 'narvaez',
            ],
        ];

        $assigned = $booking->assignDoctorForIndiferente($store, $date, '11:00', 'consulta');

        $this->assertTrue($assigned['ok']);
        $this->assertSame('narvaez', $assigned['doctor']);

        $booking->advanceIndiferenteCursor($store, $assigned['doctor']);
        $this->assertSame('rosero', $store['meta']['indiferenteCursor']);
    }

    private function rememberAndSetEnv(string $key, string $value): void
    {
        if (!array_key_exists($key, $this->originalEnv)) {
            $this->originalEnv[$key] = (string) (getenv($key) ?: '');
        }
        putenv($key . '=' . $value);
        $_ENV[$key] = $value;
        $_SERVER[$key] = $value;
    }

    private function removeDirectory(string $dir): void
    {
        $items = @scandir($dir);
        if (!is_array($items)) {
            return;
        }
        foreach ($items as $item) {
            if ($item === '.' || $item === '..') {
                continue;
            }
            $path = $dir . DIRECTORY_SEPARATOR . $item;
            if (is_dir($path)) {
                $this->removeDirectory($path);
            } else {
                @unlink($path);
            }
        }
        @rmdir($dir);
    }
}
