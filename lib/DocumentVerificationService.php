<?php

declare(strict_types=1);

require_once __DIR__ . '/common.php';

final class DocumentVerificationService
{
    private const AUDIENCE = 'document_verify';

    public static function tokenForDocument(string $type, string $documentId): string
    {
        $type = self::normalizeType($type);
        $documentId = trim($documentId);
        if ($type === '' || $documentId === '') {
            return '';
        }

        return self::encodeToken([
            'aud' => self::AUDIENCE,
            'type' => $type,
            'id' => $documentId,
            'iat' => time(),
        ]);
    }

    public static function decodeToken(string $token): array
    {
        $secret = self::secret();
        if ($secret === '') {
            return [];
        }

        $parts = explode('.', trim($token));
        if (count($parts) !== 3) {
            return [];
        }

        [$encodedHeader, $encodedPayload, $encodedSignature] = $parts;
        $expectedSignature = self::base64UrlEncode(
            hash_hmac('sha256', $encodedHeader . '.' . $encodedPayload, $secret, true)
        );
        if (!hash_equals($expectedSignature, $encodedSignature)) {
            return [];
        }

        $header = json_decode(self::base64UrlDecode($encodedHeader), true);
        $payload = json_decode(self::base64UrlDecode($encodedPayload), true);
        if (!is_array($header) || !is_array($payload)) {
            return [];
        }

        if (($header['alg'] ?? '') !== 'HS256' || ($header['typ'] ?? '') !== 'JWT') {
            return [];
        }

        if (($payload['aud'] ?? '') !== self::AUDIENCE) {
            return [];
        }

        $type = self::normalizeType((string) ($payload['type'] ?? ''));
        $documentId = trim((string) ($payload['id'] ?? ''));
        if ($type === '' || $documentId === '') {
            return [];
        }

        return [
            'type' => $type,
            'id' => $documentId,
            'iat' => (int) ($payload['iat'] ?? 0),
        ];
    }

    public static function apiVerificationUrlForDocument(string $type, string $documentId): string
    {
        $token = self::tokenForDocument($type, $documentId);
        return self::apiVerificationUrlForToken($token);
    }

    public static function apiVerificationUrlForToken(string $token): string
    {
        $token = trim($token);
        if ($token === '') {
            return '';
        }

        return app_api_absolute_url('document-verify', ['token' => $token]);
    }

    public static function verificationPageUrlForDocument(string $type, string $documentId): string
    {
        $token = self::tokenForDocument($type, $documentId);
        return self::verificationPageUrlForToken($token);
    }

    public static function verificationPageUrlForToken(string $token): string
    {
        $token = trim($token);
        if ($token === '') {
            return '';
        }

        return self::apiVerificationUrlForToken($token);
    }

    public static function qrImageUrlForDocument(string $type, string $documentId, int $size = 220): string
    {
        $target = self::verificationPageUrlForDocument($type, $documentId);
        return self::qrImageUrlForTarget($target, $size);
    }

    public static function qrImageUrlForTarget(string $target, int $size = 220): string
    {
        $target = trim($target);
        if ($target === '') {
            return '';
        }

        $normalizedSize = max(120, min(640, $size));
        return 'https://api.qrserver.com/v1/create-qr-code/?size='
            . $normalizedSize
            . 'x'
            . $normalizedSize
            . '&data='
            . rawurlencode($target);
    }

    public static function verificationCode(string $documentId): string
    {
        $documentId = strtoupper(trim($documentId));
        if ($documentId === '') {
            return '';
        }

        return preg_replace('/[^A-Z0-9]+/', '-', $documentId) ?? $documentId;
    }

    private static function encodeToken(array $payload): string
    {
        $secret = self::secret();
        if ($secret === '') {
            return '';
        }

        $header = self::base64UrlEncode((string) json_encode([
            'alg' => 'HS256',
            'typ' => 'JWT',
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        $encodedPayload = self::base64UrlEncode(
            (string) json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
        );
        $signature = self::base64UrlEncode(hash_hmac('sha256', $header . '.' . $encodedPayload, $secret, true));

        return $header . '.' . $encodedPayload . '.' . $signature;
    }

    private static function normalizeType(string $type): string
    {
        $type = strtolower(trim($type));
        return in_array($type, ['prescription', 'certificate'], true) ? $type : '';
    }

    private static function secret(): string
    {
        $candidates = [
            app_env('AURORADERM_PATIENT_PORTAL_JWT_SECRET', ''),
            app_env('PIELARMONIA_PATIENT_PORTAL_JWT_SECRET', ''),
        ];

        foreach ($candidates as $candidate) {
            $secret = self::normalizeSecret((string) $candidate);
            if ($secret !== '') {
                return $secret;
            }
        }

        $derived = function_exists('data_encryption_key') ? data_encryption_key() : '';
        if (is_string($derived) && $derived !== '') {
            return hash('sha256', $derived . '|document-verify', true);
        }

        if (defined('TESTING_ENV')) {
            return hash('sha256', data_dir_path() . '|document-verify-dev', true);
        }

        return '';
    }

    private static function normalizeSecret(string $value): string
    {
        $value = trim($value);
        if ($value === '') {
            return '';
        }

        if (str_starts_with($value, 'base64:')) {
            $decoded = base64_decode(substr($value, 7), true);
            if (is_string($decoded) && $decoded !== '') {
                $value = $decoded;
            }
        }

        return strlen($value) === 32 ? $value : hash('sha256', $value, true);
    }

    private static function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $value): string
    {
        $padding = strlen($value) % 4;
        if ($padding > 0) {
            $value .= str_repeat('=', 4 - $padding);
        }

        $decoded = base64_decode(strtr($value, '-_', '+/'), true);
        return is_string($decoded) ? $decoded : '';
    }
}
