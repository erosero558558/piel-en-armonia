<?php

// tests/test_manifest.php

echo "Testing Manifest existence and validity...\n";

$manifestPath = __DIR__ . '/../manifest.json';

if (!file_exists($manifestPath)) {
    echo "FAILED: manifest.json not found.\n";
    exit(1);
}

$content = file_get_contents($manifestPath);
$json = json_decode($content, true);

if ($json === null) {
    echo "FAILED: manifest.json is not valid JSON.\n";
    exit(1);
}

if (!isset($json['name']) || strpos($json['name'], 'Aurora Derm') === false) {
    echo "FAILED: manifest.json 'name' is incorrect.\n";
    exit(1);
}

if (($json['start_url'] ?? null) !== '/es/portal/') {
    echo "FAILED: manifest.json 'start_url' must point to /es/portal/.\n";
    exit(1);
}

if (($json['display'] ?? null) !== 'standalone') {
    echo "FAILED: manifest.json 'display' must be standalone.\n";
    exit(1);
}

$icons = $json['icons'] ?? [];
$has512 = false;
foreach ($icons as $icon) {
    if (($icon['src'] ?? '') === '/images/icon-512.png' && ($icon['sizes'] ?? '') === '512x512') {
        $has512 = true;
        break;
    }
}

if (!$has512) {
    echo "FAILED: manifest.json 512x512 icon missing.\n";
    exit(1);
}

$iconPath = __DIR__ . '/../images/icon-512.png';
if (!file_exists($iconPath)) {
    echo "FAILED: images/icon-512.png not found.\n";
    exit(1);
}

$iconMeta = @getimagesize($iconPath);
if (!$iconMeta || (int) ($iconMeta[0] ?? 0) !== 512 || (int) ($iconMeta[1] ?? 0) !== 512) {
    echo "FAILED: images/icon-512.png is not 512x512.\n";
    exit(1);
}

echo "PASSED: Manifest is valid.\n";
exit(0);
