<?php
declare(strict_types=1);

function captcha_enabled(): bool
{
    $secret = getenv('PIELARMONIA_RECAPTCHA_SECRET');
    return is_string($secret) && $secret !== '';
}

function verify_captcha(string $token, string $action): bool
{
    if (!captcha_enabled()) {
        return true;
    }

    $secret = getenv('PIELARMONIA_RECAPTCHA_SECRET');
    $url = 'https://www.google.com/recaptcha/api/siteverify';
    $data = [
        'secret' => $secret,
        'response' => $token
    ];

    $options = [
        'http' => [
            'header'  => "Content-type: application/x-www-form-urlencoded\r\n",
            'method'  => 'POST',
            'content' => http_build_query($data)
        ]
    ];

    $context  = stream_context_create($options);
    $result = @file_get_contents($url, false, $context);

    if ($result === false) {
        error_log('Piel en Armonía CAPTCHA verification failed: connection error');
        return false;
    }

    $response = json_decode($result, true);
    if (!is_array($response)) {
        error_log('Piel en Armonía CAPTCHA verification failed: invalid JSON');
        return false;
    }

    $success = ($response['success'] ?? false) === true;
    $score = ($response['score'] ?? 0.0);
    $action_match = ($response['action'] ?? '') === $action;

    if (!$success || $score < 0.5 || !$action_match) {
        error_log('Piel en Armonía CAPTCHA rejected: success=' . ($success ? 'true' : 'false') . ' score=' . $score . ' action=' . ($response['action'] ?? 'none'));
        return false;
    }

    return true;
}
