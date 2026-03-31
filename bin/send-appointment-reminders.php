<?php
/**
 * bin/send-appointment-reminders.php — COMP-A2
 * Aurora Derm — Recordatorios automáticos de citas (24h antes)
 *
 * Dispara recordatorio por email + genera enlace WhatsApp para cada cita
 * que sea mañana y no haya recibido recordatorio aún.
 *
 * Uso:
 *   php bin/send-appointment-reminders.php          ← modo real, envía emails
 *   php bin/send-appointment-reminders.php --dry    ← modo dry-run, lista sin enviar
 *   php bin/send-appointment-reminders.php --json   ← output JSON para monitoring
 *
 * Cron recomendado (18:00 cada día):
 *   0 18 * * * /usr/bin/php /var/www/html/bin/send-appointment-reminders.php --json >> /var/log/aurora-reminders.log 2>&1
 *
 * Exit codes:
 *   0 — OK (0 o más recordatorios enviados sin errores)
 *   1 — Error crítico (DB no disponible, etc.)
 */

declare(strict_types=1);

$rootDir = dirname(__DIR__);
require_once $rootDir . '/lib/db.php';
require_once $rootDir . '/lib/email.php';
require_once $rootDir . '/lib/AppConfig.php';

$dryRun   = in_array('--dry', $argv ?? [], true);
$jsonMode = in_array('--json', $argv ?? [], true);
if (!$jsonMode) {
    echo "🔔 Aurora Derm — Reminder Engine\n";
    echo "   Modo: " . ($dryRun ? 'DRY RUN (sin envíos)' : 'REAL') . "\n\n";
}

// ── Obtener citas de mañana sin recordatorio enviado ──────────────────────────

$tomorrow = (new DateTimeImmutable('tomorrow', new DateTimeZone('America/Guayaquil')))->format('Y-m-d');

try {
    $pdo = get_db_connection($rootDir . '/data/store.sqlite');
    if ($pdo === null) throw new \Exception('Driver failed or store not found');
} catch (\Throwable $e) {
    if ($jsonMode) {
        echo json_encode(['ok' => false, 'error' => 'DB connection failed: ' . $e->getMessage()]);
    } else {
        echo "❌ Error DB: " . $e->getMessage() . "\n";
    }
    exit(1);
}

// Buscar citas de mañana con email y sin reminder_sent_at (guardado en json_data)
$stmt = $pdo->prepare("
    SELECT id, date, time, doctor, service, name, email, phone, status, rescheduleToken, json_data
    FROM appointments
    WHERE date = :tomorrow
      AND status NOT IN ('cancelled', 'no_show', 'completed')
      AND email IS NOT NULL AND email != ''
    ORDER BY time ASC
");
$stmt->execute([':tomorrow' => $tomorrow]);
$appointments = $stmt->fetchAll(\PDO::FETCH_ASSOC);

$sent    = 0;
$skipped = 0;
$errors  = 0;
$results = [];

foreach ($appointments as $appt) {
    $id       = (int) $appt['id'];
    $email    = trim((string) ($appt['email'] ?? ''));
    $name     = trim((string) ($appt['name'] ?? ''));
    $phone    = preg_replace('/[^0-9+]/', '', (string) ($appt['phone'] ?? ''));
    $date     = (string) ($appt['date'] ?? '');
    $time     = (string) ($appt['time'] ?? '');
    $service  = (string) ($appt['service'] ?? 'consulta');
    $doctor   = (string) ($appt['doctor'] ?? '');
    $token    = (string) ($appt['rescheduleToken'] ?? '');

    // Check json_data for reminder_sent_at
    $jsonData = [];
    try {
        $jsonData = json_decode((string) ($appt['json_data'] ?? '{}'), true) ?: [];
    } catch (\Throwable) {}

    if (!empty($jsonData['reminder_sent_at'])) {
        $skipped++;
        $results[] = ['id' => $id, 'status' => 'already_sent', 'email' => $email];
        continue;
    }

    // Build WhatsApp deeplink for patient
    $clinicWa  = preg_replace('/[^0-9]/', '', AppConfig::WHATSAPP_NUMBER);
    $serviceLabel = get_service_label($service);
    $doctorLabel  = get_doctor_label($doctor);
    $waMessage = urlencode(
        "Hola Aurora Derm, tengo cita mañana {$date} a las {$time} — {$serviceLabel}" .
        ($doctorLabel ? " con {$doctorLabel}" : '') . ". Confirmo mi asistencia."
    );
    $waConfirmLink = "https://wa.me/{$clinicWa}?text={$waMessage}";

    // Inject WhatsApp link + confirm link into appointment context
    $apptWithWa = array_merge($appt, [
        'waConfirmLink'  => $waConfirmLink,
        'rescheduleUrl'  => $token
            ? AppConfig::BASE_URL . '/?reschedule=' . rawurlencode($token)
            : '',
        'serviceLabel'   => $serviceLabel,
        'doctorLabel'    => $doctorLabel,
    ]);

    if ($dryRun) {
        $sent++;
        $results[] = [
            'id'           => $id,
            'status'       => 'dry_run',
            'email'        => $email,
            'name'         => $name,
            'date'         => $date,
            'time'         => $time,
            'waConfirmUrl' => $waConfirmLink,
        ];
        if (!$jsonMode) {
            echo "  [DRY] #{$id} → {$name} <{$email}> — cita {$date} {$time}\n";
            echo "         WA: {$waConfirmLink}\n\n";
        }
        continue;
    }

    // Send reminder email
    try {
        $ok = maybe_send_reminder_email($apptWithWa);
        if ($ok) {
            // Mark reminder sent in json_data
            $jsonData['reminder_sent_at'] = (new DateTimeImmutable('now', new DateTimeZone('America/Guayaquil')))->format('c');
            $jsonData['reminder_wa_link'] = $waConfirmLink;
            $pdo->prepare("UPDATE appointments SET json_data = :jd, updated_at = CURRENT_TIMESTAMP WHERE id = :id")
                ->execute([':jd' => json_encode($jsonData), ':id' => $id]);
            $sent++;
            $results[] = ['id' => $id, 'status' => 'sent', 'email' => $email];
            if (!$jsonMode) {
                echo "  ✅ #{$id} → {$name} <{$email}>\n";
            }
        } else {
            $errors++;
            $results[] = ['id' => $id, 'status' => 'email_failed', 'email' => $email];
            if (!$jsonMode) {
                echo "  ❌ #{$id} → email falló para {$email}\n";
            }
        }
    } catch (\Throwable $e) {
        $errors++;
        $results[] = ['id' => $id, 'status' => 'exception', 'email' => $email, 'error' => $e->getMessage()];
        if (!$jsonMode) {
            echo "  ❌ #{$id} → excepción: " . $e->getMessage() . "\n";
        }
    }
}

// ── Output ────────────────────────────────────────────────────────────────────

$summary = [
    'ok'          => $errors === 0,
    'targetDate'  => $tomorrow,
    'dryRun'      => $dryRun,
    'total'       => count($appointments),
    'sent'        => $sent,
    'skipped'     => $skipped,
    'errors'      => $errors,
    'generatedAt' => (new DateTimeImmutable())->format('c'),
    'results'     => $results,
];

if ($jsonMode) {
    echo json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
} else {
    echo "\n────────────────────────────────────\n";
    echo "📊 Resultado: {$sent} enviados | {$skipped} ya tenían | {$errors} errores\n";
    echo "   Fecha objetivo: {$tomorrow}\n";
    if ($errors === 0) {
        echo "✅ Completado sin errores.\n\n";
    } else {
        echo "⚠️  Completado con {$errors} error(es). Revisar log.\n\n";
    }
}

if (!$dryRun) {
    $govDir = $rootDir . '/governance';
    if (!is_dir($govDir)) {
        @mkdir($govDir, 0755, true);
    }
    $logFile = $govDir . '/appointment-reminders-log.json';
    $logData = [];
    if (file_exists($logFile)) {
        $content = @file_get_contents($logFile);
        if ($content !== false && trim($content) !== '') {
            $logData = json_decode($content, true);
            if (!is_array($logData)) $logData = [];
        }
    }
    $logData[] = $summary;
    @file_put_contents($logFile, json_encode($logData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

exit($errors > 0 ? 1 : 0);
