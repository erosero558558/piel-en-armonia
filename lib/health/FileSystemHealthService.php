<?php

declare(strict_types=1);

final class FileSystemHealthService
{
public static function collectAuthSnapshot(): array
    {
        $recommendedMode = function_exists('operator_auth_recommended_mode')
            ? (string) operator_auth_recommended_mode()
            : (defined('OPERATOR_AUTH_SOURCE') ? (string) OPERATOR_AUTH_SOURCE : 'google_oauth');
        $operatorAuthConfig = function_exists('operator_auth_configuration_snapshot')
            ? operator_auth_configuration_snapshot()
            : [];
        $operatorAuthEnabled = array_key_exists('enabled', $operatorAuthConfig)
            ? (bool) $operatorAuthConfig['enabled']
            : (function_exists('operator_auth_is_enabled') ? operator_auth_is_enabled() : false);
        $operatorAuthConfigured = array_key_exists('configured', $operatorAuthConfig)
            ? (bool) $operatorAuthConfig['configured']
            : (function_exists('operator_auth_is_configured') ? operator_auth_is_configured() : false);
        $legacyPasswordConfigured = function_exists('admin_password_is_configured') ? admin_password_is_configured() : false;
        $twoFactorEnabled = trim((string) app_env('AURORADERM_ADMIN_2FA_SECRET', '')) !== '';
        $mode = $operatorAuthEnabled && array_key_exists('mode', $operatorAuthConfig)
            ? (string) $operatorAuthConfig['mode']
            : ($operatorAuthEnabled && function_exists('operator_auth_mode')
                ? (string) operator_auth_mode()
                : 'legacy_password');
        if (trim($mode) === '') {
            $mode = 'legacy_password';
        }

        $configured = $operatorAuthEnabled ? $operatorAuthConfigured : $legacyPasswordConfigured;
        $status = $configured
            ? 'configured'
            : ($operatorAuthEnabled ? 'operator_auth_not_configured' : 'legacy_auth_not_configured');
        $brokerTrustConfigured = (bool) ($operatorAuthConfig['brokerTrustConfigured'] ?? false);
        $brokerIssuerPinned = (bool) ($operatorAuthConfig['brokerIssuerPinned'] ?? false);
        $brokerAudiencePinned = (bool) ($operatorAuthConfig['brokerAudiencePinned'] ?? false);
        $brokerJwksConfigured = (bool) ($operatorAuthConfig['brokerJwksConfigured'] ?? false);
        $brokerEmailVerifiedRequired = (bool) ($operatorAuthConfig['brokerEmailVerifiedRequired'] ?? true);
        $hardeningCompliant = $configured && (
            ($operatorAuthEnabled
                && $mode === $recommendedMode
                && $brokerTrustConfigured
                && $brokerIssuerPinned
                && $brokerAudiencePinned
                && $brokerJwksConfigured
                && $brokerEmailVerifiedRequired)
            || (!$operatorAuthEnabled && $mode === 'legacy_password' && $twoFactorEnabled)
        );
        $operatorPinMeta = turnero_operator_access_meta();

        return [
            'mode' => $mode,
            'status' => $status,
            'configured' => $configured,
            'hardeningCompliant' => $hardeningCompliant,
            'recommendedMode' => $recommendedMode,
            'recommendedModeActive' => $mode === $recommendedMode,
            'legacyPasswordConfigured' => $legacyPasswordConfigured,
            'twoFactorEnabled' => $twoFactorEnabled,
            'operatorAuthEnabled' => $operatorAuthEnabled,
            'operatorAuthConfigured' => $operatorAuthConfigured,
            'brokerTrustConfigured' => $brokerTrustConfigured,
            'brokerIssuerPinned' => $brokerIssuerPinned,
            'brokerAudiencePinned' => $brokerAudiencePinned,
            'brokerJwksConfigured' => $brokerJwksConfigured,
            'brokerEmailVerifiedRequired' => $brokerEmailVerifiedRequired,
            'operatorPinMode' => TURNERO_OPERATOR_MODE,
            'operatorPinConfigured' => (bool) ($operatorPinMeta['configured'] ?? false),
            'operatorPinSessionTtlHours' => (int) ($operatorPinMeta['sessionTtlHours'] ?? TURNERO_OPERATOR_DEFAULT_SESSION_TTL_HOURS),
            'operatorAuthMissing' => is_array($operatorAuthConfig['missing'] ?? null)
                ? array_values($operatorAuthConfig['missing'])
                : [],
            'operatorAuthAllowedEmailCount' => (int) ($operatorAuthConfig['allowedEmailCount'] ?? 0),
        ];
    }

    /**
     * @param array<string,mixed> $detailedPayload
     * @return array<string,mixed>
     */

public static function collectDoctorProfileSnapshot(): array
    {
        $path = doctor_profile_config_path();
        $profile = read_doctor_profile();

        return [
            'ok' => self::isValidJsonConfigFile($path),
            'loaded' => self::isValidJsonConfigFile($path),
            'path' => $path,
            'file_exists' => is_file($path),
            'name_present' => trim((string) ($profile['fullName'] ?? '')) !== '',
            'specialty_present' => trim((string) ($profile['specialty'] ?? '')) !== '',
            'msp_present' => trim((string) ($profile['mspNumber'] ?? '')) !== '',
            'signature_present' => trim((string) ($profile['signatureImage'] ?? '')) !== '',
            'updated_at' => trim((string) ($profile['updatedAt'] ?? '')),
        ];
    }

public static function collectClinicProfileSnapshot(): array
    {
        $path = clinic_profile_config_path();
        $profile = read_clinic_profile();

        return [
            'ok' => self::isValidJsonConfigFile($path),
            'loaded' => self::isValidJsonConfigFile($path),
            'path' => $path,
            'file_exists' => is_file($path),
            'name_present' => trim((string) ($profile['clinicName'] ?? '')) !== '',
            'address_present' => trim((string) ($profile['address'] ?? '')) !== '',
            'phone_present' => trim((string) ($profile['phone'] ?? '')) !== '',
            'logo_present' => trim((string) ($profile['logoImage'] ?? '')) !== '',
        ];
    }

public static function publicProfileSummary(array $snapshot): array
    {
        $payload = [
            'ok' => (bool) ($snapshot['ok'] ?? false),
            'loaded' => (bool) ($snapshot['loaded'] ?? false),
        ];

        foreach ([
            'name_present',
            'specialty_present',
            'msp_present',
            'signature_present',
            'address_present',
            'phone_present',
            'logo_present',
        ] as $field) {
            if (array_key_exists($field, $snapshot)) {
                $payload[$field] = (bool) ($snapshot[$field] ?? false);
            }
        }

        return $payload;
    }

public static function collectDataFilesSnapshot(): array
    {
        $cie10Path = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'cie10.json';
        $protocolsPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'protocols';
        $drugInteractionsPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'drug-interactions.json';

        $cie10 = [
            'exists' => is_file($cie10Path),
            'readable' => is_readable($cie10Path),
            'path' => $cie10Path,
        ];
        $protocolEntries = self::countDirectoryEntries($protocolsPath);
        $protocols = [
            'exists' => is_dir($protocolsPath),
            'readable' => is_readable($protocolsPath),
            'entries' => $protocolEntries,
            'path' => $protocolsPath,
        ];
        $drugInteractions = [
            'exists' => is_file($drugInteractionsPath),
            'readable' => is_readable($drugInteractionsPath),
            'path' => $drugInteractionsPath,
        ];

        return [
            'ok' => $cie10['exists'] && $protocols['exists'] && $drugInteractions['exists'],
            'cie10' => $cie10,
            'protocols' => $protocols,
            'drug_interactions' => $drugInteractions,
        ];
    }

public static function publicDataFilesSummary(array $snapshot): array
    {
        return [
            'ok' => (bool) ($snapshot['ok'] ?? false),
            'cie10' => self::publicFileCheckSummary($snapshot['cie10'] ?? null),
            'protocols' => self::publicFileCheckSummary($snapshot['protocols'] ?? null),
            'drug_interactions' => self::publicFileCheckSummary($snapshot['drug_interactions'] ?? null),
        ];
    }

public static function publicFileCheckSummary($raw): array
    {
        if (!is_array($raw)) {
            return [
                'exists' => false,
            ];
        }

        $payload = [
            'exists' => (bool) ($raw['exists'] ?? false),
            'readable' => (bool) ($raw['readable'] ?? false),
        ];

        if (array_key_exists('entries', $raw)) {
            $payload['entries'] = (int) ($raw['entries'] ?? 0);
        }

        return $payload;
    }

public static function countDirectoryEntries(string $path): int
    {
        if (!is_dir($path)) {
            return 0;
        }

        $entries = @scandir($path);
        if (!is_array($entries)) {
            return 0;
        }

        $count = 0;
        foreach ($entries as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }
            $count++;
        }

        return $count;
    }

public static function isValidJsonConfigFile(string $path): bool
    {
        if (!is_file($path) || !is_readable($path)) {
            return false;
        }

        $raw = @file_get_contents($path);
        if (!is_string($raw) || trim($raw) === '') {
            return false;
        }

        return is_array(json_decode($raw, true));
    }

}
