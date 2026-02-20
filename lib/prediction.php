<?php
declare(strict_types=1);

class NoShowPredictor
{
    /**
     * Predicts the risk of no-show for a given appointment.
     *
     * @param array $appointment Proposed appointment details (date, time, service, doctor)
     * @param array $history History of the patient (list of past appointments)
     * @return array Result with score (0.0-1.0), risk_level, and factors.
     */
    public static function predict(array $appointment, array $history): array
    {
        $score = 0.05; // Base risk
        $factors = [];

        // Factor 1: History of No-Shows
        $noShows = 0;
        $totalPast = 0;
        foreach ($history as $past) {
            $status = $past['status'] ?? 'confirmed';
            // Using loose comparison for status normalization if needed, but assuming strict string
            if ($status === 'no_show') {
                $noShows++;
            }
            // Count all valid past appointments (excluding explicit cancellations which might be rescheduled)
            // Or maybe cancelled counts towards total interaction?
            // Let's exclude cancelled for rate calculation unless late cancellation logic exists.
            if ($status !== 'cancelled') {
                $totalPast++;
            }
        }

        if ($totalPast > 0) {
            $rate = $noShows / $totalPast;
            if ($rate > 0.5) {
                $score += 0.4;
                $factors[] = 'high_no_show_rate';
            } elseif ($rate > 0) {
                $score += 0.2;
                $factors[] = 'history_of_no_shows';
            } else {
                $score -= 0.05; // Good history
                $factors[] = 'good_history';
            }
        } else {
            // New patient risk
            $score += 0.1;
            $factors[] = 'new_patient';
        }

        // Factor 2: Day of Week (Mondays and Fridays are higher risk?)
        $date = $appointment['date'] ?? '';
        if ($date) {
            $ts = strtotime($date);
            if ($ts) {
                $day = (int) date('N', $ts);
                if ($day === 1 || $day === 5) {
                    $score += 0.05;
                    $factors[] = 'high_risk_day';
                }
            }
        }

        // Factor 3: Time of Day (09:00 is higher risk?)
        $time = $appointment['time'] ?? '';
        if ($time === '09:00') {
            $score += 0.05;
            $factors[] = 'early_morning';
        }

        // Cap score
        if ($score > 1.0) $score = 1.0;
        if ($score < 0.0) $score = 0.0;

        // Risk Level
        $riskLevel = 'low';
        if ($score > 0.7) {
            $riskLevel = 'critical';
        } elseif ($score > 0.4) {
            $riskLevel = 'high';
        } elseif ($score > 0.2) {
            $riskLevel = 'medium';
        }

        return [
            'score' => round($score, 2),
            'risk_level' => $riskLevel,
            'factors' => $factors,
            'details' => [
                'total_past' => $totalPast,
                'no_shows' => $noShows
            ]
        ];
    }
}
