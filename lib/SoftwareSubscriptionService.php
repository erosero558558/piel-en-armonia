<?php

declare(strict_types=1);

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/AppConfig.php';

final class SoftwareSubscriptionService
{
    private const DEFAULT_INTERVAL = 'month';
    private const DEFAULT_TRIAL_PLAN = 'pro';
    private const DEFAULT_TRIAL_DAYS = 14;
    private const TRIAL_REMINDER_DAYS_BEFORE_END = 2;

    public static function catalog(): array
    {
        return [
            'free' => [
                'key' => 'free',
                'label' => 'Free',
                'amountCents' => 0,
                'currency' => 'USD',
                'interval' => '',
                'doctorLimit' => 1,
                'appointmentsLimit' => 50,
                'stripeEnabled' => false,
            ],
            'starter' => [
                'key' => 'starter',
                'label' => 'Starter',
                'amountCents' => 2900,
                'currency' => 'USD',
                'interval' => self::DEFAULT_INTERVAL,
                'doctorLimit' => 3,
                'appointmentsLimit' => 0,
                'stripeEnabled' => true,
            ],
            'pro' => [
                'key' => 'pro',
                'label' => 'Pro',
                'amountCents' => 7900,
                'currency' => 'USD',
                'interval' => self::DEFAULT_INTERVAL,
                'doctorLimit' => 10,
                'appointmentsLimit' => 0,
                'stripeEnabled' => true,
            ],
            'enterprise' => [
                'key' => 'enterprise',
                'label' => 'Enterprise',
                'amountCents' => 0,
                'currency' => 'USD',
                'interval' => '',
                'doctorLimit' => 0,
                'appointmentsLimit' => 0,
                'stripeEnabled' => false,
            ],
        ];
    }

    public static function normalizePlanKey(string $rawPlan): string
    {
        $normalized = strtolower(trim($rawPlan));

        return match ($normalized) {
            'free', 'gratis' => 'free',
            'starter' => 'starter',
            'pro' => 'pro',
            'enterprise', 'empresarial' => 'enterprise',
            'basico', 'básico', 'basic' => 'free',
            default => 'free',
        };
    }

    public static function planLabel(string $planKey): string
    {
        $catalog = self::catalog();
        $safePlanKey = self::normalizePlanKey($planKey);
        return (string) ($catalog[$safePlanKey]['label'] ?? 'Free');
    }

    public static function derivePlanKeyFromClinicProfile(array $clinicProfile): string
    {
        $subscription = isset($clinicProfile['software_subscription']) && is_array($clinicProfile['software_subscription'])
            ? $clinicProfile['software_subscription']
            : [];
        $subscriptionPlanKey = trim((string) ($subscription['planKey'] ?? ''));
        if ($subscriptionPlanKey !== '') {
            return self::normalizePlanKey($subscriptionPlanKey);
        }

        return self::normalizePlanKey((string) ($clinicProfile['software_plan'] ?? 'free'));
    }

    public static function normalizeSubscription(
        array $snapshot,
        string $fallbackPlanKey = 'free'
    ): array {
        $catalog = self::catalog();
        $activePlanKey = self::normalizePlanKey((string) ($snapshot['planKey'] ?? $fallbackPlanKey));
        $pendingPlanKey = self::normalizePendingPlanKey($snapshot['pendingPlanKey'] ?? '');
        $plan = $catalog[$activePlanKey] ?? $catalog['free'];
        $currency = strtoupper(trim((string) ($snapshot['currency'] ?? $plan['currency'] ?? self::defaultCurrency())));
        if ($currency === '') {
            $currency = self::defaultCurrency();
        }

        $status = self::normalizeStatus(
            (string) ($snapshot['status'] ?? ($activePlanKey === 'free' ? 'free' : 'inactive'))
        );
        if ($status === 'free' && $activePlanKey !== 'free') {
            $status = 'inactive';
        }
        if ($pendingPlanKey !== '' && $status !== 'active' && $status !== 'trialing' && $status !== 'past_due') {
            $status = 'pending_checkout';
        }

        $amountCents = isset($snapshot['amountCents']) && is_numeric($snapshot['amountCents'])
            ? max(0, (int) $snapshot['amountCents'])
            : (int) ($plan['amountCents'] ?? 0);
        if ($activePlanKey === 'free' || $activePlanKey === 'enterprise') {
            $amountCents = (int) ($plan['amountCents'] ?? 0);
        }

        $interval = trim((string) ($snapshot['billingInterval'] ?? ($plan['interval'] ?? '')));
        $updatedAt = self::normalizeIsoDateTimeString((string) ($snapshot['updatedAt'] ?? local_date('c')));
        if ($updatedAt === '') {
            $updatedAt = local_date('c');
        }

        return [
            'status' => $status,
            'statusLabel' => self::statusLabel($status),
            'planKey' => $activePlanKey,
            'planLabel' => self::planLabel($activePlanKey),
            'pendingPlanKey' => $pendingPlanKey,
            'pendingPlanLabel' => $pendingPlanKey !== '' ? self::planLabel($pendingPlanKey) : '',
            'billingInterval' => $interval,
            'currency' => $currency,
            'amountCents' => $amountCents,
            'amountLabel' => self::formatPlanPrice($amountCents, $currency, $interval, $activePlanKey),
            'startedAt' => self::normalizeIsoDateTimeString((string) ($snapshot['startedAt'] ?? '')),
            'renewalAt' => self::normalizeIsoDateTimeString((string) ($snapshot['renewalAt'] ?? '')),
            'trialEndsAt' => self::normalizeIsoDateTimeString((string) ($snapshot['trialEndsAt'] ?? '')),
            'trialReminderSentAt' => self::normalizeIsoDateTimeString((string) ($snapshot['trialReminderSentAt'] ?? '')),
            'trialReminderChannel' => trim((string) ($snapshot['trialReminderChannel'] ?? '')),
            'trialReminderOutboxId' => trim((string) ($snapshot['trialReminderOutboxId'] ?? '')),
            'endedAt' => self::normalizeIsoDateTimeString((string) ($snapshot['endedAt'] ?? '')),
            'downgradedAt' => self::normalizeIsoDateTimeString((string) ($snapshot['downgradedAt'] ?? '')),
            'checkoutSessionId' => trim((string) ($snapshot['checkoutSessionId'] ?? '')),
            'checkoutUrl' => trim((string) ($snapshot['checkoutUrl'] ?? '')),
            'stripeCustomerId' => trim((string) ($snapshot['stripeCustomerId'] ?? '')),
            'stripeSubscriptionId' => trim((string) ($snapshot['stripeSubscriptionId'] ?? '')),
            'latestInvoiceId' => trim((string) ($snapshot['latestInvoiceId'] ?? '')),
            'invoices' => self::normalizeInvoices(
                isset($snapshot['invoices']) && is_array($snapshot['invoices']) ? $snapshot['invoices'] : [],
                $currency
            ),
            'updatedAt' => $updatedAt,
        ];
    }

    public static function normalizeClinicProfileSubscription(array $clinicProfile): array
    {
        $fallbackPlanKey = self::derivePlanKeyFromClinicProfile($clinicProfile);
        $snapshot = isset($clinicProfile['software_subscription']) && is_array($clinicProfile['software_subscription'])
            ? $clinicProfile['software_subscription']
            : [];

        return self::normalizeSubscription($snapshot, $fallbackPlanKey);
    }

    public static function canManuallyEditPlan(array $subscription): bool
    {
        $status = self::normalizeStatus((string) ($subscription['status'] ?? ''));
        $pendingPlanKey = self::normalizePendingPlanKey($subscription['pendingPlanKey'] ?? '');
        return $pendingPlanKey === '' && in_array($status, ['free', 'inactive', 'canceled'], true);
    }

    public static function shouldAutoStartTrial(array $clinicProfile): bool
    {
        $subscription = self::normalizeClinicProfileSubscription($clinicProfile);
        if (in_array($subscription['status'], ['trialing', 'active', 'past_due', 'pending_checkout'], true)) {
            return false;
        }

        foreach (
            [
                'trialEndsAt',
                'checkoutSessionId',
                'checkoutUrl',
                'stripeCustomerId',
                'stripeSubscriptionId',
                'latestInvoiceId',
            ] as $field
        ) {
            if (trim((string) ($subscription[$field] ?? '')) !== '') {
                return false;
            }
        }

        return true;
    }

    public static function startTrial(
        array $clinicProfile,
        string $planKey = self::DEFAULT_TRIAL_PLAN,
        int $trialDays = self::DEFAULT_TRIAL_DAYS,
        string $startedAt = ''
    ): array {
        $safePlanKey = self::normalizePlanKey($planKey);
        if (!in_array($safePlanKey, ['starter', 'pro'], true)) {
            $safePlanKey = self::DEFAULT_TRIAL_PLAN;
        }

        $plan = self::catalog()[$safePlanKey] ?? self::catalog()[self::DEFAULT_TRIAL_PLAN];
        $subscription = self::normalizeClinicProfileSubscription($clinicProfile);
        $startedAt = self::resolveEventTimestamp($startedAt, '', local_date('c'));
        $trialEndsAt = self::shiftDateTime($startedAt, '+' . max(1, $trialDays) . ' days');

        $subscription = array_merge($subscription, [
            'status' => 'trialing',
            'statusLabel' => self::statusLabel('trialing'),
            'planKey' => $safePlanKey,
            'planLabel' => (string) ($plan['label'] ?? self::planLabel($safePlanKey)),
            'pendingPlanKey' => '',
            'pendingPlanLabel' => '',
            'billingInterval' => (string) ($plan['interval'] ?? self::DEFAULT_INTERVAL),
            'currency' => strtoupper((string) ($plan['currency'] ?? self::defaultCurrency())),
            'amountCents' => (int) ($plan['amountCents'] ?? 0),
            'amountLabel' => self::formatPlanPrice(
                (int) ($plan['amountCents'] ?? 0),
                strtoupper((string) ($plan['currency'] ?? self::defaultCurrency())),
                (string) ($plan['interval'] ?? self::DEFAULT_INTERVAL),
                $safePlanKey
            ),
            'startedAt' => $startedAt,
            'renewalAt' => '',
            'trialEndsAt' => $trialEndsAt,
            'trialReminderSentAt' => '',
            'trialReminderChannel' => '',
            'trialReminderOutboxId' => '',
            'endedAt' => '',
            'downgradedAt' => '',
            'checkoutSessionId' => '',
            'checkoutUrl' => '',
            'stripeCustomerId' => '',
            'stripeSubscriptionId' => '',
            'latestInvoiceId' => '',
            'updatedAt' => local_date('c'),
        ]);

        return self::mergeIntoClinicProfile($clinicProfile, $subscription);
    }

    public static function describeTrialLifecycle(array $clinicProfile, array $options = []): array
    {
        $subscription = self::normalizeClinicProfileSubscription($clinicProfile);
        $nowIso = self::resolveEventTimestamp((string) ($options['now'] ?? ''), '', local_date('c'));
        $now = self::safeDateTime($nowIso);
        $trialEndsAt = trim((string) ($subscription['trialEndsAt'] ?? ''));
        $trialEndsAtValue = self::safeDateTime($trialEndsAt);
        $reminderAtValue = $trialEndsAtValue
            ? $trialEndsAtValue->modify('-' . self::TRIAL_REMINDER_DAYS_BEFORE_END . ' days')
            : null;

        $isTrialing = $subscription['status'] === 'trialing'
            && $trialEndsAt !== ''
            && $trialEndsAtValue instanceof DateTimeImmutable;
        $shouldDowngrade = $isTrialing && $now instanceof DateTimeImmutable && $now >= $trialEndsAtValue;
        $shouldSendReminder = $isTrialing
            && !$shouldDowngrade
            && trim((string) ($subscription['trialReminderSentAt'] ?? '')) === ''
            && $now instanceof DateTimeImmutable
            && $reminderAtValue instanceof DateTimeImmutable
            && $now >= $reminderAtValue;

        $secondsRemaining = 0;
        if ($isTrialing && $now instanceof DateTimeImmutable && $trialEndsAtValue instanceof DateTimeImmutable) {
            $secondsRemaining = max(0, $trialEndsAtValue->getTimestamp() - $now->getTimestamp());
        }

        return [
            'active' => $isTrialing,
            'planKey' => (string) ($subscription['planKey'] ?? 'free'),
            'planLabel' => (string) ($subscription['planLabel'] ?? self::planLabel((string) ($subscription['planKey'] ?? 'free'))),
            'status' => (string) ($subscription['status'] ?? 'inactive'),
            'startedAt' => (string) ($subscription['startedAt'] ?? ''),
            'trialEndsAt' => $trialEndsAt,
            'trialReminderSentAt' => (string) ($subscription['trialReminderSentAt'] ?? ''),
            'reminderAt' => $reminderAtValue ? $reminderAtValue->format('c') : '',
            'daysRemaining' => $secondsRemaining > 0 ? (int) ceil($secondsRemaining / 86400) : 0,
            'shouldSendReminder' => $shouldSendReminder,
            'shouldDowngrade' => $shouldDowngrade,
            'now' => $now ? $now->format('c') : '',
        ];
    }

    public static function markTrialReminderSent(
        array $clinicProfile,
        string $channel,
        string $reference = '',
        string $sentAt = ''
    ): array {
        $subscription = self::normalizeClinicProfileSubscription($clinicProfile);
        if ($subscription['status'] !== 'trialing') {
            return self::mergeIntoClinicProfile($clinicProfile, $subscription);
        }

        $subscription['trialReminderSentAt'] = self::resolveEventTimestamp($sentAt, '', local_date('c'));
        $subscription['trialReminderChannel'] = trim($channel);
        $subscription['trialReminderOutboxId'] = trim($reference);
        $subscription['updatedAt'] = local_date('c');

        return self::mergeIntoClinicProfile($clinicProfile, $subscription);
    }

    public static function downgradeExpiredTrial(
        array $clinicProfile,
        string $downgradedAt = '',
        string $reason = 'trial_expired'
    ): array {
        $subscription = self::normalizeClinicProfileSubscription($clinicProfile);
        $effectiveAt = self::resolveEventTimestamp($downgradedAt, '', local_date('c'));

        $subscription = array_merge($subscription, [
            'status' => 'free',
            'statusLabel' => self::statusLabel('free'),
            'planKey' => 'free',
            'planLabel' => self::planLabel('free'),
            'pendingPlanKey' => '',
            'pendingPlanLabel' => '',
            'billingInterval' => '',
            'currency' => self::defaultCurrency(),
            'amountCents' => 0,
            'amountLabel' => self::formatPlanPrice(0, self::defaultCurrency(), '', 'free'),
            'renewalAt' => '',
            'trialEndsAt' => '',
            'checkoutSessionId' => '',
            'checkoutUrl' => '',
            'stripeCustomerId' => '',
            'stripeSubscriptionId' => '',
            'latestInvoiceId' => '',
            'endedAt' => $effectiveAt,
            'downgradedAt' => $effectiveAt,
            'updatedAt' => local_date('c'),
        ]);

        if ($reason === 'trial_expired') {
            $subscription['trialReminderChannel'] = trim((string) ($subscription['trialReminderChannel'] ?? ''));
        }

        return self::mergeIntoClinicProfile($clinicProfile, $subscription);
    }

    public static function applyManualPlanSelection(array $subscription, string $planKey): array
    {
        $safePlanKey = self::normalizePlanKey($planKey);
        $catalog = self::catalog();
        $plan = $catalog[$safePlanKey] ?? $catalog['free'];
        $current = self::normalizeSubscription($subscription, $safePlanKey);

        $current['planKey'] = $safePlanKey;
        $current['planLabel'] = (string) $plan['label'];
        $current['billingInterval'] = (string) ($plan['interval'] ?? '');
        $current['currency'] = strtoupper((string) ($plan['currency'] ?? self::defaultCurrency()));
        $current['amountCents'] = (int) ($plan['amountCents'] ?? 0);
        $current['amountLabel'] = self::formatPlanPrice(
            $current['amountCents'],
            $current['currency'],
            $current['billingInterval'],
            $safePlanKey
        );
        $current['pendingPlanKey'] = '';
        $current['pendingPlanLabel'] = '';
        $current['checkoutSessionId'] = '';
        $current['checkoutUrl'] = '';
        $current['trialEndsAt'] = '';
        $current['trialReminderSentAt'] = '';
        $current['trialReminderChannel'] = '';
        $current['trialReminderOutboxId'] = '';
        $current['downgradedAt'] = '';
        $current['updatedAt'] = local_date('c');

        if ($safePlanKey === 'free') {
            $current['status'] = 'free';
            $current['statusLabel'] = self::statusLabel('free');
            $current['renewalAt'] = '';
        } else {
            $current['status'] = 'inactive';
            $current['statusLabel'] = self::statusLabel('inactive');
            $current['renewalAt'] = '';
        }

        return self::normalizeSubscription($current, $safePlanKey);
    }

    public static function beginCheckout(
        array $clinicProfile,
        string $targetPlanKey,
        array $session
    ): array {
        $subscription = self::normalizeClinicProfileSubscription($clinicProfile);
        $safePlanKey = self::normalizePlanKey($targetPlanKey);
        $subscription['status'] = 'pending_checkout';
        $subscription['statusLabel'] = self::statusLabel('pending_checkout');
        $subscription['pendingPlanKey'] = $safePlanKey;
        $subscription['pendingPlanLabel'] = self::planLabel($safePlanKey);
        $subscription['checkoutSessionId'] = trim((string) ($session['id'] ?? ''));
        $subscription['checkoutUrl'] = trim((string) ($session['url'] ?? ''));
        $subscription['updatedAt'] = local_date('c');

        return self::mergeIntoClinicProfile($clinicProfile, $subscription);
    }

    public static function activateFromCheckoutSession(array $clinicProfile, array $session): array
    {
        $subscription = self::normalizeClinicProfileSubscription($clinicProfile);
        $metadata = isset($session['metadata']) && is_array($session['metadata']) ? $session['metadata'] : [];
        $targetPlanKey = self::normalizePlanKey(
            (string) ($metadata['plan_key'] ?? $subscription['pendingPlanKey'] ?? $subscription['planKey'] ?? 'free')
        );
        $plan = self::catalog()[$targetPlanKey] ?? self::catalog()['free'];
        $status = self::normalizeStatus((string) ($session['subscription_status'] ?? 'active'));
        if (!in_array($status, ['active', 'trialing', 'past_due'], true)) {
            $status = 'active';
        }

        $startedAt = self::resolveEventTimestamp(
            $session['completed_at'] ?? '',
            $session['created'] ?? '',
            local_date('c')
        );
        $renewalAt = self::resolveRenewalAt($session, $startedAt);
        $invoiceRecord = self::invoiceFromStripePayload(
            [
                'id' => $session['invoice'] ?? '',
                'status' => $status === 'past_due' ? 'open' : 'paid',
                'amount_paid' => $plan['amountCents'] ?? 0,
                'currency' => $plan['currency'] ?? self::defaultCurrency(),
                'hosted_invoice_url' => $session['invoice_url'] ?? '',
                'invoice_pdf' => $session['invoice_pdf'] ?? '',
                'created' => $session['completed_at'] ?? $session['created'] ?? '',
                'paid_at' => $status === 'past_due' ? '' : ($session['completed_at'] ?? $session['created'] ?? ''),
                'period_start' => $startedAt,
                'period_end' => $renewalAt,
                'metadata' => $metadata,
            ],
            $targetPlanKey
        );

        $subscription = array_merge($subscription, [
            'status' => $status,
            'statusLabel' => self::statusLabel($status),
            'planKey' => $targetPlanKey,
            'planLabel' => (string) ($plan['label'] ?? self::planLabel($targetPlanKey)),
            'pendingPlanKey' => '',
            'pendingPlanLabel' => '',
            'billingInterval' => (string) ($plan['interval'] ?? self::DEFAULT_INTERVAL),
            'currency' => strtoupper((string) ($plan['currency'] ?? self::defaultCurrency())),
            'amountCents' => (int) ($plan['amountCents'] ?? 0),
            'amountLabel' => self::formatPlanPrice(
                (int) ($plan['amountCents'] ?? 0),
                strtoupper((string) ($plan['currency'] ?? self::defaultCurrency())),
                (string) ($plan['interval'] ?? self::DEFAULT_INTERVAL),
                $targetPlanKey
            ),
            'startedAt' => $startedAt,
            'renewalAt' => $renewalAt,
            'trialEndsAt' => '',
            'trialReminderSentAt' => '',
            'trialReminderChannel' => '',
            'trialReminderOutboxId' => '',
            'downgradedAt' => '',
            'checkoutSessionId' => trim((string) ($session['id'] ?? $subscription['checkoutSessionId'] ?? '')),
            'checkoutUrl' => '',
            'stripeCustomerId' => trim((string) ($session['customer'] ?? $subscription['stripeCustomerId'] ?? '')),
            'stripeSubscriptionId' => trim((string) ($session['subscription'] ?? $subscription['stripeSubscriptionId'] ?? '')),
            'latestInvoiceId' => (string) ($invoiceRecord['id'] ?? ''),
            'updatedAt' => local_date('c'),
        ]);

        $subscription['invoices'] = self::upsertInvoiceList(
            isset($subscription['invoices']) && is_array($subscription['invoices']) ? $subscription['invoices'] : [],
            $invoiceRecord,
            (string) ($subscription['currency'] ?? self::defaultCurrency())
        );

        return self::mergeIntoClinicProfile($clinicProfile, $subscription);
    }

    public static function applyInvoiceEvent(array $clinicProfile, array $invoice, string $defaultStatus = 'paid'): array
    {
        $subscription = self::normalizeClinicProfileSubscription($clinicProfile);
        $metadata = isset($invoice['metadata']) && is_array($invoice['metadata']) ? $invoice['metadata'] : [];
        $planKey = self::normalizePlanKey(
            (string) ($metadata['plan_key'] ?? $subscription['planKey'] ?? 'free')
        );
        $invoiceRecord = self::invoiceFromStripePayload($invoice, $planKey);
        if ($defaultStatus === 'paid' && $invoiceRecord['status'] === '') {
            $invoiceRecord['status'] = 'paid';
            $invoiceRecord['statusLabel'] = self::invoiceStatusLabel('paid');
        }

        $renewalAt = self::normalizeIsoDateTimeString(
            (string) ($invoice['current_period_end'] ?? $invoice['period_end'] ?? $invoiceRecord['periodEnd'] ?? '')
        );
        if ($renewalAt === '') {
            $renewalAt = (string) ($subscription['renewalAt'] ?? '');
        }

        $status = $defaultStatus === 'failed' ? 'past_due' : 'active';

        $plan = self::catalog()[$planKey] ?? self::catalog()['free'];
        $subscription = array_merge($subscription, [
            'status' => $status,
            'statusLabel' => self::statusLabel($status),
            'planKey' => $planKey,
            'planLabel' => (string) ($plan['label'] ?? self::planLabel($planKey)),
            'billingInterval' => (string) ($plan['interval'] ?? self::DEFAULT_INTERVAL),
            'currency' => strtoupper((string) ($plan['currency'] ?? self::defaultCurrency())),
            'amountCents' => (int) ($plan['amountCents'] ?? 0),
            'amountLabel' => self::formatPlanPrice(
                (int) ($plan['amountCents'] ?? 0),
                strtoupper((string) ($plan['currency'] ?? self::defaultCurrency())),
                (string) ($plan['interval'] ?? self::DEFAULT_INTERVAL),
                $planKey
            ),
            'stripeCustomerId' => trim((string) ($invoice['customer'] ?? $subscription['stripeCustomerId'] ?? '')),
            'stripeSubscriptionId' => trim((string) ($invoice['subscription'] ?? $subscription['stripeSubscriptionId'] ?? '')),
            'latestInvoiceId' => (string) ($invoiceRecord['id'] ?? $subscription['latestInvoiceId'] ?? ''),
            'renewalAt' => $renewalAt,
            'trialEndsAt' => $status === 'active' ? '' : (string) ($subscription['trialEndsAt'] ?? ''),
            'trialReminderSentAt' => $status === 'active' ? '' : (string) ($subscription['trialReminderSentAt'] ?? ''),
            'trialReminderChannel' => $status === 'active' ? '' : (string) ($subscription['trialReminderChannel'] ?? ''),
            'trialReminderOutboxId' => $status === 'active' ? '' : (string) ($subscription['trialReminderOutboxId'] ?? ''),
            'downgradedAt' => '',
            'updatedAt' => local_date('c'),
        ]);
        $subscription['invoices'] = self::upsertInvoiceList(
            isset($subscription['invoices']) && is_array($subscription['invoices']) ? $subscription['invoices'] : [],
            $invoiceRecord,
            (string) ($subscription['currency'] ?? self::defaultCurrency())
        );

        return self::mergeIntoClinicProfile($clinicProfile, $subscription);
    }

    public static function cancelFromStripeEvent(array $clinicProfile, array $subscriptionEvent): array
    {
        $subscription = self::normalizeClinicProfileSubscription($clinicProfile);
        $subscription['status'] = 'canceled';
        $subscription['statusLabel'] = self::statusLabel('canceled');
        $subscription['pendingPlanKey'] = '';
        $subscription['pendingPlanLabel'] = '';
        $subscription['renewalAt'] = '';
        $subscription['trialEndsAt'] = '';
        $subscription['trialReminderSentAt'] = '';
        $subscription['trialReminderChannel'] = '';
        $subscription['trialReminderOutboxId'] = '';
        $subscription['endedAt'] = self::resolveEventTimestamp(
            $subscriptionEvent['canceled_at'] ?? '',
            $subscriptionEvent['ended_at'] ?? '',
            local_date('c')
        );
        $subscription['stripeSubscriptionId'] = trim((string) ($subscriptionEvent['id'] ?? $subscription['stripeSubscriptionId'] ?? ''));
        $subscription['updatedAt'] = local_date('c');

        return self::mergeIntoClinicProfile($clinicProfile, $subscription);
    }

    public static function mergeIntoClinicProfile(array $clinicProfile, array $subscription): array
    {
        $normalized = self::normalizeSubscription($subscription, self::derivePlanKeyFromClinicProfile($clinicProfile));
        $clinicProfile['software_subscription'] = $normalized;
        $clinicProfile['software_plan'] = self::planLabel((string) ($normalized['planKey'] ?? 'free'));
        return $clinicProfile;
    }

    public static function buildCheckoutPayload(string $planKey, array $clinicProfile): array
    {
        $safePlanKey = self::normalizePlanKey($planKey);
        $catalog = self::catalog();
        $plan = $catalog[$safePlanKey] ?? null;
        if ($plan === null || (bool) ($plan['stripeEnabled'] ?? false) !== true) {
            throw new InvalidArgumentException('Ese plan no se puede activar por Stripe.');
        }

        $clinicName = trim((string) ($clinicProfile['clinicName'] ?? 'Flow OS Clinic'));
        if ($clinicName === '') {
            $clinicName = 'Flow OS Clinic';
        }
        $customerEmail = trim((string) AppConfig::getAdminEmail());
        $baseUrl = rtrim((string) AppConfig::BASE_URL, '/');
        $successUrl = app_backend_status_absolute_url([
            'billing' => 'success',
            'plan' => $safePlanKey,
        ]);
        $cancelUrl = app_backend_status_absolute_url([
            'billing' => 'cancel',
            'plan' => $safePlanKey,
        ]);
        $seed = implode('|', [
            $clinicName,
            $safePlanKey,
            $customerEmail,
            self::currentTenantId(),
        ]);

        return [
            'plan' => $plan,
            'customerEmail' => $customerEmail,
            'successUrl' => $successUrl,
            'cancelUrl' => $cancelUrl,
            'idempotencyKey' => self::buildIdempotencyKey('software-subscription', $seed),
            'metadata' => [
                'site' => 'pielarmonia.com',
                'surface' => 'software_subscription',
                'plan_key' => $safePlanKey,
                'clinic_name' => $clinicName,
                'tenant_id' => self::currentTenantId(),
            ],
            'description' => 'Suscripcion Flow OS - ' . (string) ($plan['label'] ?? self::planLabel($safePlanKey)),
            'productName' => 'Flow OS ' . (string) ($plan['label'] ?? self::planLabel($safePlanKey)),
        ];
    }

    private static function normalizeInvoices(array $items, string $currency): array
    {
        $normalized = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            $invoice = [
                'id' => trim((string) ($item['id'] ?? '')),
                'number' => trim((string) ($item['number'] ?? '')),
                'status' => trim((string) ($item['status'] ?? '')),
                'statusLabel' => trim((string) ($item['statusLabel'] ?? '')),
                'amountCents' => max(0, (int) ($item['amountCents'] ?? 0)),
                'amountLabel' => trim((string) ($item['amountLabel'] ?? '')),
                'currency' => strtoupper(trim((string) ($item['currency'] ?? $currency))),
                'issuedAt' => self::normalizeIsoDateTimeString((string) ($item['issuedAt'] ?? '')),
                'paidAt' => self::normalizeIsoDateTimeString((string) ($item['paidAt'] ?? '')),
                'periodStart' => self::normalizeIsoDateTimeString((string) ($item['periodStart'] ?? '')),
                'periodEnd' => self::normalizeIsoDateTimeString((string) ($item['periodEnd'] ?? '')),
                'hostedInvoiceUrl' => trim((string) ($item['hostedInvoiceUrl'] ?? '')),
                'invoicePdf' => trim((string) ($item['invoicePdf'] ?? '')),
            ];

            if ($invoice['status'] === '') {
                $invoice['status'] = 'paid';
            }
            if ($invoice['statusLabel'] === '') {
                $invoice['statusLabel'] = self::invoiceStatusLabel($invoice['status']);
            }
            if ($invoice['amountLabel'] === '') {
                $invoice['amountLabel'] = self::formatMoney(
                    (int) $invoice['amountCents'],
                    (string) $invoice['currency']
                );
            }

            $normalized[] = $invoice;
        }

        usort($normalized, static function (array $left, array $right): int {
            return strcmp(
                (string) ($right['issuedAt'] ?? ''),
                (string) ($left['issuedAt'] ?? '')
            );
        });

        return array_slice($normalized, 0, 12);
    }

    private static function invoiceFromStripePayload(array $invoice, string $planKey): array
    {
        $catalog = self::catalog();
        $plan = $catalog[$planKey] ?? $catalog['free'];
        $currency = strtoupper(trim((string) ($invoice['currency'] ?? $plan['currency'] ?? self::defaultCurrency())));
        $amountCents = 0;
        foreach (['amount_paid', 'amount_due', 'amount_remaining', 'subtotal'] as $key) {
            if (isset($invoice[$key]) && is_numeric($invoice[$key])) {
                $amountCents = max(0, (int) $invoice[$key]);
                if ($amountCents > 0) {
                    break;
                }
            }
        }
        if ($amountCents <= 0) {
            $amountCents = (int) ($plan['amountCents'] ?? 0);
        }

        $status = trim((string) ($invoice['status'] ?? ''));
        if ($status === '') {
            $status = 'paid';
        }

        return [
            'id' => trim((string) ($invoice['id'] ?? '')),
            'number' => trim((string) ($invoice['number'] ?? '')),
            'status' => $status,
            'statusLabel' => self::invoiceStatusLabel($status),
            'amountCents' => $amountCents,
            'amountLabel' => self::formatMoney($amountCents, $currency),
            'currency' => $currency,
            'issuedAt' => self::resolveEventTimestamp(
                $invoice['created'] ?? '',
                $invoice['issued_at'] ?? '',
                local_date('c')
            ),
            'paidAt' => self::normalizeIsoDateTimeString(
                (string) ($invoice['paid_at'] ?? $invoice['status_transitions']['paid_at'] ?? '')
            ),
            'periodStart' => self::resolveEventTimestamp(
                $invoice['period_start'] ?? '',
                $invoice['lines']['data'][0]['period']['start'] ?? '',
                ''
            ),
            'periodEnd' => self::resolveEventTimestamp(
                $invoice['period_end'] ?? '',
                $invoice['lines']['data'][0]['period']['end'] ?? '',
                ''
            ),
            'hostedInvoiceUrl' => trim((string) ($invoice['hosted_invoice_url'] ?? '')),
            'invoicePdf' => trim((string) ($invoice['invoice_pdf'] ?? '')),
        ];
    }

    private static function upsertInvoiceList(array $current, array $invoice, string $currency): array
    {
        $items = self::normalizeInvoices($current, $currency);
        $invoiceId = trim((string) ($invoice['id'] ?? ''));
        if ($invoiceId === '') {
            return $items;
        }

        $replaced = false;
        foreach ($items as $index => $existing) {
            if ((string) ($existing['id'] ?? '') !== $invoiceId) {
                continue;
            }
            $items[$index] = array_merge($existing, $invoice);
            $replaced = true;
            break;
        }

        if (!$replaced) {
            $items[] = $invoice;
        }

        return self::normalizeInvoices($items, $currency);
    }

    private static function resolveRenewalAt(array $session, string $fallbackStartedAt): string
    {
        foreach ([
            $session['current_period_end'] ?? '',
            $session['subscription_details']['current_period_end'] ?? '',
            $session['period_end'] ?? '',
        ] as $candidate) {
            $normalized = self::resolveEventTimestamp($candidate, '', '');
            if ($normalized !== '') {
                return $normalized;
            }
        }

        if ($fallbackStartedAt === '') {
            return '';
        }

        try {
            return (new DateTimeImmutable($fallbackStartedAt))
                ->modify('+1 month')
                ->format('c');
        } catch (Throwable $error) {
            return '';
        }
    }

    private static function shiftDateTime(string $isoDateTime, string $modifier): string
    {
        $value = self::safeDateTime($isoDateTime);
        if (!$value instanceof DateTimeImmutable) {
            return '';
        }

        try {
            return $value->modify($modifier)->format('c');
        } catch (Throwable $error) {
            return '';
        }
    }

    private static function safeDateTime(string $value): ?DateTimeImmutable
    {
        $normalized = self::normalizeIsoDateTimeString($value);
        if ($normalized === '') {
            return null;
        }

        try {
            return new DateTimeImmutable($normalized);
        } catch (Throwable $error) {
            return null;
        }
    }

    private static function normalizePendingPlanKey($value): string
    {
        $planKey = self::normalizePlanKey((string) $value);
        return in_array($planKey, ['starter', 'pro'], true) ? $planKey : '';
    }

    private static function normalizeStatus(string $rawStatus): string
    {
        $status = strtolower(trim($rawStatus));

        return match ($status) {
            'active' => 'active',
            'trialing', 'trial' => 'trialing',
            'past_due', 'past-due' => 'past_due',
            'canceled', 'cancelled' => 'canceled',
            'pending_checkout', 'pending-checkout', 'checkout_pending' => 'pending_checkout',
            'inactive' => 'inactive',
            'free' => 'free',
            default => 'inactive',
        };
    }

    private static function statusLabel(string $status): string
    {
        return match ($status) {
            'active' => 'Activa',
            'trialing' => 'Trial activo',
            'past_due' => 'Pago pendiente',
            'canceled' => 'Cancelada',
            'pending_checkout' => 'Checkout pendiente',
            'free' => 'Free',
            default => 'Sin suscripción activa',
        };
    }

    private static function invoiceStatusLabel(string $status): string
    {
        return match (strtolower(trim($status))) {
            'paid' => 'Pagada',
            'open' => 'Abierta',
            'void' => 'Anulada',
            'draft' => 'Borrador',
            'uncollectible' => 'Incobrable',
            default => 'Pendiente',
        };
    }

    private static function formatPlanPrice(
        int $amountCents,
        string $currency,
        string $interval,
        string $planKey
    ): string {
        if ($planKey === 'enterprise') {
            return 'Contactar ventas';
        }
        if ($planKey === 'free') {
            return '$0/mes';
        }

        $label = self::formatMoney($amountCents, $currency);
        return $interval !== '' ? $label . '/mes' : $label;
    }

    private static function formatMoney(int $amountCents, string $currency): string
    {
        $prefix = strtoupper($currency) === 'USD' ? '$' : strtoupper($currency) . ' ';
        return $prefix . number_format($amountCents / 100, 2, '.', ',');
    }

    private static function resolveEventTimestamp($candidate, $fallback, string $default): string
    {
        foreach ([$candidate, $fallback] as $value) {
            $normalized = self::normalizeIsoDateTimeString((string) $value);
            if ($normalized !== '') {
                return $normalized;
            }
        }

        return $default;
    }

    private static function normalizeIsoDateTimeString(string $value): string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return '';
        }

        if (preg_match('/^\d+$/', $trimmed)) {
            try {
                return (new DateTimeImmutable('@' . $trimmed))
                    ->setTimezone(new DateTimeZone(date_default_timezone_get() ?: 'UTC'))
                    ->format('c');
            } catch (Throwable $error) {
                return '';
            }
        }

        try {
            return (new DateTimeImmutable($trimmed))->format('c');
        } catch (Throwable $error) {
            return '';
        }
    }

    private static function defaultCurrency(): string
    {
        if (function_exists('payment_currency')) {
            return strtoupper((string) payment_currency());
        }

        return strtoupper((string) AppConfig::CURRENCY_DEFAULT);
    }

    private static function currentTenantId(): string
    {
        if (function_exists('get_current_tenant_id')) {
            return (string) get_current_tenant_id();
        }

        return 'default';
    }

    private static function buildIdempotencyKey(string $prefix, string $seed): string
    {
        if (function_exists('payment_build_idempotency_key')) {
            return (string) payment_build_idempotency_key($prefix, $seed);
        }

        return strtolower($prefix) . '-' . substr(hash('sha256', $seed), 0, 48);
    }
}
