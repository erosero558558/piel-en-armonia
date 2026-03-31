<?php

declare(strict_types=1);

require_once __DIR__ . '/../db.php';

class ReferralService
{
    /**
     * Gets or creates a unique referral link code for a patient.
     * Generates a code like 'REF-A1B2C' if one doesn't exist yet.
     */
    public static function getOrCreateLink(string $patientId): string
    {
        ensure_db_schema();

        // 1. Check if patient already has an active code
        $existing = db_query(
            "SELECT code FROM referrals WHERE patient_id = ? AND status = 'active' LIMIT 1",
            [$patientId]
        );

        if (!empty($existing) && is_array($existing) && count($existing) > 0) {
            return $existing[0]['code'];
        }

        // 2. Generate a unique code
        $code = self::generateUniqueCode();

        // 3. Insert into database
        $success = db_query(
            "INSERT INTO referrals (code, patient_id) VALUES (?, ?)",
            [$code, $patientId]
        );

        if ($success === false) {
            throw new Exception("Error al crear link de referidos.");
        }

        return $code;
    }

    /**
     * Retrieves statistics and benefit wallet for a given referral code.
     */
    public static function getStats(string $patientId): array
    {
        ensure_db_schema();

        // Check if patient already has an active code
        $existing = db_query(
            "SELECT code, clicks, conversions FROM referrals WHERE patient_id = ? AND status = 'active' LIMIT 1",
            [$patientId]
        );

        if (empty($existing) || !is_array($existing) || count($existing) === 0) {
            // Generates a code if one doesn't exist
            $code = self::getOrCreateLink($patientId);
            return [
                'code' => $code,
                'clicks' => 0,
                'conversions' => 0,
                'earned_benefits' => [],
                'available_benefits' => []
            ];
        }

        $code = $existing[0]['code'];
        $clicks = (int)$existing[0]['clicks'];
        $conversions = (int)$existing[0]['conversions'];
        
        // Simple business logic: 1 conversion = 1 benefit of 10%
        // (This could be expanded later to check used benefits in another table)
        // For S17-05 we show available benefits matching the conversions.
        $benefits = [];
        for ($i = 0; $i < $conversions; $i++) {
            $benefits[] = [
                'id' => "b_$i",
                'type' => 'discount',
                'description' => '10% de descuento en próxima consulta',
                'status' => 'available'
            ];
        }

        return [
            'code' => $code,
            'clicks' => $clicks,
            'conversions' => $conversions,
            'earned_benefits' => $benefits,
            'available_benefits' => $benefits // None used for now
        ];
    }

    /**
     * Registers a click on a referral link.
     */
    public static function registerClick(string $code): bool
    {
        ensure_db_schema();

        $affected = db_query(
            "UPDATE referrals SET clicks = clicks + 1 WHERE code = ? AND status = 'active'",
            [$code]
        );

        return $affected > 0;
    }

    /**
     * Attributes a conversion when a referred patient books for the first time.
     * Prevents duplicate conversions for the same new patient using kv_store.
     */
    public static function attributeConversion(string $code, string $newPatientId): bool
    {
        ensure_db_schema();
        
        $code = trim($code);
        $newPatientId = trim($newPatientId);
        
        if ($code === '' || $newPatientId === '') {
            return false;
        }

        // 1. Prevent self-referral or loop (check if code belongs to the same patient)
        $selfCheck = db_query("SELECT id FROM referrals WHERE code = ? AND patient_id = ?", [$code, $newPatientId]);
        if (!empty($selfCheck)) {
            // Can't refer yourself
            return false;
        }

        // 2. Prevent double attribution for the same new patient using kv_store
        $idempotencyKey = "referral_converted_" . $newPatientId;
        $existingConversion = db_query("SELECT key FROM kv_store WHERE key = ? LIMIT 1", [$idempotencyKey]);
        if (!empty($existingConversion)) {
            // Already converted 
            return false;
        }

        // 3. Mark the referral code conversion
        $affected = db_query(
            "UPDATE referrals SET conversions = conversions + 1 WHERE code = ? AND status = 'active'",
            [$code]
        );

        if ($affected > 0) {
            // 4. Record fact in kv_store
            db_query("INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)", [$idempotencyKey, $code]);
            return true;
        }

        return false;
    }

    /**
     * Internal method to generate a randomized code like REF-A1B2C.
     */
    private static function generateUniqueCode(int $length = 5): string
    {
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        $maxIndex = strlen($chars) - 1;
        
        while (true) {
            $randomStr = '';
            for ($i = 0; $i < $length; $i++) {
                // Ensure a cryptographically secure random number is used
                $randomStr .= $chars[random_int(0, $maxIndex)];
            }
            $code = 'REF-' . $randomStr;
            
            // Validate uniqueness
            $check = db_query("SELECT id FROM referrals WHERE code = ?", [$code]);
            if (empty($check)) {
                return $code;
            }
        }
    }
}
