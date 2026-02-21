<?php

declare(strict_types=1);

/**
 * Test script for validate_phone function in api-lib.php
 * Run with: php tests/test_validate_phone.php
 */

require_once __DIR__ . '/../api-lib.php';

$passed = 0;
$failed = 0;

function run_test(string $name, string $input, bool $expected): void
{
    global $passed, $failed;
    $result = validate_phone($input);
    if ($result === $expected) {
        echo "[PASS] {$name}: '{$input}' -> " . ($result ? 'true' : 'false') . "\n";
        $passed++;
    } else {
        echo "[FAIL] {$name}: '{$input}'\n";
        echo "       Expected: " . ($expected ? 'true' : 'false') . "\n";
        echo "       Got:      " . ($result ? 'true' : 'false') . "\n";
        $failed++;
    }
}

echo "Running validate_phone tests...\n\n";

// Happy path: Valid phone numbers
run_test("Standard 10 digits", "0987654321", true);
run_test("With spaces", "098 765 4321", true);
run_test("With dashes", "098-765-4321", true);
run_test("With parentheses", "(02) 2345678", true);
run_test("With international code (+)", "+593 98 765 4321", true);
run_test("Minimum length (7 digits)", "1234567", true);
run_test("Maximum length (15 digits)", "123456789012345", true);

// Edge cases: Mixed content that strips down to valid digits
// Ideally phone validation should probably fail on letters, but current implementation allows it by stripping non-digits.
// These tests document current behavior.
run_test("Mixed alphanumeric (valid digits)", "098765432a", true);

// Error cases: Invalid phone numbers
run_test("Too short (6 digits)", "123456", false);
run_test("Too long (16 digits)", "1234567890123456", false);
run_test("Empty string", "", false);
run_test("Only letters (no digits)", "abcdefg", false);
run_test("Only symbols (no digits)", "+-() ", false);

echo "\nSummary: {$passed} passed, {$failed} failed.\n";

if ($failed > 0) {
    exit(1);
}
exit(0);
