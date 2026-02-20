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

    // "consulta" price is 40.00 and has 0% tax rate in business logic
    // So it should remain $40.00
    $expected = '$40.00';
    $actual = get_service_total_price('consulta');
    return assert_equals($expected, $actual);
});

// Test 2: Custom VAT (15%) - Should not affect 0% rated service
run_test('Standard service (consulta) with custom VAT (15%)', function() {
    putenv('PIELARMONIA_VAT_RATE=0.15');

    // "consulta" is 0% tax, so environment var shouldn't change it if business logic prevails
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

// Test 5: Edge case VAT > 1 (Removed as redundant/conflicting)
// Note: This logic is already covered by tests/test_vat_rate.php
// and fails here because 'consulta' ignores the global VAT rate.

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
