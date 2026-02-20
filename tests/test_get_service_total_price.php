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

// Test 1: Standard service (consulta) with 0% VAT
run_test('Standard service (consulta) with 0% VAT', function() {
    // "consulta" price is 40.00, tax_rate 0.00
    $expected = '$40.00';
    $actual = get_service_total_price('consulta');
    return assert_equals($expected, $actual);
});

// Test 2: Service with 15% VAT (laser)
run_test('Service (laser) with 15% VAT', function() {
    // 150.00 + (150.00 * 0.15) = 150.00 + 22.50 = 172.50
    $expected = '$172.50';
    $actual = get_service_total_price('laser');
    return assert_equals($expected, $actual);
});

// Test 4: Unknown service
run_test('Unknown service (should be 0 price)', function() {
    putenv('PIELARMONIA_VAT_RATE=0.12'); // Ensure default

    // Unknown service returns 0.0 price. Total should be 0.00
    $expected = '$0.00';
    $actual = get_service_total_price('unknown_service_' . uniqid());

    return assert_equals($expected, $actual);
});

// Removed tests relying on environment variable VAT modification as services now use static configuration.

echo "\nAll tests passed!\n";
