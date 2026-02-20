<?php
declare(strict_types=1);

class PaymentController
{
    public static function config(array $context): void
    {
        // GET /payment-config
        json_response([
            'ok' => true,
            'provider' => 'stripe',
            'enabled' => payment_gateway_enabled(),
            'publishableKey' => payment_stripe_publishable_key(),
            'currency' => payment_currency()
        ]);
    }

    public static function createIntent(array $context): void
    {
        // POST /payment-intent
        $store = $context['store'];
        require_rate_limit('payment-intent', 8, 60);

        if (!payment_gateway_enabled()) {
            json_response([
                'ok' => false,
                'error' => 'Pasarela de pago no configurada'
            ], 503);
        }

        $payload = require_json_body();
        $appointment = normalize_appointment($payload);

        if ($appointment['service'] === '' || $appointment['name'] === '' || $appointment['email'] === '') {
            json_response([
                'ok' => false,
                'error' => 'Datos incompletos para iniciar el pago'
            ], 400);
        }

        if (!validate_email($appointment['email'])) {
            json_response([
                'ok' => false,
                'error' => 'El formato del email no es valido'
            ], 400);
        }

        if (!validate_phone($appointment['phone'])) {
            json_response([
                'ok' => false,
                'error' => 'El formato del telefono no es valido'
            ], 400);
        }

        if (!isset($appointment['privacyConsent']) || $appointment['privacyConsent'] !== true) {
            json_response([
                'ok' => false,
                'error' => 'Debes aceptar el tratamiento de datos para reservar la cita'
            ], 400);
        }

        if ($appointment['date'] === '' || $appointment['time'] === '') {
            json_response([
                'ok' => false,
                'error' => 'Fecha y hora son obligatorias'
            ], 400);
        }

        if ($appointment['date'] < local_date('Y-m-d')) {
            json_response([
                'ok' => false,
                'error' => 'No se puede agendar en una fecha pasada'
            ], 400);
        }

        if (appointment_slot_taken($store['appointments'], $appointment['date'], $appointment['time'], null, $appointment['doctor'])) {
            json_response([
                'ok' => false,
                'error' => 'Ese horario ya fue reservado'
            ], 409);
        }

        $seed = implode('|', [
            $appointment['email'],
            $appointment['service'],
            $appointment['date'],
            $appointment['time'],
            $appointment['doctor'],
            $appointment['phone']
        ]);
        $idempotencyKey = payment_build_idempotency_key('intent', $seed);

        try {
            $intent = stripe_create_payment_intent($appointment, $idempotencyKey);
        } catch (RuntimeException $e) {
            json_response([
                'ok' => false,
                'error' => 'No se pudo iniciar el pago en este momento'
            ], 502);
        }

        json_response([
            'ok' => true,
            'clientSecret' => isset($intent['client_secret']) ? (string) $intent['client_secret'] : '',
            'paymentIntentId' => isset($intent['id']) ? (string) $intent['id'] : '',
            'amount' => isset($intent['amount']) ? (int) $intent['amount'] : payment_expected_amount_cents($appointment['service']),
            'currency' => strtoupper((string) ($intent['currency'] ?? payment_currency())),
            'publishableKey' => payment_stripe_publishable_key()
        ]);
    }

    public static function verify(array $context): void
    {
        // POST /payment-verify
        require_rate_limit('payment-verify', 12, 60);

        if (!payment_gateway_enabled()) {
            json_response([
                'ok' => false,
                'error' => 'Pasarela de pago no configurada'
            ], 503);
        }

        $payload = require_json_body();
        $paymentIntentId = isset($payload['paymentIntentId']) ? trim((string) $payload['paymentIntentId']) : '';
        if ($paymentIntentId === '') {
            json_response([
                'ok' => false,
                'error' => 'paymentIntentId es obligatorio'
            ], 400);
        }

        try {
            $intent = stripe_get_payment_intent($paymentIntentId);
        } catch (RuntimeException $e) {
            json_response([
                'ok' => false,
                'error' => 'No se pudo validar el pago en este momento'
            ], 502);
        }

        $status = (string) ($intent['status'] ?? '');
        $paid = in_array($status, ['succeeded', 'requires_capture'], true);

        json_response([
            'ok' => true,
            'paid' => $paid,
            'status' => $status,
            'id' => isset($intent['id']) ? (string) $intent['id'] : $paymentIntentId,
            'amount' => isset($intent['amount']) ? (int) $intent['amount'] : 0,
            'amountReceived' => isset($intent['amount_received']) ? (int) $intent['amount_received'] : 0,
            'currency' => strtoupper((string) ($intent['currency'] ?? payment_currency()))
        ]);
    }

    public static function transferProof(array $context): void
    {
        // POST /transfer-proof
        require_rate_limit('transfer-proof', 6, 60);

        if (!isset($_FILES['proof']) || !is_array($_FILES['proof'])) {
            json_response([
                'ok' => false,
                'error' => 'Debes adjuntar un comprobante'
            ], 400);
        }

        try {
            $upload = save_transfer_proof_upload($_FILES['proof']);
        } catch (RuntimeException $e) {
            json_response([
                'ok' => false,
                'error' => 'No se pudo procesar el comprobante enviado'
            ], 400);
        }

        json_response([
            'ok' => true,
            'data' => [
                'transferProofPath' => (string) ($upload['path'] ?? ''),
                'transferProofUrl' => (string) ($upload['url'] ?? ''),
                'transferProofName' => (string) ($upload['name'] ?? ''),
                'transferProofMime' => (string) ($upload['mime'] ?? ''),
                'transferProofSize' => (int) ($upload['size'] ?? 0)
            ]
        ], 201);
    }

    public static function webhook(array $context): void
    {
        // POST /stripe-webhook
        $webhookSecret = payment_stripe_webhook_secret();
        if ($webhookSecret === '') {
            json_response(['ok' => false, 'error' => 'Webhook no configurado'], 503);
        }

        $rawBody = file_get_contents('php://input');
        if (!is_string($rawBody) || $rawBody === '') {
            json_response(['ok' => false, 'error' => 'Cuerpo vacio'], 400);
        }

        $sigHeader = isset($_SERVER['HTTP_STRIPE_SIGNATURE']) ? (string) $_SERVER['HTTP_STRIPE_SIGNATURE'] : '';
        if ($sigHeader === '') {
            json_response(['ok' => false, 'error' => 'Sin firma'], 400);
        }

        try {
            $event = stripe_verify_webhook_signature($rawBody, $sigHeader, $webhookSecret);
        } catch (RuntimeException $e) {
            audit_log_event('stripe.webhook_signature_failed', ['error' => $e->getMessage()]);
            json_response(['ok' => false, 'error' => 'Firma de webhook invalida'], 400);
        }

        $eventType = (string) ($event['type'] ?? '');
        audit_log_event('stripe.webhook_received', ['type' => $eventType]);

        if ($eventType === 'payment_intent.succeeded') {
            $intentData = isset($event['data']['object']) && is_array($event['data']['object']) ? $event['data']['object'] : [];
            $intentId = (string) ($intentData['id'] ?? '');

            if ($intentId !== '') {
                $webhookStore = read_store();
                $updated = false;
                foreach ($webhookStore['appointments'] as &$appt) {
                    $existingIntent = trim((string) ($appt['paymentIntentId'] ?? ''));
                    if ($existingIntent !== '' && hash_equals($existingIntent, $intentId)) {
                        if (($appt['paymentStatus'] ?? '') !== 'paid') {
                            $appt['paymentStatus'] = 'paid';
                            $appt['paymentPaidAt'] = local_date('c');
                            $updated = true;
                        }
                        break;
                    }
                }
                unset($appt);
                if ($updated) {
                    write_store($webhookStore);
                    audit_log_event('stripe.webhook_payment_confirmed', ['intentId' => $intentId]);
                }
            }
        }

        if ($eventType === 'payment_intent.payment_failed') {
            $intentData = isset($event['data']['object']) && is_array($event['data']['object']) ? $event['data']['object'] : [];
            $intentId = (string) ($intentData['id'] ?? '');

            if ($intentId !== '') {
                $webhookStore = read_store();
                $updated = false;
                foreach ($webhookStore['appointments'] as &$appt) {
                    $existingIntent = trim((string) ($appt['paymentIntentId'] ?? ''));
                    if ($existingIntent !== '' && hash_equals($existingIntent, $intentId)) {
                        if (!in_array($appt['paymentStatus'] ?? '', ['paid', 'failed'], true)) {
                            $appt['paymentStatus'] = 'failed';
                            $updated = true;
                        }
                        break;
                    }
                }
                unset($appt);
                if ($updated) {
                    write_store($webhookStore);
                    audit_log_event('stripe.webhook_payment_failed', ['intentId' => $intentId]);
                }
            }
        }

        json_response(['ok' => true, 'received' => true]);
    }
}
