<?php

declare(strict_types=1);

/**
 * Helper functions for the API.
 */

function api_should_hide_error_message(string $message): bool
{
    $trimmed = trim($message);
    if ($trimmed === '') {
        return true;
    }

    $technicalPatterns = [
        '/call to undefined function/i',
        '/fatal error/i',
        '/uncaught/i',
        '/stack trace/i',
        '/syntax error/i',
        '/on line \d+/i',
        '/ in \\/.+\\.php/i',
        '/mb_strlen/i',
        '/pdoexception/i',
        '/sqlstate/i'
    ];

    foreach ($technicalPatterns as $pattern) {
        if (@preg_match($pattern, $trimmed) === 1) {
            return true;
        }
    }

    return false;
}

function api_error_message_for_client(Throwable $error, int $status): string
{
    $rawMessage = trim((string) $error->getMessage());
    $debugEnabled = parse_bool(getenv('PIELARMONIA_DEBUG_EXCEPTIONS') ?: false);
    if ($debugEnabled && $rawMessage !== '') {
        return $rawMessage;
    }

    $isClientError = $status >= 400 && $status < 500;
    if ($isClientError && $rawMessage !== '' && !api_should_hide_error_message($rawMessage)) {
        return $rawMessage;
    }

    return 'Error interno del servidor';
}

function api_should_audit_public_get(string $resource): bool
{
    $enabled = parse_bool(getenv('PIELARMONIA_AUDIT_PUBLIC_GET') ?: false);
    if ($enabled) {
        return true;
    }

    // Keep high-value GET traces even when broad public GET audit is disabled.
    return in_array($resource, ['health', 'metrics'], true);
}

function api_should_audit_health(): bool
{
    return parse_bool(getenv('PIELARMONIA_AUDIT_HEALTH') ?: false);
}

function api_elapsed_ms(float $startedAt): int
{
    return (int) round((microtime(true) - $startedAt) * 1000);
}
