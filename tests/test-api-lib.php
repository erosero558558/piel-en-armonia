<?php
/**
 * Test script for api-lib.php
 */

require_once dirname(__DIR__) . '/api-lib.php';

$passed = 0;
$failed = 0;

function assert_equals($expected, $actual, $message) {
    global $passed, $failed;
    if ($expected === $actual) {
        echo "PASS: $message\n";
        $passed++;
    } else {
        echo "FAIL: $message. Expected " . var_export($expected, true) . ", got " . var_export($actual, true) . "\n";
        $failed++;
    }
}

echo "Testing get_service_price_amount()...\n";

assert_equals(40.0, get_service_price_amount('consulta'), 'Price for consulta');
assert_equals(25.0, get_service_price_amount('telefono'), 'Price for telefono');
assert_equals(30.0, get_service_price_amount('video'), 'Price for video');
assert_equals(150.0, get_service_price_amount('laser'), 'Price for laser');
assert_equals(120.0, get_service_price_amount('rejuvenecimiento'), 'Price for rejuvenecimiento');
assert_equals(0.0, get_service_price_amount('unknown'), 'Price for unknown service');
assert_equals(0.0, get_service_price_amount(''), 'Price for empty service');

echo "\nResults: $passed passed, $failed failed.\n";

if ($failed > 0) {
    exit(1);
}
