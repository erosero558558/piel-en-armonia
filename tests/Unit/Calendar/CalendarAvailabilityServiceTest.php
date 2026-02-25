<?php

declare(strict_types=1);

namespace Tests\Unit\Calendar;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../../lib/common.php';
require_once __DIR__ . '/../../../lib/metrics.php';
require_once __DIR__ . '/../../../lib/business.php';
require_once __DIR__ . '/../../../lib/calendar/runtime.php';

class CalendarAvailabilityServiceTest extends TestCase
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
        $this->rememberAndSetEnv('PIELARMONIA_REQUIRE_GOOGLE_CALENDAR', 'false');
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

    public function testGetBookedSlotsUsesLinearScanWhenIndexMissing(): void
    {
        $availability = \CalendarAvailabilityService::fromEnv();
        $date = '2023-10-25';

        $store = [
            'appointments' => [
                ['date' => $date, 'time' => '10:00', 'doctor' => 'rosero', 'status' => 'confirmed'],
                ['date' => '2023-10-26', 'time' => '11:00', 'doctor' => 'rosero', 'status' => 'confirmed'],
            ],
            // 'idx_appointments_date' is intentionally missing
            'availability' => [
                $date => ['10:00', '11:00'],
                '2023-10-26' => ['11:00']
            ]
        ];

        $result = $availability->getBookedSlots($store, $date, 'rosero');

        $this->assertTrue($result['ok']);
        $this->assertContains('10:00', $result['data']);
        $this->assertNotContains('11:00', $result['data']);
    }

    public function testGetBookedSlotsUsesIndexWhenPresent(): void
    {
        $availability = \CalendarAvailabilityService::fromEnv();
        $date = '2023-10-25';

        $store = [
            'appointments' => [
                ['date' => $date, 'time' => '10:00', 'doctor' => 'rosero', 'status' => 'confirmed'],
                ['date' => '2023-10-26', 'time' => '11:00', 'doctor' => 'rosero', 'status' => 'confirmed'],
                ['date' => $date, 'time' => '12:00', 'doctor' => 'rosero', 'status' => 'confirmed'],
            ],
            'idx_appointments_date' => [
                $date => [0, 2], // Indices 0 and 2 match the date
                '2023-10-26' => [1],
            ],
            'availability' => [
                $date => ['10:00', '12:00'],
                '2023-10-26' => ['11:00']
            ]
        ];

        $result = $availability->getBookedSlots($store, $date, 'rosero');

        $this->assertTrue($result['ok']);
        $this->assertContains('10:00', $result['data']);
        $this->assertContains('12:00', $result['data']);
        $this->assertNotContains('11:00', $result['data']);
    }

    public function testGetBookedSlotsHandlesEmptyIndex(): void
    {
        $availability = \CalendarAvailabilityService::fromEnv();
        $date = '2023-10-25';

        $store = [
            'appointments' => [
                 // No appointments
            ],
            'idx_appointments_date' => [
                 // No index for date
            ],
            'availability' => [
                $date => ['10:00']
            ]
        ];

        $result = $availability->getBookedSlots($store, $date, 'rosero');

        $this->assertTrue($result['ok']);
        $this->assertEmpty($result['data']);
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
