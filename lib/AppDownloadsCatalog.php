<?php

declare(strict_types=1);

require_once __DIR__ . '/TurneroSurfaceRegistry.php';

function app_downloads_catalog_defaults(): array
{
    return turnero_surface_registry_catalog_defaults();
}

function app_downloads_catalog_timestamp(): string
{
    return '';
}

function app_downloads_manifest_path(): string
{
    return dirname(__DIR__) . '/app-downloads/stable/release-manifest.json';
}

function app_downloads_manifest_paths(): array
{
    $root = dirname(__DIR__) . '/app-downloads';
    if (!is_dir($root)) {
        return [];
    }

    $paths = [];
    $channels = array_diff(scandir($root) ?: [], ['.', '..']);
    foreach ($channels as $channel) {
        $manifestPath = $root . DIRECTORY_SEPARATOR . $channel . DIRECTORY_SEPARATOR . 'release-manifest.json';
        if (is_file($manifestPath)) {
            $paths[(string) $channel] = $manifestPath;
        }
    }

    ksort($paths);
    return $paths;
}

function app_downloads_manifest_payload(): array
{
    $payloads = app_downloads_manifest_payloads();
    if (isset($payloads['stable']) && is_array($payloads['stable'])) {
        return $payloads['stable'];
    }

    if ($payloads === []) {
        return [];
    }

    $firstPayload = reset($payloads);
    return is_array($firstPayload) ? $firstPayload : [];
}

function app_downloads_manifest_payloads(): array
{
    $payloads = [];

    foreach (app_downloads_manifest_paths() as $channel => $manifestPath) {
        $raw = file_get_contents($manifestPath);
        if ($raw === false || trim($raw) === '') {
            continue;
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            continue;
        }

        $apps = isset($decoded['apps']) && is_array($decoded['apps'])
            ? $decoded['apps']
            : [];

        $payloads[(string) $channel] = [
            'channel' => (string) $channel,
            'version' => isset($decoded['version']) ? (string) $decoded['version'] : '',
            'releasedAt' => isset($decoded['releasedAt']) ? (string) $decoded['releasedAt'] : '',
            'apps' => $apps,
        ];
    }

    return $payloads;
}

function app_downloads_surface_channel(string $surfaceId): string
{
    $surface = turnero_surface_registry_surface($surfaceId);
    if (!is_array($surface)) {
        $defaults = turnero_surface_registry_defaults();
        return (string) ($defaults['channel'] ?? 'stable');
    }

    return turnero_surface_registry_resolve_channel($surface);
}

function app_downloads_resolve_manifest_surface(
    string $surfaceId,
    array $manifestPayloads
): array {
    $preferredChannel = app_downloads_surface_channel($surfaceId);
    $preferredPayload = $manifestPayloads[$preferredChannel] ?? null;
    if (is_array($preferredPayload)) {
        $preferredSurface = $preferredPayload['apps'][$surfaceId] ?? null;
        if (is_array($preferredSurface)) {
            return $preferredSurface;
        }
    }

    foreach ($manifestPayloads as $manifestPayload) {
        if (!is_array($manifestPayload)) {
            continue;
        }

        $manifestSurface = $manifestPayload['apps'][$surfaceId] ?? null;
        if (is_array($manifestSurface)) {
            return $manifestSurface;
        }
    }

    return [];
}

function app_downloads_merge_surface(
    array $default,
    array $loaded,
    array $manifestSurface,
    string $updatedAt
): array {
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
    $manifestPayloads = app_downloads_manifest_payloads();

    $loaded = [];
    if (is_file($catalogPath)) {
        $payload = require $catalogPath;
        if (is_array($payload)) {
            $loaded = $payload;
        }
    }

    $resolved = [];
    foreach ($defaults as $surfaceId => $surfaceDefaults) {
        if (!is_array($surfaceDefaults)) {
            continue;
        }

        $resolved[$surfaceId] = app_downloads_merge_surface(
            $surfaceDefaults,
            isset($loaded[$surfaceId]) && is_array($loaded[$surfaceId]) ? $loaded[$surfaceId] : [],
            app_downloads_resolve_manifest_surface($surfaceId, $manifestPayloads),
            $updatedAt
        );
    }

    return $resolved;
}

function app_downloads_surface_ui_map(): array
{
    $surfaces = [];
    foreach (turnero_surface_registry_surfaces() as $surfaceDefinition) {
        $surfaceId = (string) ($surfaceDefinition['id'] ?? '');
        if ($surfaceId === '') {
            continue;
        }

        $catalog = isset($surfaceDefinition['catalog']) && is_array($surfaceDefinition['catalog'])
            ? $surfaceDefinition['catalog']
            : [];
        $ops = isset($surfaceDefinition['ops']) && is_array($surfaceDefinition['ops'])
            ? $surfaceDefinition['ops']
            : [];
        $installHubOps = isset($ops['installHub']) && is_array($ops['installHub'])
            ? $ops['installHub']
            : [];
        $telemetryOps = isset($ops['telemetry']) && is_array($ops['telemetry'])
            ? $ops['telemetry']
            : [];
        $productName = (string) (($surfaceDefinition['productName'] ?? '') ?: $surfaceId);

        $surfaces[$surfaceId] = [
            'id' => $surfaceId,
            'family' => (string) ($surfaceDefinition['family'] ?? ''),
            'webFallbackUrl' => (string) ($surfaceDefinition['webFallbackUrl'] ?? '/'),
            'guideUrl' => (string) ($surfaceDefinition['guideUrl'] ?? ('/app-downloads/?surface=' . $surfaceId)),
            'catalog' => [
                'title' => (string) (($catalog['title'] ?? '') ?: $productName),
                'eyebrow' => (string) ($catalog['eyebrow'] ?? ''),
                'description' => (string) ($catalog['description'] ?? ''),
                'qrTarget' => (string) ($catalog['qrTarget'] ?? 'prepared'),
                'notes' => isset($catalog['notes']) && is_array($catalog['notes'])
                    ? array_values(array_map(static fn ($note): string => (string) $note, $catalog['notes']))
                    : [],
            ],
            'ops' => [
                'installHub' => [
                    'eyebrow' => (string) (($installHubOps['eyebrow'] ?? '') ?: ($catalog['eyebrow'] ?? '')),
                    'title' => (string) (($installHubOps['title'] ?? '') ?: (($catalog['title'] ?? '') ?: $productName)),
                    'description' => (string) (($installHubOps['description'] ?? '') ?: ($catalog['description'] ?? '')),
                    'recommendedFor' => (string) ($installHubOps['recommendedFor'] ?? ''),
                    'notes' => isset($installHubOps['notes']) && is_array($installHubOps['notes'])
                        ? array_values(array_map(static fn ($note): string => (string) $note, $installHubOps['notes']))
                        : [],
                ],
                'telemetry' => [
                    'title' => (string) (($telemetryOps['title'] ?? '') ?: (($installHubOps['title'] ?? '') ?: (($catalog['title'] ?? '') ?: $productName))),
                    'emptySummary' => (string) ($telemetryOps['emptySummary'] ?? ''),
                ],
            ],
            'targetOrder' => turnero_surface_registry_target_keys($surfaceDefinition),
            'launchDefaults' => isset($surfaceDefinition['launchDefaults']) && is_array($surfaceDefinition['launchDefaults'])
                ? $surfaceDefinition['launchDefaults']
                : [],
        ];
    }

    return $surfaces;
}

function build_app_downloads_runtime_payload(array $state = []): array
{
    return [
        'catalog' => read_app_downloads_catalog(),
        'surfaces' => app_downloads_surface_ui_map(),
        'state' => $state,
    ];
}
