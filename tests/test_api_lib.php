<?php
// Simple test runner for api-lib.php
// Usage: php tests/test_api_lib.php

require_once __DIR__ . '/../api-lib.php';

$failed = 0;
$passed = 0;

function run_test($name, $callback) {
    global $failed, $passed;
    try {
        $callback();
        echo "✅ $name passed\n";
        $passed++;
    } catch (Throwable $e) {
        echo "❌ $name failed: " . $e->getMessage() . "\n";
        $failed++;
    }
}

function assert_equals($expected, $actual) {
    if ($expected !== $actual) {
        throw new Exception("Expected '$expected', got '$actual'");
    }
}

echo "Running tests for api-lib.php...\n";

// Tests for sanitize_phone
run_test('sanitize_phone: basic trim', function() {
    assert_equals('1234567890', sanitize_phone(' 1234567890 '));
});

run_test('sanitize_phone: no changes needed', function() {
    assert_equals('1234567890', sanitize_phone('1234567890'));
});

run_test('sanitize_phone: empty string', function() {
    assert_equals('', sanitize_phone(''));
});

run_test('sanitize_phone: whitespace only', function() {
    assert_equals('', sanitize_phone('   '));
});

run_test('sanitize_phone: newlines and tabs', function() {
    assert_equals('1234567890', sanitize_phone("\t1234567890\n"));
});

// Summary
echo "\nTests completed: " . ($passed + $failed) . "\n";
echo "Passed: $passed\n";
echo "Failed: $failed\n";

if ($failed > 0) {
    exit(1);
}
