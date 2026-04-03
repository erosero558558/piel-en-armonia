<?php

declare(strict_types=1);

final class SoftwareSubscriptionService
{
public static function softwareSubscriptionCheckout(array $context): void
    {
        if (function_exists('start_secure_session')) {
            start_secure_session();
        }
        if (function_exists('require_admin_auth')) {
            require_admin_auth();
        }
        require_csrf();

        if (!payment_gateway_enabled()) {
            json_response([
                'ok' => false,
                'error' => 'Stripe no esta configurado para activar suscripciones.',
            ], 503);
        }

        $payload = require_json_body();
        $planKey = SoftwareSubscriptionService::normalizePlanKey((string) ($payload['planKey'] ?? ''));

        try {
            $clinicProfile = read_clinic_profile();
            $checkoutPayload = SoftwareSubscriptionService::buildCheckoutPayload($planKey, $clinicProfile);
            $session = stripe_create_subscription_checkout_session(
                [
                    'amountCents' => (int) (($checkoutPayload['plan']['amountCents'] ?? 0)),
                    'currency' => (string) (($checkoutPayload['plan']['currency'] ?? payment_currency())),
                    'interval' => (string) (($checkoutPayload['plan']['interval'] ?? 'month')),
                    'customerEmail' => (string) ($checkoutPayload['customerEmail'] ?? ''),
                    'productName' => (string) ($checkoutPayload['productName'] ?? ''),
                    'description' => (string) ($checkoutPayload['description'] ?? ''),
                    'metadata' => isset($checkoutPayload['metadata']) && is_array($checkoutPayload['metadata'])
                        ? $checkoutPayload['metadata']
                        : [],
                ],
                (string) ($checkoutPayload['successUrl'] ?? ''),
                (string) ($checkoutPayload['cancelUrl'] ?? ''),
                (string) ($checkoutPayload['idempotencyKey'] ?? '')
            );
            $nextProfile = SoftwareSubscriptionService::beginCheckout($clinicProfile, $planKey, $session);
            $nextProfile['updatedAt'] = local_date('c');
        } catch (InvalidArgumentException $error) {
            json_response([
                'ok' => false,
                'error' => $error->getMessage(),
            ], 400);
        } catch (RuntimeException $error) {
            json_response([
                'ok' => false,
                'error' => 'No se pudo iniciar el checkout recurrente en Stripe.',
            ], 502);
        }

        if (!write_clinic_profile($nextProfile)) {
            json_response([
                'ok' => false,
                'error' => 'No se pudo guardar el checkout recurrente.',
            ], 503);
        }

        audit_log_event('software_subscription.checkout_started', [
            'planKey' => $planKey,
            'checkoutSessionId' => (string) ($session['id'] ?? ''),
            'clinicName' => (string) ($nextProfile['clinicName'] ?? ''),
        ]);

        json_response([
            'ok' => true,
            'data' => [
                'checkoutUrl' => (string) ($session['url'] ?? ''),
                'sessionId' => (string) ($session['id'] ?? ''),
                'clinicProfile' => $nextProfile,
                'subscription' => $nextProfile['software_subscription'] ?? [],
            ],
        ], 201);
    }

public static function handleSoftwareSubscriptionCheckoutCompleted(array $session): void
    {
        if (!self::isSoftwareSubscriptionSession($session)) {
            return;
        }

        $profile = read_clinic_profile();
        $nextProfile = SoftwareSubscriptionService::activateFromCheckoutSession($profile, $session);
        $nextProfile['updatedAt'] = local_date('c');
        if (!write_clinic_profile($nextProfile)) {
            audit_log_event('software_subscription.checkout_completed_persist_failed', [
                'checkoutSessionId' => (string) ($session['id'] ?? ''),
            ]);
            return;
        }

        audit_log_event('software_subscription.checkout_completed', [
            'checkoutSessionId' => (string) ($session['id'] ?? ''),
            'planKey' => (string) ($nextProfile['software_subscription']['planKey'] ?? ''),
            'subscriptionId' => (string) ($nextProfile['software_subscription']['stripeSubscriptionId'] ?? ''),
        ]);
    }

public static function handleSoftwareSubscriptionInvoicePaid(array $invoice): void
    {
        if (!self::isSoftwareSubscriptionInvoice($invoice)) {
            return;
        }

        $profile = read_clinic_profile();
        $nextProfile = SoftwareSubscriptionService::applyInvoiceEvent($profile, $invoice, 'paid');
        $nextProfile['updatedAt'] = local_date('c');
        if (!write_clinic_profile($nextProfile)) {
            audit_log_event('software_subscription.invoice_paid_persist_failed', [
                'invoiceId' => (string) ($invoice['id'] ?? ''),
            ]);
            return;
        }

        audit_log_event('software_subscription.invoice_paid', [
            'invoiceId' => (string) ($invoice['id'] ?? ''),
            'planKey' => (string) ($nextProfile['software_subscription']['planKey'] ?? ''),
        ]);
    }

public static function handleSoftwareSubscriptionInvoiceFailed(array $invoice): void
    {
        if (!self::isSoftwareSubscriptionInvoice($invoice)) {
            return;
        }

        $profile = read_clinic_profile();
        $nextProfile = SoftwareSubscriptionService::applyInvoiceEvent($profile, $invoice, 'failed');
        $nextProfile['updatedAt'] = local_date('c');
        if (!write_clinic_profile($nextProfile)) {
            audit_log_event('software_subscription.invoice_failed_persist_failed', [
                'invoiceId' => (string) ($invoice['id'] ?? ''),
            ]);
            return;
        }

        audit_log_event('software_subscription.invoice_failed', [
            'invoiceId' => (string) ($invoice['id'] ?? ''),
            'subscriptionId' => (string) ($nextProfile['software_subscription']['stripeSubscriptionId'] ?? ''),
        ]);
    }

public static function handleSoftwareSubscriptionCanceled(array $subscription): void
    {
        if (!self::isSoftwareSubscriptionEvent($subscription)) {
            return;
        }

        $profile = read_clinic_profile();
        $nextProfile = SoftwareSubscriptionService::cancelFromStripeEvent($profile, $subscription);
        $nextProfile['updatedAt'] = local_date('c');
        if (!write_clinic_profile($nextProfile)) {
            audit_log_event('software_subscription.canceled_persist_failed', [
                'subscriptionId' => (string) ($subscription['id'] ?? ''),
            ]);
            return;
        }

        audit_log_event('software_subscription.canceled', [
            'subscriptionId' => (string) ($subscription['id'] ?? ''),
        ]);
    }

public static function isSoftwareSubscriptionSession(array $session): bool
    {
        $metadata = isset($session['metadata']) && is_array($session['metadata']) ? $session['metadata'] : [];
        return strtolower(trim((string) ($metadata['surface'] ?? ''))) === 'software_subscription';
    }

public static function isSoftwareSubscriptionInvoice(array $invoice): bool
    {
        $metadata = isset($invoice['metadata']) && is_array($invoice['metadata']) ? $invoice['metadata'] : [];
        if (strtolower(trim((string) ($metadata['surface'] ?? ''))) === 'software_subscription') {
            return true;
        }

        $profile = read_clinic_profile();
        $subscription = isset($profile['software_subscription']) && is_array($profile['software_subscription'])
            ? $profile['software_subscription']
            : [];
        $currentSubscriptionId = trim((string) ($subscription['stripeSubscriptionId'] ?? ''));
        $currentCustomerId = trim((string) ($subscription['stripeCustomerId'] ?? ''));

        return ($currentSubscriptionId !== '' && hash_equals($currentSubscriptionId, trim((string) ($invoice['subscription'] ?? ''))))
            || ($currentCustomerId !== '' && hash_equals($currentCustomerId, trim((string) ($invoice['customer'] ?? ''))));
    }

public static function isSoftwareSubscriptionEvent(array $subscription): bool
    {
        $metadata = isset($subscription['metadata']) && is_array($subscription['metadata']) ? $subscription['metadata'] : [];
        if (strtolower(trim((string) ($metadata['surface'] ?? ''))) === 'software_subscription') {
            return true;
        }

        $profile = read_clinic_profile();
        $current = isset($profile['software_subscription']) && is_array($profile['software_subscription'])
            ? $profile['software_subscription']
            : [];
        $currentSubscriptionId = trim((string) ($current['stripeSubscriptionId'] ?? ''));

        return $currentSubscriptionId !== '' && hash_equals($currentSubscriptionId, trim((string) ($subscription['id'] ?? '')));
    }

}
