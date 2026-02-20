<?php

function getCspHashes(string $filepath): void
{
    if (!file_exists($filepath)) {
        echo "File not found: $filepath\n";
        return;
    }

    $html = file_get_contents($filepath);

    // Find style blocks
    preg_match_all('/<style[^>]*>(.*?)<\/style>/si', $html, $matches);

    echo "Hashes for $filepath (Styles):\n";
    foreach ($matches[1] as $styleContent) {
        $hash = base64_encode(hash('sha256', $styleContent, true));
        echo "'sha256-$hash' ";
    }
    echo "\n\n";

    // Find script blocks (excluding src attributes)
    preg_match_all('/<script(?![^>]*src=)[^>]*>(.*?)<\/script>/si', $html, $matches);

    echo "Hashes for $filepath (Scripts - Inline only):\n";
    foreach ($matches[1] as $scriptContent) {
        // Skip empty scripts or whitespace only
        if (trim($scriptContent) === '') continue;

        // Skip application/ld+json as it doesn't need CSP hash usually (browsers ignore it for execution)
        // But let's check if the tag has type="application/ld+json"
        // This regex is simple, so we might need to check the full tag match in $matches[0]

        $hash = base64_encode(hash('sha256', $scriptContent, true));
        echo "'sha256-$hash' ";
    }
    echo "\n--------------------------------------------------\n";
}

getCspHashes('index.html');
getCspHashes('telemedicina.html');
getCspHashes('admin.html');
