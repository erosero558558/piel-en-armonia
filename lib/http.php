<?php
declare(strict_types=1);

/**
 * HTTP helper functions.
 */

function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit();
}

function is_https_request(): bool
{
    if (isset($_SERVER['HTTPS'])) {
        $https = strtolower((string) $_SERVER['HTTPS']);
        if ($https === 'on' || $https === '1') {
            return true;
        }
    }

    if (isset($_SERVER['SERVER_PORT']) && (string) $_SERVER['SERVER_PORT'] === '443') {
        return true;
    }

    if (isset($_SERVER['HTTP_X_FORWARDED_PROTO'])) {
        return strtolower((string) $_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https';
    }

    return false;
}

function require_json_body(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?? '', true);
    if (!is_array($data)) {
        json_response([
            'ok' => false,
            'error' => 'El JSON enviado no es válido'
        ], 400);
    }
    return $data;
}

function generate_csrf_token(): string
{
    if (!isset($_SESSION['csrf_token']) || $_SESSION['csrf_token'] === '') {
        try {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        } catch (Throwable $e) {
            $_SESSION['csrf_token'] = bin2hex((string) microtime(true) . (string) mt_rand());
        }
    }
    return $_SESSION['csrf_token'];
}

function verify_csrf_token(): bool
{
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if ($token === '' || !isset($_SESSION['csrf_token']) || $_SESSION['csrf_token'] === '') {
        return false;
    }
    return hash_equals($_SESSION['csrf_token'], (string) $token);
}

function require_csrf(): void
{
    if (!verify_csrf_token()) {
        json_response([
            'ok' => false,
            'error' => 'Token CSRF inválido o ausente'
        ], 403);
    }
}
