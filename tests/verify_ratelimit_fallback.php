<?php

declare(strict_types=1);

require_once __DIR__ . '/../api-lib.php';

echo "Verifying Rate Limit Logic (Fallback/Default)...\n";

$action = 'test_fallback_' . uniqid();
$limit = 5;
$window = 2;

// Ensure clean slate
reset_rate_limit($action);

// 1. Check if Redis is enabled (should be null in this env)
$redis = get_redis_client();
if ($redis !== null) {
    echo "WARNING: Redis IS available. This test expects Redis to be unavailable to test fallback.\n";
} else {
    echo "Redis unavailable. Testing fallback to file system.\n";
}

// 2. Perform requests
for ($i = 0; $i < $limit; $i++) {
    if (!check_rate_limit($action, $limit, $window)) {
        echo "FAILED: Request $i blocked prematurely.\n";
        exit(1);
    }
}
echo "5 requests allowed.\n";

// 3. Block
if (check_rate_limit($action, $limit, $window)) {
    echo "FAILED: 6th request allowed (should be blocked).\n";
    exit(1);
}
echo "6th request blocked.\n";

// 4. Verify file exists
$filePath = rate_limit_file_path($action);
if (!file_exists($filePath)) {
    echo "FAILED: Rate limit file not found at $filePath\n";
    exit(1);
}
echo "Rate limit file created at $filePath\n";

// 5. Wait and retry
echo "Waiting for window ($window s)...\n";
sleep($window + 1);

if (!check_rate_limit($action, $limit, $window)) {
    echo "FAILED: Request blocked after window expiration.\n";
    exit(1);
}
echo "Request allowed after window expiration.\n";

echo "SUCCESS: Fallback mechanism verified.\n";
