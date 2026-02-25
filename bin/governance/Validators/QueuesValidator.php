<?php

declare(strict_types=1);

namespace Governance\Validators;

class QueuesValidator
{
    public function validate(array $julesTasks, array $kimiTasks): array
    {
        $errors = [];
        $requiredQueueMeta = ['task_id', 'risk', 'scope', 'files', 'acceptance_ref', 'dispatched_by', 'status'];

        $activeQueueIds = [];
        foreach (['JULES' => $julesTasks, 'KIMI' => $kimiTasks] as $queueName => $tasks) {
            foreach ($tasks as $taskMeta) {
                foreach ($requiredQueueMeta as $key) {
                    if (!array_key_exists($key, $taskMeta)) {
                        $errors[] = "{$queueName}_TASKS.md: bloque TASK sin metadato obligatorio {$key}";
                    }
                }

                $taskId = trim((string) ($taskMeta['task_id'] ?? ''));
                if ($taskId === '') {
                    continue;
                }
                $status = strtolower(trim((string) ($taskMeta['status'] ?? '')));
                if ($status !== 'done') {
                    $activeQueueIds[$taskId][] = $queueName;
                }
            }
        }

        foreach ($activeQueueIds as $taskId => $queues) {
            $uniqueQueues = array_values(array_unique($queues));
            if (count($uniqueQueues) > 1) {
                $errors[] = "task_id {$taskId} aparece activo en colas duplicadas: " . implode(', ', $uniqueQueues);
            }
        }

        return $errors;
    }
}
