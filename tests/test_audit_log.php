<?php
// Start session before any output to avoid "headers already sent"
if (session_status() === PHP_SESSION_NONE) {
    @session_start();
}

// Set up the environment for testing
$tempDir = __DIR__ . '/temp_data';
putenv("PIELARMONIA_DATA_DIR=$tempDir");

// Clean up any existing temp directory
if (is_dir($tempDir)) {
    @unlink("$tempDir/audit.log");
    @unlink("$tempDir/.htaccess");
    @rmdir($tempDir);
}

// Mock server variables
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['REQUEST_URI'] = '/test-uri';

// Include the library to be tested
require_once __DIR__ . '/../api-lib.php';

echo "Running tests...\n";

// --- Test 1: Basic Logging ---
echo "Test 1: Basic Logging... ";
audit_log_event('test_event', ['key' => 'value']);

$auditFile = audit_log_file_path();
if (!file_exists($auditFile)) {
    die("FAILED: Audit log file not created at $auditFile\n");
}

$content = file_get_contents($auditFile);
$logEntry = json_decode($content, true);

if ($logEntry['event'] !== 'test_event') {
    die("FAILED: Event name mismatch. Expected 'test_event', got '{$logEntry['event']}'\n");
}
if ($logEntry['details']['key'] !== 'value') {
    die("FAILED: Details mismatch.\n");
}
if ($logEntry['ip'] !== '127.0.0.1') {
    die("FAILED: IP mismatch.\n");
}
if ($logEntry['path'] !== '/test-uri') {
    die("FAILED: Path mismatch.\n");
}
echo "PASSED\n";


// --- Test 2: Actor Logic (Public) ---
echo "Test 2: Actor Logic (Public)... ";

// Reset session to simulate logged out
$_SESSION = [];
// Note: We keep the session active (PHP_SESSION_ACTIVE) but empty,
// OR we can destroy it. api-lib checks:
// (session_status() === PHP_SESSION_ACTIVE && !empty($_SESSION['admin_logged_in']))
// So empty $_SESSION should result in 'public'.

audit_log_event('public_event');

// Read log file again. It appends.
$lines = file($auditFile);
// The last line is the new entry
$lastLine = $lines[count($lines) - 1];
$logEntry = json_decode($lastLine, true);

if ($logEntry['actor'] !== 'public') {
    die("FAILED: Actor mismatch. Expected 'public', got '{$logEntry['actor']}'\n");
}
echo "PASSED\n";


// --- Test 3: Actor Logic (Admin) ---
echo "Test 3: Actor Logic (Admin)... ";

// Set admin logged in
$_SESSION['admin_logged_in'] = true;

audit_log_event('admin_event');

$lines = file($auditFile);
$lastLine = $lines[count($lines) - 1];
$logEntry = json_decode($lastLine, true);

if ($logEntry['actor'] !== 'admin') {
    die("FAILED: Actor mismatch. Expected 'admin', got '{$logEntry['actor']}'\n");
}
echo "PASSED\n";


// --- Test 4: Security Check (.htaccess) ---
echo "Test 4: Security Check (.htaccess)... ";
$htaccess = $tempDir . '/.htaccess';
if (!file_exists($htaccess)) {
    die("FAILED: .htaccess not created in data directory.\n");
}
echo "PASSED\n";


// --- Teardown ---
echo "Cleaning up...\n";
session_write_close();
@unlink($auditFile);
@unlink($htaccess);
@rmdir($tempDir);

echo "All tests passed!\n";
