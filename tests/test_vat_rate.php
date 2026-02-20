<?php
// tests/test_vat_rate.php
require_once __DIR__ . '/../lib/business.php';

// Mock getenv by overriding values if needed, or rely on business.php defaults.
// The default defined in business.php is 0.15

$tests = [
    'Default (unset)' => [null, 0.15],
    'Default (empty string)' => ['', 0.15],
    'Decimal (0.15)' => ['0.15', 0.15],
    'Percentage (15)' => ['15', 0.15],
    'Percentage (12)' => ['12', 0.12],
    'Percentage (100)' => ['100', 1.0],
    'Zero' => ['0', 0.0],
    'One' => ['1', 1.0],
    'Negative (-0.5)' => ['-0.5', 0.0],
    'Negative Percentage (-5)' => ['-5', 0.0],
    'Over 100 (150)' => ['150', 0.015], // 150/100 -> 1.5 -> truncated to 1.0 logic? No, logic is: if > 1 and <= 100 divide by 100. 150 > 100, so it goes to "if > 1 return 1.0". Wait.
    // Logic:
    // rate = float(raw)
    // if rate > 1.0 && rate <= 100.0: rate = rate / 100.0
    // if rate < 0.0: return 0.0
    // if rate > 1.0: return 1.0

    // So 150: > 1.0? Yes. <= 100.0? No. So it stays 150.
    // Then > 1.0? Yes. Return 1.0.
    'Over 100 (150)' => ['150', 1.0],

    'Over 1.0 but <= 100 (50)' => ['50', 0.50],
    'Non-numeric (abc)' => ['abc', 0.0],
];

echo "Running get_vat_rate() tests...\n";
$passed = 0;
$failed = 0;

foreach ($tests as $name => $data) {
    list($envVal, $expected) = $data;

    // Simulate env var
    if ($envVal === null) {
        putenv('PIELARMONIA_VAT_RATE');
    } else {
        putenv("PIELARMONIA_VAT_RATE=$envVal");
    }

    $actual = get_vat_rate();

    if (abs($actual - $expected) < 0.0001) {
        echo "✅ $name: Passed\n";
        $passed++;
    } else {
        echo "❌ $name: Failed. Expected $expected, got $actual\n";
        $failed++;
    }
}

echo "\nResults: $passed passed, $failed failed.\n";
if ($failed > 0) exit(1);
