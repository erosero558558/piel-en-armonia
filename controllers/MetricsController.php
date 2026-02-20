<?php
declare(strict_types=1);

/**
 * Metrics Controller
 * Handles Prometheus metrics export with business metrics
 */

require_once __DIR__ . '/../api-lib.php';
require_once __DIR__ . '/../lib/metrics.php';

class MetricsController
{
    /**
     * GET /metrics - Export Prometheus metrics
     */
    public static function export(array $context): void
    {
        if (!class_exists('Metrics')) {
            http_response_code(500);
            die("Metrics library not loaded");
        }

        $store = $context['store'];

        header('Content-Type: text/plain; version=0.0.4');

        // Calculate Business Metrics from Store
        $revenueByDate = self::calculateRevenueByDate($store);
        $appointmentStats = self::calculateAppointmentStats($store);
        $serviceCounts = self::calculateServicePopularity($store);
        $avgLeadTime = self::calculateAverageLeadTime($store);

        // Output standard metrics
        echo Metrics::export();

        // Output business metrics
        self::outputRevenueMetrics($revenueByDate);
        self::outputAppointmentMetrics($appointmentStats);
        self::outputServiceMetrics($serviceCounts);
        self::outputNoShowRate($appointmentStats);
        self::outputStoreSize();
        self::outputLeadTime($avgLeadTime);

        exit;
    }

    /**
     * Calculate revenue by date from appointments
     */
    private static function calculateRevenueByDate(array $store): array
    {
        $revenueByDate = [];
        foreach ($store['appointments'] as $appt) {
            if (($appt['status'] ?? '') !== 'cancelled' && ($appt['paymentStatus'] ?? '') === 'paid') {
                $date = $appt['date'] ?? '';
                $service = $appt['service'] ?? '';
                $price = function_exists('get_service_price_amount') ? get_service_price_amount($service) : 0.0;
                if ($date && $price > 0) {
                    if (!isset($revenueByDate[$date])) {
                        $revenueByDate[$date] = 0;
                    }
                    $revenueByDate[$date] += $price;
                }
            }
        }
        return $revenueByDate;
    }

    /**
     * Calculate appointment statistics
     */
    private static function calculateAppointmentStats(array $store): array
    {
        $stats = ['confirmed' => 0, 'no_show' => 0, 'completed' => 0, 'cancelled' => 0];
        foreach ($store['appointments'] as $appt) {
            $st = function_exists('map_appointment_status')
                ? map_appointment_status((string) ($appt['status'] ?? 'confirmed'))
                : ($appt['status'] ?? 'confirmed');

            if (isset($stats[$st])) {
                $stats[$st]++;
            }
        }
        return $stats;
    }

    /**
     * Calculate service popularity
     */
    private static function calculateServicePopularity(array $store): array
    {
        $serviceCounts = [];
        foreach ($store['appointments'] as $appt) {
            $svc = $appt['service'] ?? 'unknown';
            if ($svc === '') $svc = 'unknown';
            if (!isset($serviceCounts[$svc])) $serviceCounts[$svc] = 0;
            $serviceCounts[$svc]++;
        }
        return $serviceCounts;
    }

    /**
     * Calculate average lead time (booking to appointment)
     */
    private static function calculateAverageLeadTime(array $store): ?float
    {
        $leadTimes = [];
        $now = time();

        foreach ($store['appointments'] as $appt) {
            if (($appt['status'] ?? '') === 'cancelled') continue;

            $bookedAt = isset($appt['dateBooked']) ? strtotime($appt['dateBooked']) : false;
            $apptTime = strtotime(($appt['date'] ?? '') . ' ' . ($appt['time'] ?? ''));

            // Only consider bookings made in the last 30 days
            if ($bookedAt && $apptTime && $bookedAt > ($now - 30 * 86400)) {
                $lead = $apptTime - $bookedAt;
                if ($lead > 0) $leadTimes[] = $lead;
            }
        }

        if (count($leadTimes) === 0) {
            return null;
        }

        return array_sum($leadTimes) / count($leadTimes);
    }

    /**
     * Output revenue metrics
     */
    private static function outputRevenueMetrics(array $revenueByDate): void
    {
        foreach ($revenueByDate as $date => $amount) {
            echo "\n# TYPE pielarmonia_revenue_daily_total gauge";
            echo "\npielarmonia_revenue_daily_total{date=\"$date\"} $amount";
        }
    }

    /**
     * Output appointment metrics
     */
    private static function outputAppointmentMetrics(array $stats): void
    {
        foreach ($stats as $st => $count) {
            echo "\n# TYPE pielarmonia_appointments_total gauge";
            echo "\npielarmonia_appointments_total{status=\"$st\"} $count";
        }
    }

    /**
     * Output service popularity metrics
     */
    private static function outputServiceMetrics(array $serviceCounts): void
    {
        foreach ($serviceCounts as $svc => $count) {
            echo "\n# TYPE pielarmonia_service_popularity_total gauge";
            echo "\npielarmonia_service_popularity_total{service=\"$svc\"} $count";
        }
    }

    /**
     * Output no-show rate
     */
    private static function outputNoShowRate(array $stats): void
    {
        $totalValid = $stats['confirmed'] + $stats['no_show'] + $stats['completed'];
        $rate = $totalValid > 0 ? ($stats['no_show'] / $totalValid) : 0;
        echo "\n# TYPE pielarmonia_no_show_rate gauge";
        echo "\npielarmonia_no_show_rate $rate\n";
    }

    /**
     * Output store file size
     */
    private static function outputStoreSize(): void
    {
        $storeSize = @filesize(data_file_path());
        if ($storeSize !== false) {
            echo "\n# TYPE pielarmonia_store_file_size_bytes gauge";
            echo "\npielarmonia_store_file_size_bytes $storeSize";
        }
    }

    /**
     * Output lead time metric
     */
    private static function outputLeadTime(?float $avgLead): void
    {
        if ($avgLead !== null) {
            echo "\n# TYPE pielarmonia_lead_time_seconds_avg gauge";
            echo "\npielarmonia_lead_time_seconds_avg $avgLead\n";
        }
    }
}
