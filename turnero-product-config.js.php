<?php

declare(strict_types=1);

require_once __DIR__ . '/lib/TurneroSurfaceRegistry.php';

header('Content-Type: application/javascript; charset=UTF-8');

$defaults = turnero_surface_registry_defaults();
$surfaces = turnero_surface_registry_map();
$surfaceTitles = isset($defaults['surfaceTitles']) && is_array($defaults['surfaceTitles'])
    ? $defaults['surfaceTitles']
    : [];
$downloadLabels = isset($defaults['downloadLabels']) && is_array($defaults['downloadLabels'])
    ? $defaults['downloadLabels']
    : [];

$payload = [
    'brandName' => (string) ($defaults['brandName'] ?? ''),
    'brandShortName' => (string) ($defaults['brandShortName'] ?? ''),
    'baseUrl' => (string) ($defaults['baseUrl'] ?? ''),
    'downloadBasePath' => (string) ($defaults['downloadBasePath'] ?? ''),
    'updateBasePath' => (string) ($defaults['updateBasePath'] ?? ''),
    'surfaceTitles' => $surfaceTitles,
    'downloadLabels' => $downloadLabels,
    'surfaces' => [],
];

foreach ($surfaces as $surfaceId => $surface) {
    $catalog = isset($surface['catalog']) && is_array($surface['catalog'])
        ? $surface['catalog']
        : [];
    $payload['surfaces'][$surfaceId] = [
        'id' => (string) ($surface['id'] ?? $surfaceId),
        'title' => (string) ($surfaceTitles[$surfaceId] ?? ''),
        'productName' => (string) ($surface['productName'] ?? ''),
        'catalogTitle' => (string) ($catalog['title'] ?? ''),
        'webFallbackUrl' => (string) ($surface['webFallbackUrl'] ?? ''),
        'appId' => (string) ($surface['appId'] ?? ''),
    ];
}

echo 'window.__TURNERO_PRODUCT_CONFIG__ = Object.freeze('
    . json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
    . ');';
