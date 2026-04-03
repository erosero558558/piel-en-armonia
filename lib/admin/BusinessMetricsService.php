<?php

declare(strict_types=1);

final class BusinessMetricsService
{
public static function buildReviewsMeta(array $store): array
    {
        $surveys = is_array($store['nps_surveys'] ?? null) ? $store['nps_surveys'] : [];
        if (count($surveys) === 0) {
            return [
                'totalReviews' => 0,
                'averageRating' => 0.0,
                'last5Reviews' => [],
            ];
        }

        $totalRating = 0;
        $count = 0;
        $last5 = [];
        
        // Assume surveys are chronologically appended to store
        $reversed = array_reverse($surveys);

        foreach ($reversed as $index => $survey) {
            $rating = (int) ($survey['rating'] ?? 0);
            if ($rating >= 1 && $rating <= 5) {
                $totalRating += $rating;
                $count++;
                if ($index < 5) {
                    $last5[] = [
                        'name' => trim((string) ($survey['name'] ?? 'Anónimo')),
                        'rating' => $rating,
                        'text' => trim((string) ($survey['text'] ?? '')),
                        'date' => format_date_label(trim((string) ($survey['date'] ?? '')))
                    ];
                }
            }
        }

        return [
            'totalReviews' => $count,
            'averageRating' => $count > 0 ? (float) ($totalRating / $count) : 0.0,
            'last5Reviews' => $last5,
        ];
    }

public static function businessMetrics(array $context): void
    {
        $store = $context['store'];
        if (!($context['isAdmin'] ?? false)) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }

        $periodString = trim((string)($_GET['period'] ?? '30d'));
        $periodDays = (int) preg_replace('/[^0-9]/', '', $periodString);
        if ($periodDays <= 0) $periodDays = 30;

        $cutoff = time() - ($periodDays * 86400);

        $appointments = $store['appointments'] ?? [];
        $total = 0;
        $noShows = 0;
        $completed = 0;
        $revenue = 0.0;
        $servicesCount = [];
        $patientPhones = [];

        foreach ($appointments as $appt) {
            $dateStr = trim((string)($appt['date'] ?? ''));
            $timeStr = trim((string)($appt['time'] ?? '00:00'));
            if ($dateStr === '') continue;
            
            $apptTime = strtotime($dateStr . ' ' . $timeStr);
            if ($apptTime < $cutoff || $apptTime > time()) {
                continue;
            }

            $status = strtolower(trim((string)($appt['status'] ?? '')));
            if ($status === 'cancelled') continue;

            $total++;
            $phone = trim((string)($appt['phone'] ?? ''));
            if ($phone !== '') {
                $patientPhones[$phone] = true;
            }

            if ($status === 'no_show') {
                $noShows++;
            } elseif (in_array($status, ['checked_in', 'completed'], true)) {
                $completed++;
                
                $service = strtolower(trim((string)($appt['service'] ?? '')));
                if ($service !== '') {
                    $servicesCount[$service] = ($servicesCount[$service] ?? 0) + 1;
                    $revenue += self::estimateServiceRevenue($service);
                }
            }
        }

        arsort($servicesCount);
        $topServices = array_slice(array_keys($servicesCount), 0, 3);
        
        $noShowRate = $total > 0 ? round(($noShows / $total) * 100, 1) : 0;
        $newPatientsEstimate = count($patientPhones);

        json_response([
            'ok' => true,
            'data' => [
                'period_days' => $periodDays,
                'appointments_total' => $total,
                'patients_seen' => $completed,
                'no_show_rate' => $noShowRate,
                'new_patients' => $newPatientsEstimate,
                'revenue_estimate' => $revenue,
                'top_services' => $topServices
            ]
        ]);
    }

public static function estimateServiceRevenue(string $service): float
    {
        $prices = [
            'consulta' => 35.0,
            'laser' => 80.0,
            'acne' => 45.0,
            'rejuvenecimiento' => 120.0,
            'cancer' => 50.0,
            'video' => 30.0,
            'telefono' => 20.0
        ];
        return $prices[$service] ?? 35.0;
    }

public static function chronicPanel(array $context): void
    {
        AdminDataController::requireAuth($context);
        $store = $context['store'];
        
        $patients = $store['patients'] ?? [];
        $nowTs = time();
        $chronicList = [];

        foreach ($patients as $caseId => $patient) {
            $conditions = $patient['chronicConditions'] ?? [];
            if (!is_array($conditions)) continue;

            $activeConditions = [];
            $maxOverdue = 0;
            $status = 'controlled';
            $lastControl = '';

            foreach ($conditions as $c) {
                $cStatus = $c['status'] ?? 'controlled';
                $condCode = $c['cie10Code'] ?? '';
                if ($condCode !== '') {
                    $activeConditions[] = $condCode;
                }

                $cDueStr = $c['nextControlDue'] ?? '';
                $cDueTs = strtotime($cDueStr);
                $cLast = $c['lastControlDate'] ?? '';

                if ($cLast !== '' && ($lastControl === '' || strtotime($cLast) > strtotime($lastControl))) {
                    $lastControl = $cLast;
                }

                if ($cDueTs && $cDueTs < $nowTs) {
                    $overdue = (int) ceil(($nowTs - $cDueTs) / 86400);
                    if ($overdue > $maxOverdue) {
                        $maxOverdue = $overdue;
                        $status = 'overdue';
                    }
                }
                if ($cStatus === 'uncontrolled' || $cStatus === 'lost_to_followup') {
                    $status = $cStatus;
                }
            }

            if (!empty($activeConditions)) {
                $chronicList[] = [
                    'case_id' => $caseId,
                    'name' => trim(($patient['firstName'] ?? '') . ' ' . ($patient['lastName'] ?? '')),
                    'conditions' => $activeConditions,
                    'last_control' => $lastControl,
                    'days_overdue' => $maxOverdue,
                    'status' => $status
                ];
            }
        }

        usort($chronicList, function($a, $b) {
            return $b['days_overdue'] <=> $a['days_overdue'];
        });

        json_response([
            'ok' => true,
            'patients' => $chronicList
        ]);
    }

public static function patientLtv(array $context): void
    {
        AdminDataController::requireAuth($context);
        $store = $context['store'];

        $caseId = trim((string)($_GET['case_id'] ?? ''));
        // If no caseId, standard S26-05 logic for all patients (lifetime value list)
        if ($caseId === '') {
            $patients = $store['patients'] ?? [];
            $list = [];
            foreach ($patients as $cId => $p) {
                // Mock values for S26-05 pending
                $list[] = [
                    'case_id' => $cId,
                    'name' => trim(($p['firstName'] ?? '') . ' ' . ($p['lastName'] ?? '')),
                    'ltv' => rand(50, 500),
                    'last_visit' => local_date('Y-m-d'),
                    'days_absent' => rand(5, 120)
                ];
            }
            json_response(['ok' => true, 'patients' => $list]);
        }

        $drafts = $store['clinical_history_drafts'] ?? [];
        $sessions = [];
        foreach ($drafts as $d) {
            if (($d['caseId'] ?? '') === $caseId) {
                $sessions[] = $d;
            }
        }
        
        usort($sessions, function($a, $b) {
            return strtotime($a['createdAt'] ?? '') <=> strtotime($b['createdAt'] ?? '');
        });

        $adherenceLog = [];
        $lastExpectedEnd = 0;

        foreach ($sessions as $i => $s) {
            $visitDate = strtotime($s['createdAt'] ?? '');
            if (!$visitDate) continue;

            if ($lastExpectedEnd > 0) {
                $diffDays = (int) round(($visitDate - $lastExpectedEnd) / 86400);
                $score = 'on_time';
                if ($diffDays < -10) $score = 'early';
                elseif ($diffDays > 10) $score = 'late';
                
                $adherenceLog[] = [
                    'session_id' => $s['id'] ?? '',
                    'date' => gmdate('Y-m-d', $visitDate),
                    'expected_end' => gmdate('Y-m-d', $lastExpectedEnd),
                    'days_diff' => $diffDays,
                    'score' => $score
                ];
            }

            foreach (($s['prescriptions'] ?? []) as $presc) {
                $dur = (int) ($presc['durationDays'] ?? 0);
                if ($dur > 0) {
                    $newExpectedEnd = $visitDate + ($dur * 86400);
                    if ($newExpectedEnd > $lastExpectedEnd) {
                        $lastExpectedEnd = $newExpectedEnd;
                    }
                }
            }
        }

        json_response([
            'ok' => true,
            'case_id' => $caseId,
            'medication_adherence' => [
                'log' => $adherenceLog,
                'overall_score' => !empty($adherenceLog) ? end($adherenceLog)['score'] : 'unknown'
            ]
        ]);
    }

public static function __adverseReactionReport(array $context): void
    {
        AdminDataController::requireAuth($context);
        
        $payload = require_json_body();
        $caseId = trim((string)($payload['case_id'] ?? ''));
        $drugName = trim((string)($payload['drug_name'] ?? ''));
        $reactionDesc = trim((string)($payload['reaction_description'] ?? ''));
        $severity = trim((string)($payload['severity'] ?? ''));
        $actionTaken = trim((string)($payload['action_taken'] ?? ''));
        $onsetDate = trim((string)($payload['onset_date'] ?? ''));
        
        if ($caseId === '' || $drugName === '' || $reactionDesc === '' || $severity === '' || $actionTaken === '') {
            json_response(['ok' => false, 'error' => 'case_id, drug_name, reaction_description, severity, action_taken son obligatorios'], 400);
        }

        $record = [
            'caseId' => $caseId,
            'drugName' => $drugName,
            'reactionDescription' => $reactionDesc,
            'severity' => $severity,
            'onsetDate' => $onsetDate ?: local_date('Y-m-d'),
            'actionTaken' => $actionTaken,
            'reportedAt' => gmdate('c'),
            'reportedBy' => $_SESSION['admin_email'] ?? 'sys'
        ];

        $reactionsFile = __DIR__ . '/../data/adverse-reactions.jsonl';
        file_put_contents($reactionsFile, json_encode($record, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);

        $alertSent = false;
        if ($severity === 'severe' || $severity === 'life_threatening') {
            require_once __DIR__ . '/../lib/whatsapp_openclaw/bootstrap.php';
            $clinicProfile = read_clinic_profile();
            $adminPhone = $clinicProfile['phones'][0] ?? '+593982453672';
            $adminPhone = preg_replace('/\D+/', '', $adminPhone);

            if ($adminPhone !== '') {
                $msg = "⚠️ ALERTA RAM: Reacción {$severity} a {$drugName} en paciente {$caseId}. Acción: {$actionTaken}. Desc: {$reactionDesc}";
                whatsapp_openclaw_repository()->enqueueOutbox([
                    'to' => '+' . $adminPhone,
                    'text' => $msg,
                    'context' => 'adverse_reaction_alert'
                ]);
                $alertSent = true;
            }
        }

        json_response([
            'ok' => true,
            'alert_sent' => $alertSent
        ]);
    }

}
