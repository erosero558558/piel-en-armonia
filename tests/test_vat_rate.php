<?php
declare(strict_types=1);

require_once __DIR__ . '/../api-lib.php';

function run_tests() {
    $tests = [
        'Default (unset)' => [null, 0.12],
        'Default (empty string)' => ['', 0.12],
        'Decimal (0.15)' => ['0.15', 0.15],
        'Percentage (15)' => ['15', 0.15],
        'Percentage (12)' => ['12', 0.12],
        'Percentage (100)' => ['100', 1.0],
        'Zero' => ['0', 0.0],
        'One' => ['1', 1.0],
        'Negative (-0.5)' => ['-0.5', 0.0],
        'Negative Percentage (-5)' => ['-5', 0.0],
        'Over 100 (150)' => ['150', 1.0],
        'Over 1.0 but <= 100 (50)' => ['50', 0.5],
        'Non-numeric (abc)' => ['abc', 0.0],
    ];

    $failed = 0;
    $passed = 0;

    echo "Running get_vat_rate() tests...\n";

    foreach ($tests as $name => $case) {
        $envValue = $case[0];
        $expected = $case[1];

        // Setup environment
        if ($envValue === null) {
            putenv('PIELARMONIA_VAT_RATE'); // Unset
        } else {
            putenv("PIELARMONIA_VAT_RATE=$envValue");
        }

        // Run function
        $actual = get_vat_rate();

        // Check result
        // Use epsilon for float comparison
        if (abs($actual - $expected) < 0.000001) {
            echo "✅ $name: Passed\n";
            $passed++;
        } else {
            echo "❌ $name: Failed. Expected $expected, got $actual\n";
            $failed++;
        }
    }

    echo "\nResults: $passed passed, $failed failed.\n";

    if ($failed > 0) {
        exit(1);
    }

    exit(0);
}

run_tests();
