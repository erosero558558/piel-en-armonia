<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
class AnalyticsRetentionReportTest extends TestCase
{
    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../controllers/AnalyticsController.php';
    }

    protected function tearDown(): void
    {
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
    }

    public function testRetentionReportJsonIncludesSummarySeriesAndMeta(): void
    {
        $_GET['dateFrom'] = '2026-02-20';
        $_GET['dateTo'] = '2026-02-21';

        $context = [
            'store' => [
                'appointments' => [
                    [
                        'id' => 1,
                        'date' => '2026-02-20',
                        'status' => 'no_show',
                        'email' => 'alpha@example.com',
                        'doctor' => 'rosero',
                        'service' => 'consulta',
                    ],
                    [
                        'id' => 2,
                        'date' => '2026-02-20',
                        'status' => 'completed',
                        'email' => 'beta@example.com',
                        'doctor' => 'rosero',
                        'service' => 'consulta',
                    ],
                    [
                        'id' => 3,
                        'date' => '2026-02-21',
                        'status' => 'confirmed',
                        'email' => 'alpha@example.com',
                        'doctor' => 'narvaez',
                        'service' => 'acne',
                    ],
                    [
                        'id' => 4,
                        'date' => '2026-02-21',
                        'status' => 'cancelled',
                        'email' => 'gamma@example.com',
                        'doctor' => 'narvaez',
                        'service' => 'acne',
                    ],
                ],
            ],
        ];

        try {
            \AnalyticsController::getRetentionReport($context);
            $this->fail('Should have thrown TestingExitException');
        } catch (\TestingExitException $e) {
            $this->assertSame(200, $e->status);
            $payload = $e->payload;
            $this->assertTrue((bool) ($payload['ok'] ?? false));
            $this->assertArrayHasKey('data', $payload);

            $data = is_array($payload['data'] ?? null) ? $payload['data'] : [];
            $meta = is_array($data['meta'] ?? null) ? $data['meta'] : [];
            $summary = is_array($data['summary'] ?? null) ? $data['summary'] : [];
            $series = is_array($data['series'] ?? null) ? $data['series'] : [];
            $alerts = is_array($data['alerts'] ?? null) ? $data['alerts'] : [];

            $this->assertSame('2026-02-20', (string) ($meta['dateFrom'] ?? ''));
            $this->assertSame('2026-02-21', (string) ($meta['dateTo'] ?? ''));
            $this->assertSame('json', (string) ($meta['format'] ?? ''));
            $this->assertSame(2, (int) ($meta['days'] ?? -1));

            $statusCounts = is_array($summary['statusCounts'] ?? null) ? $summary['statusCounts'] : [];
            $this->assertSame(4, (int) ($summary['appointmentsTotal'] ?? -1));
            $this->assertSame(3, (int) ($summary['appointmentsNonCancelled'] ?? -1));
            $this->assertSame(1, (int) ($statusCounts['confirmed'] ?? -1));
            $this->assertSame(1, (int) ($statusCounts['completed'] ?? -1));
            $this->assertSame(1, (int) ($statusCounts['noShow'] ?? -1));
            $this->assertSame(1, (int) ($statusCounts['cancelled'] ?? -1));
            $this->assertSame(2, (int) ($summary['uniquePatients'] ?? -1));
            $this->assertSame(1, (int) ($summary['recurrentPatients'] ?? -1));
            $this->assertEquals(33.33, (float) ($summary['noShowRatePct'] ?? -1));
            $this->assertEquals(50.0, (float) ($summary['recurrenceRatePct'] ?? -1));

            $this->assertCount(2, $series);
            $first = is_array($series[0] ?? null) ? $series[0] : [];
            $firstStatus = is_array($first['statusCounts'] ?? null) ? $first['statusCounts'] : [];
            $this->assertSame('2026-02-20', (string) ($first['date'] ?? ''));
            $this->assertSame(2, (int) ($first['appointmentsTotal'] ?? -1));
            $this->assertSame(2, (int) ($first['appointmentsNonCancelled'] ?? -1));
            $this->assertSame(1, (int) ($firstStatus['completed'] ?? -1));
            $this->assertSame(1, (int) ($firstStatus['noShow'] ?? -1));
            $this->assertEquals(50.0, (float) ($first['noShowRatePct'] ?? -1));
            $this->assertEquals(50.0, (float) ($first['completionRatePct'] ?? -1));
            $this->assertSame(2, (int) ($first['uniquePatients'] ?? -1));

            $this->assertCount(0, $alerts);
        }
    }

    public function testRetentionReportCsvFormatReturnsCsvPayloadInTesting(): void
    {
        $_GET['dateFrom'] = '2026-02-20';
        $_GET['dateTo'] = '2026-02-20';
        $_GET['format'] = 'csv';

        $context = [
            'store' => [
                'appointments' => [
                    [
                        'id' => 10,
                        'date' => '2026-02-20',
                        'status' => 'completed',
                        'email' => 'csv@example.com',
                        'doctor' => 'rosero',
                        'service' => 'consulta',
                    ],
                ],
            ],
        ];

        try {
            \AnalyticsController::getRetentionReport($context);
            $this->fail('Should have thrown TestingExitException');
        } catch (\TestingExitException $e) {
            $this->assertSame(200, $e->status);
            $payload = $e->payload;
            $this->assertTrue((bool) ($payload['ok'] ?? false));
            $this->assertSame('csv', (string) ($payload['format'] ?? ''));

            $csv = (string) ($payload['csv'] ?? '');
            $this->assertStringContainsString('date,appointments_total', $csv);
            $this->assertStringContainsString('"2026-02-20",1,1,0,1,0,0,0,100,1', $csv);
            $this->assertStringContainsString('TOTAL,1,1,0,1,0,0,0,100,1', $csv);
        }
    }
}
