<?php

declare(strict_types=1);

if (!defined('TESTING_ENV')) {
    define('TESTING_ENV', true);
}

$mock_payload = [];

final class OpenclawJsonResponseException extends Exception
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
    throw new OpenclawJsonResponseException($payload, $status);
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

require_once __DIR__ . '/../controllers/OpenclawController.php';

function interaction_assert_true(bool $condition, string $message): void
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
function interaction_assert_same($expected, $actual, string $message): void
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
 * @param array<string, mixed> $payload
 * @return array{status:int,payload:array<string, mixed>}
 */
function run_interaction_request(array $payload): array
{
    global $mock_payload;

    $mock_payload = $payload;

    try {
        OpenclawController::checkInteractions([]);
    } catch (OpenclawJsonResponseException $response) {
        return [
            'status' => $response->status,
            'payload' => $response->payload,
        ];
    }

    echo "FAIL: expected json_response from checkInteractions\n";
    exit(1);
}

echo "Running OpenClaw interaction checks...\n";

$missingCaseId = run_interaction_request([
    'proposed_medications' => ['Prednisona 10 mg'],
]);
interaction_assert_same(400, $missingCaseId['status'], 'checkInteractions requires case_id');
interaction_assert_same(
    'case_id y proposed_medications requeridos',
    $missingCaseId['payload']['error'] ?? null,
    'missing case_id returns expected validation message'
);

$warfarinInteraction = run_interaction_request([
    'case_id' => 'CASE-001',
    'proposed_medications' => ['Prednisona 10 mg'],
    'active_medications' => ['Warfarina 5 mg'],
]);
interaction_assert_same(200, $warfarinInteraction['status'], 'warfarin interaction request returns 200');
interaction_assert_true(
    ($warfarinInteraction['payload']['has_interactions'] ?? false) === true,
    'prednisona is flagged against warfarina active medication'
);
interaction_assert_same(
    ['Warfarina 5 mg'],
    $warfarinInteraction['payload']['active_medications'] ?? [],
    'response echoes normalized active medications'
);
interaction_assert_same(
    'medium',
    $warfarinInteraction['payload']['interactions'][0]['severity'] ?? null,
    'prednisona and warfarina severity comes from catalog'
);
interaction_assert_same(
    'Prednisona 10 mg',
    $warfarinInteraction['payload']['interactions'][0]['proposed_medication'] ?? null,
    'response names the proposed medication'
);
interaction_assert_same(
    'Warfarina 5 mg',
    $warfarinInteraction['payload']['interactions'][0]['active_medication'] ?? null,
    'response names the active medication'
);

$topicalInteraction = run_interaction_request([
    'case_id' => 'CASE-002',
    'proposed_medications' => ['Adapaleno 0.1%'],
    'active_medications' => ['Peróxido de benzoílo gel'],
]);
interaction_assert_true(
    ($topicalInteraction['payload']['has_interactions'] ?? false) === true,
    'adapaleno detects topical interaction with peróxido de benzoílo'
);
interaction_assert_same(
    'low',
    $topicalInteraction['payload']['interactions'][0]['severity'] ?? null,
    'topical irritation interaction keeps low severity'
);

$cleanPayload = run_interaction_request([
    'case_id' => 'CASE-003',
    'proposed_medications' => ['Cetirizina 10 mg'],
    'active_medications' => ['Loratadina 10 mg'],
]);
interaction_assert_same(200, $cleanPayload['status'], 'non-interaction request returns 200');
interaction_assert_true(
    ($cleanPayload['payload']['has_interactions'] ?? true) === false,
    'unlisted medication pair does not trigger interaction warning'
);
interaction_assert_same([], $cleanPayload['payload']['interactions'] ?? null, 'non-interaction request returns empty list');

echo "All OpenClaw interaction tests passed.\n";
