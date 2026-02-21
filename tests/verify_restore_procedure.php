<?php

declare(strict_types=1);

// Prevent side effects from some included files if possible, though api-lib should be safe-ish
define('PIELARMONIA_TEST_MODE', true);

require_once __DIR__ . '/../api-lib.php';

// Helpers
function test_log($msg)
{
    echo "[TEST] $msg\n";
}

function fail($msg)
{
    echo "[FAIL] $msg\n";
    exit(1);
}

test_log("Starting Backup/Restore Verification...");

$storePath = data_file_path();
$originalStoreContent = null;

// 1. Preserve original state
if (file_exists($storePath)) {
    $originalStoreContent = file_get_contents($storePath);
    test_log("Preserved original store content (" . strlen($originalStoreContent) . " bytes)");
} else {
    test_log("No original store found, will start fresh.");
}

try {
    // 2. Create Test State
    $testId = bin2hex(random_bytes(8));
    $testState = [
        'appointments' => [
            [
                'id' => 1,
                'name' => 'Test User ' . $testId,
                'email' => 'test@example.com',
                'service' => 'consulta',
                'date' => date('Y-m-d'),
                'time' => '10:00',
                'status' => 'confirmed'
            ]
        ],
        'callbacks' => [],
        'reviews' => [],
        'availability' => []
    ];

    test_log("Writing test state to store (Test ID: $testId)...");
    write_store($testState);

    // Verify write
    $current = read_store();
    if (($current['appointments'][0]['name'] ?? '') !== 'Test User ' . $testId) {
        fail("Failed to write test state.");
    }

    // 3. Create Backup Snapshot
    test_log("Triggering backup snapshot...");
    $snapshotResult = backup_create_offsite_snapshot();

    if (!($snapshotResult['ok'] ?? false)) {
        fail("Backup creation failed: " . ($snapshotResult['reason'] ?? 'unknown'));
    }

    $backupPath = $snapshotResult['path'];
    test_log("Backup created at: $backupPath");

    // 4. Simulate Data Loss
    test_log("Simulating data loss (clearing store)...");
    // file_put_contents($storePath, '{}'); // Invalid for SQLite
    if (file_exists($storePath)) {
        // Close DB connection first if open?
        // Since we are running in same process, we might need to close.
        if (function_exists('close_db_connection')) {
            close_db_connection();
        }
        unlink($storePath);
    }

    $corrupted = read_store(); // Should be empty or default
    if (!empty($corrupted['appointments'])) {
        fail("Failed to simulate data loss.");
    }

    // 5. Restore Procedure
    test_log("Starting restore procedure from $backupPath...");

    // Simulate what the import endpoint does:
    // a. Read file content
    $backupContent = file_get_contents($backupPath);
    if ($backupContent === false) {
        fail("Could not read backup file.");
    }

    // b. Decode payload (mimicking backend logic)
    $decoded = backup_decode_store_payload($backupContent);
    if (!($decoded['ok'] ?? false)) {
        fail("Failed to decode backup payload: " . ($decoded['reason'] ?? 'unknown'));
    }

    $dataToRestore = $decoded['data'];

    // c. Write to store (The critical 'Restore' action)
    write_store($dataToRestore);
    test_log("Restore action completed.");

    // 6. Verify Restoration
    $restored = read_store();
    if (($restored['appointments'][0]['name'] ?? '') === 'Test User ' . $testId) {
        test_log("SUCCESS: Data restored correctly!");
    } else {
        fail("Restored data does not match original test state.");
    }

    // Clean up backup file
    if (file_exists($backupPath)) {
        unlink($backupPath);
        if (file_exists($backupPath . '.sha256')) {
            unlink($backupPath . '.sha256');
        }
        test_log("Cleaned up backup file.");
    }

} catch (Throwable $e) {
    fail("Exception during test: " . $e->getMessage() . "\n" . $e->getTraceAsString());
} finally {
    // 7. Restore Original Environment
    if ($originalStoreContent !== null) {
        file_put_contents($storePath, $originalStoreContent);
        test_log("Restored original store content.");
    } else {
        // If it didn't exist, maybe delete the file we created?
        // Better to leave it empty or default to avoid breaking things if file expected.
        test_log("No original store to restore.");
    }
}
