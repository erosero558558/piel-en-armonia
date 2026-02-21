<?php

declare(strict_types=1);

function captcha_verify_token(string $token): bool
{
    $secret = getenv('PIELARMONIA_RECAPTCHA_SECRET');

    // Si no hay secreto configurado, asumimos entorno de desarrollo o que no se requiere CAPTCHA
    if (!$secret || trim($secret) === '') {
        return true;
    }

    if (trim($token) === '') {
        return false;
    }

    $url = 'https://www.google.com/recaptcha/api/siteverify';
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
            error_log('CAPTCHA verification failed to connect to Google API.');
            return false;
        }

        $json = json_decode($result, true);

        $success = isset($json['success']) && $json['success'] === true;
        if (!$success) {
            error_log('CAPTCHA verification failed: ' . json_encode($json));
        }

        // Para reCAPTCHA v3, tambien deberiamos verificar el score y la accion
        // pero por ahora solo verificamos que el token sea valido.

        return $success;
    } catch (Throwable $e) {
        error_log('CAPTCHA exception: ' . $e->getMessage());
        return false;
    }
}
