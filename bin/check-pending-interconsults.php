<?php
/**
 * bin/check-pending-interconsults.php — S30-15
 * Aurora Derm — Cron: interconsultas emitidas sin respuesta >30 días
 *
 * El médico emite una interconsulta → el especialista debería responder.
 * Si pasan 30 días sin receive-interconsult-report, le avisa al médico emisor.
 *
 * Uso:
 *   php bin/check-pending-interconsults.php              ← modo real
 *   php bin/check-pending-interconsults.php --dry        ← solo lista
 *   php bin/check-pending-interconsults.php --json       ← output JSON
 *
 * Cron recomendado (lunes a las 09:00):
 *   0 9 * * 1 /usr/bin/php /var/www/html/bin/check-pending-interconsults.php --json >> /var/log/aurora-interconsults.log 2>&1
 */

declare(strict_types=1);

$rootDir = dirname(__DIR__);
require_once $rootDir . '/lib/db.php';
require_once $rootDir . '/lib/AppConfig.php';

$dryRun   = in_array('--dry', $argv ?? [], true);
$jsonMode = in_array('--json', $argv ?? [], true);

if (!$jsonMode) {
    echo "📋 Aurora Derm — Pending Interconsults Checker\n";
    echo "   Modo: " . ($dryRun ? 'DRY RUN' : 'REAL') . "\n\n";
}

$now              = new DateTimeImmutable('now', new DateTimeZone('America/Guayaquil'));
$thresholdDays    = 30;
$alertsLogPath    = $rootDir . '/data/pending-interconsult-alerts.jsonl';
$reportPath       = $rootDir . '/data/interconsult-alerts.json';
$sent = $skipped = $found = 0;

// ── Leer alertas ya enviadas ──────────────────────────────────────────────────
$alreadySent = [];
if (file_exists($alertsLogPath)) {
    foreach (file($alertsLogPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $entry = json_decode($line, true);
        if (is_array($entry) && isset($entry['interconsult_id'])) {
            $alreadySent[$entry['interconsult_id']] = $entry['sent_at'];
        }
    }
}

// ── Leer store ────────────────────────────────────────────────────────────────
$storeFile = $rootDir . '/data/store.json';
$store     = file_exists($storeFile) ? (json_decode((string) file_get_contents($storeFile), true) ?? []) : [];
$drafts    = $store['clinical_history_drafts'] ?? [];

$pendingList = [];

foreach ($drafts as $draft) {
    $caseId         = trim((string) ($draft['caseId'] ?? ''));
    $sessionId      = trim((string) ($draft['sessionId'] ?? ''));
    $interconsults  = $draft['interconsultations'] ?? [];

    if (empty($interconsults)) continue;

    foreach ($interconsults as $ic) {
        $icId      = trim((string) ($ic['interconsultId'] ?? ''));
        $icStatus  = trim((string) ($ic['status'] ?? ''));
        $issuedAt  = trim((string) ($ic['issuedAt'] ?? $ic['updatedAt'] ?? $ic['createdAt'] ?? ''));

        // Solo las emitidas sin reporte recibido
        if (!in_array($icStatus, ['issued', 'sent', 'pending_report'], true)) continue;
        if ($icId === '' || $issuedAt === '') continue;

        try {
            $issuedDate  = new DateTimeImmutable($issuedAt);
            $daysElapsed = (int) $issuedDate->diff($now)->days;
        } catch (\Throwable $e) { continue; }

        if ($daysElapsed < $thresholdDays) continue;

        $found++;

        // Verificar si enviamos alerta en las últimas 7 días
        if (isset($alreadySent[$icId])) {
            try {
                $lastSent   = new DateTimeImmutable($alreadySent[$icId]);
                $daysSince  = (int) $lastSent->diff($now)->days;
                if ($daysSince < 7) { $skipped++; continue; }
            } catch (\Throwable $e) {}
        }

        $specialistName     = trim((string) ($ic['specialistName'] ?? $ic['specialist'] ?? 'el especialista'));
        $specialistSpecialty= trim((string) ($ic['specialty'] ?? ''));
        $patientName        = trim((string) ($draft['admission001']['identity']['primerNombre'] ?? ''));

        // Obtener teléfono/WhatsApp del médico desde la configuración
        $doctorPhone = '';
        $clinicConfig = $store['clinic_profile'] ?? [];
        $doctorPhone  = trim((string) ($clinicConfig['doctorPhone'] ?? $clinicConfig['whatsapp'] ?? ''));

        $waMessage = sprintf(
            "📋 *Interconsulta sin respuesta* — Aurora Derm\n\n" .
            "La interconsulta enviada a *%s*%s para el paciente *%s* lleva *%d días* sin respuesta.\n\n" .
            "¿Desea hacer seguimiento? Ingrese al sistema para gestionar este caso.",
            $specialistName,
            $specialistSpecialty !== '' ? " ({$specialistSpecialty})" : '',
            $patientName ?: 'el paciente',
            $daysElapsed
        );

        $pendingList[] = [
            'interconsult_id'   => $icId,
            'case_id'           => $caseId,
            'session_id'        => $sessionId,
            'specialist'        => $specialistName,
            'specialty'         => $specialistSpecialty,
            'patient'           => $patientName,
            'issued_at'         => $issuedAt,
            'days_elapsed'      => $daysElapsed,
            'doctor_phone'      => $doctorPhone,
            'wa_message'        => $waMessage,
        ];

        if (!$jsonMode) {
            echo sprintf("  📋 %s | %s | %d días | Paciente: %s\n",
                $icId, $specialistName, $daysElapsed, $patientName);
        }

        if (!$dryRun) {
            $logEntry = json_encode([
                'interconsult_id' => $icId,
                'case_id'         => $caseId,
                'sent_at'         => $now->format('c'),
                'specialist'      => $specialistName,
                'days_elapsed'    => $daysElapsed,
                'patient'         => $patientName,
            ]);
            file_put_contents($alertsLogPath, $logEntry . "\n", FILE_APPEND | LOCK_EX);
            // En producción: whatsapp_send_message($doctorPhone, $waMessage);
            $sent++;
        }
    }
}

// Guardar reporte JSON legible para el admin
if (!$dryRun && !empty($pendingList)) {
    file_put_contents($reportPath, json_encode([
        'generated_at'  => $now->format('c'),
        'total_pending' => count($pendingList),
        'interconsults' => $pendingList,
    ], JSON_PRETTY_PRINT), LOCK_EX);
}

$summary = [
    'ok'             => true,
    'run_at'         => $now->format('c'),
    'mode'           => $dryRun ? 'dry_run' : 'real',
    'pending_found'  => $found,
    'alerts_queued'  => count($pendingList),
    'sent'           => $sent,
    'skipped_recent' => $skipped,
    'interconsults'  => $dryRun ? $pendingList : [],
];

if ($jsonMode) {
    echo json_encode($summary) . "\n";
} else {
    echo "\n✅ Revisión completada:\n";
    echo "   Interconsultas vencidas:  {$found}\n";
    echo "   Alertas enviadas:         {$sent}\n";
    echo "   Omitidas (recientes):     {$skipped}\n";
    if (!$dryRun && !empty($pendingList)) {
        echo "   Reporte guardado en:      data/interconsult-alerts.json\n";
    }
}

exit(0);
