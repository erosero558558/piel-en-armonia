<?php

declare(strict_types=1);

namespace Governance\Validators;

use Governance\Utils;
use Governance\Parsers;

class HandoffsValidator
{
    public function validate(array $handoffs, array $boardTasks): array
    {
        $errors = [];

        if ((string) ($handoffs['version'] ?? '') !== '1') {
            $errors[] = 'AGENT_HANDOFFS.yaml debe declarar version: 1';
        }

        $taskMap = [];
        foreach ($boardTasks as $task) {
            $taskMap[(string) ($task['id'] ?? '')] = $task;
        }

        $handoffIds = [];
        foreach (($handoffs['handoffs'] ?? []) as $handoff) {
            $handoffId = trim((string) ($handoff['id'] ?? ''));
            if ($handoffId === '') {
                $errors[] = 'AGENT_HANDOFFS.yaml contiene handoff sin id';
                continue;
            }
            if (isset($handoffIds[$handoffId])) {
                $errors[] = "AGENT_HANDOFFS.yaml tiene handoff duplicado: {$handoffId}";
            }
            $handoffIds[$handoffId] = true;

            if (preg_match('/^HO-\d+$/', $handoffId) !== 1) {
                $errors[] = "Handoff {$handoffId} tiene id invalido (esperado HO-###)";
            }

            $handoffStatus = strtolower(trim((string) ($handoff['status'] ?? '')));
            if (!in_array($handoffStatus, ['active', 'closed', 'expired'], true)) {
                $errors[] = "Handoff {$handoffId} tiene status invalido: {$handoffStatus}";
            }

            $fromTaskId = trim((string) ($handoff['from_task'] ?? ''));
            $toTaskId = trim((string) ($handoff['to_task'] ?? ''));
            $fromTask = $taskMap[$fromTaskId] ?? null;
            $toTask = $taskMap[$toTaskId] ?? null;

            if ($fromTaskId === '' || $fromTask === null) {
                $errors[] = "Handoff {$handoffId} referencia from_task inexistente: {$fromTaskId}";
            }
            if ($toTaskId === '' || $toTask === null) {
                $errors[] = "Handoff {$handoffId} referencia to_task inexistente: {$toTaskId}";
            }
            if ($fromTaskId !== '' && $fromTaskId === $toTaskId) {
                $errors[] = "Handoff {$handoffId} no puede usar el mismo task en from_task y to_task";
            }

            $handoffFiles = $handoff['files'] ?? null;
            if (!is_array($handoffFiles) || count($handoffFiles) === 0) {
                $errors[] = "Handoff {$handoffId} debe definir files como lista no vacia";
                $handoffFiles = [];
            }
            foreach ($handoffFiles as $rawFile) {
                $file = trim((string) $rawFile);
                if ($file === '') {
                    $errors[] = "Handoff {$handoffId} contiene file vacio";
                    continue;
                }
                if (str_contains($file, '*')) {
                    $errors[] = "Handoff {$handoffId} no permite wildcards en files ({$file})";
                }
                if (in_array($file, ['.', './', '/'], true)) {
                    $errors[] = "Handoff {$handoffId} define file demasiado amplio ({$file})";
                }
            }

            $createdAt = trim((string) ($handoff['created_at'] ?? ''));
            $expiresAt = trim((string) ($handoff['expires_at'] ?? ''));
            $createdTs = strtotime($createdAt);
            $expiresTs = strtotime($expiresAt);
            if ($createdAt === '' || $createdTs === false) {
                $errors[] = "Handoff {$handoffId} tiene created_at invalido";
            }
            if ($expiresAt === '' || $expiresTs === false) {
                $errors[] = "Handoff {$handoffId} tiene expires_at invalido";
            }
            if ($createdTs !== false && $expiresTs !== false) {
                if ($expiresTs <= $createdTs) {
                    $errors[] = "Handoff {$handoffId} requiere expires_at > created_at";
                }
                if (($expiresTs - $createdTs) > (48 * 3600)) {
                    $errors[] = "Handoff {$handoffId} excede TTL maximo de 48h";
                }
            }

            if ($handoffStatus === 'active') {
                if ($expiresTs !== false && $expiresTs <= time()) {
                    $errors[] = "Handoff {$handoffId} esta activo pero expirado";
                }
                if (is_array($fromTask) && !Utils::isActiveStatus((string) ($fromTask['status'] ?? ''))) {
                    $errors[] = "Handoff {$handoffId} requiere from_task activo ({$fromTaskId})";
                }
                if (is_array($toTask) && !Utils::isActiveStatus((string) ($toTask['status'] ?? ''))) {
                    $errors[] = "Handoff {$handoffId} requiere to_task activo ({$toTaskId})";
                }
            }
            if ($handoffStatus === 'expired' && $expiresTs !== false && $expiresTs > time()) {
                $errors[] = "Handoff {$handoffId} con status expired requiere expires_at en pasado";
            }
        }

        foreach ($boardTasks as $task) {
            $taskId = trim((string) ($task['id'] ?? ''));
            $taskStatus = strtolower(trim((string) ($task['status'] ?? '')));
            $crossDomain = Parsers::parseBooleanLike($task['cross_domain'] ?? false, false);
            if ($taskId === '' || !$crossDomain || !Utils::isActiveStatus($taskStatus)) {
                continue;
            }
            $hasLinkedActiveHandoff = false;
            foreach (($handoffs['handoffs'] ?? []) as $handoff) {
                $handoffStatus = strtolower(trim((string) ($handoff['status'] ?? '')));
                if ($handoffStatus !== 'active') {
                    continue;
                }
                $expiresTs = strtotime((string) ($handoff['expires_at'] ?? ''));
                if ($expiresTs !== false && $expiresTs <= time()) {
                    continue;
                }
                $fromTask = trim((string) ($handoff['from_task'] ?? ''));
                $toTask = trim((string) ($handoff['to_task'] ?? ''));
                if ($fromTask === $taskId || $toTask === $taskId) {
                    $hasLinkedActiveHandoff = true;
                    break;
                }
            }
            if (!$hasLinkedActiveHandoff) {
                $errors[] = "Task {$taskId} cross_domain activa requiere handoff activo vinculado";
            }
        }

        return $errors;
    }
}
