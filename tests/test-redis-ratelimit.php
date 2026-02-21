<?php

require_once __DIR__ . '/../api-lib.php';

echo "Testing Rate Limiter...\n";

// Clear any existing rate limit for this IP/action
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$action = 'test_limit_' . time(); // Unique action to avoid previous runs interference
$key = md5($ip . ':' . $action);
$shard = substr($key, 0, 2);
$file = data_dir_path() . '/ratelimit/' . $shard . '/' . $key . '.json';
if (file_exists($file)) {
    unlink($file);
}

// Test Case 1: Within limit
echo "Request 1 (Limit 2)... ";
$result = check_rate_limit($action, 2, 60);
if ($result) {
    echo "OK (Allowed)\n";
} else {
    echo "FAIL (Blocked unexpectedly)\n";
    exit(1);
}

echo "Request 2 (Limit 2)... ";
$result = check_rate_limit($action, 2, 60);
if ($result) {
    echo "OK (Allowed)\n";
} else {
    echo "FAIL (Blocked unexpectedly)\n";
    exit(1);
}

// Test Case 2: Exceed limit
echo "Request 3 (Limit 2)... ";
$result = check_rate_limit($action, 2, 60);
if (!$result) {
    echo "OK (Blocked correctly)\n";
} else {
    echo "FAIL (Allowed unexpectedly)\n";
    exit(1);
}

echo "File-based Rate Limiter Test Passed.\n";
echo "All tests passed.\n";
