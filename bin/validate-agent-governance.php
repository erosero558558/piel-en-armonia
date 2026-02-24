<?php

declare(strict_types=1);

/**
 * Agent governance validator.
 *
 * Validates:
 * - AGENTS.md as canonical policy marker.
 * - CLAUDE.md references AGENTS.md as source of truth.
 * - AGENT_BOARD.yaml shape and allowed values.
 * - No duplicate task_id between derived queues.
 * - No critical-scope task assigned to disallowed executor.
 */

$root = dirname(__DIR__);
$agentsPath = $root . '/AGENTS.md';
$claudePath = $root . '/CLAUDE.md';
$boardPath = $root . '/AGENT_BOARD.yaml';
$julesPath = $root . '/JULES_TASKS.md';
$kimiPath = $root . '/KIMI_TASKS.md';

$errors = [];

function readFileStrict(string $path, array &$errors): string
{
    if (!is_file($path)) {
        $errors[] = "No existe archivo requerido: {$path}";
        return '';
    }

    $content = @file_get_contents($path);
    if ($content === false) {
        $errors[] = "No se pudo leer archivo requerido: {$path}";
        return '';
    }

    return str_replace("\r\n", "\n", $content);
}

function parseInlineArray(string $value): array
{
    $trimmed = trim($value);
    if ($trimmed === '[]' || $trimmed === '') {
        return [];
    }
    if ($trimmed[0] !== '[' || substr($trimmed, -1) !== ']') {
        return [trim($trimmed, "\"' ")];
    }

    $inner = trim(substr($trimmed, 1, -1));
    if ($inner === '') {
        return [];
    }

    $parts = str_getcsv($inner, ',', '"', '\\');
    $out = [];
    foreach ($parts as $part) {
        $clean = trim($part, " \t\n\r\0\x0B\"'");
        if ($clean !== '') {
            $out[] = $clean;
        }
    }

    return $out;
}

function parseScalar(string $raw)
{
    $value = trim($raw);
    if ($value === '') {
        return '';
    }
    if ($value === 'true') {
        return true;
    }
    if ($value === 'false') {
        return false;
    }
    if ($value === '[]') {
        return [];
    }
    if ($value[0] === '[' && substr($value, -1) === ']') {
        return parseInlineArray($value);
    }
    if ($value[0] === '"' && substr($value, -1) === '"') {
        return str_replace('\"', '"', substr($value, 1, -1));
    }

    return $value;
}

/**
 * @return array{version:mixed, policy:array<string,mixed>, tasks:array<int,array<string,mixed>>}
 */
function parseBoardYaml(string $content): array
{
    $lines = explode("\n", $content);
    $board = [
        'version' => 1,
        'policy' => [],
        'tasks' => [],
    ];

    $inPolicy = false;
    $inTasks = false;
    $task = null;

    foreach ($lines as $lineRaw) {
        $line = str_replace("\t", '    ', $lineRaw);
        $trimmed = trim($line);
        if ($trimmed === '' || str_starts_with($trimmed, '#')) {
            continue;
        }

        if ($trimmed === 'policy:') {
            $inPolicy = true;
            $inTasks = false;
            continue;
        }

        if ($trimmed === 'tasks:') {
            $inPolicy = false;
            $inTasks = true;
            if (is_array($task)) {
                $board['tasks'][] = $task;
                $task = null;
            }
            continue;
        }

        if (!$inPolicy && !$inTasks && preg_match('/^version:\s*(.+)$/', $line, $m) === 1) {
            $board['version'] = parseScalar((string) $m[1]);
            continue;
        }

        if ($inPolicy && preg_match('/^\s{2}([a-zA-Z_][\w-]*):\s*(.*)$/', $line, $m) === 1) {
            $board['policy'][(string) $m[1]] = parseScalar((string) $m[2]);
            continue;
        }

        if ($inTasks && preg_match('/^\s{2}-\s+id:\s*(.+)$/', $line, $m) === 1) {
            if (is_array($task)) {
                $board['tasks'][] = $task;
            }
            $task = ['id' => parseScalar((string) $m[1])];
            continue;
        }

        if (
            $inTasks &&
            is_array($task) &&
            preg_match('/^\s{4}([a-zA-Z_][\w-]*):\s*(.*)$/', $line, $m) === 1
        ) {
            $task[(string) $m[1]] = parseScalar((string) $m[2]);
        }
    }

    if (is_array($task)) {
        $board['tasks'][] = $task;
    }

    return $board;
}

/**
 * @return array<int,array<string,string>>
 */
function parseTaskBlocks(string $content): array
{
    $tasks = [];
    if (
        preg_match_all('/<!-- TASK\n([\s\S]*?)-->([\s\S]*?)<!-- \/TASK -->/m', $content, $matches, PREG_SET_ORDER) !== 1 &&
        empty($matches)
    ) {
        return $tasks;
    }

    foreach ($matches as $match) {
        $meta = [];
        $metaBlock = $match[1] ?? '';
        foreach (explode("\n", (string) $metaBlock) as $line) {
            if (preg_match('/^([\w-]+):\s*(.*)$/', trim($line), $m) === 1) {
                $meta[(string) $m[1]] = (string) $m[2];
            }
        }
        if (!empty($meta)) {
            $taskId = trim((string) ($meta['task_id'] ?? ''));
            if ($taskId === '' || preg_match('/^AG-\d+$/', $taskId) !== 1) {
                continue;
            }
            $tasks[] = $meta;
        }
    }

    return $tasks;
}

$agents = readFileStrict($agentsPath, $errors);
$claude = readFileStrict($claudePath, $errors);
$boardRaw = readFileStrict($boardPath, $errors);
$julesRaw = readFileStrict($julesPath, $errors);
$kimiRaw = readFileStrict($kimiPath, $errors);

if ($agents !== '') {
    if (!str_contains($agents, 'CANONICAL_AGENT_POLICY: AGENTS.md')) {
        $errors[] = 'AGENTS.md no declara el marcador canonico CANONICAL_AGENT_POLICY: AGENTS.md';
    }
    if (!str_contains($agents, 'AGENT_POLICY_VERSION:')) {
        $errors[] = 'AGENTS.md no declara AGENT_POLICY_VERSION.';
    }
}

if ($claude !== '') {
    if (!str_contains($claude, 'SOURCE_OF_TRUTH: AGENTS.md')) {
        $errors[] = 'CLAUDE.md debe declarar SOURCE_OF_TRUTH: AGENTS.md';
    }
    if (preg_match('/SOURCE_OF_TRUTH:\s*CLAUDE\.md/i', $claude) === 1) {
        $errors[] = 'CLAUDE.md no puede declararse como fuente de verdad.';
    }
}

$requiredTaskKeys = [
    'id',
    'title',
    'owner',
    'executor',
    'status',
    'risk',
    'scope',
    'files',
    'acceptance',
    'depends_on',
    'created_at',
    'updated_at',
];
$allowedStatuses = ['backlog', 'ready', 'in_progress', 'review', 'done', 'blocked', 'failed'];
$allowedExecutors = ['codex', 'claude', 'kimi', 'jules', 'ci'];
$criticalScopes = ['payments', 'auth', 'calendar', 'deploy', 'env', 'security'];

$board = [
    'version' => 1,
    'policy' => [],
    'tasks' => [],
];
if ($boardRaw !== '') {
    $board = parseBoardYaml($boardRaw);
}

if (empty($board['tasks'])) {
    $errors[] = 'AGENT_BOARD.yaml no contiene tareas.';
}

$taskIds = [];
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

    $executor = (string) ($task['executor'] ?? '');
    if (!in_array($executor, $allowedExecutors, true)) {
        $errors[] = "Task {$id} tiene executor invalido: {$executor}";
    }

    $scope = strtolower((string) ($task['scope'] ?? ''));
    foreach ($criticalScopes as $keyword) {
        if (str_contains($scope, $keyword) && !in_array($executor, ['codex', 'claude'], true)) {
            $errors[] = "Task critica {$id} ({$scope}) no puede asignarse a executor {$executor}";
            break;
        }
    }

    if (!is_array($task['files'] ?? null)) {
        $errors[] = "Task {$id} debe definir files como lista YAML inline.";
    }
    if (!is_array($task['depends_on'] ?? null)) {
        $errors[] = "Task {$id} debe definir depends_on como lista YAML inline.";
    }
}

$requiredQueueMeta = ['task_id', 'risk', 'scope', 'files', 'acceptance_ref', 'dispatched_by', 'status'];
$julesTasks = parseTaskBlocks($julesRaw);
$kimiTasks = parseTaskBlocks($kimiRaw);

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

if (!empty($errors)) {
    fwrite(STDERR, "ERROR: validacion de gobernanza fallida (" . count($errors) . ")\n");
    foreach ($errors as $error) {
        fwrite(STDERR, "- {$error}\n");
    }
    exit(1);
}

fwrite(STDOUT, "OK: gobernanza de agentes valida.\n");
exit(0);
