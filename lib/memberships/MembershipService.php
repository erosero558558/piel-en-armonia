<?php

declare(strict_types=1);

/**
 * MembershipService — Aurora Derm store-based membership engine.
 *
 * S17-06: Enforcement of active membership status flag in API responses.
 * S17-07: Membership status + renewal awareness in patient portal.
 *
 * Storage key: $store['memberships'][] — array of membership records.
 */
final class MembershipService
{
    public const PLAN_BASICO    = 'basico';
    public const PLAN_PRO       = 'pro';
    public const PLAN_ENTERPRISE = 'enterprise';

    public const PLAN_PERKS = [
        self::PLAN_BASICO => [
            'priority_booking'    => false,
            'discount_percent'    => 5,
            'free_consult_months' => 0,
            'label'               => 'Plan Básico',
        ],
        self::PLAN_PRO => [
            'priority_booking'    => true,
            'discount_percent'    => 15,
            'free_consult_months' => 1,
            'label'               => 'Plan Pro',
        ],
        self::PLAN_ENTERPRISE => [
            'priority_booking'    => true,
            'discount_percent'    => 25,
            'free_consult_months' => 3,
            'label'               => 'Plan Enterprise',
        ],
    ];

    // ────────────────────────────────────────────────────────────────
    // Public API
    // ────────────────────────────────────────────────────────────────

    /**
     * Backward-compatible read used by legacy controllers/read-models.
     *
     * Returns the active membership record for the current store or null if none.
     */
    public function getStatus(string $patientId): ?array
    {
        if (!function_exists('read_store')) {
            return null;
        }

        return self::getActiveMembership(read_store(), $patientId);
    }

    /**
     * Returns the active membership for a patient, or null if none.
     */
    public static function getActiveMembership(array $store, string $patientId): ?array
    {
        $patientId = trim($patientId);
        if ($patientId === '') {
            return null;
        }

        $now = time();
        $latest = null;
        $latestTs = 0;

        foreach (($store['memberships'] ?? []) as $m) {
            if (!is_array($m)) {
                continue;
            }

            if (trim((string) ($m['patient_id'] ?? '')) !== $patientId) {
                continue;
            }

            if (strtolower(trim((string) ($m['status'] ?? ''))) !== 'active') {
                continue;
            }

            $expiresAt = trim((string) ($m['expires_at'] ?? ''));
            if ($expiresAt !== '') {
                $expTs = strtotime($expiresAt);
                if ($expTs !== false && $expTs <= $now) {
                    continue; // expired
                }
            }

            $issuedTs = strtotime((string) ($m['issued_at'] ?? '')) ?: 0;
            if ($issuedTs >= $latestTs) {
                $latestTs = $issuedTs;
                $latest = $m;
            }
        }

        return $latest;
    }

    /**
     * Returns full status payload for a patient — consumed by portal dashboard and API.
     */
    public static function getMembershipStatus(array $store, string $patientId): array
    {
        $patientId = trim($patientId);
        $membership = self::getActiveMembership($store, $patientId);

        if ($membership === null) {
            $expired = self::getLatestExpiredMembership($store, $patientId);
            if ($expired !== null) {
                return self::buildStatusPayload($expired, 'expired');
            }

            return [
                'status'           => 'none',
                'statusLabel'      => 'Sin membresía activa',
                'plan'             => '',
                'planLabel'        => '',
                'expiresAt'        => '',
                'daysRemaining'    => 0,
                'renewalWarning'   => false,
                'priorityBooking'  => false,
                'discountPercent'  => 0,
                'perks'            => [],
                'canRenew'         => true,
                'renewLabel'       => 'Activa tu membresía',
            ];
        }

        return self::buildStatusPayload($membership, 'active');
    }

    /**
     * Issues or renews a membership for a patient.
     * Returns ['ok' => true, 'store' => $updatedStore, 'membership' => $record].
     */
    public static function issueMembership(
        array $store,
        string $patientId,
        string $plan,
        int $daysValid = 365
    ): array {
        $patientId = trim($patientId);
        $plan      = trim($plan);
        if ($patientId === '' || $plan === '') {
            return ['ok' => false, 'error' => 'patient_id y plan son obligatorios.'];
        }
        if (!isset(self::PLAN_PERKS[$plan])) {
            return ['ok' => false, 'error' => 'Plan no reconocido: ' . $plan];
        }

        // Deactivate existing active memberships.
        $memberships = [];
        foreach (($store['memberships'] ?? []) as $m) {
            if (
                is_array($m)
                && trim((string) ($m['patient_id'] ?? '')) === $patientId
                && strtolower(trim((string) ($m['status'] ?? ''))) === 'active'
            ) {
                $m['status'] = 'expired';
                $m['expiredAt'] = date('c');
            }
            $memberships[] = $m;
        }

        $issuedAt  = date('c');
        $expiresAt = date('c', strtotime('+' . $daysValid . ' days'));
        $record = [
            'id'             => 'mbr-' . strtoupper(bin2hex(random_bytes(6))),
            'patient_id'     => $patientId,
            'plan'           => $plan,
            'status'         => 'active',
            'issued_at'      => $issuedAt,
            'expires_at'     => $expiresAt,
            'days_valid'     => $daysValid,
        ];

        $memberships[] = $record;
        $store['memberships'] = $memberships;

        return ['ok' => true, 'store' => $store, 'membership' => $record];
    }

    /**
     * Returns true if the patient has an active membership with priority_booking.
     */
    public static function hasPriorityBooking(array $store, string $patientId): bool
    {
        $m = self::getActiveMembership($store, $patientId);
        if ($m === null) {
            return false;
        }

        $plan = trim((string) ($m['plan'] ?? ''));
        return (bool) (self::PLAN_PERKS[$plan]['priority_booking'] ?? false);
    }

    /**
     * Returns discount percent for the patient's active membership (0 if none).
     */
    public static function getDiscountPercent(array $store, string $patientId): int
    {
        $m = self::getActiveMembership($store, $patientId);
        if ($m === null) {
            return 0;
        }

        $plan = trim((string) ($m['plan'] ?? ''));
        return (int) (self::PLAN_PERKS[$plan]['discount_percent'] ?? 0);
    }

    // ────────────────────────────────────────────────────────────────
    // Private helpers
    // ────────────────────────────────────────────────────────────────

    private static function buildStatusPayload(array $membership, string $status): array
    {
        $plan      = trim((string) ($membership['plan'] ?? ''));
        $perks     = self::PLAN_PERKS[$plan] ?? [];
        $expiresAt = trim((string) ($membership['expires_at'] ?? ''));
        $daysRemaining = 0;
        $renewalWarning = false;

        if ($expiresAt !== '') {
            $expTs = strtotime($expiresAt);
            if ($expTs !== false) {
                $daysRemaining = max(0, (int) ceil(($expTs - time()) / 86400));
                $renewalWarning = $daysRemaining <= 30 && $status === 'active';
            }
        }

        return [
            'status'          => $status,
            'statusLabel'     => $status === 'active'
                ? ($renewalWarning ? 'Vence pronto' : 'Activa')
                : 'Vencida',
            'plan'            => $plan,
            'planLabel'       => (string) ($perks['label'] ?? $plan),
            'expiresAt'       => $expiresAt,
            'daysRemaining'   => $daysRemaining,
            'renewalWarning'  => $renewalWarning,
            'renewalMessage'  => $renewalWarning
                ? 'Tu membresía vence en ' . $daysRemaining . ' días. Renueva para conservar tus beneficios.'
                : '',
            'priorityBooking' => (bool) ($perks['priority_booking'] ?? false),
            'discountPercent' => (int) ($perks['discount_percent'] ?? 0),
            'perks'           => self::buildPerksArray($perks),
            'canRenew'        => true,
            'renewLabel'      => $renewalWarning ? 'Renovar membresía' : 'Ver mi membresía',
        ];
    }

    private static function buildPerksArray(array $perks): array
    {
        $list = [];
        if (!empty($perks['priority_booking'])) {
            $list[] = ['key' => 'priority_booking', 'label' => 'Agendamiento prioritario'];
        }
        if (!empty($perks['discount_percent'])) {
            $list[] = ['key' => 'discount', 'label' => (int) $perks['discount_percent'] . '% de descuento en consultas'];
        }
        if (!empty($perks['free_consult_months'])) {
            $list[] = ['key' => 'free_consult', 'label' => (int) $perks['free_consult_months'] . ' mes(es) de consultas incluidas'];
        }
        return $list;
    }

    private static function getLatestExpiredMembership(array $store, string $patientId): ?array
    {
        $latest = null;
        $latestTs = 0;

        foreach (($store['memberships'] ?? []) as $m) {
            if (!is_array($m)) {
                continue;
            }
            if (trim((string) ($m['patient_id'] ?? '')) !== $patientId) {
                continue;
            }

            $issuedTs = strtotime((string) ($m['issued_at'] ?? '')) ?: 0;
            if ($issuedTs >= $latestTs) {
                $latestTs = $issuedTs;
                $latest = $m;
            }
        }

        return $latest;
    }
}
