'use strict';

function parseDateMs(value) {
    const ms = Date.parse(String(value || ''));
    return Number.isFinite(ms) ? ms : null;
}

function makeEventId(nowIso = new Date().toISOString(), random = Math.random) {
    const stamp = String(nowIso).replace(/[-:.TZ]/g, '');
    const suffix = Math.floor(random() * 0xffffff)
        .toString(16)
        .padStart(6, '0');
    return `evt_${stamp}_${suffix}`;
}

function toTaskEventSummary(task) {
    if (!task || typeof task !== 'object') return null;
    return {
        id: String(task.id || ''),
        owner: String(task.owner || ''),
        executor: String(task.executor || ''),
        status: String(task.status || ''),
        status_since_at: String(task.status_since_at || ''),
        scope: String(task.scope || ''),
        risk: String(task.risk || ''),
        files: Array.isArray(task.files) ? task.files.slice() : [],
        updated_at: String(task.updated_at || ''),
        acceptance_ref: String(task.acceptance_ref || ''),
        evidence_ref: String(task.evidence_ref || ''),
        lease_id: String(task.lease_id || ''),
        lease_owner: String(task.lease_owner || ''),
        heartbeat_at: String(task.heartbeat_at || ''),
        lease_expires_at: String(task.lease_expires_at || ''),
    };
}

function inferTaskEventType(beforeTask, afterTask) {
    if (!beforeTask && afterTask) return 'task_created';
    if (!afterTask) return null;
    const beforeStatus = String(beforeTask?.status || '')
        .trim()
        .toLowerCase();
    const afterStatus = String(afterTask?.status || '')
        .trim()
        .toLowerCase();
    if (beforeTask && beforeStatus !== afterStatus) {
        if (
            ['in_progress', 'review', 'blocked'].includes(afterStatus) &&
            !['in_progress', 'review', 'blocked'].includes(beforeStatus)
        ) {
            return 'task_started';
        }
        if (['done', 'failed'].includes(afterStatus)) {
            if (
                afterStatus === 'done' &&
                String(afterTask.acceptance_ref || '').trim()
            ) {
                return 'task_closed';
            }
            return 'task_finished';
        }
    }

    const beforeLease = String(beforeTask?.lease_id || '').trim();
    const afterLease = String(afterTask?.lease_id || '').trim();
    const beforeHeartbeat = String(beforeTask?.heartbeat_at || '').trim();
    const afterHeartbeat = String(afterTask?.heartbeat_at || '').trim();
    if (beforeLease && !afterLease) return 'lease_cleared';
    if (
        (afterLease && !beforeLease) ||
        (afterLease &&
            beforeLease === afterLease &&
            beforeHeartbeat !== afterHeartbeat)
    ) {
        return 'lease_heartbeat';
    }
    return null;
}

function diffBoardTaskEvents(prevBoard, nextBoard, options = {}) {
    const {
        command = 'board_write',
        source = 'cli',
        actor = '',
        nowIso = new Date().toISOString(),
    } = options;
    const prevMap = new Map(
        Array.isArray(prevBoard?.tasks)
            ? prevBoard.tasks.map((task) => [String(task.id || ''), task])
            : []
    );
    const nextMap = new Map(
        Array.isArray(nextBoard?.tasks)
            ? nextBoard.tasks.map((task) => [String(task.id || ''), task])
            : []
    );

    const ids = Array.from(
        new Set([...prevMap.keys(), ...nextMap.keys()])
    ).sort();
    const events = [];
    for (const taskId of ids) {
        const beforeTask = prevMap.get(taskId) || null;
        const afterTask = nextMap.get(taskId) || null;
        const eventType = inferTaskEventType(beforeTask, afterTask);
        if (!eventType) continue;
        const taskRef = afterTask || beforeTask;
        events.push({
            version: 1,
            event_id: makeEventId(nowIso),
            event_type: eventType,
            occurred_at: nowIso,
            actor: String(actor || taskRef?.owner || taskRef?.executor || ''),
            task_id: taskId,
            board_task_before: toTaskEventSummary(beforeTask),
            board_task_after: toTaskEventSummary(afterTask),
            lease:
                afterTask && String(afterTask.lease_id || '').trim()
                    ? {
                          lease_id: String(afterTask.lease_id || ''),
                          lease_owner: String(afterTask.lease_owner || ''),
                          heartbeat_at: String(afterTask.heartbeat_at || ''),
                          lease_expires_at: String(
                              afterTask.lease_expires_at || ''
                          ),
                      }
                    : null,
            reason: String(
                afterTask?.lease_reason || afterTask?.blocked_reason || ''
            ),
            command: String(command || 'board_write'),
            source: String(source || 'cli'),
            board_updated_at: String(nextBoard?.policy?.updated_at || ''),
            board_policy_revision:
                nextBoard?.policy &&
                Object.prototype.hasOwnProperty.call(
                    nextBoard.policy,
                    'revision'
                )
                    ? nextBoard.policy.revision
                    : null,
        });
    }
    return events;
}

function appendBoardEventsForDiff(prevBoard, nextBoard, options = {}) {
    const { appendJsonlFile, eventsPath } = options;
    if (typeof appendJsonlFile !== 'function') {
        throw new Error('appendBoardEventsForDiff requiere appendJsonlFile');
    }
    if (!eventsPath) {
        throw new Error('appendBoardEventsForDiff requiere eventsPath');
    }
    const events = diffBoardTaskEvents(prevBoard, nextBoard, options);
    if (events.length === 0) return { events, appended: 0 };
    const appended = appendJsonlFile(eventsPath, events).appended || 0;
    return { events, appended };
}

function parseBoardRevision(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function buildBoardEventsDriftReport(board, eventRows = []) {
    const currentRevision = parseBoardRevision(board?.policy?.revision);
    const rows = Array.isArray(eventRows) ? eventRows : [];
    const latestByTask = new Map();
    const revisionAheadRows = [];
    const taskStatusDrift = [];
    const currentTasks = new Map(
        Array.isArray(board?.tasks)
            ? board.tasks.map((task) => [String(task?.id || ''), task])
            : []
    );

    for (const row of rows) {
        const eventRevision = parseBoardRevision(row?.board_policy_revision);
        if (
            currentRevision !== null &&
            eventRevision !== null &&
            eventRevision > currentRevision
        ) {
            revisionAheadRows.push({
                event_id: String(row?.event_id || ''),
                task_id: String(row?.task_id || ''),
                board_policy_revision: eventRevision,
                current_board_revision: currentRevision,
                event_type: String(row?.event_type || ''),
            });
        }

        const taskId = String(row?.task_id || '').trim();
        if (!taskId) {
            continue;
        }
        latestByTask.set(taskId, row);
    }

    for (const [taskId, row] of latestByTask.entries()) {
        const eventType = String(row?.event_type || '').trim();
        if (!['task_closed', 'task_finished'].includes(eventType)) {
            continue;
        }
        const expectedStatus = String(row?.board_task_after?.status || '').trim();
        const currentStatus = String(currentTasks.get(taskId)?.status || '').trim();
        if (!expectedStatus || !currentStatus || expectedStatus === currentStatus) {
            continue;
        }
        taskStatusDrift.push({
            task_id: taskId,
            event_id: String(row?.event_id || ''),
            event_type: eventType,
            expected_status: expectedStatus,
            current_status: currentStatus,
        });
    }

    const errors = [
        ...revisionAheadRows.map(
            (row) =>
                `board_events_drift: ${row.event_id || row.task_id} referencia revision ${row.board_policy_revision} mayor que board.revision=${row.current_board_revision}`
        ),
        ...taskStatusDrift.map(
            (row) =>
                `board_events_drift: ${row.task_id} tiene ${row.event_type} en ledger con status=${row.expected_status}, pero el board actual muestra ${row.current_status}`
        ),
    ];

    return {
        version: 1,
        ok: errors.length === 0,
        error_count: errors.length,
        errors,
        current_board_revision: currentRevision,
        revision_ahead_rows: revisionAheadRows,
        task_status_drift: taskStatusDrift,
    };
}

function toHandoffEventSummary(handoff) {
    if (!handoff || typeof handoff !== 'object') return null;
    return {
        id: String(handoff.id || ''),
        status: String(handoff.status || ''),
        from_task: String(handoff.from_task || ''),
        to_task: String(handoff.to_task || ''),
        reason: String(handoff.reason || ''),
        files: Array.isArray(handoff.files) ? handoff.files.slice() : [],
        approved_by: String(handoff.approved_by || ''),
        created_at: String(handoff.created_at || ''),
        expires_at: String(handoff.expires_at || ''),
        closed_at: String(handoff.closed_at || ''),
        close_reason: String(handoff.close_reason || ''),
    };
}

function appendHandoffEvent(options = {}) {
    const {
        appendJsonlFile,
        eventsPath,
        eventType,
        handoff,
        actor = '',
        command = 'handoffs',
        source = 'cli',
        reason = '',
        nowIso = new Date().toISOString(),
        board = null,
    } = options;
    if (typeof appendJsonlFile !== 'function') {
        throw new Error('appendHandoffEvent requiere appendJsonlFile');
    }
    if (!eventsPath) {
        throw new Error('appendHandoffEvent requiere eventsPath');
    }
    const type = String(eventType || '').trim();
    if (!type) {
        throw new Error('appendHandoffEvent requiere eventType');
    }
    const event = {
        version: 1,
        event_id: makeEventId(nowIso),
        event_type: type,
        occurred_at: nowIso,
        actor: String(actor || handoff?.approved_by || ''),
        task_id: '',
        handoff_id: String(handoff?.id || ''),
        board_task_before: null,
        board_task_after: null,
        handoff: toHandoffEventSummary(handoff),
        lease: null,
        reason: String(
            reason || handoff?.close_reason || handoff?.reason || ''
        ),
        command: String(command || 'handoffs'),
        source: String(source || 'cli'),
        board_updated_at: String(board?.policy?.updated_at || ''),
        board_policy_revision:
            board?.policy &&
            Object.prototype.hasOwnProperty.call(board.policy, 'revision')
                ? board.policy.revision
                : null,
    };
    const appended = appendJsonlFile(eventsPath, [event]).appended || 0;
    return { event, appended };
}

function tailBoardEvents(options = {}) {
    const { eventsPath, readJsonlFile, limit = 20 } = options;
    if (typeof readJsonlFile !== 'function') {
        throw new Error('tailBoardEvents requiere readJsonlFile');
    }
    const rows = readJsonlFile(eventsPath);
    const n = Math.max(1, Number(limit) || 20);
    return rows.slice(-n);
}

function statsBoardEvents(options = {}) {
    const {
        eventsPath,
        readJsonlFile,
        days = 7,
        nowIso = new Date().toISOString(),
    } = options;
    if (typeof readJsonlFile !== 'function') {
        throw new Error('statsBoardEvents requiere readJsonlFile');
    }
    const nowMs = parseDateMs(nowIso) ?? Date.now();
    const daysLimit = Math.max(1, Number(days) || 7);
    const cutoff = nowMs - daysLimit * 24 * 60 * 60 * 1000;
    const rows = readJsonlFile(eventsPath).filter((row) => {
        const ms = parseDateMs(row?.occurred_at);
        return ms === null ? true : ms >= cutoff;
    });
    const byType = {};
    const byActor = {};
    const byTask = {};
    for (const row of rows) {
        const type = String(row?.event_type || 'unknown');
        const actor = String(row?.actor || 'unknown');
        const taskId = String(row?.task_id || '');
        byType[type] = (byType[type] || 0) + 1;
        byActor[actor] = (byActor[actor] || 0) + 1;
        if (taskId) byTask[taskId] = (byTask[taskId] || 0) + 1;
    }
    return {
        version: 1,
        ok: true,
        command: 'board events stats',
        days: daysLimit,
        total: rows.length,
        by_event_type: byType,
        by_actor: byActor,
        by_task: byTask,
    };
}

module.exports = {
    makeEventId,
    toTaskEventSummary,
    diffBoardTaskEvents,
    appendBoardEventsForDiff,
    buildBoardEventsDriftReport,
    appendHandoffEvent,
    tailBoardEvents,
    statsBoardEvents,
};
