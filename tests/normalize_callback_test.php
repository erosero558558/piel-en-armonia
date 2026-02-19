<?php
// tests/normalize_callback_test.php
require_once __DIR__ . '/../api-lib.php';

function assert_equals($expected, $actual, $message) {
    if ($expected !== $actual) {
        echo "FAIL: $message\n";
        echo "Expected: " . json_encode($expected) . "\n";
        echo "Actual:   " . json_encode($actual) . "\n";
        exit(1);
    } else {
        echo "PASS: $message\n";
    }
}

function test_strlen(string $value): int {
    if (function_exists('mb_strlen')) {
        return (int) mb_strlen($value, 'UTF-8');
    }
    return strlen($value);
}

echo "Running normalize_callback tests...\n";

// Test 1: Empty input
$result = normalize_callback([]);
assert_equals('pendiente', $result['status'], 'Default status should be pendiente');
assert_equals('', $result['telefono'], 'Default phone should be empty');
assert_equals('', $result['preferencia'], 'Default preference should be empty');
if (!is_int($result['id']) || $result['id'] <= 0) {
    echo "FAIL: ID should be a positive integer\n";
    exit(1);
} else {
    echo "PASS: ID generated correctly\n";
}

// Test 2: Status normalization
$inputs = [
    'contacted' => 'contactado',
    'pending' => 'pendiente',
    'CONTACTED' => 'contactado',
    'PENDING' => 'pendiente',
    'unknown' => 'pendiente',
    'contactado' => 'contactado',
    'pendiente' => 'pendiente'
];

foreach ($inputs as $inputStatus => $expectedStatus) {
    $res = normalize_callback(['status' => $inputStatus]);
    assert_equals($expectedStatus, $res['status'], "Status '$inputStatus' should normalize to '$expectedStatus'");
}

// Test 3: Truncation
$longPhone = str_repeat('1', 30);
$longPref = str_repeat('a', 250);

$res = normalize_callback([
    'telefono' => $longPhone,
    'preferencia' => $longPref
]);

assert_equals(20, test_strlen($res['telefono']), 'Phone should be truncated to 20 chars');
assert_equals(substr($longPhone, 0, 20), $res['telefono'], 'Phone content match after truncation');

assert_equals(200, test_strlen($res['preferencia']), 'Preference should be truncated to 200 chars');
assert_equals(substr($longPref, 0, 200), $res['preferencia'], 'Preference content match after truncation');

// Test 4: ID Preservation
$fixedId = 12345;
$res = normalize_callback(['id' => $fixedId]);
assert_equals($fixedId, $res['id'], 'Provided ID should be preserved');

// Test 5: Date handling
$fixedDate = '2023-01-01T12:00:00+00:00';
$res = normalize_callback(['fecha' => $fixedDate]);
assert_equals($fixedDate, $res['fecha'], 'Provided date should be preserved');

echo "All tests passed!\n";
