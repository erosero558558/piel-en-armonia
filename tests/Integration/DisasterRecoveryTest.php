<?php

declare(strict_types=1);

// Standalone Integration Test for Disaster Recovery
// Designed to run without PHPUnit dependencies if needed.

echo "Starting Disaster Recovery Integration Test...\n";

// Setup
$tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pielarmonia_dr_test_' . uniqid();
if (!mkdir($tempDir, 0777, true)) {
    die("Could not create temp dir: $tempDir\n");
}

putenv("PIELARMONIA_DATA_DIR=$tempDir");
// Force JSON fallback because this test expects store.json manipulation
putenv("PIELARMONIA_STORAGE_JSON_FALLBACK=true");

$storeFile = $tempDir . DIRECTORY_SEPARATOR . 'store.json';
$restoreScript = realpath(__DIR__ . '/../../bin/restore-backup.php');

// Ensure dependencies are loaded
require_once __DIR__ . '/../../lib/storage.php';
require_once __DIR__ . '/../../lib/backup.php';

function fail($msg)
{
    global $tempDir;
    echo "FAILED: $msg\n";
    // Cleanup
    recursiveRemove($tempDir);
    exit(1);
}

function recursiveRemove($dir)
{
    if (!is_string($dir) || !is_dir($dir)) {
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

    write_store($initialData);

    if (!file_exists($storeFile)) {
        fail("Store file not created.");
    }

    // 2. Create Backup
    $snapshot = backup_create_offsite_snapshot();
    if (!($snapshot['ok'] ?? false)) {
        fail("Backup snapshot failed: " . ($snapshot['reason'] ?? 'unknown'));
    }
    $backupPath = $snapshot['path'];
    if (!file_exists($backupPath)) {
        fail("Backup file not created.");
    }

    // 3. Corrupt Data
    file_put_contents($storeFile, 'CORRUPTED DATA');
    if (file_get_contents($storeFile) !== 'CORRUPTED DATA') {
        fail("Failed to corrupt data.");
    }

    // 4. Restore using CLI script
    // We use --force to skip confirmation
    $cmd = sprintf(
        'PIELARMONIA_DATA_DIR=%s PIELARMONIA_STORAGE_JSON_FALLBACK=true php %s %s --force 2>&1',
        escapeshellarg($tempDir),
        escapeshellarg($restoreScript),
        escapeshellarg($backupPath)
    );

    exec($cmd, $output, $returnVar);

    if ($returnVar !== 0) {
        echo "\nRestore script output (Failure):\n" . implode("\n", $output) . "\n";
        fail("Restore script failed with code $returnVar");
    }

    // 5. Verify Restoration
    $restoredData = read_store();

    if (count($restoredData['appointments'] ?? []) !== 1) {
        fail("Restored appointments count mismatch.");
    }
    if (($restoredData['appointments'][0]['name'] ?? '') !== 'Test Patient') {
        fail("Restored patient name mismatch.");
    }

    // Check safety backup existence
    // restore-backup.php logic: $currentStorePath . '.pre-restore-' . date('Ymd-His') . '.bak'
    // $currentStorePath here is $storeFile (store.json)
    $files = glob($storeFile . '.pre-restore-*.bak');
    if (empty($files)) {
        echo "\nRestore script output (Success but missing backup):\n" . implode("\n", $output) . "\n";
        echo "Looking for pattern: " . $storeFile . '.pre-restore-*.bak' . "\n";
        $allFiles = glob($tempDir . '/*');
        echo "Files in temp dir:\n" . implode("\n", $allFiles) . "\n";
        fail("Safety backup was not created.");
    }

    echo "SUCCESS: Disaster Recovery Test Passed.\n";
    recursiveRemove($tempDir);
    exit(0);

} catch (Throwable $e) {
    fail("Exception: " . $e->getMessage());
}
