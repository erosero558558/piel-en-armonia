<?php
declare(strict_types=1);

require_once __DIR__ . '/api-lib.php';

if (!headers_sent()) {
    header('Content-Type: text/html; charset=UTF-8');
    apply_security_headers(true);
}

$indexPath = __DIR__ . DIRECTORY_SEPARATOR . 'index.html';
if (!is_file($indexPath)) {
    http_response_code(500);
    echo 'index.html no disponible';
    exit;
}

$indexHtml = @file_get_contents($indexPath);
if (!is_string($indexHtml) || $indexHtml === '') {
    http_response_code(500);
    echo 'No se pudo cargar index.html';
    exit;
}

$assetVersion = rawurlencode(app_runtime_version());
$bootstrapScriptUrl = 'bootstrap-inline-engine.js?v=' . $assetVersion;
$bootstrapScriptTag = '<script src="' . $bootstrapScriptUrl . '" defer></script>';

// Elimina bootstrap inline legado para reducir superficie CSP.
$inlineBootstrapPattern = '#<script>\s*const\s+DEFERRED_STYLESHEET_URL[\s\S]*?</script>#i';
$indexHtml = (string) preg_replace($inlineBootstrapPattern, '', $indexHtml, 1);

// Remueve tags bootstrap existentes para evitar duplicados y cache stale.
$bootstrapTagPattern = '#\s*<script[^>]+src=["\']bootstrap-inline-engine\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>#i';
$indexHtml = (string) preg_replace($bootstrapTagPattern, '', $indexHtml);

// Fuerza versionado del bundle principal para invalidar cache en cada deploy.
$mainScriptPattern = '#<script([^>]+src=["\'])script\.js(?:\?[^"\']*)?(["\'][^>]*)></script>#i';
$mainScriptReplacement = '<script$1script.js?v=' . $assetVersion . '$2></script>';
$indexHtml = (string) preg_replace($mainScriptPattern, $mainScriptReplacement, $indexHtml, 1);

// Inyecta bootstrap antes del script principal (idempotente tras limpieza).
$mainScriptInsertPattern = '#<script[^>]+src=["\']script\.js(?:\?[^"\']*)?["\'][^>]*></script>#i';
$mainScriptInsertCount = 0;
$indexHtml = (string) preg_replace(
    $mainScriptInsertPattern,
    $bootstrapScriptTag . "\n    \$0",
    $indexHtml,
    1,
    $mainScriptInsertCount
);

if ($mainScriptInsertCount === 0) {
    $indexHtml = (string) preg_replace(
        '#</body>#i',
        '    ' . $bootstrapScriptTag . "\n</body>",
        $indexHtml,
        1
    );
}

// Prepare HTTP/2 Server Push (Preload) headers
$preloadLinks = [];

// 1. Critical CSS (styles.css) - Extract from HTML to get version
if (preg_match('/href=["\'](styles\.css[^"\']*)["\']/i', $indexHtml, $matches)) {
    $preloadLinks[] = "<{$matches[1]}>; rel=preload; as=style";
}

// 2. Critical Image (hero-woman.jpg) - LCP
$preloadLinks[] = "<hero-woman.jpg>; rel=preload; as=image";

// 3. Critical JS (bootstrap-inline-engine.js) - Versioned
$preloadLinks[] = "<{$bootstrapScriptUrl}>; rel=preload; as=script";

// 4. Main JS (script.js) - Versioned
$preloadLinks[] = "<script.js?v={$assetVersion}>; rel=preload; as=script";

if (!empty($preloadLinks)) {
    header('Link: ' . implode(', ', $preloadLinks), false);
}

echo $indexHtml;
