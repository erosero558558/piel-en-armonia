<?php
declare(strict_types=1);

require_once __DIR__ . '/../api-lib.php';

$tests = [
    // Valid emails
    ['email' => 'test@example.com', 'expected' => true, 'desc' => 'Standard email'],
    ['email' => 'user.name@domain.co.uk', 'expected' => true, 'desc' => 'Email with subdomains'],
    ['email' => 'user+tag@example.com', 'expected' => true, 'desc' => 'Email with plus tag'],
    ['email' => '123@example.com', 'expected' => true, 'desc' => 'Numeric local part'],

    // Invalid emails
    ['email' => '', 'expected' => false, 'desc' => 'Empty string'],
    ['email' => 'plainaddress', 'expected' => false, 'desc' => 'Missing @ and domain'],
    ['email' => '@example.com', 'expected' => false, 'desc' => 'Missing local part'],
    ['email' => 'user@', 'expected' => false, 'desc' => 'Missing domain'],
    ['email' => 'user@.com', 'expected' => false, 'desc' => 'Domain starts with dot'],
    // Note: 'user@com' (no dot in domain) is considered invalid by filter_var in this environment
    ['email' => 'user@com', 'expected' => false, 'desc' => 'Missing TLD / dot in domain'],
    ['email' => 'user name@example.com', 'expected' => false, 'desc' => 'Spaces in email'],
    ['email' => 'user@example .com', 'expected' => false, 'desc' => 'Spaces in domain'],
];

$failed = 0;
$passed = 0;

echo "Running validate_email tests...\n";

foreach ($tests as $test) {
    $result = validate_email($test['email']);
    if ($result === $test['expected']) {
        $passed++;
    } else {
        echo "FAIL: {$test['desc']} ({$test['email']}) - Expected " . ($test['expected'] ? 'true' : 'false') . ", got " . ($result ? 'true' : 'false') . "\n";
        $failed++;
    }
}

echo "\nSummary: $passed passed, $failed failed.\n";

if ($failed > 0) {
    exit(1);
}

exit(0);
