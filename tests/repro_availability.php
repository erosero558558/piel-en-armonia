<?php

require_once __DIR__ . '/../lib/common.php';
require_once __DIR__ . '/../lib/storage.php';
require_once __DIR__ . '/../lib/BookingService.php';

echo "Testing Availability Logic...\n";

$testStore = storage_default_store_payload();
$date = '2026-05-20'; // A future date (Wednesday)
$time = '10:00';

// Set availability explicitly
$testStore['availability'] = [
    $date => [$time, '11:00']
];

echo "Writing store with availability...\n";
if (!write_store($testStore, false)) {
    echo "FAILED to write store.\n";
    exit(1);
}

echo "Reading store back...\n";
$readStore = read_store();
if (!isset($readStore['availability'][$date])) {
    echo "FAILED: Availability for $date not found in read store.\n";
    print_r($readStore['availability']);
    exit(1);
}

echo "Availability confirmed in store.\n";

$service = new BookingService();
$payload = [
    'date' => $date,
    'time' => $time,
    'service' => 'consulta',
    'name' => 'Test User',
    'email' => 'test@example.com',
    'phone' => '0999999999',
    'privacyConsent' => true,
    'paymentMethod' => 'cash'
];

echo "Attempting to create appointment...\n";
$result = $service->create($readStore, $payload);

if ($result['ok']) {
    echo "SUCCESS: Appointment created.\n";
} else {
    echo "FAILED: " . ($result['error'] ?? 'Unknown error') . "\n";
    exit(1);
}
