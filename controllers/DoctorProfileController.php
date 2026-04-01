<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/DoctorProfileStore.php';

final class DoctorProfileController
{
    public static function show(array $context): void
    {
        require_admin_auth();

        json_response([
            'ok' => true,
            'data' => read_doctor_profile(),
        ]);
    }

    public static function update(array $context): void
    {
        require_admin_auth();
        require_csrf();

        $payload = require_json_body();
        $source = isset($payload['doctorProfile']) && is_array($payload['doctorProfile'])
            ? $payload['doctorProfile']
            : (is_array($payload) ? $payload : []);

        $current = read_doctor_profile();
        $next = doctor_profile_merge($current, $source);
        $next['updatedAt'] = function_exists('local_date') ? local_date('c') : date('c');

        if (!doctor_profile_validate_signature_image((string) ($next['signatureImage'] ?? ''))) {
            json_response([
                'ok' => false,
                'error' => 'La firma digital debe ser una imagen PNG o JPG menor a 512 KB.',
            ], 400);
        }

        if (!write_doctor_profile($next)) {
            json_response([
                'ok' => false,
                'error' => 'No se pudo guardar el perfil del medico.',
            ], 500);
        }

        audit_log_event('doctor_profile.updated', [
            'fullName' => $next['fullName'],
            'hasSignature' => $next['signatureImage'] !== '',
            'path' => basename(doctor_profile_config_path()),
        ]);

        json_response([
            'ok' => true,
            'data' => $next,
            'path' => doctor_profile_config_path(),
        ]);
    }

    public static function handle(array $context): void
    {
        $resource = $context['resource'] ?? '';
        $method = $context['method'] ?? 'GET';
        $key = "$method:$resource";
        
        switch ($key) {
            case 'GET:doctor-profile':
                self::show($context);
                return;
            case 'POST:doctor-profile':
                self::update($context);
                return;
            default:
                if (isset($context['action'])) {
                    $action = $context['action'];
                    switch ($action) {
                        case 'show':
                            self::show($context);
                            return;
                        case 'update':
                            self::update($context);
                            return;
                    }
                }
                json_response(['ok' => false, 'error' => 'Not found in controller dispatch: ' . $key], 404);
        }
    }
}
