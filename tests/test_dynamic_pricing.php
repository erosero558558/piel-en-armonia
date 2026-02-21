<?php

require_once __DIR__ . '/../lib/business.php';

echo "Testing Dynamic Pricing Logic...\n";

// Test 1: is_weekend
$friday = '2023-10-27';
$saturday = '2023-10-28';
$sunday = '2023-10-29';
$monday = '2023-10-30';

assert(is_weekend($friday) === false, "Friday is not weekend");
assert(is_weekend($saturday) === true, "Saturday is weekend");
assert(is_weekend($sunday) === true, "Sunday is weekend");
assert(is_weekend($monday) === false, "Monday is not weekend");
echo "is_weekend passed.\n";

// Test 2: get_dynamic_price_multiplier
assert(get_dynamic_price_multiplier($friday) === 1.0, "Friday multiplier 1.0");
assert(get_dynamic_price_multiplier($saturday) === 1.10, "Saturday multiplier 1.10");
echo "get_dynamic_price_multiplier passed.\n";

// Test 3: get_service_price_amount
$service = 'consulta'; // Base 40
$base = 40.0;
assert(get_service_price_amount($service, $friday) === $base, "Price on Friday should be base");
assert(get_service_price_amount($service, $saturday) === $base * 1.10, "Price on Saturday should be +10%");
echo "get_service_price_amount passed.\n";

// Test 4: get_service_price_breakdown
$breakdown = get_service_price_breakdown($service, $saturday);
assert($breakdown['pricing']['multiplier'] === 1.10, "Breakdown has multiplier");
assert($breakdown['pricing']['is_dynamic'] === true, "Breakdown is dynamic");
assert($breakdown['pricing']['base_amount'] === $base * 1.10, "Breakdown base amount is dynamic");

$breakdownNormal = get_service_price_breakdown($service, $friday);
assert($breakdownNormal['pricing']['multiplier'] === 1.0, "Breakdown normal multiplier");
assert($breakdownNormal['pricing']['is_dynamic'] === false, "Breakdown normal not dynamic");

echo "get_service_price_breakdown passed.\n";
echo "All tests passed.\n";
