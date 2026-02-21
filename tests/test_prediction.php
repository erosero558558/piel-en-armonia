<?php

require_once __DIR__ . '/../lib/prediction.php';

echo "Testing NoShowPredictor...\n";

// Test 1: New Patient
$appt = ['date' => '2023-11-01', 'time' => '10:00', 'service' => 'consulta'];
$history = [];
$result = NoShowPredictor::predict($appt, $history);
// Base 0.05 + New Patient 0.1 = 0.15
assert($result['score'] >= 0.15, "New patient should have higher risk than base");
assert($result['risk_level'] === 'low', "New patient risk is low but not zero");
echo "New patient test passed.\n";

// Test 2: Good History
$history = [
    ['status' => 'confirmed'],
    ['status' => 'completed'],
    ['status' => 'completed']
];
$result = NoShowPredictor::predict($appt, $history);
// Base 0.05 - Good History 0.05 = 0.0
assert($result['score'] <= 0.05, "Good history should lower risk");
echo "Good history test passed.\n";

// Test 3: Bad History
$history = [
    ['status' => 'no_show'],
    ['status' => 'no_show'],
    ['status' => 'completed']
];
$result = NoShowPredictor::predict($appt, $history);
// Base 0.05 + High Rate (>0.5) 0.4 = 0.45
assert($result['score'] >= 0.45, "High no-show rate should increase risk");
assert($result['risk_level'] === 'high' || $result['risk_level'] === 'critical', "High no-show rate means high/critical risk");
echo "Bad history test passed.\n";

// Test 4: Risk Factors (Monday + Early Morning)
$appt = ['date' => '2023-10-30', 'time' => '09:00', 'service' => 'consulta']; // Monday
$history = [];
$result = NoShowPredictor::predict($appt, $history);
// Base 0.05 + New Patient 0.1 + Monday 0.05 + Early Morning 0.05 = 0.25
assert($result['score'] >= 0.25, "Factors should add up");
echo "Risk factors test passed.\n";

echo "All tests passed.\n";
