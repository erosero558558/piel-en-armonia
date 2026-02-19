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

readfile($indexPath);
