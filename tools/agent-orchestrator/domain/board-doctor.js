'use strict';

const terminalEvidence = require('./evidence');

function parseDateMs(value) {
    const ms = Date.parse(String(value || ''));
    return Number.isFinite(ms) ? ms : null;
}

function hoursSince(value, nowMs) {
    const ms = parseDateMs(value);
    if (ms === null) return null;
    return (nowMs - ms) / (1000 * 60 * 60);
}

function normalizeDoctorPolicy(policy = null) {
    const cfg = policy?.enforcement?.board_doctor;
    const thresholds = {
        in_progress_stale_hours: 24,
        blocked_stale_hours: 24,
        review_stale_hours: 48,
        done_without_evidence_max_hours: 1,
        ...(cfg?.thresholds && typeof cfg.thresholds === 'object'
            ? cfg.thresholds
            : {}),
    };
    return {
        enabled: cfg?.enabled !== false,
        strict_default: Boolean(cfg?.strict_default),
        thresholds: {
            in_progress_stale_hours:
                Number(thresholds.in_progress_stale_hours) || 24,
            blocked_stale_hours: Number(thresholds.blocked_stale_hours) || 24,
            review_stale_hours: Number(thresholds.review_stale_hours) || 48,
            done_without_evidence_max_hours:
                Number(thresholds.done_without_evidence_max_hours) || 1,
        },
    };
}

function normalizeWipPolicy(policy = null) {
    const cfg = policy?.enforcement?.wip_limits;
    return {
        enabled: Boolean(cfg?.enabled),
        mode: String(cfg?.mode || 'warn')
            .trim()
            .toLowerCase(),
        count_statuses: Array.isArray(cfg?.count_statuses)
            ? cfg.count_statuses.map((s) =>
                  String(s || '')
                      .trim()
                      .toLowerCase()
              )
            : ['in_progress', 'review', 'blocked'],
        by_executor:
            cfg?.by_executor && typeof cfg.by_executor === 'object'
                ? cfg.by_executor
                : {},
        by_scope:
            cfg?.by_scope && typeof cfg.by_scope === 'object'
                ? cfg.by_scope
                : {},
    };
}

function buildBoardDoctorReport(input = {}, deps = {}) {
    const {
        board = null,
        policy = null,
        leasePolicy = null,
        handoffData = null,
        conflictAnalysis = null,
        now = new Date(),
    } = input;
    const {
        getTaskLeaseSummary = () => ({ has_lease: false, expired: false }),
        makeDiagnostic = (v) => v,
        getWarnPolicyMap = () => ({}),
        warnPolicyEnabled = () => false,
        warnPolicySeverity = () => 'warning',
        isBroadGlobPath = () => false,
    } = deps;

    const nowMs = now instanceof Date ? now.getTime() : Date.now();
    const nowIso =
        now instanceof Date ? now.toISOString() : new Date().toISOString();
    const doctorCfg = normalizeDoctorPolicy(policy);
    const wipCfg = normalizeWipPolicy(policy);
    const warnPolicyMap = getWarnPolicyMap(policy);
    const tasks = Array.isArray(board?.tasks) ? board.tasks : [];
    const evidenceReport = terminalEvidence.buildTerminalEvidenceReport(tasks, {
        rootDir: input.rootDir,
        evidenceDir: input.evidenceDir,
    });
    const evidenceRows = new Map(
        evidenceReport.rows.map((row) => [String(row.id || ''), row])
    );
    const diagnostics = [];
    const checks = [];
    const heartbeatStaleMinutes = Number(
        leasePolicy?.heartbeat_stale_minutes || 30
    );

    function addCheck(code, pass, message, extra = {}) {
        checks.push({ code, pass: Boolean(pass), message, ...extra });
        if (!pass) {
            diagnostics.push(
                makeDiagnostic({
                    code,
                    severity:
                        extra.severity ||
                        warnPolicySeverity(
                            warnPolicyMap,
                            code.replace(/^warn\.board\./, '')
                        ),
                    source: 'board doctor',
                    message,
                    ...(extra.task_ids ? { task_ids: extra.task_ids } : {}),
                    ...(extra.files ? { files: extra.files } : {}),
                    ...(extra.meta ? { meta: extra.meta } : {}),
                })
            );
        }
    }

    if (!doctorCfg.enabled) {
        return {
            version: 1,
            ok: true,
            command: 'board doctor',
            disabled: true,
            summary: { total_tasks: tasks.length, findings: 0 },
            checks: [],
            diagnostics: [],
            warnings_count: 0,
            errors_count: 0,
        };
    }

    for (const task of tasks) {
        const status = String(task.status || '')
            .trim()
            .toLowerCase();
        const taskId = String(task.id || '');
        const lease = getTaskLeaseSummary(task, { nowIso });
        const statusSinceHours = hoursSince(
            task.status_since_at || task.updated_at,
            nowMs
        );

        if (
            warnPolicyEnabled(warnPolicyMap, 'lease_missing_active') &&
            ['in_progress', 'review'].includes(status)
        ) {
            addCheck(
                'warn.board.lease_missing_active',
                lease.has_lease,
                `Task ${taskId} (${status}) sin lease activo`,
                { task_ids: [taskId] }
            );
        }

        if (
            warnPolicyEnabled(warnPolicyMap, 'lease_expired_active') &&
            ['in_progress', 'review', 'blocked'].includes(status) &&
            lease.has_lease
        ) {
            addCheck(
                'warn.board.lease_expired_active',
                lease.expired !== true,
                `Task ${taskId} tiene lease expirado`,
                { task_ids: [taskId] }
            );
        }

        if (
            warnPolicyEnabled(warnPolicyMap, 'heartbeat_stale') &&
            status === 'in_progress' &&
            lease.has_lease
        ) {
            const staleMinutes = Number(
                leasePolicy?.heartbeat_stale_minutes || 30
            );
            addCheck(
                'warn.board.heartbeat_stale',
                lease.heartbeat_age_minutes === null ||
                    lease.heartbeat_age_minutes <= staleMinutes,
                `Task ${taskId} heartbeat stale (${lease.heartbeat_age_minutes ?? 'n/a'}m > ${staleMinutes}m)`,
                {
                    task_ids: [taskId],
                    meta: {
                        heartbeat_age_minutes: lease.heartbeat_age_minutes,
                        threshold_minutes: staleMinutes,
                    },
                }
            );
        }

        if (
            warnPolicyEnabled(warnPolicyMap, 'task_in_progress_stale') &&
            status === 'in_progress'
        ) {
            const threshold = doctorCfg.thresholds.in_progress_stale_hours;
            const hasFreshHeartbeat =
                lease.has_lease &&
                lease.heartbeat_age_minutes !== null &&
                lease.heartbeat_age_minutes <= heartbeatStaleMinutes;
            addCheck(
                'warn.board.in_progress_stale',
                statusSinceHours === null ||
                    statusSinceHours <= threshold ||
                    hasFreshHeartbeat,
                `Task ${taskId} in_progress stale (${statusSinceHours === null ? 'n/a' : statusSinceHours.toFixed(1)}h > ${threshold}h)`,
                {
                    task_ids: [taskId],
                    meta: {
                        status_since_hours:
                            statusSinceHours === null
                                ? null
                                : Number(statusSinceHours.toFixed(2)),
                        threshold_hours: threshold,
                        heartbeat_age_minutes: lease.heartbeat_age_minutes,
                        heartbeat_stale_minutes: heartbeatStaleMinutes,
                        heartbeat_fresh: hasFreshHeartbeat,
                    },
                }
            );
        }

        if (
            warnPolicyEnabled(warnPolicyMap, 'task_blocked_stale') &&
            status === 'blocked'
        ) {
            const threshold = doctorCfg.thresholds.blocked_stale_hours;
            addCheck(
                'warn.board.blocked_stale',
                statusSinceHours === null || statusSinceHours <= threshold,
                `Task ${taskId} blocked stale (${statusSinceHours === null ? 'n/a' : statusSinceHours.toFixed(1)}h > ${threshold}h)`,
                { task_ids: [taskId] }
            );
        }

        if (status === 'blocked') {
            addCheck(
                'warn.board.blocked_without_reason',
                Boolean(String(task.blocked_reason || '').trim()),
                `Task ${taskId} blocked sin blocked_reason`,
                { task_ids: [taskId] }
            );
        }

        if (
            warnPolicyEnabled(warnPolicyMap, 'done_without_evidence') &&
            ['done', 'failed'].includes(status)
        ) {
            const evidenceRow =
                evidenceRows.get(taskId) ||
                terminalEvidence.analyzeTerminalTaskEvidence(task, {
                    rootDir: input.rootDir,
                    evidenceDir: input.evidenceDir,
                });
            addCheck(
                'warn.board.done_without_evidence',
                evidenceRow.debt !== true,
                terminalEvidence.buildTerminalEvidenceMessage(evidenceRow, {
                    includeRefs: evidenceRow.debt === true,
                }),
                {
                    task_ids: [taskId],
                    meta: terminalEvidence.buildTerminalEvidenceMeta(
                        evidenceRow
                    ),
                }
            );
        }

        if (
            status === 'blocked' &&
            Array.isArray(task.depends_on) &&
            task.depends_on.length > 0
        ) {
            const dependencies = task.depends_on
                .map((id) =>
                    tasks.find((t) => String(t.id || '') === String(id))
                )
                .filter(Boolean);
            if (
                dependencies.length > 0 &&
                dependencies.every((dep) =>
                    ['done', 'failed'].includes(
                        String(dep.status || '')
                            .trim()
                            .toLowerCase()
                    )
                )
            ) {
                addCheck(
                    'warn.board.depends_on_unresolved_blocked',
                    false,
                    `Task ${taskId} sigue blocked pero depends_on ya terminal`,
                    { task_ids: [taskId] }
                );
            }
        }

        const broadFiles = (Array.isArray(task.files) ? task.files : []).filter(
            (f) => isBroadGlobPath(f)
        );
        if (
            ['ready', 'in_progress', 'review', 'blocked'].includes(status) &&
            broadFiles.length > 0
        ) {
            addCheck(
                'warn.board.active_broad_glob',
                false,
                `Task ${taskId} activa con glob amplio`,
                { task_ids: [taskId], files: broadFiles }
            );
        }
    }

    if (wipCfg.enabled && wipCfg.mode !== 'ignore') {
        const countStatuses = new Set(wipCfg.count_statuses || []);
        const activeWipTasks = tasks.filter((task) =>
            countStatuses.has(
                String(task.status || '')
                    .trim()
                    .toLowerCase()
            )
        );

        const byExecutorCount = {};
        for (const task of activeWipTasks) {
            const executor =
                String(task.executor || '')
                    .trim()
                    .toLowerCase() || 'unknown';
            byExecutorCount[executor] = (byExecutorCount[executor] || 0) + 1;
        }
        for (const [executor, count] of Object.entries(byExecutorCount)) {
            const rawLimit = wipCfg.by_executor?.[executor];
            const limit = Number(rawLimit);
            if (!Number.isFinite(limit) || limit <= 0) continue;
            addCheck(
                'warn.board.wip_limit_executor',
                count <= limit,
                `WIP executor ${executor} excede limite (${count}/${limit})`,
                {
                    severity: wipCfg.mode === 'error' ? 'error' : 'warning',
                    meta: { executor, count, limit },
                }
            );
        }

        const byScopeCount = {};
        for (const task of activeWipTasks) {
            const scope =
                String(task.scope || '')
                    .trim()
                    .toLowerCase() || 'default';
            byScopeCount[scope] = (byScopeCount[scope] || 0) + 1;
        }
        for (const [scope, count] of Object.entries(byScopeCount)) {
            const rawLimit = Object.prototype.hasOwnProperty.call(
                wipCfg.by_scope || {},
                scope
            )
                ? wipCfg.by_scope[scope]
                : wipCfg.by_scope?.default;
            const limit = Number(rawLimit);
            if (!Number.isFinite(limit) || limit <= 0) continue;
            addCheck(
                'warn.board.wip_limit_scope',
                count <= limit,
                `WIP scope ${scope} excede limite (${count}/${limit})`,
                {
                    severity: wipCfg.mode === 'error' ? 'error' : 'warning',
                    meta: { scope, count, limit },
                }
            );
        }
    }

    const leaseRows = tasks
        .map((task) => ({
            task_id: String(task.id || ''),
            status: String(task.status || ''),
            lease: getTaskLeaseSummary(task, { nowIso }),
        }))
        .filter(
            (row) =>
                ['in_progress', 'review', 'blocked'].includes(
                    String(row.status).toLowerCase()
                ) || row.lease.has_lease
        );

    const blockingConflicts = Number(conflictAnalysis?.blocking?.length || 0);
    const handoffConflicts = Number(
        conflictAnalysis?.handoffCovered?.length || 0
    );
    const activeExpiredHandoffs = Array.isArray(handoffData?.handoffs)
        ? handoffData.handoffs.filter((h) => {
              if (String(h.status || '').toLowerCase() !== 'active')
                  return false;
              const expiresMs = parseDateMs(h.expires_at);
              return expiresMs !== null && expiresMs < nowMs;
          }).length
        : 0;

    return {
        version: 1,
        ok: true,
        command: 'board doctor',
        summary: {
            total_tasks: tasks.length,
            checks: checks.length,
            findings: diagnostics.length,
            blocking_conflicts: blockingConflicts,
            handoff_conflicts: handoffConflicts,
            active_expired_handoffs: activeExpiredHandoffs,
            lease_tracked_tasks: leaseRows.length,
        },
        evidence_summary: evidenceReport.summary,
        checks,
        diagnostics,
    };
}

module.exports = {
    buildBoardDoctorReport,
    normalizeDoctorPolicy,
    normalizeWipPolicy,
};
