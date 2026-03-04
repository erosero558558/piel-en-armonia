<?php

declare(strict_types=1);

require_once __DIR__ . '/test_filesystem.php';

function fq_fail(string $message): void
{
    fwrite(STDERR, "[FAIL] {$message}" . PHP_EOL);
    exit(1);
}

function fq_assert_true($value, string $message): void
{
    if ($value !== true) {
        fq_fail($message);
    }
}

function fq_assert_equals($expected, $actual, string $message): void
{
    if ($expected !== $actual) {
        fq_fail($message . ' | expected=' . var_export($expected, true) . ' actual=' . var_export($actual, true));
    }
}

$tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pielarmonia-figo-queue-' . bin2hex(random_bytes(4));
ensure_clean_directory($tempDir);
putenv('PIELARMONIA_DATA_DIR=' . $tempDir);

require_once __DIR__ . '/../lib/figo_queue.php';

fq_assert_true(figo_queue_ensure_dirs(), 'queue directories should be created');

$enqueue = figo_queue_enqueue([
    'messages' => [
        ['role' => 'user', 'content' => 'hola figo'],
    ],
    'max_tokens' => 120,
    'temperature' => 0.4,
    'sessionId' => 'test-session-1',
]);

fq_assert_true(($enqueue['ok'] ?? false) === true, 'enqueue should succeed');
$jobId = (string) ($enqueue['jobId'] ?? '');
fq_assert_true(figo_queue_job_id_is_valid($jobId), 'job id should be valid');
fq_assert_true(is_file(figo_queue_job_path($jobId)), 'job file should exist');

$depth = figo_queue_count_depth();
fq_assert_equals(1, (int) ($depth['queued'] ?? 0), 'queued depth should be 1 after enqueue');

$pending = figo_queue_pending_job_ids();
fq_assert_true(in_array($jobId, $pending, true), 'pending job ids should include enqueued job');

$queuedStatus = figo_queue_status_payload_for_job($jobId);
fq_assert_equals('queued', (string) ($queuedStatus['status'] ?? ''), 'status payload should start queued');

$job = figo_queue_read_job($jobId);
fq_assert_true(is_array($job), 'job should be readable');
$completedJob = figo_queue_mark_job(
    $job,
    'completed',
    '',
    '',
    figo_queue_build_completion('demo-model', 'respuesta simulada')
);
fq_assert_true(figo_queue_write_job($completedJob), 'completed job should be writable');

$completedStatus = figo_queue_status_payload_for_job($jobId);
fq_assert_true(($completedStatus['ok'] ?? false) === true, 'completed status payload should be ok');
fq_assert_equals('completed', (string) ($completedStatus['status'] ?? ''), 'status payload should be completed');
fq_assert_equals(
    'respuesta simulada',
    (string) ($completedStatus['completion']['choices'][0]['message']['content'] ?? ''),
    'completion content should roundtrip'
);

$dedup = figo_queue_enqueue([
    'messages' => [
        ['role' => 'user', 'content' => 'hola figo'],
    ],
    'max_tokens' => 120,
    'temperature' => 0.4,
    'sessionId' => 'test-session-1',
]);
fq_assert_true(($dedup['ok'] ?? false) === true, 'deduplicated enqueue should still be ok');
fq_assert_equals('deduplicated', (string) ($dedup['status'] ?? ''), 'same request should deduplicate');
fq_assert_equals($jobId, (string) ($dedup['jobId'] ?? ''), 'dedup should return existing job id');

delete_path_recursive($tempDir);
echo "Figo queue core tests passed." . PHP_EOL;
exit(0);
