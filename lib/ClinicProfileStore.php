<?php

declare(strict_types=1);

require_once __DIR__ . '/SoftwareSubscriptionService.php';

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
