<?php

declare(strict_types=1);

if (PHP_SAPI === 'cli') {
    return;
}

$repoRoot = realpath(__DIR__ . '/..');
$stageRoot = $repoRoot . DIRECTORY_SEPARATOR . '.generated' . DIRECTORY_SEPARATOR . 'site-root';
$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$requestPath = is_string($requestPath) ? $requestPath : '/';
$normalizedPath = ltrim(str_replace('\\', '/', $requestPath), '/');

function resolveStageCandidate(string $stageRoot, string $normalizedPath)
{
    if (!is_dir($stageRoot)) {
        return false;
    }

    $stageRealRoot = realpath($stageRoot);
    if ($stageRealRoot === false) {
        return false;
    }

    $stageCandidate = realpath($stageRoot . DIRECTORY_SEPARATOR . $normalizedPath);
    if ($stageCandidate === false || !str_starts_with($stageCandidate, $stageRealRoot)) {
        $stageCandidate = false;
    }

    if ($stageCandidate !== false && is_dir($stageCandidate)) {
        $stageIndex = $stageCandidate . DIRECTORY_SEPARATOR . 'index.html';
        if (is_file($stageIndex)) {
            $stageCandidate = $stageIndex;
        }
    }

    if ($stageCandidate === false && ($normalizedPath === '' || str_ends_with($normalizedPath, '/'))) {
        $fallbackIndex = $stageRoot . DIRECTORY_SEPARATOR . $normalizedPath . 'index.html';
        if (is_file($fallbackIndex)) {
            $stageCandidate = $fallbackIndex;
        }
    }

    return ($stageCandidate !== false && is_file($stageCandidate))
        ? $stageCandidate
        : false;
}

function isGeneratedStagePath(string $normalizedPath): bool
{
    $path = trim($normalizedPath, '/');

    if ($path === '') {
        return false;
    }

    $generatedDirectories = [
        'es',
        'en',
        '_astro',
        'js/chunks',
        'js/engines',
        'js/admin-chunks',
    ];
    foreach ($generatedDirectories as $prefix) {
        if ($path === $prefix || str_starts_with($path, $prefix . '/')) {
            return true;
        }
    }

    return in_array($path, [
        'script.js',
        'admin.js',
        'js/booking-calendar.js',
        'js/queue-kiosk.js',
        'js/queue-display.js',
    ], true);
}

$stageCandidate = resolveStageCandidate($stageRoot, $normalizedPath);
if ($stageCandidate !== false && isGeneratedStagePath($normalizedPath)) {
    $extension = strtolower(pathinfo($stageCandidate, PATHINFO_EXTENSION));
    $contentTypes = [
        'avif' => 'image/avif',
        'css' => 'text/css; charset=UTF-8',
        'html' => 'text/html; charset=UTF-8',
        'ico' => 'image/x-icon',
        'jpeg' => 'image/jpeg',
        'jpg' => 'image/jpeg',
        'js' => 'application/javascript; charset=UTF-8',
        'json' => 'application/json; charset=UTF-8',
        'png' => 'image/png',
        'svg' => 'image/svg+xml',
        'txt' => 'text/plain; charset=UTF-8',
        'webp' => 'image/webp',
        'woff' => 'font/woff',
        'woff2' => 'font/woff2',
        'xml' => 'application/xml; charset=UTF-8',
    ];

    header('Content-Type: ' . ($contentTypes[$extension] ?? 'application/octet-stream'));
    header('Cache-Control: no-store');
    readfile($stageCandidate);
    exit;
}

$repoCandidate = realpath($repoRoot . DIRECTORY_SEPARATOR . $normalizedPath);
if ($repoCandidate !== false && str_starts_with($repoCandidate, $repoRoot)) {
    if (is_file($repoCandidate)) {
        return false;
    }

    if (is_dir($repoCandidate)) {
        $repoIndex = $repoCandidate . DIRECTORY_SEPARATOR . 'index.html';
        if (is_file($repoIndex)) {
            return false;
        }
    }
}

if ($stageCandidate === false || !is_file($stageCandidate)) {
    return false;
}

$extension = strtolower(pathinfo($stageCandidate, PATHINFO_EXTENSION));
$contentTypes = [
    'avif' => 'image/avif',
    'css' => 'text/css; charset=UTF-8',
    'html' => 'text/html; charset=UTF-8',
    'ico' => 'image/x-icon',
    'jpeg' => 'image/jpeg',
    'jpg' => 'image/jpeg',
    'js' => 'application/javascript; charset=UTF-8',
    'json' => 'application/json; charset=UTF-8',
    'png' => 'image/png',
    'svg' => 'image/svg+xml',
    'txt' => 'text/plain; charset=UTF-8',
    'webp' => 'image/webp',
    'woff' => 'font/woff',
    'woff2' => 'font/woff2',
    'xml' => 'application/xml; charset=UTF-8',
];

header('Content-Type: ' . ($contentTypes[$extension] ?? 'application/octet-stream'));
header('Cache-Control: no-store');
readfile($stageCandidate);
exit;
