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
run_test('Standard service (consulta) with default VAT (15% logic but 0% specific)', function() {
    // Clear any previous env var to ensure default
    putenv('PIELARMONIA_VAT_RATE');

    // "consulta" has specific 0% tax in business logic
    // 40.00 + (40.00 * 0.00) = 40.00
    $expected = '$40.00';
    $actual = get_service_total_price('consulta');
    return assert_equals($expected, $actual);
});

// Test 2: Custom VAT (15%) - Affects fallback logic but 'consulta' is hardcoded 0%?
// No, 'consulta' is hardcoded in business.php.
// Let's test a service that uses standard rate if any, or just verify 'laser' which is 15%
run_test('Aesthetic service (laser) with 15% VAT', function() {
    // 150.00 + (150.00 * 0.15) = 150.00 + 22.50 = 172.50
    $expected = '$172.50';
    $actual = get_service_total_price('laser');

    return assert_equals($expected, $actual);
});

// Test 3: Zero VAT (0%)
run_test('Standard service (consulta) remains 0% tax regardless of env var', function() {
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
    putenv('PIELARMONIA_VAT_RATE=0.15'); // Ensure default

    // Unknown service returns 0.0 price. Total should be 0.00
    $expected = '$0.00';
    $actual = get_service_total_price('unknown_service_' . uniqid());

    return assert_equals($expected, $actual);
});

// Test 5: Verify Tax Rate Robustness (Config vs Env)
run_test('Service price ignores env variable if tax_rate is hardcoded', function() {
    // Setting env var should NOT affect services with explicit tax_rate in business.php
    putenv('PIELARMONIA_VAT_RATE=50');

    // Consulta is hardcoded to 0.00
    $expectedA = '$40.00';
    $actualA = get_service_total_price('consulta');
    if (!assert_equals($expectedA, $actualA, 'Consulta should remain at 0% tax')) return false;

    // Clean up
    putenv('PIELARMONIA_VAT_RATE');

    return true;
});

echo "\nAll tests passed!\n";
