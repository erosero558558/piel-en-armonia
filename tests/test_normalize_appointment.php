<?php
// tests/test_normalize_appointment.php

// 1. Include the library to be tested
require_once __DIR__ . '/../api-lib.php';

// 2. Set environment variables for consistent test execution
putenv('PIELARMONIA_VAT_RATE=0.15');

// 3. Define a simple assertion helper
function assert_eq($actual, $expected, $message) {
    if ($actual === $expected) {
        echo "✅ PASS: $message\n";
    } else {
        echo "❌ FAIL: $message\n";
        echo "  Expected: " . var_export($expected, true) . "\n";
        echo "  Actual:   " . var_export($actual, true) . "\n";
        exit(1);
    }
}

function assert_true($condition, $message) {
    if ($condition) {
        echo "✅ PASS: $message\n";
    } else {
        echo "❌ FAIL: $message\n";
        exit(1);
    }
}

echo "Starting tests for normalize_appointment()...\n\n";

// --- Test Case 1: Defaults ---
echo "--- Test Case 1: Defaults ---\n";
$input = [];
$output = normalize_appointment($input);

assert_true(is_int($output['id']), "ID should be an integer");
assert_true($output['id'] > 0, "ID should be positive");
assert_eq($output['paymentMethod'], 'unpaid', "Default paymentMethod should be 'unpaid'");
assert_eq($output['casePhotoCount'], 0, "Default casePhotoCount should be 0");
assert_eq($output['service'], '', "Default service should be empty string");
assert_eq($output['status'], 'confirmed', "Default status should be 'confirmed'");

// --- Test Case 2: Payment Method Normalization ---
echo "\n--- Test Case 2: Payment Method Normalization ---\n";
$cases = [
    ['input' => 'Card', 'expected' => 'card'],
    ['input' => 'TRANSFER', 'expected' => 'transfer'],
    ['input' => 'cash', 'expected' => 'cash'],
    ['input' => 'bitcoin', 'expected' => 'unpaid'], // Invalid -> unpaid
    ['input' => '', 'expected' => 'unpaid'], // Empty -> unpaid
];

foreach ($cases as $case) {
    $out = normalize_appointment(['paymentMethod' => $case['input']]);
    assert_eq($out['paymentMethod'], $case['expected'], "Payment method '{$case['input']}' -> '{$case['expected']}'");
}

// --- Test Case 3: Service Price Calculation ---
echo "\n--- Test Case 3: Service Price Calculation ---\n";
// 'consulta' price is 40.00. VAT is 0.00 (Medical service). Total = 40.00.
// get_service_total_price formats as '$40.00'
$out = normalize_appointment(['service' => 'consulta']);
assert_eq($out['price'], '$40.00', "Price for 'consulta' should be '$40.00'");

// 'laser' price is 150.00. VAT is 0.15 (Default). Total = 172.50.
$out = normalize_appointment(['service' => 'laser']);
assert_eq($out['price'], '$172.50', "Price for 'laser' should be '$172.50'");

// --- Test Case 4: Truncation Limits ---
echo "\n--- Test Case 4: Truncation Limits ---\n";
$longName = str_repeat('a', 200);
$out = normalize_appointment(['name' => $longName]);
assert_eq(strlen($out['name']), 150, "Name should be truncated to 150 chars");
assert_eq($out['name'], substr($longName, 0, 150), "Name content should match prefix");

$longReason = str_repeat('b', 1005);
$out = normalize_appointment(['reason' => $longReason]);
assert_eq(strlen($out['reason']), 1000, "Reason should be truncated to 1000 chars");

// --- Test Case 5: Photo Limits ---
echo "\n--- Test Case 5: Photo Limits ---\n";
$photos = [
    'http://example.com/1.jpg',
    'http://example.com/2.jpg',
    'http://example.com/3.jpg',
    'http://example.com/4.jpg', // Should be dropped
    'http://example.com/5.jpg'  // Should be dropped
];
$out = normalize_appointment(['casePhotoUrls' => $photos]);

assert_eq(count($out['casePhotoUrls']), 3, "Should limit to 3 photos");
assert_eq($out['casePhotoUrls'][0], 'http://example.com/1.jpg', "Photo 1 should match");
assert_eq($out['casePhotoUrls'][2], 'http://example.com/3.jpg', "Photo 3 should match");
assert_eq($out['casePhotoCount'], 3, "casePhotoCount should be 3");

// Test explicit count override logic
$out = normalize_appointment(['casePhotoUrls' => $photos, 'casePhotoCount' => 5]);
assert_eq($out['casePhotoCount'], 3, "casePhotoCount should be clamped to 3 even if provided as 5");

// --- Test Case 6: Status Mapping ---
echo "\n--- Test Case 6: Status Mapping ---\n";
$cases = [
    ['input' => 'Confirmed', 'expected' => 'confirmed'],
    ['input' => 'PENDING', 'expected' => 'pending'],
    ['input' => 'Cancelled', 'expected' => 'cancelled'],
    ['input' => 'Completed', 'expected' => 'completed'],
    ['input' => 'invalid_status', 'expected' => 'confirmed'], // Default
];

foreach ($cases as $case) {
    $out = normalize_appointment(['status' => $case['input']]);
    assert_eq($out['status'], $case['expected'], "Status '{$case['input']}' -> '{$case['expected']}'");
}

echo "\n🎉 All tests passed!\n";
