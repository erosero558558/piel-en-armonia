<?php
declare(strict_types=1);

// Set up temporary directory for data
$tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pielarmonia-test-' . bin2hex(random_bytes(4));
if (!mkdir($tempDir, 0775, true)) {
    die("Failed to create temp directory: $tempDir\n");
}

// Ensure clean state by setting environment variable
putenv("PIELARMONIA_DATA_DIR=$tempDir");

// Load the library
require_once __DIR__ . '/../api-lib.php';

$allPassed = true;

// Helper to assert
function assert_true($condition, $message) {
    global $allPassed;
    if (!$condition) {
        echo "FAIL: $message\n";
        $allPassed = false;
    } else {
        echo "PASS: $message\n";
    }
}

// Test create_store_backup_locked
function test_create_store_backup_locked() {
    global $tempDir;

    echo "\nRunning test_create_store_backup_locked...\n";

    // Prepare content
    $storeContent = json_encode(['test' => 'data']);

    // Create a temporary file to act as the store file
    $storeFile = $tempDir . '/store.json';
    file_put_contents($storeFile, $storeContent);

    // Open the file as a resource
    $fp = fopen($storeFile, 'r+');
    if (!$fp) {
        assert_true(false, "Failed to open store file resource.");
        return;
    }

    // Call the function
    create_store_backup_locked($fp);

    // Verify backup file creation
    $backupDir = $tempDir . DIRECTORY_SEPARATOR . 'backups';
    if (!is_dir($backupDir)) {
        assert_true(false, "Backup directory was not created.");
    } else {
        $backupFiles = glob($backupDir . DIRECTORY_SEPARATOR . 'store-*.json');
        assert_true(count($backupFiles) === 1, "Expected exactly 1 backup file, found " . count($backupFiles));

        if (count($backupFiles) > 0) {
            $backupContent = file_get_contents($backupFiles[0]);
            assert_true($backupContent === $storeContent, "Backup content matches original content.");
        }
    }

    fclose($fp);

    // Scenario 2: Invalid resource (should not crash and not create backup)
    // We already have 1 backup file.
    create_store_backup_locked(null);
    create_store_backup_locked("string");
    create_store_backup_locked(123);

    $backupFilesAfter = glob($backupDir . DIRECTORY_SEPARATOR . 'store-*.json');
    assert_true(count($backupFilesAfter) === 1, "Invalid resource inputs did not create extra backups.");

    // Scenario 3: Empty file (should not create backup)
    $emptyFile = $tempDir . '/empty.json';
    touch($emptyFile);
    $fpEmpty = fopen($emptyFile, 'r+');
    create_store_backup_locked($fpEmpty);
    fclose($fpEmpty);

    $backupFilesAfterEmpty = glob($backupDir . DIRECTORY_SEPARATOR . 'store-*.json');
    assert_true(count($backupFilesAfterEmpty) === 1, "Empty file did not create backup.");
}

try {
    test_create_store_backup_locked();
} catch (Throwable $e) {
    echo "EXCEPTION: " . $e->getMessage() . "\n";
    $allPassed = false;
}

// Cleanup
function cleanup_dir($dir) {
    if (!is_dir($dir)) return;
    $files = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($files as $fileinfo) {
        $todo = ($fileinfo->isDir() ? 'rmdir' : 'unlink');
        @$todo($fileinfo->getRealPath());
    }
    rmdir($dir);
}
cleanup_dir($tempDir);

if ($allPassed) {
    echo "\nAll tests passed!\n";
    exit(0);
} else {
    echo "\nSome tests failed.\n";
    exit(1);
}
