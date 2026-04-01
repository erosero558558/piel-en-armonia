<?php

declare(strict_types=1);

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/storage.php';

/**
 * Audit Logging Helpers
 */

/**
 * Writes an audit record to the persistent log and structured logger.
 *
 * @param string $event Event identifier (example: booking.created).
 * @param array<string,mixed> $details Additional context persisted with the event.
 */
function audit_log_event(string $event, array $details = []): void
{
    $actor = 'public';
    if (session_status() === PHP_SESSION_ACTIVE) {
        if (function_exists('operator_auth_is_authenticated') && operator_auth_is_authenticated()) {
            $actor = 'admin';
        } elseif (!empty($_SESSION['admin_logged_in'])) {
            $actor = 'admin';
        }
    }

    $line = [
        'ts' => local_date('c'),
        'event' => $event,
        'ip' => (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'),
        'actor' => $actor,
        'path' => (string) ($_SERVER['REQUEST_URI'] ?? ''),
        'details' => $details
    ];

    $encoded = json_encode($line, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($encoded) || $encoded === '') {
        return;
    }

    $dir = data_dir_path();
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    ensure_data_htaccess($dir);
    @file_put_contents(audit_log_file_path(), $encoded . PHP_EOL, FILE_APPEND | LOCK_EX);

    if (function_exists('get_logger')) {
        get_logger()->info($event, $line);
    }
}

/**
 * Audit changes between two configuration payloads.
 * Writes each differing field to data/config-audit.jsonl.
 *
 * @param array<string,mixed> $old Baseline array
 * @param array<string,mixed> $new Next array
 * @param string $changedBy Actor who made the change
 */
function audit_log_config_changes(array $old, array $new, string $changedBy = 'admin'): void
{
    $changes = [];
    $ts = local_date('c');

    $allKeys = array_unique(array_merge(array_keys($old), array_keys($new)));
    foreach ($allKeys as $key) {
        $oldVal = array_key_exists($key, $old) ? $old[$key] : null;
        $newVal = array_key_exists($key, $new) ? $new[$key] : null;

        if ($oldVal !== $newVal) {
            $changes[] = [
                'field'      => $key,
                'old_value'  => $oldVal,
                'new_value'  => $newVal,
                'changed_by' => $changedBy,
                'ts'         => $ts,
            ];
        }
    }

    if ($changes === []) {
        return;
    }

    $auditFile = data_dir_path() . '/config-audit.jsonl';
    $payload = '';
    foreach ($changes as $c) {
        $encoded = json_encode($c, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (is_string($encoded) && $encoded !== '') {
            $payload .= $encoded . PHP_EOL;
        }
    }

    if ($payload !== '') {
        @file_put_contents($auditFile, $payload, FILE_APPEND | LOCK_EX);
    }
}
