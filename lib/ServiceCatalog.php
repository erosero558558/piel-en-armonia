<?php

declare(strict_types=1);

require_once __DIR__ . '/common.php';

/**
 * Canonical commercial catalog loader shared across backend consumers.
 */

function service_catalog_path(): string
{
    $override = app_env('AURORADERM_SERVICES_CATALOG_FILE', '');
    if (is_string($override) && trim($override) !== '') {
        return trim($override);
    }

    $canonicalPath = dirname(__DIR__) . '/data/catalog/services.json';
    if (is_file($canonicalPath)) {
        return $canonicalPath;
    }

    return dirname(__DIR__) . '/content/services.json';
}

/**
 * @return array{
 *   source:string,
 *   path:string,
 *   mtime:int,
 *   version:string,
 *   timezone:string,
 *   currency:string,
 *   services:array<int,array<string,mixed>>
 * }
 */
function load_service_catalog_payload(): array
{
    static $cache = null;

    $path = service_catalog_path();
    $mtime = $path !== '' && is_file($path) ? (int) @filemtime($path) : 0;

    if (
        is_array($cache)
        && ($cache['path'] ?? '') === $path
        && (int) ($cache['mtime'] ?? 0) === $mtime
    ) {
        return $cache['payload'];
    }

    $payload = [
        'source' => 'missing',
        'path' => $path,
        'mtime' => $mtime,
        'version' => 'missing',
        'timezone' => 'America/Guayaquil',
        'currency' => 'USD',
        'services' => [],
    ];

    if ($path === '' || !is_file($path)) {
        $cache = ['path' => $path, 'mtime' => $mtime, 'payload' => $payload];
        return $payload;
    }

    $raw = @file_get_contents($path);
    if (!is_string($raw) || trim($raw) === '') {
        $payload['source'] = 'invalid';
        $payload['version'] = 'invalid';
        $cache = ['path' => $path, 'mtime' => $mtime, 'payload' => $payload];
        return $payload;
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        $payload['source'] = 'invalid';
        $payload['version'] = 'invalid';
        $cache = ['path' => $path, 'mtime' => $mtime, 'payload' => $payload];
        return $payload;
    }

    $services = [];
    foreach ((array) ($decoded['services'] ?? []) as $entry) {
        if (!is_array($entry)) {
            continue;
        }
        $slug = service_catalog_normalize_token((string) ($entry['slug'] ?? ($entry['id'] ?? '')));
        if ($slug === '') {
            continue;
        }
        $entry['slug'] = $slug;
        $services[] = $entry;
    }

    $version = trim((string) ($decoded['version'] ?? 'unknown'));
    $timezone = trim((string) ($decoded['timezone'] ?? 'America/Guayaquil'));
    $currency = trim((string) ($decoded['currency'] ?? 'USD'));

    $payload = [
        'source' => 'file',
        'path' => $path,
        'mtime' => $mtime,
        'version' => $version !== '' ? $version : 'unknown',
        'timezone' => $timezone !== '' ? $timezone : 'America/Guayaquil',
        'currency' => $currency !== '' ? $currency : 'USD',
        'services' => $services,
    ];

    $cache = ['path' => $path, 'mtime' => $mtime, 'payload' => $payload];
    return $payload;
}

function service_catalog_normalize_token(string $value): string
{
    $value = trim($value);
    if ($value === '') {
        return '';
    }

    if (function_exists('mb_strtolower')) {
        $value = mb_strtolower($value, 'UTF-8');
    } else {
        $value = strtolower($value);
    }

    return preg_replace('/\s+/', '-', $value) ?? '';
}

function service_catalog_entry_scope(array $entry): string
{
    $scope = trim((string) ($entry['catalog_scope'] ?? ''));
    if ($scope === 'public_route' || $scope === 'booking_option') {
        return $scope;
    }

    if (
        array_key_exists('label_es', $entry)
        || array_key_exists('label_en', $entry)
        || array_key_exists('service_type', $entry)
    ) {
        return 'booking_option';
    }

    return 'public_route';
}

/**
 * @return array<int,array<string,mixed>>
 */
function service_catalog_services(?string $scope = null): array
{
    $payload = load_service_catalog_payload();
    $services = (array) ($payload['services'] ?? []);
    if ($scope === null || $scope === '') {
        return $services;
    }

    return array_values(array_filter(
        $services,
        static fn (array $entry): bool => service_catalog_entry_scope($entry) === $scope
    ));
}

/**
 * @return array<string,mixed>|null
 */
function service_catalog_find_by_slug(string $slug, ?string $scope = null): ?array
{
    $slug = service_catalog_normalize_token($slug);
    if ($slug === '') {
        return null;
    }

    foreach (service_catalog_services($scope) as $entry) {
        if (service_catalog_normalize_token((string) ($entry['slug'] ?? '')) === $slug) {
            return $entry;
        }
    }

    return null;
}

function service_catalog_humanize_slug(string $slug): string
{
    $slug = trim($slug);
    if ($slug === '') {
        return '';
    }

    $label = str_replace(['_', '-'], ' ', $slug);
    if (function_exists('mb_convert_case')) {
        return mb_convert_case($label, MB_CASE_TITLE, 'UTF-8');
    }

    return ucwords(strtolower($label));
}

function service_catalog_normalize_tax_rate(mixed $value, ?float $fallback = null): float
{
    if (is_numeric($value)) {
        $rate = (float) $value;
    } elseif ($fallback !== null) {
        $rate = $fallback;
    } else {
        return 0.0;
    }

    if ($rate > 1.0 && $rate <= 100.0) {
        $rate = $rate / 100.0;
    }
    if ($rate < 0.0) {
        return 0.0;
    }
    if ($rate > 1.0) {
        return 1.0;
    }

    return $rate;
}

function service_catalog_normalize_business_category(array $entry): string
{
    $category = service_catalog_normalize_token((string) ($entry['service_type'] ?? ($entry['category'] ?? '')));

    return match ($category) {
        'telemedicine', 'telemedicina' => 'telemedicina',
        'aesthetic', 'estetico', 'estetica' => 'estetico',
        'procedure', 'procedures', 'procedimiento' => 'procedimiento',
        default => 'clinico',
    };
}

/**
 * @return array<string,array<string,mixed>>
 */
function service_catalog_booking_service_map(?float $fallbackVatRate = null): array
{
    $map = [];
    foreach (service_catalog_services('booking_option') as $entry) {
        $serviceId = service_catalog_normalize_token(
            (string) ($entry['runtime_service_id'] ?? ($entry['slug'] ?? ''))
        );
        if ($serviceId === '') {
            continue;
        }

        $basePrice = 0.0;
        if (is_numeric($entry['base_price_usd'] ?? null)) {
            $basePrice = (float) $entry['base_price_usd'];
        } elseif (is_numeric($entry['price_from'] ?? null)) {
            $basePrice = (float) $entry['price_from'];
        }

        $taxRate = service_catalog_normalize_tax_rate(
            $entry['tax_rate'] ?? ($entry['iva'] ?? null),
            $fallbackVatRate
        );

        $name = trim((string) ($entry['name'] ?? ($entry['label_es'] ?? ($entry['hero'] ?? ''))));
        if ($name === '') {
            $name = service_catalog_humanize_slug($serviceId);
        }

        $map[$serviceId] = [
            'name' => $name,
            'price_base' => $basePrice,
            'tax_rate' => $taxRate,
            'category' => service_catalog_normalize_business_category($entry),
            'is_from_price' => (bool) ($entry['is_from_price'] ?? false),
        ];
    }

    return $map;
}

function service_catalog_preparation_for(string $serviceId, ?string $fallbackRouteSlug = null): string
{
    $entry = service_catalog_find_by_slug($serviceId, 'booking_option');
    if ($entry === null && $fallbackRouteSlug !== null && trim($fallbackRouteSlug) !== '') {
        $entry = service_catalog_find_by_slug($fallbackRouteSlug, 'public_route');
    }

    return $entry === null ? '' : trim((string) ($entry['preparation'] ?? ''));
}
