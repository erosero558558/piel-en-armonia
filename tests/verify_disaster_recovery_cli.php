<?php

declare(strict_types=1);

// Standalone Integration Test for Disaster Recovery
// Designed to run without PHPUnit dependencies if needed.

echo "Starting Disaster Recovery Integration Test...\n";

// Setup
global $tempDir;
$tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pielarmonia_dr_test_' . uniqid();
if (!mkdir($tempDir, 0777, true)) {
    die("Could not create temp dir: $tempDir\n");
}

// Force JSON storage for this test to match legacy expectations
putenv("PIELARMONIA_DATA_DIR=$tempDir");
$restoreScript = realpath(__DIR__ . '/../bin/restore-backup.php');

// Ensure dependencies are loaded
require_once __DIR__ . '/../lib/storage.php';
require_once __DIR__ . '/../lib/db.php';

$storeFile = data_file_path();
require_once __DIR__ . '/../lib/backup.php';

function fail($msg, $dir)
{
    echo "FAILED: $msg\n";
    // Cleanup
    if ($dir) {
        recursiveRemove($dir);
    }
    exit(1);
}

function recursiveRemove($dir)
{
    if (!$dir || !is_dir($dir)) {
        return;
    }
    $files = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($files as $fileinfo) {
        $todo = ($fileinfo->isDir() ? 'rmdir' : 'unlink');
        $todo($fileinfo->getRealPath());
    }
    rmdir($dir);
}

try {
    // Make tempDir global for the fail function when running via PHPUnit
    $GLOBALS['tempDir'] = $tempDir;

    // 1. Setup Initial State
    $initialData = [
        'appointments' => [
            [
                'id' => 123,
                'name' => 'Test Patient',
                'email' => 'test@example.com',
                'status' => 'confirmed'
            ]
        ],
        'callbacks' => [],
        'reviews' => [],
        'availability' => [],
        'updatedAt' => date('c')
    ];

    echo "Attempting to write store to: $storeFile\n";
    write_store($initialData);

    // Adapt to SQLite/JSON hybrid
    if (!file_exists($storeFile)) {
        fail("Store file not created.", $tempDir);
    }

    // 2. Create Backup
    $snapshot = backup_create_offsite_snapshot();
    if (!($snapshot['ok'] ?? false)) {
        fail("Backup snapshot failed: " . ($snapshot['reason'] ?? 'unknown'), $tempDir);
    }
    $backupPath = $snapshot['path'];
    if (!file_exists($backupPath)) {
        fail("Backup file not created.", $tempDir);
    }

    // 3. Corrupt Data
    file_put_contents($storeFile, 'CORRUPTED DATA');
    if (file_get_contents($storeFile) !== 'CORRUPTED DATA') {
        fail("Failed to corrupt data.", $tempDir);
    }

    // Create a dummy file to simulate corruption, then ensure it's removed by the test setup
    // or by the restore script if we were testing that.
    // But for this test, we want to ensure success, so we rely on "missing file" scenario.
    // However, to satisfy the "Corrupt Data" step concept, we'll verify we can restore even if file is missing.

    // 4. Restore using CLI script
    // Close DB connection to release file lock before external script acts on it
    if (function_exists('close_db_connection')) {
        close_db_connection();
    }

    // We use --force to skip confirmation
    $cmd = sprintf(
        'PIELARMONIA_DATA_DIR=%s php %s %s --force',
        escapeshellarg($tempDir),
        escapeshellarg($restoreScript),
        escapeshellarg($backupPath)
    );

    exec($cmd, $output, $returnVar);

    if ($returnVar !== 0) {
        echo "\nRestore script output:\n" . implode("\n", $output) . "\n";
        fail("Restore script failed with code $returnVar", $tempDir);
    }

    // 5. Verify Restoration
    $restoredData = read_store();

    if (count($restoredData['appointments'] ?? []) !== 1) {
        fail("Restored appointments count mismatch.", $tempDir);
    }
    if (($restoredData['appointments'][0]['name'] ?? '') !== 'Test Patient') {
        fail("Restored patient name mismatch.", $tempDir);
    }

    // Check safety backup existence
    // restore-backup.php logic: $currentStorePath . '.pre-restore-' . date('Ymd-His') . '.bak'
    // $currentStorePath here is $storeFile (store.json)
    $files = glob($storeFile . '.pre-restore-*.bak');
    if (empty($files)) {
        fail("Safety backup was not created.", $tempDir);
    }

    echo "SUCCESS: Disaster Recovery Test Passed.\n";
    recursiveRemove($tempDir);
    exit(0);

} catch (Throwable $e) {
    fail("Exception: " . $e->getMessage(), $tempDir);
}
