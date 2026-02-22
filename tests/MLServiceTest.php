<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/MLService.php';

echo "Testing MLService...\n";

// Helper function for assertions
function assert_true($condition, $message) {
    if (!$condition) {
        echo "FAIL: $message\n";
        exit(1);
    }
    echo "PASS: $message\n";
}

// Setup
$tempDbPath = sys_get_temp_dir() . '/test_ml_' . bin2hex(random_bytes(5)) . '.sqlite';
$tempModelPath = sys_get_temp_dir() . '/test_ml_model_' . bin2hex(random_bytes(5)) . '.pkl';
$scriptsDir = realpath(__DIR__ . '/../ml');

if (!$scriptsDir) {
    echo "SKIP: ML scripts directory not found.\n";
    exit(0);
}

// Create a dummy DB
try {
    $pdo = new PDO('sqlite:' . $tempDbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("CREATE TABLE appointments (
        id INTEGER PRIMARY KEY,
        date TEXT,
        time TEXT,
        doctor TEXT,
        service TEXT,
        name TEXT,
        email TEXT,
        phone TEXT,
        status TEXT DEFAULT 'confirmed',
        paymentMethod TEXT,
        paymentStatus TEXT,
        paymentIntentId TEXT,
        rescheduleToken TEXT,
        json_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    $stmt = $pdo->prepare("INSERT INTO appointments (date, time, doctor, service, status, paymentMethod) VALUES (?, ?, ?, ?, ?, ?)");

    // 10 confirmed
    for ($i = 0; $i < 10; $i++) {
        $stmt->execute(['2023-01-01', '09:00', 'DocA', 'ServiceA', 'confirmed', 'card']);
    }
    // 10 noshow
    for ($i = 0; $i < 10; $i++) {
        $stmt->execute(['2023-01-02', '10:00', 'DocB', 'ServiceB', 'noshow', 'cash']);
    }

    // TEST 1: Train Model
    echo "--- Test 1: Train Model ---\n";
    $service = new MLService($scriptsDir, $tempModelPath, $tempDbPath);
    $result = $service->trainModel();

    assert_true($result['success'], 'Training failed: ' . ($result['output'] ?? 'No output'));
    assert_true(file_exists($tempModelPath), 'Model file created');

    // TEST 2: Predict No Show
    echo "--- Test 2: Predict No Show ---\n";
    $appt = [
        'date' => '2023-01-03',
        'time' => '10:00',
        'doctor' => 'DocB',
        'service' => 'ServiceB',
        'paymentMethod' => 'cash'
    ];

    $prob = $service->predictNoShow($appt);
    assert_true($prob !== null, 'Prediction returned a value');
    assert_true(is_float($prob), 'Prediction is float');
    assert_true($prob >= 0.0 && $prob <= 1.0, 'Probability between 0 and 1');
    echo "Prediction for risky appointment: $prob\n";

    $apptConfirmed = [
        'date' => '2023-01-04',
        'time' => '09:00',
        'doctor' => 'DocA',
        'service' => 'ServiceA',
        'paymentMethod' => 'card'
    ];
    $prob2 = $service->predictNoShow($apptConfirmed);
    assert_true($prob2 !== null, 'Prediction returned a value');
    echo "Prediction for safe appointment: $prob2\n";

    // TEST 3: Missing Model
    echo "--- Test 3: Missing Model ---\n";
    if (file_exists($tempModelPath)) unlink($tempModelPath);
    $probNull = $service->predictNoShow(['date'=>'2023-01-01']);
    assert_true($probNull === null, 'Prediction returns null if model missing');

} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
} finally {
    if (file_exists($tempDbPath)) unlink($tempDbPath);
    if (file_exists($tempModelPath)) unlink($tempModelPath);
}

echo "All MLService tests passed!\n";
