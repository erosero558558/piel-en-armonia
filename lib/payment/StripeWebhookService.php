<?php

declare(strict_types=1);

final class StripeWebhookService
{
public static function webhook(array $context): void
    {
        $webhookSecret = payment_stripe_webhook_secret();
        if ($webhookSecret === '') {
            json_response(['ok' => false, 'error' => 'Webhook no configurado'], 503);
        }

        $rawBody = self::readWebhookRawBody();
        if ($rawBody === '') {
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

        if ($eventType === 'checkout.session.completed') {
            $sessionData = isset($event['data']['object']) && is_array($event['data']['object']) ? $event['data']['object'] : [];
            PaymentController::handleSoftwareSubscriptionCheckoutCompleted($sessionData);
            PaymentController::handleWhatsappCheckoutCompleted($sessionData);
        }

        if ($eventType === 'checkout.session.expired') {
            $sessionData = isset($event['data']['object']) && is_array($event['data']['object']) ? $event['data']['object'] : [];
            PaymentController::handleWhatsappCheckoutExpired($sessionData);
        }

        if ($eventType === 'invoice.paid') {
            $invoiceData = isset($event['data']['object']) && is_array($event['data']['object']) ? $event['data']['object'] : [];
            PaymentController::handleSoftwareSubscriptionInvoicePaid($invoiceData);
        }

        if ($eventType === 'invoice.payment_failed') {
            $invoiceData = isset($event['data']['object']) && is_array($event['data']['object']) ? $event['data']['object'] : [];
            PaymentController::handleSoftwareSubscriptionInvoiceFailed($invoiceData);
        }

        if ($eventType === 'customer.subscription.deleted') {
            $subscriptionData = isset($event['data']['object']) && is_array($event['data']['object']) ? $event['data']['object'] : [];
            PaymentController::handleSoftwareSubscriptionCanceled($subscriptionData);
        }

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

public static function readWebhookRawBody(): string
    {
        if (defined('TESTING_ENV') && isset($GLOBALS['__TEST_RAW_BODY']) && is_string($GLOBALS['__TEST_RAW_BODY'])) {
            return $GLOBALS['__TEST_RAW_BODY'];
        }

        $rawBody = file_get_contents('php://input');
        return is_string($rawBody) ? $rawBody : '';
    }

}
