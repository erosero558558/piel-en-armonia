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
        $siteKey = getenv('PIELARMONIA_TURNSTILE_SITE_KEY');
        return is_string($siteKey) && trim($siteKey) !== '' ? trim($siteKey) : null;
    }
    if ($provider === 'recaptcha') {
        $siteKey = getenv('PIELARMONIA_RECAPTCHA_SITE_KEY');
        return is_string($siteKey) && trim($siteKey) !== '' ? trim($siteKey) : null;
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
        if (!is_string($key) || trim($key) === '') {
            return null;
        }
        return 'https://www.google.com/recaptcha/api.js?render=' . rawurlencode($key);
    }
    return null;
}

function captcha_verify_token(string $token): bool
{
    $provider = captcha_get_provider();

    // Sin proveedor configurado: modo sin captcha (entorno dev o deshabilitado).
    if ($provider === null) {
        return true;
    }

    if (trim($token) === '') {
        return false;
    }

    $secret = '';
    $url = '';
    if ($provider === 'turnstile') {
        $value = getenv('PIELARMONIA_TURNSTILE_SECRET_KEY');
        $secret = is_string($value) ? trim($value) : '';
        $url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    } elseif ($provider === 'recaptcha') {
        $value = getenv('PIELARMONIA_RECAPTCHA_SECRET');
        $secret = is_string($value) ? trim($value) : '';
        $url = 'https://www.google.com/recaptcha/api/siteverify';
    }

    if ($secret === '' || $url === '') {
        return true;
    }

    $data = [
        'secret' => $secret,
        'response' => $token,
        'remoteip' => $_SERVER['REMOTE_ADDR'] ?? '',
    ];

    $options = [
        'http' => [
            'header'  => "Content-type: application/x-www-form-urlencoded\r\n",
            'method'  => 'POST',
            'content' => http_build_query($data),
            'timeout' => 5,
        ],
    ];

    try {
        $context  = stream_context_create($options);
        $result = @file_get_contents($url, false, $context);

        if ($result === false) {
            error_log('CAPTCHA verification failed to connect to provider API: ' . $provider);
            return false;
        }

        $json = json_decode($result, true);

        $success = isset($json['success']) && $json['success'] === true;
        if (!$success) {
            error_log('CAPTCHA verification failed (' . $provider . '): ' . json_encode($json));
        }

        return $success;
    } catch (Throwable $e) {
        error_log('CAPTCHA exception: ' . $e->getMessage());
        return false;
    }
}
