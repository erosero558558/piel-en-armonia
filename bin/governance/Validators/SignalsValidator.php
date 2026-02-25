<?php

declare(strict_types=1);

namespace Governance\Validators;

class SignalsValidator
{
    public function validate(array $signals, array $boardTasks): array
    {
        $errors = [];

        if ((string) ($signals['version'] ?? '') !== '1') {
            $errors[] = 'AGENT_SIGNALS.yaml debe declarar version: 1';
        }

        $criticalSignals = array_values(
            array_filter(
                $signals['signals'] ?? [],
                static function (array $signal): bool {
                    $status = strtolower(trim((string) ($signal['status'] ?? '')));
                    $isActive = in_array($status, ['open', 'active', 'failing'], true);
                    return $isActive && (bool) ($signal['critical'] ?? false);
                }
            )
        );

        $readyOrInProgressCount = 0;
        foreach ($boardTasks as $task) {
            $status = strtolower(trim((string) ($task['status'] ?? '')));
            if (in_array($status, ['ready', 'in_progress'], true)) {
                $readyOrInProgressCount++;
            }
        }

        if (count($criticalSignals) > 0 && $readyOrInProgressCount === 0) {
            $errors[] = 'AGENT_BOARD invalido: hay señales críticas activas en AGENT_SIGNALS.yaml pero no existen tareas ready|in_progress';
        }

        return $errors;
    }
}
