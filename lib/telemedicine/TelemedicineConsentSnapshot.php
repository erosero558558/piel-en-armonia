<?php

declare(strict_types=1);

require_once __DIR__ . '/../common.php';
require_once __DIR__ . '/../validation.php';
require_once __DIR__ . '/../consent/ConsentVersioning.php';

final class TelemedicineConsentSnapshot
{
    public static function build(array $appointment, string $channel, array $context = []): array
    {
        $accepted = isset($appointment['privacyConsent']) && parse_bool($appointment['privacyConsent']) === true;
        $acceptedAt = trim((string) ($appointment['privacyConsentAt'] ?? ''));
        if ($accepted && $acceptedAt === '') {
            $acceptedAt = local_date('c');
        }

        $privacyVersion = ConsentVersioning::getActiveVersion('privacy_policy');
        $telemedicineVersion = ConsentVersioning::getActiveVersion('telemedicine_consent');

        return [
            'consentAccepted' => $accepted,
            'consentAcceptedAt' => $acceptedAt,
            'policyVersion' => $privacyVersion['version'],
            'policyHash' => $privacyVersion['hash'],
            'medicalDisclaimerVersion' => $telemedicineVersion['version'],
            'medicalDisclaimerHash' => $telemedicineVersion['hash'],
            'sourceRoute' => trim((string) ($context['sourceRoute'] ?? '/api.php?resource=appointments')),
            'locale' => trim((string) ($context['locale'] ?? $appointment['locale'] ?? 'es')),
            'frontendSurface' => trim((string) ($context['frontendSurface'] ?? $appointment['frontendSurface'] ?? 'legacy_booking')),
            'channel' => $channel,
        ];
    }

    public static function policyVersion(): string
    {
        return ConsentVersioning::getActiveVersion('privacy_policy')['version'];
    }

    public static function medicalDisclaimerVersion(): string
    {
        return ConsentVersioning::getActiveVersion('telemedicine_consent')['version'];
    }
}
