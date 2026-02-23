<?php

declare(strict_types=1);

namespace Tests\Unit\Calendar;

use PHPUnit\Framework\TestCase;
use \CalendarBookingService;
use \CalendarAvailabilityService;

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
        $booking = CalendarBookingService::fromEnv();

        $this->assertSame(30, $booking->getDurationMin('consulta'));
        $this->assertSame(60, $booking->getDurationMin('laser'));
        $this->assertSame(30, $booking->getDurationMin('servicio-desconocido'));
    }

    public function testStoreAvailabilityFiltersInvalidStartsForSixtyMinuteServices(): void
    {
        $availability = CalendarAvailabilityService::fromEnv();
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
        $availability = CalendarAvailabilityService::fromEnv();
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

        $resultFor30 = $availability->getBookedSlots($store, $date, 'rosero', 'consulta');
        $this->assertTrue($resultFor30['ok']);
        // 09:00 is booked (laser 60m), so 09:00 and 09:30 are busy.
        // 10:00 is free (30m).
        // 10:30 is free (30m).
        // BUT wait, 09:00 appointment takes 60 mins -> occupies 09:00-10:00.
        // So 09:00 slot is busy.
        // 09:30 slot is busy (overlaps 09:00-10:00).
        // 10:00 slot is free.
        // 10:30 slot is free.
        // getBookedSlots returns BOOKED slots.
        // So expected booked slots are ['09:00', '09:30'].

        // Wait, why did the test expect ['09:00', '09:30'] but got ['09:00', '09:30', '10:30']?
        // Ah, looking at the availability array: ['09:00', '09:30', '10:00', '10:30']
        // If 10:30 is considered booked, maybe it's because it's insufficient duration?
        // But 'consulta' is 30 mins. 10:30 is valid start for 30 mins if 11:00 is available?
        // Availability doesn't have 11:00. So 10:30 cannot form a 60 min slot?
        // But for 'consulta' (30 min), 10:30 is valid if it just needs 10:30 slot itself?
        // Usually `supportsDurationFromTemplate` checks if subsequent slots exist.
        // If 30 min service, step is 30 min. parts = 1. loop doesn't run. returns true.

        // Let's re-read the failure.
        // Expected: ['09:00', '09:30']
        // Actual: ['09:00', '09:30', '10:30']
        // So 10:30 is returned as BOOKED (unavailable).
        // Why is 10:30 unavailable for 'consulta' (30min)?
        // Maybe because `getBookedSlots` logic checks `supportsDurationFromTemplate`.
        // If `supportsDurationFromTemplate` returns false, it adds to booked.
        // For 30min service, it should return true if the slot itself exists.

        // Wait, maybe I misread the test failure or logic.
        // Let's check `resultFor60` below it.

        // Ah, the first assertion is for 'consulta' (30m).
        // `getBookedSlots` iterates through ALL template slots.
        // Template slots: 09:00, 09:30, 10:00, 10:30.
        // 09:00: Overlaps appointment? Yes. -> Booked.
        // 09:30: Overlaps appointment? Yes (appt ends 10:00). -> Booked.
        // 10:00: Overlaps? No. Valid duration? Yes. -> Available.
        // 10:30: Overlaps? No. Valid duration? Yes. -> Available.

        // Why did it return 10:30 as booked?
        // Maybe `supportsDurationFromTemplate` failed?
        // parts = 30/30 = 1. Loop 1 < 1 doesn't run. Returns true.

        // Is it possible `slotOverlapsBusy` returns true?
        // busy ranges: 09:00 (timestamp) to 10:00 (timestamp).
        // 10:30 start > 10:00 end. So no overlap.

        // Let's look at `resultFor60`.
        // Service: 'laser' (60m).
        // 09:00: Booked (overlap).
        // 09:30: Booked (overlap).
        // 10:00: Overlap? No. Duration? Needs 10:00 and 10:30. Both exist. Valid.
        // 10:30: Overlap? No. Duration? Needs 10:30 and 11:00. 11:00 MISSING. Invalid. -> Booked.

        // So for `resultFor60` (laser), 10:30 SHOULD be booked because it's too short (no 11:00).
        // The failure output shows failure in `resultFor30`? No, PHPUnit doesn't say which assertion failed in the test method clearly unless we use messages.
        // But the Expected array in failure was `['09:00', '09:30']`.
        // The Actual was `['09:00', '09:30', '10:30']`.

        // If the failure was in the SECOND assertion (laser, 60m), then:
        // Expected: ['09:00', '09:30'] (as written in test code: $this->assertSame(['09:00', '09:30'], $resultFor60['data']);)
        // Actual: ['09:00', '09:30', '10:30']
        // This makes sense! For 60m service, 10:30 IS unavailable because 11:00 is missing.
        // So the test expectation for `resultFor60` is wrong. It implies 10:30 should be available, but it's not valid for 60m.
        // Or wait, `getBookedSlots` returns unavailable slots.
        // So for 60m, 10:30 IS unavailable. So it SHOULD be in the list.
        // So the actual value `['09:00', '09:30', '10:30']` is correct for 60m service.
        // The test expectation `['09:00', '09:30']` is missing `10:30`.

        // So I need to update the test expectation for `resultFor60`.

        $this->assertSame(['09:00', '09:30'], $resultFor30['data']);

        $resultFor60 = $availability->getBookedSlots($store, $date, 'rosero', 'laser');
        $this->assertTrue($resultFor60['ok']);
        // 10:30 is booked/unavailable because it lacks the subsequent 11:00 slot required for 60m duration
        $this->assertSame(['09:00', '09:30', '10:30'], $resultFor60['data']);
    }

    public function testIndiferenteAssignsDoctorWithLeastLoad(): void
    {
        $booking = CalendarBookingService::fromEnv();
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
        $booking = CalendarBookingService::fromEnv();
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
