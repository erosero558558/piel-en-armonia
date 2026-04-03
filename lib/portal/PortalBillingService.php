<?php

declare(strict_types=1);

require_once __DIR__ . '/../../lib/api_helpers.php';
require_once __DIR__ . '/../../payment-lib.php';
require_once __DIR__ . '/../../lib/PatientPortalAuth.php';
require_once __DIR__ . '/../../lib/business.php';
require_once __DIR__ . '/../../lib/ClinicProfileStore.php';
require_once __DIR__ . '/../../lib/DocumentVerificationService.php';
require_once __DIR__ . '/../../lib/clinical_history/ClinicalHistoryService.php';
require_once __DIR__ . '/../../lib/clinical_history/ClinicalHistorySessionRepository.php';
require_once __DIR__ . '/../../controllers/PatientPortalDocumentController.php';

final class PortalBillingService
{

    public static function buildBillingSummary(array $store, array $snapshot, ?string $tenantId = null): array
    {
        $orders = self::collectPortalBillingOrders($store, $snapshot);
        $currency = self::portalPaymentCurrency();

        if ($orders === []) {
            return [
                'tone' => 'good',
                'statusLabel' => 'Sin saldo pendiente',
                'statusDetail' => 'No encontramos cobros activos asociados a tu portal por ahora.',
                'totalPendingCents' => 0,
                'totalPendingLabel' => self::formatPortalCurrency(0, $currency),
                'reviewBalanceCents' => 0,
                'reviewBalanceLabel' => self::formatPortalCurrency(0, $currency),
                'lastPayment' => null,
                'nextObligation' => null,
                'payNowUrl' => app_api_relative_url('patient-portal-payments'),
            ];
        }

        $outstandingBalanceCents = 0;
        $reviewBalanceCents = 0;
        $outstandingCount = 0;
        $overdueCount = 0;

        foreach ($orders as $order) {
            $amountCents = (int) ($order['amountCents'] ?? 0);
            $bucket = (string) ($order['statusBucket'] ?? '');
            if ($bucket === 'outstanding') {
                $outstandingBalanceCents += $amountCents;
                $outstandingCount += 1;
                if ((string) ($order['dueState'] ?? '') === 'overdue') {
                    $overdueCount += 1;
                }
            } elseif ($bucket === 'reconciliating') {
                $reviewBalanceCents += $amountCents;
            }
        }

        $totalPendingCents = $outstandingBalanceCents + $reviewBalanceCents;
        $lastPayment = self::findLatestPortalBillingOrder($orders, 'settled');
        $nextObligation = self::findNextPortalBillingOrder($orders);

        [$tone, $statusLabel, $statusDetail] = self::resolveBillingStatus(
            $outstandingBalanceCents,
            $reviewBalanceCents,
            $outstandingCount,
            $overdueCount,
            $lastPayment,
            $nextObligation
        );

        return [
            'tone' => $tone,
            'statusLabel' => $statusLabel,
            'statusDetail' => $statusDetail,
            'totalPendingCents' => $totalPendingCents,
            'totalPendingLabel' => self::formatPortalCurrency($totalPendingCents, $currency),
            'reviewBalanceCents' => $reviewBalanceCents,
            'reviewBalanceLabel' => self::formatPortalCurrency($reviewBalanceCents, $currency),
            'lastPayment' => $lastPayment,
            'nextObligation' => $nextObligation,
            'payNowUrl' => app_api_relative_url('patient-portal-payments'),
        ];
    }


    public static function collectPortalBillingOrders(array $store, array $snapshot): array
    {
        $orders = [];
        $portalPhone = trim((string) ($snapshot['phone'] ?? ''));
        $portalEmail = self::normalizePortalEmail((string) ($snapshot['email'] ?? ''));

        foreach (($store['checkout_orders'] ?? []) as $order) {
            if (!is_array($order) || !self::checkoutOrderMatchesPortalPatient($order, $portalPhone, $portalEmail)) {
                continue;
            }

            $amountCents = (int) ($order['amountCents'] ?? 0);
            if ($amountCents <= 0) {
                continue;
            }

            $status = strtolower(trim((string) ($order['paymentStatus'] ?? 'pending')));
            $paymentMethod = strtolower(trim((string) ($order['paymentMethod'] ?? '')));
            $currency = strtoupper(trim((string) ($order['currency'] ?? self::portalPaymentCurrency())));
            $dueAt = self::resolvePortalBillingDueAt($order);
            $activityAt = self::resolvePortalBillingActivityAt($order);
            $statusBucket = self::resolvePortalBillingBucket($status);
            $dueState = self::resolvePortalBillingDueState($statusBucket, $dueAt);

            $orders[] = [
                'id' => (string) ($order['id'] ?? ''),
                'concept' => trim((string) ($order['concept'] ?? 'Saldo pendiente')),
                'amountCents' => $amountCents,
                'amountLabel' => self::formatPortalCurrency($amountCents, $currency),
                'currency' => $currency,
                'paymentStatus' => $status,
                'paymentStatusLabel' => self::portalPaymentStatusLabel($status, $order),
                'paymentMethod' => $paymentMethod,
                'paymentMethodLabel' => self::portalPaymentMethodLabel($paymentMethod),
                'statusBucket' => $statusBucket,
                'dueAt' => $dueAt,
                'dueAtLabel' => self::buildPortalDateTimeLabel($dueAt, 'Por confirmar'),
                'dueState' => $dueState,
                'activityAt' => $activityAt,
                'activityAtLabel' => self::buildPortalDateTimeLabel($activityAt, 'Sin fecha'),
            ];
        }

        return $orders;
    }


    public static function checkoutOrderMatchesPortalPatient(array $order, string $portalPhone, string $portalEmail): bool
    {
        $payerEmail = self::normalizePortalEmail((string) ($order['payerEmail'] ?? ''));
        if ($portalEmail !== '' && $payerEmail !== '' && $portalEmail === $payerEmail) {
            return true;
        }

        $payerWhatsapp = trim((string) ($order['payerWhatsapp'] ?? ''));
        if ($portalPhone !== '' && $payerWhatsapp !== '' && PatientPortalAuth::matchesPatientPhone($payerWhatsapp, $portalPhone)) {
            return true;
        }

        return false;
    }


    public static function normalizePortalEmail(string $value): string
    {
        return strtolower(trim($value));
    }


    public static function resolvePortalBillingBucket(string $status): string
    {
        return match ($status) {
            'paid', 'applied' => 'settled',
            'verified_transfer' => 'reconciliating',
            default => 'outstanding',
        };
    }


    public static function resolvePortalBillingDueAt(array $order): string
    {
        $dueAt = self::normalizePortalIsoDateTime((string) ($order['dueAt'] ?? ''));
        if ($dueAt !== '') {
            return $dueAt;
        }

        $createdAt = self::normalizePortalIsoDateTime((string) ($order['createdAt'] ?? ''));
        if ($createdAt === '') {
            return '';
        }

        $modifier = strtolower(trim((string) ($order['paymentMethod'] ?? ''))) === 'card'
            ? '+60 minutes'
            : '+72 hours';

        try {
            return (new \DateTimeImmutable($createdAt))->modify($modifier)->format('c');
        } catch (\Throwable $error) {
            return '';
        }
    }


    public static function resolvePortalBillingActivityAt(array $order): string
    {
        return self::firstNonEmptyString(
            self::normalizePortalIsoDateTime((string) ($order['transferAppliedAt'] ?? '')),
            self::normalizePortalIsoDateTime((string) ($order['paymentPaidAt'] ?? '')),
            self::normalizePortalIsoDateTime((string) ($order['transferVerifiedAt'] ?? '')),
            self::normalizePortalIsoDateTime((string) ($order['updatedAt'] ?? '')),
            self::normalizePortalIsoDateTime((string) ($order['createdAt'] ?? ''))
        );
    }


    public static function resolvePortalBillingDueState(string $bucket, string $dueAt): string
    {
        if ($bucket !== 'outstanding' || $dueAt === '') {
            return 'none';
        }

        $dueTs = strtotime($dueAt);
        if ($dueTs === false) {
            return 'scheduled';
        }

        return $dueTs <= time() ? 'overdue' : 'scheduled';
    }


    public static function findLatestPortalBillingOrder(array $orders, string $bucket): ?array
    {
        $match = null;
        $matchTs = 0;

        foreach ($orders as $order) {
            if ((string) ($order['statusBucket'] ?? '') !== $bucket) {
                continue;
            }

            $activityTs = strtotime((string) ($order['activityAt'] ?? '')) ?: 0;
            if ($activityTs >= $matchTs) {
                $match = $order;
                $matchTs = $activityTs;
            }
        }

        if (!is_array($match)) {
            return null;
        }

        return [
            'concept' => (string) ($match['concept'] ?? ''),
            'amountLabel' => (string) ($match['amountLabel'] ?? ''),
            'paidAt' => (string) ($match['activityAt'] ?? ''),
            'paidAtLabel' => (string) ($match['activityAtLabel'] ?? ''),
            'paymentMethodLabel' => (string) ($match['paymentMethodLabel'] ?? ''),
        ];
    }


    public static function findNextPortalBillingOrder(array $orders): ?array
    {
        $match = null;
        $matchTs = 0;

        foreach ($orders as $order) {
            if ((string) ($order['statusBucket'] ?? '') !== 'outstanding') {
                continue;
            }

            $dueAt = (string) ($order['dueAt'] ?? '');
            $dueTs = strtotime($dueAt) ?: 0;
            if ($match === null) {
                $match = $order;
                $matchTs = $dueTs;
                continue;
            }

            if ($dueTs > 0 && ($matchTs === 0 || $dueTs < $matchTs)) {
                $match = $order;
                $matchTs = $dueTs;
            }
        }

        if (!is_array($match)) {
            return null;
        }

        return [
            'concept' => (string) ($match['concept'] ?? ''),
            'amountLabel' => (string) ($match['amountLabel'] ?? ''),
            'dueAt' => (string) ($match['dueAt'] ?? ''),
            'dueAtLabel' => (string) ($match['dueAtLabel'] ?? ''),
            'statusLabel' => (string) ($match['paymentStatusLabel'] ?? ''),
            'dueState' => (string) ($match['dueState'] ?? 'scheduled'),
        ];
    }


    public static function resolveBillingStatus(
        int $outstandingBalanceCents,
        int $reviewBalanceCents,
        int $outstandingCount,
        int $overdueCount,
        ?array $lastPayment,
        ?array $nextObligation
    ): array {
        if ($overdueCount > 0) {
            return [
                'attention',
                'Pago vencido',
                $nextObligation !== null
                    ? 'Tienes un cobro vencido. Regularízalo desde el checkout seguro para evitar retrasos en tu atención.'
                    : 'Tienes un cobro vencido pendiente de regularización.',
            ];
        }

        if ($outstandingBalanceCents > 0) {
            return [
                'warning',
                'Saldo pendiente',
                $nextObligation !== null
                    ? 'Tu próxima obligación ya está visible en el portal. Puedes pagarla sin exponer datos bancarios.'
                    : 'Tienes un saldo pendiente disponible para pago seguro.',
            ];
        }

        if ($reviewBalanceCents > 0) {
            return [
                'warning',
                'Pago en revisión',
                'Ya recibimos tu comprobante y el equipo lo está validando antes de aplicarlo a tu saldo.',
            ];
        }

        return [
            'good',
            'Al día',
            $lastPayment !== null
                ? 'Tu último pago quedó aplicado y no tienes obligaciones pendientes por ahora.'
                : 'No tienes obligaciones pendientes asociadas a este portal.',
        ];
    }


    public static function portalPaymentCurrency(): string
    {
        if (function_exists('payment_currency')) {
            $currency = strtoupper(trim((string) payment_currency()));
            if ($currency !== '') {
                return $currency;
            }
        }

        return 'USD';
    }


    public static function formatPortalCurrency(int $amountCents, string $currency): string
    {
        $safeCurrency = strtoupper(trim($currency));
        if ($safeCurrency === '') {
            $safeCurrency = 'USD';
        }

        $prefix = $safeCurrency === 'USD' ? '$' : $safeCurrency . ' ';
        return $prefix . number_format($amountCents / 100, 2, '.', ',');
    }


    public static function portalPaymentMethodLabel(string $method): string
    {
        return match ($method) {
            'card' => 'Tarjeta',
            'transfer' => 'Transferencia',
            'cash' => 'Efectivo en consultorio',
            default => 'Pendiente',
        };
    }


    public static function portalPaymentStatusLabel(string $status, array $order): string
    {
        if (
            $status === 'pending_transfer' &&
            trim((string) ($order['transferProofUploadedAt'] ?? '')) !== ''
        ) {
            return 'Pendiente de verificación';
        }

        return match ($status) {
            'paid' => 'Pagado',
            'pending_gateway' => 'Esperando confirmación',
            'pending_transfer' => 'Pendiente de transferencia',
            'pending_cash' => 'Pendiente de pago en consultorio',
            'verified_transfer' => 'En revisión',
            'applied' => 'Aplicado',
            'failed' => 'Fallido',
            default => 'Pendiente',
        };
    }


    public static function normalizePortalIsoDateTime(string $value): string
    {
        $value = trim($value);
        if ($value === '') {
            return '';
        }

        try {
            return (new \DateTimeImmutable($value))->format('c');
        } catch (\Throwable $error) {
            return '';
        }
    }


    public static function buildPortalDateTimeLabel(string $value, string $fallback): string
    {
        $normalized = self::normalizePortalIsoDateTime($value);
        if ($normalized === '') {
            return $fallback;
        }

        try {
            $dateTime = new \DateTimeImmutable($normalized);
            return self::buildDateLabel($dateTime->format('Y-m-d')) . ' · ' . self::buildTimeLabel($dateTime->format('H:i'));
        } catch (\Throwable $error) {
            return $fallback;
        }
    }

}
