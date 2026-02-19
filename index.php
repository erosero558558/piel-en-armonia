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

$bootstrapScriptUrl = 'bootstrap-inline-engine.js?v=ui-20260219-csp-inline-bootstrap1';
$bootstrapScriptTag = '<script src="' . $bootstrapScriptUrl . '" defer></script>';

// Reemplaza el bootstrap inline por archivo externo para reducir superficie CSP.
$inlineBootstrapPattern = '#<script>\s*const\s+DEFERRED_STYLESHEET_URL[\s\S]*?</script>#i';
$replaceCount = 0;
$indexHtml = (string) preg_replace($inlineBootstrapPattern, $bootstrapScriptTag, $indexHtml, 1, $replaceCount);

// Si no encontro el bloque inline, asegura la inyeccion antes de script.js (idempotente).
if ($replaceCount === 0 && strpos($indexHtml, $bootstrapScriptUrl) === false) {
    $indexHtml = (string) preg_replace(
        '#<script[^>]+src=["\']script\.js[^>]*></script>#i',
        $bootstrapScriptTag . "\n    \$0",
        $indexHtml,
        1
    );
}

echo $indexHtml;
