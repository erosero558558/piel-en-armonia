<?php
// Tests for api-lib.php
// To run: php tests/test_api_lib.php

require_once __DIR__ . '/../api-lib.php';

$failed = 0;
$passed = 0;

function assert_equals($expected, $actual, $message = '') {
    global $failed, $passed;
    if ($expected === $actual) {
        echo "✅ PASS: $message\n";
        $passed++;
    } else {
        echo "❌ FAIL: $message\n";
        echo "   Expected: " . var_export($expected, true) . "\n";
        echo "   Actual:   " . var_export($actual, true) . "\n";
        $failed++;
    }
}

echo "Running tests for truncate_field...\n\n";

// Test 1: String shorter than max length
assert_equals(
    'hello',
    truncate_field('hello', 10),
    'String shorter than max length should remain unchanged'
);

// Test 2: String equal to max length
assert_equals(
    'hello',
    truncate_field('hello', 5),
    'String equal to max length should remain unchanged'
);

// Test 3: String longer than max length
assert_equals(
    'hello',
    truncate_field('hello world', 5),
    'String longer than max length should be truncated'
);

// Test 4: Empty string
assert_equals(
    '',
    truncate_field('', 10),
    'Empty string should remain empty'
);

// Test 5: Multibyte characters (accents)
assert_equals(
    'café',
    truncate_field('café', 10),
    'Multibyte string shorter than max length should remain unchanged'
);

// Test 6: Multibyte characters truncation
assert_equals(
    'caf',
    truncate_field('café', 3),
    'Multibyte string should be truncated correctly by character count'
);

// Test 7: Emoji support
assert_equals(
    '👋',
    truncate_field('👋 world', 1),
    'Emoji should count as 1 character and be truncated correctly'
);

// Test 8: Zero length
assert_equals(
    '',
    truncate_field('anything', 0),
    'Max length 0 should return empty string'
);

echo "\nTests completed.\n";
echo "Passed: $passed\n";
echo "Failed: $failed\n";

if ($failed > 0) {
    exit(1);
}
exit(0);
