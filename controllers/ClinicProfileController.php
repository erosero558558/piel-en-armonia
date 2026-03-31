<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/ClinicProfileStore.php';

final class ClinicProfileController
{
    public static function show(array $context): void
    {
        require_admin_auth();

        json_response([
            'ok' => true,
            'data' => read_clinic_profile(),
        ]);
    }

    public static function update(array $context): void
    {
        require_admin_auth();
        require_csrf();

        $payload = require_json_body();
        $source = isset($payload['clinicProfile']) && is_array($payload['clinicProfile'])
            ? $payload['clinicProfile']
            : (is_array($payload) ? $payload : []);

        $profileExists = is_file(clinic_profile_config_path());
        $current = read_clinic_profile();
        $next = clinic_profile_merge($current, $source);
        if (!$profileExists && SoftwareSubscriptionService::shouldAutoStartTrial($next)) {
            $next = SoftwareSubscriptionService::startTrial($next);
        }
        $next['updatedAt'] = function_exists('local_date') ? local_date('c') : date('c');

        if (!clinic_profile_validate_logo_image((string) ($next['logoImage'] ?? ''))) {
            json_response([
                'ok' => false,
                'error' => 'El logo debe ser una imagen PNG o JPG menor a 512 KB.',
            ], 400);
        }

        if (!write_clinic_profile($next)) {
            json_response([
                'ok' => false,
                'error' => 'No se pudo guardar el perfil de la clinica.',
            ], 500);
        }

        audit_log_event('clinic_profile.updated', [
            'clinicName' => $next['clinicName'],
            'hasLogo' => $next['logoImage'] !== '',
            'subscriptionStatus' => (string) ($next['software_subscription']['status'] ?? ''),
            'path' => basename(clinic_profile_config_path()),
        ]);

        json_response([
            'ok' => true,
            'data' => $next,
            'path' => clinic_profile_config_path(),
        ]);
    }
}
