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

/* eslint-env node */

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function log(message) {
    if (typeof console !== 'undefined') {
        console.log(message);
    }
}

// Test Suite: computeTax
log('🧪 Tests: computeTax()');

// Caso 1: IVA 0% (servicios de salud)
const tax1 = computeTax(40, 0.00);
assert(tax1 === 0, '❌ IVA 0% de $40 debería ser $0');
log(`✅ IVA 0% de $40 = $${tax1}`);

// Caso 2: IVA 15% (servicios gravados)
const tax2 = computeTax(150, 0.15);
assert(tax2 === 22.50, '❌ IVA 15% de $150 debería ser $22.50');
log(`✅ IVA 15% de $150 = $${tax2}`);

// Caso 3: IVA 15% de $120
const tax3 = computeTax(120, 0.15);
assert(tax3 === 18, '❌ IVA 15% de $120 debería ser $18');
log(`✅ IVA 15% de $120 = $${tax3}`);

// Caso 4: Parámetros inválidos
const tax4 = computeTax(null, 0.15);
assert(tax4 === 0, '❌ Parámetros inválidos deberían retornar 0');
log(`✅ Manejo de parámetros inválidos: $${tax4}`);


// Test Suite: computeTotal
log('🧪 Tests: computeTotal()');

// Caso 1: Servicio con IVA 0%
const total1 = computeTotal(40, 0.00);
assert(total1 === 40, '❌ Total con IVA 0% debería ser igual al base');
log(`✅ Total consulta ($40 + 0% IVA) = $${total1}`);

// Caso 2: Servicio con IVA 15%
const total2 = computeTotal(150, 0.15);
assert(total2 === 172.50, '❌ Total con IVA 15% debería ser $172.50');
log(`✅ Total láser ($150 + 15% IVA) = $${total2}`);

// Caso 3: Servicio con IVA 15% de $120
const total3 = computeTotal(120, 0.15);
assert(total3 === 138, '❌ Total con IVA 15% debería ser $138');
log(`✅ Total rejuvenecimiento ($120 + 15% IVA) = $${total3}`);

// Caso 4: Video consulta sin IVA
const total4 = computeTotal(30, 0.00);
assert(total4 === 30, '❌ Video consulta debería ser $30');
log(`✅ Total video consulta ($30 + 0% IVA) = $${total4}`);


// Test Suite: roundToTwo
log('🧪 Tests: roundToTwo()');

// Casos de redondeo
assert(roundToTwo(22.505) === 22.51, '❌ Redondeo incorrecto');
assert(roundToTwo(22.504) === 22.50, '❌ Redondeo incorrecto');
assert(roundToTwo(10.999) === 11, '❌ Redondeo incorrecto');
assert(roundToTwo(10.001) === 10, '❌ Redondeo incorrecto');

log('✅ Redondeo a 2 decimales funciona correctamente');


// Test Suite: formatMoney
log('🧪 Tests: formatMoney()');

// Caso 1: Formato con símbolo
const formatted1 = formatMoney(40);
assert(formatted1 === '$40.00', `❌ Formato incorrecto: ${formatted1}`);
log(`✅ Formateo: ${formatted1}`);

// Caso 2: Formato sin símbolo
const formatted2 = formatMoney(172.50, { showCurrency: false });
assert(formatted2 === '172.50', `❌ Formato incorrecto: ${formatted2}`);
log(`✅ Formateo sin símbolo: ${formatted2}`);

// Caso 3: Separador de miles
const formatted3 = formatMoney(1000);
assert(formatted3 === '$1,000.00', `❌ Formato incorrecto: ${formatted3}`);
log(`✅ Separador de miles: ${formatted3}`);

// Caso 4: Monto inválido
const formatted4 = formatMoney(null);
assert(formatted4 === '$0.00', `❌ Formato de inválido incorrecto: ${formatted4}`);
log(`✅ Manejo de null: ${formatted4}`);


// Test Suite: getServiceById
log('🧪 Tests: getServiceById()');

const serviceConsulta = getServiceById('consulta');
assert(serviceConsulta !== null, '❌ Servicio consulta no encontrado');
assert(serviceConsulta.priceBase === 40, '❌ Precio base incorrecto');
assert(serviceConsulta.taxRate === 0.00, '❌ Tax rate debería ser 0');
log(`✅ Servicio consulta: ${serviceConsulta.name} - $${serviceConsulta.priceBase} (IVA: ${serviceConsulta.taxRate}%)`);

const serviceLaser = getServiceById('laser');
assert(serviceLaser !== null, '❌ Servicio láser no encontrado');
assert(serviceLaser.taxRate === 0.15, '❌ Tax rate debería ser 0.15');
assert(serviceLaser.isFromPrice === true, '❌ Debería ser isFromPrice');
log(`✅ Servicio láser: ${serviceLaser.name} - Desde $${serviceLaser.priceBase} (IVA: ${serviceLaser.taxRate}%)`);

const serviceNotFound = getServiceById('no-existe');
assert(serviceNotFound === null, '❌ Servicio inexistente debería retornar null');
log(`✅ Manejo de servicio inexistente: ${serviceNotFound}`);


// Test Suite: getServicePriceInfo
log('🧪 Tests: getServicePriceInfo()');

// Caso 1: Consulta con IVA 0%
const priceInfo1 = getServicePriceInfo('consulta');
assert(priceInfo1.total === 40, '❌ Total debería ser $40');
assert(priceInfo1.taxAmount === 0, '❌ Tax debería ser $0');
assert(priceInfo1.formatted.total === '$40.00', `❌ Formato incorrecto: ${priceInfo1.formatted.total}`);
log(`✅ PriceInfo consulta: ${priceInfo1.formatted.display} (IVA: ${priceInfo1.taxLabel})`);

// Caso 2: Láser con IVA 15%
const priceInfo2 = getServicePriceInfo('laser');
assert(priceInfo2.total === 172.50, `❌ Total debería ser $172.50, es $${priceInfo2.total}`);
assert(priceInfo2.taxAmount === 22.50, `❌ Tax debería ser $22.50, es $${priceInfo2.taxAmount}`);
log(`✅ PriceInfo láser: ${priceInfo2.formatted.display} (IVA: ${priceInfo2.taxLabel})`);


// Test Suite: getTaxLabel
log('🧪 Tests: getTaxLabel()');

const label1 = getTaxLabel(0.00);
assert(label1 === 'IVA 0%', `❌ Label incorrecto: ${label1}`);
log(`✅ Label IVA 0%: ${label1}`);

const label2 = getTaxLabel(0.15);
assert(label2 === 'IVA 15% incluido', `❌ Label incorrecto: ${label2}`);
log(`✅ Label IVA 15%: ${label2}`);


// Test Suite: getCheckoutBreakdown
log('🧪 Tests: getCheckoutBreakdown()');

// Caso 1: Checkout normal
const breakdown1 = getCheckoutBreakdown('consulta');
assert(breakdown1.pricing.total === 40, '❌ Total checkout incorrecto');
assert(breakdown1.formatted.total === '$40.00', '❌ Formato total incorrecto');
log(`✅ Checkout consulta:`, breakdown1.formatted);

// Caso 2: Checkout con cupo solidario
const breakdown2 = getCheckoutBreakdown('consulta', { isCupoSolidario: true });
assert(breakdown2.pricing.discount > 0, '❌ Debería tener descuento');
assert(breakdown2.pricing.total < 40, '❌ Total con descuento debería ser menor');
log(`✅ Checkout cupo solidario:`, breakdown2.formatted);


// Test Suite: validatePaymentAmount
log('🧪 Tests: validatePaymentAmount()');

// Caso 1: Monto exacto
const valid1 = validatePaymentAmount('consulta', 40);
assert(valid1 === true, '❌ Monto exacto debería ser válido');
log(`✅ Validación monto exacto ($40): ${valid1}`);

// Caso 2: Monto con pequeña diferencia (tolerancia)
const valid2 = validatePaymentAmount('consulta', 40.005);
assert(valid2 === true, '❌ Monto dentro de tolerancia debería ser válido');
log(`✅ Validación con tolerancia ($40.005): ${valid2}`);

// Caso 3: Monto incorrecto
const valid3 = validatePaymentAmount('consulta', 50);
assert(valid3 === false, '❌ Monto incorrecto debería ser inválido');
log(`✅ Validación monto incorrecto ($50): ${valid3}`);


// Resumen
log('\n📊 RESUMEN DE TESTS');
log('====================');
log(`✅ computeTax: 4/4 tests pasaron`);
log(`✅ computeTotal: 4/4 tests pasaron`);
log(`✅ roundToTwo: 4/4 tests pasaron`);
log(`✅ formatMoney: 4/4 tests pasaron`);
log(`✅ getServiceById: 3/3 tests pasaron`);
log(`✅ getServicePriceInfo: 2/2 tests pasaron`);
log(`✅ getTaxLabel: 2/2 tests pasaron`);
log(`✅ getCheckoutBreakdown: 2/2 tests pasaron`);
log(`✅ validatePaymentAmount: 3/3 tests pasaron`);
log('====================');
log('🎉 Todos los tests pasaron correctamente');

// Validaciones de reglas de negocio
log('\n📋 VALIDACIÓN DE REGLAS DE NEGOCIO');
log('=====================================');

// Regla: Servicios de salud tienen IVA 0%
const healthServices = SERVICES_CONFIG.filter(s => s.category === 'clinico');
const allHealthZeroTax = healthServices.every(s => s.taxRate === 0.00);
assert(allHealthZeroTax, '❌ Todos los servicios clínicos deben tener IVA 0%');
log(`✅ Servicios clínicos con IVA 0%: ${healthServices.length} servicios`);

// Regla: Servicios estéticos tienen IVA 15%
const estheticServices = SERVICES_CONFIG.filter(s => s.category === 'estetico');
const allEstheticHaveTax = estheticServices.every(s => s.taxRate === IVA_GENERAL_RATE);
assert(allEstheticHaveTax, '❌ Todos los servicios estéticos deben tener IVA 15%');
log(`✅ Servicios estéticos con IVA 15%: ${estheticServices.length} servicios`);

// Regla: IVA general rate es 15%
assert(IVA_GENERAL_RATE === 0.15, '❌ IVA general debe ser 15%');
log(`✅ IVA general configurado: ${(IVA_GENERAL_RATE * 100).toFixed(0)}%`);

log('\n✨ Sistema de precios e IVA validado correctamente');
