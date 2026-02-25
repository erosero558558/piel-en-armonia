<?php

declare(strict_types=1);

require_once __DIR__ . '/test_framework.php';

// Setup isolated environment
$tempDataDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pielarmonia-test-figo-queue-' . uniqid('', true);
putenv('PIELARMONIA_DATA_DIR=' . $tempDataDir);

if (!is_dir($tempDataDir) && !@mkdir($tempDataDir, 0777, true) && !is_dir($tempDataDir)) {
    fwrite(STDERR, "No se pudo crear directorio temporal de pruebas.\n");
    exit(1);
}

// Include libraries
require_once __DIR__ . '/../lib/storage.php';
require_once __DIR__ . '/../lib/db.php';
require_once __DIR__ . '/../lib/figo_queue.php';

// Cleanup function
function cleanup_figo_queue_test_env() {
    global $tempDataDir;
    // Helper to delete dir tree
    if (!function_exists('delete_tree_recursive')) {
        function delete_tree_recursive($dir) {
            $files = array_diff(scandir($dir), array('.','..'));
            foreach ($files as $file) {
                (is_dir("$dir/$file")) ? delete_tree_recursive("$dir/$file") : unlink("$dir/$file");
            }
            return rmdir($dir);
        }
    }
    if (is_dir($tempDataDir)) {
        delete_tree_recursive($tempDataDir);
    }
}
register_shutdown_function('cleanup_figo_queue_test_env');


run_test('Ensure schema creates table', function () {
    assert_true(figo_queue_ensure_schema());

    $pdo = get_db_connection(data_file_path());
    $stmt = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='figo_queue_jobs'");
    assert_equals('figo_queue_jobs', $stmt->fetchColumn());
});

run_test('Write and Read Job (DB)', function () {
    $jobId = figo_queue_new_job_id();
    $job = [
        'jobId' => $jobId,
        'status' => 'queued',
        'createdAt' => gmdate('c'),
        'updatedAt' => gmdate('c'),
        'payload' => 'test-payload'
    ];

    assert_true(figo_queue_write_job($job));

    $read = figo_queue_read_job($jobId);
    assert_true(is_array($read));
    assert_equals($jobId, $read['jobId']);
    assert_equals('test-payload', $read['payload']);
});

run_test('Migration from file to DB', function () {
    // Manually create a file (simulating legacy state)
    // We need to write a file, but figo_queue_write_job now writes to DB.
    // So we use file_put_contents directly to simulate old state.

    $jobId = figo_queue_new_job_id();
    $job = [
        'jobId' => $jobId,
        'status' => 'queued',
        'createdAt' => gmdate('c'),
        'requestHash' => 'mig-hash',
        'sessionIdHash' => 'mig-sess'
    ];

    $path = figo_queue_dir_jobs() . DIRECTORY_SEPARATOR . $jobId . '.json';
    if (!is_dir(dirname($path))) mkdir(dirname($path), 0777, true);
    file_put_contents($path, json_encode($job));

    // Run migration
    $count = figo_queue_migrate_legacy_files();
    assert_equals(1, $count);

    // File should be gone
    assert_false(file_exists($path));

    // Job should be in DB
    $read = figo_queue_read_job($jobId);
    assert_true(is_array($read));
    assert_equals('mig-hash', $read['requestHash']);
});

run_test('Find Recent (DB Optimization)', function () {
    // Create job in DB
    $reqHash = 'req-find';
    $sessHash = 'sess-find';
    $jobId = figo_queue_new_job_id();

    $job = [
        'jobId' => $jobId,
        'status' => 'completed',
        'createdAt' => gmdate('c'),
        'requestHash' => $reqHash,
        'sessionIdHash' => $sessHash,
        'expiresAt' => gmdate('c', time() + 3600)
    ];
    figo_queue_write_job($job);

    $found = figo_queue_find_recent_by_request_hash($reqHash, $sessHash);
    assert_true(is_array($found));
    assert_equals($jobId, $found['jobId']);

    // Test not found
    $notFound = figo_queue_find_recent_by_request_hash('bad', 'bad');
    assert_equals(null, $notFound);
});

run_test('Pending Jobs', function () {
    $jobId = figo_queue_new_job_id();
    $job = [
        'jobId' => $jobId,
        'status' => 'queued',
        'createdAt' => gmdate('c'),
        'nextAttemptAt' => gmdate('c', time() - 10) // past
    ];
    figo_queue_write_job($job);

    $pending = figo_queue_pending_job_ids();
    assert_true(in_array($jobId, $pending));
});

run_test('Purge Old Jobs', function () {
    $oldJobId = figo_queue_new_job_id();
    $ttl = figo_queue_queue_ttl_sec();
    $oldTime = gmdate('c', time() - $ttl - 100);

    $job = [
        'jobId' => $oldJobId,
        'status' => 'queued',
        'createdAt' => $oldTime
    ];
    figo_queue_write_job($job);

    $result = figo_queue_purge_old_jobs();
    assert_greater_than(0, $result['expiredNow']);

    $read = figo_queue_read_job($oldJobId);
    assert_equals('expired', $read['status']);
});

print_test_summary();
