<?php

declare(strict_types=1);

final class FigoSanitizer
{
    public static function FigoSanitizer::api_strip_utf8_bom(string $raw): string
    {
        if (strncmp($raw, "\xEF\xBB\xBF", 3) === 0) {
            return substr($raw, 3);
        }
    
        return $raw;
    }

    public static function FigoSanitizer::api_mask_secret_value(string $value): string
    {
        $value = trim($value);
        if ($value === '') {
            return '';
        }
    
        $length = strlen($value);
        if ($length <= 10) {
            return str_repeat('*', $length);
        }
    
        return substr($value, 0, 6) . str_repeat('*', max(4, $length - 10)) . substr($value, -4);
    }

    public static function FigoSanitizer::api_mask_figo_config(array $config): array
    {
        $masked = [];
        foreach ($config as $key => $value) {
            if (is_array($value)) {
                $masked[$key] = FigoSanitizer::api_mask_figo_config($value);
                continue;
            }
    
            if (!is_string($value)) {
                $masked[$key] = $value;
                continue;
            }
    
            $lowerKey = strtolower((string) $key);
            $isSensitive = false;
            if (
                strpos($lowerKey, 'token') !== false
                || strpos($lowerKey, 'secret') !== false
                || strpos($lowerKey, 'password') !== false
                || strpos($lowerKey, 'apikey') !== false
            ) {
                $isSensitive = true;
            }
    
            if (
                $lowerKey === 'apikeyheader'
                || $lowerKey === 'apikeyprefix'
                || $lowerKey === 'openclawgatewaykeyheader'
                || $lowerKey === 'openclawgatewaykeyprefix'
            ) {
                $isSensitive = false;
            }
    
            $masked[$key] = $isSensitive
                ? FigoSanitizer::api_mask_secret_value($value)
                : $value;
        }
    
        return $masked;
    }

    public static function FigoSanitizer::api_parse_optional_bool($raw): ?bool
    {
        if (is_bool($raw)) {
            return $raw;
        }
    
        if (!is_string($raw) && !is_int($raw)) {
            return null;
        }
    
        $value = strtolower(trim((string) $raw));
        if (in_array($value, ['1', 'true', 'yes', 'on'], true)) {
            return true;
        }
    
        if (in_array($value, ['0', 'false', 'no', 'off'], true)) {
            return false;
        }
    
        return null;
    }

    public static function FigoSanitizer::api_validate_absolute_http_url(string $url, string $field): void
    {
        $url = trim($url);
        if ($url === '') {
            return;
        }
    
        $parts = @parse_url($url);
        if (!is_array($parts)) {
            throw new RuntimeException($field . ' no es una URL valida', 400);
        }
    
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower((string) ($parts['host'] ?? ''));
        if (!in_array($scheme, ['http', 'https'], true) || $host === '') {
            throw new RuntimeException($field . ' debe ser una URL absoluta http(s)', 400);
        }
    }

    public static function FigoSanitizer::api_first_non_empty(array $values): string
    {
        foreach ($values as $value) {
            if (is_string($value) && trim($value) !== '') {
                return trim($value);
            }
        }
        return '';
    }

    public static function FigoSanitizer::api_parse_bool($raw, bool $default = false): bool
    {
        $parsed = FigoSanitizer::api_parse_optional_bool($raw);
        return $parsed !== null ? $parsed : $default;
    }

}
