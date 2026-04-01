<?php

declare(strict_types=1);

require_once __DIR__ . '/../common.php';
require_once __DIR__ . '/../storage.php';

final class PatientConsentStore
{
    private const STORE_FILENAME = 'patient-consents.json';

    public static function readStore(): array
    {
        $path = self::getStorePath();
        if (!is_file($path)) {
            return [];
        }

        $raw = @file_get_contents($path);
        if (!$raw) {
            return [];
        }

        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }

    public static function writeStore(array $data): void
    {
        $path = self::getStorePath();
        $dir = dirname($path);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $json = json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        file_put_contents($path, $json);
    }

    public static function readStatus(string $patientId, string $consentType): ?string
    {
        $store = self::readStore();
        return $store[$patientId][$consentType]['version'] ?? null;
    }

    public static function markAsSigned(string $patientId, string $consentType, string $version): void
    {
        $store = self::readStore();
        
        if (!isset($store[$patientId])) {
            $store[$patientId] = [];
        }

        $store[$patientId][$consentType] = [
            'version' => $version,
            'signed_at' => local_date('c')
        ];

        self::writeStore($store);
    }

    private static function getStorePath(): string
    {
        return data_dir_path() . DIRECTORY_SEPARATOR . self::STORE_FILENAME;
    }
}
