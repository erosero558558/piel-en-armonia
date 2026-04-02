<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/ClinicProfileStore.php';
require_once __DIR__ . '/../lib/audit.php';

final class ClinicProfileController
{
    public static function show(array $context): void
    {
        header('Cache-Control: public, max-age=300, s-maxage=300');
        json_response([
            'ok' => true,
            'data' => clinic_profile_public_snapshot(),
            'meta' => [
                'scope' => 'public',
                'generatedAt' => gmdate('c'),
            ],
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

        $actorEmail = 'admin';
        if (session_status() === PHP_SESSION_ACTIVE && isset($_SESSION['admin_logged_in'])) {
            $actorEmail = (string) ($_SESSION['admin_auth_user'] ?? 'admin');
        } elseif (function_exists('operator_auth_is_authenticated') && operator_auth_is_authenticated()) {
            if (function_exists('operator_auth_session')) {
                $sess = operator_auth_session();
                $actorEmail = (string) ($sess['email'] ?? 'operator');
            } else {
                $actorEmail = 'operator';
            }
        }
        
        $oldForAudit = $current;
        $newForAudit = $next;
        unset($oldForAudit['updatedAt']);
        unset($newForAudit['updatedAt']);
        audit_log_config_changes($oldForAudit, $newForAudit, $actorEmail);

        json_response([
            'ok' => true,
            'data' => $next,
            'path' => clinic_profile_config_path(),
        ]);
    }

    public static function handle(array $context): void
    {
        $resource = $context['resource'] ?? '';
        $method = $context['method'] ?? 'GET';
        $key = "$method:$resource";
        
        switch ($key) {
            case 'GET:clinic-profile':
                self::show($context);
                return;
            case 'POST:clinic-profile':
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
