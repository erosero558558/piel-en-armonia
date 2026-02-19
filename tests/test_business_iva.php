<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/business.php';

echo "=== TESTS UNITARIOS: Sistema de Precios e IVA ===\n\n";

// Test 1: compute_tax
echo "1. Testing compute_tax():\n";
$tax1 = compute_tax(40.00, 0.00);
assert($tax1 === 0.0, "IVA 0% de 40 deberia ser 0");
echo "   ✓ IVA 0% de \$40.00 = \$" . number_format($tax1, 2) . "\n";

$tax2 = compute_tax(150.00, 0.15);
assert($tax2 === 22.50, "IVA 15% de 150 deberia ser 22.50");
echo "   ✓ IVA 15% de \$150.00 = \$" . number_format($tax2, 2) . "\n";

$tax3 = compute_tax(120.00, 0.15);
assert($tax3 === 18.00, "IVA 15% de 120 deberia ser 18.00");
echo "   ✓ IVA 15% de \$120.00 = \$" . number_format($tax3, 2) . "\n";

// Test 2: compute_total
echo "\n2. Testing compute_total():\n";
$total1 = compute_total(40.00, 0.00);
assert($total1 === 40.00, "Total con IVA 0% deberia ser 40");
echo "   ✓ Total consulta (\$40 + 0% IVA) = \$" . number_format($total1, 2) . "\n";

$total2 = compute_total(150.00, 0.15);
assert($total2 === 172.50, "Total con IVA 15% deberia ser 172.50");
echo "   ✓ Total laser (\$150 + 15% IVA) = \$" . number_format($total2, 2) . "\n";

$total3 = compute_total(120.00, 0.15);
assert($total3 === 138.00, "Total con IVA 15% deberia ser 138.00");
echo "   ✓ Total rejuvenecimiento (\$120 + 15% IVA) = \$" . number_format($total3, 2) . "\n";

// Test 3: get_service_config
echo "\n3. Testing get_service_config():\n";
$service1 = get_service_config('consulta');
assert($service1 !== null, "Servicio consulta deberia existir");
assert($service1['price_base'] === 40.00, "Precio base de consulta deberia ser 40");
assert($service1['tax_rate'] === 0.00, "Tax rate de consulta deberia ser 0");
echo "   ✓ Servicio 'consulta': \$" . $service1['price_base'] . " (IVA: " . ($service1['tax_rate'] * 100) . "%)\n";

$service2 = get_service_config('laser');
assert($service2 !== null, "Servicio laser deberia existir");
assert($service2['tax_rate'] === 0.15, "Tax rate de laser deberia ser 0.15");
assert($service2['is_from_price'] === true, "Laser deberia ser is_from_price");
echo "   ✓ Servicio 'laser': Desde \$" . $service2['price_base'] . " (IVA: " . ($service2['tax_rate'] * 100) . "%)\n";

$service3 = get_service_config('no_existe');
assert($service3 === null, "Servicio inexistente deberia retornar null");
echo "   ✓ Servicio inexistente retorna null\n";

// Test 4: get_service_price_breakdown
echo "\n4. Testing get_service_price_breakdown():\n";
$breakdown1 = get_service_price_breakdown('consulta');
assert($breakdown1['pricing']['total_amount'] === 40.00, "Total de consulta deberia ser 40");
assert($breakdown1['pricing']['tax_amount'] === 0.00, "Tax de consulta deberia ser 0");
echo "   ✓ Breakdown 'consulta': Total \$" . $breakdown1['formatted']['total'] . " (IVA: " . $breakdown1['tax_label'] . ")\n";

$breakdown2 = get_service_price_breakdown('laser');
assert($breakdown2['pricing']['total_amount'] === 172.50, "Total de laser deberia ser 172.50");
assert($breakdown2['pricing']['tax_amount'] === 22.50, "Tax de laser deberia ser 22.50");
echo "   ✓ Breakdown 'laser': Total \$" . $breakdown2['formatted']['total'] . " (Base: \$" . $breakdown2['formatted']['base'] . ", IVA: \$" . $breakdown2['formatted']['tax_amount'] . ")\n";

// Test 5: validate_payment_amount
echo "\n5. Testing validate_payment_amount():\n";
$validation1 = validate_payment_amount('consulta', 40.00);
assert($validation1['valid'] === true, "Pago correcto deberia ser valido");
echo "   ✓ Validacion pago exacto (\$40.00): VALIDO\n";

$validation2 = validate_payment_amount('consulta', 40.005, 0.01);
assert($validation2['valid'] === true, "Pago dentro de tolerancia deberia ser valido");
echo "   ✓ Validacion con tolerancia (\$40.005): VALIDO\n";

$validation3 = validate_payment_amount('consulta', 50.00);
assert($validation3['valid'] === false, "Pago incorrecto deberia ser invalido");
echo "   ✓ Validacion pago incorrecto (\$50.00): INVALIDO\n";

// Test 6: Servicios clinicos tienen IVA 0%
echo "\n6. Testing regla de negocio - Servicios clinicos IVA 0%:\n";
$clinicalServices = ['consulta', 'telefono', 'video', 'acne', 'cancer'];
foreach ($clinicalServices as $serviceId) {
    $config = get_service_config($serviceId);
    assert($config['tax_rate'] === 0.00, "Servicio $serviceId deberia tener IVA 0%");
    echo "   ✓ '$serviceId': IVA 0%\n";
}

// Test 7: Servicios esteticos tienen IVA 15%
echo "\n7. Testing regla de negocio - Servicios esteticos IVA 15%:\n";
$estheticServices = ['laser', 'rejuvenecimiento'];
foreach ($estheticServices as $serviceId) {
    $config = get_service_config($serviceId);
    assert($config['tax_rate'] === 0.15, "Servicio $serviceId deberia tener IVA 15%");
    echo "   ✓ '$serviceId': IVA 15%\n";
}

// Test 8: Consistencia entre frontend y backend
echo "\n8. Testing consistencia de precios:\n";
$expectedPrices = [
    'consulta' => 40.00,
    'telefono' => 25.00,
    'video' => 30.00,
    'laser' => 150.00,
    'rejuvenecimiento' => 120.00,
    'acne' => 80.00,
    'cancer' => 70.00
];
foreach ($expectedPrices as $serviceId => $expectedPrice) {
    $actualPrice = get_service_price_amount($serviceId);
    assert($actualPrice === $expectedPrice, "Precio de $serviceId deberia ser $expectedPrice");
    echo "   ✓ '$serviceId': \$$actualPrice (esperado: \$$expectedPrice)\n";
}

echo "\n=== TODOS LOS TESTS PASARON ✓ ===\n";
echo "Total tests ejecutados: 8 grupos\n";
echo "Sistema de IVA funcionando correctamente.\n";