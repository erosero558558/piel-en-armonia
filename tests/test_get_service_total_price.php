<?php
declare(strict_types=1);

require_once __DIR__ . '/../api-lib.php';

// Mock functionality for tests
if (!function_exists('get_vat_rate')) {
    function get_vat_rate(): float {
        return 0.15; // Current default
    }
}

$tests = [
    'Standard service (consulta) with default VAT (15%)' => function() {
        // consulta base: 40. tax: 0.00. Total: 40.00
        $price = get_service_total_price('consulta');
        if ($price !== '$40.00') {
            echo "  Warning: Default VAT rate is not 0.12 as expected, it is 0.15\n";
            echo "  Expected: '\$40.00'\n";
            echo "  Actual:   '$price'\n";
            return false;
        }
        return true;
    },
    'Service with VAT (laser)' => function() {
        // laser base: 150. tax: 0.15. Total: 172.50
        $price = get_service_total_price('laser');
        return $price === '$172.50';
    },
    'Unknown service' => function() {
        $price = get_service_total_price('unknown_service');
        return $price === '$0.00';
    }
];

$failed = 0;
foreach ($tests as $name => $test) {
    if ($test()) {
        echo "PASS: $name\n";
    } else {
        echo "FAIL: $name\n";
        $failed++;
    }
}

if ($failed > 0) {
    exit(1);
}
