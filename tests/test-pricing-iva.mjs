/* eslint-disable */
import {
    computeTax,
    computeTotal,
    getServicePriceInfo,
    getCheckoutBreakdown,
    validatePaymentAmount,
    getServiceById,
    SERVICES_CONFIG,
    SPECIAL_SERVICES,
    IVA_GENERAL_RATE
} from '../js/services-config.js';

console.log('=== TEST SUITE: Frontend Pricing & IVA Logic ===');

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`✅ PASS: ${message}`);
        passed++;
    } else {
        console.error(`❌ FAIL: ${message}`);
        failed++;
    }
}

function assertEqual(actual, expected, message) {
    if (actual === expected) {
        console.log(`✅ PASS: ${message}`);
        passed++;
    } else {
        console.error(`❌ FAIL: ${message}`);
        console.error(`   Expected: ${expected}`);
        console.error(`   Actual:   ${actual}`);
        failed++;
    }
}

// 1. Test Constants
console.log('\n--- 1. Constants & Configuration ---');
assertEqual(IVA_GENERAL_RATE, 0.15, 'IVA_GENERAL_RATE should be 0.15 (15%)');

const laser = getServiceById('laser');
assert(laser !== null, 'Service "laser" should exist');
assertEqual(laser.priceBase, 150, 'Laser base price should be 150');
assertEqual(laser.taxRate, 0.15, 'Laser tax rate should be 0.15');

const consulta = getServiceById('consulta');
assert(consulta !== null, 'Service "consulta" should exist');
assertEqual(consulta.priceBase, 40, 'Consulta base price should be 40');
assertEqual(consulta.taxRate, 0.00, 'Consulta tax rate should be 0.00');

// 2. Test Computation Functions
console.log('\n--- 2. Core Computations ---');
// Tax Calculation
assertEqual(computeTax(100, 0.15), 15.00, 'Tax of 100 at 15% should be 15.00');
assertEqual(computeTax(40, 0.00), 0.00, 'Tax of 40 at 0% should be 0.00');
assertEqual(computeTax(120, 0.15), 18.00, 'Tax of 120 at 15% should be 18.00'); // 120 * 0.15 = 18

// Total Calculation
assertEqual(computeTotal(100, 0.15), 115.00, 'Total of 100 at 15% should be 115.00');
assertEqual(computeTotal(40, 0.00), 40.00, 'Total of 40 at 0% should be 40.00');
assertEqual(computeTotal(150, 0.15), 172.50, 'Total of 150 at 15% should be 172.50'); // 150 + 22.5 = 172.5

// 3. Test Service Price Info (Display)
console.log('\n--- 3. Service Price Info ---');
const laserInfo = getServicePriceInfo('laser');
assertEqual(laserInfo.total, 172.50, 'Laser info total should be 172.50');
assertEqual(laserInfo.formatted.total, '$172.50', 'Laser formatted total should be $172.50');
assertEqual(laserInfo.taxLabel, 'IVA 15%', 'Laser tax label should be IVA 15%');

const consultaInfo = getServicePriceInfo('consulta');
assertEqual(consultaInfo.total, 40.00, 'Consulta info total should be 40.00');
assertEqual(consultaInfo.formatted.total, '$40.00', 'Consulta formatted total should be $40.00');
assertEqual(consultaInfo.taxLabel, 'IVA 0%', 'Consulta tax label should be IVA 0%');

// 4. Test Checkout Breakdown (Discounts)
console.log('\n--- 4. Checkout Breakdown & Discounts ---');
// Standard breakdown
const breakdown = getCheckoutBreakdown('laser');
assertEqual(breakdown.pricing.total, 172.50, 'Breakdown total standard');

// Solidario Discount
// Discount rate: 0.375 (37.5%)
// Base: 40
// Discount: 40 * 0.375 = 15
// New Base: 25
// Tax (0%): 0
// Total: 25
const solidarioBreakdown = getCheckoutBreakdown('consulta', { isCupoSolidario: true });
const discountRate = SPECIAL_SERVICES.cupoSolidario.discountRate;
assertEqual(solidarioBreakdown.pricing.discountRate, discountRate, 'Should apply solidario rate');
assertEqual(solidarioBreakdown.pricing.discount, 15.00, 'Discount amount should be 15.00');
assertEqual(solidarioBreakdown.pricing.total, 25.00, 'Final total should be 25.00');

// 5. Validation
console.log('\n--- 5. Payment Validation ---');
assert(validatePaymentAmount('consulta', 40.00), 'Payment 40.00 for consulta should be valid');
assert(validatePaymentAmount('laser', 172.50), 'Payment 172.50 for laser should be valid');
assert(!validatePaymentAmount('laser', 150.00), 'Payment 150.00 for laser (base only) should be INVALID');

console.log('\n---------------------------------------------------');
console.log(`Tests Completed: ${passed} Passed, ${failed} Failed`);

if (failed > 0) {
    process.exit(1);
}
