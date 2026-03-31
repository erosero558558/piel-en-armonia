<?php

declare(strict_types=1);

require_once __DIR__ . '/../db.php';

final class MembershipService
{
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
        
        // Deactivate old memberships for the patient
        db_query("UPDATE memberships SET status = 'expired' WHERE patient_id = ?", [$patientId]);
        
        // Add new active membership
        $expiresAt = gmdate('Y-m-d H:i:s', strtotime("+$daysValid days"));
        $sql = "INSERT INTO memberships (patient_id, plan, status, expires_at) VALUES (?, ?, 'active', ?)";
        
        if (db_query($sql, [$patientId, $plan, $expiresAt])) {
            return [
                'ok' => true,
                'patient_id' => $patientId,
                'plan' => $plan,
                'status' => 'active',
                'expires_at' => $expiresAt
            ];
        }
        
        return ['ok' => false, 'error' => 'No se pudo crear la membresía.'];
    }
}
