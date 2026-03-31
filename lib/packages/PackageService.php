<?php

declare(strict_types=1);

/**
 * PackageService — Session-package engine for Aurora Derm.
 *
 * S17-08: activatePackage, consumeSession, getBalance.
 *
 * Storage key: $store['patient_packages'][] — package records per patient.
 */
final class PackageService
{
    // ────────────────────────────────────────────────────────────────
    // Public API
    // ────────────────────────────────────────────────────────────────

    /**
     * Activates a new package for a patient.
     * Returns ['ok' => true, 'store' => $updatedStore, 'package' => $record].
     */
    public static function activatePackage(
        array $store,
        string $patientId,
        string $packageId,
        string $packageName,
        int $totalSessions,
        ?string $serviceCode = null
    ): array {
        $patientId = trim($patientId);
        $packageId = trim($packageId);
        if ($patientId === '' || $packageId === '' || $totalSessions <= 0) {
            return ['ok' => false, 'error' => 'patient_id, package_id y total_sessions son obligatorios.'];
        }

        // Check for existing active package of same type.
        foreach (($store['patient_packages'] ?? []) as $p) {
            if (
                is_array($p)
                && trim((string) ($p['patient_id'] ?? '')) === $patientId
                && trim((string) ($p['package_id'] ?? '')) === $packageId
                && strtolower(trim((string) ($p['status'] ?? ''))) === 'active'
            ) {
                return ['ok' => false, 'error' => 'Ya existe un paquete activo de este tipo para el paciente.', 'code' => 'duplicate_active_package'];
            }
        }

        $record = [
            'id'               => 'pkg-' . strtoupper(bin2hex(random_bytes(6))),
            'patient_id'       => $patientId,
            'package_id'       => $packageId,
            'package_name'     => trim($packageName),
            'service_code'     => $serviceCode !== null ? trim($serviceCode) : '',
            'total_sessions'   => $totalSessions,
            'used_sessions'    => 0,
            'remaining_sessions' => $totalSessions,
            'status'           => 'active',
            'activated_at'     => date('c'),
            'expires_at'       => date('c', strtotime('+1 year')),
            'history'          => [],
        ];

        $packages = $store['patient_packages'] ?? [];
        $packages[] = $record;
        $store['patient_packages'] = $packages;

        return ['ok' => true, 'store' => $store, 'package' => $record];
    }

    /**
     * Consumes one session from the patient's active package.
     * Returns ['ok' => true, 'store' => $updatedStore, 'balance' => $balanceArray].
     */
    public static function consumeSession(
        array $store,
        string $patientId,
        string $packageId,
        string $appointmentId = ''
    ): array {
        $patientId = trim($patientId);
        $packageId = trim($packageId);

        $packages = $store['patient_packages'] ?? [];
        $found = false;
        $updatedPackage = null;

        foreach ($packages as $i => $p) {
            if (!is_array($p)) {
                continue;
            }
            if (
                trim((string) ($p['patient_id'] ?? '')) !== $patientId
                || trim((string) ($p['package_id'] ?? '')) !== $packageId
                || strtolower(trim((string) ($p['status'] ?? ''))) !== 'active'
            ) {
                continue;
            }

            $remaining = (int) ($p['remaining_sessions'] ?? 0);
            if ($remaining <= 0) {
                return ['ok' => false, 'error' => 'El paquete no tiene sesiones disponibles.', 'code' => 'package_exhausted'];
            }

            $packages[$i]['used_sessions']      = (int) ($p['used_sessions'] ?? 0) + 1;
            $packages[$i]['remaining_sessions']  = $remaining - 1;
            $packages[$i]['last_used_at']        = date('c');
            $packages[$i]['history'][]           = [
                'action'         => 'consume',
                'at'             => date('c'),
                'appointment_id' => trim($appointmentId),
            ];

            if ($packages[$i]['remaining_sessions'] <= 0) {
                $packages[$i]['status'] = 'exhausted';
            }

            $updatedPackage = $packages[$i];
            $found = true;
            break;
        }

        if (!$found) {
            return ['ok' => false, 'error' => 'No se encontró un paquete activo para este paciente y tipo.', 'code' => 'package_not_found'];
        }

        $store['patient_packages'] = $packages;
        $balance = self::buildBalancePayload($updatedPackage);

        return ['ok' => true, 'store' => $store, 'balance' => $balance];
    }

    /**
     * Returns the balance/progress of all packages for a patient.
     */
    public static function getBalance(array $store, string $patientId): array
    {
        $patientId = trim($patientId);
        $balances = [];

        foreach (($store['patient_packages'] ?? []) as $p) {
            if (!is_array($p)) {
                continue;
            }
            if (trim((string) ($p['patient_id'] ?? '')) !== $patientId) {
                continue;
            }

            $balances[] = self::buildBalancePayload($p);
        }

        return $balances;
    }

    /**
     * Returns a single active package balance for a given service code.
     */
    public static function getActiveBalanceForService(array $store, string $patientId, string $serviceCode): ?array
    {
        $patientId   = trim($patientId);
        $serviceCode = trim($serviceCode);

        foreach (($store['patient_packages'] ?? []) as $p) {
            if (!is_array($p)) {
                continue;
            }
            if (
                trim((string) ($p['patient_id'] ?? '')) === $patientId
                && trim((string) ($p['service_code'] ?? '')) === $serviceCode
                && strtolower(trim((string) ($p['status'] ?? ''))) === 'active'
                && (int) ($p['remaining_sessions'] ?? 0) > 0
            ) {
                return self::buildBalancePayload($p);
            }
        }

        return null;
    }

    // ────────────────────────────────────────────────────────────────
    // Private
    // ────────────────────────────────────────────────────────────────

    private static function buildBalancePayload(array $p): array
    {
        $total     = (int) ($p['total_sessions'] ?? 0);
        $used      = (int) ($p['used_sessions'] ?? 0);
        $remaining = (int) ($p['remaining_sessions'] ?? 0);
        $pct       = $total > 0 ? (int) round(($used / $total) * 100) : 0;

        return [
            'id'               => (string) ($p['id'] ?? ''),
            'packageId'        => (string) ($p['package_id'] ?? ''),
            'packageName'      => (string) ($p['package_name'] ?? ''),
            'serviceCode'      => (string) ($p['service_code'] ?? ''),
            'status'           => (string) ($p['status'] ?? 'active'),
            'statusLabel'      => self::statusLabel((string) ($p['status'] ?? 'active')),
            'totalSessions'    => $total,
            'usedSessions'     => $used,
            'remainingSessions' => $remaining,
            'progressPercent'  => $pct,
            'progressLabel'    => $used . ' de ' . $total . ' sesiones usadas',
            'remainingLabel'   => $remaining === 1
                ? '1 sesión disponible'
                : $remaining . ' sesiones disponibles',
            'activatedAt'      => (string) ($p['activated_at'] ?? ''),
            'expiresAt'        => (string) ($p['expires_at'] ?? ''),
            'lastUsedAt'       => (string) ($p['last_used_at'] ?? ''),
        ];
    }

    private static function statusLabel(string $status): string
    {
        return match ($status) {
            'active'    => 'Activo',
            'exhausted' => 'Agotado',
            'expired'   => 'Vencido',
            'cancelled' => 'Cancelado',
            default     => ucfirst($status),
        };
    }
}
