<?php

declare(strict_types=1);

/**
 * Scheduled tasks for Aurora Derm.
 *
 * Usage:
 *   GET /cron.php?action=reminders&token=YOUR_CRON_SECRET
 *   GET /cron.php?action=backup-health&token=YOUR_CRON_SECRET
 *   GET /cron.php?action=backup-offsite&token=YOUR_CRON_SECRET
 *   GET /cron.php?action=ai-queue-worker&token=YOUR_CRON_SECRET
 *   GET /cron.php?action=clinical-history-reconcile&token=YOUR_CRON_SECRET
 *   GET /cron.php?action=process-retries&token=YOUR_CRON_SECRET
 *
 * Suggested cron jobs (America/Guayaquil):
 *   0 18 * * * curl -s "https://pielarmonia.com/cron.php?action=reminders&token=YOUR_CRON_SECRET"
 *   10 3 * * * curl -s "https://pielarmonia.com/cron.php?action=backup-health&token=YOUR_CRON_SECRET"
 *   20 3 * * * curl -s "https://pielarmonia.com/cron.php?action=backup-offsite&token=YOUR_CRON_SECRET"
 *   * * * * * curl -s "https://pielarmonia.com/cron.php?action=ai-queue-worker&token=YOUR_CRON_SECRET"
 *   * * * * * curl -s "https://pielarmonia.com/cron.php?action=clinical-history-reconcile&token=YOUR_CRON_SECRET"
 *   *\/5 * * * * curl -s "https://pielarmonia.com/cron.php?action=process-retries&token=YOUR_CRON_SECRET"
 */

require_once __DIR__ . '/api-lib.php';
require_once __DIR__ . '/lib/clinical_history/bootstrap.php';
require_once __DIR__ . '/lib/ClinicProfileStore.php';
require_once __DIR__ . '/lib/NotificationService.php';
require_once __DIR__ . '/lib/SoftwareSubscriptionService.php';

apply_security_headers(false);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// --- Helper Functions ---

function cron_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit();
}

function cron_extract_token(): string
{
    $authHeader = isset($_SERVER['HTTP_AUTHORIZATION']) ? trim((string) $_SERVER['HTTP_AUTHORIZATION']) : '';
    if ($authHeader !== '') {
        if (preg_match('/^Bearer\s+(.+)$/i', $authHeader, $matches) === 1) {
            return trim((string) ($matches[1] ?? ''));
        }
        return $authHeader;
    }

    $headerToken = isset($_SERVER['HTTP_X_CRON_TOKEN']) ? trim((string) $_SERVER['HTTP_X_CRON_TOKEN']) : '';
    if ($headerToken !== '') {
        return $headerToken;
    }

    return trim((string) ($_GET['token'] ?? ''));
}

function cron_calculate_next_retry(int $attempt): ?string
{
    // Exponential backoff: 5min, 30min, 2hr
    if ($attempt >= 3) {
        return null;
    }

    $now = time();
    $delay = 0;

    switch ($attempt) {
        case 0:
            $delay = 5 * 60;
            break;
        case 1:
            $delay = 30 * 60;
            break;
        case 2:
            $delay = 2 * 60 * 60;
            break;
    }

    return date('Y-m-d H:i:s', $now + $delay);
}

function log_cron_failure(string $taskName, array $payload, string $error, int $attemptCount = 0): void
{
    $nextRetry = cron_calculate_next_retry($attemptCount);
    $pdo = get_db_connection(data_file_path());
    if (!$pdo) return;

    try {
        $stmt = $pdo->prepare("INSERT INTO cron_failures (task_name, payload, attempt_count, next_retry_at, last_error) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([
            $taskName,
            json_encode($payload, JSON_UNESCAPED_UNICODE),
            $attemptCount,
            $nextRetry,
            $error
        ]);
    } catch (PDOException $e) {
        error_log("Failed to log cron failure: " . $e->getMessage());
    }
}

function update_cron_failure(int $id, int $attemptCount, string $error): void
{
    $nextRetry = cron_calculate_next_retry($attemptCount);
    $pdo = get_db_connection(data_file_path());
    if (!$pdo) return;

    try {
        if ($nextRetry === null) {
            $stmt = $pdo->prepare("UPDATE cron_failures SET attempt_count = ?, last_error = ?, next_retry_at = NULL WHERE id = ?");
            $stmt->execute([$attemptCount, $error, $id]);
        } else {
            $stmt = $pdo->prepare("UPDATE cron_failures SET attempt_count = ?, last_error = ?, next_retry_at = ? WHERE id = ?");
            $stmt->execute([$attemptCount, $error, $nextRetry, $id]);
        }
    } catch (PDOException $e) {
        error_log("Failed to update cron failure: " . $e->getMessage());
    }
}

function cron_run_task_safely(string $taskName, callable $callback, array $payload, ?int $retryId = null, int $attemptCount = 0): array
{
    $start = microtime(true);
    try {
        $result = $callback($payload);
        $duration = microtime(true) - $start;

        $result['duration_sec'] = $duration;

        if ($retryId !== null) {
             $pdo = get_db_connection(data_file_path());
             if ($pdo) {
                 $pdo->prepare("DELETE FROM cron_failures WHERE id = ?")->execute([$retryId]);
             }
        }

        return $result;
    } catch (Throwable $e) {
        $duration = microtime(true) - $start;
        $error = $e->getMessage();

        if ($retryId !== null) {
            update_cron_failure($retryId, $attemptCount + 1, $error);
        } else {
            log_cron_failure($taskName, $payload, $error, 0);
        }

        return [
            'ok' => false,
            'error' => $error,
            'duration_sec' => $duration
        ];
    }
}

function cron_queue_software_trial_reminder(array $clinicProfile, array $lifecycle): array
{
    $phone = trim((string) ($clinicProfile['phone'] ?? ''));
    if ($phone === '') {
        return [
            'queued' => false,
            'reason' => 'missing_phone',
            'outboxId' => '',
        ];
    }

    if (!function_exists('whatsapp_openclaw_repository')) {
        $bootstrap = __DIR__ . '/lib/whatsapp_openclaw/bootstrap.php';
        if (is_file($bootstrap)) {
            require_once $bootstrap;
        }
    }

    if (!function_exists('whatsapp_openclaw_repository')) {
        return [
            'queued' => false,
            'reason' => 'queue_unavailable',
            'outboxId' => '',
        ];
    }

    $clinicName = trim((string) ($clinicProfile['clinicName'] ?? 'Flow OS'));
    if ($clinicName === '') {
        $clinicName = 'Flow OS';
    }
    $trialEndsAt = trim((string) ($lifecycle['trialEndsAt'] ?? ''));
    $trialEndsLabel = $trialEndsAt !== ''
        ? local_date('Y-m-d') === substr($trialEndsAt, 0, 10)
            ? 'hoy'
            : (function_exists('format_date_label')
                ? format_date_label(substr($trialEndsAt, 0, 10))
                : substr($trialEndsAt, 0, 10))
        : 'pronto';
    $planLabel = trim((string) ($lifecycle['planLabel'] ?? 'Pro'));
    $daysRemaining = max(0, (int) ($lifecycle['daysRemaining'] ?? 0));
    $renewUrl = rtrim((string) (AppConfig::BASE_URL ?? ''), '/') . '/admin.html#settings';
    $text = "Hola, {$clinicName}. Tu trial de *{$planLabel}* en Flow OS termina {$trialEndsLabel}. ";
    $text .= $daysRemaining > 0
        ? "Te quedan {$daysRemaining} dias para renovar y no bajar a Free.\n\n"
        : "Renueva hoy para no bajar a Free.\n\n";
    $text .= "Abre {$renewUrl} y activa Stripe desde Ajustes > Suscripción Flow OS.";

    $record = whatsapp_openclaw_repository()->enqueueOutbox([
        'phone' => $phone,
        'source' => 'system',
        'type' => 'text',
        'text' => $text,
        'status' => 'pending',
        'priority' => 'high',
        'category' => 'software_subscription_trial',
        'template' => 'software_trial_day12',
        'meta' => [
            'trialEndsAt' => $trialEndsAt,
            'daysRemaining' => $daysRemaining,
            'planKey' => (string) ($lifecycle['planKey'] ?? 'pro'),
        ],
    ]);

    return [
        'queued' => true,
        'reason' => '',
        'outboxId' => (string) ($record['id'] ?? ''),
    ];
}

function cron_process_software_subscription_trial(array $payload = []): array
{
    $profile = read_clinic_profile();
    $lifecycle = SoftwareSubscriptionService::describeTrialLifecycle($profile, [
        'now' => (string) ($payload['now'] ?? local_date('c')),
    ]);

    $summary = [
        'active' => (bool) ($lifecycle['active'] ?? false),
        'queued' => 0,
        'downgraded' => 0,
        'missingPhone' => 0,
        'queueUnavailable' => 0,
        'changed' => false,
        'trialEndsAt' => (string) ($lifecycle['trialEndsAt'] ?? ''),
        'daysRemaining' => (int) ($lifecycle['daysRemaining'] ?? 0),
    ];

    if (!(bool) ($lifecycle['active'] ?? false)) {
        return $summary;
    }

    $nextProfile = $profile;

    if ((bool) ($lifecycle['shouldSendReminder'] ?? false)) {
        $result = cron_queue_software_trial_reminder($profile, $lifecycle);
        if ($result['queued']) {
            $nextProfile = SoftwareSubscriptionService::markTrialReminderSent(
                $nextProfile,
                'whatsapp',
                (string) ($result['outboxId'] ?? ''),
                (string) ($payload['now'] ?? local_date('c'))
            );
            $summary['queued'] = 1;
            $summary['changed'] = true;
        } elseif ($result['reason'] === 'missing_phone') {
            $summary['missingPhone'] = 1;
        } elseif ($result['reason'] === 'queue_unavailable') {
            $summary['queueUnavailable'] = 1;
        }
    }

    if ((bool) ($lifecycle['shouldDowngrade'] ?? false)) {
        $nextProfile = SoftwareSubscriptionService::downgradeExpiredTrial(
            $nextProfile,
            (string) ($payload['now'] ?? local_date('c'))
        );
        $summary['downgraded'] = 1;
        $summary['changed'] = true;
    }

    if ($summary['changed']) {
        $nextProfile['updatedAt'] = local_date('c');
        if (write_clinic_profile($nextProfile)) {
            return $summary;
        }

        $summary['changed'] = false;
        $summary['persistFailed'] = 1;
    }

    return $summary;
}

// --- Task Functions ---

function cron_task_reminders(array $payload): array
{
    $today = trim((string) ($payload['today'] ?? local_date('Y-m-d')));
    if ($today === '') {
        $today = local_date('Y-m-d');
    }

    $tomorrow = trim((string) ($payload['tomorrow'] ?? ''));
    if ($tomorrow === '') {
        try {
            $tomorrow = (new DateTimeImmutable($today))->modify('+1 day')->format('Y-m-d');
        } catch (Throwable $e) {
            $tomorrow = date('Y-m-d', strtotime('+1 day'));
        }
    }

    $store = read_store();
    $sent = 0;
    $skipped = 0;
    $failed = 0;

    if (!isset($store['appointments']) || !is_array($store['appointments'])) {
        return ['ok' => false, 'error' => 'Store corrupt or empty'];
    }

    $appointmentReminderSummary = LeadOpsService::queueAppointmentReminders($store, [
        'today' => $today,
        'tomorrow' => $tomorrow,
    ]);
    $sent += (int) ($appointmentReminderSummary['queued'] ?? 0);

    $appointmentPushReminderSummary = NotificationService::queueAppointmentPushReminders($store, [
        'today' => $today,
        'tomorrow' => $tomorrow,
    ]);
    $sent += (int) ($appointmentPushReminderSummary['queued'] ?? 0);

    $postConsultationSummary = LeadOpsService::queuePostConsultationFollowUps($store, [
        'now' => (string) ($payload['now'] ?? local_date('c')),
    ]);
    $sent += (int) ($postConsultationSummary['queued'] ?? 0);

    $medicationReminderSummary = LeadOpsService::queueMedicationTreatmentReminders($store, [
        'now' => (string) ($payload['now'] ?? local_date('c')),
    ]);
    $sent += (int) ($medicationReminderSummary['queued'] ?? 0);

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
            $appt['reminderChannel'] = 'email';
            $sent++;
            $appointmentReminderSummary['emailFallbackSent'] = (int) ($appointmentReminderSummary['emailFallbackSent'] ?? 0) + 1;
        } else {
            $failed++;
            $appointmentReminderSummary['emailFallbackFailed'] = (int) ($appointmentReminderSummary['emailFallbackFailed'] ?? 0) + 1;
        }
    }
    unset($appt);

    $skipped = (int) ($appointmentReminderSummary['skipped'] ?? 0);
    $failed += (int) ($appointmentReminderSummary['queueUnavailable'] ?? 0);
    $failed += (int) ($appointmentPushReminderSummary['failed'] ?? 0);
    $failed += (int) ($appointmentPushReminderSummary['notConfigured'] ?? 0);
    $failed += (int) ($postConsultationSummary['queueUnavailable'] ?? 0);
    $failed += (int) ($medicationReminderSummary['queueUnavailable'] ?? 0);

    $birthdaySummary = LeadOpsService::queueBirthdayGreetings($store, [
        'today' => $today,
    ]);

    $softwareTrialSummary = cron_process_software_subscription_trial([
        'now' => (string) ($payload['now'] ?? local_date('c')),
    ]);
    $sent += (int) ($softwareTrialSummary['queued'] ?? 0);
    $failed += (int) ($softwareTrialSummary['queueUnavailable'] ?? 0);

    if ($sent > 0 || (int) ($birthdaySummary['queued'] ?? 0) > 0) {
        write_store($store);
    }

    return [
        'ok' => true,
        'action' => 'reminders',
        'today' => $today,
        'date' => $tomorrow,
        'sent' => $sent,
        'skipped' => $skipped,
        'failed' => $failed,
        'appointmentReminders' => $appointmentReminderSummary,
        'appointmentPushReminders' => $appointmentPushReminderSummary,
        'postConsultationFollowUps' => $postConsultationSummary,
        'medicationReminders' => $medicationReminderSummary,
        'birthdays' => $birthdaySummary,
        'softwareSubscriptionTrial' => $softwareTrialSummary,
    ];
}

function cron_task_backup_health(array $payload): array
{
    if (!function_exists('backup_latest_status')) {
         throw new Exception('Modulo de backup no disponible');
    }

    $rawMaxAge = isset($payload['maxAgeHours']) ? (int) $payload['maxAgeHours'] : 0;
    $maxAgeHours = $rawMaxAge > 0 ? $rawMaxAge : backup_health_max_age_hours();

    $status = backup_latest_status($maxAgeHours);
    $status['offsiteConfigured'] = backup_offsite_configured();
    $status['replicaMode'] = function_exists('backup_replica_mode') ? backup_replica_mode() : 'none';
    $status['timestamp'] = local_date('c');

    audit_log_event(
        ($status['ok'] ?? false) ? 'cron.backup_health.ok' : 'cron.backup_health.warn',
        [
            'ok' => (bool) ($status['ok'] ?? false),
            'reason' => (string) ($status['reason'] ?? ''),
            'count' => (int) ($status['count'] ?? 0),
            'latestAgeHours' => $status['latestAgeHours'] ?? null,
            'maxAgeHours' => (int) ($status['maxAgeHours'] ?? $maxAgeHours),
            'offsiteConfigured' => (bool) $status['offsiteConfigured'],
            'replicaMode' => (string) ($status['replicaMode'] ?? 'none')
        ]
    );

    return [
        'ok' => (bool) ($status['ok'] ?? false),
        'action' => 'backup-health',
        'data' => $status
    ];
}

function cron_task_backup_offsite(array $payload): array
{
    if (!function_exists('backup_create_offsite_snapshot') || !function_exists('backup_upload_file')) {
        throw new Exception('Modulo de backup no disponible');
    }

    $dryRun = parse_bool($payload['dryRun'] ?? false);
    $snapshot = backup_create_offsite_snapshot();

    if (($snapshot['ok'] ?? false) !== true) {
        audit_log_event('cron.backup_offsite.fail', [
            'reason' => (string) ($snapshot['reason'] ?? 'snapshot_failed')
        ]);
        throw new Exception('No se pudo crear snapshot de backup: ' . ($snapshot['reason'] ?? 'unknown'));
    }

    $snapshotSummary = [
        'createdAt' => (string) ($snapshot['createdAt'] ?? local_date('c')),
        'file' => (string) ($snapshot['file'] ?? ''),
        'gzipFile' => (string) ($snapshot['gzipFile'] ?? ''),
        'sizeBytes' => (int) ($snapshot['sizeBytes'] ?? 0),
        'sha256' => (string) ($snapshot['sha256'] ?? ''),
        'counts' => isset($snapshot['counts']) && is_array($snapshot['counts']) ? $snapshot['counts'] : []
    ];

    $replicaMode = function_exists('backup_replica_mode') ? backup_replica_mode() : 'none';
    if ($dryRun) {
        audit_log_event('cron.backup_offsite.dry_run', [
            'file' => $snapshotSummary['file'],
            'sizeBytes' => $snapshotSummary['sizeBytes'],
            'offsiteConfigured' => backup_offsite_configured(),
            'replicaMode' => $replicaMode
        ]);

        return [
            'ok' => true,
            'action' => 'backup-offsite',
            'dryRun' => true,
            'offsiteConfigured' => backup_offsite_configured(),
            'replicaMode' => $replicaMode,
            'snapshot' => $snapshotSummary
        ];
    }

    if ($replicaMode === 'none') {
        audit_log_event('cron.backup_offsite.warn', [
            'reason' => 'offsite_not_configured',
            'file' => $snapshotSummary['file'],
            'replicaMode' => 'none'
        ]);

        throw new Exception('No hay destino de replica configurado');
    }

    $replicaMetadata = [
        'source' => 'pielarmonia',
        'storeEncrypted' => store_file_is_encrypted(),
        'dataDir' => basename((string) data_dir_path()),
        'snapshotCreatedAt' => (string) ($snapshot['createdAt'] ?? local_date('c')),
        'snapshotSha256' => (string) ($snapshot['sha256'] ?? ''),
        'runtimeVersion' => app_runtime_version()
    ];

    $upload = $replicaMode === 'remote'
        ? backup_upload_file((string) $snapshot['uploadPath'], $replicaMetadata)
        : backup_replicate_local_file((string) $snapshot['uploadPath'], $replicaMetadata);

    $uploadOk = (bool) ($upload['ok'] ?? false);
    audit_log_event($uploadOk ? 'cron.backup_offsite.ok' : 'cron.backup_offsite.fail', [
        'replicaMode' => $replicaMode,
        'status' => (int) ($upload['status'] ?? 0),
        'reason' => (string) ($upload['reason'] ?? ''),
        'file' => $snapshotSummary['file']
    ]);

    if (!$uploadOk) {
        throw new Exception('Upload failed: ' . ($upload['reason'] ?? 'unknown'));
    }

    return [
        'ok' => true,
        'action' => 'backup-offsite',
        'replicaMode' => $replicaMode,
        'snapshot' => $snapshotSummary,
        'upload' => $upload
    ];
}

function cron_task_ai_queue_worker(array $payload): array
{
    if (!figo_queue_enabled()) {
        throw new Exception('FIGO_PROVIDER_MODE no esta en openclaw_queue');
    }

    $maxJobs = isset($payload['maxJobs']) ? (int) $payload['maxJobs'] : null;
    $timeBudgetMs = isset($payload['timeBudgetMs']) ? (int) $payload['timeBudgetMs'] : null;
    $result = figo_queue_process_worker($maxJobs, $timeBudgetMs, true);
    $runClinicalReconcile = !array_key_exists('reconcileClinicalHistory', $payload)
        || parse_bool($payload['reconcileClinicalHistory']);
    $clinicalHistory = [
        'ok' => true,
        'skipped' => true,
        'mutated' => 0,
        'completed' => 0,
        'failed' => 0,
        'superseded' => 0,
        'remaining' => 0,
    ];
    if ($runClinicalReconcile) {
        $clinicalHistory = cron_run_clinical_history_reconcile($payload);
        $clinicalHistory['skipped'] = false;
    }

    return [
        'ok' => (bool) ($result['ok'] ?? false),
        'action' => 'ai-queue-worker',
        'processed' => (int) ($result['processed'] ?? 0),
        'completed' => (int) ($result['completed'] ?? 0),
        'failed' => (int) ($result['failed'] ?? 0),
        'remaining' => (int) ($result['remaining'] ?? 0),
        'expired' => (int) ($result['expired'] ?? 0),
        'deleted' => (int) ($result['deleted'] ?? 0),
        'durationMs' => (int) ($result['durationMs'] ?? 0),
        'reason' => isset($result['reason']) ? (string) $result['reason'] : '',
        'clinicalHistory' => $clinicalHistory,
        'timestamp' => gmdate('c')
    ];
}

function cron_run_clinical_history_reconcile(array $payload): array
{
    $service = new ClinicalHistoryService();
    $maxSessions = isset($payload['maxClinicalSessions']) ? (int) $payload['maxClinicalSessions'] : null;
    $lock = with_store_lock(static function () use ($service, $maxSessions): array {
        $store = read_store();
        $result = $service->reconcilePendingSessions($store, [
            'maxSessions' => $maxSessions,
        ]);
        if (($result['ok'] ?? false) !== true) {
            return $result;
        }

        $nextStore = isset($result['store']) && is_array($result['store']) ? $result['store'] : $store;
        if ((int) ($result['mutated'] ?? 0) > 0 && !write_store($nextStore, false)) {
            return [
                'ok' => false,
                'error' => 'No se pudo guardar la reconciliacion de historia clinica',
            ];
        }

        $result['store'] = $nextStore;
        return $result;
    });
    if (($lock['ok'] ?? false) !== true) {
        throw new Exception('No se pudo bloquear la reconciliacion de historia clinica');
    }

    $result = isset($lock['result']) && is_array($lock['result']) ? $lock['result'] : [];
    if (($result['ok'] ?? false) !== true) {
        throw new Exception((string) ($result['error'] ?? 'No se pudo reconciliar historias clinicas pendientes'));
    }

    audit_log_event('cron.clinical_history_reconcile', [
        'scanned' => (int) ($result['scanned'] ?? 0),
        'mutated' => (int) ($result['mutated'] ?? 0),
        'completed' => (int) ($result['completed'] ?? 0),
        'failed' => (int) ($result['failed'] ?? 0),
        'superseded' => (int) ($result['superseded'] ?? 0),
        'remaining' => (int) ($result['remaining'] ?? 0),
    ]);

    return [
        'ok' => true,
        'scanned' => (int) ($result['scanned'] ?? 0),
        'mutated' => (int) ($result['mutated'] ?? 0),
        'completed' => (int) ($result['completed'] ?? 0),
        'failed' => (int) ($result['failed'] ?? 0),
        'superseded' => (int) ($result['superseded'] ?? 0),
        'closed' => (int) ($result['closed'] ?? 0),
        'remaining' => (int) ($result['remaining'] ?? 0),
        'processedSessionIds' => isset($result['processedSessionIds']) && is_array($result['processedSessionIds'])
            ? array_values($result['processedSessionIds'])
            : [],
    ];
}

function cron_task_clinical_history_reconcile(array $payload): array
{
    $result = cron_run_clinical_history_reconcile($payload);
    $result['action'] = 'clinical-history-reconcile';
    $result['timestamp'] = gmdate('c');
    return $result;
}

function cron_task_gift_cards_reminders(array $payload): array
{
    require_once __DIR__ . '/lib/gift_cards/GiftCardService.php';
    require_once __DIR__ . '/lib/email.php';

    $daysAhead = isset($payload['days']) ? (int) $payload['days'] : 14;
    
    try {
        $expiringCards = GiftCardService::getExpiringCards($daysAhead);
    } catch (Throwable $e) {
        return ['ok' => false, 'error' => 'Error querying gift cards: ' . $e->getMessage()];
    }

    $sent = 0;
    $failed = 0;

    foreach ($expiringCards as $card) {
        $cardArray = [
            'code' => $card->code,
            'balance_cents' => $card->balance_cents,
            'recipient_email' => $card->recipient_email,
            'expires_at' => $card->expires_at,
        ];

        if (maybe_send_gift_card_reminder_email($cardArray)) {
            GiftCardService::markReminderSent($card->code);
            $sent++;
        } else {
            $failed++;
        }
    }

    return [
        'ok' => true,
        'action' => 'gift-cards-reminders',
        'cardsFound' => count($expiringCards),
        'sent' => $sent,
        'failed' => $failed,
        'timestamp' => gmdate('c')
    ];
}

function cron_process_retries(): array
{
    $pdo = get_db_connection(data_file_path());
    if (!$pdo) {
        return ['ok' => false, 'error' => 'DB connection failed'];
    }

    $stmt = $pdo->prepare("SELECT * FROM cron_failures WHERE next_retry_at <= datetime('now') AND attempt_count < 3");
    $stmt->execute();
    $failures = $stmt->fetchAll();

    $results = [];

    foreach ($failures as $failure) {
        $taskName = $failure['task_name'];
        $payload = json_decode($failure['payload'], true);
        if (!is_array($payload)) $payload = [];

        $callback = 'cron_task_' . str_replace('-', '_', $taskName);
        if (function_exists($callback)) {
             $results[] = cron_run_task_safely($taskName, $callback, $payload, (int)$failure['id'], (int)$failure['attempt_count']);
        }
    }

    return [
        'ok' => true,
        'processed_count' => count($results),
        'results' => $results
    ];
}

// --- Main Execution ---

if (defined('AURORADERM_CRON_BOOTSTRAP_ONLY') && AURORADERM_CRON_BOOTSTRAP_ONLY) {
    return;
}

$secret = app_env('AURORADERM_CRON_SECRET');
if (!is_string($secret) || $secret === '') {
    cron_response(['ok' => false, 'error' => 'CRON_SECRET no configurado'], 500);
}

$token = cron_extract_token();
if (!hash_equals($secret, $token)) {
    cron_response(['ok' => false, 'error' => 'Token invalido'], 403);
}

$action = trim((string) ($_GET['action'] ?? ''));
$payload = $_GET;

if ($action === 'process-retries') {
    $result = cron_process_retries();
    cron_response($result);
}

$taskFunction = 'cron_task_' . str_replace('-', '_', $action);

if (function_exists($taskFunction)) {
    $result = cron_run_task_safely($action, $taskFunction, $payload);

    $status = 200;
    if (isset($result['ok']) && $result['ok'] === false) {
        // Map common errors to status codes if possible, or default to 500 for exceptions
        if (isset($result['error']) && strpos($result['error'], 'no disponible') !== false) {
            $status = 503;
        } else {
             // If it was just ok=false without exception, original code used 503 for some cases (like queue full? backup fail?)
             // We can default to 503 if ok=false for simplicity, or 500 if it was an exception.
             // But `cron_run_task_safely` returns ok=false on exception.
             $status = 500;
        }
    }

    cron_response($result, $status);
}

cron_response(['ok' => false, 'error' => 'Accion no valida'], 400);
