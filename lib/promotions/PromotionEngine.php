<?php

declare(strict_types=1);

require_once __DIR__ . '/../memberships/MembershipService.php';
require_once __DIR__ . '/../tenants.php';

final class PromotionEngine
{
    private const DEFAULT_PROMOTIONS = [
        'first_consult' => [
            'id' => 'first_consult',
            'title' => 'Primera consulta',
            'description' => 'Beneficio de bienvenida para pacientes sin historial previo en Aurora Derm.',
            'discountPercent' => 20,
            'eligibility' => ['primera_vez'],
            'exclusions' => ['miembro'],
            'startsAt' => '',
            'endsAt' => '',
            'active' => true,
        ],
        'member_loyalty' => [
            'id' => 'member_loyalty',
            'title' => 'Beneficio miembro',
            'description' => 'Precio preferencial para pacientes con membresía activa.',
            'discountPercent' => 10,
            'eligibility' => ['miembro'],
            'exclusions' => [],
            'startsAt' => '',
            'endsAt' => '',
            'active' => true,
        ],
        'referral_welcome' => [
            'id' => 'referral_welcome',
            'title' => 'Referido Aurora',
            'description' => 'Beneficio temporal para pacientes que llegan con código de referido.',
            'discountPercent' => 10,
            'eligibility' => ['referido'],
            'exclusions' => ['miembro'],
            'startsAt' => '',
            'endsAt' => '',
            'active' => true,
        ],
    ];

    public static function getConfig(array $store): array
    {
        $stored = self::normalizeStoredConfig($store['promotion_config'] ?? []);
        $promotions = [];

        foreach (self::DEFAULT_PROMOTIONS as $id => $rule) {
            $overrides = is_array($stored['promotions'][$id] ?? null)
                ? $stored['promotions'][$id]
                : [];
            $promotions[] = self::normalizeRule(array_merge($rule, $overrides, ['id' => $id]));
        }

        return [
            'updatedAt' => (string) ($stored['updatedAt'] ?? ''),
            'promotions' => $promotions,
        ];
    }

    public static function updateConfig(array $store, array $payload): array
    {
        $current = self::getConfig($store);
        $currentById = [];
        foreach ($current['promotions'] as $rule) {
            $currentById[(string) ($rule['id'] ?? '')] = $rule;
        }

        $incomingRules = self::normalizeIncomingRules($payload['promotions'] ?? []);
        $storedPromotions = [];

        foreach ($currentById as $id => $rule) {
            $overrides = $incomingRules[$id] ?? [];
            $storedPromotions[$id] = [
                'active' => array_key_exists('active', $overrides)
                    ? (bool) $overrides['active']
                    : (bool) ($rule['active'] ?? false),
                'startsAt' => array_key_exists('startsAt', $overrides)
                    ? self::normalizeDateField($overrides['startsAt'])
                    : self::normalizeDateField($rule['startsAt'] ?? ''),
                'endsAt' => array_key_exists('endsAt', $overrides)
                    ? self::normalizeDateField($overrides['endsAt'])
                    : self::normalizeDateField($rule['endsAt'] ?? ''),
            ];
        }

        $store['promotion_config'] = [
            'updatedAt' => local_date('c'),
            'promotions' => $storedPromotions,
        ];

        return [
            'ok' => true,
            'store' => $store,
            'config' => self::getConfig($store),
        ];
    }

    public static function getActivePromotions(array $store, array $criteria): array
    {
        $config = self::getConfig($store);
        $patientContext = self::buildPatientContext($store, $criteria);
        $matches = [];

        foreach ($config['promotions'] as $rule) {
            if (!self::isRuleActiveNow($rule)) {
                continue;
            }
            if (!self::matchesEligibility($rule, $patientContext)) {
                continue;
            }

            $matches[] = [
                'id' => (string) ($rule['id'] ?? ''),
                'title' => (string) ($rule['title'] ?? ''),
                'description' => (string) ($rule['description'] ?? ''),
                'discountPercent' => (int) ($rule['discountPercent'] ?? 0),
                'discountLabel' => (int) ($rule['discountPercent'] ?? 0) . '% OFF',
                'eligibility' => array_values($rule['eligibility'] ?? []),
                'exclusions' => array_values($rule['exclusions'] ?? []),
                'startsAt' => (string) ($rule['startsAt'] ?? ''),
                'endsAt' => (string) ($rule['endsAt'] ?? ''),
            ];
        }

        return [
            'promotions' => $matches,
            'patient' => [
                'patientId' => (string) ($patientContext['patientId'] ?? ''),
                'isFirstVisit' => (bool) ($patientContext['isFirstVisit'] ?? false),
                'isMember' => (bool) ($patientContext['isMember'] ?? false),
                'isReferred' => (bool) ($patientContext['isReferred'] ?? false),
            ],
        ];
    }

    private static function normalizeStoredConfig($raw): array
    {
        $source = is_array($raw) ? $raw : [];
        $promotions = is_array($source['promotions'] ?? null) ? $source['promotions'] : [];

        return [
            'updatedAt' => (string) ($source['updatedAt'] ?? ''),
            'promotions' => $promotions,
        ];
    }

    private static function normalizeIncomingRules($raw): array
    {
        $list = is_array($raw) ? $raw : [];
        $normalized = [];

        foreach ($list as $item) {
            if (!is_array($item)) {
                continue;
            }

            $id = trim((string) ($item['id'] ?? ''));
            if ($id === '' || !isset(self::DEFAULT_PROMOTIONS[$id])) {
                continue;
            }

            $normalized[$id] = [
                'active' => (bool) ($item['active'] ?? false),
                'startsAt' => self::normalizeDateField($item['startsAt'] ?? ''),
                'endsAt' => self::normalizeDateField($item['endsAt'] ?? ''),
            ];
        }

        return $normalized;
    }

    private static function normalizeRule(array $rule): array
    {
        $startsAt = self::normalizeDateField($rule['startsAt'] ?? '');
        $endsAt = self::normalizeDateField($rule['endsAt'] ?? '');

        return [
            'id' => trim((string) ($rule['id'] ?? '')),
            'title' => trim((string) ($rule['title'] ?? '')),
            'description' => trim((string) ($rule['description'] ?? '')),
            'discountPercent' => max(0, (int) ($rule['discountPercent'] ?? 0)),
            'eligibility' => self::normalizeTagList($rule['eligibility'] ?? []),
            'exclusions' => self::normalizeTagList($rule['exclusions'] ?? []),
            'startsAt' => $startsAt,
            'endsAt' => $endsAt,
            'active' => (bool) ($rule['active'] ?? false),
        ];
    }

    private static function normalizeTagList($raw): array
    {
        $list = is_array($raw) ? $raw : [];
        $normalized = [];

        foreach ($list as $value) {
            $tag = strtolower(trim((string) $value));
            if ($tag === '') {
                continue;
            }
            $normalized[] = $tag;
        }

        return array_values(array_unique($normalized));
    }

    private static function normalizeDateField($value): string
    {
        $raw = trim((string) $value);
        if ($raw === '') {
            return '';
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw)) {
            return $raw;
        }

        $timestamp = strtotime($raw);
        if ($timestamp === false) {
            return '';
        }

        return date('Y-m-d', $timestamp);
    }

    private static function isRuleActiveNow(array $rule): bool
    {
        if (($rule['active'] ?? false) !== true) {
            return false;
        }

        $today = date('Y-m-d');
        $startsAt = (string) ($rule['startsAt'] ?? '');
        $endsAt = (string) ($rule['endsAt'] ?? '');

        if ($startsAt !== '' && $today < $startsAt) {
            return false;
        }

        if ($endsAt !== '' && $today > $endsAt) {
            return false;
        }

        return true;
    }

    private static function matchesEligibility(array $rule, array $patientContext): bool
    {
        $eligibility = self::normalizeTagList($rule['eligibility'] ?? []);
        $exclusions = self::normalizeTagList($rule['exclusions'] ?? []);

        foreach ($exclusions as $tag) {
            if (self::contextMatchesTag($patientContext, $tag)) {
                return false;
            }
        }

        if ($eligibility === []) {
            return true;
        }

        foreach ($eligibility as $tag) {
            if (self::contextMatchesTag($patientContext, $tag)) {
                return true;
            }
        }

        return false;
    }

    private static function contextMatchesTag(array $patientContext, string $tag): bool
    {
        if ($tag === 'primera_vez') {
            return (bool) ($patientContext['isFirstVisit'] ?? false);
        }

        if ($tag === 'miembro') {
            return (bool) ($patientContext['isMember'] ?? false);
        }

        if ($tag === 'referido') {
            return (bool) ($patientContext['isReferred'] ?? false);
        }

        return false;
    }

    private static function buildPatientContext(array $store, array $criteria): array
    {
        $normalized = self::normalizeCriteria($criteria);
        $candidatePatientIds = self::resolveCandidatePatientIds($store, $normalized);

        $isMember = false;
        foreach ($candidatePatientIds as $patientId) {
            if (MembershipService::getActiveMembership($store, $patientId) !== null) {
                $isMember = true;
                break;
            }
        }

        $hasHistory = self::hasHistoricalVisit($store, $normalized, $candidatePatientIds);

        return [
            'patientId' => $candidatePatientIds[0] ?? '',
            'isFirstVisit' => !$hasHistory,
            'isMember' => $isMember,
            'isReferred' => $normalized['referralCode'] !== '',
        ];
    }

    private static function normalizeCriteria(array $criteria): array
    {
        $phoneDigits = preg_replace('/\D+/', '', (string) ($criteria['phone'] ?? ''));

        return [
            'patientId' => trim((string) ($criteria['patientId'] ?? $criteria['patient_id'] ?? '')),
            'name' => trim((string) ($criteria['name'] ?? '')),
            'email' => strtolower(trim((string) ($criteria['email'] ?? ''))),
            'phoneDigits' => is_string($phoneDigits) ? $phoneDigits : '',
            'referralCode' => strtoupper(trim((string) ($criteria['referralCode'] ?? $criteria['referral_code'] ?? $criteria['ref'] ?? ''))),
        ];
    }

    private static function resolveCandidatePatientIds(array $store, array $criteria): array
    {
        $ids = [];

        $direct = trim((string) ($criteria['patientId'] ?? ''));
        if ($direct !== '') {
            $ids[] = $direct;
        }

        foreach ((array) ($store['appointments'] ?? []) as $appointment) {
            if (!is_array($appointment)) {
                continue;
            }
            if (!self::recordMatchesIdentity($appointment, $criteria, ['email', 'phone'])) {
                continue;
            }

            $patientId = trim((string) ($appointment['patientId'] ?? ''));
            if ($patientId !== '') {
                $ids[] = $patientId;
            }
        }

        foreach ((array) ($store['patient_cases'] ?? []) as $case) {
            if (!is_array($case)) {
                continue;
            }
            if (!self::caseMatchesIdentity($case, $criteria)) {
                continue;
            }

            $patientId = trim((string) ($case['patientId'] ?? ''));
            if ($patientId !== '') {
                $ids[] = $patientId;
            }
        }

        $derived = self::derivePatientIdFromIdentity($criteria);
        if ($derived !== '') {
            $ids[] = $derived;
        }

        return array_values(array_unique(array_filter($ids)));
    }

    private static function recordMatchesIdentity(array $record, array $criteria, array $strategies): bool
    {
        foreach ($strategies as $strategy) {
            if ($strategy === 'email') {
                $email = strtolower(trim((string) ($record['email'] ?? '')));
                if ($criteria['email'] !== '' && $email !== '' && $criteria['email'] === $email) {
                    return true;
                }
            }

            if ($strategy === 'phone') {
                $digits = preg_replace('/\D+/', '', (string) ($record['phone'] ?? ''));
                if (
                    $criteria['phoneDigits'] !== ''
                    && is_string($digits)
                    && $digits !== ''
                    && $criteria['phoneDigits'] === $digits
                ) {
                    return true;
                }
            }
        }

        return false;
    }

    private static function caseMatchesIdentity(array $case, array $criteria): bool
    {
        $summary = is_array($case['summary'] ?? null) ? $case['summary'] : [];
        $email = strtolower(trim((string) ($summary['contactEmail'] ?? $case['contactEmail'] ?? '')));
        if ($criteria['email'] !== '' && $email !== '' && $criteria['email'] === $email) {
            return true;
        }

        $digits = preg_replace('/\D+/', '', (string) ($summary['contactPhone'] ?? $case['contactPhone'] ?? ''));
        return $criteria['phoneDigits'] !== ''
            && is_string($digits)
            && $digits !== ''
            && $criteria['phoneDigits'] === $digits;
    }

    private static function derivePatientIdFromIdentity(array $criteria): string
    {
        $identityKeys = [];

        if ($criteria['phoneDigits'] !== '' && strlen($criteria['phoneDigits']) >= 7) {
            $identityKeys[] = 'phone:' . $criteria['phoneDigits'];
        }

        if ($criteria['email'] !== '') {
            $identityKeys[] = 'email:' . $criteria['email'];
        }

        $name = strtolower(trim((string) ($criteria['name'] ?? '')));
        if ($name !== '' && $criteria['phoneDigits'] !== '' && strlen($criteria['phoneDigits']) >= 4) {
            $identityKeys[] = 'name_phone:' . $name . ':' . substr($criteria['phoneDigits'], -4);
        }

        $identityKeys = array_values(array_unique($identityKeys));
        if ($identityKeys === []) {
            return '';
        }

        sort($identityKeys, SORT_STRING);
        $seed = implode('|', array_merge([get_current_tenant_id(), 'appointment-patient'], $identityKeys));

        return 'pt_' . substr(hash('sha1', $seed), 0, 16);
    }

    private static function hasHistoricalVisit(array $store, array $criteria, array $candidatePatientIds): bool
    {
        $candidateIndex = array_fill_keys($candidatePatientIds, true);

        foreach ((array) ($store['appointments'] ?? []) as $appointment) {
            if (!is_array($appointment)) {
                continue;
            }

            $status = strtolower(trim((string) ($appointment['status'] ?? 'confirmed')));
            if ($status === 'cancelled') {
                continue;
            }

            $patientId = trim((string) ($appointment['patientId'] ?? ''));
            if ($patientId !== '' && isset($candidateIndex[$patientId])) {
                return true;
            }

            if (self::recordMatchesIdentity($appointment, $criteria, ['email', 'phone'])) {
                return true;
            }
        }

        foreach ((array) ($store['patient_cases'] ?? []) as $case) {
            if (!is_array($case)) {
                continue;
            }

            $patientId = trim((string) ($case['patientId'] ?? ''));
            if ($patientId !== '' && isset($candidateIndex[$patientId])) {
                return true;
            }

            if (self::caseMatchesIdentity($case, $criteria)) {
                return true;
            }
        }

        return false;
    }
}
