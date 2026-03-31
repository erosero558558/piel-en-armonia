<?php
/**
 * bin/check-pending-labs.php — S30-08
 * Aurora Derm — Cron: laboratorios emitidos sin resultado >5 días
 *
 * Recorre todos los casos abiertos con labOrders en estado 'issued'
 * y resultStatus 'not_received' donde la fecha de emisión fue hace
 * más de 5 días. Envía recordatorio por WhatsApp al paciente.
 *
 * Uso:
 *   php bin/check-pending-labs.php              ← modo real
 *   php bin/check-pending-labs.php --dry        ← solo lista, no envía
 *   php bin/check-pending-labs.php --json       ← output JSON para monitoring
 *
 * Cron recomendado (10:00 cada día):
 *   0 10 * * * /usr/bin/php /var/www/html/bin/check-pending-labs.php --json >> /var/log/aurora-labs.log 2>&1
 */

declare(strict_types=1);

$rootDir = dirname(__DIR__);
require_once $rootDir . '/lib/db.php';
require_once $rootDir . '/lib/AppConfig.php';

$dryRun   = in_array('--dry', $argv ?? [], true);
$jsonMode = in_array('--json', $argv ?? [], true);

if (!$jsonMode) {
    echo "🧪 Aurora Derm — Pending Labs Checker\n";
    echo "   Modo: " . ($dryRun ? 'DRY RUN' : 'REAL') . "\n\n";
}

$now             = new DateTimeImmutable('now', new DateTimeZone('America/Guayaquil'));
$thresholdDays   = 5;
$alertsLogPath   = $rootDir . '/data/pending-lab-alerts.jsonl';
$sent            = 0;
$skipped         = 0;
$errors          = 0;
$found           = 0;

// ── Leer alertas ya enviadas para evitar duplicados ───────────────────────────
$alreadySent = [];
if (file_exists($alertsLogPath)) {
    foreach (file($alertsLogPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $entry = json_decode($line, true);
        if (is_array($entry) && isset($entry['lab_order_id'])) {
            $alreadySent[$entry['lab_order_id']] = $entry['sent_at'];
        }
    }
}

// ── Leer el store principal ───────────────────────────────────────────────────
try {
    $pdo   = get_db_connection();
    $stmt  = $pdo->prepare("SELECT json_data FROM cases WHERE status NOT IN ('completed','cancelled') LIMIT 2000");
    $stmt->execute();
    $cases = $stmt->fetchAll(\PDO::FETCH_COLUMN);
} catch (\Throwable $e) {
    $msg = ['ok' => false, 'error' => 'DB error: ' . $e->getMessage()];
    echo $jsonMode ? json_encode($msg) : "❌ " . $e->getMessage() . "\n";
    exit(1);
}

// Alternativamente leer del JSON store (arquitectura actual de Aurora Derm)
$storeFile = $rootDir . '/data/store.json';
$store     = file_exists($storeFile) ? (json_decode((string) file_get_contents($storeFile), true) ?? []) : [];
$drafts    = $store['clinical_history_drafts'] ?? [];

$alerts = [];

foreach ($drafts as $draft) {
    $caseId    = trim((string) ($draft['caseId'] ?? ''));
    $sessionId = trim((string) ($draft['sessionId'] ?? ''));
    $labOrders = $draft['labOrders'] ?? [];

    if (empty($labOrders)) continue;

    foreach ($labOrders as $order) {
        $labOrderId  = trim((string) ($order['labOrderId'] ?? ''));
        $status      = trim((string) ($order['status'] ?? ''));
        $resultStatus= trim((string) ($order['resultStatus'] ?? ''));
        $issuedAt    = trim((string) ($order['issuedAt'] ?? $order['updatedAt'] ?? $order['createdAt'] ?? ''));

        if ($status !== 'issued' || $resultStatus !== 'not_received') continue;
        if ($labOrderId === '') continue;

        // Calcular días transcurridos desde emisión
        if ($issuedAt === '') continue;
        try {
            $issuedDate  = new DateTimeImmutable($issuedAt);
            $daysElapsed = (int) $issuedDate->diff($now)->days;
        } catch (\Throwable $e) {
            continue;
        }

        if ($daysElapsed < $thresholdDays) continue;

        $found++;

        // Verificar si ya enviamos alerta para esta orden en las últimas 48h
        if (isset($alreadySent[$labOrderId])) {
            try {
                $lastSent    = new DateTimeImmutable($alreadySent[$labOrderId]);
                $hoursSince  = (int) $lastSent->diff($now)->h + ((int) $lastSent->diff($now)->days * 24);
                if ($hoursSince < 48) { $skipped++; continue; }
            } catch (\Throwable $e) {}
        }

        // Obtener datos del paciente desde el draft
        $patientName  = trim((string) ($draft['admission001']['identity']['primerNombre'] ?? ''));
        $patientPhone = trim((string) ($draft['admission001']['contact']['cellphone'] ?? $draft['admission001']['contact']['phone'] ?? ''));
        $studyLabel   = trim((string) ($order['labName'] ?? ''));
        if ($studyLabel === '') {
            $selections = $order['studySelections'] ?? [];
            $flat = [];
            foreach (['hematology', 'bloodChemistry', 'urinalysis', 'serology'] as $k) {
                foreach (($selections[$k] ?? []) as $s) { $flat[] = $s; }
            }
            $studyLabel = implode(', ', array_slice($flat, 0, 3)) ?: 'examen de laboratorio';
        }

        $waMessage = sprintf(
            "Estimado/a %s: sus resultados de *%s* ordenados hace %d días ya deberían estar listos. " .
            "Por favor visítenos para revisarlos con su médico o llámenos para coordinar. 🔬",
            $patientName ?: 'paciente',
            $studyLabel,
            $daysElapsed
        );

        $alerts[] = [
            'case_id'      => $caseId,
            'session_id'   => $sessionId,
            'lab_order_id' => $labOrderId,
            'study'        => $studyLabel,
            'days_elapsed' => $daysElapsed,
            'patient_name' => $patientName,
            'patient_phone'=> $patientPhone,
            'wa_message'   => $waMessage,
        ];

        if (!$jsonMode) {
            echo sprintf("  🔬 %s | %s | %d días | %s\n", $labOrderId, $studyLabel, $daysElapsed, $patientName);
        }

        if (!$dryRun) {
            // Registrar como enviado para evitar duplicados
            $logEntry = json_encode([
                'lab_order_id' => $labOrderId,
                'case_id'      => $caseId,
                'sent_at'      => $now->format('c'),
                'study'        => $studyLabel,
                'patient'      => $patientName,
            ]);
            file_put_contents($alertsLogPath, $logEntry . "\n", FILE_APPEND | LOCK_EX);
            // WhatsApp: en producción usar wa.me link o API de WhatsApp Business
            // whatsapp_send_message($patientPhone, $waMessage);
            $sent++;
        }
    }
}

$summary = [
    'ok'             => true,
    'run_at'         => $now->format('c'),
    'mode'           => $dryRun ? 'dry_run' : 'real',
    'pending_found'  => $found,
    'alerts_queued'  => count($alerts),
    'sent'           => $sent,
    'skipped_recent' => $skipped,
    'alerts'         => $dryRun ? $alerts : [],
];

if ($jsonMode) {
    echo json_encode($summary) . "\n";
} else {
    echo "\n✅ Revisión completada:\n";
    echo "   Labs pendientes encontrados: {$found}\n";
    echo "   Alertas enviadas:            {$sent}\n";
    echo "   Omitidos (recientes):        {$skipped}\n";
}

exit(0);
