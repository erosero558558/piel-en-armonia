<?php
require_once __DIR__ . '/lib/stores/PatientConsentStore.php';

// Simulate marking consent
PatientConsentStore::markAsSigned('pat-1234', 'privacy_policy', 'v1.0');
$status = PatientConsentStore::readStatus('pat-1234', 'privacy_policy');

echo "Signed version: " . $status . "\n";
