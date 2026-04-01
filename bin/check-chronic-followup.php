<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/common.php';
require_once __DIR__ . '/../lib/whatsapp_openclaw/bootstrap.php';

$options    = getopt('', ['dry', 'dry-run', 'json']);
$isDryRun   = isset($options['dry']) || isset($options['dry-run']);
$outputJson = isset($options['json']);

$store = read_store();
$patients = $store['patients'] ?? [];
$appointments = $store['appointments'] ?? [];

$nowStr = local_date('Y-m-d');
$nowTs = strtotime($nowStr);

$updated = false;
$sentCount = 0;
$alerts = [];

foreach ($patients as $caseId => &$patient) {
    if (!isset($patient['chronicConditions']) || !is_array($patient['chronicConditions'])) {
        continue;
    }

    $phone = preg_replace('/\D+/', '', $patient['phone'] ?? '');
    if ($phone === '') {
        continue;
    }

    // Check if patient has any future active appointment
    $hasFutureAppointment = false;
    foreach ($appointments as $app) {
        if (($app['caseId'] ?? '') !== $caseId) continue;
        if (($app['status'] ?? '') === 'cancelled' || ($app['status'] ?? '') === 'completed') continue;
        
        $appDateTs = strtotime($app['date'] ?? '');
        if ($appDateTs && $appDateTs >= $nowTs) {
            $hasFutureAppointment = true;
            break;
        }
    }

    if ($hasFutureAppointment) {
        continue; // They already have a future appointment, skip alerting them
    }

    foreach ($patient['chronicConditions'] as &$cond) {
        if (($cond['status'] ?? '') !== 'controlled') {
            continue; // Already uncontrolled, maybe we don't spam, or only alert if controlled
        }

        $nextDueStr = $cond['nextControlDue'] ?? '';
        $nextDueTs = strtotime($nextDueStr);

        if ($nextDueTs && $nextDueTs < $nowTs) {
            // It's overdue! Check if we already alerted
            if (!isset($cond['lastOverdueAlertAt']) || (strtotime($cond['lastOverdueAlertAt']) < ($nowTs - 30 * 86400))) {
                
                $condName = $cond['cie10Label'] ?? 'su condición crónica';
                $patientName = trim(($patient['firstName'] ?? '') . ' ' . ($patient['lastName'] ?? ''));
                $baseUrl = defined('AppConfig::BASE_URL') ? AppConfig::BASE_URL : 'https://auroraderm.com';
                
                $message = "Estimado/a {$patientName}: su control de {$condName} estaba programado para el {$nextDueStr}. Lo esperamos en Aurora Derm para continuar su seguimiento. Agende en {$baseUrl}/es/agendar/";

                if ($isDryRun) {
                    echo "[DRY RUN] WhatsApp a +{$phone} (Paciente: {$caseId}, Condición: {$cond['cie10Code']}): '{$message}'\n";
                } else {
                    whatsapp_openclaw_repository()->enqueueOutbox([
                        'to' => '+' . $phone,
                        'text' => $message,
                        'context' => 'chronic_followup_reminder',
                    ]);
                    $cond['lastOverdueAlertAt'] = gmdate('c');
                    $cond['status'] = 'uncontrolled'; // Mark as uncontrolled since they missed it
                    $updated = true;
                    echo "Alerta de seguimiento enviada a +{$phone} (Paciente: {$caseId}, Condición: {$cond['cie10Code']})\n";
                }

                $alerts[] = [
                    'caseId' => $caseId,
                    'patientName' => $patientName,
                    'phone' => $phone,
                    'condition' => $cond['cie10Code'],
                    'dueDate' => $nextDueStr,
                    'alertedAt' => gmdate('c')
                ];
                $sentCount++;
                break; // Alert once per patient per cycle even if multiple conditions are due
            }
        }
    }
    unset($cond);
}
unset($patient);

if ($updated && !$isDryRun) {
    $store['patients'] = $patients;
    write_store($store, false);
}

if (!empty($alerts) && !$isDryRun) {
    $alertsFilePath = __DIR__ . '/../data/follow-up-alerts.json';
    $existingAlerts = [];
    if (file_exists($alertsFilePath)) {
        $existing = file_get_contents($alertsFilePath);
        $existingAlerts = json_decode($existing, true) ?: [];
    }
    $mergedAlerts = array_merge($existingAlerts, $alerts);
    file_put_contents($alertsFilePath, json_encode($mergedAlerts, JSON_PRETTY_PRINT));
}


// ── S37-09: Construir pending_reactivations ──────────────────────────────────
$reactivations = [];
foreach ($patients as $recCaseId => $recPatient) {
    if (!isset($recPatient['chronicConditions']) || !is_array($recPatient['chronicConditions'])) { continue; }
    $lastVisitDate = null;
    foreach ($appointments as $app) {
        if (($app['caseId'] ?? '') !== $recCaseId) { continue; }
        if (!in_array($app['status'] ?? '', ['completed', 'attended'], true)) { continue; }
        $appDate = $app['date'] ?? $app['started_at'] ?? '';
        if ($appDate && ($lastVisitDate === null || $appDate > $lastVisitDate)) { $lastVisitDate = $appDate; }
    }
    if ($lastVisitDate === null) { continue; }
    $daysSince = (int) round((strtotime($nowStr) - strtotime($lastVisitDate)) / 86400);
    if ($daysSince < 60) { continue; }
    foreach ($recPatient['chronicConditions'] as $cond) {
        $condName = $cond['cie10Label'] ?? $cond['cie10Code'] ?? 'condicion cronica';
        $reactivations[] = [
            'id'                => 'react-' . substr(md5($recCaseId . $condName), 0, 12),
            'patientId'         => $recCaseId,
            'caseId'            => $recCaseId,
            'last_visit_date'   => $lastVisitDate,
            'chronic_diagnosis' => $condName,
            'days_since_visit'  => $daysSince,
            'contact_next_step' => $daysSince > 90 ? 'call' : 'whatsapp',
            'detected_at'       => gmdate('c'),
        ];
        break;
    }
}

if ($outputJson || $isDryRun) {
    echo json_encode(['pending_reactivations' => $reactivations, 'count' => count($reactivations)], JSON_PRETTY_PRINT) . "\n";
    if ($isDryRun) { exit(0); }
}

if ($reactivations !== [] && !$isDryRun) {
    $storeR = read_store();
    $existR = $storeR['pending_reactivations'] ?? [];
    $existIds = array_column($existR, 'patientId');
    foreach ($reactivations as $react) {
        if (!in_array($react['patientId'], $existIds, true)) { $existR[] = $react; }
    }
    $storeR['pending_reactivations'] = array_values($existR);
    write_store($storeR, false);
}

echo "Procesados {$sentCount} seguimientos crónicos vencidos.\n";
