<?php
declare(strict_types=1);

if (!headers_sent()) {
    header('Content-Type: text/html; charset=UTF-8');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Content-Security-Policy: default-src \'self\'; base-uri \'self\'; object-src \'none\'; frame-ancestors \'self\'; script-src \'self\' https://js.stripe.com https://cdnjs.cloudflare.com https://www.googletagmanager.com; style-src \'self\' https://fonts.googleapis.com https://cdnjs.cloudflare.com \'unsafe-inline\'; font-src \'self\' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src \'self\' https://images.unsplash.com https://www.google-analytics.com https://*.stripe.com data:; frame-src https://js.stripe.com https://hooks.stripe.com https://www.google.com; connect-src \'self\' https://api.stripe.com https://m.stripe.network https://r.stripe.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com; worker-src \'self\' blob:; form-action \'self\'');
}

$indexPath = __DIR__ . DIRECTORY_SEPARATOR . 'index.html';
if (!is_file($indexPath)) {
    http_response_code(500);
    echo 'index.html no disponible';
    exit;
}

readfile($indexPath);
