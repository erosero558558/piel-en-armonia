<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
class AnalyticsRetentionMetricsTest extends TestCase
{
    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE']);

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../controllers/AnalyticsController.php';
    }

    protected function tearDown(): void
    {
        unset($GLOBALS['__TEST_RESPONSE']);
    }

    public function testGetFunnelMetricsIncludesRetentionSnapshot(): void
    {
        $context = [
            'store' => [
                'appointments' => [
                    [
                        'id' => 1,
                        'email' => 'alpha@example.com',
                        'phone' => '+593900111111',
                        'status' => 'completed',
                    ],
                    [
                        'id' => 2,
                        'email' => 'alpha@example.com',
                        'phone' => '+593900111111',
                        'status' => 'confirmed',
                    ],
                    [
                        'id' => 3,
                        'phone' => '+593900222222',
                        'status' => 'no_show',
                    ],
                    [
                        'id' => 4,
                        'email' => 'beta@example.com',
                        'status' => 'completed',
                    ],
                    [
                        'id' => 5,
                        'email' => 'gamma@example.com',
                        'status' => 'cancelled',
                    ],
                ],
            ],
        ];

        try {
            \AnalyticsController::getFunnelMetrics($context);
            $this->fail('Should have thrown TestingExitException');
        } catch (\TestingExitException $e) {
            $payload = $e->payload;
            $status = $e->status;

            $this->assertSame(200, $status);
            $this->assertTrue((bool) ($payload['ok'] ?? false));
            $this->assertArrayHasKey('data', $payload);
            $this->assertArrayHasKey('retention', $payload['data']);

            $retention = $payload['data']['retention'];
            $this->assertSame(5, (int) ($retention['appointmentsTotal'] ?? -1));
            $this->assertSame(4, (int) ($retention['appointmentsNonCancelled'] ?? -1));

            $statusCounts = $retention['statusCounts'] ?? [];
            $this->assertSame(1, (int) ($statusCounts['confirmed'] ?? -1));
            $this->assertSame(2, (int) ($statusCounts['completed'] ?? -1));
            $this->assertSame(1, (int) ($statusCounts['noShow'] ?? -1));
            $this->assertSame(1, (int) ($statusCounts['cancelled'] ?? -1));

            $this->assertSame(25.0, (float) ($retention['noShowRatePct'] ?? -1));
            $this->assertSame(50.0, (float) ($retention['completionRatePct'] ?? -1));
            $this->assertSame(3, (int) ($retention['uniquePatients'] ?? -1));
            $this->assertSame(1, (int) ($retention['recurrentPatients'] ?? -1));
            $this->assertSame(33.3, (float) ($retention['recurrenceRatePct'] ?? -1));
        }
    }
}
