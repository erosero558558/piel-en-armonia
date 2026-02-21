<?php

declare(strict_types=1);

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/storage.php';

/**
 * Audit Logging Helpers
 */

function audit_log_event(string $event, array $details = []): void
{
    $line = [
        'ts' => local_date('c'),
        'event' => $event,
        'ip' => (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'),
        'actor' => (session_status() === PHP_SESSION_ACTIVE && !empty($_SESSION['admin_logged_in'])) ? 'admin' : 'public',
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
