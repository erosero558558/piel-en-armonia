<?php
/**
 * bin/send-followup-reminders.php — COMP-S29-08
 * Aurora Derm — Recordatorios médicos de seguimiento (a 30 días)
 *
 * Dispara email de reenganche invitando al paciente a un control o al uso
 * de telesalud tras exactamente 30 días de su última atención, SIEMPRE
 * Y CUANDO tengan `followup_reminder: true` en su configuración.
 *
 * Uso:
 *   php bin/send-followup-reminders.php          ← modo real, envía emails
 *   php bin/send-followup-reminders.php --dry    ← modo dry-run, lista sin enviar
 *   php bin/send-followup-reminders.php --json   ← output JSON estructurado
 *
 * Exit codes:
 *   0 — OK (0 o más procesados)
 *   1 — Error de DB u otra excepción global
 */

declare(strict_types=1);

$rootDir = dirname(__DIR__);
require_once $rootDir . '/lib/db.php';
require_once $rootDir . '/lib/email.php';
require_once $rootDir . '/lib/AppConfig.php';

$dryRun   = in_array('--dry', $argv ?? [], true);
$jsonMode = in_array('--json', $argv ?? [], true);
if (!$jsonMode) {
    echo "🩺 Aurora Derm — Motor de Seguimiento (30 días)\n";
    echo "   Modo: " . ($dryRun ? 'DRY RUN (sin envíos)' : 'REAL') . "\n\n";
}

// ── Objetivo: Exactamente 30 días al pasado ─────────────────────────────────

$targetDate = (new DateTimeImmutable('-30 days', new DateTimeZone('America/Guayaquil')))->format('Y-m-d');

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

// Traemos citas del targetDate que no hayan sido canceladas ni abandonadas
$stmt = $pdo->prepare("
    SELECT id, date, time, doctor, service, name, email, phone, status, json_data
    FROM appointments
    WHERE date = :target_date
      AND status NOT IN ('cancelled', 'no_show')
      AND email IS NOT NULL AND email != ''
    ORDER BY time ASC
");
$stmt->execute([':target_date' => $targetDate]);
$appointments = $stmt->fetchAll(\PDO::FETCH_ASSOC);

$sent    = 0;
$skipped = 0;
$errors  = 0;
$results = [];

foreach ($appointments as $appt) {
    $id    = (int) $appt['id'];
    $email = trim((string) ($appt['email'] ?? ''));
    $name  = trim((string) ($appt['name'] ?? ''));

    // Rehidratar JSON para buscar settings de retención
    $jsonData = [];
    try {
        $jsonData = json_decode((string) ($appt['json_data'] ?? '{}'), true) ?: [];
    } catch (\Throwable) {}

    // SI NO TIENE EL FLAG, SALTAR (Opt-in Requirement S29-08)
    if (empty($jsonData['followup_reminder']) || $jsonData['followup_reminder'] !== true) {
        $skipped++;
        // No logueamos los skips de opt-out en results_array para no engordar el log inútilmente
        continue; 
    }

    // SI YA ENVIAMOS EL SEGUIMIENTO, IGNORAR (Protección anti-spam)
    if (!empty($jsonData['followup_sent_at'])) {
        $skipped++;
        $results[] = ['id' => $id, 'status' => 'already_sent', 'email' => $email];
        continue;
    }

    $publicAgendaUrl = AppConfig::BASE_URL . '/es/agendar/';
    
    // Contrucción simulada del correo in-memory
    if ($dryRun) {
        $sent++;
        $results[] = [
            'id'           => $id,
            'status'       => 'dry_run',
            'email'        => $email,
            'name'         => $name,
            'agendarUrl'   => $publicAgendaUrl,
        ];
        if (!$jsonMode) {
            echo "  [DRY] #{$id} → {$name} <{$email}> — Requiere seguimiento a 30 días.\n";
            echo "         Enlace: {$publicAgendaUrl}\n\n";
        }
        continue;
    }

    // Preparar y Enviar Correo Electrónico
    try {
        $subject = "Aurora Derm — Control y Seguimiento Médico (30 Días)";
        
        $htmlContent = "
        <div style='font-family: Arial, sans-serif; color: #333;'>
            <h2 style='color: #c9a96e;'>Hola " . htmlspecialchars($name) . ",</h2>
            <p>Esperamos que te encuentres muy bien tras tu atención en <strong>Aurora Derm</strong>.</p>
            <p>Se ha cumplido un mes desde tu última consulta y nuestro equipo médico recomienda agendar una sesión de control para evaluar la evolución de tu tratamiento, o subir imágenes a tu portal clínico si se trata de un tele-control.</p>
            <p style='margin: 30px 0;'>
                <a href='{$publicAgendaUrl}' style='background-color: #c9a96e; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 4px; font-weight: bold;'>Agendar mi Consulta de Control</a>
            </p>
            <p>Si ya posees una cita futura en tu calendario, agradecemos que desestimes este recordatorio.</p>
            <hr style='border: none; border-top: 1px solid #eee; margin: 30px 0;' />
            <p style='font-size: 13px; color: #777;'>Atentamente,<br><strong>Equipo Médico - Aurora Derm</strong></p>
        </div>";

        $ok = send_mail($email, $subject, $htmlContent, true);
        
        if ($ok) {
            $jsonData['followup_sent_at'] = (new DateTimeImmutable('now', new DateTimeZone('America/Guayaquil')))->format('c');
            $pdo->prepare("UPDATE appointments SET json_data = :jd, updated_at = CURRENT_TIMESTAMP WHERE id = :id")
                ->execute([':jd' => json_encode($jsonData), ':id' => $id]);
            $sent++;
            $results[] = ['id' => $id, 'status' => 'sent', 'email' => $email];
            if (!$jsonMode) {
                echo "  ✅ #{$id} → Control de 30 días enviado a {$name} <{$email}>\n";
            }
        } else {
            $errors++;
            $results[] = ['id' => $id, 'status' => 'email_failed', 'email' => $email];
            if (!$jsonMode) {
                echo "  ❌ #{$id} → Error crítico despachando correo de seguimiento para {$email}\n";
            }
        }
    } catch (\Throwable $e) {
        $errors++;
        $results[] = ['id' => $id, 'status' => 'exception', 'email' => $email, 'error' => $e->getMessage()];
        if (!$jsonMode) {
            echo "  ❌ #{$id} → Excepción interna: " . $e->getMessage() . "\n";
        }
    }
}

// ── Resumen de Operaciones ─────────────────────────────────────────────────────

$summary = [
    'ok'          => $errors === 0,
    'targetDate'  => $targetDate,
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
    echo "📊 Seguimientos: {$sent} despachados | {$skipped} omitidos | {$errors} fallidos.\n";
    echo "   Fecha retrospectiva: {$targetDate}\n";
    if ($errors === 0) {
        echo "✅ Motor ejecutado de forma transparente.\n\n";
    } else {
        echo "⚠️  Alerta: Proceso concluido con {$errors} errores.\n\n";
    }
}

exit($errors > 0 ? 1 : 0);
