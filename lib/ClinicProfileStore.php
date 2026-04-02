<?php

declare(strict_types=1);

require_once __DIR__ . '/AppConfig.php';
require_once __DIR__ . '/DoctorProfileStore.php';
require_once __DIR__ . '/ServiceCatalog.php';
require_once __DIR__ . '/SoftwareSubscriptionService.php';
require_once __DIR__ . '/TurneroClinicProfile.php';

function clinic_profile_config_path(): string
{
    $storePathsFile = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'lib' . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'StorePaths.php';
    if (is_file($storePathsFile) && !class_exists('StorePaths', false)) {
        require_once $storePathsFile;
    }
    if (class_exists('StorePaths', false)) {
        $dir = StorePaths::dataDirPath() . DIRECTORY_SEPARATOR . 'config';
    } else {
        $dir = defined('APP_DATA_DIR') ? APP_DATA_DIR . DIRECTORY_SEPARATOR . 'config' : __DIR__ . '/../data/config';
    }
    return $dir . DIRECTORY_SEPARATOR . 'clinic-profile.json';
}

function read_clinic_profile(): array
{
    $default = [
        'clinicName' => 'Aurora Derm',
        'address' => '',
        'phone' => '',
        'logoImage' => '',
        'software_plan' => 'Free',
        'software_subscription' => SoftwareSubscriptionService::normalizeSubscription([], 'free'),
    ];

    $path = clinic_profile_config_path();
    if (!is_file($path)) {
        return $default;
    }

    $raw = @file_get_contents($path);
    if (!is_string($raw)) {
        return $default;
    }

    $parsed = json_decode($raw, true);
    if (!is_array($parsed)) {
        return $default;
    }

    return clinic_profile_merge($default, $parsed);
}

function write_clinic_profile(array $profile): bool
{
    $path = clinic_profile_config_path();
    $dir = dirname($path);

    if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) {
        return false;
    }

    $encoded = json_encode($profile, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($encoded)) {
        return false;
    }

    $bytes = @file_put_contents($path, $encoded . PHP_EOL, LOCK_EX);
    if (!is_int($bytes)) {
        return false;
    }

    @chmod($path, 0664);
    return true;
}

function clinic_profile_merge(array $current, array $source): array
{
    $next = $current;
    $currentSubscription = SoftwareSubscriptionService::normalizeClinicProfileSubscription($current);
    $next['software_subscription'] = $currentSubscription;

    if (isset($source['clinicName']) && is_string($source['clinicName'])) {
        $next['clinicName'] = trim($source['clinicName']);
        if ($next['clinicName'] === '') {
            $next['clinicName'] = 'Aurora Derm';
        }
    }

    if (isset($source['address']) && is_string($source['address'])) {
        $next['address'] = trim($source['address']);
    }

    if (isset($source['phone']) && is_string($source['phone'])) {
        $next['phone'] = trim($source['phone']);
    }

    if (isset($source['logoImage']) && is_string($source['logoImage'])) {
        $next['logoImage'] = trim($source['logoImage']);
    }

    if (isset($source['software_plan']) && is_string($source['software_plan'])) {
        $planKey = SoftwareSubscriptionService::normalizePlanKey((string) $source['software_plan']);
        if (SoftwareSubscriptionService::canManuallyEditPlan($currentSubscription)) {
            $next['software_subscription'] = SoftwareSubscriptionService::applyManualPlanSelection(
                $currentSubscription,
                $planKey
            );
            $next['software_plan'] = SoftwareSubscriptionService::planLabel($planKey);
        }
    }

    if (isset($source['software_subscription']) && is_array($source['software_subscription'])) {
        $mergedSubscription = array_merge($currentSubscription, $source['software_subscription']);
        $next['software_subscription'] = SoftwareSubscriptionService::normalizeSubscription(
            $mergedSubscription,
            SoftwareSubscriptionService::derivePlanKeyFromClinicProfile($next)
        );
        $next['software_plan'] = SoftwareSubscriptionService::planLabel(
            (string) ($next['software_subscription']['planKey'] ?? 'free')
        );
    }

    return $next;
}

function clinic_profile_validate_logo_image(string $base64): bool
{
    if ($base64 === '') {
        return true;
    }

    if (!preg_match('/^data:image\/(png|jpeg);base64,/', $base64)) {
        return false;
    }

    $sizeInBytes = (int) (strlen($base64) * 0.75);
    if ($sizeInBytes > 512 * 1024) {
        return false;
    }

    return true;
}

function clinic_profile_public_brand_name(array $profile, array $turneroProfile): string
{
    $candidates = [
        (string) ($profile['clinicName'] ?? ''),
        (string) ($turneroProfile['branding']['name'] ?? ''),
        AppConfig::BRAND_NAME,
    ];

    foreach ($candidates as $candidate) {
        $value = trim($candidate);
        if ($value !== '') {
            return $value;
        }
    }

    return AppConfig::BRAND_NAME;
}

function clinic_profile_public_logo(array $profile, array $turneroProfile): string
{
    $candidates = [
        (string) ($profile['logoImage'] ?? ''),
        (string) ($turneroProfile['branding']['logo_url'] ?? ''),
    ];

    foreach ($candidates as $candidate) {
        $value = trim($candidate);
        if ($value !== '') {
            return $value;
        }
    }

    return '';
}

function clinic_profile_public_colors(array $turneroProfile): array
{
    $theme = isset($turneroProfile['branding']['theme']) && is_array($turneroProfile['branding']['theme'])
        ? $turneroProfile['branding']['theme']
        : [];

    $primary = strtolower((string) ($theme['primary_color'] ?? '#248a65'));
    $accent = strtolower((string) ($theme['accent_color'] ?? '#e6aa16'));

    if (!preg_match('/^#[a-f0-9]{6}$/', $primary)) {
        $primary = '#248a65';
    }
    if (!preg_match('/^#[a-f0-9]{6}$/', $accent)) {
        $accent = '#e6aa16';
    }

    return [
        'primary' => $primary,
        'accent' => $accent,
    ];
}

function clinic_profile_default_business_hours(): array
{
    $slots = AppConfig::getAvailabilitySlots();
    $weekdays = array_values(array_filter(
        is_array($slots['weekdays'] ?? null) ? $slots['weekdays'] : [],
        static fn ($slot): bool => is_string($slot) && trim($slot) !== ''
    ));
    $saturday = array_values(array_filter(
        is_array($slots['saturday'] ?? null) ? $slots['saturday'] : [],
        static fn ($slot): bool => is_string($slot) && trim($slot) !== ''
    ));

    $hours = [];
    if ($weekdays !== []) {
        $hours[] = sprintf(
            'Lunes a viernes · %s a %s',
            trim((string) $weekdays[0]),
            trim((string) $weekdays[count($weekdays) - 1])
        );
    }
    if ($saturday !== []) {
        $hours[] = sprintf(
            'Sábado · %s a %s',
            trim((string) $saturday[0]),
            trim((string) $saturday[count($saturday) - 1])
        );
    }

    return $hours;
}

function clinic_profile_public_business_hours(array $turneroProfile): array
{
    $hours = isset($turneroProfile['branding']['business_hours']) && is_array($turneroProfile['branding']['business_hours'])
        ? array_values(array_filter(array_map(
            static fn ($hour): string => trim((string) $hour),
            $turneroProfile['branding']['business_hours']
        ), static fn (string $hour): bool => $hour !== ''))
        : [];

    return $hours !== [] ? $hours : clinic_profile_default_business_hours();
}

function clinic_profile_public_doctor_directory(): array
{
    return [
        'rosero' => 'Dr. Javier Rosero',
        'narvaez' => 'Dra. Carolina Narvaez',
        'indiferente' => 'Cualquiera disponible',
    ];
}

/**
 * @param array<int,array<string,mixed>> $catalogServices
 * @return array<int,array<string,mixed>>
 */
function clinic_profile_public_active_doctors(array $doctorProfile, array $catalogServices): array
{
    $directory = clinic_profile_public_doctor_directory();
    $active = [];
    $knownNames = [];

    $primaryName = trim((string) ($doctorProfile['fullName'] ?? ''));
    if ($primaryName !== '') {
        $primaryKey = strtolower($primaryName);
        $knownNames[$primaryKey] = true;
        $active[] = [
            'id' => 'primary',
            'name' => $primaryName,
            'specialty' => trim((string) ($doctorProfile['specialty'] ?? '')),
            'active' => true,
        ];
    }

    foreach ($catalogServices as $service) {
        $doctorIds = is_array($service['doctor_profile'] ?? null)
            ? $service['doctor_profile']
            : [];

        foreach ($doctorIds as $doctorId) {
            $normalizedId = service_catalog_normalize_token((string) $doctorId);
            if ($normalizedId === '' || $normalizedId === 'indiferente') {
                continue;
            }

            $name = trim((string) ($directory[$normalizedId] ?? service_catalog_humanize_slug($normalizedId)));
            $nameKey = strtolower($name);
            if ($name === '' || isset($knownNames[$nameKey])) {
                continue;
            }

            $knownNames[$nameKey] = true;
            $active[] = [
                'id' => $normalizedId,
                'name' => $name,
                'specialty' => 'Dermatologia',
                'active' => true,
            ];
        }
    }

    return $active;
}

/**
 * @param array<int,array<string,mixed>> $catalogServices
 * @return array<int,array<string,mixed>>
 */
function clinic_profile_public_services_snapshot(array $catalogServices): array
{
    $services = [];

    foreach ($catalogServices as $service) {
        $slug = service_catalog_normalize_token((string) ($service['slug'] ?? ''));
        if ($slug === '') {
            continue;
        }

        $name = trim((string) ($service['name'] ?? ($service['hero'] ?? '')));
        if ($name === '') {
            $name = service_catalog_humanize_slug($slug);
        }

        $services[] = [
            'slug' => $slug,
            'name' => $name,
            'category' => service_catalog_normalize_token((string) ($service['category'] ?? '')),
            'summary' => trim((string) ($service['summary'] ?? '')),
            'duration' => trim((string) ($service['duration'] ?? '')),
            'priceFrom' => is_numeric($service['base_price_usd'] ?? null)
                ? (float) $service['base_price_usd']
                : (is_numeric($service['price_from'] ?? null) ? (float) $service['price_from'] : null),
            'href' => '/es/servicios/' . $slug . '/',
            'doctorProfile' => array_values(array_filter(array_map(
                static fn ($doctorId): string => service_catalog_normalize_token((string) $doctorId),
                is_array($service['doctor_profile'] ?? null) ? $service['doctor_profile'] : []
            ))),
        ];
    }

    return $services;
}

function clinic_profile_public_snapshot(): array
{
    $profile = read_clinic_profile();
    $turneroProfile = read_turnero_clinic_profile();
    $doctorProfile = read_doctor_profile();
    $catalogServices = service_catalog_services('public_route');

    $clinicName = clinic_profile_public_brand_name($profile, $turneroProfile);
    $logo = clinic_profile_public_logo($profile, $turneroProfile);
    $colors = clinic_profile_public_colors($turneroProfile);
    $businessHours = clinic_profile_public_business_hours($turneroProfile);
    $activeDoctors = clinic_profile_public_active_doctors($doctorProfile, $catalogServices);
    $services = clinic_profile_public_services_snapshot($catalogServices);

    $address = trim((string) ($profile['address'] ?? ($turneroProfile['branding']['address'] ?? AppConfig::ADDRESS)));
    if ($address === '') {
        $address = AppConfig::ADDRESS;
    }

    $phone = trim((string) ($profile['phone'] ?? ($turneroProfile['branding']['phone'] ?? '')));
    if ($phone === '') {
        $phone = trim((string) ($turneroProfile['branding']['whatsapp'] ?? AppConfig::WHATSAPP_NUMBER));
    }

    return [
        'clinicName' => $clinicName,
        'name' => $clinicName,
        'address' => $address,
        'phone' => $phone,
        'logoImage' => $logo,
        'logo' => $logo,
        'colors' => $colors,
        'businessHours' => $businessHours,
        'horarios' => $businessHours,
        'activeDoctors' => $activeDoctors,
        'doctoresActivos' => $activeDoctors,
        'services' => $services,
        'updatedAt' => trim((string) ($profile['updatedAt'] ?? '')),
        'branding' => [
            'name' => $clinicName,
            'logo' => $logo,
            'address' => $address,
            'phone' => $phone,
            'primaryColor' => $colors['primary'],
            'accentColor' => $colors['accent'],
        ],
    ];
}
