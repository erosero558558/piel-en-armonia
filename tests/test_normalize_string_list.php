<?php
require_once __DIR__ . '/../api-lib.php';

function assert_equals($expected, $actual, $message = '') {
    if ($expected !== $actual) {
        echo "FAIL: $message\n";
        echo "Expected: " . print_r($expected, true) . "\n";
        echo "Actual: " . print_r($actual, true) . "\n";
        exit(1);
    } else {
        echo "PASS: $message\n";
    }
}

// Test cases
echo "Testing normalize_string_list...\n";

// 1. Non-array input
assert_equals([], normalize_string_list(null), "Null input returns empty array");
assert_equals([], normalize_string_list("string"), "String input returns empty array");
assert_equals([], normalize_string_list(123), "Int input returns empty array");

// 2. Simple valid array
assert_equals(['a', 'b'], normalize_string_list(['a', 'b']), "Simple valid array");

// 3. Max items
assert_equals(['a', 'b'], normalize_string_list(['a', 'b', 'c'], 2), "Max items limit");

// 4. Max length
assert_equals(['ab'], normalize_string_list(['abc'], 5, 2), "Max length truncation");

// 5. Non-scalar items
assert_equals(['a'], normalize_string_list(['a', ['b'], new stdClass()]), "Non-scalar items skipped");

// 6. Trimming
assert_equals(['a', 'b'], normalize_string_list([' a ', 'b ']), "Trimming whitespace");

// 7. Empty strings after trim
assert_equals(['a'], normalize_string_list(['a', '   ', '']), "Empty strings skipped");

// 8. Mixed types that are scalar
assert_equals(['1', '1.5'], normalize_string_list([1, 1.5]), "Scalar types converted to string");

echo "All tests passed!\n";
