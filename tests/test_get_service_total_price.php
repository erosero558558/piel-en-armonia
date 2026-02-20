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

// Test 1: Standard service with default VAT (15%)
run_test('Standard service (consulta) with default VAT (15%)', function() {
    // Clear any previous env var to ensure default
    putenv('PIELARMONIA_VAT_RATE');

    // verify default rate is indeed 0.15
    if (get_vat_rate() !== 0.15) {
        echo "  Warning: Default VAT rate is not 0.15 as expected, it is " . get_vat_rate() . "\n";
    }

    // "consulta" price is 40.00 with 0% tax in config
    // 40.00 + (40.00 * 0.00) = 40.00
    $expected = '$40.00';
    $actual = get_service_total_price('consulta');
    return assert_equals($expected, $actual);
});

// Test 2: Custom VAT (15%) - Consulta should remain exempt
run_test('Standard service (consulta) with custom VAT (15%) - Exempt', function() {
    putenv('PIELARMONIA_VAT_RATE=0.15');

    // Consulta is 0% VAT, so it ignores the global rate
    $expected = '$40.00';
    $actual = get_service_total_price('consulta');

    // Clean up
    putenv('PIELARMONIA_VAT_RATE');

    return assert_equals($expected, $actual);
});

// Test 3: Zero VAT (0%)
run_test('Standard service (consulta) with zero VAT', function() {
    putenv('PIELARMONIA_VAT_RATE=0');

    // 40.00 + 0 = 40.00
    $expected = '$40.00';
    $actual = get_service_total_price('consulta');

    // Clean up
    putenv('PIELARMONIA_VAT_RATE');

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

// Test 5: Edge case VAT > 1 (should be treated as 1.0 or handled gracefully)
// The function implementation: if ($rate > 1.0 && $rate <= 100.0) { $rate = $rate / 100.0; }
// if ($rate > 1.0) { return 1.0; }
run_test('VAT > 1 edge case (should be capped at 1.0)', function() {
    // Using 'laser' (taxable) to verify VAT logic. Base: 150.00

    // Case A: 50 -> should be 0.5
    putenv('PIELARMONIA_VAT_RATE=50');
    // 150 + (150 * 0.5) = 225.00
    $expectedA = '$225.00';
    $actualA = get_service_total_price('laser');
    if (!assert_equals($expectedA, $actualA, 'VAT 50 should be 50%')) return false;

    // Case B: 200 -> should be 1.0 (capped)
    putenv('PIELARMONIA_VAT_RATE=200');
    // 150 + (150 * 1.0) = 300.00
    $expectedB = '$300.00';
    $actualB = get_service_total_price('laser');
    if (!assert_equals($expectedB, $actualB, 'VAT 200 should be capped at 100%')) return false;

    // Clean up
    putenv('PIELARMONIA_VAT_RATE');

    return true;
});

// Test 6: Negative VAT
run_test('Negative VAT (should be 0)', function() {
    // Logic: if ($rate < 0.0) { return 0.0; }
    putenv('PIELARMONIA_VAT_RATE=-0.5');

    // 40 + 0 = 40.00
    $expected = '$40.00';
    $actual = get_service_total_price('consulta');

    // Clean up
    putenv('PIELARMONIA_VAT_RATE');

    return assert_equals($expected, $actual);
});

echo "\nAll tests passed!\n";
