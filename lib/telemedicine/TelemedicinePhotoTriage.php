<?php

declare(strict_types=1);

final class TelemedicinePhotoTriage
{
    private const ROLE_MAP = [
        'zona' => 'zona',
        'zone' => 'zona',
        'area' => 'zona',
        'body_zone' => 'zona',
        'body-zone' => 'zona',
        'primer_plano' => 'primer_plano',
        'primer-plano' => 'primer_plano',
        'primer plano' => 'primer_plano',
        'close_up' => 'primer_plano',
        'close-up' => 'primer_plano',
        'close up' => 'primer_plano',
        'detalle' => 'primer_plano',
        'contexto' => 'contexto',
        'context' => 'contexto',
        'overview' => 'contexto',
    ];

    private const ROLE_LABELS = [
        'zona' => 'Zona',
        'primer_plano' => 'Primer plano',
        'contexto' => 'Contexto',
    ];

    private const ORDERED_ROLES = [
        'zona',
        'primer_plano',
        'contexto',
    ];

    /**
     * @return array<int,string>
     */
    public static function orderedRoles(): array
    {
        return self::ORDERED_ROLES;
    }

    public static function labelForRole(string $role): string
    {
        $normalized = self::normalizeRole($role);
        return self::ROLE_LABELS[$normalized] ?? '';
    }

    public static function normalizeRole(string $role): string
    {
        $raw = strtolower(trim($role));
        if ($raw === '') {
            return '';
        }

        return self::ROLE_MAP[$raw] ?? '';
    }

    /**
     * @param mixed $roles
     * @return array<int,string>
     */
    public static function normalizeRoles($roles, int $limit = 3): array
    {
        if (!is_array($roles)) {
            return [];
        }

        $normalized = [];
        foreach (array_values($roles) as $index => $role) {
            if ($index >= $limit) {
                break;
            }
            $resolved = self::normalizeRole((string) $role);
            if ($resolved === '') {
                $resolved = self::ORDERED_ROLES[$index] ?? '';
            }
            if ($resolved !== '') {
                $normalized[] = $resolved;
            }
        }

        return $normalized;
    }

    /**
     * @return array<int,string>
     */
    public static function resolveRoles(array $appointment, ?int $count = null): array
    {
        $photoCount = self::resolvePhotoCount($appointment, $count);
        if ($photoCount <= 0) {
            return [];
        }

        $normalized = self::normalizeRoles($appointment['casePhotoRoles'] ?? [], $photoCount);
        for ($index = count($normalized); $index < $photoCount; $index += 1) {
            $fallback = self::ORDERED_ROLES[$index] ?? '';
            if ($fallback !== '') {
                $normalized[] = $fallback;
            }
        }

        return array_slice($normalized, 0, $photoCount);
    }

    /**
     * @param array<int,int> $clinicalMediaIds
     */
    public static function buildSummary(array $appointment, array $clinicalMediaIds = []): array
    {
        $photoCount = self::resolvePhotoCount($appointment);
        $roles = self::resolveRoles($appointment, $photoCount);
        $expectedRoles = array_slice(self::ORDERED_ROLES, 0, max($photoCount, count(self::ORDERED_ROLES)));
        if ($photoCount === 0) {
            $expectedRoles = self::ORDERED_ROLES;
        }

        $photos = [];
        $names = is_array($appointment['casePhotoNames'] ?? null) ? array_values($appointment['casePhotoNames']) : [];
        $paths = is_array($appointment['casePhotoPaths'] ?? null) ? array_values($appointment['casePhotoPaths']) : [];
        $urls = is_array($appointment['casePhotoUrls'] ?? null) ? array_values($appointment['casePhotoUrls']) : [];
        $maxItems = max($photoCount, count($names), count($paths), count($urls), count($clinicalMediaIds));

        for ($index = 0; $index < $maxItems; $index += 1) {
            $role = $roles[$index] ?? (self::ORDERED_ROLES[$index] ?? '');
            $photos[] = [
                'index' => $index + 1,
                'role' => $role,
                'roleLabel' => self::labelForRole($role),
                'name' => (string) ($names[$index] ?? ''),
                'path' => (string) ($paths[$index] ?? ''),
                'url' => (string) ($urls[$index] ?? ''),
                'clinicalMediaId' => (int) ($clinicalMediaIds[$index] ?? 0),
            ];
        }

        $missingRoles = [];
        foreach (self::ORDERED_ROLES as $role) {
            if (!in_array($role, $roles, true)) {
                $missingRoles[] = $role;
            }
        }

        $status = 'missing';
        if ($photoCount > 0) {
            $status = count($missingRoles) === 0 ? 'complete' : 'partial';
        }

        return [
            'count' => $photoCount,
            'status' => $status,
            'roles' => $roles,
            'rolesExpected' => self::ORDERED_ROLES,
            'missingRoles' => $missingRoles,
            'photos' => $photos,
        ];
    }

    private static function resolvePhotoCount(array $appointment, ?int $count = null): int
    {
        $resolved = $count ?? 0;
        if ($resolved <= 0) {
            $resolved = max(
                (int) ($appointment['casePhotoCount'] ?? 0),
                is_array($appointment['casePhotoNames'] ?? null) ? count($appointment['casePhotoNames']) : 0,
                is_array($appointment['casePhotoUrls'] ?? null) ? count($appointment['casePhotoUrls']) : 0,
                is_array($appointment['casePhotoPaths'] ?? null) ? count($appointment['casePhotoPaths']) : 0,
                is_array($appointment['casePhotoRoles'] ?? null) ? count($appointment['casePhotoRoles']) : 0
            );
        }

        if ($resolved < 0) {
            $resolved = 0;
        }
        if ($resolved > 3) {
            $resolved = 3;
        }

        return $resolved;
    }
}
