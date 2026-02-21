<?php

declare(strict_types=1);

/**
 * Cross-platform PHP test runner.
 *
 * It discovers lightweight script-based tests under tests/ and executes them
 * directly with the current PHP binary.
 */

$testDir = __DIR__;
$isWindows = DIRECTORY_SEPARATOR === '\\';
$includePosixOnWindows = filter_var((string) getenv('PIELARMONIA_TEST_INCLUDE_POSIX'), FILTER_VALIDATE_BOOLEAN);

$patterns = [
    'test*.php',
    '*_test.php',
    '*Test.php',
    'verify*.php'
];

$excludedFiles = [
    'test_framework.php',
    'router.php',
    'penetration_test.php',
    'security_scan.php'
];

// These tests start subprocesses with Unix shell commands.
$posixOnlyFiles = [
    'ApiSecurityTest.php',
    'BookingFlowTest.php',
    'test_storage_backup.php'
];

$discovered = [];
foreach ($patterns as $pattern) {
    $matches = glob($testDir . DIRECTORY_SEPARATOR . $pattern);
    if (!is_array($matches)) {
        continue;
    }
    foreach ($matches as $match) {
        $real = realpath($match);
        if ($real === false || !is_file($real)) {
            continue;
        }
        $name = basename($real);
        if (in_array($name, $excludedFiles, true)) {
            continue;
        }
        if ($isWindows && !$includePosixOnWindows && in_array($name, $posixOnlyFiles, true)) {
            continue;
        }
        $discovered[$real] = true;
    }
}

$testFiles = array_keys($discovered);
natcasesort($testFiles);
$testFiles = array_values($testFiles);

echo "Running PHP tests...\n";

if (count($testFiles) === 0) {
    echo "No runnable PHP tests found.\n";
    exit(1);
}

$failed = 0;
$passed = 0;

foreach ($testFiles as $file) {
    $relative = str_replace($testDir . DIRECTORY_SEPARATOR, 'tests' . DIRECTORY_SEPARATOR, $file);
    echo "Testing {$relative}...\n";

    $cmd = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($file);
    passthru($cmd, $exitCode);

    if ($exitCode === 0) {
        $passed++;
    } else {
        $failed++;
        echo "FAILED: {$relative}\n";
    }
}

echo "\n";
echo "Tests passed: {$passed}\n";
echo "Tests failed: {$failed}\n";

if ($failed > 0) {
    exit(1);
}

exit(0);
