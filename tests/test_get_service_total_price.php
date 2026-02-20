<?php
/**
 * Test script for get_service_total_price function.
 *
 * Usage: php tests/test_get_service_total_price.php
 */

require_once __DIR__ . '/../api-lib.php';

function run_test($description, $callback) {
    try {
        $result = $callback();
        if ($result === true) {
            echo "PASS: $description\n";
        } else {
            echo "FAIL: $description\n";
            exit(1);
        }
    } catch (Throwable $e) {
        echo "ERROR: $description - " . $e->getMessage() . "\n";
        exit(1);
    }
}

function assert_equals($expected, $actual, $message = '') {
    if ($expected !== $actual) {
        echo "  Expected: " . var_export($expected, true) . "\n";
        echo "  Actual:   " . var_export($actual, true) . "\n";
        if ($message) echo "  Message: $message\n";
        return false;
    }
    return true;
}

// Test 1: Standard service (consulta) - 0% Tax
run_test('Standard service (consulta) - Tax 0%', function() {
    // "consulta" price is 40.00
    // Tax 0%
    $expected = '$40.00';
    $actual = get_service_total_price('consulta');
    return assert_equals($expected, $actual);
});

// Test 2: Taxed service (laser) - 15% Tax
run_test('Taxed service (laser) - Tax 15%', function() {
    // "laser" price is 150.00
    // Tax 15% -> 150 + 22.50 = 172.50
    $expected = '$172.50';
    $actual = get_service_total_price('laser');
    return assert_equals($expected, $actual);
});

// Test 3: Taxed service (rejuvenecimiento) - 15% Tax
run_test('Taxed service (rejuvenecimiento) - Tax 15%', function() {
    // "rejuvenecimiento" price is 120.00
    // Tax 15% -> 120 + 18.00 = 138.00
    $expected = '$138.00';
    $actual = get_service_total_price('rejuvenecimiento');
    return assert_equals($expected, $actual);
});

// Test 4: Unknown service
run_test('Unknown service (should be 0 price)', function() {
    // Unknown service returns 0.0 price. Total should be 0.00
    $expected = '$0.00';
    $actual = get_service_total_price('unknown_service_' . uniqid());

    return assert_equals($expected, $actual);
});

echo "\nAll tests passed!\n";
