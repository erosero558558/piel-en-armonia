<?php

declare(strict_types=1);

function app_downloads_catalog_defaults(): array
{
    return [
        'operator' => [
            'version' => '0.1.0',
            'updatedAt' => '',
            'webFallbackUrl' => '/operador-turnos.html',
            'guideUrl' => '/app-downloads/?surface=operator',
            'targets' => [
                'win' => [
                    'url' => '/app-downloads/stable/operator/win/TurneroOperadorSetup.exe',
                    'label' => 'Windows',
                ],
                'mac' => [
                    'url' => '/app-downloads/stable/operator/mac/TurneroOperador.dmg',
                    'label' => 'macOS',
                ],
            ],
        ],
        'kiosk' => [
            'version' => '0.1.0',
            'updatedAt' => '',
            'webFallbackUrl' => '/kiosco-turnos.html',
            'guideUrl' => '/app-downloads/?surface=kiosk',
            'targets' => [
                'win' => [
                    'url' => '/app-downloads/stable/kiosk/win/TurneroKioscoSetup.exe',
                    'label' => 'Windows',
                ],
                'mac' => [
                    'url' => '/app-downloads/stable/kiosk/mac/TurneroKiosco.dmg',
                    'label' => 'macOS',
                ],
            ],
        ],
        'sala_tv' => [
            'version' => '0.1.0',
            'updatedAt' => '',
            'webFallbackUrl' => '/sala-turnos.html',
            'guideUrl' => '/app-downloads/?surface=sala_tv',
            'targets' => [
                'android_tv' => [
                    'url' => '/app-downloads/stable/sala-tv/android/TurneroSalaTV.apk',
                    'label' => 'Android TV APK',
                ],
            ],
        ],
    ];
}

function app_downloads_catalog_timestamp(): string
{
    return '';
}

function app_downloads_manifest_path(): string
{
    return dirname(__DIR__) . '/app-downloads/stable/release-manifest.json';
}

function app_downloads_manifest_payload(): array
{
    $manifestPath = app_downloads_manifest_path();
    if (!is_file($manifestPath)) {
        return [];
    }

    $raw = file_get_contents($manifestPath);
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return [];
    }

    $apps = isset($decoded['apps']) && is_array($decoded['apps'])
        ? $decoded['apps']
        : [];

    return [
        'version' => isset($decoded['version']) ? (string) $decoded['version'] : '',
        'releasedAt' => isset($decoded['releasedAt']) ? (string) $decoded['releasedAt'] : '',
        'apps' => $apps,
    ];
}

function app_downloads_merge_surface(
    array $default,
    array $loaded,
    array $manifestSurface,
    string $updatedAt
): array
{
    $targets = isset($loaded['targets']) && is_array($loaded['targets'])
        ? $loaded['targets']
        : [];
    $manifestTargets = isset($manifestSurface['targets']) && is_array($manifestSurface['targets'])
        ? $manifestSurface['targets']
        : [];

    $resolvedVersion = isset($manifestSurface['version']) && $manifestSurface['version'] !== ''
        ? (string) $manifestSurface['version']
        : (string) ($loaded['version'] ?? $default['version']);
    $resolvedUpdatedAt = isset($manifestSurface['updatedAt']) && $manifestSurface['updatedAt'] !== ''
        ? (string) $manifestSurface['updatedAt']
        : (string) ($loaded['updatedAt'] ?? $updatedAt);

    return [
        'version' => $resolvedVersion,
        'updatedAt' => $resolvedUpdatedAt,
        'webFallbackUrl' => (string) (
            $manifestSurface['webFallbackUrl']
                ?? $loaded['webFallbackUrl']
                ?? $default['webFallbackUrl']
        ),
        'guideUrl' => (string) (
            $manifestSurface['guideUrl']
                ?? $loaded['guideUrl']
                ?? $default['guideUrl']
        ),
        'targets' => array_replace_recursive($default['targets'], $targets, $manifestTargets),
    ];
}

function read_app_downloads_catalog(): array
{
    $defaults = app_downloads_catalog_defaults();
    $updatedAt = app_downloads_catalog_timestamp();
    $catalogPath = dirname(__DIR__) . '/content/app-downloads/catalog.php';
    $manifest = app_downloads_manifest_payload();
    $manifestApps = isset($manifest['apps']) && is_array($manifest['apps'])
        ? $manifest['apps']
        : [];

    $loaded = [];
    if (is_file($catalogPath)) {
        $payload = require $catalogPath;
        if (is_array($payload)) {
            $loaded = $payload;
        }
    }

    return [
        'operator' => app_downloads_merge_surface(
            $defaults['operator'],
            isset($loaded['operator']) && is_array($loaded['operator']) ? $loaded['operator'] : [],
            isset($manifestApps['operator']) && is_array($manifestApps['operator'])
                ? $manifestApps['operator']
                : [],
            $updatedAt
        ),
        'kiosk' => app_downloads_merge_surface(
            $defaults['kiosk'],
            isset($loaded['kiosk']) && is_array($loaded['kiosk']) ? $loaded['kiosk'] : [],
            isset($manifestApps['kiosk']) && is_array($manifestApps['kiosk'])
                ? $manifestApps['kiosk']
                : [],
            $updatedAt
        ),
        'sala_tv' => app_downloads_merge_surface(
            $defaults['sala_tv'],
            isset($loaded['sala_tv']) && is_array($loaded['sala_tv']) ? $loaded['sala_tv'] : [],
            isset($manifestApps['sala_tv']) && is_array($manifestApps['sala_tv'])
                ? $manifestApps['sala_tv']
                : [],
            $updatedAt
        ),
    ];
}
