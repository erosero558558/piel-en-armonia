<?php
/**
 * Verification script for Multi-tenancy support.
 */

require_once __DIR__ . '/../lib/storage.php';
require_once __DIR__ . '/../lib/tenants.php';

// Setup temporary data directory
$tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pielarmonia-test-' . uniqid();
mkdir($tempDir);
putenv("PIELARMONIA_DATA_DIR=$tempDir");

// Clean up function
register_shutdown_function(function() use ($tempDir) {
    if (!file_exists($tempDir)) return;
    $files = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($tempDir, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($files as $fileinfo) {
        $todo = ($fileinfo->isDir() ? 'rmdir' : 'unlink');
        @$todo($fileinfo->getRealPath());
    }
    rmdir($tempDir);
});

echo "Using temp dir: $tempDir\n";

// Test 1: Default Tenant (Legacy Path Simulation)
// Manually create a legacy DB file to simulate existing install
$legacyDb = $tempDir . DIRECTORY_SEPARATOR . 'store.sqlite';
try {
    $db = new PDO("sqlite:$legacyDb");
    $db->exec("CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT)");
    $db->exec("INSERT INTO kv_store (key, value) VALUES ('tenant', 'legacy')");
    $db = null;
} catch (Exception $e) {
    echo "Setup failed: " . $e->getMessage() . "\n";
    exit(1);
}

// Reset connection cache
get_db_connection(null, true);

// Verify data_dir_path() returns root because legacy file exists
$path = data_dir_path();
echo "Default Tenant Path (Legacy): $path\n";
if ($path !== $tempDir) {
    echo "FAIL: Expected $tempDir, got $path\n";
    exit(1);
}

// Read store (should pick up legacy DB)
$conn = get_db_connection(data_file_path());
if (!$conn) {
    echo "FAIL: Could not connect to legacy DB\n";
    exit(1);
}
$stmt = $conn->query("SELECT value FROM kv_store WHERE key = 'tenant'");
$val = $stmt->fetchColumn();
echo "Legacy DB Value: $val\n";
if ($val !== 'legacy') {
    echo "FAIL: Expected 'legacy', got '$val'\n";
    exit(1);
}

// Test 2: Default Tenant (New Path - Clean/Migration scenario)
// If we delete legacy DB, it should switch to subdirectory 'pielarmonia'
// Note: We are simulating a case where legacy DB is GONE (or moved).
unlink($legacyDb);
// Reset connection cache
get_db_connection(null, true);

$path = data_dir_path();
echo "Default Tenant Path (Clean): $path\n";
if ($path !== $tempDir . DIRECTORY_SEPARATOR . 'pielarmonia') {
    echo "FAIL: Expected $tempDir/pielarmonia, got $path\n";
    exit(1);
}

// Ensure directory creation
if (!ensure_data_file()) {
    echo "FAIL: ensure_data_file() returned false\n";
    exit(1);
}
if (!is_dir($path)) {
    echo "FAIL: Directory $path not created\n";
    exit(1);
}

// Test 3: New Tenant via Header
$_SERVER['HTTP_X_TENANT_ID'] = 'tenant-a';
// Reset connection cache
get_db_connection(null, true);

$path = data_dir_path();
echo "Tenant-A Path: $path\n";
if ($path !== $tempDir . DIRECTORY_SEPARATOR . 'tenant-a') {
    echo "FAIL: Expected $tempDir/tenant-a, got $path\n";
    exit(1);
}

// Write data for Tenant A
if (!ensure_data_file()) {
    echo "FAIL: ensure_data_file() for tenant-a failed\n";
    exit(1);
}
$conn = get_db_connection(data_file_path());
// kv_store table created by ensure_data_file -> ensure_db_schema
$conn->exec("INSERT OR REPLACE INTO kv_store (key, value) VALUES ('tenant', 'tenant-a')");

// Test 4: New Tenant via Env Var
unset($_SERVER['HTTP_X_TENANT_ID']);
putenv("PIELARMONIA_TENANT_ID=tenant-b");
get_db_connection(null, true);

$path = data_dir_path();
echo "Tenant-B Path: $path\n";
if ($path !== $tempDir . DIRECTORY_SEPARATOR . 'tenant-b') {
    echo "FAIL: Expected $tempDir/tenant-b, got $path\n";
    exit(1);
}

// Write data for Tenant B
if (!ensure_data_file()) {
    echo "FAIL: ensure_data_file() for tenant-b failed\n";
    exit(1);
}
$conn = get_db_connection(data_file_path());
$conn->exec("INSERT OR REPLACE INTO kv_store (key, value) VALUES ('tenant', 'tenant-b')");

// Verify Isolation
// Switch back to Tenant A
putenv("PIELARMONIA_TENANT_ID"); // Unset
$_SERVER['HTTP_X_TENANT_ID'] = 'tenant-a';
get_db_connection(null, true);

$conn = get_db_connection(data_file_path());
$stmt = $conn->query("SELECT value FROM kv_store WHERE key = 'tenant'");
$val = $stmt->fetchColumn();
echo "Tenant-A Value Verification: $val\n";
if ($val !== 'tenant-a') {
    echo "FAIL: Isolation check failed. Expected 'tenant-a', got '$val'\n";
    exit(1);
}

echo "SUCCESS: All multi-tenancy tests passed.\n";
