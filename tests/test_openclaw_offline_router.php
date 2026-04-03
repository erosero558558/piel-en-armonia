<?php

declare(strict_types=1);

if (!defined('TESTING_ENV')) {
    define('TESTING_ENV', true);
}

$mock_payload = [];

final class OpenclawOfflineJsonResponseException extends Exception
{
    /** @var array<string, mixed> */
    public array $payload;
    public int $status;

    /** @param array<string, mixed> $payload */
    public function __construct(array $payload, int $status)
    {
        parent::__construct(json_encode($payload, JSON_UNESCAPED_UNICODE) ?: 'json_response');
        $this->payload = $payload;
        $this->status = $status;
    }
}

function require_admin_auth(): void
{
}

/** @return array<string, mixed> */
function require_json_body(): array
{
    global $mock_payload;
    return $mock_payload;
}

/** @param array<string, mixed> $payload */
function json_response(array $payload, int $status = 200): void
{
    throw new OpenclawOfflineJsonResponseException($payload, $status);
}

function read_store(): array
{
    return [];
}

function mutate_store(callable $callback): array
{
    try {
        return [
            'ok' => true,
            'result' => $callback([]),
        ];
    } catch (Throwable $error) {
        return [
            'ok' => false,
            'error' => $error->getMessage(),
        ];
    }
}

function remove_dir_recursive(string $dir): void
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
            remove_dir_recursive($path);
            continue;
        }

        @unlink($path);
    }

    @rmdir($dir);
}

$testDataDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'aurora-openclaw-offline-' . bin2hex(random_bytes(4));
mkdir($testDataDir, 0777, true);
putenv('PIELARMONIA_DATA_DIR=' . $testDataDir);
putenv('OPENCLAW_ROUTER_MODE=local_only');

register_shutdown_function(static function () use ($testDataDir): void {
    remove_dir_recursive($testDataDir);
});

require_once __DIR__ . '/../controllers/OpenclawController.php';
require_once __DIR__ . '/../controllers/OpenclawAiController.php';
require_once __DIR__ . '/../controllers/OpenclawSessionController.php';

function offline_assert_true(bool $condition, string $message): void
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
function offline_assert_same($expected, $actual, string $message): void
{
    if ($expected !== $actual) {
        echo "FAIL: {$message}\n";
        echo 'Expected: ' . json_encode($expected, JSON_UNESCAPED_UNICODE) . "\n";
        echo 'Actual:   ' . json_encode($actual, JSON_UNESCAPED_UNICODE) . "\n";
        exit(1);
    }

    echo "PASS: {$message}\n";
}

/**
 * @return array{status:int,payload:array<string,mixed>}
 */
function run_openclaw_request(callable $fn): array
{
    try {
        $fn();
    } catch (OpenclawOfflineJsonResponseException $response) {
        return [
            'status' => $response->status,
            'payload' => $response->payload,
        ];
    }

    echo "FAIL: expected json_response from OpenClaw controller\n";
    exit(1);
}

/**
 * @return array{status:int,payload:array<string,mixed>}
 */
function run_chat_request(string $message): array
{
    global $mock_payload;

    $mock_payload = [
        'messages' => [
            ['role' => 'user', 'content' => $message],
        ],
    ];

    return run_openclaw_request(static function (): void {
        OpenclawAiController::chat([]);
    });
}

echo "Running OpenClaw offline router checks...\n";

$diagnostic = run_chat_request('¿Qué es esto en la piel? Tiene una placa roja que pica.');
offline_assert_same(200, $diagnostic['status'], 'diagnostic fallback returns 200');
offline_assert_true(
    ($diagnostic['payload']['degraded'] ?? false) === true,
    'diagnostic fallback is marked as degraded'
);
offline_assert_same(
    '🔴 IA sin conexión — respuestas locales',
    $diagnostic['payload']['offline_badge'] ?? null,
    'diagnostic fallback exposes the canonical offline badge'
);
offline_assert_true(
    str_contains((string) ($diagnostic['payload']['choices'][0]['message']['content'] ?? ''), 'Plantilla offline de diagnóstico diferencial'),
    'diagnostic fallback returns the differential template'
);

$prescription = run_chat_request('genera receta');
offline_assert_same(200, $prescription['status'], 'prescription fallback returns 200');
offline_assert_true(
    str_contains((string) ($prescription['payload']['choices'][0]['message']['content'] ?? ''), 'Plantilla offline de receta en blanco'),
    'prescription fallback returns the blank prescription template'
);
offline_assert_true(
    str_contains((string) ($prescription['payload']['choices'][0]['message']['content'] ?? ''), 'Indicaciones al paciente:'),
    'prescription template keeps manual fill fields'
);

$certificate = run_chat_request('genera certificado');
offline_assert_same(200, $certificate['status'], 'certificate fallback returns 200');
offline_assert_true(
    str_contains((string) ($certificate['payload']['choices'][0]['message']['content'] ?? ''), 'Generar Certificado'),
    'certificate fallback redirects to the certificate button'
);

$routerStatus = run_openclaw_request(static function (): void {
    OpenclawSessionController::routerStatus([]);
});
offline_assert_same(200, $routerStatus['status'], 'router status returns 200');
offline_assert_true(
    ($routerStatus['payload']['router']['degraded'] ?? false) === true,
    'router status reports degraded mode when local_only is active'
);
offline_assert_same(
    '🔴 IA sin conexión — respuestas locales',
    $routerStatus['payload']['router']['offline_badge'] ?? null,
    'router status exposes the canonical offline badge'
);

echo "All OpenClaw offline router tests passed.\n";
