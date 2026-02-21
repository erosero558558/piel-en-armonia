<?php

require_once __DIR__ . '/../api-lib.php';

$functions = [
    'local_date', 'app_runtime_version', 'data_dir_path', 'data_file_path', 'data_dir_writable',
    'store_file_is_encrypted', 'backup_dir_path', 'audit_log_file_path', 'data_encryption_key',
    'data_encrypt_payload', 'data_decrypt_payload', 'audit_log_event', 'json_response',
    'is_https_request', 'start_secure_session', 'destroy_secure_session', 'ensure_backup_dir',
    'prune_backup_files', 'create_store_backup_locked', 'ensure_data_htaccess', 'ensure_data_file',
    'read_store', 'write_store', 'acquire_store_lock', 'sanitize_phone', 'validate_email',
    'validate_phone', 'require_json_body', 'parse_bool', 'map_callback_status',
    'map_appointment_status', 'generate_csrf_token', 'verify_csrf_token', 'require_csrf',
    'check_rate_limit', 'require_rate_limit', 'verify_admin_password', 'truncate_field',
    'normalize_string_list', 'normalize_review', 'normalize_callback', 'get_vat_rate',
    'get_service_price_amount', 'get_service_price', 'get_service_total_price',
    'normalize_appointment', 'appointment_slot_taken', 'smtp_config', 'smtp_enabled',
    'smtp_send_mail', 'send_mail', 'maybe_send_appointment_email', 'maybe_send_admin_notification',
    'maybe_send_cancellation_email', 'maybe_send_callback_admin_notification',
    'maybe_send_reminder_email', 'maybe_send_reschedule_email'
];

$constants = [
    'DATA_DIR', 'DATA_FILE', 'BACKUP_DIR', 'MAX_STORE_BACKUPS', 'STORE_LOCK_TIMEOUT_MS',
    'STORE_LOCK_RETRY_DELAY_US', 'APP_TIMEZONE', 'SESSION_TIMEOUT'
];

$missing = [];
foreach ($functions as $f) {
    if (!function_exists($f)) {
        $missing[] = "Function $f";
    }
}
foreach ($constants as $c) {
    if (!defined($c)) {
        $missing[] = "Constant $c";
    }
}

if (!empty($missing)) {
    echo "Missing definitions:\n" . implode("\n", $missing) . "\n";
    exit(1);
}

echo "All definitions present.\n";
