<?php

require_once __DIR__ . '/../api-lib.php';

function run_tests()
{
    $tests = [
        // Valid inputs
        ['input' => 'confirmed', 'expected' => 'confirmed'],
        ['input' => 'pending', 'expected' => 'pending'],
        ['input' => 'cancelled', 'expected' => 'cancelled'],
        ['input' => 'completed', 'expected' => 'completed'],
        ['input' => 'no_show', 'expected' => 'no_show'],

        // Case insensitivity
        ['input' => 'Confirmed', 'expected' => 'confirmed'],
        ['input' => 'PENDING', 'expected' => 'pending'],
        ['input' => 'CaNcElLeD', 'expected' => 'cancelled'],

        // Whitespace trimming
        ['input' => ' confirmed ', 'expected' => 'confirmed'],
        ['input' => '  pending', 'expected' => 'pending'],

        // Invalid inputs (default to confirmed)
        ['input' => 'invalid', 'expected' => 'confirmed'],
        ['input' => 'trash', 'expected' => 'confirmed'],
        ['input' => '', 'expected' => 'confirmed'],
        ['input' => 'unknown', 'expected' => 'confirmed'],
        ['input' => 'pendingg', 'expected' => 'confirmed'],
    ];

    $failed = 0;
    $total = count($tests);

    echo "Running $total tests for map_appointment_status()...\n";

    foreach ($tests as $index => $test) {
        $result = map_appointment_status($test['input']);
        if ($result !== $test['expected']) {
            echo "FAILED: Test #$index\n";
            echo "  Input: '{$test['input']}'\n";
            echo "  Expected: '{$test['expected']}'\n";
            echo "  Got: '$result'\n";
            $failed++;
        }
    }

    if ($failed > 0) {
        echo "\n$failed tests failed!\n";
        exit(1);
    } else {
        echo "\nAll $total tests passed!\n";
        exit(0);
    }
}

run_tests();
