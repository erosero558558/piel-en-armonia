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
