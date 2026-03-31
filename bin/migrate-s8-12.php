<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/storage.php';

echo "Starting Telemedicine Legacy Uploads Migration...\n";

$lock = with_store_lock(static function (): array {
    $store = read_store();
    $uploads = is_array($store['clinical_uploads'] ?? null) ? $store['clinical_uploads'] : [];
    
    $migratedCount = 0;
    foreach ($uploads as &$upload) {
        $storageMode = trim((string) ($upload['storageMode'] ?? 'staging_legacy'));
        if ($storageMode === '' || $storageMode === 'staging_legacy') {
            $upload['storageMode'] = 'private_clinical';
            $migratedCount++;
        }
    }
    unset($upload);
    
    if ($migratedCount > 0) {
        $store['clinical_uploads'] = $uploads;
        if (!write_store($store, false)) {
            return ['ok' => false, 'error' => 'Failed to write store'];
        }
    }
    
    return ['ok' => true, 'migrated' => $migratedCount];
});

if (($lock['ok'] ?? false) !== true || !is_array($lock['result'] ?? null)) {
    echo "Error locking store: " . ($lock['error'] ?? 'Unknown') . "\n";
    exit(1);
}

$result = $lock['result'];
if (($result['ok'] ?? false) !== true) {
    echo "Error during migration: " . ($result['error'] ?? 'Unknown') . "\n";
    exit(1);
}

echo "Successfully migrated {$result['migrated']} legacy uploads to private_clinical.\n";
