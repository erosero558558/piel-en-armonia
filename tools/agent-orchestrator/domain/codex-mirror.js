'use strict';

function buildCodexActiveComment(block, deps = {}) {
    const {
        serializeArrayInline = (values) =>
            JSON.stringify(Array.isArray(values) ? values : []),
        currentDate = () => '',
    } = deps;
    if (!block) return '';
    const lines = [];
    lines.push('<!-- CODEX_ACTIVE');
    lines.push(`block: ${block.block || 'C1'}`);
    lines.push(`task_id: ${block.task_id}`);
    lines.push(`status: ${block.status}`);
    lines.push(`files: ${serializeArrayInline(block.files || [])}`);
    lines.push(`updated_at: ${block.updated_at || currentDate()}`);
    lines.push('-->');
    return lines.join('\n');
}

function upsertCodexActiveBlock(planRaw, block, deps = {}) {
    const {
        buildComment = (b) => buildCodexActiveComment(b, deps),
        anchorText = 'Relacion con Operativo 2026:',
    } = deps;
    const regex = /<!--\s*CODEX_ACTIVE\s*\n[\s\S]*?-->\s*/g;
    const withoutBlocks = String(planRaw || '').replace(regex, '');
    if (!block) {
        return withoutBlocks.replace(/\n{3,}/g, '\n\n');
    }

    const comment = `${buildComment(block)}\n\n`;
    const anchorIndex = withoutBlocks.indexOf(anchorText);
    if (anchorIndex === -1) {
        return `${comment}${withoutBlocks}`.replace(/\n{3,}/g, '\n\n');
    }
    const lineEnd = withoutBlocks.indexOf('\n', anchorIndex);
    if (lineEnd === -1) {
        return `${withoutBlocks}\n\n${comment}`.replace(/\n{3,}/g, '\n\n');
    }
    return (
        withoutBlocks.slice(0, lineEnd + 1) +
        '\n' +
        comment +
        withoutBlocks.slice(lineEnd + 1)
    ).replace(/\n{3,}/g, '\n\n');
}

function buildCodexCheckReport(input = {}, deps = {}) {
    const {
        board,
        blocks,
        handoffs,
        codexPlanPath = 'PLAN_MAESTRO_CODEX_2026.md',
    } = input;
    const { normalizePathToken, activeStatuses, isExpired } = deps;
    const tasks = Array.isArray(board?.tasks) ? board.tasks : [];
    const codexBlocks = Array.isArray(blocks) ? blocks : [];
    const safeHandoffs = Array.isArray(handoffs) ? handoffs : [];
    const isExpiredFn =
        typeof isExpired === 'function'
            ? isExpired
            : (value) => {
                  const parsed = Date.parse(String(value || ''));
                  if (!Number.isFinite(parsed)) return true;
                  return parsed <= Date.now();
              };
    const errors = [];
    const codexTasks = tasks.filter((task) =>
        /^CDX-\d+$/.test(String(task.id || ''))
    );
    const codexInProgress = codexTasks.filter(
        (task) => task.status === 'in_progress'
    );
    const activeCodexTasks = codexTasks.filter((task) =>
        activeStatuses.has(task.status)
    );
    const codexExecutionTasks = tasks.filter(
        (task) =>
            String(task?.executor || '')
                .trim()
                .toLowerCase() === 'codex'
    );
    const codexInProgressByInstance = codexExecutionTasks
        .filter((task) => String(task?.status || '') === 'in_progress')
        .reduce((acc, task) => {
            const key = String(task?.codex_instance || 'codex_backend_ops')
                .trim()
                .toLowerCase();
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});

    if (codexInProgress.length > 1) {
        errors.push(
            `Mas de un CDX in_progress (${codexInProgress.map((t) => t.id).join(', ')})`
        );
    }

    for (const [instance, count] of Object.entries(codexInProgressByInstance)) {
        if (count > 1) {
            errors.push(
                `Mas de una tarea in_progress para ${instance} (${count})`
            );
        }
    }

    for (const task of tasks) {
        const taskId = String(task?.id || '');
        const runtimeImpact = String(task?.runtime_impact || '')
            .trim()
            .toLowerCase();
        const isCritical =
            Boolean(task?.critical_zone) || runtimeImpact === 'high';
        if (
            isCritical &&
            String(task?.codex_instance || 'codex_backend_ops')
                .trim()
                .toLowerCase() !== 'codex_backend_ops'
        ) {
            errors.push(
                `${taskId || '(sin id)'}: critical_zone/runtime high requiere codex_instance=codex_backend_ops`
            );
        }
    }

    const activeCrossDomainTasks = tasks.filter(
        (task) =>
            Boolean(task?.cross_domain) &&
            activeStatuses.has(String(task?.status || '').trim())
    );
    for (const task of activeCrossDomainTasks) {
        const taskId = String(task?.id || '');
        const hasActiveHandoff = safeHandoffs.some((handoff) => {
            if (String(handoff?.status || '').toLowerCase() !== 'active')
                return false;
            if (isExpiredFn(handoff?.expires_at)) return false;
            return (
                String(handoff?.from_task || '') === taskId ||
                String(handoff?.to_task || '') === taskId
            );
        });
        if (!hasActiveHandoff) {
            errors.push(
                `${taskId || '(sin id)'}: cross_domain activo requiere handoff activo`
            );
        }
    }

    if (codexBlocks.length > 1) {
        errors.push(`Mas de un bloque CODEX_ACTIVE en ${codexPlanPath}`);
    }

    if (codexBlocks.length === 0) {
        if (activeCodexTasks.length > 0) {
            errors.push(
                `Hay tareas CDX activas sin bloque CODEX_ACTIVE: ${activeCodexTasks
                    .map((task) => task.id)
                    .join(', ')}`
            );
        }
    } else {
        const block = codexBlocks[0];
        const taskId = String(block.task_id || '').trim();
        const blockStatus = String(block.status || '').trim();
        const blockFiles = Array.isArray(block.files)
            ? block.files.map(normalizePathToken)
            : [];
        const task = tasks.find((item) => String(item.id) === taskId);

        if (!taskId) {
            errors.push('CODEX_ACTIVE.task_id vacio');
        }
        if (!/^CDX-\d+$/.test(taskId)) {
            errors.push(`CODEX_ACTIVE.task_id invalido (${taskId || 'vacio'})`);
        }
        if (!task) {
            errors.push(
                `CODEX_ACTIVE.task_id no existe en board: ${taskId || 'vacio'}`
            );
        } else {
            if (String(task.executor) !== 'codex') {
                errors.push(
                    `${task.id}: executor debe ser codex (actual: ${task.executor})`
                );
            }
            if (blockStatus !== String(task.status)) {
                errors.push(
                    `${task.id}: status desalineado plan(${blockStatus || 'vacio'}) != board(${task.status})`
                );
            }
            const boardFiles = new Set(
                (task.files || []).map(normalizePathToken)
            );
            for (const file of blockFiles) {
                if (!boardFiles.has(file)) {
                    errors.push(
                        `${task.id}: file del bloque CODEX_ACTIVE no reservado en board (${file})`
                    );
                }
            }
        }

        if (activeCodexTasks.length === 0 && activeStatuses.has(blockStatus)) {
            errors.push(
                'CODEX_ACTIVE indica tarea activa pero no hay CDX activo en board'
            );
        }
    }

    const activeBlock = codexBlocks[0] || null;
    const activeBlockTaskId = activeBlock
        ? String(activeBlock.task_id || '').trim()
        : '';
    const activeBlockTask = activeBlockTaskId
        ? tasks.find((item) => String(item.id) === activeBlockTaskId) || null
        : null;

    return {
        version: 1,
        ok: errors.length === 0,
        error_count: errors.length,
        errors,
        summary: {
            codex_tasks_total: codexTasks.length,
            codex_executor_tasks_total: codexExecutionTasks.length,
            codex_in_progress: codexInProgress.length,
            codex_active: activeCodexTasks.length,
            plan_blocks: codexBlocks.length,
            codex_in_progress_by_instance: codexInProgressByInstance,
        },
        codex_task_ids: codexTasks.map((task) => String(task.id)),
        codex_in_progress_ids: codexInProgress.map((task) => String(task.id)),
        codex_active_ids: activeCodexTasks.map((task) => String(task.id)),
        plan_block: activeBlock
            ? {
                  block: String(activeBlock.block || ''),
                  task_id: String(activeBlock.task_id || ''),
                  status: String(activeBlock.status || ''),
                  files: Array.isArray(activeBlock.files)
                      ? activeBlock.files
                      : [],
                  updated_at: String(activeBlock.updated_at || ''),
              }
            : null,
        board_task_for_plan_block: activeBlockTask
            ? {
                  id: String(activeBlockTask.id || ''),
                  executor: String(activeBlockTask.executor || ''),
                  status: String(activeBlockTask.status || ''),
                  files: Array.isArray(activeBlockTask.files)
                      ? activeBlockTask.files
                      : [],
              }
            : null,
    };
}

module.exports = {
    buildCodexActiveComment,
    upsertCodexActiveBlock,
    buildCodexCheckReport,
};
