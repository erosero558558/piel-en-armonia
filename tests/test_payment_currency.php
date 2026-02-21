<?php

declare(strict_types=1);

require_once __DIR__ . '/../payment-lib.php';

$tests = [];
$passed = 0;
$failed = 0;

function run_test($name, $callback)
{
    global $tests, $passed, $failed;
    try {
        $callback();
        echo "✅ PASS: $name\n";
        $passed++;
    } catch (Throwable $e) {
        echo "❌ FAIL: $name - " . $e->getMessage() . "\n";
        $failed++;
    }
}

function assert_equals($expected, $actual)
{
    if ($expected !== $actual) {
        throw new Exception("Expected '$expected', got '$actual'");
    }
}

// Save original env
$originalEnv = getenv('PIELARMONIA_PAYMENT_CURRENCY');

// Test 1: Default
run_test('Default currency is USD', function () {
    putenv('PIELARMONIA_PAYMENT_CURRENCY'); // Unset
    assert_equals('USD', payment_currency());
});

// Test 2: Valid EUR
run_test('Valid currency EUR', function () {
    putenv('PIELARMONIA_PAYMENT_CURRENCY=EUR');
    assert_equals('EUR', payment_currency());
});

// Test 3: Lowercase conversion
run_test('Lowercase currency converted to uppercase', function () {
    putenv('PIELARMONIA_PAYMENT_CURRENCY=eur');
    assert_equals('EUR', payment_currency());
});

// Test 4: Invalid format
run_test('Invalid format returns USD', function () {
    putenv('PIELARMONIA_PAYMENT_CURRENCY=EURO');
    assert_equals('USD', payment_currency());
});

// Test 5: Whitespace trimming
run_test('Whitespace is trimmed', function () {
    putenv('PIELARMONIA_PAYMENT_CURRENCY= GBP ');
    assert_equals('GBP', payment_currency());
});

// Restore original env
if ($originalEnv !== false) {
    putenv("PIELARMONIA_PAYMENT_CURRENCY=$originalEnv");
} else {
    putenv('PIELARMONIA_PAYMENT_CURRENCY');
}

echo "\nSummary: $passed passed, $failed failed.\n";
if ($failed > 0) {
    exit(1);
}
