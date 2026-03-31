<?php

declare(strict_types=1);

require_once __DIR__ . '/../db.php';

final class MembershipService
{
    private const DEFAULT_PLAN = 'member';
    private const DEFAULT_DISCOUNT_PERCENT = 15;
    private const PLAN_DISCOUNTS = [
        'gold' => 20,
        'premium' => 20,
        'member' => 15,
        'plus' => 15,
        'pro' => 15,
    ];

    /**
     * Retrieves the active membership status for a patient.
     * 
     * @param string $patientId
     * @return array|null Returns the membership record if active and not expired, or null if none.
     */
    public function getStatus(string $patientId): ?array
    {
        ensure_db_schema();
        
        $sql = "SELECT * FROM memberships 
                WHERE patient_id = ? 
                  AND status = 'active' 
                  AND (expires_at IS NULL OR expires_at > datetime('now'))
                ORDER BY created_at DESC 
                LIMIT 1";
                
        $result = db_query($sql, [$patientId]);
        
        if (is_array($result) && count($result) > 0) {
            return $result[0];
        }
        
        return null;
    }

    /**
     * Issues or renews a membership.
     */
    public function issue(string $patientId, string $plan, int $daysValid = 365): array
    {
        ensure_db_schema();
        $normalizedPlan = self::normalizePlan($plan);
        
        // Deactivate old memberships for the patient
        db_query("UPDATE memberships SET status = 'expired' WHERE patient_id = ?", [$patientId]);
        
        // Add new active membership
        $expiresAt = gmdate('Y-m-d H:i:s', strtotime("+$daysValid days"));
        $sql = "INSERT INTO memberships (patient_id, plan, status, expires_at) VALUES (?, ?, 'active', ?)";
        
        if (db_query($sql, [$patientId, $normalizedPlan, $expiresAt])) {
            return [
                'ok' => true,
                'patient_id' => $patientId,
                'plan' => $normalizedPlan,
                'status' => 'active',
                'expires_at' => $expiresAt
            ];
        }
        
        return ['ok' => false, 'error' => 'No se pudo crear la membresía.'];
    }

    public static function normalizePlan(string $plan): string
    {
        $normalized = strtolower(trim($plan));
        return $normalized !== '' ? $normalized : self::DEFAULT_PLAN;
    }

    public static function discountPercentForPlan(string $plan): int
    {
        $normalized = self::normalizePlan($plan);
        return self::PLAN_DISCOUNTS[$normalized] ?? self::DEFAULT_DISCOUNT_PERCENT;
    }

    /**
     * @param array<string,mixed>|null $membership
     * @return array{active:bool,plan:string,discount_percent:int,badge_label:string}
     */
    public static function buildStatusSnapshot(?array $membership): array
    {
        if (!is_array($membership) || $membership === []) {
            return [
                'active' => false,
                'plan' => '',
                'discount_percent' => 0,
                'badge_label' => '',
            ];
        }

        $isActive = strtolower(trim((string) ($membership['status'] ?? 'active'))) === 'active';
        if (!$isActive) {
            return [
                'active' => false,
                'plan' => '',
                'discount_percent' => 0,
                'badge_label' => '',
            ];
        }

        $plan = self::normalizePlan((string) ($membership['plan'] ?? ''));

        return [
            'active' => true,
            'plan' => $plan,
            'discount_percent' => self::discountPercentForPlan($plan),
            'badge_label' => '⭐ Miembro',
        ];
    }

    /**
     * @return array{base_amount_cents:int,discount_percent:int,discount_amount_cents:int,final_amount_cents:int}
     */
    public static function applyPlanDiscount(int $amountCents, string $plan): array
    {
        $baseAmountCents = max(0, $amountCents);
        $discountPercent = self::discountPercentForPlan($plan);
        $discountAmountCents = (int) round($baseAmountCents * ($discountPercent / 100));
        $finalAmountCents = max(0, $baseAmountCents - $discountAmountCents);

        return [
            'base_amount_cents' => $baseAmountCents,
            'discount_percent' => $discountPercent,
            'discount_amount_cents' => $discountAmountCents,
            'final_amount_cents' => $finalAmountCents,
        ];
    }
}
