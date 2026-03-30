<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/common.php';
require_once __DIR__ . '/../lib/consent/ConsentVersioning.php';

echo "Running Consent Versioning checks...\n";

function consent_assert(bool $condition, string $msg): void
{
    if (!$condition) {
        echo "FAIL: $msg\n";
        exit(1);
    }
    echo "PASS: $msg\n";
}

try {
    // 1. Check getActiveVersion logic
    $privacyInfo = ConsentVersioning::getActiveVersion('privacy_policy');
    consent_assert(isset($privacyInfo['version']), 'Active version has a version id');
    consent_assert(isset($privacyInfo['hash']) && strlen($privacyInfo['hash']) === 64, 'Active version computes a valid SHA256 hash');
    consent_assert(isset($privacyInfo['valid_from']), 'Active version has valid_from');

    // 2. Check getAllVersions array structure
    $allMed = ConsentVersioning::getAllVersions('medical_disclaimer');
    consent_assert(count($allMed) === 1, 'medical_disclaimer has at least one version');
    consent_assert(isset($allMed['1.0']), 'medical_disclaimer v1.0 exists');

    // 3. Resolve by hash
    $resolved = ConsentVersioning::resolveVersionByHash($privacyInfo['hash']);
    consent_assert($resolved !== null, 'Should reliably resolve to an existing consent');
    consent_assert($resolved['type'] === 'privacy_policy', 'Resolved to correct type');
    consent_assert($resolved['version'] === $privacyInfo['version'], 'Resolved to correct version');

    // 4. Fallback on invalid throws exception
    try {
        ConsentVersioning::getActiveVersion('invalid_type_abc');
        consent_assert(false, 'Should throw an exception for invalid consent type');
    } catch (\InvalidArgumentException $e) {
        consent_assert(true, 'Throws exception on invalid consent type');
    }

    echo "All Consent Versioning tests passed.\n";
} catch (\Throwable $e) {
    echo "FAIL: Unhandled exception during tests: " . $e->getMessage() . "\n";
    exit(1);
}
