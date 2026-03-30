<?php

declare(strict_types=1);

require_once __DIR__ . '/storage.php';

function doctor_profile_config_dir(): string
{
    return rtrim(data_dir_path(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'config';
}

function doctor_profile_config_path(): string
{
    return doctor_profile_config_dir() . DIRECTORY_SEPARATOR . 'doctor-profile.json';
}

function doctor_profile_defaults(): array
{
    return [
        'fullName' => '',
        'specialty' => '',
        'mspNumber' => '',
        'signatureImage' => '',
        'updatedAt' => '',
    ];
}

function doctor_profile_trim($value): string
{
    return trim((string) $value);
}

function doctor_profile_validate_signature_image(string $value): bool
{
    if ($value === '') {
        return true;
    }

    if (!preg_match('#^data:image/(png|jpeg|jpg);base64,([A-Za-z0-9+/=\r\n]+)$#', $value, $matches)) {
        return false;
    }

    $decoded = base64_decode((string) ($matches[2] ?? ''), true);
    if (!is_string($decoded) || $decoded === '') {
        return false;
    }

    return strlen($decoded) <= 512 * 1024;
}

function doctor_profile_normalize(array $profile): array
{
    $normalized = doctor_profile_defaults();
    $normalized['fullName'] = doctor_profile_trim($profile['fullName'] ?? '');
    $normalized['specialty'] = doctor_profile_trim($profile['specialty'] ?? '');
    $normalized['mspNumber'] = doctor_profile_trim($profile['mspNumber'] ?? '');
    $normalized['signatureImage'] = doctor_profile_trim($profile['signatureImage'] ?? '');
    $normalized['updatedAt'] = doctor_profile_trim($profile['updatedAt'] ?? '');

    if (!doctor_profile_validate_signature_image($normalized['signatureImage'])) {
        $normalized['signatureImage'] = '';
    }

    return $normalized;
}

function doctor_profile_merge(array $current, array $input): array
{
    $merged = doctor_profile_normalize($current);

    foreach (['fullName', 'specialty', 'mspNumber', 'updatedAt'] as $field) {
        if (array_key_exists($field, $input)) {
            $merged[$field] = doctor_profile_trim($input[$field]);
        }
    }

    if (array_key_exists('signatureImage', $input)) {
        $merged['signatureImage'] = doctor_profile_trim($input['signatureImage']);
    }

    return doctor_profile_normalize($merged);
}

function read_doctor_profile(): array
{
    $path = doctor_profile_config_path();
    if (!is_file($path)) {
        return doctor_profile_defaults();
    }

    $raw = @file_get_contents($path);
    if (!is_string($raw) || trim($raw) === '') {
        return doctor_profile_defaults();
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return doctor_profile_defaults();
    }

    return doctor_profile_normalize($decoded);
}

function write_doctor_profile(array $profile): bool
{
    $dir = doctor_profile_config_dir();
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        return false;
    }

    $path = doctor_profile_config_path();
    if (is_file($path)) {
        @chmod($path, 0664);
    } else {
        @chmod($dir, 0775);
    }

    $encoded = json_encode(
        doctor_profile_normalize($profile),
        JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );
    if (!is_string($encoded)) {
        return false;
    }

    return @file_put_contents($path, $encoded . PHP_EOL, LOCK_EX) !== false;
}

function doctor_profile_document_fields(array $fallback = []): array
{
    $profile = read_doctor_profile();
    $fallbackName = doctor_profile_trim($fallback['name'] ?? '');
    $fallbackSpecialty = doctor_profile_trim($fallback['specialty'] ?? '');
    $fallbackMsp = doctor_profile_trim($fallback['msp'] ?? '');
    $fallbackSignature = doctor_profile_trim($fallback['signatureImage'] ?? '');

    $envName = function_exists('app_env')
        ? doctor_profile_trim(app_env('AURORADERM_PRIMARY_DOCTOR_NAME'))
        : '';
    $envMsp = function_exists('app_env')
        ? doctor_profile_trim(app_env('AURORADERM_PRIMARY_DOCTOR_MSP'))
        : '';

    return [
        'name' => $fallbackName !== ''
            ? $fallbackName
            : ($profile['fullName'] !== '' ? $profile['fullName'] : ($envName !== '' ? $envName : 'Dr./Dra.')),
        'specialty' => $fallbackSpecialty !== ''
            ? $fallbackSpecialty
            : ($profile['specialty'] !== '' ? $profile['specialty'] : 'Medico/a tratante'),
        'msp' => $fallbackMsp !== ''
            ? $fallbackMsp
            : ($profile['mspNumber'] !== '' ? $profile['mspNumber'] : $envMsp),
        'signatureImage' => $fallbackSignature !== ''
            ? $fallbackSignature
            : $profile['signatureImage'],
    ];
}
