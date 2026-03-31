<?php

declare(strict_types=1);

require_once __DIR__ . '/../validation.php';

final class GiftCardService
{
    private const CODE_PREFIX = 'AUR-GIFT';
    private const DEFAULT_EXPIRY_DAYS = 90;
    private const QR_SIZE = '240x240';

    /**
     * @param array<string,mixed> $store
     * @param array<string,mixed> $options
     * @return array{store:array<string,mixed>,giftCard:array<string,mixed>}
     */
    public function issue(array $store, int $amountCents, string $issuerId, string $recipientEmail = '', array $options = []): array
    {
        if ($amountCents <= 0) {
            throw new InvalidArgumentException('El monto debe ser mayor a cero.');
        }

        $issuerId = self::normalizeLabel($issuerId, 120);
        if ($issuerId === '') {
            throw new InvalidArgumentException('La persona emisora es obligatoria.');
        }

        $recipientName = self::normalizeLabel((string) ($options['recipient_name'] ?? ''), 120);
        if ($recipientName === '') {
            throw new InvalidArgumentException('La persona destinataria es obligatoria.');
        }

        $senderName = self::normalizeLabel((string) ($options['sender_name'] ?? $issuerId), 120);
        $note = self::normalizeText((string) ($options['note'] ?? ''), 180);
        $recipientEmail = self::normalizeEmail($recipientEmail);
        if ($recipientEmail !== '' && !validate_email($recipientEmail)) {
            throw new InvalidArgumentException('El correo del destinatario no es valido.');
        }

        $store = self::normalizeStore($store);
        $issuedAt = trim((string) ($options['issued_at'] ?? ''));
        if ($issuedAt === '') {
            $issuedAt = local_date('c');
        }
        $expiresAt = self::normalizeExpiry((string) ($options['expires_at'] ?? ''), $issuedAt);
        $code = self::generateUniqueCode($store['gift_cards']);

        $giftCard = self::normalizeGiftCardRecord([
            'id' => $code,
            'code' => $code,
            'amount_cents' => $amountCents,
            'balance_cents' => $amountCents,
            'issuer_id' => $issuerId,
            'recipient_email' => $recipientEmail,
            'recipient_name' => $recipientName,
            'sender_name' => $senderName,
            'note' => $note,
            'issued_at' => $issuedAt,
            'expires_at' => $expiresAt,
            'status' => 'active',
            'currency' => 'USD',
            'redemptions' => [],
        ], $code);

        if ($giftCard === null) {
            throw new RuntimeException('No se pudo generar la gift card.');
        }

        $store['gift_cards'][$code] = $giftCard;
        $store['updatedAt'] = local_date('c');

        return [
            'store' => $store,
            'giftCard' => $giftCard,
        ];
    }

    /**
     * @param array<string,mixed> $store
     * @return array<string,mixed>|null
     */
    public function validate(array $store, string $code): ?array
    {
        $store = self::normalizeStore($store);
        $normalizedCode = self::normalizeCode($code);
        if ($normalizedCode === '') {
            return null;
        }

        $giftCard = $store['gift_cards'][$normalizedCode] ?? null;
        if (!is_array($giftCard)) {
            return null;
        }

        if (($giftCard['status'] ?? 'active') !== 'active') {
            return null;
        }

        if ((int) ($giftCard['balance_cents'] ?? 0) <= 0) {
            return null;
        }

        return $giftCard;
    }

    /**
     * @param array<string,mixed> $store
     * @param array<string,mixed> $options
     * @return array{ok:bool,store:array<string,mixed>,giftCard:array<string,mixed>|null,error?:string}
     */
    public function redeem(array $store, string $code, int $amountCents, array $options = []): array
    {
        $store = self::normalizeStore($store);
        $normalizedCode = self::normalizeCode($code);
        if ($normalizedCode === '' || !isset($store['gift_cards'][$normalizedCode])) {
            return [
                'ok' => false,
                'store' => $store,
                'giftCard' => null,
                'error' => 'gift_card_not_found',
            ];
        }

        if ($amountCents <= 0) {
            return [
                'ok' => false,
                'store' => $store,
                'giftCard' => $store['gift_cards'][$normalizedCode],
                'error' => 'invalid_amount',
            ];
        }

        $giftCard = $store['gift_cards'][$normalizedCode];
        if (($giftCard['status'] ?? 'active') !== 'active') {
            return [
                'ok' => false,
                'store' => $store,
                'giftCard' => $giftCard,
                'error' => 'gift_card_inactive',
            ];
        }

        $balanceCents = (int) ($giftCard['balance_cents'] ?? 0);
        if ($amountCents > $balanceCents) {
            return [
                'ok' => false,
                'store' => $store,
                'giftCard' => $giftCard,
                'error' => 'gift_card_insufficient_balance',
            ];
        }

        $redemptions = is_array($giftCard['redemptions'] ?? null)
            ? array_values(array_filter($giftCard['redemptions'], 'is_array'))
            : [];
        $redemptions[] = [
            'amount_cents' => $amountCents,
            'redeemed_at' => local_date('c'),
            'reference' => self::normalizeText((string) ($options['reference'] ?? ''), 120),
        ];

        $giftCard['balance_cents'] = $balanceCents - $amountCents;
        $giftCard['redemptions'] = $redemptions;
        $giftCard['status'] = $giftCard['balance_cents'] <= 0 ? 'redeemed' : 'active';

        $store['gift_cards'][$normalizedCode] = self::normalizeGiftCardRecord($giftCard, $normalizedCode);
        $store['updatedAt'] = local_date('c');

        return [
            'ok' => true,
            'store' => $store,
            'giftCard' => $store['gift_cards'][$normalizedCode],
        ];
    }

    /**
     * @param array<string,mixed> $store
     * @return array<string,mixed>
     */
    private static function normalizeStore(array $store): array
    {
        $giftCards = isset($store['gift_cards']) && is_array($store['gift_cards']) ? $store['gift_cards'] : [];
        $normalized = [];

        foreach ($giftCards as $key => $giftCard) {
            if (!is_array($giftCard)) {
                continue;
            }

            $normalizedCard = self::normalizeGiftCardRecord($giftCard, is_string($key) ? $key : '');
            if ($normalizedCard === null) {
                continue;
            }

            $normalized[$normalizedCard['code']] = $normalizedCard;
        }

        $store['gift_cards'] = $normalized;
        return $store;
    }

    /**
     * @param array<string,mixed> $giftCard
     * @return array<string,mixed>|null
     */
    private static function normalizeGiftCardRecord(array $giftCard, string $fallbackCode = ''): ?array
    {
        $code = self::normalizeCode((string) ($giftCard['code'] ?? $giftCard['id'] ?? $fallbackCode));
        if ($code === '') {
            return null;
        }

        $amountCents = max(0, self::toInt($giftCard['amount_cents'] ?? 0));
        $balanceCents = max(0, self::toInt($giftCard['balance_cents'] ?? $amountCents));
        $issuedAt = trim((string) ($giftCard['issued_at'] ?? local_date('c')));
        $expiresAt = self::normalizeExpiry((string) ($giftCard['expires_at'] ?? ''), $issuedAt);
        $status = self::deriveStatus((string) ($giftCard['status'] ?? ''), $balanceCents, $expiresAt);
        $qrData = trim((string) ($giftCard['qr_data'] ?? ''));
        if ($qrData === '') {
            $qrData = self::buildQrData($code);
        }

        return [
            'id' => $code,
            'code' => $code,
            'amount_cents' => $amountCents,
            'balance_cents' => $balanceCents,
            'issuer_id' => self::normalizeLabel((string) ($giftCard['issuer_id'] ?? ''), 120),
            'recipient_email' => self::normalizeEmail((string) ($giftCard['recipient_email'] ?? '')),
            'recipient_name' => self::normalizeLabel((string) ($giftCard['recipient_name'] ?? ''), 120),
            'sender_name' => self::normalizeLabel((string) ($giftCard['sender_name'] ?? ''), 120),
            'note' => self::normalizeText((string) ($giftCard['note'] ?? ''), 180),
            'issued_at' => $issuedAt,
            'expires_at' => $expiresAt,
            'status' => $status,
            'currency' => trim((string) ($giftCard['currency'] ?? 'USD')) ?: 'USD',
            'qr_data' => $qrData,
            'qr_image_url' => self::buildQrImageUrl($qrData),
            'redemptions' => is_array($giftCard['redemptions'] ?? null)
                ? array_values(array_filter($giftCard['redemptions'], 'is_array'))
                : [],
        ];
    }

    private static function normalizeCode(string $code): string
    {
        $normalized = strtoupper(trim($code));
        $normalized = preg_replace('/[^A-Z0-9\-]/', '', $normalized);
        return is_string($normalized) ? $normalized : '';
    }

    private static function normalizeEmail(string $email): string
    {
        return strtolower(trim($email));
    }

    private static function normalizeLabel(string $value, int $maxLength): string
    {
        return truncate_field(trim($value), $maxLength);
    }

    private static function normalizeText(string $value, int $maxLength): string
    {
        return truncate_field(trim($value), $maxLength);
    }

    private static function normalizeExpiry(string $expiresAt, string $issuedAt): string
    {
        if (trim($expiresAt) !== '') {
            return trim($expiresAt);
        }

        try {
            $issued = new DateTimeImmutable($issuedAt);
            return $issued->modify('+' . self::DEFAULT_EXPIRY_DAYS . ' days')->format(DateTimeInterface::ATOM);
        } catch (Throwable $error) {
            return local_date('c');
        }
    }

    /**
     * @param array<string,array<string,mixed>> $giftCards
     */
    private static function generateUniqueCode(array $giftCards): string
    {
        do {
            try {
                $token = strtoupper(bin2hex(random_bytes(4)));
            } catch (Throwable $error) {
                $token = strtoupper(substr(md5((string) microtime(true) . ':' . (string) mt_rand()), 0, 8));
            }

            $code = self::CODE_PREFIX . '-' . $token;
        } while (isset($giftCards[$code]));

        return $code;
    }

    private static function buildQrData(string $code): string
    {
        return 'https://pielarmonia.com/es/gift-cards/?gift_card=' . rawurlencode($code);
    }

    private static function buildQrImageUrl(string $qrData): string
    {
        return 'https://api.qrserver.com/v1/create-qr-code/?size=' . self::QR_SIZE . '&data=' . rawurlencode($qrData);
    }

    private static function deriveStatus(string $status, int $balanceCents, string $expiresAt): string
    {
        $normalizedStatus = strtolower(trim($status));
        if ($normalizedStatus === 'expired' || self::isExpired($expiresAt)) {
            return 'expired';
        }

        if ($normalizedStatus === 'redeemed' || $balanceCents <= 0) {
            return 'redeemed';
        }

        return 'active';
    }

    private static function isExpired(string $expiresAt): bool
    {
        try {
            $expiry = new DateTimeImmutable($expiresAt);
            $now = new DateTimeImmutable(local_date('c'));
            return $expiry < $now;
        } catch (Throwable $error) {
            return false;
        }
    }

    /**
     * @param mixed $value
     */
    private static function toInt($value): int
    {
        if (is_int($value)) {
            return $value;
        }

        if (is_string($value) && preg_match('/^-?\d+$/', trim($value)) === 1) {
            return (int) trim($value);
        }

        if (is_float($value)) {
            return (int) round($value);
        }

        return 0;
    }
}
