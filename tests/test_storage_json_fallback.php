<?php

declare(strict_types=1);

// Set up temporary environment for testing
$tmpDataDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pielarmonia-test-json-fallback-' . uniqid();
putenv("PIELARMONIA_DATA_DIR=$tmpDataDir");
putenv("PIELARMONIA_STORAGE_JSON_FALLBACK=true");

// Include dependencies
require_once __DIR__ . '/../lib/common.php';
require_once __DIR__ . '/../lib/validation.php';
require_once __DIR__ . '/../lib/storage.php';

echo "Testing Storage JSON Fallback (Refactoring Verification)...\n";
echo "Using temp data dir: $tmpDataDir\n";

if (is_dir($tmpDataDir)) {
    exec("rm -rf " . escapeshellarg($tmpDataDir));
}
mkdir($tmpDataDir, 0777, true);

// Test 1: ensure_json_store_file creates valid JSON
echo "Test 1: ensure_json_store_file...\n";
if (!ensure_json_store_file()) {
    echo "FAIL: ensure_json_store_file returned false\n";
    exit(1);
}

$jsonPath = $tmpDataDir . '/store.json';
if (!file_exists($jsonPath)) {
    echo "FAIL: store.json not created\n";
    exit(1);
}

$content = file_get_contents($jsonPath);
$json = json_decode($content, true);
if (!is_array($json)) {
    echo "FAIL: store.json content is not valid JSON\n";
    echo "Content: " . substr($content, 0, 100) . "...\n";
    exit(1);
}

if (!isset($json['updatedAt'])) {
    echo "FAIL: store.json missing updatedAt\n";
    exit(1);
}
echo "PASS: ensure_json_store_file created valid JSON\n";

// Test 2: write_store_json_fallback updates valid JSON
echo "Test 2: write_store_json_fallback...\n";
$payload = [
    'appointments' => [
        ['id' => 1, 'name' => 'Test User']
    ],
    'updatedAt' => local_date('c')
];

if (!write_store_json_fallback($payload)) {
    echo "FAIL: write_store_json_fallback returned false\n";
    exit(1);
}

$content = file_get_contents($jsonPath);
$json = json_decode($content, true);
if (!is_array($json)) {
    echo "FAIL: store.json content is not valid JSON after write\n";
    echo "Content: " . substr($content, 0, 100) . "...\n";
    exit(1);
}

if (!isset($json['appointments']) || count($json['appointments']) !== 1) {
    echo "FAIL: store.json missing appointments\n";
    print_r($json);
    exit(1);
}

if ($json['appointments'][0]['name'] !== 'Test User') {
    echo "FAIL: store.json content mismatch\n";
    exit(1);
}

echo "PASS: write_store_json_fallback updated valid JSON\n";

// Cleanup
exec("rm -rf " . escapeshellarg($tmpDataDir));
echo "All tests passed.\n";
