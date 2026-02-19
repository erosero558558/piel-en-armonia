<?php
require_once __DIR__ . '/../lib/common.php';
require_once __DIR__ . '/../lib/validation.php';

// Mock availability
$availability = [
    '2026-03-01' => ['09:00', '10:00']
];

// Test case 1: Valid appointment
$payload = [
    'name' => 'John Doe',
    'email' => 'john@example.com',
    'phone' => '0991234567',
    'privacyConsent' => true,
    'date' => '2026-03-01',
    'time' => '09:00'
];

$result = validate_appointment_payload($payload, $availability);
if ($result['ok']) {
    echo "[PASS] Valid appointment\n";
} else {
    echo "[FAIL] Valid appointment: " . $result['error'] . "\n";
}

// Test case 2: Missing name
$payload2 = $payload;
$payload2['name'] = '';
$result = validate_appointment_payload($payload2, $availability);
if (!$result['ok'] && strpos($result['error'], 'Nombre') !== false) {
    echo "[PASS] Missing name detected\n";
} else {
    echo "[FAIL] Missing name check failed\n";
}

// Test case 3: Invalid email
$payload3 = $payload;
$payload3['email'] = 'invalid-email';
$result = validate_appointment_payload($payload3, $availability);
if (!$result['ok'] && strpos($result['error'], 'email') !== false) {
    echo "[PASS] Invalid email detected\n";
} else {
    echo "[FAIL] Invalid email check failed\n";
}

// Test case 4: Slot unavailable
$payload4 = $payload;
$payload4['time'] = '11:00'; // Not in availability
$result = validate_appointment_payload($payload4, $availability);
if (!$result['ok'] && strpos($result['error'], 'horario no está disponible') !== false) {
    echo "[PASS] Unavailable slot detected\n";
} else {
    echo "[FAIL] Unavailable slot check failed\n";
}

// Test case 5: Past date
$payload5 = $payload;
$payload5['date'] = '2020-01-01';
$result = validate_appointment_payload($payload5, $availability);
if (!$result['ok'] && strpos($result['error'], 'fecha pasada') !== false) {
    echo "[PASS] Past date detected\n";
} else {
    echo "[FAIL] Past date check failed: " . ($result['ok'] ? 'OK' : $result['error']) . "\n";
}
