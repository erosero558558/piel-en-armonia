<?php

// bin/verify-gate.php

$domain = 'https://pielarmonia.com';
$checks = [];
$failures = 0;
$diagnosticsToken = trim((string) (getenv('PIELARMONIA_DIAGNOSTICS_ACCESS_TOKEN') ?: getenv('PIELARMONIA_CRON_SECRET') ?: ''));
$repoRoot = realpath(__DIR__ . '/..');
$generatedSiteRoot = $repoRoot ? ($repoRoot . DIRECTORY_SEPARATOR . '.generated' . DIRECTORY_SEPARATOR . 'site-root') : '';

function check($name, $callback)
{
    global $checks, $failures;
    echo "Checking $name... ";
    try {
        $result = $callback();
        if ($result === true) {
            echo "\033[32mOK\033[0m\n"; // Green OK
            $checks[$name] = 'OK';
        } else {
            echo "\033[31mFAIL\033[0m\n"; // Red FAIL
            $checks[$name] = 'FAIL';
            $failures++;
        }
    } catch (Exception $e) {
        echo "\033[31mERROR: " . $e->getMessage() . "\033[0m\n";
        $checks[$name] = 'ERROR';
        $failures++;
    }
}

function diagnostics_headers(): array
{
    global $diagnosticsToken;

    $headers = [
        'User-Agent: PielArmoniaGateCheck/1.0',
    ];

    if ($diagnosticsToken === '') {
        return $headers;
    }

    $headerName = trim((string) (getenv('PIELARMONIA_DIAGNOSTICS_ACCESS_TOKEN_HEADER') ?: 'Authorization'));
    $prefix = trim((string) (getenv('PIELARMONIA_DIAGNOSTICS_ACCESS_TOKEN_PREFIX') ?: 'Bearer'));
    $headerValue = $prefix !== '' ? ($prefix . ' ' . $diagnosticsToken) : $diagnosticsToken;
    $headers[] = $headerName . ': ' . $headerValue;

    return $headers;
}

function fetch($url, array $headers = [])
{
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    if ($headers === []) {
        curl_setopt($ch, CURLOPT_USERAGENT, 'PielArmoniaGateCheck/1.0');
    } else {
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    }
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        throw new Exception("Curl error: $error");
    }

    return ['code' => $httpCode, 'body' => $response];
}

function fetchHeaders($url, array $headers = [])
{
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, true);
    curl_setopt($ch, CURLOPT_NOBODY, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    if ($headers === []) {
        curl_setopt($ch, CURLOPT_USERAGENT, 'PielArmoniaGateCheck/1.0');
    } else {
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    }
    $response = curl_exec($ch);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $headers = substr($response, 0, $headerSize);
    curl_close($ch);
    return $headers;
}

function normalize_content(string $content): string
{
    return str_replace(["\r\n", "\r"], "\n", $content);
}

function build_asset_url(string $domain, string $assetRef): string
{
    if (preg_match('/^https?:\/\//i', $assetRef)) {
        return $assetRef;
    }

    return $domain . '/' . ltrim($assetRef, '/');
}

function resolve_local_asset_path(array $candidates): ?string
{
    foreach ($candidates as $candidate) {
        if (is_string($candidate) && $candidate !== '' && file_exists($candidate)) {
            return $candidate;
        }
    }

    return null;
}

function detect_local_asset_candidates(string $assetRef): array
{
    global $repoRoot, $generatedSiteRoot;

    $assetPath = parse_url($assetRef, PHP_URL_PATH);
    if (!is_string($assetPath) || $assetPath === '') {
        $assetPath = $assetRef;
    }

    $relative = ltrim($assetPath, '/');
    $relativeFs = str_replace('/', DIRECTORY_SEPARATOR, $relative);
    $stagePath = $generatedSiteRoot !== '' ? ($generatedSiteRoot . DIRECTORY_SEPARATOR . $relativeFs) : '';
    $repoPath = $repoRoot ? ($repoRoot . DIRECTORY_SEPARATOR . $relativeFs) : $relativeFs;

    if (preg_match('/^script\.js$/i', $relative)) {
        return array_values(array_filter([
            $generatedSiteRoot !== '' ? ($generatedSiteRoot . DIRECTORY_SEPARATOR . 'script.js') : '',
            $repoRoot ? ($repoRoot . DIRECTORY_SEPARATOR . 'script.js') : '',
        ]));
    }

    if (preg_match('/^js\/public-v6-shell\.js$/i', $relative)) {
        return array_values(array_filter([
            $repoRoot ? ($repoRoot . DIRECTORY_SEPARATOR . 'js' . DIRECTORY_SEPARATOR . 'public-v6-shell.js') : '',
            $generatedSiteRoot !== '' ? ($generatedSiteRoot . DIRECTORY_SEPARATOR . 'js' . DIRECTORY_SEPARATOR . 'public-v6-shell.js') : '',
        ]));
    }

    if (preg_match('/^styles\.css$/i', $relative)) {
        return array_values(array_filter([
            $repoRoot ? ($repoRoot . DIRECTORY_SEPARATOR . 'styles.css') : '',
            $stagePath,
        ]));
    }

    if (preg_match('/^_astro\/.+\.css$/i', $relative)) {
        return array_values(array_filter([
            $stagePath,
            $repoPath,
        ]));
    }

    return array_values(array_filter([
        $stagePath,
        $repoPath,
    ]));
}

function check_asset_hash(string $label, string $assetUrl, array $localCandidates): void
{
    check($label, function () use ($assetUrl, $localCandidates) {
        $localPath = resolve_local_asset_path($localCandidates);
        if ($localPath === null) {
            echo " (Local file missing: " . implode(' | ', $localCandidates) . ') ';
            return false;
        }

        $localHash = hash('sha256', normalize_content((string) file_get_contents($localPath)));
        $res = fetch($assetUrl);
        if ($res['code'] !== 200) {
            echo " (Remote fetch failed: HTTP " . $res['code'] . ') ';
            return false;
        }

        $remoteHash = hash('sha256', normalize_content((string) $res['body']));
        if ($localHash !== $remoteHash) {
            echo " (Hash mismatch. Local: " . substr($localHash, 0, 8) . ", Remote: " . substr($remoteHash, 0, 8) . ') ';
            return false;
        }

        return true;
    });
}

echo "== Verifying Gate: Prod Strict ==\n";
echo "Domain: $domain\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n\n";

// 1. Check Homepage
check('Homepage (200 OK)', function () use ($domain) {
    $res = fetch($domain . '/');
    return $res['code'] === 200;
});

// 2. Check Security Headers
check('Security Headers', function () use ($domain) {
    $headers = fetchHeaders($domain . '/');
    $required = ['Content-Security-Policy', 'X-Content-Type-Options', 'Referrer-Policy'];
    foreach ($required as $h) {
        if (stripos($headers, $h) === false) {
            // Fallback: check for meta tag in body if header missing
            $res = fetch($domain . '/');
            if (stripos($res['body'], "http-equiv=\"$h\"") !== false || stripos($res['body'], "http-equiv='$h'") !== false) {
                continue;
            }
            echo " (Missing $h) ";
            return false;
        }
    }
    return true;
});

// 3. Check Health API
check('Health API (200 OK & JSON)', function () use ($domain) {
    global $diagnosticsToken;
    $resource = $diagnosticsToken !== '' ? 'health-diagnostics' : 'health';
    $res = fetch($domain . '/api.php?resource=' . $resource, diagnostics_headers());
    if ($res['code'] !== 200) {
        echo " (HTTP " . $res['code'] . ") ";
        return false;
    }
    $json = json_decode($res['body'], true);
    if (!$json) {
        echo " (Invalid JSON) ";
        return false;
    }

    $requiredFields = ['timingMs', 'version', 'dataDirWritable'];
    if ($resource === 'health-diagnostics') {
        $requiredFields = array_merge($requiredFields, [
            'storeEncrypted',
            'storeEncryptionConfigured',
            'storeEncryptionRequired',
            'storeEncryptionStatus',
            'storeEncryptionCompliant',
            'checks',
        ]);
    }
    foreach ($requiredFields as $f) {
        if (!isset($json[$f])) {
            echo " (Missing field: $f) ";
            return false;
        }
    }

    if ($resource === 'health-diagnostics' && !isset($json['checks']['backup']['ok'])) {
        echo " (Backup check missing) ";
        return false;
    }

    return true;
});

// 4. Check Figo Chat
check('Figo Chat (200 OK)', function () use ($domain) {
    $res = fetch($domain . '/figo-chat.php');
    if ($res['code'] !== 200) {
        return false;
    }
    $json = json_decode($res['body'], true);
    return isset($json['mode']);
});

// 5. Check Assets (Hash Match)
// We need to find the assets referenced in the remote index.html
$indexRes = fetch($domain . '/');
if ($indexRes['code'] === 200) {
    $remoteIndex = $indexRes['body'];

    if (preg_match('/<script[^>]+src="([^"]*(?:script\.js|public-v6-shell\.js)[^"]*)"/', $remoteIndex, $matches)) {
        $scriptRef = $matches[1];
        $scriptUrl = build_asset_url($domain, $scriptRef);
        $scriptPath = parse_url($scriptRef, PHP_URL_PATH);
        $scriptLabel = $scriptPath ? basename($scriptPath) : 'app-script';

        check_asset_hash(
            'Asset Hash: ' . $scriptLabel,
            $scriptUrl,
            detect_local_asset_candidates($scriptRef)
        );
    } else {
        echo "WARNING: app script not found in remote index.html\n";
    }

    if (preg_match('/<link[^>]+href="([^"]*(?:styles\.css|_astro\/[^"]+\.css)[^"]*)"/', $remoteIndex, $matches)) {
        $styleRef = $matches[1];
        $styleUrl = build_asset_url($domain, $styleRef);
        $stylePath = parse_url($styleRef, PHP_URL_PATH);
        $styleLabel = $stylePath ? basename($stylePath) : 'app-style';

        check_asset_hash(
            'Asset Hash: ' . $styleLabel,
            $styleUrl,
            detect_local_asset_candidates($styleRef)
        );
    } else {
        echo "WARNING: app stylesheet not found in remote index.html\n";
    }
}

if ($failures > 0) {
    echo "\n\033[31mGate Verification FAILED with $failures errors.\033[0m\n";
    exit(1);
} else {
    echo "\n\033[32mGate Verification PASSED.\033[0m\n";
    exit(0);
}
