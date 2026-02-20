<?php

echo "Starting Backup Verification...\n";

$backupDir = __DIR__ . '/../data/backups';
$filesBefore = glob($backupDir . '/store-*.json');
$countBefore = is_array($filesBefore) ? count($filesBefore) : 0;
echo "Backups before: $countBefore\n";

// Payload for new appointment
$baseUrl = getenv('TEST_BASE_URL') ?: 'http://localhost:8080';

$tomorrow = date('Y-m-d', strtotime('+1 day'));
$payload = [
    'name' => 'Backup Test User',
    'email' => 'backup@test.com',
    'phone' => '0991234567',
    'date' => $tomorrow,
    'time' => '10:00',
    'service' => 'consulta',
    'doctor' => 'indiferente',
    'privacyConsent' => true,
    'paymentMethod' => 'cash'
];

$ch = curl_init($baseUrl . '/api.php?resource=appointments');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

echo "Sending booking request...\n";
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "Response Code: $httpCode\n";
echo "Response Body: $response\n";

if ($httpCode !== 201) {
    echo "FAILED: Booking creation failed.\n";
    exit(1);
}

// Allow filesystem some time to sync (though PHP is synchronous usually)
sleep(1);

$filesAfter = glob($backupDir . '/store-*.json');
$countAfter = is_array($filesAfter) ? count($filesAfter) : 0;
echo "Backups after: $countAfter\n";

if ($countAfter > $countBefore) {
    echo "SUCCESS: Backup created successfully.\n";
    exit(0);
} else {
    echo "FAILED: Backup count did not increase.\n";
    exit(1);
}
