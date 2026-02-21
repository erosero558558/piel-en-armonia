<?php

// Simple standalone PHP test runner for api-lib.php
// Usage: php tests/api-lib_test.php

require_once __DIR__ . '/../api-lib.php';

function run_test($description, $actual, $expected)
{
    if ($actual === $expected) {
        echo "PASS: $description\n";
        return true;
    } else {
        echo "FAIL: $description\n";
        echo "  Expected: " . var_export($expected, true) . "\n";
        echo "  Actual:   " . var_export($actual, true) . "\n";
        return false;
    }
}

$tests = [];

// Test parse_bool
$tests[] = fn () => run_test('parse_bool(true) is true', parse_bool(true), true);
$tests[] = fn () => run_test('parse_bool(false) is false', parse_bool(false), false);
$tests[] = fn () => run_test('parse_bool("1") is true', parse_bool("1"), true);
$tests[] = fn () => run_test('parse_bool("true") is true', parse_bool("true"), true);
$tests[] = fn () => run_test('parse_bool("True") is true', parse_bool("True"), true);
$tests[] = fn () => run_test('parse_bool("TRUE") is true', parse_bool("TRUE"), true);
$tests[] = fn () => run_test('parse_bool("yes") is true', parse_bool("yes"), true);
$tests[] = fn () => run_test('parse_bool("on") is true', parse_bool("on"), true);
$tests[] = fn () => run_test('parse_bool("0") is false', parse_bool("0"), false);
$tests[] = fn () => run_test('parse_bool("false") is false', parse_bool("false"), false);
$tests[] = fn () => run_test('parse_bool("no") is false', parse_bool("no"), false);
$tests[] = fn () => run_test('parse_bool("off") is false', parse_bool("off"), false);
$tests[] = fn () => run_test('parse_bool("") is false', parse_bool(""), false);
$tests[] = fn () => run_test('parse_bool("random") is false', parse_bool("random"), false);
$tests[] = fn () => run_test('parse_bool(1) is true', parse_bool(1), true);
$tests[] = fn () => run_test('parse_bool(0) is false', parse_bool(0), false);
$tests[] = fn () => run_test('parse_bool(2) is false', parse_bool(2), false);
$tests[] = fn () => run_test('parse_bool(-1) is false', parse_bool(-1), false);
$tests[] = fn () => run_test('parse_bool(null) is false', parse_bool(null), false);
$tests[] = fn () => run_test('parse_bool([]) is false', parse_bool([]), false);
$tests[] = fn () => run_test('parse_bool(new stdClass()) is false', parse_bool(new stdClass()), false);
$tests[] = fn () => run_test('parse_bool(1.0) is false', parse_bool(1.0), false);

// Run all tests
$passed = 0;
$failed = 0;

foreach ($tests as $test) {
    if ($test()) {
        $passed++;
    } else {
        $failed++;
    }
}

echo "\nSummary:\n";
echo "Passed: $passed\n";
echo "Failed: $failed\n";

if ($failed > 0) {
    exit(1);
} else {
    exit(0);
}
