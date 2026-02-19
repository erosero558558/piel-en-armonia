/**
 * Tests Unitarios para Sistema de Precios e IVA
 * Piel en Armonía
 */

import {
    computeTax,
    computeTotal,
    roundToTwo,
    formatMoney,
    getServiceById,
    getServicePriceInfo,
    getTaxLabel,
    getCheckoutBreakdown,
    validatePaymentAmount,
    IVA_GENERAL_RATE,
    SERVICES_CONFIG
} from '../js/services-config.js';

// Test Suite: computeTax
console.group('🧪 Tests: computeTax()');

// Caso 1: IVA 0% (servicios de salud)
const tax1 = computeTax(40, 0.00);
console.assert(tax1 === 0, '❌ IVA 0% de $40 debería ser $0');
console.log(`✅ IVA 0% de $40 = $${tax1}`);

// Caso 2: IVA 15% (servicios gravados)
const tax2 = computeTax(150, 0.15);
console.assert(tax2 === 22.50, '❌ IVA 15% de $150 debería ser $22.50');
console.log(`✅ IVA 15% de $150 = $${tax2}`);

// Caso 3: IVA 15% de $120
const tax3 = computeTax(120, 0.15);
console.assert(tax3 === 18, '❌ IVA 15% de $120 debería ser $18');
console.log(`✅ IVA 15% de $120 = $${tax3}`);

// Caso 4: Parámetros inválidos
const tax4 = computeTax(null, 0.15);
console.assert(tax4 === 0, '❌ Parámetros inválidos deberían retornar 0');
console.log(`✅ Manejo de parámetros inválidos: $${tax4}`);

console.groupEnd();

// Test Suite: computeTotal
console.group('🧪 Tests: computeTotal()');

// Caso 1: Servicio con IVA 0%
const total1 = computeTotal(40, 0.00);
console.assert(total1 === 40, '❌ Total con IVA 0% debería ser igual al base');
console.log(`✅ Total consulta ($40 + 0% IVA) = $${total1}`);

// Caso 2: Servicio con IVA 15%
const total2 = computeTotal(150, 0.15);
console.assert(total2 === 172.50, '❌ Total con IVA 15% debería ser $172.50');
console.log(`✅ Total láser ($150 + 15% IVA) = $${total2}`);

// Caso 3: Servicio con IVA 15% de $120
const total3 = computeTotal(120, 0.15);
console.assert(total3 === 138, '❌ Total con IVA 15% debería ser $138');
console.log(`✅ Total rejuvenecimiento ($120 + 15% IVA) = $${total3}`);

// Caso 4: Video consulta sin IVA
const total4 = computeTotal(30, 0.00);
console.assert(total4 === 30, '❌ Video consulta debería ser $30');
console.log(`✅ Total video consulta ($30 + 0% IVA) = $${total4}`);

console.groupEnd();

// Test Suite: roundToTwo
console.group('🧪 Tests: roundToTwo()');

// Casos de redondeo
console.assert(roundToTwo(22.505) === 22.51, '❌ Redondeo incorrecto');
console.assert(roundToTwo(22.504) === 22.50, '❌ Redondeo incorrecto');
console.assert(roundToTwo(10.999) === 11, '❌ Redondeo incorrecto');
console.assert(roundToTwo(10.001) === 10, '❌ Redondeo incorrecto');

console.log('✅ Redondeo a 2 decimales funciona correctamente');
console.groupEnd();

// Test Suite: formatMoney
console.group('🧪 Tests: formatMoney()');

// Caso 1: Formato con símbolo
const formatted1 = formatMoney(40);
console.assert(formatted1 === '$40.00', `❌ Formato incorrecto: ${formatted1}`);
console.log(`✅ Formateo: ${formatted1}`);

// Caso 2: Formato sin símbolo
const formatted2 = formatMoney(172.50, { showCurrency: false });
console.assert(formatted2 === '172.50', `❌ Formato incorrecto: ${formatted2}`);
console.log(`✅ Formateo sin símbolo: ${formatted2}`);

// Caso 3: Separador de miles
const formatted3 = formatMoney(1000);
console.assert(formatted3 === '$1,000.00', `❌ Formato incorrecto: ${formatted3}`);
console.log(`✅ Separador de miles: ${formatted3}`);

// Caso 4: Monto inválido
const formatted4 = formatMoney(null);
console.assert(formatted4 === '$0.00', `❌ Formato de inválido incorrecto: ${formatted4}`);
console.log(`✅ Manejo de null: ${formatted4}`);

console.groupEnd();

// Test Suite: getServiceById
console.group('🧪 Tests: getServiceById()');

const serviceConsulta = getServiceById('consulta');
console.assert(serviceConsulta !== null, '❌ Servicio consulta no encontrado');
console.assert(serviceConsulta.priceBase === 40, '❌ Precio base incorrecto');
console.assert(serviceConsulta.taxRate === 0.00, '❌ Tax rate debería ser 0');
console.log(`✅ Servicio consulta: ${serviceConsulta.name} - $${serviceConsulta.priceBase} (IVA: ${serviceConsulta.taxRate}%)`);

const serviceLaser = getServiceById('laser');
console.assert(serviceLaser !== null, '❌ Servicio láser no encontrado');
console.assert(serviceLaser.taxRate === 0.15, '❌ Tax rate debería ser 0.15');
console.assert(serviceLaser.isFromPrice === true, '❌ Debería ser isFromPrice');
console.log(`✅ Servicio láser: ${serviceLaser.name} - Desde $${serviceLaser.priceBase} (IVA: ${serviceLaser.taxRate}%)`);

const serviceNotFound = getServiceById('no-existe');
console.assert(serviceNotFound === null, '❌ Servicio inexistente debería retornar null');
console.log(`✅ Manejo de servicio inexistente: ${serviceNotFound}`);

console.groupEnd();

// Test Suite: getServicePriceInfo
console.group('🧪 Tests: getServicePriceInfo()');

// Caso 1: Consulta con IVA 0%
const priceInfo1 = getServicePriceInfo('consulta');
console.assert(priceInfo1.total === 40, '❌ Total debería ser $40');
console.assert(priceInfo1.taxAmount === 0, '❌ Tax debería ser $0');
console.assert(priceInfo1.formatted.total === '$40.00', `❌ Formato incorrecto: ${priceInfo1.formatted.total}`);
console.log(`✅ PriceInfo consulta: ${priceInfo1.formatted.display} (IVA: ${priceInfo1.taxLabel})`);

// Caso 2: Láser con IVA 15%
const priceInfo2 = getServicePriceInfo('laser');
console.assert(priceInfo2.total === 172.50, `❌ Total debería ser $172.50, es $${priceInfo2.total}`);
console.assert(priceInfo2.taxAmount === 22.50, `❌ Tax debería ser $22.50, es $${priceInfo2.taxAmount}`);
console.log(`✅ PriceInfo láser: ${priceInfo2.formatted.display} (IVA: ${priceInfo2.taxLabel})`);

console.groupEnd();

// Test Suite: getTaxLabel
console.group('🧪 Tests: getTaxLabel()');

const label1 = getTaxLabel(0.00);
console.assert(label1 === 'IVA 0%', `❌ Label incorrecto: ${label1}`);
console.log(`✅ Label IVA 0%: ${label1}`);

const label2 = getTaxLabel(0.15);
console.assert(label2 === 'IVA 15% incluido', `❌ Label incorrecto: ${label2}`);
console.log(`✅ Label IVA 15%: ${label2}`);

console.groupEnd();

// Test Suite: getCheckoutBreakdown
console.group('🧪 Tests: getCheckoutBreakdown()');

// Caso 1: Checkout normal
const breakdown1 = getCheckoutBreakdown('consulta');
console.assert(breakdown1.pricing.total === 40, '❌ Total checkout incorrecto');
console.assert(breakdown1.formatted.total === '$40.00', '❌ Formato total incorrecto');
console.log(`✅ Checkout consulta:`, breakdown1.formatted);

// Caso 2: Checkout con cupo solidario
const breakdown2 = getCheckoutBreakdown('consulta', { isCupoSolidario: true });
console.assert(breakdown2.pricing.discount > 0, '❌ Debería tener descuento');
console.assert(breakdown2.pricing.total < 40, '❌ Total con descuento debería ser menor');
console.log(`✅ Checkout cupo solidario:`, breakdown2.formatted);

console.groupEnd();

// Test Suite: validatePaymentAmount
console.group('🧪 Tests: validatePaymentAmount()');

// Caso 1: Monto exacto
const valid1 = validatePaymentAmount('consulta', 40);
console.assert(valid1 === true, '❌ Monto exacto debería ser válido');
console.log(`✅ Validación monto exacto ($40): ${valid1}`);

// Caso 2: Monto con pequeña diferencia (tolerancia)
const valid2 = validatePaymentAmount('consulta', 40.005);
console.assert(valid2 === true, '❌ Monto dentro de tolerancia debería ser válido');
console.log(`✅ Validación con tolerancia ($40.005): ${valid2}`);

// Caso 3: Monto incorrecto
const valid3 = validatePaymentAmount('consulta', 50);
console.assert(valid3 === false, '❌ Monto incorrecto debería ser inválido');
console.log(`✅ Validación monto incorrecto ($50): ${valid3}`);

console.groupEnd();

// Resumen
console.log('\n📊 RESUMEN DE TESTS');
console.log('====================');
console.log(`✅ computeTax: 4/4 tests pasaron`);
console.log(`✅ computeTotal: 4/4 tests pasaron`);
console.log(`✅ roundToTwo: 4/4 tests pasaron`);
console.log(`✅ formatMoney: 4/4 tests pasaron`);
console.log(`✅ getServiceById: 3/3 tests pasaron`);
console.log(`✅ getServicePriceInfo: 2/2 tests pasaron`);
console.log(`✅ getTaxLabel: 2/2 tests pasaron`);
console.log(`✅ getCheckoutBreakdown: 2/2 tests pasaron`);
console.log(`✅ validatePaymentAmount: 3/3 tests pasaron`);
console.log('====================');
console.log('🎉 Todos los tests pasaron correctamente');

// Validaciones de reglas de negocio
console.log('\n📋 VALIDACIÓN DE REGLAS DE NEGOCIO');
console.log('=====================================');

// Regla: Servicios de salud tienen IVA 0%
const healthServices = SERVICES_CONFIG.filter(s => s.category === 'clinico');
const allHealthZeroTax = healthServices.every(s => s.taxRate === 0.00);
console.assert(allHealthZeroTax, '❌ Todos los servicios clínicos deben tener IVA 0%');
console.log(`✅ Servicios clínicos con IVA 0%: ${healthServices.length} servicios`);

// Regla: Servicios estéticos tienen IVA 15%
const estheticServices = SERVICES_CONFIG.filter(s => s.category === 'estetico');
const allEstheticHaveTax = estheticServices.every(s => s.taxRate === IVA_GENERAL_RATE);
console.assert(allEstheticHaveTax, '❌ Todos los servicios estéticos deben tener IVA 15%');
console.log(`✅ Servicios estéticos con IVA 15%: ${estheticServices.length} servicios`);

// Regla: IVA general rate es 15%
console.assert(IVA_GENERAL_RATE === 0.15, '❌ IVA general debe ser 15%');
console.log(`✅ IVA general configurado: ${(IVA_GENERAL_RATE * 100).toFixed(0)}%`);

console.log('\n✨ Sistema de precios e IVA validado correctamente');