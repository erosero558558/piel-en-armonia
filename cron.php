<?php
declare(strict_types=1);

/**
 * Tareas programadas de Piel en Armonía.
 *
 * Uso:
 *   GET /cron.php?action=reminders&token=TU_CRON_SECRET
 *
 * Configurar en el hosting un cron diario a las 18:00 (America/Guayaquil):
 *   0 18 * * * curl -s "https://pielarmonia.com/cron.php?action=reminders&token=TU_CRON_SECRET"
 */

require_once __DIR__ . '/api-lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// ── Validar token ──────────────────────────────────────
$secret = getenv('PIELARMONIA_CRON_SECRET');
if (!is_string($secret) || $secret === '') {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'CRON_SECRET no configurado']);
    exit();
}

$token = trim((string) ($_GET['token'] ?? ''));
if (!hash_equals($secret, $token)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Token inválido']);
    exit();
}

$action = trim((string) ($_GET['action'] ?? ''));

// ── Recordatorios de citas para mañana ─────────────────
if ($action === 'reminders') {
    $tomorrow = date('Y-m-d', strtotime('+1 day'));
    $store = read_store();
    $sent = 0;
    $skipped = 0;
    $failed = 0;

    foreach ($store['appointments'] as &$appt) {
        $status = (string) ($appt['status'] ?? '');
        $date = (string) ($appt['date'] ?? '');
        $reminderSent = trim((string) ($appt['reminderSentAt'] ?? ''));

        if ($status !== 'confirmed' || $date !== $tomorrow || $reminderSent !== '') {
            $skipped++;
            continue;
        }

        if (maybe_send_reminder_email($appt)) {
            $appt['reminderSentAt'] = local_date('c');
            $sent++;
        } else {
            $failed++;
        }
    }
    unset($appt);

    if ($sent > 0) {
        write_store($store);
    }

    echo json_encode([
        'ok' => true,
        'date' => $tomorrow,
        'sent' => $sent,
        'skipped' => $skipped,
        'failed' => $failed
    ]);
    exit();
}

http_response_code(400);
echo json_encode(['ok' => false, 'error' => 'Acción no válida']);
