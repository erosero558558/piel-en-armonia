<?php

declare(strict_types=1);

namespace Governance\Validators;

use Governance\Utils;
use Governance\Parsers;

class BoardValidator
{
    public function validate(array $board): array
    {
        $errors = [];

        if (empty($board['tasks'])) {
            $errors[] = 'AGENT_BOARD.yaml no contiene tareas.';
        }

        if (array_key_exists('revision', $board['policy'])) {
            $boardRevisionRaw = trim((string) $board['policy']['revision']);
            if ($boardRevisionRaw === '' || preg_match('/^\d+$/', $boardRevisionRaw) !== 1) {
                $errors[] = 'AGENT_BOARD.yaml policy.revision debe ser entero >= 0';
            }
        }

        $taskIds = [];
        $requiredTaskKeys = [
            'id', 'title', 'owner', 'executor', 'status', 'risk', 'scope', 'files',
            'source_signal', 'source_ref', 'priority_score', 'sla_due_at',
            'last_attempt_at', 'attempts', 'blocked_reason', 'runtime_impact',
            'critical_zone', 'acceptance', 'acceptance_ref', 'evidence_ref',
            'depends_on', 'created_at', 'updated_at',
        ];
        $requiredDualTaskKeys = [
            'codex_instance', 'domain_lane', 'lane_lock', 'cross_domain',
        ];
        $allowedStatuses = ['backlog', 'ready', 'in_progress', 'review', 'done', 'blocked', 'failed'];
        $allowedExecutors = ['codex', 'claude', 'kimi', 'jules', 'ci'];
        $allowedCodexInstances = ['codex_backend_ops', 'codex_frontend'];
        $allowedDomainLanes = ['backend_ops', 'frontend_content'];
        $allowedLaneLocks = ['strict', 'handoff_allowed'];
        $criticalScopes = ['payments', 'auth', 'calendar', 'deploy', 'env', 'security'];

        foreach ($board['tasks'] as $idx => $task) {
            $position = $idx + 1;
            foreach ($requiredTaskKeys as $key) {
                if (!array_key_exists($key, $task)) {
                    $errors[] = "AGENT_BOARD task #{$position} sin campo obligatorio: {$key}";
                }
            }

            $id = (string) ($task['id'] ?? '');
            if ($id === '') {
                $errors[] = "AGENT_BOARD task #{$position} tiene id vacio";
            } elseif (isset($taskIds[$id])) {
                $errors[] = "AGENT_BOARD tiene task_id duplicado: {$id}";
            } else {
                $taskIds[$id] = true;
            }

            $status = (string) ($task['status'] ?? '');
            if (!in_array($status, $allowedStatuses, true)) {
                $errors[] = "Task {$id} tiene status invalido: {$status}";
            }
            $requiresDualTaskKeys = in_array($status, ['ready', 'in_progress', 'review', 'blocked'], true);
            $hasAnyDualKey = false;
            foreach ($requiredDualTaskKeys as $dualKey) {
                if (array_key_exists($dualKey, $task)) {
                    $hasAnyDualKey = true;
                    break;
                }
            }
            if ($requiresDualTaskKeys || $hasAnyDualKey) {
                foreach ($requiredDualTaskKeys as $dualKey) {
                    if (!array_key_exists($dualKey, $task)) {
                        $errors[] = "Task {$id} requiere campo dual-codex: {$dualKey}";
                    }
                }
            }

            $executor = (string) ($task['executor'] ?? '');
            if (!in_array($executor, $allowedExecutors, true)) {
                $errors[] = "Task {$id} tiene executor invalido: {$executor}";
            }

            $scope = strtolower((string) ($task['scope'] ?? ''));
            $runtimeImpact = strtolower((string) ($task['runtime_impact'] ?? ''));
            if (!in_array($runtimeImpact, ['none', 'low', 'high'], true)) {
                $errors[] = "Task {$id} tiene runtime_impact invalido: {$runtimeImpact}";
            }
            $attempts = is_numeric($task['attempts'] ?? null) ? (int) $task['attempts'] : -1;
            if ($attempts < 0) {
                $errors[] = "Task {$id} debe declarar attempts >= 0";
            }
            $priorityScore = is_numeric($task['priority_score'] ?? null) ? (int) $task['priority_score'] : -1;
            if ($priorityScore < 0 || $priorityScore > 100) {
                $errors[] = "Task {$id} debe declarar priority_score en rango 0..100";
            }
            $criticalZone = (bool) ($task['critical_zone'] ?? false);
            if ($criticalZone || $runtimeImpact === 'high') {
                if (!in_array($executor, ['codex', 'claude'], true)) {
                    $errors[] = "Task critica {$id} por runtime/critical_zone no puede asignarse a {$executor}";
                }
            }
            foreach ($criticalScopes as $keyword) {
                if (str_contains($scope, $keyword) && !in_array($executor, ['codex', 'claude'], true)) {
                    $errors[] = "Task critica {$id} ({$scope}) no puede asignarse a executor {$executor}";
                    break;
                }
            }

            $codexInstance = strtolower(trim((string) ($task['codex_instance'] ?? 'codex_backend_ops')));
            $domainLane = strtolower(trim((string) ($task['domain_lane'] ?? 'backend_ops')));
            $laneLock = strtolower(trim((string) ($task['lane_lock'] ?? 'strict')));
            $crossDomain = Parsers::parseBooleanLike($task['cross_domain'] ?? false, false);

            $shouldValidateDual = $requiresDualTaskKeys || $hasAnyDualKey;
            if ($shouldValidateDual && !in_array($codexInstance, $allowedCodexInstances, true)) {
                $errors[] = "Task {$id} tiene codex_instance invalido: {$codexInstance}";
            }
            if ($shouldValidateDual && !in_array($domainLane, $allowedDomainLanes, true)) {
                $errors[] = "Task {$id} tiene domain_lane invalido: {$domainLane}";
            }
            if ($shouldValidateDual && !in_array($laneLock, $allowedLaneLocks, true)) {
                $errors[] = "Task {$id} tiene lane_lock invalido: {$laneLock}";
            }

            if ($shouldValidateDual) {
                if ($domainLane === 'frontend_content' && $codexInstance !== 'codex_frontend') {
                    $errors[] = "Task {$id} con domain_lane=frontend_content requiere codex_instance=codex_frontend";
                }
                if ($domainLane === 'backend_ops' && $codexInstance !== 'codex_backend_ops') {
                    $errors[] = "Task {$id} con domain_lane=backend_ops requiere codex_instance=codex_backend_ops";
                }
                if (($criticalZone || $runtimeImpact === 'high') && $codexInstance !== 'codex_backend_ops') {
                    $errors[] = "Task critica {$id} requiere codex_instance=codex_backend_ops";
                }
                if ($crossDomain && $laneLock !== 'handoff_allowed') {
                    $errors[] = "Task {$id} con cross_domain=true requiere lane_lock=handoff_allowed";
                }
                if (!$crossDomain && $laneLock !== 'strict') {
                    $errors[] = "Task {$id} con cross_domain=false requiere lane_lock=strict";
                }
                if ($crossDomain && (!is_array($task['depends_on'] ?? null) || count($task['depends_on']) === 0)) {
                    $errors[] = "Task {$id} con cross_domain=true requiere depends_on no vacio";
                }
            }

            if (!is_array($task['files'] ?? null)) {
                $errors[] = "Task {$id} debe definir files como lista YAML inline.";
            } elseif ($shouldValidateDual && !$crossDomain) {
                foreach ($task['files'] as $rawFile) {
                    $fileLane = Utils::classifyFileLaneForDualCodex((string) $rawFile);
                    if ($fileLane !== $domainLane) {
                        $normalizedFile = Utils::normalizePathToken((string) $rawFile);
                        $errors[] = "Task {$id} tiene file fuera de lane {$domainLane}: {$normalizedFile}=>{$fileLane}";
                    }
                }
            }
            if (!is_array($task['depends_on'] ?? null)) {
                $errors[] = "Task {$id} debe definir depends_on como lista YAML inline.";
            }
            foreach ([
                'status_since_at',
                'lease_id',
                'lease_owner',
                'lease_created_at',
                'heartbeat_at',
                'lease_expires_at',
                'lease_reason',
                'lease_cleared_at',
                'lease_cleared_reason',
            ] as $leaseField) {
                if (array_key_exists($leaseField, $task) && !is_string($task[$leaseField])) {
                    $errors[] = "Task {$id} tiene {$leaseField} invalido (debe ser string)";
                }
            }
            if ($status === 'done') {
                $evidenceRef = trim((string) ($task['evidence_ref'] ?? ''));
                if ($evidenceRef === '') {
                    $errors[] = "Task {$id} en done requiere evidence_ref";
                }
            }
        }

        return $errors;
    }
}
