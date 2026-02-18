<?php
require_once __DIR__ . '/../api-lib.php';

$testsRun = 0;
$testsPassed = 0;

function assertTest(bool $condition, string $message) {
    global $testsRun, $testsPassed;
    $testsRun++;
    if ($condition) {
        $testsPassed++;
        echo "✅ PASS: $message\n";
    } else {
        echo "❌ FAIL: $message\n";
    }
}

echo "Running tests for appointment_slot_taken...\n";

// --- Setup Data ---
$baseAppointments = [
    [
        'id' => 1,
        'date' => '2023-10-27',
        'time' => '10:00',
        'doctor' => 'rosero',
        'status' => 'confirmed'
    ],
    [
        'id' => 2,
        'date' => '2023-10-27',
        'time' => '11:00',
        'doctor' => 'narvaez',
        'status' => 'confirmed'
    ],
    [
        'id' => 3,
        'date' => '2023-10-27',
        'time' => '12:00',
        'doctor' => 'indiferente', // Blocks slot for everyone?
        'status' => 'confirmed'
    ],
    [
        'id' => 4,
        'date' => '2023-10-27',
        'time' => '13:00',
        'doctor' => 'rosero',
        'status' => 'cancelled' // Should be ignored
    ]
];

// --- Test Cases ---

// 1. Happy Path: Slot is free (different time)
assertTest(
    appointment_slot_taken($baseAppointments, '2023-10-27', '09:00', null, 'rosero') === false,
    "Slot 09:00 (free) should return false"
);

// 2. Happy Path: Slot is free (different date)
assertTest(
    appointment_slot_taken($baseAppointments, '2023-10-28', '10:00', null, 'rosero') === false,
    "Slot different date (free) should return false"
);

// 3. Collision: Same time, same doctor
assertTest(
    appointment_slot_taken($baseAppointments, '2023-10-27', '10:00', null, 'rosero') === true,
    "Slot 10:00 (taken by rosero) requested by rosero should return true"
);

// 4. No Collision: Same time, DIFFERENT doctor
assertTest(
    appointment_slot_taken($baseAppointments, '2023-10-27', '10:00', null, 'narvaez') === false,
    "Slot 10:00 (taken by rosero) requested by narvaez should return false"
);

// 5. Collision: Slot taken by 'indiferente' blocks specific doctor
assertTest(
    appointment_slot_taken($baseAppointments, '2023-10-27', '12:00', null, 'rosero') === true,
    "Slot 12:00 (taken by indiferente) requested by rosero should return true"
);

// 6. Collision: Slot taken by specific doctor blocks 'indiferente' request
assertTest(
    appointment_slot_taken($baseAppointments, '2023-10-27', '10:00', null, 'indiferente') === true,
    "Slot 10:00 (taken by rosero) requested by indiferente should return true"
);

// 7. Exclude ID: Rescheduling own appointment (same time)
assertTest(
    appointment_slot_taken($baseAppointments, '2023-10-27', '10:00', 1, 'rosero') === false,
    "Slot 10:00 (taken by ID 1) requested by rosero EXCLUDING ID 1 should return false"
);

// 8. Exclude ID: Rescheduling but collision with another appointment
// (We need to add a collision first to test this properly, or modify data)
$collisionAppointments = $baseAppointments;
$collisionAppointments[] = [
    'id' => 5,
    'date' => '2023-10-27',
    'time' => '10:00',
    'doctor' => 'rosero',
    'status' => 'confirmed'
];
assertTest(
    appointment_slot_taken($collisionAppointments, '2023-10-27', '10:00', 1, 'rosero') === true,
    "Slot 10:00 (taken by ID 1 AND ID 5) excluding ID 1 should return true due to ID 5"
);

// 9. Cancelled appointment should be ignored
assertTest(
    appointment_slot_taken($baseAppointments, '2023-10-27', '13:00', null, 'rosero') === false,
    "Slot 13:00 (cancelled) should return false"
);

// 10. Empty doctor string in request (treated same as 'indiferente')
assertTest(
    appointment_slot_taken($baseAppointments, '2023-10-27', '10:00', null, '') === true,
    "Slot 10:00 (taken by rosero) requested with empty doctor should return true"
);

// 11. Empty doctor string in existing appointment (treated as blocking everyone?)
// Let's add an appointment with empty doctor
$emptyDoctorAppointments = $baseAppointments;
$emptyDoctorAppointments[] = [
    'id' => 6,
    'date' => '2023-10-27',
    'time' => '14:00',
    'doctor' => '',
    'status' => 'confirmed'
];

assertTest(
    appointment_slot_taken($emptyDoctorAppointments, '2023-10-27', '14:00', null, 'rosero') === true,
    "Slot 14:00 (taken by empty doctor) requested by rosero should return true"
);

echo "\nSummary: $testsPassed / $testsRun passed.\n";

if ($testsPassed === $testsRun) {
    exit(0);
} else {
    exit(1);
}
