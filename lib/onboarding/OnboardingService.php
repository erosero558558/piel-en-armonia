<?php

declare(strict_types=1);

/**
 * OnboardingService — S18-02 Guided onboarding progress per clinic.
 *
 * Storage key: $store['onboarding_progress'][$clinicId] — step-by-step progress.
 */
final class OnboardingService
{
    public const STEPS = [
        ['id' => 'basic_config',  'name' => 'Configuración básica',      'description' => 'Nombre de clínica, logo, colores y contacto.'],
        ['id' => 'staff',         'name' => 'Personal médico',            'description' => 'Agregar al menos un médico y configurar su agenda.'],
        ['id' => 'services',      'name' => 'Servicios y precios',        'description' => 'Configurar los servicios ofrecidos con duración y precio.'],
        ['id' => 'surfaces',      'name' => 'Superficies activas',        'description' => 'Activar admin, operador, kiosk y/o display.'],
        ['id' => 'final_test',    'name' => 'Test de funcionamiento',     'description' => 'Emitir un turno de prueba y confirmar fin del setup.'],
    ];

    // ────────────────────────────────────────────────────────────────
    // Public API
    // ────────────────────────────────────────────────────────────────

    /**
     * Returns the current onboarding progress for a clinic.
     */
    public static function getProgress(array $store, string $clinicId): array
    {
        $clinicId = trim($clinicId);
        $saved    = is_array($store['onboarding_progress'][$clinicId] ?? null)
            ? $store['onboarding_progress'][$clinicId]
            : [];

        $steps        = [];
        $doneCount    = 0;
        $firstPending = null;

        foreach (self::STEPS as $def) {
            $stepId  = $def['id'];
            $saved_s = is_array($saved[$stepId] ?? null) ? $saved[$stepId] : [];
            $status  = trim((string) ($saved_s['status'] ?? 'pending'));

            if (!in_array($status, ['done', 'skipped', 'pending', 'available', 'blocked'], true)) {
                $status = 'pending';
            }

            // Auto-unlock: first step is always available if still pending.
            if ($stepId === 'basic_config' && $status === 'pending') {
                $status = 'available';
            }

            // Mark first pending non-blocked step as next action.
            if ($firstPending === null && in_array($status, ['available', 'pending'], true)) {
                $firstPending = $stepId;
                if ($status === 'pending') {
                    $status = 'available';
                }
            }

            if (in_array($status, ['done', 'skipped'], true)) {
                $doneCount++;
            }

            $blocker = trim((string) ($saved_s['blocker'] ?? ''));
            $steps[] = [
                'id'          => $stepId,
                'name'        => $def['name'],
                'description' => $def['description'],
                'status'      => $status,
                'statusLabel' => self::statusLabel($status),
                'blocker'     => $blocker,
                'completedAt' => (string) ($saved_s['completedAt'] ?? ''),
                'isNextAction' => $stepId === $firstPending,
            ];
        }

        $total   = count(self::STEPS);
        $percent = $total > 0 ? (int) round(($doneCount / $total) * 100) : 0;
        $nextAction = null;
        foreach ($steps as $s) {
            if ($s['isNextAction']) {
                $nextAction = $s;
                break;
            }
        }

        return [
            'clinicId'   => $clinicId,
            'steps'      => $steps,
            'percent'    => $percent,
            'doneCount'  => $doneCount,
            'total'      => $total,
            'complete'   => $percent >= 100,
            'nextAction' => $nextAction,
            'nextActionLabel' => $nextAction !== null
                ? 'Siguiente: ' . $nextAction['name']
                : '✅ Onboarding completo',
        ];
    }

    /**
     * Updates the status of a specific step for a clinic.
     * Returns ['ok' => true, 'store' => $updatedStore, 'progress' => $progress].
     */
    public static function updateStep(
        array $store,
        string $clinicId,
        string $stepId,
        string $status,
        string $blocker = ''
    ): array {
        $clinicId = trim($clinicId);
        $stepId   = trim($stepId);

        $validStepIds = array_column(self::STEPS, 'id');
        if (!in_array($stepId, $validStepIds, true)) {
            return ['ok' => false, 'error' => 'Paso de onboarding no reconocido: ' . $stepId];
        }

        $validStatuses = ['pending', 'available', 'done', 'skipped', 'blocked'];
        if (!in_array($status, $validStatuses, true)) {
            return ['ok' => false, 'error' => 'Estado no válido: ' . $status];
        }

        if (!isset($store['onboarding_progress'])) {
            $store['onboarding_progress'] = [];
        }
        if (!isset($store['onboarding_progress'][$clinicId])) {
            $store['onboarding_progress'][$clinicId] = [];
        }

        $store['onboarding_progress'][$clinicId][$stepId] = array_merge(
            is_array($store['onboarding_progress'][$clinicId][$stepId] ?? null)
                ? $store['onboarding_progress'][$clinicId][$stepId]
                : [],
            [
                'status'      => $status,
                'blocker'     => trim($blocker),
                'updatedAt'   => date('c'),
                'completedAt' => in_array($status, ['done', 'skipped'], true) ? date('c') : '',
            ]
        );

        // If a step is done, auto-unlock the next one.
        if ($status === 'done') {
            $idx = array_search($stepId, $validStepIds, true);
            if ($idx !== false && isset($validStepIds[$idx + 1])) {
                $nextId = $validStepIds[$idx + 1];
                $nextCurrent = is_array($store['onboarding_progress'][$clinicId][$nextId] ?? null)
                    ? $store['onboarding_progress'][$clinicId][$nextId]
                    : [];
                $nextStatus = trim((string) ($nextCurrent['status'] ?? 'pending'));
                if ($nextStatus === 'pending') {
                    $store['onboarding_progress'][$clinicId][$nextId] = array_merge($nextCurrent, ['status' => 'available', 'updatedAt' => date('c')]);
                }
            }
        }

        $progress = self::getProgress($store, $clinicId);
        return ['ok' => true, 'store' => $store, 'progress' => $progress];
    }

    // ────────────────────────────────────────────────────────────────
    // Helpers
    // ────────────────────────────────────────────────────────────────

    private static function statusLabel(string $status): string
    {
        return match ($status) {
            'done'      => 'Completado',
            'skipped'   => 'Omitido',
            'available' => 'Disponible',
            'blocked'   => 'Bloqueado',
            default     => 'Pendiente',
        };
    }
}
