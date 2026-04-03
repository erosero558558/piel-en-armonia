<?php

declare(strict_types=1);

final class CheckoutPaymentGateway
{
    public static
    function buildCardIntentRequest(array $payload): array
    {
        $order = CheckoutOrderService::normalizeOrderDraft($payload);
        $order['paymentMethod'] = 'card';
        $order['paymentStatus'] = 'pending_gateway';
        $order['paymentProvider'] = 'stripe';
        if (trim((string) ($order['dueAt'] ?? '')) === '') {
            $order['dueAt'] = CheckoutOrderService::buildDefaultDueAt(
                (string) ($order['createdAt'] ?? local_date('c')),
                'card'
            );
        }

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

    public static

    public static
    function attachCardIntent(array $order, array $intent): array
    {
        $order['paymentIntentId'] = trim((string) ($intent['id'] ?? ''));
        $order['paymentIntentStatus'] = trim((string) ($intent['status'] ?? ''));
        $order['updatedAt'] = local_date('c');
        return $order;
    }

    public static

    public static
    function attachTransferProof(
        array $order,
        array $upload,
        array $payload = []
    ): array {
        CheckoutOrderService::assertTransferOrder($order);

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

    public static

    public static
    function verifyTransfer(array $order): array
    {
        CheckoutOrderService::assertTransferOrder($order);
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

    public static

    public static
    function applyTransfer(array $order): array
    {
        CheckoutOrderService::assertTransferOrder($order);
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

    public static

    public static
    function confirmPaidCardOrder(array $order, array $intent): array
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

    public static

}
