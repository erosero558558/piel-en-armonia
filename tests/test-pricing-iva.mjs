/* eslint-disable no-undef */
// tests/test-pricing-iva.mjs

import { getServicePriceInfo, SERVICES_CONFIG } from '../js/services-config.js';

// Mock console.warn to suppress expected warnings during tests (e.g. invalid inputs)
const originalWarn = console.warn;
console.warn = () => {};

let failed = 0;
let passed = 0;

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

console.log('--- Testing Pricing & IVA Configuration ---');

// Test 1: Configuration Integrity
const consulta = SERVICES_CONFIG.find(s => s.id === 'consulta');
const laser = SERVICES_CONFIG.find(s => s.id === 'laser');

assert(consulta.taxRate === 0.00, 'Consulta taxRate should be 0.00');
assert(laser.taxRate === 0.15, 'Laser taxRate should be 0.15');

// Test 2: Price Calculation (Consulta - 0% VAT)
const priceConsulta = getServicePriceInfo('consulta');
assertEqual(priceConsulta.priceBase, 40, 'Consulta base price');
assertEqual(priceConsulta.taxAmount, 0, 'Consulta tax amount');
assertEqual(priceConsulta.total, 40, 'Consulta total price');
assertEqual(priceConsulta.taxLabel, 'IVA 0%', 'Consulta tax label');

// Test 3: Price Calculation (Laser - 15% VAT)
const priceLaser = getServicePriceInfo('laser');
assertEqual(priceLaser.priceBase, 150, 'Laser base price');
// 150 * 0.15 = 22.5
assertEqual(priceLaser.taxAmount, 22.5, 'Laser tax amount');
// 150 + 22.5 = 172.5
assertEqual(priceLaser.total, 172.5, 'Laser total price');
assertEqual(priceLaser.taxLabel, 'IVA 15% incluido', 'Laser tax label');

// Test 4: Formatted Strings
assertEqual(priceConsulta.formatted.display, '$40.00', 'Consulta display format');
assertEqual(priceLaser.formatted.display, 'Desde $172.50', 'Laser display format (isFromPrice)');

console.log(`\nResults: ${passed} passed, ${failed} failed.`);

// Restore console.warn
console.warn = originalWarn;

if (failed > 0) {
    process.exit(1);
}
