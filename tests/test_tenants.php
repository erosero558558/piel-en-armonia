<?php

// tests/test_tenants.php

require_once __DIR__ . '/../lib/tenants.php';

function assert_eq($actual, $expected, $message)
{
    if ($actual === $expected) {
        echo "✅ PASS: $message\n";
    } else {
        echo "❌ FAIL: $message\n";
        echo "  Expected: " . var_export($expected, true) . "\n";
        echo "  Actual:   " . var_export($actual, true) . "\n";
        exit(1);
    }
}

echo "Starting tests for tenants.php...\n\n";

// Test 1: Default Tenant ID
echo "--- Test 1: Default Tenant ID ---\n";
// Ensure environment variable does not interfere for this test if possible,
// but usually it's not set in test env unless explicitly done.
$defaultId = get_current_tenant_id();
assert_eq($defaultId, 'pielarmonia', "Default tenant ID should be 'pielarmonia'");

// Test 2: Tenant Config for Default
echo "\n--- Test 2: Tenant Config for Default ---\n";
$config = get_tenant_config('pielarmonia');
assert_eq($config['id'], 'pielarmonia', "Config ID should match requested ID");
assert_eq($config['name'], 'Piel en Armonía', "Default name should be correct");
assert_eq($config['currency'], 'USD', "Currency should be USD");

// Test 3: Tenant Config without ID (uses default)
echo "\n--- Test 3: Tenant Config without ID ---\n";
$configDefault = get_tenant_config();
assert_eq($configDefault['id'], 'pielarmonia', "Should default to pielarmonia");

// Test 4: Unknown Tenant Fallback
echo "\n--- Test 4: Unknown Tenant Fallback ---\n";
$unknownId = 'clinic-xyz';
$configUnknown = get_tenant_config($unknownId);
assert_eq($configUnknown['id'], $unknownId, "Should return requested ID even if unknown (fallback)");
assert_eq($configUnknown['name'], 'Unknown Tenant', "Should have fallback name");
// Inherited defaults
assert_eq($configUnknown['currency'], 'USD', "Should inherit defaults");

echo "\n🎉 All tenant tests passed!\n";
