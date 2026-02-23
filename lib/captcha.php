<?php

declare(strict_types=1);

function captcha_get_provider(): ?string
{
    $turnstileSecret = getenv('PIELARMONIA_TURNSTILE_SECRET_KEY');
    if (is_string($turnstileSecret) && trim($turnstileSecret) !== '') {
        return 'turnstile';
    }

    $recaptchaSecret = getenv('PIELARMONIA_RECAPTCHA_SECRET');
    if (is_string($recaptchaSecret) && trim($recaptchaSecret) !== '') {
        return 'recaptcha';
    }

    return null;
}

function captcha_get_site_key(): ?string
{
    $provider = captcha_get_provider();
    if ($provider === 'turnstile') {
        return getenv('PIELARMONIA_TURNSTILE_SITE_KEY') ?: null;
    }
    if ($provider === 'recaptcha') {
        return getenv('PIELARMONIA_RECAPTCHA_SITE_KEY') ?: null;
    }
    return null;
}

function captcha_get_script_url(): ?string
{
    $provider = captcha_get_provider();
    if ($provider === 'turnstile') {
        return 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    }
    if ($provider === 'recaptcha') {
        $key = captcha_get_site_key();
        return 'https://www.google.com/recaptcha/api.js?render=' . urlencode($key ?? '');
    }
    return null;
}

function captcha_verify_token(string $token): bool
{
    $provider = captcha_get_provider();

    // Si no hay provider configurado, asumimos entorno de desarrollo o que no se requiere CAPTCHA
    if ($provider === null) {
        return true;
    }

    if (trim($token) === '') {
        return false;
    }

    $secret = '';
    $url = '';

    if ($provider === 'turnstile') {
        $secret = getenv('PIELARMONIA_TURNSTILE_SECRET_KEY');
        $url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    } elseif ($provider === 'recaptcha') {
        $secret = getenv('PIELARMONIA_RECAPTCHA_SECRET');
        $url = 'https://www.google.com/recaptcha/api/siteverify';
    }

    if (!$secret) {
        return true; // Should not happen given get_provider check
    }

    $data = [
        'secret' => $secret,
        'response' => $token,
        'remoteip' => $_SERVER['REMOTE_ADDR'] ?? ''
    ];

    $options = [
        'http' => [
            'header'  => "Content-type: application/x-www-form-urlencoded\r\n",
            'method'  => 'POST',
            'content' => http_build_query($data),
            'timeout' => 5
        ]
    ];

    try {
        $context  = stream_context_create($options);
        $result = @file_get_contents($url, false, $context);

        if ($result === false) {
            error_log('CAPTCHA verification failed to connect to provider API: ' . $provider);
            // Fail open on connection error? Or closed? Usually closed for security.
            // But for availability, maybe open?
            // Let's stick to false for now as per original code.
            return false;
        }

        $json = json_decode($result, true);

        $success = isset($json['success']) && $json['success'] === true;
        if (!$success) {
            error_log('CAPTCHA verification failed (' . $provider . '): ' . json_encode($json));
        }

        // Para reCAPTCHA v3/Turnstile, tambien podriamos verificar score/action si fuera necesario.

        return $success;
    } catch (Throwable $e) {
        error_log('CAPTCHA exception: ' . $e->getMessage());
        return false;
    }
}
