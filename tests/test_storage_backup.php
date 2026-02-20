<?php
declare(strict_types=1);

// Set up temporary environment for testing
$tmpDataDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pielarmonia-test-storage-' . uniqid();
putenv("PIELARMONIA_DATA_DIR=$tmpDataDir");

// Clean up any existing directory (unlikely with uniqid but good practice)
if (is_dir($tmpDataDir)) {
    exec("rm -rf " . escapeshellarg($tmpDataDir));
}
mkdir($tmpDataDir, 0777, true);

// Include dependencies
require_once __DIR__ . '/test_framework.php';
require_once __DIR__ . '/../lib/storage.php';

echo "Testing Storage Backup Logic...\n";
echo "Using temp data dir: $tmpDataDir\n";

run_test('Writing to store should create a backup of the previous state', function() use ($tmpDataDir) {
    // 1. Create initial state
    // read_store() creates seed file if missing.
    $initialStore = read_store();
    $initialStore['test_key'] = 'initial_value';

    // First write. This creates a backup of the SEED data (empty structure).
    write_store($initialStore);

    // Verify file exists
    $storeFile = $tmpDataDir . '/store.json';
    assert_true(file_exists($storeFile), 'store.json should exist');
    $contentAfterFirstWrite = file_get_contents($storeFile);
    $decodedFirst = json_decode($contentAfterFirstWrite, true);
    assert_equals('initial_value', $decodedFirst['test_key'] ?? null, 'Store should have initial value');

    // 2. Modify state (this triggers backup of step 1)
    $modifiedStore = $initialStore;
    $modifiedStore['test_key'] = 'modified_value';

    // Wait at least 1 second to ensure timestamp change for deterministic sorting
    sleep(1);

    write_store($modifiedStore);

    // 3. Check for backup file
    $backupDir = $tmpDataDir . '/backups';
    assert_true(is_dir($backupDir), 'Backup directory should exist');

    $files = glob($backupDir . '/store-*.json');
    assert_greater_than(0, count($files), 'There should be at least one backup file');

    // Sort to get the latest (which should be the one created just now)
    sort($files);
    $latestBackup = end($files);

    // 4. Verify content of backup
    // The backup should contain the state BEFORE the second write, i.e., 'initial_value'
    $backupContent = file_get_contents($latestBackup);
    $backupData = json_decode($backupContent, true);

    assert_true(is_array($backupData), 'Backup content should be valid JSON');
    assert_equals('initial_value', $backupData['test_key'] ?? null, 'Backup should contain the previous state value');

    // Verify current store has new value
    $currentStore = read_store();
    assert_equals('modified_value', $currentStore['test_key'] ?? null, 'Current store should have the new value');
});

run_test('Backup rotation (max backups)', function() use ($tmpDataDir) {
    // Clear backups from previous test
    $backupDir = $tmpDataDir . '/backups';
    $files = glob($backupDir . '/*');
    foreach($files as $f) unlink($f);

    if (!is_dir($backupDir)) mkdir($backupDir, 0777, true);

    // Create 35 dummy files
    for ($i = 0; $i < 35; $i++) {
        // Ensure filenames sort correctly
        $name = sprintf('store-20230101-%06d-dummy.json', $i);
        file_put_contents($backupDir . '/' . $name, json_encode(['id' => $i]));
    }

    // Now trigger one write_store which will create one more real backup and then prune
    $store = read_store();
    $store['rotation_test'] = true;
    write_store($store);

    // Now count files
    $files = glob($backupDir . '/store-*.json');

    // Should be exactly 30 (MAX_STORE_BACKUPS)
    assert_equals(30, count($files), 'Should have exactly 30 backup files after rotation');
});

// Cleanup
exec("rm -rf " . escapeshellarg($tmpDataDir));

print_test_summary();
