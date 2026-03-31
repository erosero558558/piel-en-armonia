<?php

declare(strict_types=1);

require_once __DIR__ . '/../db.php';

class GiftCard
{
    public string $code;
    public int $amount_cents;
    public int $balance_cents;
    public ?string $issuer_id;
    public ?string $recipient_email;
    public string $status;
    public string $issued_at;
    public ?string $expires_at;

    public function __construct(array $data)
    {
        $this->code = $data['code'] ?? '';
        $this->amount_cents = (int)($data['amount_cents'] ?? 0);
        $this->balance_cents = (int)($data['balance_cents'] ?? 0);
        $this->issuer_id = $data['issuer_id'] ?? null;
        $this->recipient_email = $data['recipient_email'] ?? null;
        $this->status = $data['status'] ?? 'active';
        $this->issued_at = $data['issued_at'] ?? gmdate('Y-m-d H:i:s');
        $this->expires_at = $data['expires_at'] ?? null;
    }

    public function isActive(): bool
    {
        if ($this->status !== 'active') {
            return false;
        }
        if ($this->balance_cents <= 0) {
            return false;
        }
        if ($this->expires_at !== null && new DateTime($this->expires_at) < new DateTime()) {
            return false;
        }
        return true;
    }
}

class GiftCardService
{
    /**
     * @return GiftCard
     * @throws Exception
     */
    public static function issue(int $amountCents, ?string $issuerId, ?string $recipientEmail, int $validityDays = 365): GiftCard
    {
        if ($amountCents <= 0) {
            throw new InvalidArgumentException("Amount must be greater than zero");
        }

        $code = self::generateUniqueCode();
        $issuedAt = gmdate('Y-m-d H:i:s');
        $expiresAt = gmdate('Y-m-d H:i:s', strtotime("+$validityDays days"));

        $sql = "INSERT INTO gift_cards (code, amount_cents, balance_cents, issuer_id, recipient_email, issued_at, expires_at, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, 'active')";
                
        $params = [$code, $amountCents, $amountCents, $issuerId, $recipientEmail, $issuedAt, $expiresAt];
        
        $result = db_query($sql, $params);
        if ($result === false) {
            throw new RuntimeException("Failed to issue gift card in database");
        }

        return new GiftCard([
            'code' => $code,
            'amount_cents' => $amountCents,
            'balance_cents' => $amountCents,
            'issuer_id' => $issuerId,
            'recipient_email' => $recipientEmail,
            'issued_at' => $issuedAt,
            'expires_at' => $expiresAt,
            'status' => 'active'
        ]);
    }

    /**
     * @return GiftCard|null
     */
    public static function validate(string $code): ?GiftCard
    {
        $sql = "SELECT * FROM gift_cards WHERE code = ? LIMIT 1";
        $result = db_query($sql, [$code]);
        if (is_array($result) && count($result) > 0) {
            return new GiftCard($result[0]);
        }
        return null;
    }

    /**
     * @param string $code
     * @param int $amountCents
     * @return bool
     * @throws Exception
     */
    public static function redeem(string $code, int $amountCents): bool
    {
        if ($amountCents <= 0) {
            throw new InvalidArgumentException("Amount to redeem must be greater than zero");
        }

        // Lock pattern: verify balance and update in a single transaction-like query.
        $sql = "UPDATE gift_cards 
                SET balance_cents = balance_cents - ?, 
                    status = CASE WHEN balance_cents - ? <= 0 THEN 'redeemed' ELSE status END
                WHERE code = ? 
                  AND status = 'active'
                  AND balance_cents >= ?
                  AND (expires_at IS NULL OR expires_at >= CURRENT_TIMESTAMP)";
                  
        $params = [$amountCents, $amountCents, $code, $amountCents];
        $affectedRows = db_query($sql, $params);

        return $affectedRows > 0;
    }

    private static function generateUniqueCode(): string
    {
        // Generates an alphanumeric secure format: AD-XXXX-XXXX
        $bytes = random_bytes(6);
        $hex = strtoupper(bin2hex($bytes));
        return "AD-" . substr($hex, 0, 4) . "-" . substr($hex, 4, 4);
    }
}
