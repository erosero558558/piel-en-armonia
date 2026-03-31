<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/gift_cards/GiftCardService.php';
require_once __DIR__ . '/../lib/storage.php';
require_once __DIR__ . '/../lib/validation.php';

final class GiftCardController
{
    public static function issue(array $context): void
    {
        $payload = require_json_body();

        $amountCents = self::resolveAmountCents($payload);
        if ($amountCents <= 0) {
            json_response([
                'ok' => false,
                'error' => 'El monto debe ser mayor a cero.',
            ], 400);
        }

        $senderName = truncate_field(trim((string) ($payload['sender'] ?? $payload['issuer'] ?? '')), 120);
        $recipientName = truncate_field(trim((string) ($payload['recipient'] ?? '')), 120);
        $recipientEmail = strtolower(trim((string) ($payload['email'] ?? $payload['recipient_email'] ?? '')));
        $note = truncate_field(trim((string) ($payload['note'] ?? '')), 180);

        if ($senderName === '') {
            json_response([
                'ok' => false,
                'error' => 'La persona que regala es obligatoria.',
            ], 400);
        }

        if ($recipientName === '') {
            json_response([
                'ok' => false,
                'error' => 'La persona destinataria es obligatoria.',
            ], 400);
        }

        if ($recipientEmail !== '' && !validate_email($recipientEmail)) {
            json_response([
                'ok' => false,
                'error' => 'El correo del destinatario no es valido.',
            ], 400);
        }

        $lockResult = with_store_lock(static function () use ($amountCents, $senderName, $recipientName, $recipientEmail, $note): array {
            $service = new GiftCardService();
            $result = $service->issue(
                read_store(),
                $amountCents,
                $senderName,
                $recipientEmail,
                [
                    'recipient_name' => $recipientName,
                    'sender_name' => $senderName,
                    'note' => $note,
                ]
            );

            if (!write_store($result['store'], false)) {
                return [
                    'ok' => false,
                    'error' => 'No se pudo guardar la gift card.',
                    'code' => 503,
                ];
            }

            return [
                'ok' => true,
                'giftCard' => $result['giftCard'],
            ];
        });

        if (
            ($lockResult['ok'] ?? false) !== true ||
            !is_array($lockResult['result'] ?? null) ||
            (($lockResult['result']['ok'] ?? false) !== true)
        ) {
            $result = is_array($lockResult['result'] ?? null) ? $lockResult['result'] : $lockResult;
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'No se pudo emitir la gift card.'),
            ], (int) ($result['code'] ?? 503));
        }

        $giftCard = is_array($lockResult['result']['giftCard'] ?? null) ? $lockResult['result']['giftCard'] : [];

        json_response([
            'ok' => true,
            'data' => [
                'code' => (string) ($giftCard['code'] ?? ''),
                'qrData' => (string) ($giftCard['qr_data'] ?? ''),
                'qrImageUrl' => (string) ($giftCard['qr_image_url'] ?? ''),
                'giftCard' => $giftCard,
            ],
        ], 201);
    }

    /**
     * @param array<string,mixed> $payload
     */
    private static function resolveAmountCents(array $payload): int
    {
        if (isset($payload['amount_cents'])) {
            $raw = $payload['amount_cents'];
            if (is_int($raw)) {
                return $raw;
            }

            if (is_string($raw) && preg_match('/^\d+$/', trim($raw)) === 1) {
                return (int) trim($raw);
            }
        }

        $rawAmount = $payload['amount'] ?? null;
        if (is_int($rawAmount)) {
            return $rawAmount * 100;
        }

        if (is_float($rawAmount)) {
            return (int) round($rawAmount * 100);
        }

        if (is_string($rawAmount)) {
            $normalized = str_replace(',', '.', trim($rawAmount));
            if (is_numeric($normalized)) {
                return (int) round(((float) $normalized) * 100);
            }
        }

        return 0;
    }
}
