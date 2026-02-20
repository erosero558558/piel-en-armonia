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

// Test 1: Standard service (consulta) - Medical Service (0% VAT)
run_test('Standard service (consulta) should be tax-free ($40.00)', function() {
    // "consulta" price is 40.00. Tax Rate is 0.00.
    // 40.00 + 0 = 40.00
    $expected = '$40.00';
    $actual = get_service_total_price('consulta');
    return assert_equals($expected, $actual);
});

// Test 2: Esthetic service (laser) - 15% VAT
run_test('Esthetic service (laser) should have 15% VAT', function() {
    // "laser" base is 150.00. Tax Rate is 0.15.
    // 150.00 * 0.15 = 22.50
    // Total = 172.50
    $expected = '$172.50';
    $actual = get_service_total_price('laser');
    return assert_equals($expected, $actual);
});

// Test 3: Environment variable override check (Should NOT affect hardcoded services)
run_test('Global VAT env var should NOT affect configured services', function() {
    putenv('PIELARMONIA_VAT_RATE=0.50'); // Set to 50%

    // Consulta should still be 0% -> $40.00
    $expected = '$40.00';
    $actual = get_service_total_price('consulta');

    // Clean up
    putenv('PIELARMONIA_VAT_RATE');

    return assert_equals($expected, $actual, "Consulta price changed despite being hardcoded 0%");
});

// Test 4: Unknown service
run_test('Unknown service (should be 0 price)', function() {
    // Unknown service returns 0.0 price. Total should be 0.00
    $expected = '$0.00';
    $actual = get_service_total_price('unknown_service_' . uniqid());

    return assert_equals($expected, $actual);
});

echo "\nAll tests passed!\n";
