<?php

declare(strict_types=1);

require_once __DIR__ . '/../common.php';
require_once __DIR__ . '/../validation.php';

final class TelemedicineConsentSnapshot
{
    public static function build(array $appointment, string $channel, array $context = []): array
    {
        $accepted = isset($appointment['privacyConsent']) && parse_bool($appointment['privacyConsent']) === true;
        $acceptedAt = trim((string) ($appointment['privacyConsentAt'] ?? ''));
        if ($accepted && $acceptedAt === '') {
            $acceptedAt = local_date('c');
        }

        return [
            'consentAccepted' => $accepted,
            'consentAcceptedAt' => $acceptedAt,
            'policyVersion' => self::policyVersion(),
            'medicalDisclaimerVersion' => self::medicalDisclaimerVersion(),
            'sourceRoute' => trim((string) ($context['sourceRoute'] ?? '/api.php?resource=appointments')),
            'locale' => trim((string) ($context['locale'] ?? $appointment['locale'] ?? 'es')),
            'frontendSurface' => trim((string) ($context['frontendSurface'] ?? $appointment['frontendSurface'] ?? 'legacy_booking')),
            'channel' => $channel,
        ];
    }

    public static function policyVersion(): string
    {
        $raw = getenv('PIELARMONIA_POLICY_VERSION');
        return is_string($raw) && trim($raw) !== '' ? trim($raw) : '2026-03-03';
    }

    public static function medicalDisclaimerVersion(): string
    {
        $raw = getenv('PIELARMONIA_MEDICAL_DISCLAIMER_VERSION');
        return is_string($raw) && trim($raw) !== '' ? trim($raw) : '2026-03-03';
    }
}
