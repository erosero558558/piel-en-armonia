<?php
declare(strict_types=1);

require_once __DIR__ . '/../api-lib.php';

echo "Starting tests for normalize_appointment()...\n\n";

$tests = [
    'Test Case 1: Defaults' => function() {
        $input = [];
        $output = normalize_appointment($input);

        $checks = [
            'ID should be an integer' => is_int($output['id']),
            'ID should be positive' => $output['id'] > 0,
            'Default paymentMethod should be \'unpaid\'' => $output['paymentMethod'] === 'unpaid',
            'Default casePhotoCount should be 0' => $output['casePhotoCount'] === 0,
            'Default service should be empty string' => $output['service'] === '',
            'Default status should be \'confirmed\'' => $output['status'] === 'confirmed',
        ];
        return $checks;
    },
    'Test Case 2: Payment Method Normalization' => function() {
        return [
            'Payment method \'Card\' -> \'card\'' => normalize_appointment(['paymentMethod' => 'Card'])['paymentMethod'] === 'card',
            'Payment method \'TRANSFER\' -> \'transfer\'' => normalize_appointment(['paymentMethod' => 'TRANSFER'])['paymentMethod'] === 'transfer',
            'Payment method \'cash\' -> \'cash\'' => normalize_appointment(['paymentMethod' => 'cash'])['paymentMethod'] === 'cash',
            'Payment method \'bitcoin\' -> \'unpaid\'' => normalize_appointment(['paymentMethod' => 'bitcoin'])['paymentMethod'] === 'unpaid',
            'Payment method \'\' -> \'unpaid\'' => normalize_appointment(['paymentMethod' => ''])['paymentMethod'] === 'unpaid',
        ];
    },
    'Test Case 3: Service Price Calculation' => function() {
        // 'consulta' base price is 40.00. Tax rate is 0.00. Total 40.00.
        // 'laser' base price is 150.00. Tax rate is 0.15. Total 172.50.

        $apptConsulta = normalize_appointment(['service' => 'consulta']);
        $apptLaser = normalize_appointment(['service' => 'laser']);

        return [
            'Price for \'consulta\' should be \'$40.00\'' => $apptConsulta['price'] === '$40.00',
            'Price for \'laser\' should be \'$172.50\'' => $apptLaser['price'] === '$172.50',
        ];
    }
];

$allPassed = true;

foreach ($tests as $groupName => $testFunc) {
    echo "--- $groupName ---\n";
    $results = $testFunc();
    foreach ($results as $desc => $passed) {
        if ($passed) {
            echo "✅ PASS: $desc\n";
        } else {
            echo "❌ FAIL: $desc\n";
            // For debugging failed expectations
            if (strpos($desc, 'Price for') !== false) {
                 $input = strpos($desc, 'consulta') !== false ? 'consulta' : 'laser';
                 $appt = normalize_appointment(['service' => $input]);
                 echo "  Expected: " . ($input === 'consulta' ? '$40.00' : '$172.50') . "\n";
                 echo "  Actual:   '" . $appt['price'] . "'\n";
            }
            $allPassed = false;
        }
    }
    echo "\n";
}

if (!$allPassed) {
    exit(1);
}
