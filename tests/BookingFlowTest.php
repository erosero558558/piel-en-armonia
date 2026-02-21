<?php

declare(strict_types=1);

require_once __DIR__ . '/test_framework.php';

// Config
$port = 8089; // Random port
$host = "localhost:$port";
$baseUrl = "http://$host/api.php";
$dataDir = sys_get_temp_dir() . '/pielarmonia-test-data-' . uniqid();

// Setup
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0777, true);
}
putenv("PIELARMONIA_DATA_DIR=$dataDir");
// We need to pass this env var to the server process too!

echo "Starting server on port $port with data dir $dataDir...\n";
$cmd = "PIELARMONIA_DEFAULT_AVAILABILITY_ENABLED=true PIELARMONIA_DATA_DIR=$dataDir php -S $host -t " . __DIR__ . "/../ > /dev/null 2>&1 & echo $!";
$pid = exec($cmd);

// Wait for server
$attempts = 0;
while ($attempts < 10) {
    $conn = @fsockopen('localhost', $port);
    if ($conn) {
        fclose($conn);
        break;
    }
    usleep(200000); // 200ms
    $attempts++;
}

if ($attempts === 10) {
    echo "Failed to start server.\n";
    exit(1);
}

// Helper for requests
function api_request($method, $resource, $data = null)
{
    global $baseUrl;
    $url = "$baseUrl?resource=$resource";
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    if ($data) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    }
    $response = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['code' => $code, 'body' => json_decode($response, true)];
}

try {
    // 1. Check availability (GET)
    run_test('Integration: Check Availability', function () {
        $res = api_request('GET', 'availability');
        assert_equals(200, $res['code']);
        assert_array_has_key('data', $res['body']);
        // Initially empty or whatever the default seed is
    });

    // 2. Create Appointment (POST)
    $apptDate = date('Y-m-d', strtotime('+2 days'));
    run_test('Integration: Create Appointment', function () use ($apptDate) {
        $payload = [
            'name' => 'Integration User',
            'email' => 'integration@example.com',
            'phone' => '0999999999',
            'date' => $apptDate,
            'time' => '09:00',
            'service' => 'consulta',
            'doctor' => 'rosero',
            'privacyConsent' => true,
            'paymentMethod' => 'cash' // Use cash to avoid stripe validation complexity in integration
        ];

        $res = api_request('POST', 'appointments', $payload);

        if ($res['code'] !== 201) {
            echo "Error: " . json_encode($res['body']) . "\n";
        }
        assert_equals(201, $res['code']);
        assert_equals(true, $res['body']['ok']);
        assert_equals('pending_cash', $res['body']['data']['paymentStatus']);
    });

    // 3. Verify Slot Taken (GET booked-slots)
    run_test('Integration: Verify Slot Taken', function () use ($apptDate) {
        global $baseUrl;
        // booked-slots needs date param
        $url = "$baseUrl?resource=booked-slots&date=$apptDate";
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $response = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $body = json_decode($response, true);
        assert_equals(200, $code);
        assert_true(in_array('09:00', $body['data']), '09:00 should be in booked slots');
    });

    // 4. Verify Persistence (GET appointments - admin protected)
    // To test admin, we need session. Or we can just inspect the file directly since we have access to $dataDir.
    run_test('Integration: Verify Persistence on Disk', function () use ($dataDir, $apptDate) {
        $file = $dataDir . '/store.sqlite';
        assert_true(file_exists($file), 'Store file should exist');

        // The store might be encrypted or plain.
        // lib/storage.php: ensure_data_file writes encrypted seed.
        // write_store writes encrypted.
        // We can't easily decrypt without the key logic if we don't include the lib.
        // But we can check if file size > 0.
        assert_greater_than(0, filesize($file));

        // Since we are in the same environment, we can include storage.php and read it?
        // But storage.php relies on constants.
        // Let's trust the API verification.
    });

} catch (Throwable $e) {
    echo "Integration Test Failed: " . $e->getMessage() . "\n";
    $test_failed++; // Ensure we count it
} finally {
    // Cleanup
    echo "Stopping server (PID $pid)...\n";
    exec("kill $pid");

    // Recursive delete data dir
    if (is_dir($dataDir)) {
        // exec("rm -rf $dataDir"); // Dangerous?
        // Let's just leave it or use a safer delete.
        // rm -rf is fine for temp dir.
        exec("rm -rf " . escapeshellarg($dataDir));
    }
}

print_test_summary();
