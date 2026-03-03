<?php

declare(strict_types=1);

final class TelemedicineChannelMapper
{
    public const CHANNEL_PHONE = 'phone';
    public const CHANNEL_SECURE_VIDEO = 'secure_video';

    public static function isTelemedicineService(string $service): bool
    {
        return in_array(strtolower(trim($service)), ['telefono', 'video'], true);
    }

    public static function mapServiceToChannel(string $service): string
    {
        $normalized = strtolower(trim($service));
        if ($normalized === 'telefono') {
            return self::CHANNEL_PHONE;
        }
        if ($normalized === 'video') {
            return self::CHANNEL_SECURE_VIDEO;
        }

        throw new InvalidArgumentException('Unsupported telemedicine service: ' . $service);
    }

    public static function visitMode(string $channel): string
    {
        return $channel === self::CHANNEL_PHONE ? 'phone_call' : 'secure_video_call';
    }

    public static function supportContactMethod(array $payload): string
    {
        $raw = strtolower(trim((string) ($payload['supportContactMethod'] ?? $payload['contactMethod'] ?? '')));
        return $raw === 'whatsapp' ? 'whatsapp' : '';
    }

    public static function requiresCasePhotos(string $channel): bool
    {
        return $channel === self::CHANNEL_SECURE_VIDEO;
    }
}
