<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/auth.php';
require_once __DIR__ . '/../lib/api_helpers.php';
require_once __DIR__ . '/../lib/business.php';
require_once __DIR__ . '/../lib/clinical_history/ClinicalHistorySessionRepository.php';

final class DoctorDashboardController
{
    private static function checkAuth(): void
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        if (!isset($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }
    }

    public static function dashboard(array $context): void
    {
        self::checkAuth();
        $store = is_array($context['store'] ?? null) ? $context['store'] : read_store();

        $patientsCriticalVitals = [];
        $pendingLabResults = [];
        $overdueChronics = [];
        $openTeleconsults = [];
        $todayAppointments = [];

        $todayStr = local_date('Y-m-d');
        $now = time();

        // 1. Today Appointments & Open Teleconsults
        $appointments = is_array($store['appointments'] ?? null) ? $store['appointments'] : [];
        foreach ($appointments as $apt) {
            if (($apt['status'] ?? '') === 'canceled') continue;

            $dateOnly = substr((string) ($apt['date'] ?? ''), 0, 10);
            if ($dateOnly === $todayStr) {
                $todayAppointments[] = [
                    'id' => $apt['id'] ?? '',
                    'patientName' => $apt['patientName'] ?? 'Paciente',
                    'serviceName' => $apt['serviceName'] ?? 'Consulta',
                    'time' => substr((string) ($apt['date'] ?? ''), 11, 5),
                    'status' => $apt['status'] ?? 'pending',
                ];
            }

            if (($apt['modality'] ?? '') === 'telemedicine' && (($apt['status'] ?? '') === 'active' || ($apt['status'] ?? '') === 'open')) {
                $openTeleconsults[] = [
                    'id' => $apt['id'] ?? '',
                    'patientId' => $apt['patientId'] ?? '',
                    'patientName' => $apt['patientName'] ?? 'Paciente',
                    'date' => $apt['date'] ?? '',
                ];
            }
        }

        // 2. Critical Vitals en Drafts activos
        $sessions = is_array($store['clinical_history_sessions'] ?? null) ? $store['clinical_history_sessions'] : [];
        $drafts = is_array($store['clinical_history_drafts'] ?? null) ? $store['clinical_history_drafts'] : [];
        
        $activeSessionIds = [];
        foreach ($sessions as $sId => $sess) {
            if (($sess['status'] ?? '') === 'active') {
                $activeSessionIds[$sId] = $sess['caseId'] ?? '';
            }
        }

        foreach ($drafts as $dId => $draft) {
            $sId = $draft['sessionId'] ?? '';
            if (isset($activeSessionIds[$sId])) {
                $vitals = $draft['intake']['vitalSigns'] ?? [];
                $sys = 0; $dia = 0;
                $bp = trim((string) ($vitals['bloodPressure'] ?? ''));
                if ($bp !== '' && strpos($bp, '/') !== false) {
                    [$s, $d] = explode('/', $bp);
                    $sys = (int) trim($s);
                    $dia = (int) trim($d);
                }
                $glu = (float) ($vitals['glucose'] ?? 0);
                $hr = (int) ($vitals['heartRate'] ?? 0);

                $isCritical = false;
                $reason = '';
                if ($sys >= 180 || $dia >= 110) { $isCritical = true; $reason = "PA Crítica: {$bp}"; }
                elseif ($glu >= 250) { $isCritical = true; $reason = "Glucosa Crítica: {$glu}"; }
                elseif ($hr >= 120 || ($hr > 0 && $hr <= 45)) { $isCritical = true; $reason = "FC Anormal: {$hr}"; }

                if ($isCritical) {
                    $caseId = $activeSessionIds[$sId];
                    $pId = ''; $pName = 'Paciente';
                    foreach (($store['cases'] ?? $store['patient_cases'] ?? []) as $c) {
                        if ($c['id'] === $caseId) {
                            $pId = $c['patientId'] ?? '';
                            break;
                        }
                    }
                    if ($pId !== '' && isset($store['patients'][$pId])) {
                        $pName = $store['patients'][$pId]['fullName'] ?? '';
                    }

                    $patientsCriticalVitals[] = [
                        'caseId' => $caseId,
                        'patientName' => $pName,
                        'reason' => $reason
                    ];
                }
            }
        }

        // 3. Overdue Chronics
        $followups = is_array($store['pending_followups'] ?? null) ? $store['pending_followups'] : [];
        foreach ($followups as $fu) {
            if (($fu['status'] ?? '') === 'pending') {
                $dueDate = $fu['due_date'] ?? '';
                if ($dueDate !== '' && strcmp($dueDate, $todayStr) < 0) {
                    $pId = $fu['patientId'] ?? '';
                    $pName = 'Paciente';
                    if ($pId !== '' && isset($store['patients'][$pId])) {
                        $pName = $store['patients'][$pId]['fullName'] ?? '';
                    }
                    $overdueChronics[] = [
                        'followupId' => $fu['id'] ?? '',
                        'patientName' => $pName,
                        'dueDate' => $dueDate,
                        'reason' => $fu['reason'] ?? 'Control Crónico'
                    ];
                }
            }
        }

        // 4. Pending Lab Results
        foreach (($store['cases'] ?? $store['patient_cases'] ?? []) as $c) {
            $labOrders = $c['labOrders'] ?? [];
            foreach ($labOrders as $order) {
                $status = $order['resultStatus'] ?? '';
                if ($status === 'received' || $status === 'pending_review') {
                    // Check if it's recently received and unreviewed/abnormal
                    $isAbnormal = false;
                    $res = is_array($order['results'] ?? null) ? $order['results'] : [];
                    foreach ($res as $r) {
                        if (($r['isAbnormal'] ?? false) === true) {
                            $isAbnormal = true;
                            break;
                        }
                    }
                    
                    if ($status === 'pending_review' || $isAbnormal) {
                        $pId = $c['patientId'] ?? '';
                        $pName = 'Paciente';
                        if ($pId !== '' && isset($store['patients'][$pId])) {
                            $pName = $store['patients'][$pId]['fullName'] ?? '';
                        }
                        $pendingLabResults[] = [
                            'caseId' => $c['id'] ?? '',
                            'patientName' => $pName,
                            'labName' => $order['labName'] ?? 'Laboratorio',
                            'date' => $order['receivedAt'] ?? ($order['date'] ?? ''),
                            'isAbnormal' => $isAbnormal
                        ];
                    }
                }
            }
        }

        json_response([
            'ok' => true,
            'patients_critical_vitals' => $patientsCriticalVitals,
            'pending_lab_results' => $pendingLabResults,
            'overdue_chronics' => $overdueChronics,
            'open_teleconsults' => $openTeleconsults,
            'today_appointments' => $todayAppointments
        ]);
    }

    public static function searchPatients(array $context): void
    {
        self::checkAuth();
        $store = is_array($context['store'] ?? null) ? $context['store'] : read_store();
        $q = strtolower(trim((string) ($_GET['q'] ?? '')));

        if ($q === '') {
            json_response(['ok' => true, 'results' => []]);
        }

        $results = [];
        $todayStr = local_date('Y-m-d');
        
        $patients = is_array($store['patients'] ?? null) ? $store['patients'] : [];
        $appointments = is_array($store['appointments'] ?? null) ? $store['appointments'] : [];

        foreach ($patients as $pId => $p) {
            $fullName = strtolower((string) ($p['fullName'] ?? ''));
            $docNum = strtolower((string) ($p['documentNumber'] ?? ''));
            
            if (strpos($fullName, $q) !== false || strpos($docNum, $q) !== false) {
                // Find last diagnosis
                $lastDiagnosis = '';
                $chronicStatus = 'Ninguno';
                
                $cases = [];
                foreach (($store['cases'] ?? $store['patient_cases'] ?? []) as $c) {
                    if (($c['patientId'] ?? '') === $pId) {
                        $cases[] = $c;
                    }
                }

                // Sort cases by recent
                usort($cases, function($a, $b) {
                    return strtotime($b['createdAt'] ?? 'now') - strtotime($a['createdAt'] ?? 'now');
                });

                if (count($cases) > 0) {
                    $lastDiagnosis = $cases[0]['cie10Description'] ?? ($cases[0]['diagnosis'] ?? '');
                }

                $chronics = $p['chronicConditions'] ?? [];
                if (count($chronics) > 0) {
                    $hasUncontrolled = false;
                    foreach ($chronics as $cond) {
                        if (($cond['status'] ?? '') !== 'controlled') {
                            $hasUncontrolled = true;
                            break;
                        }
                    }
                    $chronicStatus = $hasUncontrolled ? 'Descontrolado' : 'Controlado';
                }

                // Find next appointment
                $nextAppt = '';
                foreach ($appointments as $apt) {
                    $status = $apt['status'] ?? '';
                    if (($apt['patientId'] ?? '') === $pId && ($status === 'pending' || $status === 'confirmed' || $status === 'active')) {
                        $aptDate = substr((string) ($apt['date'] ?? ''), 0, 10);
                        if ($aptDate >= $todayStr) {
                            $nextAppt = ($apt['date'] ?? '') . ' (' . ($apt['serviceName'] ?? 'Consulta') . ')';
                            break;
                        }
                    }
                }

                $results[] = [
                    'patient_id' => $pId,
                    'name' => $p['fullName'] ?? '',
                    'document' => $p['documentNumber'] ?? '',
                    'profile_photo' => $p['profilePicture'] ?? '', // mock
                    'last_diagnosis' => $lastDiagnosis,
                    'next_appointment' => $nextAppt,
                    'chronic_status' => $chronicStatus
                ];

                if (count($results) >= 10) {
                    break;
                }
            }
        }

        json_response(['ok' => true, 'results' => $results]);
    }

    public static function stats(array $context): void
    {
        self::checkAuth();
        $store = is_array($context['store'] ?? null) ? $context['store'] : read_store();

        $todayStr = local_date('Ym');
        $monthlyPatientsCount = 0;
        $closedConsultsCount = 0;
        $issuedPrescriptions = 0;

        $appointments = is_array($store['appointments'] ?? null) ? $store['appointments'] : [];
        $uniquePatientIds = [];
        $patientVisits = [];

        foreach ($appointments as $apt) {
            $aptMonth = substr(str_replace('-', '', (string) ($apt['date'] ?? '')), 0, 6);
            if ($aptMonth === $todayStr) {
                if (($apt['status'] ?? '') === 'completed') {
                    $monthlyPatientsCount++;
                    $closedConsultsCount++;
                }
            }

            // For return rate calculation (using last 6 months for more data, or just all time)
            $pId = $apt['patientId'] ?? '';
            if ($pId !== '' && ($apt['status'] ?? '') === 'completed') {
                if (!isset($patientVisits[$pId])) { $patientVisits[$pId] = 0; }
                $patientVisits[$pId]++;
                $uniquePatientIds[$pId] = true;
            }
        }

        $prescriptions = is_array($store['prescriptions'] ?? null) ? $store['prescriptions'] : [];
        foreach ($prescriptions as $rx) {
            $rxMonth = substr(str_replace('-', '', (string) ($rx['issued_at'] ?? '')), 0, 6);
            if ($rxMonth === $todayStr) {
                $issuedPrescriptions++;
            }
        }

        // Top 5 diagnoses
        $diagnosesMap = [];
        foreach (($store['cases'] ?? $store['patient_cases'] ?? []) as $c) {
            $code = trim((string) ($c['cie10Code'] ?? ''));
            $desc = trim((string) ($c['cie10Description'] ?? ''));
            if ($code !== '') {
                $key = "{$code} - {$desc}";
                if (!isset($diagnosesMap[$key])) { $diagnosesMap[$key] = ['cie10Code' => $code, 'description' => $desc, 'count' => 0]; }
                $diagnosesMap[$key]['count']++;
            }
        }

        usort($diagnosesMap, function($a, $b) {
            return $b['count'] <=> $a['count'];
        });

        $topDiagnoses = array_slice($diagnosesMap, 0, 5);

        // Retention Rate
        $totalPatients = count($uniquePatientIds);
        $returningPatients = 0;
        foreach ($patientVisits as $pId => $visits) {
            if ($visits > 1) {
                $returningPatients++;
            }
        }

        $retentionRate = $totalPatients > 0 ? round(($returningPatients / $totalPatients) * 100, 1) : 0;

        json_response([
            'ok' => true,
            'stats' => [
                'monthly_patients' => $monthlyPatientsCount,
                'closed_consults' => $closedConsultsCount,
                'issued_prescriptions' => $issuedPrescriptions,
                'top_diagnoses' => $topDiagnoses,
                'retention_rate_pct' => $retentionRate
            ]
        ]);
    }
}
