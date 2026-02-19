<?php
require_once __DIR__ . '/../api-lib.php';

function assert_equals($expected, $actual, $message) {
    if ($expected !== $actual) {
        echo "FAIL: $message\n";
        echo "Expected: '$expected'\n";
        echo "Actual:   '$actual'\n";
        exit(1);
    } else {
        echo "PASS: $message\n";
    }
}

echo "Testing map_callback_status...\n";

// Test 'contacted'
assert_equals('contactado', map_callback_status('contacted'), "Should map 'contacted' to 'contactado'");
assert_equals('contactado', map_callback_status('CONTACTED'), "Should map 'CONTACTED' to 'contactado'");
assert_equals('contactado', map_callback_status('  contacted  '), "Should map '  contacted  ' to 'contactado'");

// Test 'pending'
assert_equals('pendiente', map_callback_status('pending'), "Should map 'pending' to 'pendiente'");
assert_equals('pendiente', map_callback_status('PENDING'), "Should map 'PENDING' to 'pendiente'");
assert_equals('pendiente', map_callback_status('  pending  '), "Should map '  pending  ' to 'pendiente'");

// Test 'contactado' (pass through)
assert_equals('contactado', map_callback_status('contactado'), "Should keep 'contactado' as 'contactado'");
assert_equals('contactado', map_callback_status('CONTACTADO'), "Should keep 'CONTACTADO' as 'contactado'");

// Test 'pendiente' (pass through)
assert_equals('pendiente', map_callback_status('pendiente'), "Should keep 'pendiente' as 'pendiente'");
assert_equals('pendiente', map_callback_status('PENDIENTE'), "Should keep 'PENDIENTE' as 'pendiente'");

// Test invalid/unknown (defaults to 'pendiente')
assert_equals('pendiente', map_callback_status('unknown'), "Should default 'unknown' to 'pendiente'");
assert_equals('pendiente', map_callback_status(''), "Should default '' to 'pendiente'");
assert_equals('pendiente', map_callback_status('  '), "Should default '  ' to 'pendiente'");
assert_equals('pendiente', map_callback_status('cancelled'), "Should default 'cancelled' to 'pendiente'");

echo "All tests passed for map_callback_status!\n";
