<?php

declare(strict_types=1);

if (!class_exists('SoftwareSubscriptionService', false)) {
    final class SoftwareSubscriptionService
    {
        private const DEFAULT_TRIAL_DAYS = 14;

        public static function softwareSubscriptionCheckout(array $context): void
        {
            self::ensurePaymentRuntime();
            self::ensureClinicProfileRuntime();

            if (function_exists('start_secure_session')) {
                start_secure_session();
            }
            if (function_exists('require_admin_auth')) {
                require_admin_auth();
            }
            if (function_exists('require_csrf')) {
                require_csrf();
            }

            if (!function_exists('payment_gateway_enabled') || !payment_gateway_enabled()) {
                json_response([
                    'ok' => false,
                    'error' => 'Stripe no esta configurado para activar suscripciones.',
                ], 503);
            }

            $payload = require_json_body();
            $planKey = self::normalizePlanKey((string) ($payload['planKey'] ?? ''));

            try {
                $clinicProfile = self::readClinicProfile();
                $checkoutPayload = self::buildCheckoutPayload($planKey, $clinicProfile);
                $session = stripe_create_subscription_checkout_session(
                    [
                        'amountCents' => (int) (($checkoutPayload['plan']['amountCents'] ?? 0)),
                        'currency' => (string) (($checkoutPayload['plan']['currency'] ?? 'USD')),
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
                $nextProfile = self::beginCheckout($clinicProfile, $planKey, $session);
                $nextProfile['updatedAt'] = self::nowString();
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

            if (!self::writeClinicProfile($nextProfile)) {
                json_response([
                    'ok' => false,
                    'error' => 'No se pudo guardar el checkout recurrente.',
                ], 503);
            }

            self::audit('software_subscription.checkout_started', [
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

            $profile = self::readClinicProfile();
            $nextProfile = self::activateFromCheckoutSession($profile, $session);
            $nextProfile['updatedAt'] = self::nowString();
            if (!self::writeClinicProfile($nextProfile)) {
                self::audit('software_subscription.checkout_completed_persist_failed', [
                    'checkoutSessionId' => (string) ($session['id'] ?? ''),
                ]);
                return;
            }

            self::audit('software_subscription.checkout_completed', [
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

            $profile = self::readClinicProfile();
            $nextProfile = self::applyInvoiceEvent($profile, $invoice, 'paid');
            $nextProfile['updatedAt'] = self::nowString();
            if (!self::writeClinicProfile($nextProfile)) {
                self::audit('software_subscription.invoice_paid_persist_failed', [
                    'invoiceId' => (string) ($invoice['id'] ?? ''),
                ]);
                return;
            }

            self::audit('software_subscription.invoice_paid', [
                'invoiceId' => (string) ($invoice['id'] ?? ''),
                'planKey' => (string) ($nextProfile['software_subscription']['planKey'] ?? ''),
            ]);
        }

        public static function handleSoftwareSubscriptionInvoiceFailed(array $invoice): void
        {
            if (!self::isSoftwareSubscriptionInvoice($invoice)) {
                return;
            }

            $profile = self::readClinicProfile();
            $nextProfile = self::applyInvoiceEvent($profile, $invoice, 'failed');
            $nextProfile['updatedAt'] = self::nowString();
            if (!self::writeClinicProfile($nextProfile)) {
                self::audit('software_subscription.invoice_failed_persist_failed', [
                    'invoiceId' => (string) ($invoice['id'] ?? ''),
                ]);
                return;
            }

            self::audit('software_subscription.invoice_failed', [
                'invoiceId' => (string) ($invoice['id'] ?? ''),
                'subscriptionId' => (string) ($nextProfile['software_subscription']['stripeSubscriptionId'] ?? ''),
            ]);
        }

        public static function handleSoftwareSubscriptionCanceled(array $subscription): void
        {
            if (!self::isSoftwareSubscriptionEvent($subscription)) {
                return;
            }

            $profile = self::readClinicProfile();
            $nextProfile = self::cancelFromStripeEvent($profile, $subscription);
            $nextProfile['updatedAt'] = self::nowString();
            if (!self::writeClinicProfile($nextProfile)) {
                self::audit('software_subscription.canceled_persist_failed', [
                    'subscriptionId' => (string) ($subscription['id'] ?? ''),
                ]);
                return;
            }

            self::audit('software_subscription.canceled', [
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

            if (!function_exists('read_clinic_profile')) {
                return false;
            }

            $profile = self::readClinicProfile();
            $subscription = self::normalizeClinicProfileSubscription($profile);
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

            if (!function_exists('read_clinic_profile')) {
                return false;
            }

            $profile = self::readClinicProfile();
            $current = self::normalizeClinicProfileSubscription($profile);
            $currentSubscriptionId = trim((string) ($current['stripeSubscriptionId'] ?? ''));

            return $currentSubscriptionId !== '' && hash_equals($currentSubscriptionId, trim((string) ($subscription['id'] ?? '')));
        }

        public static function normalizePlanKey(string $value): string
        {
            $normalized = strtolower(trim($value));
            return match ($normalized) {
                'starter', 'start' => 'starter',
                'pro', 'professional', 'premium' => 'pro',
                default => 'free',
            };
        }

        public static function planLabel(string $planKey): string
        {
            $plan = self::planDefinition($planKey);
            return (string) ($plan['label'] ?? 'Free');
        }

        public static function derivePlanKeyFromClinicProfile(array $profile): string
        {
            $subscription = self::normalizeClinicProfileSubscription($profile);
            $pendingPlanKey = self::normalizeOptionalPlanKey($subscription['pendingPlanKey'] ?? '');
            if ((string) ($subscription['status'] ?? '') === 'pending_checkout' && $pendingPlanKey !== '') {
                return $pendingPlanKey;
            }

            $planKey = self::normalizeOptionalPlanKey($subscription['planKey'] ?? '');
            if ($planKey !== '') {
                return $planKey;
            }

            return self::fallbackPlanKeyFromProfile($profile);
        }

        public static function normalizeSubscription(array $subscription, string $fallbackPlanKey = 'free'): array
        {
            $normalized = $subscription;
            $fallbackPlanKey = self::normalizePlanKey($fallbackPlanKey);
            $planKey = self::normalizeOptionalPlanKey($subscription['planKey'] ?? '');
            if ($planKey === '') {
                $planKey = $fallbackPlanKey;
            }

            $pendingPlanKey = self::normalizeOptionalPlanKey($subscription['pendingPlanKey'] ?? '');
            $status = strtolower(trim((string) ($subscription['status'] ?? '')));
            if (!in_array($status, ['free', 'pending_checkout', 'trialing', 'active', 'past_due', 'canceled', 'cancelled'], true)) {
                $status = self::inferStatus($subscription, $planKey, $pendingPlanKey);
            }
            if ($status === 'canceled' || $status === 'cancelled') {
                $status = 'free';
            }
            if ($status === 'pending_checkout' && $pendingPlanKey === '') {
                $pendingPlanKey = $planKey !== '' ? $planKey : $fallbackPlanKey;
            }
            if ($status === 'trialing' && $planKey === 'free') {
                $planKey = $fallbackPlanKey !== 'free' ? $fallbackPlanKey : 'pro';
            }

            $normalized['status'] = $status;
            $normalized['planKey'] = $planKey;
            $normalized['pendingPlanKey'] = $pendingPlanKey;
            $normalized['checkoutSessionId'] = trim((string) ($subscription['checkoutSessionId'] ?? ''));
            $normalized['stripeSubscriptionId'] = trim((string) ($subscription['stripeSubscriptionId'] ?? ''));
            $normalized['stripeCustomerId'] = trim((string) ($subscription['stripeCustomerId'] ?? ''));
            $normalized['renewalAt'] = self::normalizeDateString($subscription['renewalAt'] ?? '');
            $normalized['startedAt'] = self::normalizeDateString($subscription['startedAt'] ?? '');
            $normalized['trialEndsAt'] = self::normalizeDateString($subscription['trialEndsAt'] ?? '');
            $normalized['trialReminderSentAt'] = self::normalizeDateString($subscription['trialReminderSentAt'] ?? '');
            $normalized['trialReminderChannel'] = trim((string) ($subscription['trialReminderChannel'] ?? ''));
            $normalized['trialReminderOutboxId'] = trim((string) ($subscription['trialReminderOutboxId'] ?? ''));
            $normalized['downgradedAt'] = self::normalizeDateString($subscription['downgradedAt'] ?? '');
            $normalized['invoices'] = self::normalizeInvoiceHistory($subscription['invoices'] ?? []);

            return $normalized;
        }

        public static function normalizeClinicProfileSubscription(array $profile): array
        {
            $subscription = isset($profile['software_subscription']) && is_array($profile['software_subscription'])
                ? $profile['software_subscription']
                : [];

            return self::normalizeSubscription($subscription, self::fallbackPlanKeyFromProfile($profile));
        }

        public static function canManuallyEditPlan(array $subscription): bool
        {
            $normalized = self::normalizeSubscription($subscription, 'free');
            return (string) ($normalized['status'] ?? 'free') === 'free';
        }

        public static function applyManualPlanSelection(array $subscription, string $planKey): array
        {
            $selectedPlanKey = self::normalizePlanKey($planKey);
            $normalized = self::normalizeSubscription($subscription, $selectedPlanKey);
            if (!self::canManuallyEditPlan($normalized)) {
                return $normalized;
            }

            $normalized['status'] = 'free';
            $normalized['planKey'] = $selectedPlanKey;
            $normalized['pendingPlanKey'] = '';
            $normalized['checkoutSessionId'] = '';
            $normalized['stripeSubscriptionId'] = '';
            $normalized['renewalAt'] = '';
            $normalized['trialEndsAt'] = '';
            $normalized['trialReminderSentAt'] = '';
            $normalized['trialReminderChannel'] = '';
            $normalized['trialReminderOutboxId'] = '';
            $normalized['downgradedAt'] = '';

            return self::normalizeSubscription($normalized, $selectedPlanKey);
        }

        public static function buildCheckoutPayload(string $planKey, array $clinicProfile): array
        {
            self::ensurePaymentRuntime();

            $planKey = self::normalizePlanKey($planKey);
            $plan = self::planDefinition($planKey);
            if ((int) ($plan['amountCents'] ?? 0) <= 0) {
                throw new InvalidArgumentException('Selecciona un plan de pago valido.');
            }

            $clinicName = trim((string) ($clinicProfile['clinicName'] ?? 'Aurora Derm'));
            if ($clinicName === '') {
                $clinicName = 'Aurora Derm';
            }

            $customerEmail = trim((string) ($clinicProfile['email'] ?? ($clinicProfile['contactEmail'] ?? '')));
            $phone = trim((string) ($clinicProfile['phone'] ?? ''));
            $successUrl = function_exists('app_backend_status_absolute_url')
                ? app_backend_status_absolute_url(['section' => 'subscription', 'checkout' => 'success'])
                : 'http://127.0.0.1/admin-auth.php?action=status&section=subscription&checkout=success';
            $cancelUrl = function_exists('app_backend_status_absolute_url')
                ? app_backend_status_absolute_url(['section' => 'subscription', 'checkout' => 'cancel'])
                : 'http://127.0.0.1/admin-auth.php?action=status&section=subscription&checkout=cancel';

            $seed = implode('|', [
                $clinicName,
                $phone,
                $planKey,
                self::nowString(),
            ]);
            $idempotencyKey = function_exists('payment_build_idempotency_key')
                ? payment_build_idempotency_key('software-subscription', $seed)
                : 'software-subscription-' . substr(hash('sha256', $seed), 0, 32);

            return [
                'plan' => $plan,
                'customerEmail' => $customerEmail,
                'productName' => 'Flow OS ' . self::planLabel($planKey),
                'description' => 'Suscripcion ' . self::planLabel($planKey) . ' para ' . $clinicName,
                'metadata' => [
                    'surface' => 'software_subscription',
                    'plan_key' => $planKey,
                    'clinic_name' => $clinicName,
                    'phone' => $phone,
                ],
                'successUrl' => $successUrl,
                'cancelUrl' => $cancelUrl,
                'idempotencyKey' => $idempotencyKey,
            ];
        }

        public static function beginCheckout(array $profile, string $planKey, array $session): array
        {
            $current = self::normalizeClinicProfileSubscription($profile);
            $selectedPlanKey = self::normalizePlanKey($planKey);

            $nextSubscription = array_merge($current, [
                'status' => 'pending_checkout',
                'pendingPlanKey' => $selectedPlanKey,
                'checkoutSessionId' => trim((string) ($session['id'] ?? '')),
                'stripeCustomerId' => trim((string) ($session['customer'] ?? ($current['stripeCustomerId'] ?? ''))),
            ]);
            $profile['software_subscription'] = self::normalizeSubscription($nextSubscription, (string) ($current['planKey'] ?? 'free'));
            $profile['software_plan'] = trim((string) ($profile['software_plan'] ?? self::planLabel((string) ($current['planKey'] ?? 'free'))));
            if ($profile['software_plan'] === '') {
                $profile['software_plan'] = self::planLabel((string) ($current['planKey'] ?? 'free'));
            }

            return $profile;
        }

        public static function activateFromCheckoutSession(array $profile, array $session): array
        {
            $current = self::normalizeClinicProfileSubscription($profile);
            $metadata = isset($session['metadata']) && is_array($session['metadata']) ? $session['metadata'] : [];

            $planKey = self::normalizeOptionalPlanKey($metadata['plan_key'] ?? '');
            if ($planKey === '') {
                $planKey = self::normalizeOptionalPlanKey($current['pendingPlanKey'] ?? '');
            }
            if ($planKey === '') {
                $planKey = self::normalizeOptionalPlanKey($current['planKey'] ?? '');
            }
            if ($planKey === '') {
                $planKey = 'pro';
            }

            $completedAt = self::normalizeDateString($session['completed_at'] ?? ($session['created'] ?? self::nowString()));
            $nextSubscription = array_merge($current, [
                'status' => self::normalizeActivationStatus((string) ($session['subscription_status'] ?? 'active'), $planKey),
                'planKey' => $planKey,
                'pendingPlanKey' => '',
                'checkoutSessionId' => trim((string) ($session['id'] ?? ($current['checkoutSessionId'] ?? ''))),
                'stripeSubscriptionId' => trim((string) ($session['subscription'] ?? ($current['stripeSubscriptionId'] ?? ''))),
                'stripeCustomerId' => trim((string) ($session['customer'] ?? ($current['stripeCustomerId'] ?? ''))),
                'renewalAt' => self::normalizeDateString($session['current_period_end'] ?? ($current['renewalAt'] ?? '')),
                'startedAt' => self::normalizeDateString($current['startedAt'] ?? '') !== ''
                    ? (string) ($current['startedAt'] ?? '')
                    : $completedAt,
                'trialEndsAt' => '',
                'trialReminderSentAt' => '',
                'trialReminderChannel' => '',
                'trialReminderOutboxId' => '',
                'downgradedAt' => '',
            ]);

            $profile['software_subscription'] = self::normalizeSubscription($nextSubscription, $planKey);
            $profile['software_plan'] = self::planLabel($planKey);

            return $profile;
        }

        public static function applyInvoiceEvent(array $profile, array $invoice, string $eventStatus): array
        {
            $current = self::normalizeClinicProfileSubscription($profile);
            $metadata = isset($invoice['metadata']) && is_array($invoice['metadata']) ? $invoice['metadata'] : [];

            $planKey = self::normalizeOptionalPlanKey($metadata['plan_key'] ?? '');
            if ($planKey === '') {
                $planKey = self::normalizeOptionalPlanKey($current['pendingPlanKey'] ?? '');
            }
            if ($planKey === '') {
                $planKey = self::normalizeOptionalPlanKey($current['planKey'] ?? '');
            }
            if ($planKey === '') {
                $planKey = 'free';
            }

            $invoiceRecord = self::normalizeInvoiceRecord($invoice, $eventStatus, $planKey);
            $nextSubscription = array_merge($current, [
                'status' => strtolower($eventStatus) === 'paid' ? ($planKey === 'free' ? 'free' : 'active') : 'past_due',
                'planKey' => $planKey,
                'pendingPlanKey' => '',
                'stripeSubscriptionId' => trim((string) ($invoice['subscription'] ?? ($current['stripeSubscriptionId'] ?? ''))),
                'stripeCustomerId' => trim((string) ($invoice['customer'] ?? ($current['stripeCustomerId'] ?? ''))),
                'renewalAt' => (string) ($invoiceRecord['renewalAt'] ?? ($current['renewalAt'] ?? '')),
                'invoices' => self::upsertInvoiceRecord($current['invoices'] ?? [], $invoiceRecord),
            ]);

            $profile['software_subscription'] = self::normalizeSubscription($nextSubscription, $planKey);
            $profile['software_plan'] = self::planLabel($planKey);

            return $profile;
        }

        public static function cancelFromStripeEvent(array $profile, array $subscription): array
        {
            $current = self::normalizeClinicProfileSubscription($profile);
            $canceledAt = self::normalizeDateString($subscription['canceled_at'] ?? ($subscription['current_period_end'] ?? self::nowString()));

            $nextSubscription = array_merge($current, [
                'status' => 'free',
                'planKey' => 'free',
                'pendingPlanKey' => '',
                'checkoutSessionId' => '',
                'stripeSubscriptionId' => '',
                'renewalAt' => '',
                'trialEndsAt' => '',
                'trialReminderSentAt' => '',
                'trialReminderChannel' => '',
                'trialReminderOutboxId' => '',
                'downgradedAt' => $canceledAt,
            ]);

            $profile['software_subscription'] = self::normalizeSubscription($nextSubscription, 'free');
            $profile['software_plan'] = self::planLabel('free');

            return $profile;
        }

        public static function shouldAutoStartTrial(array $profile): bool
        {
            $subscription = self::normalizeClinicProfileSubscription($profile);
            $status = (string) ($subscription['status'] ?? 'free');

            return $status === 'free'
                && trim((string) ($subscription['startedAt'] ?? '')) === ''
                && trim((string) ($subscription['trialEndsAt'] ?? '')) === ''
                && trim((string) ($subscription['stripeSubscriptionId'] ?? '')) === ''
                && trim((string) ($subscription['checkoutSessionId'] ?? '')) === '';
        }

        public static function startTrial(
            array $profile,
            string $planKey = 'pro',
            int $days = self::DEFAULT_TRIAL_DAYS,
            ?string $startedAt = null
        ): array {
            $trialPlanKey = self::normalizePlanKey($planKey);
            if ($trialPlanKey === 'free') {
                $trialPlanKey = 'pro';
            }

            $started = self::dateTimeOrNow($startedAt);
            $trialEnds = $started->modify('+' . max(1, $days) . ' days');
            $current = self::normalizeClinicProfileSubscription($profile);

            $nextSubscription = array_merge($current, [
                'status' => 'trialing',
                'planKey' => $trialPlanKey,
                'pendingPlanKey' => '',
                'checkoutSessionId' => '',
                'stripeSubscriptionId' => '',
                'renewalAt' => '',
                'startedAt' => $started->format('c'),
                'trialEndsAt' => $trialEnds->format('c'),
                'trialReminderSentAt' => '',
                'trialReminderChannel' => '',
                'trialReminderOutboxId' => '',
                'downgradedAt' => '',
            ]);

            $profile['software_subscription'] = self::normalizeSubscription($nextSubscription, $trialPlanKey);
            $profile['software_plan'] = self::planLabel($trialPlanKey);

            return $profile;
        }

        public static function describeTrialLifecycle(array $profile, array $options = []): array
        {
            $subscription = self::normalizeClinicProfileSubscription($profile);
            $status = (string) ($subscription['status'] ?? 'free');
            $trialEndsAt = self::normalizeDateString($subscription['trialEndsAt'] ?? '');
            $trialEnds = self::parseDateTime($trialEndsAt);
            $now = self::dateTimeOrNow(isset($options['now']) ? (string) $options['now'] : null);

            $active = $status === 'trialing' && $trialEnds instanceof DateTimeImmutable;
            $daysRemaining = 0;
            $shouldSendReminder = false;
            $shouldDowngrade = false;

            if ($active && $trialEnds instanceof DateTimeImmutable) {
                $secondsRemaining = $trialEnds->getTimestamp() - $now->getTimestamp();
                $daysRemaining = max(0, (int) ceil($secondsRemaining / 86400));
                $shouldDowngrade = $secondsRemaining <= 0;
                $shouldSendReminder = !$shouldDowngrade
                    && $daysRemaining > 0
                    && $daysRemaining <= 2
                    && trim((string) ($subscription['trialReminderSentAt'] ?? '')) === '';
            }

            return [
                'active' => $active,
                'planKey' => (string) ($subscription['planKey'] ?? 'pro'),
                'planLabel' => self::planLabel((string) ($subscription['planKey'] ?? 'pro')),
                'trialEndsAt' => $trialEndsAt,
                'trialEndsLabel' => $trialEnds instanceof DateTimeImmutable ? $trialEnds->format('d/m/Y') : '',
                'daysRemaining' => $daysRemaining,
                'shouldSendReminder' => $shouldSendReminder,
                'shouldDowngrade' => $shouldDowngrade,
            ];
        }

        public static function markTrialReminderSent(
            array $profile,
            string $channel,
            string $outboxId,
            ?string $sentAt = null
        ): array {
            $subscription = self::normalizeClinicProfileSubscription($profile);
            $subscription['trialReminderSentAt'] = self::dateTimeOrNow($sentAt)->format('c');
            $subscription['trialReminderChannel'] = trim($channel);
            $subscription['trialReminderOutboxId'] = trim($outboxId);

            $profile['software_subscription'] = self::normalizeSubscription(
                $subscription,
                (string) ($subscription['planKey'] ?? 'pro')
            );

            return $profile;
        }

        public static function downgradeExpiredTrial(array $profile, ?string $now = null): array
        {
            $current = self::normalizeClinicProfileSubscription($profile);
            $downgradedAt = self::dateTimeOrNow($now)->format('c');

            $nextSubscription = array_merge($current, [
                'status' => 'free',
                'planKey' => 'free',
                'pendingPlanKey' => '',
                'checkoutSessionId' => '',
                'stripeSubscriptionId' => '',
                'renewalAt' => '',
                'trialEndsAt' => '',
                'downgradedAt' => $downgradedAt,
            ]);

            $profile['software_subscription'] = self::normalizeSubscription($nextSubscription, 'free');
            $profile['software_plan'] = self::planLabel('free');

            return $profile;
        }

        private static function ensureClinicProfileRuntime(): void
        {
            if (function_exists('read_clinic_profile') && function_exists('write_clinic_profile')) {
                return;
            }

            $clinicProfileStore = __DIR__ . '/ClinicProfileStore.php';
            if (is_file($clinicProfileStore)) {
                require_once $clinicProfileStore;
            }
        }

        private static function ensurePaymentRuntime(): void
        {
            if (function_exists('payment_gateway_enabled') && function_exists('stripe_create_subscription_checkout_session')) {
                return;
            }

            $paymentLib = dirname(__DIR__) . '/payment-lib.php';
            if (is_file($paymentLib)) {
                require_once $paymentLib;
            }
        }

        private static function readClinicProfile(): array
        {
            self::ensureClinicProfileRuntime();
            if (function_exists('read_clinic_profile')) {
                return read_clinic_profile();
            }

            return [
                'clinicName' => 'Aurora Derm',
                'software_plan' => 'Free',
                'software_subscription' => self::normalizeSubscription([], 'free'),
            ];
        }

        private static function writeClinicProfile(array $profile): bool
        {
            self::ensureClinicProfileRuntime();
            return function_exists('write_clinic_profile') ? write_clinic_profile($profile) : false;
        }

        private static function audit(string $event, array $payload): void
        {
            if (!function_exists('audit_log_event')) {
                $auditFile = __DIR__ . '/audit.php';
                if (is_file($auditFile)) {
                    require_once $auditFile;
                }
            }

            if (function_exists('audit_log_event')) {
                audit_log_event($event, $payload);
            }
        }

        private static function planDefinition(string $planKey): array
        {
            $currency = function_exists('payment_currency')
                ? strtoupper((string) payment_currency())
                : 'USD';

            $catalog = [
                'free' => [
                    'key' => 'free',
                    'label' => 'Free',
                    'amountCents' => 0,
                    'currency' => $currency,
                    'interval' => 'month',
                ],
                'starter' => [
                    'key' => 'starter',
                    'label' => 'Starter',
                    'amountCents' => 3900,
                    'currency' => $currency,
                    'interval' => 'month',
                ],
                'pro' => [
                    'key' => 'pro',
                    'label' => 'Pro',
                    'amountCents' => 7900,
                    'currency' => $currency,
                    'interval' => 'month',
                ],
            ];

            $normalizedPlanKey = self::normalizePlanKey($planKey);
            return $catalog[$normalizedPlanKey] ?? $catalog['free'];
        }

        private static function fallbackPlanKeyFromProfile(array $profile): string
        {
            return self::normalizePlanKey((string) ($profile['software_plan'] ?? 'free'));
        }

        private static function inferStatus(array $subscription, string $planKey, string $pendingPlanKey): string
        {
            if ($pendingPlanKey !== '' || trim((string) ($subscription['checkoutSessionId'] ?? '')) !== '') {
                return 'pending_checkout';
            }
            if (trim((string) ($subscription['trialEndsAt'] ?? '')) !== '') {
                return 'trialing';
            }
            if (
                trim((string) ($subscription['stripeSubscriptionId'] ?? '')) !== ''
                || trim((string) ($subscription['renewalAt'] ?? '')) !== ''
            ) {
                return $planKey === 'free' ? 'free' : 'active';
            }

            return 'free';
        }

        private static function normalizeOptionalPlanKey(mixed $value): string
        {
            $raw = trim((string) $value);
            if ($raw === '') {
                return '';
            }

            return self::normalizePlanKey($raw);
        }

        private static function normalizeActivationStatus(string $status, string $planKey): string
        {
            $normalized = strtolower(trim($status));
            if ($normalized === 'trialing') {
                return 'trialing';
            }
            if ($normalized === 'past_due') {
                return 'past_due';
            }

            return $planKey === 'free' ? 'free' : 'active';
        }

        private static function normalizeInvoiceHistory(mixed $invoices): array
        {
            if (!is_array($invoices)) {
                return [];
            }

            $normalized = [];
            foreach ($invoices as $invoice) {
                if (!is_array($invoice)) {
                    continue;
                }

                $id = trim((string) ($invoice['id'] ?? ''));
                if ($id === '') {
                    continue;
                }

                $normalized[] = [
                    'id' => $id,
                    'number' => trim((string) ($invoice['number'] ?? '')),
                    'status' => trim((string) ($invoice['status'] ?? '')),
                    'statusLabel' => trim((string) ($invoice['statusLabel'] ?? '')),
                    'amountCents' => (int) ($invoice['amountCents'] ?? 0),
                    'amountLabel' => trim((string) ($invoice['amountLabel'] ?? '')),
                    'currency' => strtolower(trim((string) ($invoice['currency'] ?? 'usd'))),
                    'hostedInvoiceUrl' => trim((string) ($invoice['hostedInvoiceUrl'] ?? '')),
                    'invoicePdfUrl' => trim((string) ($invoice['invoicePdfUrl'] ?? '')),
                    'paidAt' => self::normalizeDateString($invoice['paidAt'] ?? ''),
                    'createdAt' => self::normalizeDateString($invoice['createdAt'] ?? ''),
                    'renewalAt' => self::normalizeDateString($invoice['renewalAt'] ?? ''),
                    'planKey' => self::normalizeOptionalPlanKey($invoice['planKey'] ?? '') ?: 'free',
                ];
            }

            return array_values($normalized);
        }

        private static function normalizeInvoiceRecord(array $invoice, string $eventStatus, string $fallbackPlanKey): array
        {
            $status = strtolower(trim($eventStatus));
            if ($status === '') {
                $status = strtolower(trim((string) ($invoice['status'] ?? 'pending')));
            }

            $amountCents = (int) ($invoice['amount_paid'] ?? ($invoice['amount_due'] ?? ($invoice['total'] ?? 0)));
            $currency = strtolower(trim((string) ($invoice['currency'] ?? 'usd')));

            return [
                'id' => trim((string) ($invoice['id'] ?? '')),
                'number' => trim((string) ($invoice['number'] ?? '')),
                'status' => $status,
                'statusLabel' => self::invoiceStatusLabel($status),
                'amountCents' => $amountCents,
                'amountLabel' => self::formatMoney($amountCents, $currency),
                'currency' => $currency,
                'hostedInvoiceUrl' => trim((string) ($invoice['hosted_invoice_url'] ?? '')),
                'invoicePdfUrl' => trim((string) ($invoice['invoice_pdf'] ?? '')),
                'paidAt' => self::normalizeDateString($invoice['paid_at'] ?? ''),
                'createdAt' => self::normalizeDateString($invoice['created'] ?? ''),
                'renewalAt' => self::normalizeDateString($invoice['current_period_end'] ?? ''),
                'planKey' => self::normalizeOptionalPlanKey(($invoice['metadata']['plan_key'] ?? '') ?: $fallbackPlanKey) ?: 'free',
            ];
        }

        private static function upsertInvoiceRecord(array $invoices, array $invoiceRecord): array
        {
            $recordId = trim((string) ($invoiceRecord['id'] ?? ''));
            if ($recordId === '') {
                return self::normalizeInvoiceHistory($invoices);
            }

            $result = [$invoiceRecord];
            foreach (self::normalizeInvoiceHistory($invoices) as $invoice) {
                if ((string) ($invoice['id'] ?? '') === $recordId) {
                    continue;
                }
                $result[] = $invoice;
            }

            return array_slice($result, 0, 20);
        }

        private static function invoiceStatusLabel(string $status): string
        {
            return match (strtolower(trim($status))) {
                'paid' => 'Pagada',
                'failed', 'uncollectible', 'past_due' => 'Fallida',
                'void' => 'Anulada',
                default => 'Pendiente',
            };
        }

        private static function formatMoney(int $amountCents, string $currency): string
        {
            $amount = number_format($amountCents / 100, 2, '.', ',');
            return match (strtolower(trim($currency))) {
                'usd' => '$' . $amount,
                'eur' => 'EUR ' . $amount,
                default => strtoupper(trim($currency)) . ' ' . $amount,
            };
        }

        private static function normalizeDateString(mixed $value): string
        {
            $date = self::parseDateTime($value);
            return $date instanceof DateTimeImmutable ? $date->format('c') : '';
        }

        private static function parseDateTime(mixed $value): ?DateTimeImmutable
        {
            if ($value instanceof DateTimeImmutable) {
                return $value;
            }
            if ($value instanceof DateTimeInterface) {
                return new DateTimeImmutable($value->format('c'));
            }

            if (is_int($value) || (is_string($value) && ctype_digit(trim($value)))) {
                try {
                    return (new DateTimeImmutable('@' . (int) $value))->setTimezone(self::appTimezone());
                } catch (Throwable) {
                    return null;
                }
            }

            $raw = trim((string) $value);
            if ($raw === '') {
                return null;
            }

            try {
                return new DateTimeImmutable($raw);
            } catch (Throwable) {
                return null;
            }
        }

        private static function dateTimeOrNow(?string $value = null): DateTimeImmutable
        {
            $parsed = self::parseDateTime($value ?? '');
            if ($parsed instanceof DateTimeImmutable) {
                return $parsed;
            }

            return new DateTimeImmutable('now', self::appTimezone());
        }

        private static function nowString(): string
        {
            if (function_exists('local_date')) {
                return local_date('c');
            }

            return (new DateTimeImmutable('now', self::appTimezone()))->format('c');
        }

        private static function appTimezone(): DateTimeZone
        {
            try {
                return new DateTimeZone(date_default_timezone_get() ?: 'America/Guayaquil');
            } catch (Throwable) {
                return new DateTimeZone('America/Guayaquil');
            }
        }
    }
}
