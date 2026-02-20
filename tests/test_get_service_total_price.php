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
run_test('Standard service (consulta) should be tax exempt (0%)', function() {
    // Clear any previous env var to ensure default
    putenv('PIELARMONIA_VAT_RATE');

    // verify default rate is indeed 0.15
    if (get_vat_rate() !== 0.15) {
        echo "  Warning: Default VAT rate is not 0.15 as expected, it is " . get_vat_rate() . "\n";
    }

    // "consulta" price is 40.00. Tax Exempt.
    // 40.00 + 0 = 40.00
    $expected = '$40.00';
    $actual = get_service_total_price('consulta');
    return assert_equals($expected, $actual);
});

// Test 2: Service with Tax (laser)
run_test('Service (laser) with default VAT (15%)', function() {
    putenv('PIELARMONIA_VAT_RATE'); // Ensure default

    // "laser" price is 150.00.
    // 150.00 + (150.00 * 0.15) = 172.50
    $expected = '$172.50';
    $actual = get_service_total_price('laser');

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

// Tests 5 & 6 removed as get_service_total_price does not use PIELARMONIA_VAT_RATE env var
// for configured services. Services use their hardcoded tax_rate.
// Environment variable parsing is tested in test_vat_rate.php.

echo "\nAll tests passed!\n";
