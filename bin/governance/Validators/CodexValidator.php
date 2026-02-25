<?php

declare(strict_types=1);

namespace Governance\Validators;

use Governance\Utils;

class CodexValidator
{
    public function validate(array $codexBlocks, array $boardTasks): array
    {
        $errors = [];

        $codexTasks = [];
        $codexInProgress = [];
        $codexActive = [];

        foreach ($boardTasks as $task) {
            $id = (string) ($task['id'] ?? '');
            if (!str_starts_with($id, 'CDX-')) {
                continue;
            }
            $codexTasks[] = $task;
            if (preg_match('/^CDX-\d+$/', $id) !== 1) {
                $errors[] = "Task Codex con id invalido: {$id} (esperado CDX-###)";
            }
            $status = (string) ($task['status'] ?? '');
            if ($status === 'in_progress') {
                $codexInProgress[] = $id;
            }
            if (Utils::isActiveStatus($status)) {
                $codexActive[] = $id;
            }
        }

        if (count($codexInProgress) > 1) {
            $errors[] = 'Mas de una tarea CDX in_progress: ' . implode(', ', $codexInProgress);
        }

        if (count($codexBlocks) > 1) {
            $errors[] = 'PLAN_MAESTRO_CODEX_2026.md contiene mas de un bloque CODEX_ACTIVE';
        }

        $taskMap = [];
        foreach ($boardTasks as $task) {
            $taskMap[(string) ($task['id'] ?? '')] = $task;
        }

        if (count($codexBlocks) === 0) {
            if (!empty($codexActive)) {
                $errors[] = 'Hay tareas CDX activas sin bloque CODEX_ACTIVE: ' . implode(', ', $codexActive);
            }
        } elseif (count($codexBlocks) === 1) {
            $block = $codexBlocks[0];
            $blockTaskId = trim((string) ($block['task_id'] ?? ''));
            $blockStatus = trim((string) ($block['status'] ?? ''));
            // $blockFiles = is_array($block['files'] ?? null) ? $block['files'] : [];
            $boardTask = $taskMap[$blockTaskId] ?? null;

            if ($blockTaskId === '') {
                $errors[] = 'CODEX_ACTIVE.task_id vacio en PLAN_MAESTRO_CODEX_2026.md';
            } elseif (preg_match('/^CDX-\d+$/', $blockTaskId) !== 1) {
                $errors[] = "CODEX_ACTIVE.task_id invalido: {$blockTaskId}";
            }

            if ($boardTask === null) {
                $errors[] = "CODEX_ACTIVE.task_id no existe en AGENT_BOARD.yaml: {$blockTaskId}";
            } else {
                if ((string) ($boardTask['executor'] ?? '') !== 'codex') {
                    $errors[] = "Task {$blockTaskId} del espejo Codex debe tener executor=codex";
                }
                if ($blockStatus !== (string) ($boardTask['status'] ?? '')) {
                    $errors[] = "Task {$blockTaskId} tiene status desalineado entre CODEX_ACTIVE y AGENT_BOARD";
                }
            }

            if (Utils::isActiveStatus($blockStatus) && empty($codexActive)) {
                $errors[] = 'CODEX_ACTIVE indica status activo pero no hay tareas CDX activas en AGENT_BOARD';
            }
        }

        return $errors;
    }
}
