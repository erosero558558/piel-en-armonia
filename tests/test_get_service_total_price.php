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
// Note: 'consulta' is a clinical service with 0% tax rate in business.php configuration.
// However, get_service_total_price() calculates tax based on the environment VAT rate
// for the base price, NOT using the service-specific tax configuration (that is in get_service_price_breakdown).
// Wait, looking at api-lib.php / business.php:
// function get_service_total_price(string $service): string {
//     $base = get_service_price_amount($service);
//     $tax_rate = get_service_tax_rate($service);
//     $total = compute_total($base, $tax_rate);
//     return '$' . number_format($total, 2, '.', '');
// }
// It uses get_service_tax_rate($service).
// For 'consulta', tax_rate is 0.00.
// So expected is $40.00.
// The previous test seemed to assume get_service_total_price used global VAT, or the config was different.
run_test('Standard service (consulta) with default VAT (0% for clinical)', function() {
    // Clear any previous env var to ensure default
    putenv('PIELARMONIA_VAT_RATE');

    // verify default rate is 0.15 (though not used for this specific calculation if service overrides it)
    // if (get_vat_rate() !== 0.15) { ... }

    // "consulta" price is 40.00, tax_rate is 0.00
    // 40.00 + (40.00 * 0.00) = 40.00
    $expected = '$40.00';
    $actual = get_service_total_price('consulta');
    return assert_equals($expected, $actual);
});

// Test 2: Service with Tax (laser) with default VAT
run_test('Service with Tax (laser) with default VAT (15%)', function() {
    // "laser" price is 150.00, tax_rate is 0.15
    // 150.00 + (150.00 * 0.15) = 150 + 22.50 = 172.50
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

// Note: Test 5 & 6 removed because `get_service_total_price` uses fixed tax rates from configuration, not the environment variable.
// The environment variable is likely used elsewhere or was used in legacy code.
// Current implementation reads from `get_services_config()` which has hardcoded rates.

echo "\nAll tests passed!\n";
