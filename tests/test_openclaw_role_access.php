<?php

declare(strict_types=1);

if (!defined('TESTING_ENV')) {
    define('TESTING_ENV', true);
}

ob_start();

function openclaw_role_remove_dir_recursive(string $dir): void
{
    if (!is_dir($dir)) {
        return;
    }

    $entries = scandir($dir);
    if (!is_array($entries)) {
        return;
    }

    foreach ($entries as $entry) {
        if ($entry === '.' || $entry === '..') {
            continue;
        }

        $path = $dir . DIRECTORY_SEPARATOR . $entry;
        if (is_dir($path)) {
            openclaw_role_remove_dir_recursive($path);
            continue;
        }

        @unlink($path);
    }

    @rmdir($dir);
}

function openclaw_role_assert_true(bool $condition, string $message): void
{
    if (!$condition) {
        echo "FAIL: {$message}\n";
        exit(1);
    }

    echo "PASS: {$message}\n";
}

/**
 * @param mixed $expected
 * @param mixed $actual
 */
function openclaw_role_assert_same($expected, $actual, string $message): void
{
    if ($expected !== $actual) {
        echo "FAIL: {$message}\n";
        echo 'Expected: ' . json_encode($expected, JSON_UNESCAPED_UNICODE) . "\n";
        echo 'Actual:   ' . json_encode($actual, JSON_UNESCAPED_UNICODE) . "\n";
        exit(1);
    }

    echo "PASS: {$message}\n";
}

function openclaw_role_reset_runtime(): void
{
    unset($GLOBALS['__TEST_JSON_BODY'], $GLOBALS['__TEST_RESPONSE']);
    $_GET = [];
    $_POST = [];
    $_REQUEST = [];
    $_COOKIE = [];
    $_SERVER = [
        'REMOTE_ADDR' => '127.0.0.1',
        'REQUEST_METHOD' => 'GET',
        'HTTP_HOST' => '127.0.0.1:8011',
    ];

    if (session_status() === PHP_SESSION_ACTIVE) {
        $_SESSION = [];
    } else {
        $_SESSION = [];
    }
}

function openclaw_role_authenticate_operator(string $email): void
{
    openclaw_role_reset_runtime();
    start_secure_session();
    operator_auth_establish_session([
        'email' => $email,
        'profileId' => 'profile-' . preg_replace('/[^a-z0-9]+/i', '-', $email),
        'accountId' => 'acct-openclaw-role',
    ]);
}

function openclaw_role_authenticate_legacy_admin(): void
{
    openclaw_role_reset_runtime();
    start_secure_session();
    $_SESSION['admin_logged_in'] = true;
    $_SESSION['admin_email'] = 'doctor@example.com';
}

/**
 * @param callable():void $callable
 * @param array<string,mixed>|null $body
 * @param array<string,string> $query
 * @return array{status:int,payload:array<string,mixed>}
 */
function openclaw_role_capture_response(callable $callable, string $method = 'GET', array $query = [], ?array $body = null): array
{
    $_SERVER['REQUEST_METHOD'] = strtoupper($method);
    $_GET = $query;

    if ($body !== null) {
        $GLOBALS['__TEST_JSON_BODY'] = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } else {
        unset($GLOBALS['__TEST_JSON_BODY']);
    }

    try {
        $callable();
    } catch (TestingExitException $response) {
        return [
            'status' => $response->status,
            'payload' => is_array($response->payload) ? $response->payload : [],
        ];
    }

    echo "FAIL: expected TestingExitException from OpenClaw controller\n";
    exit(1);
}

$testDataDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'aurora-openclaw-role-access-' . bin2hex(random_bytes(4));
mkdir($testDataDir, 0777, true);

putenv('PIELARMONIA_DATA_DIR=' . $testDataDir);
putenv('AURORADERM_DATA_DIR=' . $testDataDir);
putenv('PIELARMONIA_SKIP_ENV_FILE=true');
putenv('AURORADERM_SKIP_ENV_FILE=true');
putenv('AURORADERM_OPERATOR_AUTH_MODE=openclaw_chatgpt');
putenv('AURORADERM_OPERATOR_AUTH_TRANSPORT=web_broker');
putenv('AURORADERM_OPERATOR_AUTH_ALLOWLIST=doctor@example.com,reception@example.com');
putenv('AURORADERM_OPENCLAW_DOCTOR_EMAILS=doctor@example.com');
ini_set('log_errors', '1');
ini_set('error_log', $testDataDir . DIRECTORY_SEPARATOR . 'php-error.log');

register_shutdown_function(static function () use ($testDataDir): void {
    putenv('PIELARMONIA_DATA_DIR');
    putenv('AURORADERM_DATA_DIR');
    putenv('PIELARMONIA_SKIP_ENV_FILE');
    putenv('AURORADERM_SKIP_ENV_FILE');
    putenv('AURORADERM_OPERATOR_AUTH_MODE');
    putenv('AURORADERM_OPERATOR_AUTH_TRANSPORT');
    putenv('AURORADERM_OPERATOR_AUTH_ALLOWLIST');
    putenv('AURORADERM_OPENCLAW_DOCTOR_EMAILS');
    openclaw_role_remove_dir_recursive($testDataDir);
});

require_once __DIR__ . '/../api-lib.php';
require_once __DIR__ . '/../controllers/OpenclawController.php';

echo "Running OpenClaw role access checks...\n";

openclaw_role_authenticate_operator('reception@example.com');
$receptionistCapabilities = admin_agent_capabilities_payload();
openclaw_role_assert_true(
    ($receptionistCapabilities['openclawReceptionist'] ?? false) === true,
    'receptionist capability payload marks the receptionist role'
);
openclaw_role_assert_true(
    ($receptionistCapabilities['openclawPrescription'] ?? true) === false,
    'receptionist capability payload blocks prescription scope'
);

$receptionistRead = openclaw_role_capture_response(
    static function (): void {
        OpenclawController::patient([]);
    },
    'GET'
);
openclaw_role_assert_same(400, $receptionistRead['status'], 'receptionist keeps assistant access to patient endpoint');
openclaw_role_assert_same(
    'patient_id requerido',
    $receptionistRead['payload']['error'] ?? null,
    'assistant scope reaches patient validation instead of role denial'
);

$receptionistPrescription = openclaw_role_capture_response(
    static function (): void {
        OpenclawController::savePrescription([]);
    },
    'POST',
    [],
    ['case_id' => 'CASE-ROLE-001']
);
openclaw_role_assert_same(403, $receptionistPrescription['status'], 'receptionist cannot issue prescriptions');
openclaw_role_assert_same(
    'clinical_role_forbidden',
    $receptionistPrescription['payload']['code'] ?? null,
    'prescription denial returns canonical role gate code'
);
openclaw_role_assert_same(
    'receptionist',
    $receptionistPrescription['payload']['role'] ?? null,
    'prescription denial reports the receptionist role'
);

$receptionistCertificate = openclaw_role_capture_response(
    static function (): void {
        OpenclawController::generateCertificate([]);
    },
    'POST',
    [],
    ['case_id' => 'CASE-ROLE-001', 'type' => 'reposo_laboral']
);
openclaw_role_assert_same(403, $receptionistCertificate['status'], 'receptionist cannot issue certificates');
openclaw_role_assert_same(
    ['doctor'],
    $receptionistCertificate['payload']['required_roles'] ?? [],
    'certificate denial reports doctor as the only allowed role'
);

openclaw_role_authenticate_operator('doctor@example.com');
$doctorCapabilities = admin_agent_capabilities_payload();
openclaw_role_assert_true(
    ($doctorCapabilities['openclawDoctor'] ?? false) === true,
    'doctor capability payload marks the doctor role'
);
openclaw_role_assert_true(
    ($doctorCapabilities['openclawPrescription'] ?? false) === true,
    'doctor capability payload allows prescription scope'
);

$doctorPrescription = openclaw_role_capture_response(
    static function (): void {
        OpenclawController::savePrescription([]);
    },
    'POST',
    [],
    ['case_id' => 'CASE-ROLE-002']
);
openclaw_role_assert_same(400, $doctorPrescription['status'], 'doctor can reach prescription validation');
openclaw_role_assert_same(
    'case_id y medications requeridos',
    $doctorPrescription['payload']['error'] ?? null,
    'doctor request fails only on business validation when medications are missing'
);

openclaw_role_authenticate_legacy_admin();
$legacyCertificate = openclaw_role_capture_response(
    static function (): void {
        OpenclawController::generateCertificate([]);
    },
    'POST',
    [],
    []
);
openclaw_role_assert_same(400, $legacyCertificate['status'], 'legacy admin keeps doctor-level certificate access by default');
openclaw_role_assert_same(
    'case_id requerido',
    $legacyCertificate['payload']['error'] ?? null,
    'legacy admin request reaches certificate validation'
);

echo "All OpenClaw role access tests passed.\n";

if (ob_get_level() > 0) {
    ob_end_flush();
}
