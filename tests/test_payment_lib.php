<?php
declare(strict_types=1);

require_once __DIR__ . '/../payment-lib.php';

function assert_equals(mixed $expected, mixed $actual, string $message): void
{
    if ($expected === $actual) {
        echo "[PASS] {$message}\n";
    } else {
        echo "[FAIL] {$message}\n";
        echo "  Expected: " . var_export($expected, true) . "\n";
        echo "  Actual:   " . var_export($actual, true) . "\n";
        exit(1);
    }
}

function test_payment_build_idempotency_key(): void
{
    echo "Testing payment_build_idempotency_key...\n";

    // Standard case
    $prefix = 'booking';
    $seed = '12345';
    $result = payment_build_idempotency_key($prefix, $seed);
    $hashPart = substr(hash('sha256', $seed), 0, 48);
    assert_equals('booking-' . $hashPart, $result, 'Standard prefix');

    // Special characters in prefix
    $prefix = 'user@123';
    $seed = 'seed';
    $result = payment_build_idempotency_key($prefix, $seed);
    $hashPart = substr(hash('sha256', $seed), 0, 48);
    assert_equals('user-123-' . $hashPart, $result, 'Special characters in prefix');

    // Empty prefix
    $prefix = '';
    $seed = 'seed';
    $result = payment_build_idempotency_key($prefix, $seed);
    $hashPart = substr(hash('sha256', $seed), 0, 48);
    assert_equals('pay-' . $hashPart, $result, 'Empty prefix defaults to pay');

    // Prefix with only non-alphanumeric
    $prefix = '!!!';
    $seed = 'seed';
    $result = payment_build_idempotency_key($prefix, $seed);
    $hashPart = substr(hash('sha256', $seed), 0, 48);
    // preg_replace('/[^a-z0-9_-]/i', '-', '!!!') -> '---'
    assert_equals('---' . '-' . $hashPart, $result, 'Prefix with only non-alphanumeric');

    // Idempotency
    $prefix = 'fixed';
    $seed = 'fixed-seed';
    $result1 = payment_build_idempotency_key($prefix, $seed);
    $result2 = payment_build_idempotency_key($prefix, $seed);
    assert_equals($result1, $result2, 'Idempotency check');

    // Variance
    $seed1 = 'seed1';
    $seed2 = 'seed2';
    $result1 = payment_build_idempotency_key('prefix', $seed1);
    $result2 = payment_build_idempotency_key('prefix', $seed2);
    if ($result1 === $result2) {
        echo "[FAIL] Variance check\n";
        echo "  Expected different results for different seeds\n";
        exit(1);
    } else {
        echo "[PASS] Variance check\n";
    }

    // Case sensitivity
    $prefix = 'MixedCase';
    $seed = 'seed';
    $result = payment_build_idempotency_key($prefix, $seed);
    $hashPart = substr(hash('sha256', $seed), 0, 48);
    assert_equals('mixedcase-' . $hashPart, $result, 'Prefix lowercasing');

    echo "All tests passed!\n";
}

test_payment_build_idempotency_key();
