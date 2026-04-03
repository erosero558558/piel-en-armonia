<?php

declare(strict_types=1);

require_once __DIR__ . '/../db.php';

final class ReferralService
{
    public static function attributeConversion(string $referralCode, string $patientId): void
    {
        $referralCode = trim($referralCode);
        $patientId = trim($patientId);

        if ($referralCode === '' || $patientId === '') {
            return;
        }

        try {
            ensure_db_schema();
            $pdo = get_db_connection();
            if (!$pdo instanceof PDO) {
                return;
            }

            $driver = strtolower((string) $pdo->getAttribute(PDO::ATTR_DRIVER_NAME));
            $upsertSql = $driver === 'sqlite'
                ? 'INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)'
                : 'INSERT INTO kv_store (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)';

            $ownerStmt = $pdo->prepare(
                "SELECT patient_id FROM referrals WHERE code = ? AND status = 'active' LIMIT 1"
            );
            $ownerStmt->execute([$referralCode]);
            $owner = $ownerStmt->fetch(PDO::FETCH_ASSOC);
            if (!is_array($owner)) {
                return;
            }

            if (hash_equals(trim((string) ($owner['patient_id'] ?? '')), $patientId)) {
                return;
            }

            $idempotencyKey = 'referral_converted_' . $patientId;
            $existingStmt = $pdo->prepare('SELECT `key` FROM kv_store WHERE `key` = ? LIMIT 1');
            $existingStmt->execute([$idempotencyKey]);
            if (is_array($existingStmt->fetch(PDO::FETCH_ASSOC))) {
                return;
            }

            $pdo->beginTransaction();

            $updateStmt = $pdo->prepare(
                "UPDATE referrals SET conversions = conversions + 1 WHERE code = ? AND status = 'active'"
            );
            $updateStmt->execute([$referralCode]);
            if ($updateStmt->rowCount() > 0) {
                $kvStmt = $pdo->prepare($upsertSql);
                $kvStmt->execute([$idempotencyKey, $referralCode]);
                $pdo->commit();
                return;
            }

            $pdo->rollBack();
        } catch (Throwable $error) {
            if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
        }
    }
}
