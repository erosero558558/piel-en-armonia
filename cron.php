<?php
declare(strict_types=1);

/**
 * Scheduled tasks for Piel en Armonia.
 *
 * Usage:
 *   GET /cron.php?action=reminders&token=YOUR_CRON_SECRET
 *   GET /cron.php?action=backup-health&token=YOUR_CRON_SECRET
 *   GET /cron.php?action=backup-offsite&token=YOUR_CRON_SECRET
 *
 * Suggested cron jobs (America/Guayaquil):
 *   0 18 * * * curl -s "https://pielarmonia.com/cron.php?action=reminders&token=YOUR_CRON_SECRET"
 *   10 3 * * * curl -s "https://pielarmonia.com/cron.php?action=backup-health&token=YOUR_CRON_SECRET"
 *   20 3 * * * curl -s "https://pielarmonia.com/cron.php?action=backup-offsite&token=YOUR_CRON_SECRET"
 */

require_once __DIR__ . '/api-lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function cron_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit();
}

$secret = getenv('PIELARMONIA_CRON_SECRET');
if (!is_string($secret) || $secret === '') {
    cron_json(['ok' => false, 'error' => 'CRON_SECRET no configurado'], 500);
}

$token = trim((string) ($_GET['token'] ?? ''));
if (!hash_equals($secret, $token)) {
    cron_json(['ok' => false, 'error' => 'Token invalido'], 403);
}

$action = trim((string) ($_GET['action'] ?? ''));

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

    cron_json([
        'ok' => true,
        'action' => 'reminders',
        'date' => $tomorrow,
        'sent' => $sent,
        'skipped' => $skipped,
        'failed' => $failed
    ]);
}

if ($action === 'backup-health') {
    if (!function_exists('backup_latest_status')) {
        cron_json([
            'ok' => false,
            'action' => 'backup-health',
            'error' => 'Modulo de backup no disponible'
        ], 500);
    }

    $rawMaxAge = isset($_GET['maxAgeHours']) ? (int) $_GET['maxAgeHours'] : 0;
    $maxAgeHours = $rawMaxAge > 0 ? $rawMaxAge : backup_health_max_age_hours();

    $status = backup_latest_status($maxAgeHours);
    $status['offsiteConfigured'] = backup_offsite_configured();
    $status['timestamp'] = local_date('c');

    audit_log_event(
        ($status['ok'] ?? false) ? 'cron.backup_health.ok' : 'cron.backup_health.warn',
        [
            'ok' => (bool) ($status['ok'] ?? false),
            'reason' => (string) ($status['reason'] ?? ''),
            'count' => (int) ($status['count'] ?? 0),
            'latestAgeHours' => $status['latestAgeHours'] ?? null,
            'maxAgeHours' => (int) ($status['maxAgeHours'] ?? $maxAgeHours),
            'offsiteConfigured' => (bool) $status['offsiteConfigured']
        ]
    );

    cron_json([
        'ok' => (bool) ($status['ok'] ?? false),
        'action' => 'backup-health',
        'data' => $status
    ], ($status['ok'] ?? false) ? 200 : 503);
}

if ($action === 'backup-offsite') {
    if (!function_exists('backup_create_offsite_snapshot') || !function_exists('backup_upload_file')) {
        cron_json([
            'ok' => false,
            'action' => 'backup-offsite',
            'error' => 'Modulo de backup no disponible'
        ], 500);
    }

    $dryRun = parse_bool($_GET['dryRun'] ?? false);
    $snapshot = backup_create_offsite_snapshot();

    if (($snapshot['ok'] ?? false) !== true) {
        audit_log_event('cron.backup_offsite.fail', [
            'reason' => (string) ($snapshot['reason'] ?? 'snapshot_failed')
        ]);

        cron_json([
            'ok' => false,
            'action' => 'backup-offsite',
            'error' => 'No se pudo crear snapshot de backup',
            'data' => $snapshot
        ], 500);
    }

    $snapshotSummary = [
        'createdAt' => (string) ($snapshot['createdAt'] ?? local_date('c')),
        'file' => (string) ($snapshot['file'] ?? ''),
        'gzipFile' => (string) ($snapshot['gzipFile'] ?? ''),
        'sizeBytes' => (int) ($snapshot['sizeBytes'] ?? 0),
        'sha256' => (string) ($snapshot['sha256'] ?? ''),
        'counts' => isset($snapshot['counts']) && is_array($snapshot['counts']) ? $snapshot['counts'] : []
    ];

    if ($dryRun) {
        audit_log_event('cron.backup_offsite.dry_run', [
            'file' => $snapshotSummary['file'],
            'sizeBytes' => $snapshotSummary['sizeBytes'],
            'offsiteConfigured' => backup_offsite_configured()
        ]);

        cron_json([
            'ok' => true,
            'action' => 'backup-offsite',
            'dryRun' => true,
            'offsiteConfigured' => backup_offsite_configured(),
            'snapshot' => $snapshotSummary
        ]);
    }

    if (!backup_offsite_configured()) {
        audit_log_event('cron.backup_offsite.warn', [
            'reason' => 'offsite_not_configured',
            'file' => $snapshotSummary['file']
        ]);

        cron_json([
            'ok' => false,
            'action' => 'backup-offsite',
            'error' => 'PIELARMONIA_BACKUP_OFFSITE_URL no configurado',
            'snapshot' => $snapshotSummary
        ], 503);
    }

    $upload = backup_upload_file((string) $snapshot['uploadPath'], [
        'source' => 'pielarmonia',
        'storeEncrypted' => store_file_is_encrypted(),
        'dataDir' => basename((string) data_dir_path()),
        'snapshotCreatedAt' => (string) ($snapshot['createdAt'] ?? local_date('c')),
        'snapshotSha256' => (string) ($snapshot['sha256'] ?? ''),
        'runtimeVersion' => app_runtime_version()
    ]);

    $uploadOk = (bool) ($upload['ok'] ?? false);
    audit_log_event($uploadOk ? 'cron.backup_offsite.ok' : 'cron.backup_offsite.fail', [
        'status' => (int) ($upload['status'] ?? 0),
        'reason' => (string) ($upload['reason'] ?? ''),
        'file' => $snapshotSummary['file']
    ]);

    cron_json([
        'ok' => $uploadOk,
        'action' => 'backup-offsite',
        'snapshot' => $snapshotSummary,
        'upload' => $upload
    ], $uploadOk ? 200 : 502);
}

cron_json(['ok' => false, 'error' => 'Accion no valida'], 400);
