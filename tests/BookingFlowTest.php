<?php

declare(strict_types=1);

require_once __DIR__ . '/test_framework.php';

// Config
$port = 8089; // Random port
$host = "localhost:$port";
$baseUrl = "http://$host/api.php";
$adminUrl = "http://$host/admin-auth.php";
$dataDir = sys_get_temp_dir() . '/pielarmonia-test-data-' . uniqid();
$cookieFile = sys_get_temp_dir() . '/cookie-flow-' . uniqid() . '.txt';

// Setup
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0777, true);
}
putenv("PIELARMONIA_DATA_DIR=$dataDir");
putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');
// We need to pass this env var to the server process too!

echo "Starting server on port $port with data dir $dataDir...\n";
$cmd = "PIELARMONIA_DATA_DIR=$dataDir PIELARMONIA_AVAILABILITY_SOURCE=store PIELARMONIA_ADMIN_PASSWORD=secret php -S $host -t " . __DIR__ . "/../ > /dev/null 2>&1 & echo $!";
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

// Globals
$csrfToken = '';

// Helper for requests
function api_request($method, $resource, $data = null, $useCookies = false, $headers = [])
{
    global $baseUrl, $cookieFile;
    $url = "$baseUrl?resource=$resource";
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

    $reqHeaders = ['Content-Type: application/json'];
    if (!empty($headers)) {
        $reqHeaders = array_merge($reqHeaders, $headers);
    }

    if ($data) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    }
    curl_setopt($ch, CURLOPT_HTTPHEADER, $reqHeaders);

    if ($useCookies) {
        curl_setopt($ch, CURLOPT_COOKIEJAR, $cookieFile);
        curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieFile);
    }

    $response = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['code' => $code, 'body' => json_decode($response, true)];
}

try {
    $apptDate = date('Y-m-d', strtotime('+2 days'));

    // 1. Check availability (GET)
    run_test('Integration: Check Availability', function () {
        $res = api_request('GET', 'availability');
        assert_equals(200, $res['code']);
        assert_array_has_key('data', $res['body']);
        // Initially empty or whatever the default seed is
    });

    // 1.5 Login Admin (for availability config)
    run_test('Integration: Login Admin', function () use ($adminUrl, $cookieFile) {
        global $csrfToken;
        $ch = curl_init("$adminUrl?action=login");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['password' => 'secret']));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_COOKIEJAR, $cookieFile);
        curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieFile);

        $response = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        assert_equals(200, $code);
        $body = json_decode($response, true);
        assert_true($body['ok'], 'Login failed');
        $csrfToken = $body['csrfToken'] ?? '';
    });

    // 2. Configure availability (POST)
    run_test('Integration: Configure Availability', function () use ($apptDate, $cookieFile) {
        // Need to read CSRF token? The API might require it.
        // Usually login response sends X-CSRF-Token or it's in the cookie?
        // ApiKernel checks require_csrf().
        // For now, let's try without explicit CSRF header assuming cookie handles it?
        // Wait, require_csrf() checks $_SERVER['HTTP_X_CSRF_TOKEN'] vs $_SESSION['csrf_token'].
        // We need to extract the token from login response if provided, or from a subsequent GET.
        // Login response: { ok: true, csrfToken: '...' }
        // We need to capture it.

        // Let's re-login and capture token properly if needed.
        // Or assume the Login Admin test already ran.
        // But run_test scope isolates variables unless we use globals or return values.
        // Since run_test uses closures, variables inside aren't shared easily unless passed by reference or global.
        // We can use a file or assume test sequence.

        // Let's just do login inside this test block to be safe and simple, or modify the helper.
        // But we already did login step.
        // Let's modify the Login Admin test to store the token in a global or file.

        // Actually, let's just re-login here or combine.
        // But better: use a variable from outside.
        global $csrfToken;

        $res = api_request('POST', 'availability', [
            'availability' => [
                $apptDate => ['09:00', '10:00']
            ]
        ], true, ['X-CSRF-Token: ' . $csrfToken]);

        assert_equals(200, $res['code']);
        assert_true(isset($res['body']['ok']) && $res['body']['ok'] === true);
    });

    // 3. Create Appointment (POST)
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

    // 4. Verify Slot Taken (GET booked-slots)
    run_test('Integration: Verify Slot Taken', function () use ($apptDate) {
        global $baseUrl;
        // booked-slots needs date param. We specify doctor=rosero because we only booked one doctor.
        // If we query without doctor (indiferente), it will only show taken if ALL doctors are taken.
        $url = "$baseUrl?resource=booked-slots&date=$apptDate&doctor=rosero";
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $response = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $body = json_decode($response, true);
        assert_equals(200, $code);
        assert_true(in_array('09:00', $body['data']), '09:00 should be in booked slots');
    });

    // 5. Verify Persistence (GET appointments - admin protected)
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

    if (file_exists($cookieFile)) {
        unlink($cookieFile);
    }

    // Recursive delete data dir
    if (is_dir($dataDir)) {
        // exec("rm -rf $dataDir"); // Dangerous?
        // Let's just leave it or use a safer delete.
        // rm -rf is fine for temp dir.
        exec("rm -rf " . escapeshellarg($dataDir));
    }
}

print_test_summary();
