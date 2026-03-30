<?php

declare(strict_types=1);

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/validation.php';

final class CheckoutOrderService
{
    private const SUPPORT_WHATSAPP_PHONE = '593982453672';
    private const BANK_NAME = 'Banco Pichincha';
    private const BANK_ACCOUNT = 'Cuenta de Ahorros: 2200160272';
    private const BANK_OWNER = 'Titular: Rosero Caiza Javier Alejandro';
    private const MIN_AMOUNT_CENTS = 100;
    private const MAX_AMOUNT_CENTS = 500000;

    public static function publicConfig(): array
    {
        return [
            'currency' => strtoupper(payment_currency()),
            'stripeEnabled' => payment_gateway_enabled(),
            'publishableKey' => payment_stripe_publishable_key(),
            'bank' => self::bankData(),
            'support' => [
                'whatsappPhone' => self::SUPPORT_WHATSAPP_PHONE,
                'whatsappHref' => 'https://wa.me/' . self::SUPPORT_WHATSAPP_PHONE,
            ],
            'methods' => [
                'card' => [
                    'enabled' => payment_gateway_enabled(),
                    'label' => self::paymentMethodLabel('card'),
                ],
                'transfer' => [
                    'enabled' => true,
                    'label' => self::paymentMethodLabel('transfer'),
                ],
                'cash' => [
                    'enabled' => true,
                    'label' => self::paymentMethodLabel('cash'),
                ],
            ],
        ];
    }

    public static function buildCardIntentRequest(array $payload): array
    {
        $order = self::normalizeOrderDraft($payload);
        $order['paymentMethod'] = 'card';
        $order['paymentStatus'] = 'pending_gateway';
        $order['paymentProvider'] = 'stripe';

        $idempotencySeed = implode('|', [
            $order['id'],
            $order['concept'],
            (string) $order['amountCents'],
            $order['payerEmail'],
            $order['payerWhatsapp'],
        ]);

        return [
            'order' => $order,
            'idempotencyKey' => payment_build_idempotency_key('checkout-card', $idempotencySeed),
            'stripePayload' => [
                'amountCents' => (int) $order['amountCents'],
                'currency' => (string) $order['currency'],
                'concept' => (string) $order['concept'],
                'payerName' => (string) $order['payerName'],
                'payerEmail' => (string) $order['payerEmail'],
                'payerWhatsapp' => (string) $order['payerWhatsapp'],
                'description' => 'Pago Aurora Derm - ' . (string) $order['concept'],
                'metadata' => [
                    'site' => 'pielarmonia.com',
                    'surface' => 'public_checkout',
                    'order_id' => (string) $order['id'],
                    'receipt_number' => (string) $order['receiptNumber'],
                    'concept' => (string) $order['concept'],
                ],
            ],
        ];
    }

    public static function attachCardIntent(array $order, array $intent): array
    {
        $order['paymentIntentId'] = trim((string) ($intent['id'] ?? ''));
        $order['paymentIntentStatus'] = trim((string) ($intent['status'] ?? ''));
        $order['updatedAt'] = local_date('c');
        return $order;
    }

    public static function attachTransferProof(
        array $order,
        array $upload,
        array $payload = []
    ): array {
        self::assertTransferOrder($order);

        $transferReference = truncate_field(
            sanitize_xss(
                trim((string) ($payload['transferReference'] ?? $order['transferReference'] ?? ''))
            ),
            100
        );

        $order['transferReference'] = $transferReference;
        $order['transferProofPath'] = trim((string) ($upload['path'] ?? ''));
        $order['transferProofUrl'] = trim((string) ($upload['url'] ?? ''));
        $order['transferProofName'] = truncate_field(
            sanitize_xss(trim((string) ($upload['name'] ?? $upload['originalName'] ?? ''))),
            200
        );
        $order['transferProofMime'] = trim((string) ($upload['mime'] ?? ''));
        $order['transferProofSize'] = (int) ($upload['size'] ?? 0);
        $order['transferProofUploadedAt'] = local_date('c');
        $order['updatedAt'] = local_date('c');

        return $order;
    }

    public static function verifyTransfer(array $order): array
    {
        self::assertTransferOrder($order);
        $status = strtolower(trim((string) ($order['paymentStatus'] ?? '')));

        if ($status === 'verified_transfer' || $status === 'applied') {
            return $order;
        }
        if ($status !== 'pending_transfer') {
            throw new InvalidArgumentException('Solo se pueden verificar transferencias pendientes.');
        }
        if (trim((string) ($order['transferProofUrl'] ?? '')) === '' && trim((string) ($order['transferProofPath'] ?? '')) === '') {
            throw new InvalidArgumentException('Todavia no hay comprobante cargado para esta transferencia.');
        }

        $order['paymentStatus'] = 'verified_transfer';
        $order['transferVerifiedAt'] = local_date('c');
        $order['updatedAt'] = local_date('c');

        return $order;
    }

    public static function applyTransfer(array $order): array
    {
        self::assertTransferOrder($order);
        $status = strtolower(trim((string) ($order['paymentStatus'] ?? '')));

        if ($status === 'applied') {
            return $order;
        }
        if ($status !== 'verified_transfer') {
            throw new InvalidArgumentException('La transferencia debe estar verificada antes de aplicarse.');
        }

        $appliedAt = local_date('c');
        $order['paymentStatus'] = 'applied';
        $order['paymentPaidAt'] = $appliedAt;
        $order['transferAppliedAt'] = $appliedAt;
        $order['updatedAt'] = $appliedAt;

        return $order;
    }

    public static function buildOfflineMethodOrder(array $payload, string $method): array
    {
        $safeMethod = strtolower(trim($method));
        if (!in_array($safeMethod, ['transfer', 'cash'], true)) {
            throw new InvalidArgumentException('Metodo de pago no soportado.');
        }

        $order = self::normalizeOrderDraft($payload);
        $order['paymentMethod'] = $safeMethod;
        $order['paymentProvider'] = $safeMethod === 'transfer' ? 'manual_transfer' : 'cash_desk';
        $order['paymentStatus'] = $safeMethod === 'transfer' ? 'pending_transfer' : 'pending_cash';
        $order['transferReference'] = truncate_field(
            sanitize_xss(trim((string) ($payload['transferReference'] ?? ''))),
            100
        );
        $order['updatedAt'] = local_date('c');

        return $order;
    }

    public static function confirmPaidCardOrder(array $order, array $intent): array
    {
        $paymentIntentId = trim((string) ($intent['id'] ?? ''));
        $status = trim((string) ($intent['status'] ?? ''));
        $amount = (int) ($intent['amount_received'] ?? ($intent['amount'] ?? 0));
        $currency = strtoupper(trim((string) ($intent['currency'] ?? payment_currency())));
        $metadata = isset($intent['metadata']) && is_array($intent['metadata']) ? $intent['metadata'] : [];
        $metadataOrderId = trim((string) ($metadata['order_id'] ?? ''));

        if ($paymentIntentId === '' || $order['paymentIntentId'] === '' || !hash_equals((string) $order['paymentIntentId'], $paymentIntentId)) {
            throw new InvalidArgumentException('El pago confirmado no coincide con el checkout activo.');
        }
        if (!in_array($status, ['succeeded', 'requires_capture'], true)) {
            throw new InvalidArgumentException('Stripe todavia no confirma el cobro.');
        }
        if ($amount < (int) $order['amountCents']) {
            throw new InvalidArgumentException('El monto recibido no coincide con el checkout.');
        }
        if ($currency !== strtoupper((string) $order['currency'])) {
            throw new InvalidArgumentException('La moneda confirmada no coincide con el checkout.');
        }
        if ($metadataOrderId !== '' && !hash_equals((string) $order['id'], $metadataOrderId)) {
            throw new InvalidArgumentException('El pago confirmado pertenece a otro checkout.');
        }

        $order['paymentStatus'] = 'paid';
        $order['paymentIntentStatus'] = $status;
        $order['paymentPaidAt'] = local_date('c');
        $order['updatedAt'] = local_date('c');

        return $order;
    }

    public static function upsertOrder(array $store, array $order): array
    {
        $orders = isset($store['checkout_orders']) && is_array($store['checkout_orders'])
            ? $store['checkout_orders']
            : [];
        $orderId = trim((string) ($order['id'] ?? ''));
        $replaced = false;

        foreach ($orders as $index => $existing) {
            if (!is_array($existing)) {
                continue;
            }
            if ((string) ($existing['id'] ?? '') !== $orderId) {
                continue;
            }
            $orders[$index] = $order;
            $replaced = true;
            break;
        }

        if (!$replaced) {
            $orders[] = $order;
        }

        $store['checkout_orders'] = array_values($orders);
        $store['updatedAt'] = local_date('c');

        return $store;
    }

    public static function findOrder(array $store, string $orderId): ?array
    {
        $safeOrderId = trim($orderId);
        if ($safeOrderId === '') {
            return null;
        }

        $orders = isset($store['checkout_orders']) && is_array($store['checkout_orders'])
            ? $store['checkout_orders']
            : [];
        foreach ($orders as $order) {
            if (!is_array($order)) {
                continue;
            }
            if ((string) ($order['id'] ?? '') === $safeOrderId) {
                return $order;
            }
        }

        return null;
    }

    public static function buildReceipt(array $order): array
    {
        $amountCents = (int) ($order['amountCents'] ?? 0);
        $currency = strtoupper(trim((string) ($order['currency'] ?? payment_currency())));
        $method = strtolower(trim((string) ($order['paymentMethod'] ?? '')));
        $status = strtolower(trim((string) ($order['paymentStatus'] ?? 'pending')));
        $issuedAt = trim((string) ($order['paymentPaidAt'] ?? ($order['createdAt'] ?? local_date('c'))));

        return [
            'orderId' => (string) ($order['id'] ?? ''),
            'receiptNumber' => (string) ($order['receiptNumber'] ?? ''),
            'concept' => (string) ($order['concept'] ?? ''),
            'amountCents' => $amountCents,
            'amountLabel' => self::formatCurrency($amountCents, $currency),
            'currency' => $currency,
            'paymentMethod' => $method,
            'paymentMethodLabel' => self::paymentMethodLabel($method),
            'paymentStatus' => $status,
            'paymentStatusLabel' => self::paymentStatusLabel($status, $order),
            'payer' => [
                'name' => (string) ($order['payerName'] ?? ''),
                'email' => (string) ($order['payerEmail'] ?? ''),
                'whatsapp' => (string) ($order['payerWhatsapp'] ?? ''),
            ],
            'transferReference' => (string) ($order['transferReference'] ?? ''),
            'transferProofUrl' => (string) ($order['transferProofUrl'] ?? ''),
            'transferProofName' => (string) ($order['transferProofName'] ?? ''),
            'transferProofUploadedAt' => (string) ($order['transferProofUploadedAt'] ?? ''),
            'transferVerifiedAt' => (string) ($order['transferVerifiedAt'] ?? ''),
            'transferAppliedAt' => (string) ($order['transferAppliedAt'] ?? ''),
            'paymentIntentId' => (string) ($order['paymentIntentId'] ?? ''),
            'issuedAt' => $issuedAt,
            'bank' => self::bankData(),
            'support' => [
                'whatsappPhone' => self::SUPPORT_WHATSAPP_PHONE,
                'whatsappHref' => 'https://wa.me/' . self::SUPPORT_WHATSAPP_PHONE,
            ],
        ];
    }

    public static function buildAdminReviewMeta(array $store): array
    {
        $orders = isset($store['checkout_orders']) && is_array($store['checkout_orders'])
            ? $store['checkout_orders']
            : [];
        $queue = [];
        $pendingCount = 0;
        $verifiedCount = 0;
        $appliedCount = 0;
        $missingProofCount = 0;

        foreach ($orders as $order) {
            if (!is_array($order)) {
                continue;
            }

            $method = strtolower(trim((string) ($order['paymentMethod'] ?? '')));
            if ($method !== 'transfer') {
                continue;
            }

            $status = strtolower(trim((string) ($order['paymentStatus'] ?? '')));
            $hasProof = trim((string) ($order['transferProofUrl'] ?? '')) !== ''
                || trim((string) ($order['transferProofPath'] ?? '')) !== '';

            if ($status === 'pending_transfer') {
                if ($hasProof) {
                    $pendingCount += 1;
                } else {
                    $missingProofCount += 1;
                }
            } elseif ($status === 'verified_transfer') {
                $verifiedCount += 1;
            } elseif ($status === 'applied') {
                $appliedCount += 1;
            }

            if (!$hasProof && $status === 'pending_transfer') {
                continue;
            }
            if (!in_array($status, ['pending_transfer', 'verified_transfer', 'applied'], true)) {
                continue;
            }

            $receipt = self::buildReceipt($order);
            $queue[] = [
                'id' => (string) ($order['id'] ?? ''),
                'receiptNumber' => (string) ($order['receiptNumber'] ?? ''),
                'concept' => (string) ($order['concept'] ?? ''),
                'amountLabel' => (string) ($receipt['amountLabel'] ?? ''),
                'paymentStatus' => $status,
                'paymentStatusLabel' => (string) ($receipt['paymentStatusLabel'] ?? ''),
                'payerName' => (string) ($order['payerName'] ?? ''),
                'payerWhatsapp' => (string) ($order['payerWhatsapp'] ?? ''),
                'payerEmail' => (string) ($order['payerEmail'] ?? ''),
                'transferReference' => (string) ($order['transferReference'] ?? ''),
                'transferProofUrl' => (string) ($order['transferProofUrl'] ?? ''),
                'transferProofName' => (string) ($order['transferProofName'] ?? ''),
                'transferProofUploadedAt' => (string) ($order['transferProofUploadedAt'] ?? ''),
                'transferVerifiedAt' => (string) ($order['transferVerifiedAt'] ?? ''),
                'transferAppliedAt' => (string) ($order['transferAppliedAt'] ?? ''),
                'createdAt' => (string) ($order['createdAt'] ?? ''),
                'updatedAt' => (string) ($order['updatedAt'] ?? ''),
                'canVerify' => $status === 'pending_transfer' && $hasProof,
                'canApply' => $status === 'verified_transfer',
            ];
        }

        usort($queue, static function (array $left, array $right): int {
            $priority = static function (string $status): int {
                return match ($status) {
                    'pending_transfer' => 0,
                    'verified_transfer' => 1,
                    'applied' => 2,
                    default => 3,
                };
            };

            $leftPriority = $priority((string) ($left['paymentStatus'] ?? ''));
            $rightPriority = $priority((string) ($right['paymentStatus'] ?? ''));
            if ($leftPriority !== $rightPriority) {
                return $leftPriority <=> $rightPriority;
            }

            return strcmp(
                (string) ($right['updatedAt'] ?? $right['createdAt'] ?? ''),
                (string) ($left['updatedAt'] ?? $left['createdAt'] ?? '')
            );
        });

        return [
            'summary' => [
                'pendingCount' => $pendingCount,
                'verifiedCount' => $verifiedCount,
                'appliedCount' => $appliedCount,
                'missingProofCount' => $missingProofCount,
                'queueCount' => count($queue),
            ],
            'queue' => $queue,
        ];
    }

    private static function normalizeOrderDraft(array $payload): array
    {
        $payerName = truncate_field(sanitize_xss(trim((string) ($payload['name'] ?? ''))), 150);
        $payerEmail = truncate_field(trim((string) ($payload['email'] ?? '')), 254);
        $payerWhatsapp = truncate_field(sanitize_phone((string) ($payload['whatsapp'] ?? '')), 20);
        $concept = truncate_field(sanitize_xss(trim((string) ($payload['concept'] ?? ''))), 160);
        $notes = truncate_field(sanitize_xss(trim((string) ($payload['notes'] ?? ''))), 300);
        $createdAt = local_date('c');

        if ($payerName === '') {
            throw new InvalidArgumentException('El nombre del paciente o responsable es obligatorio.');
        }
        if ($concept === '') {
            throw new InvalidArgumentException('El concepto del cobro es obligatorio.');
        }
        if ($payerEmail !== '' && !validate_email($payerEmail)) {
            throw new InvalidArgumentException('El correo no tiene un formato valido.');
        }
        if ($payerEmail === '' && $payerWhatsapp === '') {
            throw new InvalidArgumentException('Necesitamos un correo o WhatsApp para emitir el recibo digital.');
        }

        return [
            'id' => self::generateOrderId(),
            'tenantId' => get_current_tenant_id(),
            'receiptNumber' => self::buildReceiptNumber($createdAt),
            'sourceRoute' => '/es/pago/',
            'concept' => $concept,
            'notes' => $notes,
            'amountCents' => self::normalizeAmountCents(
                $payload['amount'] ?? '',
                $payload['amountCents'] ?? null
            ),
            'currency' => strtoupper(payment_currency()),
            'payerName' => $payerName,
            'payerEmail' => $payerEmail,
            'payerWhatsapp' => $payerWhatsapp,
            'paymentMethod' => '',
            'paymentStatus' => 'pending',
            'paymentProvider' => '',
            'paymentIntentId' => '',
            'paymentIntentStatus' => '',
            'paymentPaidAt' => '',
            'transferReference' => '',
            'transferProofPath' => '',
            'transferProofUrl' => '',
            'transferProofName' => '',
            'transferProofMime' => '',
            'transferProofSize' => 0,
            'transferProofUploadedAt' => '',
            'transferVerifiedAt' => '',
            'transferAppliedAt' => '',
            'createdAt' => $createdAt,
            'updatedAt' => $createdAt,
        ];
    }

    private static function normalizeAmountCents($amountValue, $amountCentsValue): int
    {
        if ($amountCentsValue !== null && $amountCentsValue !== '') {
            $amountCents = (int) round((float) $amountCentsValue);
        } else {
            $rawAmount = trim((string) $amountValue);
            if ($rawAmount === '') {
                throw new InvalidArgumentException('El monto es obligatorio.');
            }

            $sanitized = preg_replace('/[^0-9.,]/', '', $rawAmount);
            if (!is_string($sanitized) || trim($sanitized) === '') {
                throw new InvalidArgumentException('El monto no tiene un formato valido.');
            }

            if (strpos($sanitized, ',') !== false && strpos($sanitized, '.') === false) {
                $sanitized = str_replace(',', '.', $sanitized);
            } else {
                $sanitized = str_replace(',', '', $sanitized);
            }

            $amount = (float) $sanitized;
            $amountCents = (int) round($amount * 100);
        }

        if ($amountCents < self::MIN_AMOUNT_CENTS || $amountCents > self::MAX_AMOUNT_CENTS) {
            throw new InvalidArgumentException('El monto debe estar entre $1.00 y $5,000.00.');
        }

        return $amountCents;
    }

    private static function generateOrderId(): string
    {
        try {
            $suffix = bin2hex(random_bytes(8));
        } catch (Throwable $error) {
            $suffix = substr(hash('sha256', (string) microtime(true)), 0, 16);
        }

        return 'co_' . $suffix;
    }

    private static function buildReceiptNumber(string $createdAt): string
    {
        $dateToken = preg_replace('/[^0-9]/', '', substr($createdAt, 0, 10));
        if (!is_string($dateToken) || $dateToken === '') {
            $dateToken = local_date('Ymd');
        }

        try {
            $suffix = strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
        } catch (Throwable $error) {
            $suffix = strtoupper(substr(hash('sha256', (string) microtime(true)), 0, 6));
        }

        return 'PAY-' . $dateToken . '-' . $suffix;
    }

    private static function formatCurrency(int $amountCents, string $currency): string
    {
        $prefix = strtoupper($currency) === 'USD' ? '$' : strtoupper($currency) . ' ';
        return $prefix . number_format($amountCents / 100, 2, '.', ',');
    }

    private static function bankData(): array
    {
        return [
            'bankName' => self::BANK_NAME,
            'account' => self::BANK_ACCOUNT,
            'owner' => self::BANK_OWNER,
        ];
    }

    private static function paymentMethodLabel(string $method): string
    {
        $labels = [
            'card' => 'Tarjeta',
            'transfer' => 'Transferencia',
            'cash' => 'Efectivo en consultorio',
        ];

        return $labels[$method] ?? 'Pendiente';
    }

    private static function paymentStatusLabel(string $status, array $order = []): string
    {
        if (
            $status === 'pending_transfer' &&
            trim((string) ($order['transferProofUploadedAt'] ?? '')) !== ''
        ) {
            return 'Pendiente de verificacion';
        }

        $labels = [
            'paid' => 'Pagado',
            'pending_gateway' => 'Esperando confirmacion de Stripe',
            'pending_transfer' => 'Pendiente de transferencia',
            'pending_cash' => 'Pendiente de pago en consultorio',
            'verified_transfer' => 'Verificado',
            'applied' => 'Aplicado',
            'failed' => 'Fallido',
        ];

        return $labels[$status] ?? 'Pendiente';
    }

    private static function assertTransferOrder(array $order): void
    {
        $method = strtolower(trim((string) ($order['paymentMethod'] ?? '')));
        if ($method !== 'transfer') {
            throw new InvalidArgumentException('El checkout indicado no usa transferencia bancaria.');
        }
    }
}
