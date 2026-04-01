<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/memberships/MembershipService.php';
require_once __DIR__ . '/../lib/packages/PackageService.php';
require_once __DIR__ . '/../lib/PatientPortalAuth.php';

/**
 * MembershipController — S17-06, S17-07, S17-08
 *
 * Endpoints:
 *   GET  /api.php?resource=membership-status&patient_id=X
 *   POST /api.php?resource=membership-issue
 *   GET  /api.php?resource=package-balance&patient_id=X
 *   POST /api.php?resource=package-activate
 *   POST /api.php?resource=package-consume
 */
final class MembershipController
{
    // ── S17-07: Membership status ─────────────────────────────────

    public static function status(array $context): void
    {
        $store     = is_array($context['store'] ?? null) ? $context['store'] : [];
        $patientId = trim((string) ($_GET['patient_id'] ?? ''));

        if ($patientId === '') {
            $authSession = PatientPortalAuth::authenticateSession($store, PatientPortalAuth::bearerTokenFromRequest());
            if (($authSession['ok'] ?? false) === true) {
                $sessionData = is_array($authSession['data'] ?? null) ? $authSession['data'] : [];
                $patientInfo = is_array($sessionData['patient'] ?? null) ? $sessionData['patient'] : [];
                $patientId   = (string) ($patientInfo['id'] ?? '');
            }
        }

        if ($patientId === '') {
            json_response(['ok' => false, 'error' => 'patient_id requerido'], 400);
            return;
        }

        $svc = new MembershipService();
        $record = $svc->getStatus($patientId);

        $status = 'inactive';
        $expiresAt = null;
        $daysRemaining = 0;
        $perks = [];

        if ($record !== null) {
            $status = 'active';
            $expiresAt = $record['expires_at'] ?? null;
            $perks = ['Descuento de 15% en cierre de consulta', 'Priority Booking Especial'];
            
            if ($expiresAt) {
                $expireTime = strtotime($expiresAt);
                $nowTime = time();
                $diff = $expireTime - $nowTime;
                $daysRemaining = $diff > 0 ? (int)floor($diff / 86400) : 0;
            }
        }

        json_response([
            'ok'   => true,
            'data' => [
                'status' => $status,
                'expires_at' => $expiresAt,
                'days_remaining' => $daysRemaining,
                'perks' => $perks
            ],
        ]);
    }

    // ── S17-06: Issue / renew membership ─────────────────────────

    public static function issue(array $context): void
    {
        require_admin_auth();

        $store   = is_array($context['store'] ?? null) ? $context['store'] : [];
        $payload = require_json_body();

        $patientId = trim((string) ($payload['patient_id'] ?? ''));
        $plan      = trim((string) ($payload['plan'] ?? ''));
        $days      = max(1, (int) ($payload['days_valid'] ?? 365));

        if ($patientId === '' || $plan === '') {
            json_response(['ok' => false, 'error' => 'patient_id y plan son obligatorios'], 400);
            return;
        }

        $result = MembershipService::issueMembership($store, $patientId, $plan, $days);
        if (($result['ok'] ?? false) !== true) {
            json_response(['ok' => false, 'error' => $result['error'] ?? 'Error al emitir membresía'], 422);
            return;
        }

        $nextStore = is_array($result['store'] ?? null) ? $result['store'] : $store;
        if (!write_store($nextStore, false)) {
            json_response(['ok' => false, 'error' => 'No se pudo guardar la membresía'], 500);
            return;
        }

        json_response(['ok' => true, 'data' => $result['membership']]);
    }

    // ── S17-08: Package balance ────────────────────────────────────

    public static function packageBalance(array $context): void
    {
        $store     = is_array($context['store'] ?? null) ? $context['store'] : [];
        $patientId = trim((string) ($_GET['patient_id'] ?? ''));

        if ($patientId === '') {
            json_response(['ok' => false, 'error' => 'patient_id requerido'], 400);
            return;
        }

        $balances = PackageService::getBalance($store, $patientId);

        json_response([
            'ok'   => true,
            'data' => [
                'patientId' => $patientId,
                'packages'  => $balances,
                'count'     => count($balances),
            ],
        ]);
    }

    // ── S17-08: Activate package ──────────────────────────────────

    public static function activatePackage(array $context): void
    {
        require_admin_auth();

        $store   = is_array($context['store'] ?? null) ? $context['store'] : [];
        $payload = require_json_body();

        $patientId     = trim((string) ($payload['patient_id'] ?? ''));
        $packageId     = trim((string) ($payload['package_id'] ?? ''));
        $packageName   = trim((string) ($payload['package_name'] ?? $packageId));
        $totalSessions = max(1, (int) ($payload['total_sessions'] ?? 1));
        $serviceCode   = trim((string) ($payload['service_code'] ?? '')) ?: null;

        if ($patientId === '' || $packageId === '') {
            json_response(['ok' => false, 'error' => 'patient_id y package_id son obligatorios'], 400);
            return;
        }

        $result = PackageService::activatePackage($store, $patientId, $packageId, $packageName, $totalSessions, $serviceCode);
        if (($result['ok'] ?? false) !== true) {
            $code = (string) ($result['code'] ?? '');
            $status = $code === 'duplicate_active_package' ? 409 : 422;
            json_response(['ok' => false, 'error' => $result['error'] ?? 'Error al activar paquete', 'code' => $code], $status);
            return;
        }

        $nextStore = is_array($result['store'] ?? null) ? $result['store'] : $store;
        if (!write_store($nextStore, false)) {
            json_response(['ok' => false, 'error' => 'No se pudo guardar el paquete'], 500);
            return;
        }

        json_response(['ok' => true, 'data' => $result['package']]);
    }

    // ── S17-08: Consume session ────────────────────────────────────

    public static function consumeSession(array $context): void
    {
        require_admin_auth();

        $store   = is_array($context['store'] ?? null) ? $context['store'] : [];
        $payload = require_json_body();

        $patientId     = trim((string) ($payload['patient_id'] ?? ''));
        $packageId     = trim((string) ($payload['package_id'] ?? ''));
        $appointmentId = trim((string) ($payload['appointment_id'] ?? ''));

        if ($patientId === '' || $packageId === '') {
            json_response(['ok' => false, 'error' => 'patient_id y package_id son obligatorios'], 400);
            return;
        }

        $result = PackageService::consumeSession($store, $patientId, $packageId, $appointmentId);
        if (($result['ok'] ?? false) !== true) {
            $code = (string) ($result['code'] ?? '');
            $status = $code === 'package_exhausted' ? 409 : 404;
            json_response(['ok' => false, 'error' => $result['error'] ?? 'Error al consumir sesión', 'code' => $code], $status);
            return;
        }

        $nextStore = is_array($result['store'] ?? null) ? $result['store'] : $store;
        if (!write_store($nextStore, false)) {
            json_response(['ok' => false, 'error' => 'No se pudo guardar el consumo de sesión'], 500);
            return;
        }

        json_response(['ok' => true, 'data' => $result['balance']]);
    }

    // ── Helper: enforce admin auth ────────────────────────────────

    public static function requireAdminAuth(): void
    {
        if (function_exists('require_admin_auth')) {
            require_admin_auth();
        }
    }

    public static function handle(array $context): void
    {
        $resource = $context['resource'] ?? '';
        $method = $context['method'] ?? 'GET';
        $key = "$method:$resource";
        
        switch ($key) {
            case 'GET:membership-status':
                self::status($context);
                return;
            case 'POST:membership-issue':
                self::issue($context);
                return;
            case 'GET:package-balance':
                self::packageBalance($context);
                return;
            case 'POST:package-activate':
                self::activatePackage($context);
                return;
            case 'POST:package-consume':
                self::consumeSession($context);
                return;
            default:
                if (isset($context['action'])) {
                    $action = $context['action'];
                    switch ($action) {
                        case 'status':
                            self::status($context);
                            return;
                        case 'issue':
                            self::issue($context);
                            return;
                        case 'packageBalance':
                            self::packageBalance($context);
                            return;
                        case 'activatePackage':
                            self::activatePackage($context);
                            return;
                        case 'consumeSession':
                            self::consumeSession($context);
                            return;
                    }
                }
                json_response(['ok' => false, 'error' => 'Not found in controller dispatch: ' . $key], 404);
        }
    }
}
