<?php

/**
 * Test script for get_service_total_price function.
 *
 * Usage: php tests/test_get_service_total_price.php
 */

require_once __DIR__ . '/../api-lib.php';

function run_test($description, $callback)
{
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

function assert_equals($expected, $actual, $message = '')
{
    if ($expected !== $actual) {
        echo "  Expected: " . var_export($expected, true) . "\n";
        echo "  Actual:   " . var_export($actual, true) . "\n";
        if ($message) {
            echo "  Message: $message\n";
        }
        return false;
    }
    return true;
}

// Test 1: Standard service with default VAT (consulta has 0% in business logic)
run_test('Standard service (consulta) with default VAT', function () {
    putenv('PIELARMONIA_VAT_RATE');

    $expected = '$40.00';
    $actual = get_service_total_price('consulta');
    return assert_equals($expected, $actual);
});

// Test 2: Custom VAT should not affect consulta (0% tax)
run_test('Standard service (consulta) with custom VAT (15%)', function () {
    putenv('PIELARMONIA_VAT_RATE=0.15');

    $expected = '$40.00';
    $actual = get_service_total_price('consulta');

    putenv('PIELARMONIA_VAT_RATE');
    return assert_equals($expected, $actual);
});

// Test 3: Zero VAT
run_test('Standard service (consulta) with zero VAT', function () {
    putenv('PIELARMONIA_VAT_RATE=0');

    $expected = '$40.00';
    $actual = get_service_total_price('consulta');

    putenv('PIELARMONIA_VAT_RATE');
    return assert_equals($expected, $actual);
});

// Test 4: Taxed service (laser) - 15%
run_test('Taxed service (laser) - Tax 15%', function () {
    $expected = '$172.50';
    $actual = get_service_total_price('laser');
    return assert_equals($expected, $actual);
});

// Test 5: Taxed service (rejuvenecimiento) - 15%
run_test('Taxed service (rejuvenecimiento) - Tax 15%', function () {
    $expected = '$138.00';
    $actual = get_service_total_price('rejuvenecimiento');
    return assert_equals($expected, $actual);
});

// Test 6: Unknown service
run_test('Unknown service (should be 0 price)', function () {
    $expected = '$0.00';
    $actual = get_service_total_price('unknown_service_' . uniqid());
    return assert_equals($expected, $actual);
});

// Test 7: Negative VAT should clamp to 0 (consulta remains 0% anyway)
run_test('Negative VAT (should be 0)', function () {
    putenv('PIELARMONIA_VAT_RATE=-0.5');

    $expected = '$40.00';
    $actual = get_service_total_price('consulta');

    putenv('PIELARMONIA_VAT_RATE');
    return assert_equals($expected, $actual);
});

echo "\nAll tests passed!\n";
