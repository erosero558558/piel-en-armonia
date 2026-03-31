<?php

declare(strict_types=1);

require_once __DIR__ . '/TurneroClinicProfile.php';
require_once __DIR__ . '/tenants.php';

final class MultiClinicDashboardService
{
    public static function buildAdminOverview(array $store): array
    {
        $tenantId = get_current_tenant_id();
        $activeProfile = read_turnero_clinic_profile();
        $activeClinicId = self::normalizeText($activeProfile['clinic_id'] ?? 'default-clinic', 'default-clinic');
        $todayKey = function_exists('local_date') ? local_date('Y-m-d') : date('Y-m-d');
        $currency = self::resolveCurrency($store);
        $clinics = self::seedClinicIndex($activeProfile);
        $tenantPatients = [];
        $fallbackAssignedRecords = 0;
        $explicitlyScopedRecords = 0;

        foreach (self::pickList($store['appointments'] ?? null) as $appointment) {
            if (!is_array($appointment)) {
                continue;
            }

            $assignment = self::resolveClinicAssignment(
                $appointment,
                $tenantId,
                $activeClinicId
            );
            $clinicId = $assignment['clinicId'];
            if ($clinicId === '') {
                continue;
            }

            self::ensureClinic($clinics, $clinicId);
            self::registerAssignmentCounters(
                $clinics[$clinicId],
                $assignment,
                $fallbackAssignedRecords,
                $explicitlyScopedRecords
            );

            if (self::countsForClinicDemand($appointment)) {
                $clinics[$clinicId]['appointmentsTotal'] += 1;
                if (self::extractDateKey($appointment['date'] ?? '') === $todayKey) {
                    $clinics[$clinicId]['todayAppointments'] += 1;
                }
            }

            $patientKey = self::buildPatientKey($appointment);
            if ($patientKey !== '') {
                $clinics[$clinicId]['patientKeys'][$patientKey] = true;
                $tenantPatients[$patientKey] = true;
            }
        }

        foreach (self::pickList($store['checkout_orders'] ?? null) as $order) {
            if (!is_array($order)) {
                continue;
            }

            $assignment = self::resolveClinicAssignment(
                $order,
                $tenantId,
                $activeClinicId
            );
            $clinicId = $assignment['clinicId'];
            if ($clinicId === '') {
                continue;
            }

            self::ensureClinic($clinics, $clinicId);
            self::registerAssignmentCounters(
                $clinics[$clinicId],
                $assignment,
                $fallbackAssignedRecords,
                $explicitlyScopedRecords
            );

            $amountCents = max(0, (int) ($order['amountCents'] ?? 0));
            $status = strtolower(trim((string) ($order['paymentStatus'] ?? 'pending')));
            if ($amountCents > 0) {
                if (in_array($status, ['paid', 'applied'], true)) {
                    $clinics[$clinicId]['settledRevenueCents'] += $amountCents;
                } elseif ($status === 'verified_transfer') {
                    $clinics[$clinicId]['reconciliatingRevenueCents'] += $amountCents;
                } else {
                    $clinics[$clinicId]['outstandingRevenueCents'] += $amountCents;
                }
            }

            $patientKey = self::buildPatientKey([
                'patientId' => $order['patientId'] ?? '',
                'email' => $order['payerEmail'] ?? '',
                'phone' => $order['payerWhatsapp'] ?? '',
                'name' => $order['payerName'] ?? '',
            ]);
            if ($patientKey !== '') {
                $clinics[$clinicId]['patientKeys'][$patientKey] = true;
                $tenantPatients[$patientKey] = true;
            }
        }

        $clinicRows = [];
        foreach ($clinics as $clinic) {
            $patientCount = count($clinic['patientKeys']);
            $clinic['patientCount'] = $patientCount;
            $clinic['settledRevenueLabel'] = self::formatCurrency(
                (int) $clinic['settledRevenueCents'],
                $currency
            );
            $clinic['reconciliatingRevenueLabel'] = self::formatCurrency(
                (int) $clinic['reconciliatingRevenueCents'],
                $currency
            );
            $clinic['outstandingRevenueLabel'] = self::formatCurrency(
                (int) $clinic['outstandingRevenueCents'],
                $currency
            );
            $clinic['hasActivity'] =
                (int) $clinic['todayAppointments'] > 0
                || (int) $clinic['settledRevenueCents'] > 0
                || $patientCount > 0;
            $clinic['sortScore'] = self::buildSortScore($clinic);
            $clinicRows[] = $clinic;
        }

        usort($clinicRows, static function (array $left, array $right): int {
            $sortDelta = (int) ($right['sortScore'] ?? 0) <=> (int) ($left['sortScore'] ?? 0);
            if ($sortDelta !== 0) {
                return $sortDelta;
            }

            return strcmp(
                (string) ($left['clinicLabel'] ?? $left['clinicId'] ?? ''),
                (string) ($right['clinicLabel'] ?? $right['clinicId'] ?? '')
            );
        });

        $revenueLeader = self::pickLeader(
            $clinicRows,
            static fn (array $item): int => (int) ($item['settledRevenueCents'] ?? 0),
            static fn (array $item): int => (int) ($item['todayAppointments'] ?? 0)
        );
        $demandLeader = self::pickLeader(
            $clinicRows,
            static fn (array $item): int => (int) ($item['todayAppointments'] ?? 0),
            static fn (array $item): int => (int) ($item['patientCount'] ?? 0)
        );

        foreach ($clinicRows as $index => $clinic) {
            $isRevenueLeader = $revenueLeader !== null
                && (string) ($revenueLeader['clinicId'] ?? '') === (string) ($clinic['clinicId'] ?? '');
            $isDemandLeader = $demandLeader !== null
                && (string) ($demandLeader['clinicId'] ?? '') === (string) ($clinic['clinicId'] ?? '');
            $status = $clinic['hasActivity'] ? 'active' : 'idle';
            if ($isRevenueLeader || $isDemandLeader) {
                $status = 'leader';
            } elseif ($clinic['isActiveClinic'] && !$clinic['hasActivity']) {
                $status = 'watch';
            }

            $clinicRows[$index]['status'] = $status;
            $clinicRows[$index]['isRevenueLeader'] = $isRevenueLeader;
            $clinicRows[$index]['isDemandLeader'] = $isDemandLeader;
            unset($clinicRows[$index]['patientKeys'], $clinicRows[$index]['sortScore']);
        }

        $clinicsWithActivity = count(array_filter(
            $clinicRows,
            static fn (array $item): bool => ($item['hasActivity'] ?? false) === true
        ));
        $totalTodayAppointments = array_sum(array_map(
            static fn (array $item): int => (int) ($item['todayAppointments'] ?? 0),
            $clinicRows
        ));
        $totalSettledRevenueCents = array_sum(array_map(
            static fn (array $item): int => (int) ($item['settledRevenueCents'] ?? 0),
            $clinicRows
        ));

        return [
            'summary' => [
                'tenantId' => $tenantId,
                'activeClinicId' => $activeClinicId,
                'clinicCount' => count($clinicRows),
                'clinicsWithActivity' => $clinicsWithActivity,
                'todayAppointments' => $totalTodayAppointments,
                'patientCount' => count($tenantPatients),
                'settledRevenueCents' => $totalSettledRevenueCents,
                'settledRevenueLabel' => self::formatCurrency(
                    $totalSettledRevenueCents,
                    $currency
                ),
                'explicitlyScopedRecords' => $explicitlyScopedRecords,
                'fallbackAssignedRecords' => $fallbackAssignedRecords,
                'generatedAt' => function_exists('local_date') ? local_date('c') : date('c'),
            ],
            'comparative' => [
                'leaderByRevenue' => self::buildLeaderPayload($revenueLeader),
                'leaderByDemand' => self::buildLeaderPayload($demandLeader),
            ],
            'clinics' => $clinicRows,
        ];
    }

    private static function seedClinicIndex(array $activeProfile): array
    {
        $seed = [];

        foreach (read_turnero_regional_clinics_payload() as $clinic) {
            if (!is_array($clinic)) {
                continue;
            }
            $clinicId = self::normalizeText(
                $clinic['clinicId'] ?? ($clinic['clinic_id'] ?? ''),
                ''
            );
            if ($clinicId === '') {
                continue;
            }
            $seed[$clinicId] = self::buildClinicSeed(
                $clinicId,
                $clinic['clinicLabel'] ?? ($clinic['label'] ?? $clinicId),
                $clinic['clinicShortName'] ?? ($clinic['clinicLabel'] ?? $clinicId),
                $clinic['region'] ?? ($clinic['city'] ?? ''),
                $clinic['city'] ?? '',
                $clinicId === self::normalizeText($activeProfile['clinic_id'] ?? '', 'default-clinic')
            );
        }

        foreach (read_turnero_clinic_profiles_catalog_payload() as $profile) {
            if (!is_array($profile)) {
                continue;
            }
            $clinicId = self::normalizeText($profile['clinic_id'] ?? '', '');
            if ($clinicId === '') {
                continue;
            }
            $branding = is_array($profile['branding'] ?? null) ? $profile['branding'] : [];
            $existing = $seed[$clinicId] ?? self::buildClinicSeed(
                $clinicId,
                $branding['name'] ?? $clinicId,
                $branding['short_name'] ?? ($branding['name'] ?? $clinicId),
                $profile['region'] ?? ($branding['city'] ?? ''),
                $branding['city'] ?? '',
                $clinicId === self::normalizeText($activeProfile['clinic_id'] ?? '', 'default-clinic')
            );
            $existing['clinicLabel'] = self::normalizeText(
                $existing['clinicLabel'] ?: ($branding['name'] ?? $clinicId),
                $clinicId
            );
            $existing['clinicShortName'] = self::normalizeText(
                $existing['clinicShortName'] ?: ($branding['short_name'] ?? $existing['clinicLabel']),
                $existing['clinicLabel']
            );
            $existing['region'] = self::normalizeText(
                $existing['region'] ?: ($profile['region'] ?? ($branding['city'] ?? '')),
                'Tenant'
            );
            $existing['city'] = self::normalizeText(
                $existing['city'] ?: ($branding['city'] ?? ''),
                ''
            );
            $existing['releaseMode'] = self::normalizeText(
                $profile['release']['mode'] ?? '',
                ''
            );
            $existing['catalogId'] = self::normalizeText(
                $profile['catalog_id'] ?? '',
                ''
            );
            $seed[$clinicId] = $existing;
        }

        $activeClinicId = self::normalizeText($activeProfile['clinic_id'] ?? '', 'default-clinic');
        if (!isset($seed[$activeClinicId])) {
            $branding = is_array($activeProfile['branding'] ?? null) ? $activeProfile['branding'] : [];
            $seed[$activeClinicId] = self::buildClinicSeed(
                $activeClinicId,
                $branding['name'] ?? $activeClinicId,
                $branding['short_name'] ?? ($branding['name'] ?? $activeClinicId),
                $activeProfile['region'] ?? ($branding['city'] ?? ''),
                $branding['city'] ?? '',
                true
            );
        } else {
            $seed[$activeClinicId]['isActiveClinic'] = true;
        }

        return $seed;
    }

    private static function buildClinicSeed(
        string $clinicId,
        $label,
        $shortName,
        $region,
        $city,
        bool $isActiveClinic
    ): array {
        $clinicLabel = self::normalizeText($label, $clinicId);

        return [
            'clinicId' => $clinicId,
            'clinicLabel' => $clinicLabel,
            'clinicShortName' => self::normalizeText($shortName, $clinicLabel),
            'region' => self::normalizeText($region, 'Tenant'),
            'city' => self::normalizeText($city, ''),
            'isActiveClinic' => $isActiveClinic,
            'releaseMode' => '',
            'catalogId' => '',
            'todayAppointments' => 0,
            'appointmentsTotal' => 0,
            'patientCount' => 0,
            'settledRevenueCents' => 0,
            'reconciliatingRevenueCents' => 0,
            'outstandingRevenueCents' => 0,
            'explicitlyScopedRecords' => 0,
            'fallbackAssignedRecords' => 0,
            'hasActivity' => false,
            'patientKeys' => [],
        ];
    }

    private static function ensureClinic(array &$clinics, string $clinicId): void
    {
        if (isset($clinics[$clinicId])) {
            return;
        }

        $clinics[$clinicId] = self::buildClinicSeed(
            $clinicId,
            $clinicId,
            $clinicId,
            'Tenant',
            '',
            false
        );
    }

    private static function resolveClinicAssignment(
        array $record,
        string $tenantId,
        string $activeClinicId
    ): array {
        $explicitClinicId = self::normalizeText(
            $record['clinicId'] ?? ($record['clinic_id'] ?? ''),
            ''
        );
        if ($explicitClinicId !== '') {
            return [
                'clinicId' => $explicitClinicId,
                'source' => 'explicit',
            ];
        }

        $recordTenantId = self::normalizeText($record['tenantId'] ?? '', '');
        if ($recordTenantId === '' || $recordTenantId === $tenantId) {
            return [
                'clinicId' => $activeClinicId,
                'source' => 'active_fallback',
            ];
        }

        return [
            'clinicId' => $activeClinicId,
            'source' => 'tenant_fallback',
        ];
    }

    private static function registerAssignmentCounters(
        array &$clinic,
        array $assignment,
        int &$fallbackAssignedRecords,
        int &$explicitlyScopedRecords
    ): void {
        if (($assignment['source'] ?? '') === 'explicit') {
            $clinic['explicitlyScopedRecords'] += 1;
            $explicitlyScopedRecords += 1;
            return;
        }

        $clinic['fallbackAssignedRecords'] += 1;
        $fallbackAssignedRecords += 1;
    }

    private static function countsForClinicDemand(array $appointment): bool
    {
        $status = strtolower(trim((string) ($appointment['status'] ?? 'confirmed')));
        return !in_array($status, ['cancelled', 'canceled'], true);
    }

    private static function extractDateKey($value): string
    {
        $candidate = trim((string) $value);
        if ($candidate === '') {
            return '';
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $candidate) === 1) {
            return $candidate;
        }

        try {
            return (new \DateTimeImmutable($candidate))->format('Y-m-d');
        } catch (\Throwable $error) {
            return substr($candidate, 0, 10);
        }
    }

    private static function buildPatientKey(array $record): string
    {
        $email = strtolower(self::normalizeText(
            $record['email'] ?? ($record['payerEmail'] ?? ''),
            ''
        ));
        if ($email !== '') {
            return 'email:' . $email;
        }

        $phone = self::normalizeText(
            $record['phone'] ?? ($record['payerWhatsapp'] ?? ''),
            ''
        );
        if ($phone !== '') {
            return 'wa:' . $phone;
        }

        $patientId = self::normalizeText($record['patientId'] ?? '', '');
        if ($patientId !== '') {
            return 'pid:' . $patientId;
        }

        $name = strtolower(self::normalizeText(
            $record['name'] ?? ($record['payerName'] ?? ''),
            ''
        ));
        if ($name !== '') {
            return 'name:' . $name;
        }

        return '';
    }

    private static function buildSortScore(array $clinic): int
    {
        return ((int) ($clinic['settledRevenueCents'] ?? 0) * 100)
            + ((int) ($clinic['todayAppointments'] ?? 0) * 1000)
            + ((int) ($clinic['patientCount'] ?? 0) * 10)
            + ((int) ($clinic['isActiveClinic'] ?? false) ? 1 : 0);
    }

    private static function pickLeader(
        array $clinics,
        callable $primaryMetric,
        callable $secondaryMetric
    ): ?array {
        $leader = null;
        $leaderPrimary = 0;
        $leaderSecondary = 0;

        foreach ($clinics as $clinic) {
            if (!is_array($clinic)) {
                continue;
            }
            $primary = max(0, (int) $primaryMetric($clinic));
            $secondary = max(0, (int) $secondaryMetric($clinic));
            if ($primary <= 0 && $secondary <= 0 && (int) ($clinic['patientCount'] ?? 0) <= 0) {
                continue;
            }

            if (
                $leader === null
                || $primary > $leaderPrimary
                || ($primary === $leaderPrimary && $secondary > $leaderSecondary)
            ) {
                $leader = $clinic;
                $leaderPrimary = $primary;
                $leaderSecondary = $secondary;
            }
        }

        return $leader;
    }

    private static function buildLeaderPayload(?array $clinic): ?array
    {
        if (!$clinic) {
            return null;
        }

        return [
            'clinicId' => (string) ($clinic['clinicId'] ?? ''),
            'clinicLabel' => (string) ($clinic['clinicLabel'] ?? ''),
            'todayAppointments' => (int) ($clinic['todayAppointments'] ?? 0),
            'patientCount' => (int) ($clinic['patientCount'] ?? 0),
            'settledRevenueCents' => (int) ($clinic['settledRevenueCents'] ?? 0),
            'settledRevenueLabel' => (string) ($clinic['settledRevenueLabel'] ?? ''),
        ];
    }

    private static function pickList($value): array
    {
        return is_array($value) ? $value : [];
    }

    private static function normalizeText($value, string $fallback): string
    {
        $text = trim((string) $value);
        return $text !== '' ? $text : $fallback;
    }

    private static function resolveCurrency(array $store): string
    {
        foreach (self::pickList($store['checkout_orders'] ?? null) as $order) {
            if (!is_array($order)) {
                continue;
            }
            $currency = strtoupper(trim((string) ($order['currency'] ?? '')));
            if ($currency !== '') {
                return $currency;
            }
        }

        if (function_exists('payment_currency')) {
            $currency = strtoupper(trim((string) payment_currency()));
            if ($currency !== '') {
                return $currency;
            }
        }

        return 'USD';
    }

    private static function formatCurrency(int $amountCents, string $currency): string
    {
        $prefix = strtoupper($currency) === 'USD'
            ? '$'
            : strtoupper($currency) . ' ';

        return $prefix . number_format($amountCents / 100, 2, '.', ',');
    }
}
