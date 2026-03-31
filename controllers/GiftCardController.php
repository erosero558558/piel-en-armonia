<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/gift_cards/GiftCardService.php';
require_once __DIR__ . '/../lib/storage.php';
require_once __DIR__ . '/../lib/validation.php';
require_once __DIR__ . '/../payment-lib.php';

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

    public static function validate(array $context): void
    {
        $code = self::normalizeCode($_GET['code'] ?? '');
        if ($code === '') {
            json_response([
                'ok' => false,
                'error' => 'El codigo de gift card es obligatorio.',
                'errorCode' => 'gift_card_code_required',
            ], 400);
        }

        $service = new GiftCardService();
        $giftCard = $service->validate(read_store(), $code);
        if (!is_array($giftCard)) {
            json_response([
                'ok' => false,
                'error' => 'La gift card no esta disponible para uso.',
                'errorCode' => 'gift_card_not_available',
            ], 404);
        }

        json_response([
            'ok' => true,
            'data' => self::buildGiftCardPayload($giftCard),
        ], 200);
    }

    public static function redeem(array $context): void
    {
        $payload = require_json_body();
        $code = self::normalizeCode($payload['code'] ?? '');
        if ($code === '') {
            json_response([
                'ok' => false,
                'error' => 'El codigo de gift card es obligatorio.',
                'errorCode' => 'gift_card_code_required',
            ], 400);
        }

        $actor = truncate_field(
            trim((string) ($payload['actor'] ?? $payload['redeemedBy'] ?? '')),
            120
        );
        $caseId = truncate_field(trim((string) ($payload['caseId'] ?? '')), 80);
        $sessionId = truncate_field(trim((string) ($payload['sessionId'] ?? '')), 80);
        $appointmentId = self::resolveAppointmentId($payload);

        $lockResult = with_store_lock(static function () use (
            $payload,
            $code,
            $actor,
            $caseId,
            $sessionId,
            $appointmentId
        ): array {
            $store = read_store();
            $appointmentIndex = self::findAppointmentIndexById($store, $appointmentId);
            $appointment = $appointmentIndex !== null
                ? (is_array($store['appointments'][$appointmentIndex] ?? null) ? $store['appointments'][$appointmentIndex] : null)
                : null;

            if ($appointmentId > 0 && $appointment === null) {
                return [
                    'ok' => false,
                    'error' => 'No se encontro la cita asociada al canje.',
                    'errorCode' => 'gift_card_appointment_not_found',
                    'code' => 404,
                ];
            }

            if (self::appointmentAlreadyRedeemed($appointment)) {
                return [
                    'ok' => false,
                    'error' => 'Esta cita ya tiene una gift card aplicada.',
                    'errorCode' => 'gift_card_already_applied',
                    'code' => 409,
                ];
            }

            if (self::appointmentAlreadySettled($appointment)) {
                return [
                    'ok' => false,
                    'error' => 'La cita ya se encuentra pagada y no admite gift card adicional.',
                    'errorCode' => 'gift_card_appointment_already_paid',
                    'code' => 409,
                ];
            }

            $amountCents = self::resolveRedeemAmountCents($payload, $appointment);
            if ($amountCents <= 0) {
                return [
                    'ok' => false,
                    'error' => 'No se pudo determinar el monto a canjear.',
                    'errorCode' => 'gift_card_amount_required',
                    'code' => 400,
                ];
            }

            $reference = self::buildRedemptionReference(
                $payload,
                $appointment,
                $caseId,
                $sessionId
            );
            $service = new GiftCardService();
            $result = $service->redeem($store, $code, $amountCents, [
                'reference' => $reference,
            ]);

            if (($result['ok'] ?? false) !== true || !is_array($result['giftCard'] ?? null)) {
                $mapped = self::mapRedeemError($result['error'] ?? '');
                return [
                    'ok' => false,
                    'error' => $mapped['message'],
                    'errorCode' => $mapped['code'],
                    'code' => $mapped['status'],
                    'giftCard' => is_array($result['giftCard'] ?? null) ? $result['giftCard'] : null,
                ];
            }

            $store = is_array($result['store'] ?? null) ? $result['store'] : $store;
            $giftCard = $result['giftCard'];
            $appointmentSnapshot = null;

            if ($appointmentIndex !== null && $appointment !== null) {
                $updatedAppointment = self::decorateRedeemedAppointment(
                    $appointment,
                    $giftCard,
                    $amountCents,
                    $reference,
                    $actor
                );
                $store['appointments'][$appointmentIndex] = $updatedAppointment;
                $appointmentSnapshot = $updatedAppointment;
            }

            if (!write_store($store, false)) {
                return [
                    'ok' => false,
                    'error' => 'No se pudo guardar el canje de gift card.',
                    'errorCode' => 'gift_card_write_failed',
                    'code' => 503,
                ];
            }

            return [
                'ok' => true,
                'giftCard' => $giftCard,
                'appointment' => $appointmentSnapshot,
                'amountCents' => $amountCents,
                'reference' => $reference,
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
                'error' => (string) ($result['error'] ?? 'No se pudo redimir la gift card.'),
                'errorCode' => (string) ($result['errorCode'] ?? 'gift_card_redeem_failed'),
                'data' => [
                    'giftCard' => is_array($result['giftCard'] ?? null)
                        ? self::buildGiftCardPayload($result['giftCard'])
                        : null,
                ],
            ], (int) ($result['code'] ?? 503));
        }

        $result = $lockResult['result'];
        $giftCard = is_array($result['giftCard'] ?? null) ? $result['giftCard'] : [];
        $appointment = is_array($result['appointment'] ?? null) ? $result['appointment'] : null;

        json_response([
            'ok' => true,
            'data' => [
                'giftCard' => self::buildGiftCardPayload($giftCard),
                'amountCents' => (int) ($result['amountCents'] ?? 0),
                'amountLabel' => self::formatUsdCents((int) ($result['amountCents'] ?? 0)),
                'reference' => (string) ($result['reference'] ?? ''),
                'appointment' => is_array($appointment) ? self::buildAppointmentPayload($appointment) : null,
            ],
        ], 200);
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

    /**
     * @param mixed $value
     */
    private static function normalizeCode($value): string
    {
        $normalized = strtoupper(trim((string) $value));
        $normalized = preg_replace('/[^A-Z0-9\-]/', '', $normalized);
        return is_string($normalized) ? $normalized : '';
    }

    /**
     * @param array<string,mixed> $giftCard
     * @return array<string,mixed>
     */
    private static function buildGiftCardPayload(array $giftCard): array
    {
        $balanceCents = (int) ($giftCard['balance_cents'] ?? 0);

        return [
            'code' => (string) ($giftCard['code'] ?? ''),
            'status' => (string) ($giftCard['status'] ?? ''),
            'amount_cents' => (int) ($giftCard['amount_cents'] ?? 0),
            'balance_cents' => $balanceCents,
            'balanceLabel' => self::formatUsdCents($balanceCents),
            'currency' => (string) ($giftCard['currency'] ?? 'USD'),
            'recipient_name' => (string) ($giftCard['recipient_name'] ?? ''),
            'recipient_email' => (string) ($giftCard['recipient_email'] ?? ''),
            'issued_at' => (string) ($giftCard['issued_at'] ?? ''),
            'expires_at' => (string) ($giftCard['expires_at'] ?? ''),
            'qrData' => (string) ($giftCard['qr_data'] ?? ''),
            'qrImageUrl' => (string) ($giftCard['qr_image_url'] ?? ''),
            'redemptions' => is_array($giftCard['redemptions'] ?? null)
                ? array_values($giftCard['redemptions'])
                : [],
            'giftCard' => $giftCard,
        ];
    }

    /**
     * @param array<string,mixed>|null $appointment
     * @return array<string,mixed>|null
     */
    private static function buildAppointmentPayload(?array $appointment): ?array
    {
        if (!is_array($appointment)) {
            return null;
        }

        return [
            'id' => (int) ($appointment['id'] ?? 0),
            'service' => (string) ($appointment['service'] ?? ''),
            'date' => (string) ($appointment['date'] ?? ''),
            'time' => (string) ($appointment['time'] ?? ''),
            'paymentMethod' => (string) ($appointment['paymentMethod'] ?? ''),
            'paymentStatus' => (string) ($appointment['paymentStatus'] ?? ''),
            'giftCardCode' => (string) ($appointment['giftCardCode'] ?? ''),
            'giftCardAppliedAt' => (string) ($appointment['giftCardAppliedAt'] ?? ''),
            'giftCardAppliedAmountCents' => (int) ($appointment['giftCardAppliedAmountCents'] ?? 0),
            'giftCardBalanceCents' => (int) ($appointment['giftCardBalanceCents'] ?? 0),
        ];
    }

    /**
     * @param array<string,mixed> $payload
     */
    private static function resolveAppointmentId(array $payload): int
    {
        $raw = $payload['appointmentId'] ?? null;
        if (is_int($raw)) {
            return $raw > 0 ? $raw : 0;
        }
        if (is_string($raw) && preg_match('/^\d+$/', trim($raw)) === 1) {
            return max(0, (int) trim($raw));
        }
        return 0;
    }

    /**
     * @param array<string,mixed> $store
     */
    private static function findAppointmentIndexById(array $store, int $appointmentId): ?int
    {
        if ($appointmentId <= 0) {
            return null;
        }

        $appointments = isset($store['appointments']) && is_array($store['appointments'])
            ? $store['appointments']
            : [];
        foreach ($appointments as $index => $appointment) {
            if (!is_array($appointment)) {
                continue;
            }
            if ((int) ($appointment['id'] ?? 0) === $appointmentId) {
                return (int) $index;
            }
        }

        return null;
    }

    /**
     * @param array<string,mixed> $payload
     * @param array<string,mixed>|null $appointment
     */
    private static function resolveRedeemAmountCents(array $payload, ?array $appointment): int
    {
        $explicit = self::resolveAmountCents($payload);
        if ($explicit > 0) {
            return $explicit;
        }

        if (!is_array($appointment)) {
            return 0;
        }

        $service = trim((string) ($appointment['service'] ?? ''));
        $date = trim((string) ($appointment['date'] ?? ''));
        $time = trim((string) ($appointment['time'] ?? ''));
        $tenantId = trim((string) ($appointment['tenantId'] ?? ''));

        if ($service !== '' && function_exists('payment_expected_amount_cents')) {
            $amount = payment_expected_amount_cents($service, $date, $time, $tenantId !== '' ? $tenantId : null);
            if ($amount > 0) {
                return $amount;
            }
        }

        $rawPrice = $appointment['price'] ?? null;
        if (is_int($rawPrice)) {
            return max(0, $rawPrice * 100);
        }
        if (is_float($rawPrice)) {
            return max(0, (int) round($rawPrice * 100));
        }
        if (is_string($rawPrice)) {
            $normalized = str_replace(',', '.', trim($rawPrice));
            if (is_numeric($normalized)) {
                return max(0, (int) round(((float) $normalized) * 100));
            }
        }

        return 0;
    }

    /**
     * @param array<string,mixed> $payload
     * @param array<string,mixed>|null $appointment
     */
    private static function buildRedemptionReference(
        array $payload,
        ?array $appointment,
        string $caseId,
        string $sessionId
    ): string {
        $explicit = truncate_field(trim((string) ($payload['reference'] ?? '')), 120);
        if ($explicit !== '') {
            return $explicit;
        }

        $chunks = ['clinical_close'];
        $appointmentId = is_array($appointment) ? (int) ($appointment['id'] ?? 0) : 0;
        if ($appointmentId > 0) {
            $chunks[] = 'appt_' . $appointmentId;
        }
        if ($caseId !== '') {
            $chunks[] = 'case_' . $caseId;
        }
        if ($sessionId !== '') {
            $chunks[] = 'session_' . $sessionId;
        }

        return truncate_field(implode(':', $chunks), 120);
    }

    /**
     * @param array<string,mixed>|null $appointment
     */
    private static function appointmentAlreadyRedeemed(?array $appointment): bool
    {
        if (!is_array($appointment)) {
            return false;
        }

        return trim((string) ($appointment['giftCardAppliedAt'] ?? '')) !== ''
            || strtolower(trim((string) ($appointment['paymentMethod'] ?? ''))) === 'gift_card';
    }

    /**
     * @param array<string,mixed>|null $appointment
     */
    private static function appointmentAlreadySettled(?array $appointment): bool
    {
        if (!is_array($appointment)) {
            return false;
        }

        return strtolower(trim((string) ($appointment['paymentStatus'] ?? ''))) === 'paid'
            && strtolower(trim((string) ($appointment['paymentMethod'] ?? ''))) !== 'gift_card';
    }

    /**
     * @param array<string,mixed> $appointment
     * @param array<string,mixed> $giftCard
     * @return array<string,mixed>
     */
    private static function decorateRedeemedAppointment(
        array $appointment,
        array $giftCard,
        int $amountCents,
        string $reference,
        string $actor
    ): array {
        $appointment['paymentMethod'] = 'gift_card';
        $appointment['paymentStatus'] = 'paid';
        $appointment['paymentPaidAt'] = local_date('c');
        $appointment['giftCardCode'] = (string) ($giftCard['code'] ?? '');
        $appointment['giftCardStatus'] = (string) ($giftCard['status'] ?? '');
        $appointment['giftCardValidatedAt'] = (string) ($appointment['giftCardValidatedAt'] ?? local_date('c'));
        $appointment['giftCardAppliedAt'] = local_date('c');
        $appointment['giftCardAppliedAmountCents'] = $amountCents;
        $appointment['giftCardBalanceCents'] = (int) ($giftCard['balance_cents'] ?? 0);
        $appointment['giftCardRecipientName'] = (string) ($giftCard['recipient_name'] ?? '');
        $appointment['giftCardRedemptionReference'] = $reference;
        if ($actor !== '') {
            $appointment['giftCardRedeemedBy'] = $actor;
        }

        return $appointment;
    }

    /**
     * @param mixed $errorCode
     * @return array{status:int,code:string,message:string}
     */
    private static function mapRedeemError($errorCode): array
    {
        $normalized = trim((string) $errorCode);
        if ($normalized === 'gift_card_not_found') {
            return [
                'status' => 404,
                'code' => 'gift_card_not_found',
                'message' => 'La gift card no existe.',
            ];
        }
        if ($normalized === 'gift_card_inactive') {
            return [
                'status' => 409,
                'code' => 'gift_card_inactive',
                'message' => 'La gift card ya no esta activa.',
            ];
        }
        if ($normalized === 'gift_card_insufficient_balance') {
            return [
                'status' => 409,
                'code' => 'gift_card_insufficient_balance',
                'message' => 'La gift card no tiene saldo suficiente para esta cita.',
            ];
        }
        if ($normalized === 'invalid_amount') {
            return [
                'status' => 400,
                'code' => 'gift_card_amount_required',
                'message' => 'El monto a canjear debe ser mayor a cero.',
            ];
        }

        return [
            'status' => 503,
            'code' => 'gift_card_redeem_failed',
            'message' => 'No se pudo redimir la gift card.',
        ];
    }

    private static function formatUsdCents(int $amountCents): string
    {
        return '$' . number_format($amountCents / 100, 2, '.', '');
    }
}
