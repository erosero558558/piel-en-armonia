#!/usr/bin/env node
/**
 * Agent Orchestrator
 *
 * Canonical source: AGENT_BOARD.yaml
 * Derived queues:   JULES_TASKS.md, KIMI_TASKS.md
 *
 * Commands:
 *   node agent-orchestrator.js status [--json]
 *   node agent-orchestrator.js conflicts [--strict]
 *   node agent-orchestrator.js sync
 *   node agent-orchestrator.js close <task_id> [--evidence path]
 *   node agent-orchestrator.js metrics
 */

const { readFileSync, writeFileSync, existsSync } = require('fs');
const { resolve } = require('path');

const ROOT = __dirname;
const BOARD_PATH = resolve(ROOT, 'AGENT_BOARD.yaml');
const JULES_PATH = resolve(ROOT, 'JULES_TASKS.md');
const KIMI_PATH = resolve(ROOT, 'KIMI_TASKS.md');
const EVIDENCE_DIR = resolve(ROOT, 'verification', 'agent-runs');
const METRICS_PATH = resolve(ROOT, 'verification', 'agent-metrics.json');

const ALLOWED_STATUSES = new Set([
    'backlog',
    'ready',
    'in_progress',
    'review',
    'done',
    'blocked',
    'failed',
]);

const ACTIVE_STATUSES = new Set(['ready', 'in_progress', 'review', 'blocked']);

function normalizeEol(value) {
    return value.replace(/\r\n/g, '\n');
}

function unquote(value) {
    const trimmed = value.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        return trimmed.slice(1, -1).replace(/\\"/g, '"');
    }
    return trimmed;
}

function parseInlineArray(value) {
    const trimmed = value.trim();
    if (trimmed === '[]') return [];
    if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
        return [unquote(trimmed)];
    }

    const body = trimmed.slice(1, -1).trim();
    if (!body) return [];

    return body
        .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
        .map((entry) => unquote(entry))
        .map((entry) => entry.trim())
        .filter(Boolean);
}

function parseScalar(value) {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === '[]') return [];
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) return parseInlineArray(trimmed);
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) return unquote(trimmed);
    return trimmed;
}

function parseBoard() {
    if (!existsSync(BOARD_PATH)) {
        throw new Error(`No existe ${BOARD_PATH}`);
    }

    const lines = normalizeEol(readFileSync(BOARD_PATH, 'utf8')).split('\n');
    const board = {
        version: 1,
        policy: {},
        tasks: [],
    };

    let inPolicy = false;
    let inTasks = false;
    let task = null;

    for (const rawLine of lines) {
        const line = rawLine.replace(/\t/g, '    ');
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith('#')) continue;

        if (trimmed === 'policy:') {
            inPolicy = true;
            inTasks = false;
            continue;
        }

        if (trimmed === 'tasks:') {
            inTasks = true;
            inPolicy = false;
            if (task) {
                board.tasks.push(task);
                task = null;
            }
            continue;
        }

        const versionMatch = line.match(/^version:\s*(.+)$/);
        if (versionMatch && !inPolicy && !inTasks) {
            board.version = parseScalar(versionMatch[1]);
            continue;
        }

        if (inPolicy) {
            const policyMatch = line.match(/^\s{2}([a-zA-Z_][\w-]*):\s*(.*)$/);
            if (policyMatch) {
                board.policy[policyMatch[1]] = parseScalar(policyMatch[2]);
            }
            continue;
        }

        if (inTasks) {
            const taskStart = line.match(/^\s{2}-\s+id:\s*(.+)$/);
            if (taskStart) {
                if (task) board.tasks.push(task);
                task = { id: parseScalar(taskStart[1]) };
                continue;
            }

            const taskProp = line.match(/^\s{4}([a-zA-Z_][\w-]*):\s*(.*)$/);
            if (task && taskProp) {
                task[taskProp[1]] = parseScalar(taskProp[2]);
            }
        }
    }

    if (task) board.tasks.push(task);

    for (const item of board.tasks) {
        if (!Array.isArray(item.files)) item.files = item.files ? [String(item.files)] : [];
        if (!Array.isArray(item.depends_on)) {
            item.depends_on = item.depends_on ? [String(item.depends_on)] : [];
        }
        item.status = String(item.status || '').trim();
        if (!ALLOWED_STATUSES.has(item.status)) {
            throw new Error(`Estado no permitido en ${item.id}: ${item.status}`);
        }
    }

    return board;
}

function quote(value) {
    return `"${String(value).replace(/"/g, '\\"')}"`;
}

function serializeArrayInline(values) {
    if (!Array.isArray(values) || values.length === 0) return '[]';
    return `[${values.map((v) => quote(v)).join(', ')}]`;
}

function serializeBoard(board) {
    const lines = [];
    lines.push(`version: ${board.version}`);
    lines.push('policy:');
    lines.push(`  canonical: ${board.policy.canonical || 'AGENTS.md'}`);
    lines.push(`  autonomy: ${board.policy.autonomy || 'semi_autonomous_guardrails'}`);
    lines.push(`  kpi: ${board.policy.kpi || 'reduce_rework'}`);
    lines.push(`  updated_at: ${board.policy.updated_at || currentDate()}`);
    lines.push('');
    lines.push('tasks:');

    for (const task of board.tasks) {
        lines.push(`  - id: ${task.id}`);
        lines.push(`    title: ${quote(task.title || '')}`);
        lines.push(`    owner: ${task.owner || 'unassigned'}`);
        lines.push(`    executor: ${task.executor || 'codex'}`);
        lines.push(`    status: ${task.status || 'backlog'}`);
        lines.push(`    risk: ${task.risk || 'medium'}`);
        lines.push(`    scope: ${task.scope || 'general'}`);
        lines.push(`    files: ${serializeArrayInline(task.files || [])}`);
        lines.push(`    acceptance: ${quote(task.acceptance || '')}`);
        lines.push(`    acceptance_ref: ${quote(task.acceptance_ref || '')}`);
        lines.push(`    depends_on: ${serializeArrayInline(task.depends_on || [])}`);
        lines.push(`    prompt: ${quote(task.prompt || task.title || '')}`);
        lines.push(`    created_at: ${task.created_at || currentDate()}`);
        lines.push(`    updated_at: ${task.updated_at || currentDate()}`);
        lines.push('');
    }

    return `${lines.join('\n').trimEnd()}\n`;
}

function currentDate() {
    return new Date().toISOString().slice(0, 10);
}

function getStatusCounts(tasks) {
    return tasks.reduce((acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
    }, {});
}

function getExecutorCounts(tasks) {
    return tasks.reduce((acc, task) => {
        acc[task.executor] = (acc[task.executor] || 0) + 1;
        return acc;
    }, {});
}

function parseTaskMetaMap(path) {
    if (!existsSync(path)) return new Map();
    const raw = normalizeEol(readFileSync(path, 'utf8'));
    const regex = /<!-- TASK\n([\s\S]*?)-->([\s\S]*?)<!-- \/TASK -->/g;
    const map = new Map();
    let match;

    while ((match = regex.exec(raw)) !== null) {
        const meta = {};
        for (const line of match[1].split('\n')) {
            const m = line.match(/^([\w-]+):\s*(.*)$/);
            if (m) meta[m[1]] = m[2].trim();
        }

        const id = meta.task_id;
        if (id) map.set(id, meta);
    }

    return map;
}

function boardToQueueStatus(taskStatus, executor) {
    if (taskStatus === 'done') return 'done';
    if (taskStatus === 'failed' || taskStatus === 'blocked') return 'failed';
    if (taskStatus === 'in_progress' || taskStatus === 'review') {
        return executor === 'jules' ? 'dispatched' : 'running';
    }
    return 'pending';
}

function renderQueueFile(executor, tasks, existingMeta) {
    const header =
        executor === 'jules'
            ? '# JULES_TASKS.md — Cola derivada desde AGENT_BOARD.yaml'
            : '# KIMI_TASKS.md — Cola derivada desde AGENT_BOARD.yaml';
    const runnerHint =
        executor === 'jules'
            ? 'JULES_API_KEY=xxx node jules-dispatch.js dispatch'
            : 'node kimi-run.js --dispatch';
    const validStatuses =
        executor === 'jules'
            ? 'pending | dispatched | done | failed'
            : 'pending | running | done | failed';

    const lines = [];
    lines.push(header);
    lines.push('');
    lines.push('> Archivo generado por `node agent-orchestrator.js sync`.');
    lines.push('> No editar manualmente; los cambios se sobrescriben.');
    lines.push(`> Ejecutar cola: \`${runnerHint}\``);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## Formato de tarea');
    lines.push('');
    lines.push('```');
    lines.push('<!-- TASK');
    lines.push(`status: ${validStatuses}`);
    lines.push('task_id: AG-XXX');
    lines.push('risk: low|medium|high');
    lines.push('scope: docs|frontend|backend|platform|security|ops');
    lines.push('files: path1,path2');
    lines.push('acceptance_ref: verification/agent-runs/AG-XXX.md');
    lines.push('dispatched_by: agent-orchestrator');
    if (executor === 'jules') {
        lines.push('session:');
        lines.push('dispatched:');
    }
    lines.push('-->');
    lines.push('### Titulo');
    lines.push('');
    lines.push('Prompt...');
    lines.push('');
    lines.push('<!-- /TASK -->');
    lines.push('```');
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## Tareas');
    lines.push('');

    for (const task of tasks) {
        const meta = existingMeta.get(task.id) || {};
        const queueStatus = boardToQueueStatus(task.status, executor);
        const files = Array.isArray(task.files) ? task.files.join(',') : '';
        const acceptanceRef = task.acceptance_ref || `verification/agent-runs/${task.id}.md`;

        lines.push('<!-- TASK');
        lines.push(`status: ${queueStatus}`);
        lines.push(`task_id: ${task.id}`);
        lines.push(`risk: ${task.risk || 'medium'}`);
        lines.push(`scope: ${task.scope || 'general'}`);
        lines.push(`files: ${files}`);
        lines.push(`acceptance_ref: ${acceptanceRef}`);
        lines.push('dispatched_by: agent-orchestrator');
        if (executor === 'jules') {
            lines.push(`session: ${meta.session || ''}`);
            lines.push(`dispatched: ${meta.dispatched || ''}`);
        }
        lines.push('-->');
        lines.push(`### ${task.title}`);
        lines.push('');
        lines.push(task.prompt || task.title);
        lines.push('');
        lines.push('<!-- /TASK -->');
        lines.push('');
    }

    return `${lines.join('\n').trimEnd()}\n`;
}

function wildcardToRegex(pattern) {
    const escaped = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`, 'i');
}

function filesOverlap(filesA, filesB) {
    for (const rawA of filesA) {
        for (const rawB of filesB) {
            const a = String(rawA || '').trim().toLowerCase();
            const b = String(rawB || '').trim().toLowerCase();
            if (!a || !b) continue;
            if (a === b) return true;

            const aWild = a.includes('*');
            const bWild = b.includes('*');
            if (aWild && wildcardToRegex(a).test(b)) return true;
            if (bWild && wildcardToRegex(b).test(a)) return true;
        }
    }
    return false;
}

function detectConflicts(tasks) {
    const active = tasks.filter((task) => ACTIVE_STATUSES.has(task.status));
    const conflicts = [];

    for (let i = 0; i < active.length; i++) {
        for (let j = i + 1; j < active.length; j++) {
            if (filesOverlap(active[i].files, active[j].files)) {
                conflicts.push({
                    left: active[i],
                    right: active[j],
                });
            }
        }
    }
    return conflicts;
}

function cmdStatus(args) {
    const board = parseBoard();
    const data = {
        version: board.version,
        policy: board.policy,
        totals: {
            tasks: board.tasks.length,
            byStatus: getStatusCounts(board.tasks),
            byExecutor: getExecutorCounts(board.tasks),
        },
        conflicts: detectConflicts(board.tasks).length,
    };

    if (args.includes('--json')) {
        console.log(JSON.stringify(data, null, 2));
        return;
    }

    console.log('== Agent Orchestrator Status ==');
    console.log(`Version board: ${data.version}`);
    console.log(`Total tasks: ${data.totals.tasks}`);
    console.log(`Conflicts activos: ${data.conflicts}`);
    console.log('');
    console.log('Por estado:');
    for (const [status, count] of Object.entries(data.totals.byStatus)) {
        console.log(`- ${status}: ${count}`);
    }
    console.log('');
    console.log('Por ejecutor:');
    for (const [executor, count] of Object.entries(data.totals.byExecutor)) {
        console.log(`- ${executor}: ${count}`);
    }
}

function safeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function cmdMetrics() {
    const board = parseBoard();
    const conflicts = detectConflicts(board.tasks).length;
    const total = board.tasks.length;
    const done = board.tasks.filter((task) => task.status === 'done').length;
    const inProgress = board.tasks.filter((task) => task.status === 'in_progress').length;

    let existing = null;
    if (existsSync(METRICS_PATH)) {
        try {
            existing = JSON.parse(readFileSync(METRICS_PATH, 'utf8'));
        } catch {
            existing = null;
        }
    }

    const baseline = existing && existing.baseline ? existing.baseline : {
        tasks_total: total,
        tasks_with_rework: 0,
        file_conflicts: conflicts,
        non_critical_lead_time_hours_avg: null,
        coordination_gate_red_rate_pct: null,
        traceability_pct: 0,
    };

    const traceability = total === 0
        ? 100
        : Math.round(
              (board.tasks.filter((task) => String(task.acceptance_ref || '').trim() !== '').length / total) * 100
          );

    const metrics = {
        version: 1,
        period: {
            timezone: 'America/Guayaquil',
            window_days: 7,
            updated_at: new Date().toISOString(),
        },
        targets: existing && existing.targets ? existing.targets : {
            rework_reduction_pct: 40,
            file_conflict_rate_pct_max: 5,
            non_critical_lead_time_hours_max: 24,
            coordination_gate_red_rate_pct_max: 10,
            traceability_pct: 100,
        },
        baseline: {
            tasks_total: safeNumber(baseline.tasks_total, total),
            tasks_with_rework: safeNumber(baseline.tasks_with_rework, 0),
            file_conflicts: safeNumber(baseline.file_conflicts, conflicts),
            non_critical_lead_time_hours_avg:
                baseline.non_critical_lead_time_hours_avg === null
                    ? null
                    : safeNumber(baseline.non_critical_lead_time_hours_avg, 0),
            coordination_gate_red_rate_pct:
                baseline.coordination_gate_red_rate_pct === null
                    ? null
                    : safeNumber(baseline.coordination_gate_red_rate_pct, 0),
            traceability_pct: safeNumber(baseline.traceability_pct, 0),
        },
        current: {
            tasks_total: total,
            tasks_in_progress: inProgress,
            tasks_done: done,
            tasks_with_rework: 0,
            file_conflicts: conflicts,
            non_critical_lead_time_hours_avg: null,
            coordination_gate_red_rate_pct: null,
            traceability_pct: traceability,
        },
    };

    writeFileSync(METRICS_PATH, `${JSON.stringify(metrics, null, 4)}\n`, 'utf8');
    console.log(`Metricas actualizadas en ${METRICS_PATH}`);
}

function cmdConflicts(args) {
    const strict = args.includes('--strict');
    const board = parseBoard();
    const conflicts = detectConflicts(board.tasks);

    if (conflicts.length === 0) {
        console.log('Sin conflictos de archivos entre tareas activas.');
        return;
    }

    console.log(`Conflictos detectados: ${conflicts.length}`);
    for (const item of conflicts) {
        console.log(
            `- ${item.left.id} (${item.left.executor}) <-> ${item.right.id} (${item.right.executor})`
        );
    }

    if (strict) {
        process.exitCode = 1;
    }
}

function cmdSync() {
    const board = parseBoard();
    const julesMeta = parseTaskMetaMap(JULES_PATH);
    const kimiMeta = parseTaskMetaMap(KIMI_PATH);

    const julesTasks = board.tasks.filter((task) => task.executor === 'jules');
    const kimiTasks = board.tasks.filter((task) => task.executor === 'kimi');

    const julesContent = renderQueueFile('jules', julesTasks, julesMeta);
    const kimiContent = renderQueueFile('kimi', kimiTasks, kimiMeta);

    writeFileSync(JULES_PATH, julesContent, 'utf8');
    writeFileSync(KIMI_PATH, kimiContent, 'utf8');

    console.log(`Sync completado: ${julesTasks.length} tareas Jules, ${kimiTasks.length} tareas Kimi.`);
}

function cmdClose(args) {
    const taskId = args[0];
    if (!taskId) {
        throw new Error('Uso: node agent-orchestrator.js close <task_id> [--evidence path]');
    }

    const evidenceFlagIdx = args.findIndex((arg) => arg === '--evidence');
    const evidencePath =
        evidenceFlagIdx !== -1 && args[evidenceFlagIdx + 1]
            ? resolve(ROOT, args[evidenceFlagIdx + 1])
            : resolve(EVIDENCE_DIR, `${taskId}.md`);

    if (!existsSync(evidencePath)) {
        throw new Error(`No existe evidencia requerida: ${evidencePath}`);
    }

    const board = parseBoard();
    const task = board.tasks.find((item) => String(item.id) === String(taskId));
    if (!task) {
        throw new Error(`No existe task_id ${taskId} en AGENT_BOARD.yaml`);
    }

    task.status = 'done';
    task.updated_at = currentDate();
    const normalizedRoot = ROOT.replace(/\\/g, '/');
    const normalizedEvidence = evidencePath.replace(/\\/g, '/');
    task.acceptance_ref = normalizedEvidence.startsWith(`${normalizedRoot}/`)
        ? normalizedEvidence.slice(normalizedRoot.length + 1)
        : normalizedEvidence;
    board.policy.updated_at = currentDate();

    writeFileSync(BOARD_PATH, serializeBoard(board), 'utf8');
    cmdSync();

    console.log(`Tarea cerrada: ${taskId}`);
}

function main() {
    const [command = 'status', ...args] = process.argv.slice(2);
    const commands = {
        status: () => cmdStatus(args),
        conflicts: () => cmdConflicts(args),
        sync: () => cmdSync(),
        close: () => cmdClose(args),
        metrics: () => cmdMetrics(),
    };

    if (!commands[command]) {
        throw new Error(`Comando no soportado: ${command}`);
    }
    commands[command]();
}

try {
    main();
} catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
}
