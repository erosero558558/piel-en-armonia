<?php

declare(strict_types=1);

if (!defined('TESTING_ENV')) {
    define('TESTING_ENV', true);
}

require_once __DIR__ . '/../api-lib.php';
require_once __DIR__ . '/../lib/monitoring.php';
require_once __DIR__ . '/../controllers/SystemController.php';

function assert_true($condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "ASSERT FAILED: {$message}\n");
        exit(1);
    }
}

$envKeys = [
    'CLARITY_ID',
    'PIELARMONIA_CLARITY_PROJECT_ID',
    'MICROSOFT_CLARITY_PROJECT_ID',
    'PIELARMONIA_GA_MEASUREMENT_ID',
    'AURORADERM_GA_MEASUREMENT_ID',
];

$backup = [];
foreach ($envKeys as $key) {
    $backup[$key] = getenv($key);
}

putenv('CLARITY_ID=mx123');
putenv('PIELARMONIA_CLARITY_PROJECT_ID');
putenv('MICROSOFT_CLARITY_PROJECT_ID');
putenv('PIELARMONIA_GA_MEASUREMENT_ID=G-TESTV');
putenv('AURORADERM_GA_MEASUREMENT_ID');

try {
    $monitoringConfig = get_monitoring_config();
    assert_true(($monitoringConfig['ok'] ?? false) === true, 'monitoring-config should expose ok=true');
    assert_true(($monitoringConfig['clarity_id'] ?? '') === 'mx123', 'monitoring-config should expose CLARITY_ID');
    assert_true(($monitoringConfig['ga_measurement_id'] ?? '') === 'G-TESTV', 'monitoring-config should expose GA measurement id');

    try {
        \SystemController::publicRuntimeConfig(['store' => []]);
        fwrite(STDERR, "ASSERT FAILED: expected TestingExitException\n");
        exit(1);
    } catch (\TestingExitException $e) {
        $payload = is_array($e->payload ?? null) ? $e->payload : [];
        $data = is_array($payload['data'] ?? null) ? $payload['data'] : [];
        $analytics = is_array($data['analytics'] ?? null) ? $data['analytics'] : [];

        assert_true(($payload['ok'] ?? false) === true, 'public-runtime-config should return ok=true');
        assert_true(($analytics['clarityProjectId'] ?? null) === 'mx123', 'public runtime config should expose CLARITY_ID');
        assert_true(($analytics['gaMeasurementId'] ?? '') === 'G-TESTV', 'public runtime config should expose GA measurement id');
    }
} finally {
    foreach ($backup as $key => $value) {
        if ($value === false) {
            putenv($key);
        } else {
            putenv($key . '=' . $value);
        }
    }
}

fwrite(STDOUT, "ok\n");
