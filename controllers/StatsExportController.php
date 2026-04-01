<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/common.php';

final class StatsExportController
{
    public static function export(array $context): void
    {
        self::requireAuth();

        $store = read_store();
        $patients = $store['patients'] ?? [];
        $cases = $store['cases'] ?? $store['patient_cases'] ?? [];
        $appointments = $store['appointments'] ?? [];
        $events = $store['clinical_history_events'] ?? [];

        $totalPatients = count($patients);
        $totalCases = count($cases);

        $genderDist = [];
        $ageBrackets = ['0-12' => 0, '13-18' => 0, '19-35' => 0, '36-50' => 0, '51-65' => 0, '65+' => 0];
        $cie10Dist = [];
        $chronicConditions = [];

        foreach ($patients as $p) {
            $sex = strtolower(trim((string) ($p['sex'] ?? $p['gender'] ?? 'unknown')));
            if ($sex === '') $sex = 'unknown';
            $genderDist[$sex] = ($genderDist[$sex] ?? 0) + 1;

            if (!empty($p['birthDate'])) {
                try {
                    $dob = new DateTimeImmutable($p['birthDate']);
                    $age = (int) $dob->diff(new DateTimeImmutable())->y;
                    if ($age <= 12) {
                        $ageBrackets['0-12']++;
                    } elseif ($age <= 18) {
                        $ageBrackets['13-18']++;
                    } elseif ($age <= 35) {
                        $ageBrackets['19-35']++;
                    } elseif ($age <= 50) {
                        $ageBrackets['36-50']++;
                    } elseif ($age <= 65) {
                        $ageBrackets['51-65']++;
                    } else {
                        $ageBrackets['65+']++;
                    }
                } catch (\Throwable $e) {}
            }

            foreach (($p['chronicConditions'] ?? []) as $cond) {
                $code = $cond['cie10Code'] ?? 'unknown';
                $chronicConditions[$code] = ($chronicConditions[$code] ?? 0) + 1;
            }
        }

        foreach ($events as $e) {
            if (($e['type'] ?? '') === 'openclaw_diagnosis') {
                $code = $e['metadata']['cie10Code'] ?? 'unknown';
                $cie10Dist[$code] = ($cie10Dist[$code] ?? 0) + 1;
            }
        }

        arsort($cie10Dist);
        arsort($chronicConditions);

        json_response([
            'ok' => true,
            'summary' => [
                'total_patients' => $totalPatients,
                'total_cases' => $totalCases,
                'total_appointments' => count($appointments),
            ],
            'demographics' => [
                'gender_distribution' => $genderDist,
                'age_brackets' => $ageBrackets,
            ],
            'clinical' => [
                'cie10_distribution' => array_slice($cie10Dist, 0, 20, true),
                'top_chronic_conditions' => array_slice($chronicConditions, 0, 10, true),
            ]
        ]);
    }

    private static function requireAuth(): void
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        if (empty($_SESSION['admin_logged_in'])) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }
    }
}
