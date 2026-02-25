'use strict';

function handleTaskList(ctx) {
    const {
        flags,
        args,
        wantsJson,
        parseBoard,
        parseCsvList,
        detectDefaultOwner,
        ACTIVE_STATUSES,
        getStatusCounts,
        getExecutorCounts,
        toTaskJson,
        printJson,
    } = ctx;
    const board = parseBoard();
    const limitRaw = String(flags.limit || '').trim();
    const limit = limitRaw === '' ? null : Number(limitRaw);
    if (limitRaw !== '' && (!Number.isFinite(limit) || limit <= 0)) {
        throw new Error('task ls --limit debe ser numero > 0');
    }

    const statusFilter = flags.status ? parseCsvList(flags.status) : [];
    const executorFilter = String(flags.executor || '')
        .trim()
        .toLowerCase();
    const mineOnly = args.includes('--mine');
    if (mineOnly && flags.owner) {
        throw new Error('task ls no permite combinar --mine con --owner');
    }
    const mineOwner = mineOnly ? detectDefaultOwner() : '';
    if (mineOnly && !mineOwner) {
        throw new Error(
            'task ls --mine requiere AGENT_OWNER/USERNAME/USER disponible'
        );
    }
    const ownerFilter = String(flags.owner || mineOwner || '')
        .trim()
        .toLowerCase();
    const scopeFilter = String(flags.scope || '')
        .trim()
        .toLowerCase();
    const riskFilter = String(flags.risk || '')
        .trim()
        .toLowerCase();
    const idFilter = String(flags.id || '')
        .trim()
        .toLowerCase();
    const activeOnly = args.includes('--active');

    const filtered = board.tasks.filter((task) => {
        const id = String(task.id || '').trim();
        const status = String(task.status || '').trim();
        const executor = String(task.executor || '')
            .trim()
            .toLowerCase();
        const owner = String(task.owner || '')
            .trim()
            .toLowerCase();
        const scope = String(task.scope || '')
            .trim()
            .toLowerCase();
        const risk = String(task.risk || '')
            .trim()
            .toLowerCase();

        if (idFilter && id.toLowerCase() !== idFilter) return false;
        if (activeOnly && !ACTIVE_STATUSES.has(status)) return false;
        if (statusFilter.length > 0 && !statusFilter.includes(status))
            return false;
        if (executorFilter && executor !== executorFilter) return false;
        if (ownerFilter && owner !== ownerFilter) return false;
        if (scopeFilter && !scope.includes(scopeFilter)) return false;
        if (riskFilter && risk !== riskFilter) return false;
        return true;
    });

    filtered.sort((a, b) => {
        const aUpdated = String(a.updated_at || '');
        const bUpdated = String(b.updated_at || '');
        const byUpdated = bUpdated.localeCompare(aUpdated);
        if (byUpdated !== 0) return byUpdated;
        return String(a.id || '').localeCompare(String(b.id || ''));
    });

    const limited =
        Number.isFinite(limit) && limit !== null
            ? filtered.slice(0, limit)
            : filtered;

    const report = {
        version: 1,
        ok: true,
        command: 'task',
        action: 'ls',
        filters: {
            active: activeOnly,
            status: statusFilter,
            executor: executorFilter || null,
            owner: ownerFilter || null,
            mine: mineOnly,
            scope: scopeFilter || null,
            risk: riskFilter || null,
            id: idFilter || null,
            limit: Number.isFinite(limit) && limit !== null ? limit : null,
        },
        summary: {
            total: board.tasks.length,
            matched: filtered.length,
            returned: limited.length,
            matched_active: filtered.filter((t) =>
                ACTIVE_STATUSES.has(String(t.status || ''))
            ).length,
            by_status: getStatusCounts(limited),
            by_executor: getExecutorCounts(limited),
        },
        tasks: limited.map(toTaskJson),
    };

    if (wantsJson) {
        printJson(report);
        return;
    }

    console.log('== Task List ==');
    console.log(
        `Matched: ${report.summary.matched}/${report.summary.total} (returned ${report.summary.returned})`
    );
    const filterParts = [];
    if (activeOnly) filterParts.push('active=true');
    if (statusFilter.length > 0)
        filterParts.push(`status=${statusFilter.join(',')}`);
    if (executorFilter) filterParts.push(`executor=${executorFilter}`);
    if (ownerFilter) filterParts.push(`owner=${ownerFilter}`);
    if (mineOnly) filterParts.push('mine=true');
    if (scopeFilter) filterParts.push(`scope~=${scopeFilter}`);
    if (riskFilter) filterParts.push(`risk=${riskFilter}`);
    if (idFilter) filterParts.push(`id=${idFilter}`);
    if (report.filters.limit !== null) filterParts.push(`limit=${limit}`);
    console.log(`Filters: ${filterParts.join(' | ') || '(none)'}`);
    for (const task of limited) {
        const filesCount = Array.isArray(task.files) ? task.files.length : 0;
        console.log(
            `- ${task.id} [${task.status}] exec=${task.executor} owner=${task.owner || 'n/a'} risk=${task.risk || 'n/a'} scope=${task.scope || 'n/a'} files=${filesCount}`
        );
    }
}

function formatBlockingConflictDetails(taskId, blockingConflicts) {
    return blockingConflicts
        .map((item) => {
            const other =
                String(item.left.id) === taskId ? item.right : item.left;
            const files = item.overlap_files.length
                ? item.overlap_files.join(', ')
                : '(wildcard ambiguo)';
            return `${taskId} <-> ${other.id} :: ${files}`;
        })
        .join(' | ');
}

function handleTaskClaim(ctx) {
    const {
        flags,
        wantsJson,
        taskId,
        ensureTask,
        parseBoard,
        detectDefaultOwner,
        ALLOWED_TASK_EXECUTORS,
        ALLOWED_STATUSES,
        parseCsvList,
        validateTaskGovernancePrechecks,
        ACTIVE_STATUSES,
        parseHandoffs,
        getBlockingConflictsForTask,
        currentDate,
        writeBoardAndSync,
        toTaskJson,
        printJson,
    } = ctx;

    const board = parseBoard();
    const task = ensureTask(board, taskId);

    const owner = detectDefaultOwner(task.owner);
    const ownerOverride = flags.owner ? String(flags.owner).trim() : owner;
    if (!ownerOverride) {
        throw new Error(
            'task claim requiere --owner o variable AGENT_OWNER/USERNAME/USER'
        );
    }
    task.owner = ownerOverride;

    if (flags.executor) {
        const nextExecutor = String(flags.executor).trim().toLowerCase();
        if (!ALLOWED_TASK_EXECUTORS.has(nextExecutor)) {
            throw new Error(`Executor invalido: ${nextExecutor}`);
        }
        task.executor = nextExecutor;
    }
    if (flags.status) {
        const nextStatus = String(flags.status).trim();
        if (!ALLOWED_STATUSES.has(nextStatus)) {
            throw new Error(`Status invalido: ${nextStatus}`);
        }
        task.status = nextStatus;
    }
    if (flags.files) {
        const files = parseCsvList(flags.files);
        if (files.length === 0) {
            throw new Error('task claim --files requiere lista CSV no vacia');
        }
        task.files = files;
    }

    validateTaskGovernancePrechecks(board, task, { allowSelf: true });

    if (ACTIVE_STATUSES.has(String(task.status || '').trim())) {
        const handoffData = parseHandoffs();
        const blockingConflicts = getBlockingConflictsForTask(
            board.tasks,
            taskId,
            handoffData.handoffs
        );
        if (blockingConflicts.length > 0) {
            throw new Error(
                `task claim bloqueado por conflicto activo: ${formatBlockingConflictDetails(
                    taskId,
                    blockingConflicts
                )}`
            );
        }
    }

    task.updated_at = currentDate();
    writeBoardAndSync(board, { silentSync: wantsJson });
    if (wantsJson) {
        printJson({
            version: 1,
            ok: true,
            command: 'task',
            action: 'claim',
            task: toTaskJson(task),
        });
        return;
    }
    console.log(
        `Task claim OK: ${taskId} owner=${task.owner} status=${task.status}`
    );
}

function handleTaskStart(ctx) {
    const {
        flags,
        wantsJson,
        taskId,
        ensureTask,
        parseBoard,
        detectDefaultOwner,
        ALLOWED_TASK_EXECUTORS,
        ACTIVE_STATUSES,
        parseCsvList,
        validateTaskGovernancePrechecks,
        parseHandoffs,
        getBlockingConflictsForTask,
        currentDate,
        writeBoardAndSync,
        toTaskJson,
        printJson,
    } = ctx;

    const board = parseBoard();
    const task = ensureTask(board, taskId);

    const nextStatus = String(flags.status || 'in_progress').trim();
    if (!ACTIVE_STATUSES.has(nextStatus)) {
        throw new Error(
            `task start requiere status activo (${Array.from(ACTIVE_STATUSES).join(', ')})`
        );
    }

    if (flags.owner) {
        task.owner = String(flags.owner).trim();
    } else if (String(task.owner || '').trim() === '') {
        task.owner = detectDefaultOwner(task.owner) || 'unassigned';
    }
    if (flags.executor) {
        const nextExecutor = String(flags.executor).trim().toLowerCase();
        if (!ALLOWED_TASK_EXECUTORS.has(nextExecutor)) {
            throw new Error(`Executor invalido: ${nextExecutor}`);
        }
        task.executor = nextExecutor;
    }
    if (flags.scope) {
        task.scope = String(flags.scope).trim();
    }
    if (flags.files) {
        const files = parseCsvList(flags.files);
        if (files.length === 0) {
            throw new Error('task start --files requiere lista CSV no vacia');
        }
        task.files = files;
    }

    task.status = nextStatus;
    task.updated_at = currentDate();

    validateTaskGovernancePrechecks(board, task, { allowSelf: true });

    const handoffData = parseHandoffs();
    const blockingConflicts = getBlockingConflictsForTask(
        board.tasks,
        taskId,
        handoffData.handoffs
    );
    if (blockingConflicts.length > 0) {
        throw new Error(
            `task start bloqueado por conflicto activo: ${formatBlockingConflictDetails(
                taskId,
                blockingConflicts
            )}`
        );
    }

    writeBoardAndSync(board, { silentSync: wantsJson });
    if (wantsJson) {
        printJson({
            version: 1,
            ok: true,
            command: 'task',
            action: 'start',
            task: toTaskJson(task),
        });
        return;
    }
    console.log(`Task start OK: ${taskId} -> ${nextStatus}`);
}

function handleTaskFinish(ctx) {
    const {
        flags,
        wantsJson,
        taskId,
        ensureTask,
        parseBoard,
        resolveTaskEvidencePath,
        existsSync,
        toRelativeRepoPath,
        currentDate,
        writeBoardAndSync,
        toTaskJson,
        printJson,
    } = ctx;

    const board = parseBoard();
    const task = ensureTask(board, taskId);

    const nextStatus = String(flags.to || flags.status || 'done').trim();
    if (!['done', 'failed'].includes(nextStatus)) {
        throw new Error(
            "task finish solo permite estados terminales 'done' o 'failed'"
        );
    }

    let evidencePath = null;
    if (nextStatus === 'done') {
        evidencePath = resolveTaskEvidencePath(taskId, flags);
        if (!existsSync(evidencePath)) {
            throw new Error(`No existe evidencia requerida: ${evidencePath}`);
        }
        task.acceptance_ref = toRelativeRepoPath(evidencePath);
    }

    task.status = nextStatus;
    task.updated_at = currentDate();
    writeBoardAndSync(board, { silentSync: wantsJson });

    if (wantsJson) {
        printJson({
            version: 1,
            ok: true,
            command: 'task',
            action: 'finish',
            task: toTaskJson(task),
            evidence_path: evidencePath
                ? toRelativeRepoPath(evidencePath)
                : null,
        });
        return;
    }

    console.log(`Task finish OK: ${taskId} -> ${nextStatus}`);
}

module.exports = {
    handleTaskList,
    handleTaskClaim,
    handleTaskStart,
    handleTaskFinish,
};
