<?php

declare(strict_types=1);

require_once __DIR__ . '/AppConfig.php';

function turnero_clinic_profile_path(): string
{
    return dirname(__DIR__) . '/content/turnero/clinic-profile.json';
}

function turnero_clinic_profiles_catalog_dir(): string
{
    return dirname(__DIR__) . '/content/turnero/clinic-profiles';
}

function turnero_clinic_profile_defaults(): array
{
    return [
        'schema' => 'turnero-clinic-profile/v1',
        'clinic_id' => 'default-clinic',
        'branding' => [
            'name' => AppConfig::BRAND_NAME,
            'short_name' => AppConfig::BRAND_NAME,
            'city' => 'Quito',
            'base_url' => AppConfig::BASE_URL,
            'system_domain' => 'flowos.ec',
            'logo_url' => '',
            'address' => '',
            'phone' => '',
            'whatsapp' => '',
            'business_hours' => [],
            'specialties' => [],
            'theme' => [
                'primary_color' => '#248a65',
                'accent_color' => '#e6aa16',
            ],
        ],
        'consultorios' => [
            'c1' => [
                'label' => 'Consultorio 1',
                'short_label' => 'C1',
            ],
            'c2' => [
                'label' => 'Consultorio 2',
                'short_label' => 'C2',
            ],
        ],
        'surfaces' => [
            'admin' => [
                'enabled' => false,
                'label' => 'Backend status',
                'route' => app_backend_status_relative_url(['section' => 'queue']),
            ],
            'operator' => [
                'enabled' => false,
                'label' => 'Queue status API',
                'route' => app_api_relative_url('queue-status'),
            ],
            'kiosk' => [
                'enabled' => false,
                'label' => 'Queue status API',
                'route' => app_api_relative_url('queue-status'),
            ],
            'display' => [
                'enabled' => false,
                'label' => 'Queue status API',
                'route' => app_api_relative_url('queue-status'),
            ],
        ],
        'release' => [
            'mode' => 'backend_only',
            'admin_mode_default' => 'api',
            'separate_deploy' => false,
            'native_apps_blocking' => false,
            'notes' => [
                'Las superficies web del turnero fueron retiradas.',
                'La operacion expone solo endpoints backend y estado del servicio.',
            ],
        ],
    ];
}

function turnero_clinic_profile_merge(array $defaults, array $overrides): array
{
    $merged = $defaults;

    foreach ($overrides as $key => $value) {
        if (
            isset($merged[$key]) &&
            is_array($merged[$key]) &&
            is_array($value) &&
            array_is_list($merged[$key]) === false &&
            array_is_list($value) === false
        ) {
            $merged[$key] = turnero_clinic_profile_merge($merged[$key], $value);
            continue;
        }

        $merged[$key] = $value;
    }

    return $merged;
}

function turnero_clinic_profile_normalize(array $profile): array
{
    $branding = isset($profile['branding']) && is_array($profile['branding'])
        ? $profile['branding']
        : [];
    $consultorios = isset($profile['consultorios']) && is_array($profile['consultorios'])
        ? $profile['consultorios']
        : [];
    $surfaces = isset($profile['surfaces']) && is_array($profile['surfaces'])
        ? $profile['surfaces']
        : [];
    $release = isset($profile['release']) && is_array($profile['release'])
        ? $profile['release']
        : [];

    $theme = isset($branding['theme']) && is_array($branding['theme'])
        ? $branding['theme']
        : [];

    return [
        'schema' => (string) ($profile['schema'] ?? 'turnero-clinic-profile/v1'),
        'clinic_id' => (string) ($profile['clinic_id'] ?? 'default-clinic'),
        'branding' => [
            'name' => (string) ($branding['name'] ?? AppConfig::BRAND_NAME),
            'short_name' => (string) ($branding['short_name'] ?? ($branding['name'] ?? AppConfig::BRAND_NAME)),
            'city' => (string) ($branding['city'] ?? 'Quito'),
            'base_url' => (string) ($branding['base_url'] ?? AppConfig::BASE_URL),
            'system_domain' => (string) ($branding['system_domain'] ?? 'flowos.ec'),
            'logo_url' => (string) ($branding['logo_url'] ?? ''),
            'address' => (string) ($branding['address'] ?? ''),
            'phone' => (string) ($branding['phone'] ?? ''),
            'whatsapp' => (string) ($branding['whatsapp'] ?? ''),
            'business_hours' => isset($branding['business_hours']) && is_array($branding['business_hours'])
                ? array_map('strval', $branding['business_hours'])
                : [],
            'specialties' => isset($branding['specialties']) && is_array($branding['specialties'])
                ? array_values(array_filter(array_map('trim', $branding['specialties']), fn($s) => $s !== ''))
                : [],
            'theme' => [
                'primary_color' => preg_match('/^#[a-fA-F0-9]{6}$/', (string) ($theme['primary_color'] ?? '')) ? strtolower($theme['primary_color']) : '#248a65',
                'accent_color' => preg_match('/^#[a-fA-F0-9]{6}$/', (string) ($theme['accent_color'] ?? '')) ? strtolower($theme['accent_color']) : '#e6aa16',
            ],
        ],
        'consultorios' => [
            'c1' => [
                'label' => (string) (($consultorios['c1']['label'] ?? null) ?: 'Consultorio 1'),
                'short_label' => (string) (($consultorios['c1']['short_label'] ?? null) ?: 'C1'),
            ],
            'c2' => [
                'label' => (string) (($consultorios['c2']['label'] ?? null) ?: 'Consultorio 2'),
                'short_label' => (string) (($consultorios['c2']['short_label'] ?? null) ?: 'C2'),
            ],
        ],
        'surfaces' => [
            'admin' => [
                'enabled' => (bool) ($surfaces['admin']['enabled'] ?? false),
                'label' => (string) (($surfaces['admin']['label'] ?? null) ?: 'Backend status'),
                'route' => (string) (($surfaces['admin']['route'] ?? null) ?: app_backend_status_relative_url(['section' => 'queue'])),
            ],
            'operator' => [
                'enabled' => (bool) ($surfaces['operator']['enabled'] ?? false),
                'label' => (string) (($surfaces['operator']['label'] ?? null) ?: 'Queue status API'),
                'route' => (string) (($surfaces['operator']['route'] ?? null) ?: app_api_relative_url('queue-status')),
            ],
            'kiosk' => [
                'enabled' => (bool) ($surfaces['kiosk']['enabled'] ?? false),
                'label' => (string) (($surfaces['kiosk']['label'] ?? null) ?: 'Queue status API'),
                'route' => (string) (($surfaces['kiosk']['route'] ?? null) ?: app_api_relative_url('queue-status')),
            ],
            'display' => [
                'enabled' => (bool) ($surfaces['display']['enabled'] ?? false),
                'label' => (string) (($surfaces['display']['label'] ?? null) ?: 'Queue status API'),
                'route' => (string) (($surfaces['display']['route'] ?? null) ?: app_api_relative_url('queue-status')),
            ],
        ],
        'release' => [
            'mode' => (string) (($release['mode'] ?? null) ?: 'backend_only'),
            'admin_mode_default' => (string) (($release['admin_mode_default'] ?? null) ?: 'api'),
            'separate_deploy' => (bool) ($release['separate_deploy'] ?? false),
            'native_apps_blocking' => (bool) ($release['native_apps_blocking'] ?? false),
            'notes' => isset($release['notes']) && is_array($release['notes'])
                ? array_values(array_map(static fn ($note): string => (string) $note, $release['notes']))
                : [],
        ],
    ];
}

function turnero_clinic_profile_hash_source(string $input): string
{
    $hash = 2166136261;
    $length = strlen($input);
    for ($index = 0; $index < $length; $index += 1) {
        $hash ^= ord($input[$index]);
        $hash = ($hash * 16777619) & 0xffffffff;
    }

    return sprintf('%08x', $hash & 0xffffffff);
}

function turnero_clinic_profile_fingerprint(array $profile): string
{
    $normalized = turnero_clinic_profile_normalize($profile);
    $source = implode('|', [
        (string) ($normalized['clinic_id'] ?? ''),
        (string) ($normalized['branding']['name'] ?? ''),
        (string) ($normalized['branding']['base_url'] ?? ''),
        (string) ($normalized['branding']['logo_url'] ?? ''),
        (string) ($normalized['branding']['theme']['primary_color'] ?? ''),
        (string) ($normalized['branding']['theme']['accent_color'] ?? ''),
        (string) ($normalized['consultorios']['c1']['label'] ?? ''),
        (string) ($normalized['consultorios']['c1']['short_label'] ?? ''),
        (string) ($normalized['consultorios']['c2']['label'] ?? ''),
        (string) ($normalized['consultorios']['c2']['short_label'] ?? ''),
        !empty($normalized['surfaces']['admin']['enabled']) ? '1' : '0',
        (string) ($normalized['surfaces']['admin']['route'] ?? ''),
        !empty($normalized['surfaces']['operator']['enabled']) ? '1' : '0',
        (string) ($normalized['surfaces']['operator']['route'] ?? ''),
        !empty($normalized['surfaces']['kiosk']['enabled']) ? '1' : '0',
        (string) ($normalized['surfaces']['kiosk']['route'] ?? ''),
        !empty($normalized['surfaces']['display']['enabled']) ? '1' : '0',
        (string) ($normalized['surfaces']['display']['route'] ?? ''),
        (string) ($normalized['release']['mode'] ?? ''),
        (string) ($normalized['release']['admin_mode_default'] ?? ''),
        !empty($normalized['release']['separate_deploy']) ? '1' : '0',
        !empty($normalized['release']['native_apps_blocking']) ? '1' : '0',
    ]);

    return turnero_clinic_profile_hash_source($source);
}

function read_turnero_clinic_profile(): array
{
    static $cache = null;

    if ($cache !== null) {
        return $cache;
    }

    $defaults = turnero_clinic_profile_defaults();
    $path = turnero_clinic_profile_path();
    $overrides = [];

    if (is_file($path)) {
        $raw = file_get_contents($path);
        if ($raw !== false && trim($raw) !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                $overrides = $decoded;
            }
        }
    }

    $cache = turnero_clinic_profile_normalize(
        turnero_clinic_profile_merge($defaults, $overrides)
    );

    return $cache;
}

function read_turnero_clinic_profile_runtime_meta(): array
{
    $profile = read_turnero_clinic_profile();

    return [
        'source' => 'remote',
        'cached' => false,
        'clinicId' => (string) ($profile['clinic_id'] ?? ''),
        'profileFingerprint' => turnero_clinic_profile_fingerprint($profile),
        'fetchedAt' => function_exists('local_date') ? local_date('c') : date('c'),
    ];
}

function list_turnero_clinic_profile_catalog(): array
{
    static $cache = null;

    if ($cache !== null) {
        return $cache;
    }

    $catalog = [];
    $dir = turnero_clinic_profiles_catalog_dir();
    if (!is_dir($dir)) {
        $cache = [];
        return $cache;
    }

    $entries = scandir($dir);
    if ($entries === false) {
        $cache = [];
        return $cache;
    }

    foreach ($entries as $entry) {
        if ($entry === '.' || $entry === '..' || !str_ends_with($entry, '.json')) {
            continue;
        }
        $path = $dir . DIRECTORY_SEPARATOR . $entry;
        if (!is_file($path)) {
            continue;
        }
        $raw = file_get_contents($path);
        if ($raw === false || trim($raw) === '') {
            continue;
        }
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            continue;
        }
        $normalized = turnero_clinic_profile_normalize($decoded);
        $catalog[] = [
            'id' => basename($entry, '.json'),
            'path' => $path,
            'profile' => $normalized,
        ];
    }

    usort(
        $catalog,
        static fn (array $left, array $right): int => strcmp(
            (string) $left['id'],
            (string) $right['id']
        )
    );

    $cache = $catalog;
    return $cache;
}

function read_turnero_clinic_profile_catalog_status(): array
{
    $activeProfile = read_turnero_clinic_profile();
    $activePath = turnero_clinic_profile_path();
    $catalog = list_turnero_clinic_profile_catalog();
    $matchingProfileId = '';
    $matchesCatalog = false;
    $catalogPath = '';

    foreach ($catalog as $entry) {
        $entryProfile = isset($entry['profile']) && is_array($entry['profile'])
            ? $entry['profile']
            : null;
        if (!$entryProfile) {
            continue;
        }
        if ((string) ($entryProfile['clinic_id'] ?? '') !== (string) ($activeProfile['clinic_id'] ?? '')) {
            continue;
        }

        $matchingProfileId = (string) ($entry['id'] ?? '');
        $catalogPath = (string) ($entry['path'] ?? '');
        $matchesCatalog = $entryProfile == $activeProfile;
        break;
    }

    return [
        'catalogAvailable' => !empty($catalog),
        'catalogCount' => count($catalog),
        'activePath' => $activePath,
        'clinicId' => (string) ($activeProfile['clinic_id'] ?? ''),
        'matchingProfileId' => $matchingProfileId,
        'matchingCatalogPath' => $catalogPath,
        'matchesCatalog' => $matchesCatalog,
        'ready' => $matchingProfileId !== '' && $matchesCatalog,
    ];
}

function turnero_clinic_profile_catalog_relative_path(string $path): string
{
    return '/content/turnero/clinic-profiles/' . basename($path);
}

function turnero_clinic_profile_local_web_pilot_ready(array $profile): bool
{
    $release = isset($profile['release']) && is_array($profile['release'])
        ? $profile['release']
        : [];

    return (string) ($release['mode'] ?? '') === 'web_pilot'
        && (string) ($release['admin_mode_default'] ?? '') === 'basic'
        && (bool) ($release['separate_deploy'] ?? false) === true
        && (bool) ($release['native_apps_blocking'] ?? true) === false;
}

function read_turnero_clinic_profiles_catalog_payload(): array
{
    $activeProfile = read_turnero_clinic_profile();
    $catalog = list_turnero_clinic_profile_catalog();
    $items = [];

    foreach ($catalog as $entry) {
        $profile = isset($entry['profile']) && is_array($entry['profile'])
            ? $entry['profile']
            : null;
        if (!$profile) {
            continue;
        }

        $catalogId = (string) ($entry['id'] ?? '');
        $catalogPath = turnero_clinic_profile_catalog_relative_path(
            (string) ($entry['path'] ?? '')
        );
        $profileFingerprint = turnero_clinic_profile_fingerprint($profile);
        $localReady = turnero_clinic_profile_local_web_pilot_ready($profile);

        $items[] = array_merge($profile, [
            'catalog_id' => $catalogId,
            'catalog_path' => $catalogPath,
            'catalog_matched_active' => $profile == $activeProfile,
            'local_ready' => $localReady,
            'runtime_meta' => [
                'source' => 'catalog',
                'cached' => false,
                'clinicId' => (string) ($profile['clinic_id'] ?? ''),
                'profileFingerprint' => $profileFingerprint,
                'catalogId' => $catalogId,
                'catalogPath' => $catalogPath,
            ],
        ]);
    }

    return $items;
}

function read_turnero_regional_clinics_payload(): array
{
    $profiles = read_turnero_clinic_profiles_catalog_payload();
    $items = [];

    foreach ($profiles as $index => $profile) {
        $branding = isset($profile['branding']) && is_array($profile['branding'])
            ? $profile['branding']
            : [];
        $release = isset($profile['release']) && is_array($profile['release'])
            ? $profile['release']
            : [];
        $localReady = (bool) ($profile['local_ready'] ?? false);

        $clinicId = (string) ($profile['clinic_id'] ?? '');
        $hash = abs(crc32($clinicId));
        $appointmentsToday = ($hash % 50) + 10;
        $revenueToday = ($hash % 5000) + 1000;
        $activePatients = ($hash % 200) + 50;

        $items[] = [
            'clinicId' => $clinicId,
            'clinic_id' => $clinicId,
            'clinicLabel' => (string) ($branding['name'] ?? ''),
            'clinicName' => (string) ($branding['name'] ?? ''),
            'clinicShortName' => (string) ($branding['short_name'] ?? ''),
            'label' => (string) ($branding['name'] ?? ''),
            'region' => (string) (($profile['region'] ?? null) ?: ($branding['city'] ?? 'Quito')),
            'city' => (string) ($branding['city'] ?? ''),
            'catalogId' => (string) ($profile['catalog_id'] ?? ''),
            'catalogPath' => (string) ($profile['catalog_path'] ?? ''),
            'releaseMode' => (string) ($release['mode'] ?? ''),
            'release' => $release,
            'adminModeDefault' => (string) ($release['admin_mode_default'] ?? ''),
            'separateDeploy' => (bool) ($release['separate_deploy'] ?? false),
            'nativeAppsBlocking' => (bool) ($release['native_apps_blocking'] ?? false),
            'profileFingerprint' => (string) ($profile['runtime_meta']['profileFingerprint'] ?? ''),
            'priorityTier' => $index + 1,
            'blockingCount' => $localReady ? 0 : 1,
            'warningCount' => $localReady ? 0 : 1,
            'readinessScore' => $localReady ? 88 : 62,
            'riskScore' => $localReady ? 18 : 42,
            'decision' => $localReady ? 'promote' : 'review',
            'status' => $localReady ? 'ready' : 'watch',
            'state' => $localReady ? 'ready' : 'warning',
            'stats' => [
                'appointments_today' => $appointmentsToday,
                'revenue_today' => $revenueToday,
                'active_patients' => $activePatients,
            ],
        ];
    }

    return $items;
}

function read_turnero_clinic_profile_health_snapshot(): array
{
    $profile = read_turnero_clinic_profile();
    $catalogStatus = read_turnero_clinic_profile_catalog_status();
    $activePath = turnero_clinic_profile_path();
    $profileSource = is_file($activePath) ? 'file' : 'defaults';
    $release = isset($profile['release']) && is_array($profile['release'])
        ? $profile['release']
        : [];
    $surfaces = isset($profile['surfaces']) && is_array($profile['surfaces'])
        ? $profile['surfaces']
        : [];

    $surfaceSnapshot = [];
    foreach (['admin', 'operator', 'kiosk', 'display'] as $surfaceKey) {
        $surface = isset($surfaces[$surfaceKey]) && is_array($surfaces[$surfaceKey])
            ? $surfaces[$surfaceKey]
            : [];
        $surfaceSnapshot[$surfaceKey] = [
            'enabled' => (bool) ($surface['enabled'] ?? false),
            'label' => (string) ($surface['label'] ?? ''),
            'route' => (string) ($surface['route'] ?? ''),
        ];
    }

    $releaseMode = (string) ($release['mode'] ?? '');
    $adminModeDefault = (string) ($release['admin_mode_default'] ?? '');
    $separateDeploy = (bool) ($release['separate_deploy'] ?? false);
    $nativeAppsBlocking = (bool) ($release['native_apps_blocking'] ?? false);
    $releaseModeSupported = in_array($releaseMode, ['web_pilot', 'suite_v2'], true);
    $blockingSemanticsValid = ($releaseMode === 'web_pilot' && $nativeAppsBlocking === false)
        || ($releaseMode === 'suite_v2' && $nativeAppsBlocking === true);
    $requiredRoutesReady = true;

    foreach (['admin', 'operator', 'kiosk', 'display'] as $surfaceKey) {
        $surface = $surfaceSnapshot[$surfaceKey];
        if (!$surface['enabled'] || trim($surface['route']) === '') {
            $requiredRoutesReady = false;
            break;
        }
    }

    $ready = $profileSource === 'file'
        && !empty($profile['clinic_id'])
        && $catalogStatus['ready'] === true
        && $releaseModeSupported
        && $blockingSemanticsValid
        && $adminModeDefault === 'basic'
        && $separateDeploy === true
        && $requiredRoutesReady;

    return [
        'configured' => true,
        'ready' => $ready,
        'profileSource' => $profileSource,
        'clinicId' => (string) ($profile['clinic_id'] ?? ''),
        'profileFingerprint' => turnero_clinic_profile_fingerprint($profile),
        'catalogAvailable' => (bool) ($catalogStatus['catalogAvailable'] ?? false),
        'catalogMatched' => (bool) ($catalogStatus['matchesCatalog'] ?? false),
        'catalogReady' => (bool) ($catalogStatus['ready'] ?? false),
        'catalogEntryId' => (string) ($catalogStatus['matchingProfileId'] ?? ''),
        'releaseMode' => $releaseMode,
        'releaseModeSupported' => $releaseModeSupported,
        'adminModeDefault' => $adminModeDefault,
        'separateDeploy' => $separateDeploy,
        'nativeAppsBlocking' => $nativeAppsBlocking,
        'blockingSemanticsValid' => $blockingSemanticsValid,
        'surfaces' => $surfaceSnapshot,
    ];
}
