'use strict';

const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('fs');
const crypto = require('crypto');
const path = require('path');
const { spawnSync } = require('child_process');
const { resolve } = path;

const ACTIVE_TASK_STATUSES = new Set([
    'ready',
    'in_progress',
    'review',
    'blocked',
]);
const ALLOWED_FOCUS_STATUSES = new Set(['active', 'closed']);
const ALLOWED_WORK_TYPES = new Set([
    'forward',
    'support',
    'fix',
    'refactor',
    'decision',
    'evidence',
]);
const ALLOWED_INTEGRATION_SLICES = new Set([
    'frontend_runtime',
    'backend_readiness',
    'runtime_support',
    'ops_deploy',
    'desktop_shells',
    'tests_quality',
    'governance_evidence',
]);
const LANE_ALLOWED_SLICES = {
    codex_frontend: new Set([
        'frontend_runtime',
        'desktop_shells',
        'tests_quality',
        'governance_evidence',
    ]),
    codex_backend_ops: new Set([
        'backend_readiness',
        'ops_deploy',
        'tests_quality',
        'governance_evidence',
    ]),
    codex_transversal: new Set([
        'runtime_support',
        'tests_quality',
        'governance_evidence',
    ]),
};

const ACKNOWLEDGED_EXTERNAL_BLOCKED_REASON_PATTERNS = [
    /no_host_access/i,
    /host_.*502/i,
    /host_.*unreachable/i,
    /host_side_runtime_mismatch/i,
    /operator_auth.*502/i,
    /publicsync.*no_host_access/i,
    /remote_verification_pending/i,
];
const FRONTEND_REQUIRED_CHECK_TYPES = new Set(['content', 'audit', 'test']);
const LOCAL_REQUIRED_CHECK_TYPES = FRONTEND_REQUIRED_CHECK_TYPES;
const LOCAL_REQUIRED_CHECK_SNAPSHOT_VERSION = 1;
const REQUIRED_CHECKS_SNAPSHOT_VERSION = 1;
const REQUIRED_CHECKS_SNAPSHOT_DIRNAME = '.codex-local/focus-required-checks';
const LOCAL_REQUIRED_CHECK_ID_ALIASES = {
    'audit:public:v6:copy': 'audit:public-v6:copy',
};
const FRONTEND_REQUIRED_CHECK_SCRIPT_OVERRIDES = {
    'audit:public-v6:copy': 'audit:public:v6:copy',
};
const EVIDENCE_REQUIRED_CHECK_STATUSES = new Set(['review', 'done']);
const EVIDENCE_REQUIRED_CHECK_SUBFRONT_IDS_BY_FOCUS = Object.freeze({
    'FOCUS-2026-03-public-v6-es-voz-cut-1': ['SF-frontend-public-v6-es-copy'],
    'FOCUS-2026-03-admin-shell-rc2-polish-cut-1': [
        'SF-frontend-admin-shell-rc2',
    ],
    'FOCUS-2026-03-turnero-web-pilot-cut-1': [
        'SF-frontend-turnero-web-pilot',
        'SF-backend-turnero-web-pilot',
    ],
    'FOCUS-2026-03-turnero-web-pilot-local-cut-1': [
        'SF-frontend-turnero-web-pilot-local',
        'SF-backend-turnero-web-pilot-local',
    ],
    'FOCUS-2026-03-turnero-web-pilot-multi-clinic-cut-1': [
        'SF-frontend-turnero-web-pilot-multi-clinic',
        'SF-backend-turnero-web-pilot-multi-clinic',
    ],
});
const REQUIRED_CHECK_EVIDENCE_PATTERN =
    /^\s*-\s*required_check:\s*([^|]+?)\s*\|\s*state:\s*(green|red)\s*\|\s*command:\s*(.+?)\s*$/gim;
let cachedWorkspaceDomain = null;

function getWorkspaceDomain() {
    if (!cachedWorkspaceDomain) {
        cachedWorkspaceDomain = require('./workspace');
    }
    return cachedWorkspaceDomain;
}

function resolveFocusCheckSnapshotPath(focusId, options = {}) {
    const rootPath =
        String(options.rootPath || process.cwd()).trim() || process.cwd();
    return resolve(
        rootPath,
        'verification',
        'focus-checks',
        `${String(focusId || '').trim()}.json`
    );
}

function normalizeOptionalToken(value) {
    return String(value || '')
        .trim()
        .toLowerCase();
}

function isAcknowledgedExternalBlockedTask(task = {}) {
    if (normalizeOptionalToken(task?.status) !== 'blocked') {
        return false;
    }
    const blockedReason = String(task?.blocked_reason || '').trim();
    if (!blockedReason) return false;
    return ACKNOWLEDGED_EXTERNAL_BLOCKED_REASON_PATTERNS.some((pattern) =>
        pattern.test(blockedReason)
    );
}

function isAllowedExternalBlockerCarryoverTask(task = {}, focus = null) {
    void focus;
    return isAcknowledgedExternalBlockedTask(task);
}

function normalizeArray(values, options = {}) {
    const { lowerCase = false } = options;
    const list = Array.isArray(values) ? values : values ? [values] : [];
    return list
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .map((value) => (lowerCase ? value.toLowerCase() : value));
}

function normalizeFocusStatus(value) {
    const status = normalizeOptionalToken(value);
    if (!status) return '';
    return ALLOWED_FOCUS_STATUSES.has(status) ? status : status;
}

function getEvidenceRequiredCheckSubfrontIds(focusId) {
    const safeFocusId = String(focusId || '').trim();
    const configured =
        EVIDENCE_REQUIRED_CHECK_SUBFRONT_IDS_BY_FOCUS[safeFocusId];
    return Array.isArray(configured)
        ? configured.map((item) => String(item || '').trim()).filter(Boolean)
        : [];
}

function normalizeFocusMaxActiveSlices(value, fallback = 3) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeStrategyFocus(strategy) {
    if (!strategy || typeof strategy !== 'object') return null;
    const focusId = String(strategy.focus_id || '').trim();
    const focusStatus = normalizeFocusStatus(strategy.focus_status);
    if (
        !focusId &&
        !focusStatus &&
        !String(strategy.focus_proof || '').trim() &&
        !String(strategy.focus_next_step || '').trim()
    ) {
        return null;
    }
    return {
        id: focusId,
        title: String(strategy.focus_title || '').trim(),
        summary: String(strategy.focus_summary || '').trim(),
        status: focusStatus || 'active',
        proof: String(strategy.focus_proof || '').trim(),
        steps: normalizeArray(strategy.focus_steps),
        next_step: String(strategy.focus_next_step || '').trim(),
        required_checks: normalizeArray(strategy.focus_required_checks, {
            lowerCase: true,
        }),
        non_goals: normalizeArray(strategy.focus_non_goals),
        owner: String(strategy.focus_owner || '').trim(),
        review_due_at: String(strategy.focus_review_due_at || '').trim(),
        evidence_ref: String(strategy.focus_evidence_ref || '').trim(),
        max_active_slices: normalizeFocusMaxActiveSlices(
            strategy.focus_max_active_slices,
            3
        ),
    };
}

function getConfiguredFocus(board) {
    return normalizeStrategyFocus(board?.strategy?.active || null);
}

function getActiveFocus(board) {
    const focus = getConfiguredFocus(board);
    if (!focus || focus.status !== 'active') return null;
    return focus;
}

function normalizeTaskFocusFields(task) {
    if (!task || typeof task !== 'object') return task;
    task.focus_id = String(task.focus_id || '').trim();
    task.focus_step = String(task.focus_step || '').trim();
    task.integration_slice = normalizeOptionalToken(task.integration_slice);
    task.work_type = normalizeOptionalToken(task.work_type);
    task.expected_outcome = String(task.expected_outcome || '').trim();
    task.decision_ref = String(task.decision_ref || '').trim();
    task.rework_parent = String(task.rework_parent || '').trim();
    task.rework_reason = String(task.rework_reason || '').trim();
    return task;
}

function getAllowedSlicesForLane(task = {}) {
    const codexInstance = normalizeOptionalToken(task.codex_instance);
    if (LANE_ALLOWED_SLICES[codexInstance]) {
        return LANE_ALLOWED_SLICES[codexInstance];
    }
    const domainLane = normalizeOptionalToken(task.domain_lane);
    if (domainLane === 'frontend_content') {
        return LANE_ALLOWED_SLICES.codex_frontend;
    }
    if (domainLane === 'transversal_runtime') {
        return LANE_ALLOWED_SLICES.codex_transversal;
    }
    return LANE_ALLOWED_SLICES.codex_backend_ops;
}

function ensureTaskFocusDefaults(board, task, options = {}) {
    if (!task || typeof task !== 'object') return task;
    const activeStatuses = options.activeStatuses || ACTIVE_TASK_STATUSES;
    normalizeTaskFocusFields(task);
    const focus = getActiveFocus(board);
    const status = String(task.status || '').trim();
    if (!focus || !activeStatuses.has(status)) return task;
    if (!task.focus_id) {
        task.focus_id = focus.id;
    }
    if (!task.focus_step) {
        task.focus_step = focus.next_step;
    }
    if (!task.work_type) {
        task.work_type = 'forward';
    }
    return task;
}

function validateFocusConfiguration(board) {
    const focus = getConfiguredFocus(board);
    if (!focus) {
        return [];
    }
    const subfronts = Array.isArray(board?.strategy?.active?.subfronts)
        ? board.strategy.active.subfronts
        : [];
    const governanceOnlyStrategy =
        subfronts.length > 0 &&
        subfronts.every(
            (subfront) =>
                normalizeOptionalToken(subfront?.codex_instance) ===
                'codex_transversal'
        );
    const errors = [];
    if (!focus.id) errors.push('strategy.active requiere focus_id');
    if (!focus.title) errors.push('strategy.active requiere focus_title');
    if (!ALLOWED_FOCUS_STATUSES.has(focus.status)) {
        errors.push(
            `strategy.active tiene focus_status invalido (${focus.status || 'vacio'})`
        );
    }
    if (!focus.proof) errors.push('strategy.active requiere focus_proof');
    if (focus.steps.length === 0) {
        errors.push('strategy.active requiere focus_steps no vacio');
    }
    if (!focus.next_step) {
        errors.push('strategy.active requiere focus_next_step');
    }
    if (
        focus.next_step &&
        focus.steps.length > 0 &&
        !focus.steps.includes(focus.next_step)
    ) {
        errors.push(
            `strategy.active.focus_next_step fuera de focus_steps (${focus.next_step})`
        );
    }
    if (!governanceOnlyStrategy && focus.required_checks.length === 0) {
        errors.push('strategy.active requiere focus_required_checks no vacio');
    }
    if (!focus.owner) errors.push('strategy.active requiere focus_owner');
    if (!focus.review_due_at) {
        errors.push('strategy.active requiere focus_review_due_at');
    }
    return errors;
}

function validateTaskFocusAlignment(board, task, options = {}) {
    const activeStatuses = options.activeStatuses || ACTIVE_TASK_STATUSES;
    const decisionsData =
        options.decisionsData && typeof options.decisionsData === 'object'
            ? options.decisionsData
            : { decisions: [] };
    const focus = getActiveFocus(board);
    const status = String(task?.status || '').trim();
    if (!focus || !activeStatuses.has(status)) {
        return { focus };
    }

    ensureTaskFocusDefaults(board, task, { activeStatuses });
    const taskId = String(task?.id || '(sin id)').trim();
    if (!task.focus_id) {
        throw new Error(`task ${taskId}: foco activo requiere focus_id`);
    }
    if (task.focus_id !== focus.id) {
        throw new Error(
            `task ${taskId}: focus_id desalineado (${task.focus_id} != ${focus.id})`
        );
    }
    if (!task.focus_step) {
        throw new Error(`task ${taskId}: foco activo requiere focus_step`);
    }
    if (task.focus_step !== focus.next_step) {
        throw new Error(
            `task ${taskId}: focus_step fuera de focus_next_step (${task.focus_step} != ${focus.next_step})`
        );
    }
    if (!task.work_type) {
        throw new Error(`task ${taskId}: foco activo requiere work_type`);
    }
    if (!ALLOWED_WORK_TYPES.has(task.work_type)) {
        throw new Error(
            `task ${taskId}: work_type invalido (${task.work_type || 'vacio'})`
        );
    }
    if (!task.integration_slice) {
        throw new Error(
            `task ${taskId}: foco activo requiere integration_slice`
        );
    }
    if (!ALLOWED_INTEGRATION_SLICES.has(task.integration_slice)) {
        throw new Error(
            `task ${taskId}: integration_slice invalido (${task.integration_slice})`
        );
    }
    const allowedSlices = getAllowedSlicesForLane(task);
    if (!allowedSlices.has(task.integration_slice)) {
        throw new Error(
            `task ${taskId}: integration_slice ${task.integration_slice} fuera del lane`
        );
    }
    if (
        ['fix', 'refactor'].includes(task.work_type) &&
        !String(task.rework_parent || '').trim() &&
        !String(task.rework_reason || '').trim()
    ) {
        throw new Error(
            `task ${taskId}: work_type=${task.work_type} requiere rework_parent o rework_reason`
        );
    }
    if (task.decision_ref) {
        const decision = (
            Array.isArray(decisionsData.decisions)
                ? decisionsData.decisions
                : []
        ).find(
            (item) =>
                String(item?.id || '').trim() === String(task.decision_ref)
        );
        if (!decision) {
            throw new Error(
                `task ${taskId}: decision_ref no existe (${task.decision_ref})`
            );
        }
        if (
            String(decision.focus_id || '').trim() &&
            String(decision.focus_id || '').trim() !== focus.id
        ) {
            throw new Error(
                `task ${taskId}: decision_ref fuera del foco activo (${task.decision_ref})`
            );
        }
    }
    return { focus };
}

function parseRequiredCheckToken(token) {
    const safe = String(token || '')
        .trim()
        .toLowerCase();
    const canonical = LOCAL_REQUIRED_CHECK_ID_ALIASES[safe] || safe;
    if (!canonical) return null;
    const [type, ...rest] = canonical.split(':');
    const target = rest.join(':').trim();
    if (!type || !target) return null;
    return { id: canonical, type, target };
}

function normalizeRequiredCheckId(token) {
    return parseRequiredCheckToken(token)?.id || '';
}

function isFrontendRequiredCheckType(type) {
    return FRONTEND_REQUIRED_CHECK_TYPES.has(normalizeOptionalToken(type));
}

function isLocalRequiredCheckType(type) {
    return isFrontendRequiredCheckType(type);
}

function normalizeRequiredCheckList(value) {
    return normalizeArray(value, { lowerCase: true })
        .map((token) => parseRequiredCheckToken(token))
        .filter(Boolean)
        .map((item) => item.id);
}

function listsMatchExactly(left, right) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
        if (left[index] !== right[index]) return false;
    }
    return true;
}

function normalizeExitCode(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(parsed) ? parsed : null;
}

function normalizeLocalRequiredCheckSnapshot(snapshot = {}) {
    const checks = Array.isArray(snapshot.checks) ? snapshot.checks : [];
    const checkedAt =
        String(snapshot.checked_at || snapshot.generated_at || '').trim() || '';
    return {
        version:
            Number.parseInt(
                String(
                    snapshot.version || LOCAL_REQUIRED_CHECK_SNAPSHOT_VERSION
                ),
                10
            ) || LOCAL_REQUIRED_CHECK_SNAPSHOT_VERSION,
        focus_id: String(snapshot.focus_id || '').trim(),
        checked_at: checkedAt,
        focus_required_checks: normalizeRequiredCheckList(
            snapshot.focus_required_checks || snapshot.required_check_ids
        ),
        checks: checks
            .map((item) => ({
                id: String(item?.id || '')
                    .trim()
                    .toLowerCase(),
                type: normalizeOptionalToken(item?.type),
                command: String(item?.command || '').trim(),
                ok: item?.ok === true,
                exit_code: normalizeExitCode(item?.exit_code),
                checked_at:
                    String(item?.checked_at || checkedAt).trim() || checkedAt,
            }))
            .filter((item) => item.id && item.type),
    };
}

function normalizeRepoRelativePath(value) {
    return String(value || '')
        .replace(/\\/g, '/')
        .replace(/\/+/g, '/')
        .replace(/^\.\//, '')
        .replace(/\/$/, '')
        .trim();
}

function parseDateMs(value) {
    const parsed = Date.parse(String(value || '').trim());
    return Number.isFinite(parsed) ? parsed : null;
}

function parseRequiredCheckEvidenceMarkdown(raw = '') {
    const checks = [];
    const source = String(raw || '');
    let match = REQUIRED_CHECK_EVIDENCE_PATTERN.exec(source);
    while (match) {
        const id = String(match[1] || '')
            .trim()
            .toLowerCase();
        const normalizedId = normalizeRequiredCheckId(id);
        const state = normalizeOptionalToken(match[2]);
        const command = String(match[3] || '').trim();
        if (normalizedId && (state === 'green' || state === 'red')) {
            checks.push({
                id: normalizedId,
                type: parseRequiredCheckToken(normalizedId)?.type || '',
                command,
                ok: state === 'green',
                exit_code: state === 'green' ? 0 : 1,
            });
        }
        match = REQUIRED_CHECK_EVIDENCE_PATTERN.exec(source);
    }
    REQUIRED_CHECK_EVIDENCE_PATTERN.lastIndex = 0;
    return checks;
}

function compareTasksByUpdatedAtDesc(left = {}, right = {}) {
    const leftMs = parseDateMs(left.updated_at) || 0;
    const rightMs = parseDateMs(right.updated_at) || 0;
    if (leftMs !== rightMs) {
        return rightMs - leftMs;
    }
    return String(left.id || '').localeCompare(
        String(right.id || ''),
        undefined,
        {
            numeric: true,
        }
    );
}

function getTaskEvidenceRefs(task = {}) {
    return Array.from(
        new Set(
            [task.acceptance_ref, task.evidence_ref]
                .map((value) => normalizeRepoRelativePath(value))
                .filter(Boolean)
        )
    );
}

function buildLocalRequiredCheckSnapshotFromEvidence(
    board,
    focus,
    options = {}
) {
    const resolvedFocus = focus?.configured ? focus.configured : focus;
    const focusId = String(resolvedFocus?.id || '').trim();
    const activeStrategy =
        board?.strategy?.active && typeof board.strategy.active === 'object'
            ? board.strategy.active
            : null;
    if (!focusId || !activeStrategy) {
        return {
            available: false,
            valid: false,
            reason: 'missing_evidence',
            path: '',
            snapshot: null,
        };
    }
    const rootPath =
        String(options.rootPath || process.cwd()).trim() || process.cwd();
    const existsImpl =
        typeof options.existsSync === 'function'
            ? options.existsSync
            : existsSync;
    const readFileImpl =
        typeof options.readFileSync === 'function'
            ? options.readFileSync
            : readFileSync;
    const startedAtMs = parseDateMs(activeStrategy.started_at);
    const requiredCheckIds = normalizeRequiredCheckList(
        resolvedFocus?.required_checks
    );
    const allowedSubfrontIds = new Set(
        getEvidenceRequiredCheckSubfrontIds(focusId)
    );
    if (allowedSubfrontIds.size === 0) {
        return {
            available: false,
            valid: false,
            reason: 'missing_evidence',
            path: '',
            snapshot: null,
        };
    }
    const tasks = Array.isArray(board?.tasks) ? board.tasks : [];
    const candidates = tasks
        .filter((task) => {
            if (
                !EVIDENCE_REQUIRED_CHECK_STATUSES.has(
                    normalizeOptionalToken(task?.status)
                )
            ) {
                return false;
            }
            if (
                String(task?.strategy_id || '').trim() !==
                String(activeStrategy.id || '').trim()
            ) {
                return false;
            }
            if (
                !allowedSubfrontIds.has(String(task?.subfront_id || '').trim())
            ) {
                return false;
            }
            if (String(task?.focus_id || '').trim() !== focusId) {
                return false;
            }
            const updatedAtMs = parseDateMs(task?.updated_at);
            if (
                startedAtMs !== null &&
                (updatedAtMs === null || updatedAtMs < startedAtMs)
            ) {
                return false;
            }
            return getTaskEvidenceRefs(task).length > 0;
        })
        .sort(compareTasksByUpdatedAtDesc);

    if (candidates.length === 0) {
        return {
            available: false,
            valid: false,
            reason: 'missing_evidence',
            path: '',
            snapshot: null,
        };
    }

    const cache = new Map();
    const resolvedChecks = [];
    requiredCheckIds.forEach((requiredCheckId) => {
        for (const task of candidates) {
            const refs = getTaskEvidenceRefs(task);
            for (const evidenceRef of refs) {
                const cacheKey = evidenceRef;
                let parsedChecks = cache.get(cacheKey);
                if (!parsedChecks) {
                    const evidencePath = resolve(rootPath, evidenceRef);
                    if (!existsImpl(evidencePath)) {
                        parsedChecks = [];
                    } else {
                        try {
                            parsedChecks = parseRequiredCheckEvidenceMarkdown(
                                readFileImpl(evidencePath, 'utf8')
                            );
                        } catch {
                            parsedChecks = [];
                        }
                    }
                    cache.set(cacheKey, parsedChecks);
                }
                const matchedCheck =
                    parsedChecks.find((item) => item.id === requiredCheckId) ||
                    null;
                if (matchedCheck) {
                    resolvedChecks.push({
                        ...matchedCheck,
                        checked_at:
                            String(task.updated_at || '').trim() ||
                            String(activeStrategy.started_at || '').trim(),
                    });
                    return;
                }
            }
        }
    });

    return {
        available: true,
        valid: true,
        reason: 'evidence',
        path: 'verification/agent-runs',
        snapshot: normalizeLocalRequiredCheckSnapshot({
            version: LOCAL_REQUIRED_CHECK_SNAPSHOT_VERSION,
            focus_id: focusId,
            checked_at:
                String(candidates[0]?.updated_at || '').trim() ||
                String(activeStrategy.started_at || '').trim(),
            focus_required_checks: requiredCheckIds,
            checks: resolvedChecks,
        }),
    };
}

function loadLocalRequiredCheckSnapshot(focus, options = {}) {
    const resolvedFocus = focus?.configured ? focus.configured : focus;
    const focusId = String(resolvedFocus?.id || '').trim();
    const focusRequiredChecks = normalizeRequiredCheckList(
        resolvedFocus?.required_checks
    );
    const board =
        options.board && typeof options.board === 'object'
            ? options.board
            : null;
    const snapshotPath = resolveFocusCheckSnapshotPath(focusId, options);
    if (!focusId) {
        return {
            available: false,
            valid: false,
            reason: 'focus_missing',
            path: snapshotPath,
            snapshot: null,
        };
    }
    const existsImpl =
        typeof options.existsSync === 'function'
            ? options.existsSync
            : existsSync;
    const readFileImpl =
        typeof options.readFileSync === 'function'
            ? options.readFileSync
            : readFileSync;
    if (!existsImpl(snapshotPath)) {
        const evidenceSnapshotState = board
            ? buildLocalRequiredCheckSnapshotFromEvidence(
                  board,
                  resolvedFocus,
                  options
              )
            : null;
        if (evidenceSnapshotState?.valid) {
            return evidenceSnapshotState;
        }
        return {
            available: false,
            valid: false,
            reason: 'missing',
            path: snapshotPath,
            snapshot: null,
        };
    }

    let parsed = null;
    try {
        parsed = JSON.parse(readFileImpl(snapshotPath, 'utf8'));
    } catch {
        return {
            available: true,
            valid: false,
            reason: 'invalid_json',
            path: snapshotPath,
            snapshot: null,
        };
    }

    const normalized = normalizeLocalRequiredCheckSnapshot(parsed);
    if (normalized.focus_id !== focusId) {
        return {
            available: true,
            valid: false,
            reason: 'focus_mismatch',
            path: snapshotPath,
            snapshot: normalized,
        };
    }
    if (
        !listsMatchExactly(
            focusRequiredChecks,
            normalized.focus_required_checks
        )
    ) {
        return {
            available: true,
            valid: false,
            reason: 'required_checks_mismatch',
            path: snapshotPath,
            snapshot: normalized,
        };
    }
    return {
        available: true,
        valid: true,
        reason: 'ok',
        path: snapshotPath,
        snapshot: normalized,
    };
}

function normalizeAbsolutePath(value) {
    return String(value || '')
        .trim()
        .replace(/\\/g, '/');
}

function ensureDirectory(dirPath) {
    mkdirSync(dirPath, { recursive: true });
    return dirPath;
}

function hashText(value) {
    return crypto
        .createHash('sha256')
        .update(String(value || ''), 'utf8')
        .digest('hex');
}

function resolveNpmProgram() {
    const nodeDir = path.dirname(process.execPath);
    const candidate = path.join(
        nodeDir,
        process.platform === 'win32' ? 'npm.cmd' : 'npm'
    );
    if (existsSync(candidate)) {
        return candidate;
    }
    return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function runCommand(program, args, options = {}) {
    const result = spawnSync(program, args, {
        cwd: options.cwd || process.cwd(),
        env: options.env || process.env,
        encoding: 'utf8',
        shell: false,
    });
    return {
        ok: result.status === 0,
        status:
            typeof result.status === 'number'
                ? result.status
                : result.error
                  ? 127
                  : 1,
        stdout: String(result.stdout || ''),
        stderr: String(result.stderr || ''),
        error: result.error instanceof Error ? result.error.message : '',
    };
}

function runGitCommand(cwd, args, options = {}) {
    return runCommand('git', args, { cwd, env: options.env || process.env });
}

function normalizeWorkspaceRoots(options = {}) {
    const cwd = path.resolve(
        String(options.cwd || options.rootPath || process.cwd()).trim() ||
            process.cwd()
    );
    const fallbackRoot = path.resolve(
        String(options.rootPath || cwd).trim() || cwd
    );
    const governancePolicy = options.governancePolicy || null;
    try {
        const workspaceDomain = getWorkspaceDomain();
        if (
            workspaceDomain &&
            typeof workspaceDomain.normalizeWorkspaceSyncPolicy ===
                'function' &&
            typeof workspaceDomain.resolveWorkspaceRoots === 'function'
        ) {
            const policy =
                workspaceDomain.normalizeWorkspaceSyncPolicy(governancePolicy);
            const roots = workspaceDomain.resolveWorkspaceRoots(cwd, policy);
            return {
                cwd,
                root_path: path.resolve(roots.main_root || fallbackRoot),
                local_dir: path.resolve(
                    roots.local_dir ||
                        path.resolve(fallbackRoot, '.codex-local')
                ),
                worktrees_dir: path.resolve(
                    roots.worktrees_dir ||
                        path.resolve(fallbackRoot, '.codex-worktrees')
                ),
                policy,
            };
        }
    } catch {
        // Fallback para fixtures o workspaces sin soporte git.
    }
    return {
        cwd,
        root_path: fallbackRoot,
        local_dir: path.resolve(fallbackRoot, '.codex-local'),
        worktrees_dir: path.resolve(fallbackRoot, '.codex-worktrees'),
        policy: null,
    };
}

function buildTaskCommandEnv(rootPath) {
    const currentPath = String(process.env.PATH || '').trim();
    const pathSegments = [];
    const nodeBin = path.resolve(
        rootPath,
        '.local',
        'tooling',
        'node',
        'current',
        'bin'
    );
    const shims = path.resolve(rootPath, '.local', 'tooling', 'shims');
    if (existsSync(nodeBin)) {
        pathSegments.push(nodeBin);
    }
    if (existsSync(shims)) {
        pathSegments.push(shims);
    }
    if (currentPath) {
        pathSegments.push(currentPath);
    }
    return {
        ...process.env,
        PATH: pathSegments.join(process.platform === 'win32' ? ';' : ':'),
    };
}

function listAlignedFocusTasks(board, options = {}) {
    const activeStatuses = options.activeStatuses || ACTIVE_TASK_STATUSES;
    const activeStrategyId = String(board?.strategy?.active?.id || '').trim();
    const focus = getActiveFocus(board) || getConfiguredFocus(board);
    const focusId = String(focus?.id || '').trim();
    const tasks = Array.isArray(board?.tasks) ? board.tasks : [];
    return tasks.filter((task) => {
        const status = String(task?.status || '').trim();
        if (!activeStatuses.has(status)) {
            return false;
        }
        if (
            activeStrategyId &&
            String(task?.strategy_id || '').trim() &&
            String(task?.strategy_id || '').trim() !== activeStrategyId
        ) {
            return false;
        }
        if (focusId && String(task?.focus_id || '').trim() !== focusId) {
            return false;
        }
        return true;
    });
}

function resolveRequiredChecksTaskSelection(board, options = {}) {
    const requestedTaskId = String(
        options.taskId || options.preferredTaskId || ''
    ).trim();
    const tasks = Array.isArray(board?.tasks) ? board.tasks : [];
    if (requestedTaskId) {
        const task = tasks.find(
            (item) => String(item?.id || '').trim() === requestedTaskId
        );
        if (!task) {
            const error = new Error(
                `required checks snapshot: no existe task_id ${requestedTaskId}`
            );
            error.code = 'focus_required_checks_task_missing';
            error.error_code = 'focus_required_checks_task_missing';
            throw error;
        }
        const status = String(task?.status || '').trim();
        if (!ACTIVE_TASK_STATUSES.has(status)) {
            const error = new Error(
                `required checks snapshot: ${requestedTaskId} no esta activa (${status || 'sin status'})`
            );
            error.code = 'focus_required_checks_task_inactive';
            error.error_code = 'focus_required_checks_task_inactive';
            throw error;
        }
        return task;
    }
    const candidates = listAlignedFocusTasks(board, options);
    if (candidates.length === 1) {
        return candidates[0];
    }
    if (candidates.length === 0) {
        const error = new Error(
            'required checks snapshot: no existe una slice activa alineada para refrescar'
        );
        error.code = 'focus_required_checks_task_missing';
        error.error_code = 'focus_required_checks_task_missing';
        throw error;
    }
    const error = new Error(
        'required checks snapshot: hay multiples slices activas alineadas; usa --task <id>'
    );
    error.code = 'focus_required_checks_task_required';
    error.error_code = 'focus_required_checks_task_required';
    error.candidate_task_ids = candidates.map((task) => String(task.id || ''));
    throw error;
}

function resolveTaskExecutionContext(task, options = {}) {
    const roots = normalizeWorkspaceRoots(options);
    let worktreePath = roots.root_path;
    try {
        const workspaceDomain = getWorkspaceDomain();
        if (
            workspaceDomain &&
            typeof workspaceDomain.captureTaskWorkspace === 'function'
        ) {
            const capture = workspaceDomain.captureTaskWorkspace(task.id, {
                cwd: roots.cwd,
                governancePolicy: options.governancePolicy || null,
            });
            const capturePath = String(capture?.task_row?.path || '').trim();
            if (capturePath) {
                worktreePath = path.resolve(capturePath);
            }
        }
    } catch {
        const candidate = path.resolve(
            roots.worktrees_dir,
            String(task?.id || '')
        );
        if (existsSync(candidate)) {
            worktreePath = candidate;
        }
    }
    return {
        root_path: roots.root_path,
        local_dir: roots.local_dir,
        worktrees_dir: roots.worktrees_dir,
        worktree_path: path.resolve(worktreePath),
    };
}

function sanitizeStatusOutputForFingerprint(raw = '') {
    return String(raw || '')
        .split(/\r?\n/)
        .map((line) => String(line || '').trimEnd())
        .filter(Boolean)
        .filter((line) => {
            const candidatePath = normalizeRepoRelativePath(
                line.length > 3 ? line.slice(3) : line
            );
            if (!candidatePath) {
                return false;
            }
            return (
                !candidatePath.startsWith('.codex-local/') &&
                !candidatePath.startsWith('.codex-worktrees/')
            );
        })
        .join('\n');
}

function computeWorkspaceFingerprint(worktreePath) {
    const gitStatus = runGitCommand(worktreePath, [
        'status',
        '--short',
        '--untracked-files=all',
    ]);
    if (gitStatus.ok) {
        return hashText(sanitizeStatusOutputForFingerprint(gitStatus.stdout));
    }
    return hashText(`nogit:${normalizeAbsolutePath(worktreePath)}`);
}

function getRequiredChecksSnapshotPath(taskId, options = {}) {
    const roots = normalizeWorkspaceRoots(options);
    return resolve(
        roots.root_path,
        REQUIRED_CHECKS_SNAPSHOT_DIRNAME,
        `${String(taskId || '').trim()}.json`
    );
}

function readRequiredChecksSnapshot(taskId, options = {}) {
    const snapshotPath = getRequiredChecksSnapshotPath(taskId, options);
    if (!existsSync(snapshotPath)) {
        return {
            path: snapshotPath,
            snapshot: null,
            error: 'missing',
        };
    }
    try {
        return {
            path: snapshotPath,
            snapshot: JSON.parse(readFileSync(snapshotPath, 'utf8')),
            error: '',
        };
    } catch {
        return {
            path: snapshotPath,
            snapshot: null,
            error: 'invalid_json',
        };
    }
}

function buildSnapshotMetadata(task, executionContext, options = {}) {
    const headResult = runGitCommand(executionContext.worktree_path, [
        'rev-parse',
        'HEAD',
    ]);
    const headSha = headResult.ok
        ? String(headResult.stdout || '').trim()
        : 'nogit';
    return {
        version: REQUIRED_CHECKS_SNAPSHOT_VERSION,
        task_id: String(task?.id || '').trim(),
        strategy_id:
            String(options.strategyId || task?.strategy_id || '').trim() || '',
        worktree_path: normalizeAbsolutePath(executionContext.worktree_path),
        head_sha: headSha,
        worktree_status_fingerprint: computeWorkspaceFingerprint(
            executionContext.worktree_path
        ),
        generated_at:
            String(options.generatedAt || '').trim() ||
            new Date().toISOString(),
    };
}

function validateRequiredChecksSnapshot(snapshot, metadata, options = {}) {
    if (!snapshot || typeof snapshot !== 'object') {
        return {
            valid: false,
            reason: String(options.reason || 'missing').trim() || 'missing',
        };
    }
    if (
        Number.parseInt(String(snapshot.version || ''), 10) !==
        REQUIRED_CHECKS_SNAPSHOT_VERSION
    ) {
        return { valid: false, reason: 'version_mismatch' };
    }
    if (String(snapshot.task_id || '').trim() !== metadata.task_id) {
        return { valid: false, reason: 'task_mismatch' };
    }
    if (String(snapshot.strategy_id || '').trim() !== metadata.strategy_id) {
        return { valid: false, reason: 'strategy_mismatch' };
    }
    if (
        normalizeAbsolutePath(snapshot.worktree_path) !== metadata.worktree_path
    ) {
        return { valid: false, reason: 'worktree_path_mismatch' };
    }
    if (String(snapshot.head_sha || '').trim() !== metadata.head_sha) {
        return { valid: false, reason: 'head_mismatch' };
    }
    if (
        String(snapshot.worktree_status_fingerprint || '').trim() !==
        metadata.worktree_status_fingerprint
    ) {
        return {
            valid: false,
            reason: 'worktree_status_fingerprint_mismatch',
        };
    }
    return { valid: true, reason: 'ok' };
}

function buildRequiredChecksSnapshotState(state = {}) {
    const snapshot =
        state.snapshot && typeof state.snapshot === 'object'
            ? state.snapshot
            : null;
    const generatedAt = String(
        state.generated_at || snapshot?.generated_at || ''
    ).trim();
    const valid = state.valid === true;
    const reason =
        String(state.reason || '').trim() || (valid ? 'ok' : 'missing');
    return {
        source: 'task_snapshot',
        available: state.available === true,
        valid,
        reason,
        stale_reason: valid ? '' : reason,
        path: String(state.path || '').trim(),
        context_task_id: String(
            state.context_task_id || snapshot?.task_id || ''
        ).trim(),
        generated_at: generatedAt,
        snapshot,
        metadata: state.metadata || null,
    };
}

function loadRequiredChecksSnapshotContext(board, options = {}) {
    const task = resolveRequiredChecksTaskSelection(board, options);
    const executionContext = resolveTaskExecutionContext(task, options);
    const metadata = buildSnapshotMetadata(task, executionContext, {
        strategyId:
            String(board?.strategy?.active?.id || '').trim() ||
            String(task?.strategy_id || '').trim(),
        generatedAt:
            options.now instanceof Date
                ? options.now.toISOString()
                : String(options.generatedAt || '').trim(),
    });
    const readResult = readRequiredChecksSnapshot(task.id, {
        cwd: executionContext.worktree_path,
        rootPath: executionContext.root_path,
        governancePolicy: options.governancePolicy || null,
    });
    if (readResult.error === 'missing') {
        return buildRequiredChecksSnapshotState({
            available: false,
            valid: false,
            reason: 'missing',
            path: readResult.path,
            context_task_id: task.id,
            metadata,
        });
    }
    if (readResult.error === 'invalid_json') {
        return buildRequiredChecksSnapshotState({
            available: true,
            valid: false,
            reason: 'invalid_json',
            path: readResult.path,
            context_task_id: task.id,
            metadata,
        });
    }
    const validation = validateRequiredChecksSnapshot(
        readResult.snapshot,
        metadata
    );
    return buildRequiredChecksSnapshotState({
        available: true,
        valid: validation.valid,
        reason: validation.reason,
        path: readResult.path,
        context_task_id: task.id,
        generated_at: readResult.snapshot?.generated_at,
        snapshot: readResult.snapshot,
        metadata,
    });
}

function evaluateFrontendRequiredCheck(check, snapshotState) {
    if (!snapshotState?.valid) {
        const reason = String(snapshotState?.reason || 'missing').trim();
        return {
            ...check,
            state: 'unverified',
            ok: false,
            reason: `snapshot_${reason}`,
            message: `required_check ${check.id} no verificado`,
        };
    }
    const snapshotChecks = Array.isArray(snapshotState?.snapshot?.checks)
        ? snapshotState.snapshot.checks
        : [];
    const snapshotCheck =
        snapshotChecks.find(
            (item) =>
                normalizeRequiredCheckId(item?.id) ===
                normalizeRequiredCheckId(check.id)
        ) || null;
    if (!snapshotCheck) {
        return {
            ...check,
            state: 'unverified',
            ok: false,
            reason: 'snapshot_check_missing',
            message: `required_check ${check.id} no verificado`,
        };
    }
    const command = String(snapshotCheck.command || '').trim();
    const checkedAt = String(
        snapshotCheck.checked_at || snapshotState.generated_at || ''
    ).trim();
    if (snapshotCheck.ok === true) {
        return {
            ...check,
            command,
            checked_at: checkedAt,
            state: 'green',
            ok: true,
            exit_code: normalizeExitCode(snapshotCheck.exit_code) ?? 0,
            duration_ms: normalizeExitCode(snapshotCheck.duration_ms),
            message: `required_check ${check.id} green`,
        };
    }
    return {
        ...check,
        command,
        checked_at: checkedAt,
        state: 'red',
        ok: false,
        exit_code: normalizeExitCode(snapshotCheck.exit_code) ?? 1,
        duration_ms: normalizeExitCode(snapshotCheck.duration_ms),
        reason: 'command_failed',
        message: `required_check ${check.id} red`,
    };
}

function refreshRequiredChecksSnapshot(board, options = {}) {
    const focus = getConfiguredFocus(board);
    if (!focus) {
        const error = new Error('focus check requiere foco configurado');
        error.code = 'focus_missing';
        error.error_code = 'focus_missing';
        throw error;
    }
    const task = resolveRequiredChecksTaskSelection(board, options);
    const executionContext = resolveTaskExecutionContext(task, options);
    const generatedAt =
        options.now instanceof Date
            ? options.now.toISOString()
            : new Date().toISOString();
    const metadata = buildSnapshotMetadata(task, executionContext, {
        strategyId:
            String(board?.strategy?.active?.id || '').trim() ||
            String(task?.strategy_id || '').trim(),
        generatedAt,
    });
    const checks = normalizeArray(focus.required_checks, { lowerCase: true })
        .map((token) => parseRequiredCheckToken(token))
        .filter((item) => item && isFrontendRequiredCheckType(item.type));
    const npmProgram = resolveNpmProgram();
    const env = buildTaskCommandEnv(executionContext.root_path);
    const results = checks.map((check) => {
        const scriptId =
            FRONTEND_REQUIRED_CHECK_SCRIPT_OVERRIDES[check.id] || check.id;
        const command = `npm run ${scriptId}`;
        const startedAt = Date.now();
        const result = runCommand(npmProgram, ['run', scriptId], {
            cwd: executionContext.worktree_path,
            env,
        });
        return {
            id: check.id,
            family: check.type,
            command,
            ok: result.ok,
            state: result.ok ? 'green' : 'red',
            exit_code: result.status,
            duration_ms: Date.now() - startedAt,
            checked_at: new Date().toISOString(),
        };
    });
    const snapshotPath = getRequiredChecksSnapshotPath(task.id, {
        cwd: executionContext.worktree_path,
        rootPath: executionContext.root_path,
        governancePolicy: options.governancePolicy || null,
    });
    ensureDirectory(path.dirname(snapshotPath));
    const payload = {
        ...metadata,
        checks: results,
    };
    writeFileSync(
        `${snapshotPath}`,
        `${JSON.stringify(payload, null, 2)}\n`,
        'utf8'
    );
    return {
        version: 1,
        ok: true,
        source: 'task_snapshot',
        task_id: task.id,
        context_task_id: task.id,
        strategy_id: metadata.strategy_id,
        path: snapshotPath,
        generated_at: generatedAt,
        worktree_path: normalizeAbsolutePath(executionContext.worktree_path),
        checks_ok: results.every((item) => item.ok === true),
        checks: results,
    };
}

function evaluateLocalRequiredCheck(check, snapshotState) {
    if (!snapshotState?.valid) {
        const reason = String(snapshotState?.reason || 'missing').trim();
        return {
            ...check,
            state: 'unverified',
            ok: false,
            reason: `snapshot_${reason}`,
            message: `required_check ${check.id} no verificado`,
        };
    }

    const snapshotChecks = Array.isArray(snapshotState?.snapshot?.checks)
        ? snapshotState.snapshot.checks
        : [];
    const snapshotCheck =
        snapshotChecks.find((item) => item.id === check.id) || null;
    if (!snapshotCheck) {
        return {
            ...check,
            state: 'unverified',
            ok: false,
            reason: 'snapshot_check_missing',
            message: `required_check ${check.id} no verificado`,
        };
    }

    const base = {
        ...check,
        command: snapshotCheck.command,
        checked_at: snapshotCheck.checked_at,
    };
    if (snapshotCheck.ok) {
        return {
            ...base,
            state: 'green',
            ok: true,
            exit_code:
                snapshotCheck.exit_code === null ? 0 : snapshotCheck.exit_code,
            message: `required_check ${check.id} green`,
        };
    }
    return {
        ...base,
        state: 'red',
        ok: false,
        exit_code:
            snapshotCheck.exit_code === null ? 1 : snapshotCheck.exit_code,
        reason: 'command_failed',
        message: `required_check ${check.id} red`,
    };
}

function findRuntimeSurfaceVerification(runtimeVerification, target) {
    const safeTarget = normalizeOptionalToken(target);
    if (!safeTarget) return null;
    const surfaces = Array.isArray(runtimeVerification?.surfaces)
        ? runtimeVerification.surfaces
        : [];
    return (
        surfaces.find(
            (surface) => normalizeOptionalToken(surface?.surface) === safeTarget
        ) || null
    );
}

function findRuntimeSurfaceDiagnostic(runtimeVerification, target) {
    const safeTarget = normalizeOptionalToken(target);
    if (!safeTarget) return null;
    const diagnostics = Array.isArray(runtimeVerification?.summary?.diagnostics)
        ? runtimeVerification.summary.diagnostics
        : [];
    return (
        diagnostics.find(
            (item) => normalizeOptionalToken(item?.surface) === safeTarget
        ) || null
    );
}

function isOperatorAuthRecommendedModeHealthy(surface = {}) {
    const target = normalizeOptionalToken(surface?.surface);
    if (target !== 'operator_auth') {
        return false;
    }
    if (Number(surface?.http_status || 0) >= 400) {
        return false;
    }
    const status = normalizeOptionalToken(surface?.status);
    if (!status || status === 'operator_auth_not_configured') {
        return false;
    }
    const mode = normalizeOptionalToken(surface?.mode);
    const details =
        surface?.details && typeof surface.details === 'object'
            ? surface.details
            : {};
    const recommendedMode = normalizeOptionalToken(
        details.recommendedMode || details.recommended_mode
    );
    if (!mode || !recommendedMode || mode !== recommendedMode) {
        return false;
    }
    if (details.configured === false || surface.configured === false) {
        return false;
    }
    return true;
}

function runtimeProviderMatchesRequiredCheckTarget(
    target,
    runtimeVerification
) {
    const safeTarget = normalizeOptionalToken(target);
    if (!safeTarget) return false;
    const provider = normalizeOptionalToken(runtimeVerification?.provider);
    const requestedProvider = normalizeOptionalToken(
        runtimeVerification?.requested_provider
    );
    const normalizedProvider = normalizeOptionalToken(
        runtimeVerification?.normalized_provider
    );
    if (
        safeTarget === provider ||
        safeTarget === requestedProvider ||
        safeTarget === normalizedProvider
    ) {
        return true;
    }
    return (
        (safeTarget === 'openclaw_chatgpt' &&
            (provider === 'pilot_runtime' ||
                requestedProvider === 'pilot_runtime' ||
                normalizedProvider === 'pilot_runtime')) ||
        (safeTarget === 'pilot_runtime' &&
            (provider === 'openclaw_chatgpt' ||
                requestedProvider === 'openclaw_chatgpt' ||
                normalizedProvider === 'openclaw_chatgpt'))
    );
}

function evaluateRuntimeRequiredCheck(check, runtimeVerification) {
    if (!runtimeVerification) {
        return {
            ...check,
            state: 'unverified',
            ok: false,
            message: `runtime ${check.target} no verificado`,
        };
    }

    if (
        runtimeProviderMatchesRequiredCheckTarget(
            check.target,
            runtimeVerification
        )
    ) {
        if (!runtimeVerification.ok) {
            return {
                ...check,
                state: 'red',
                ok: false,
                message: `runtime ${check.target} unhealthy`,
            };
        }
        return {
            ...check,
            state: 'green',
            ok: true,
            message: `runtime ${check.target} healthy`,
        };
    }

    const surface = findRuntimeSurfaceVerification(
        runtimeVerification,
        check.target
    );
    const diagnostic = findRuntimeSurfaceDiagnostic(
        runtimeVerification,
        check.target
    );
    if (!surface) {
        return {
            ...check,
            state: 'unverified',
            ok: false,
            message: `runtime ${check.target} no verificado`,
        };
    }

    if (isOperatorAuthRecommendedModeHealthy(surface)) {
        return {
            ...check,
            state: 'green',
            ok: true,
            message: `runtime ${check.target} healthy`,
        };
    }

    if (!surface.healthy) {
        return {
            ...check,
            state: 'red',
            ok: false,
            reason: String(diagnostic?.reason || '').trim(),
            next_action: String(diagnostic?.next_action || '').trim(),
            message:
                String(diagnostic?.message || '').trim() ||
                `runtime ${check.target} ${String(surface.state || 'unhealthy').trim() || 'unhealthy'}`,
        };
    }

    return {
        ...check,
        state: 'green',
        ok: true,
        message: `runtime ${check.target} healthy`,
    };
}

function hasActionableJobRequiredCheck(job = {}) {
    if (!job || typeof job !== 'object') {
        return false;
    }
    if (job.verified !== false) {
        return true;
    }
    if (job.configured === false) {
        return false;
    }
    return Boolean(
        String(job.failure_reason || job.last_error_message || '').trim() ||
        String(job.state || '').trim() === 'failed'
    );
}

function getJobRequiredCheckNextAction(job = {}) {
    const failureReason = String(
        job.failure_reason || job.last_error_message || ''
    ).trim();
    if (/^health_http_\d+$/i.test(failureReason)) {
        return 'revisar /api.php?resource=health y recuperar backend/origen del host publico';
    }
    if (failureReason === 'health_missing_public_sync') {
        return 'desplegar el contrato actualizado de /api.php?resource=health con checks.publicSync';
    }
    if (
        failureReason === 'unverified' &&
        String(job.verification_source || '')
            .trim()
            .toLowerCase() === 'registry_only'
    ) {
        return 'restaurar evidencia host-side de public_main_sync desde health_url antes de seguir cerrando el corte';
    }
    return '';
}

function evaluateRequiredChecks(focus, options = {}) {
    const checks = normalizeArray(focus?.required_checks, { lowerCase: true })
        .map((token) => parseRequiredCheckToken(token))
        .filter(Boolean);
    const jobsSnapshot = Array.isArray(options.jobsSnapshot)
        ? options.jobsSnapshot
        : [];
    const runtimeVerification =
        options.runtimeVerification &&
        typeof options.runtimeVerification === 'object'
            ? options.runtimeVerification
            : null;
    const localRequiredCheckSnapshot =
        options.localRequiredCheckSnapshot &&
        typeof options.localRequiredCheckSnapshot === 'object'
            ? options.localRequiredCheckSnapshot
            : hasLocalRequiredCheck(focus)
              ? loadLocalRequiredCheckSnapshot(focus, {
                    board: options.board,
                    rootPath: options.rootPath,
                    existsSync: options.existsSync,
                    readFileSync: options.readFileSync,
                })
              : null;
    const requiredChecksSnapshot =
        options.requiredChecksSnapshot &&
        typeof options.requiredChecksSnapshot === 'object'
            ? options.requiredChecksSnapshot
            : null;
    return checks.map((check) => {
        if (isFrontendRequiredCheckType(check.type)) {
            if (requiredChecksSnapshot) {
                return evaluateFrontendRequiredCheck(
                    check,
                    requiredChecksSnapshot
                );
            }
            return evaluateLocalRequiredCheck(
                check,
                localRequiredCheckSnapshot
            );
        }
        if (check.type === 'job') {
            const job = jobsSnapshot.find(
                (item) =>
                    String(item?.key || '')
                        .trim()
                        .toLowerCase() === check.target
            );
            if (!job || !hasActionableJobRequiredCheck(job)) {
                return {
                    ...check,
                    state: 'unverified',
                    ok: false,
                    message: `job ${check.target} no verificado`,
                };
            }
            if (!job.healthy) {
                const failureReason = String(
                    job.failure_reason || job.last_error_message || ''
                ).trim();
                const nextAction = getJobRequiredCheckNextAction(job);
                return {
                    ...check,
                    state: 'red',
                    ok: false,
                    ...(failureReason ? { reason: failureReason } : {}),
                    ...(nextAction ? { next_action: nextAction } : {}),
                    message: failureReason
                        ? `job ${check.target} unhealthy: ${failureReason}`
                        : `job ${check.target} unhealthy`,
                };
            }
            return {
                ...check,
                state: 'green',
                ok: true,
                message: `job ${check.target} healthy`,
            };
        }
        if (check.type === 'runtime') {
            return evaluateRuntimeRequiredCheck(check, runtimeVerification);
        }
        return {
            ...check,
            state: 'unverified',
            ok: false,
            message: `required_check no soportado (${check.id})`,
        };
    });
}

function hasRuntimeRequiredCheck(value = {}) {
    const focus = value?.configured ? value.configured : value;
    const checks = normalizeArray(focus?.required_checks, { lowerCase: true });
    return checks.some((item) => item.startsWith('runtime:'));
}

function hasFrontendRequiredCheck(value = {}) {
    const focus = value?.configured ? value.configured : value;
    const checks = normalizeArray(focus?.required_checks, { lowerCase: true })
        .map((token) => parseRequiredCheckToken(token))
        .filter(Boolean);
    return checks.some((item) => isFrontendRequiredCheckType(item.type));
}

function hasLocalRequiredCheck(value = {}) {
    return hasFrontendRequiredCheck(value);
}

function listPendingRequiredChecks(summary = {}) {
    return Array.isArray(summary?.required_checks)
        ? summary.required_checks.filter(
              (item) => item?.state === 'unverified' || item?.state === 'red'
          )
        : [];
}

function hasPendingRequiredChecks(summary = {}) {
    return listPendingRequiredChecks(summary).length > 0;
}

function buildFocusSummary(board, options = {}) {
    const activeStatuses = options.activeStatuses || ACTIVE_TASK_STATUSES;
    const decisionsData =
        options.decisionsData && typeof options.decisionsData === 'object'
            ? options.decisionsData
            : { decisions: [] };
    const focus = getConfiguredFocus(board);
    const activeFocus = getActiveFocus(board);
    const tasks = Array.isArray(board?.tasks) ? board.tasks : [];
    const activeTasks = tasks
        .filter((task) => activeStatuses.has(String(task?.status || '').trim()))
        .map((task) => {
            const clone = {
                ...task,
                files: Array.isArray(task?.files) ? [...task.files] : [],
                depends_on: Array.isArray(task?.depends_on)
                    ? [...task.depends_on]
                    : [],
            };
            normalizeTaskFocusFields(clone);
            ensureTaskFocusDefaults(board, clone, { activeStatuses });
            return clone;
        });

    const summary = {
        configured: focus,
        active: activeFocus,
        active_tasks_total: activeTasks.length,
        aligned_tasks: 0,
        forward_tasks_total: 0,
        support_tasks_total: 0,
        blocked_tasks_total: 0,
        blocked_task_ids: [],
        acknowledged_external_blocker: false,
        external_blocker_task_ids: [],
        external_blocker_tasks: [],
        support_only: false,
        idle: Boolean(activeFocus) && activeTasks.length === 0,
        active_slices: [],
        active_steps: [],
        distinct_active_slices: 0,
        distinct_active_steps: 0,
        too_many_active_slices: false,
        missing_focus_task_ids: [],
        outside_next_step_task_ids: [],
        invalid_slice_task_ids: [],
        rework_without_reason_task_ids: [],
        work_type_counts: {},
        decisions: {
            total: 0,
            open: 0,
            overdue: 0,
            open_ids: [],
            overdue_ids: [],
        },
        required_checks: [],
        required_checks_snapshot: null,
        required_checks_ok: false,
        release_ready: false,
        blocking_errors: [],
        release_blocking_errors: [],
        warnings: [],
    };

    if (!focus) {
        return summary;
    }

    for (const task of activeTasks) {
        const taskId = String(task.id || '');
        const taskStatus = String(task.status || '')
            .trim()
            .toLowerCase();
        const workType = String(task.work_type || '')
            .trim()
            .toLowerCase();
        const externalBlockedCarryover =
            taskStatus === 'blocked' &&
            workType === 'support' &&
            isAcknowledgedExternalBlockedTask(task);
        if (workType) {
            summary.work_type_counts[workType] =
                Number(summary.work_type_counts[workType] || 0) + 1;
        }
        if (workType === 'forward') {
            summary.forward_tasks_total += 1;
        }
        if (workType === 'support') {
            summary.support_tasks_total += 1;
        }
        if (taskStatus === 'blocked') {
            summary.blocked_tasks_total += 1;
            summary.blocked_task_ids.push(taskId);
            if (isAcknowledgedExternalBlockedTask(task)) {
                summary.external_blocker_task_ids.push(taskId);
                summary.external_blocker_tasks.push({
                    id: taskId,
                    blocked_reason: String(task.blocked_reason || ''),
                    status: taskStatus,
                    work_type: workType,
                    focus_step: String(task.focus_step || ''),
                });
            }
        }
        if (!task.focus_id || !task.focus_step || !task.integration_slice) {
            summary.missing_focus_task_ids.push(taskId);
            continue;
        }
        if (task.focus_id !== focus.id) {
            summary.missing_focus_task_ids.push(taskId);
            continue;
        }
        if (task.focus_step !== focus.next_step) {
            if (externalBlockedCarryover) {
                continue;
            }
            summary.outside_next_step_task_ids.push(taskId);
            continue;
        }
        const allowedSlices = getAllowedSlicesForLane(task);
        if (
            !ALLOWED_INTEGRATION_SLICES.has(task.integration_slice) ||
            !allowedSlices.has(task.integration_slice)
        ) {
            summary.invalid_slice_task_ids.push(taskId);
            continue;
        }
        if (
            ['fix', 'refactor'].includes(workType) &&
            !String(task.rework_parent || '').trim() &&
            !String(task.rework_reason || '').trim()
        ) {
            summary.rework_without_reason_task_ids.push(taskId);
            continue;
        }
        summary.aligned_tasks += 1;
        summary.active_slices.push(task.integration_slice);
        summary.active_steps.push(task.focus_step);
    }

    const uniqueSlices = Array.from(new Set(summary.active_slices)).sort();
    const uniqueSteps = Array.from(new Set(summary.active_steps)).sort();
    summary.active_slices = uniqueSlices;
    summary.active_steps = uniqueSteps;
    summary.distinct_active_slices = uniqueSlices.length;
    summary.distinct_active_steps = uniqueSteps.length;
    summary.support_only =
        activeTasks.length > 0 &&
        summary.support_tasks_total === activeTasks.length &&
        summary.forward_tasks_total === 0;
    summary.acknowledged_external_blocker =
        summary.external_blocker_task_ids.length > 0;
    summary.too_many_active_slices =
        uniqueSlices.length >
        normalizeFocusMaxActiveSlices(focus.max_active_slices);

    const nowMs =
        options.now instanceof Date ? options.now.getTime() : Date.now();
    const decisions = (
        Array.isArray(decisionsData.decisions) ? decisionsData.decisions : []
    ).filter(
        (item) =>
            String(item?.focus_id || '').trim() ===
            String(focus.id || '').trim()
    );
    summary.decisions.total = decisions.length;
    for (const decision of decisions) {
        const status = normalizeOptionalToken(decision?.status);
        const id = String(decision?.id || '').trim();
        const dueMs = Date.parse(String(decision?.due_at || ''));
        const overdue =
            status === 'open' && Number.isFinite(dueMs) && dueMs < nowMs;
        if (status === 'open') {
            summary.decisions.open += 1;
            if (id) summary.decisions.open_ids.push(id);
        }
        if (overdue) {
            summary.decisions.overdue += 1;
            if (id) summary.decisions.overdue_ids.push(id);
        }
    }

    summary.required_checks = evaluateRequiredChecks(focus, {
        jobsSnapshot: options.jobsSnapshot,
        runtimeVerification: options.runtimeVerification,
        localRequiredCheckSnapshot: options.localRequiredCheckSnapshot,
        requiredChecksSnapshot: options.requiredChecksSnapshot,
        board,
        rootPath: options.rootPath,
    });
    const localRequiredCheckSnapshot =
        options.localRequiredCheckSnapshot &&
        typeof options.localRequiredCheckSnapshot === 'object'
            ? options.localRequiredCheckSnapshot
            : null;
    if (
        options.requiredChecksSnapshot &&
        typeof options.requiredChecksSnapshot === 'object'
    ) {
        summary.required_checks_snapshot = {
            source:
                String(options.requiredChecksSnapshot.source || '').trim() ||
                'task_snapshot',
            path: String(options.requiredChecksSnapshot.path || '').trim(),
            generated_at: String(
                options.requiredChecksSnapshot.generated_at ||
                    options.requiredChecksSnapshot.snapshot?.generated_at ||
                    ''
            ).trim(),
            context_task_id: String(
                options.requiredChecksSnapshot.context_task_id ||
                    options.requiredChecksSnapshot.snapshot?.task_id ||
                    ''
            ).trim(),
            stale_reason:
                options.requiredChecksSnapshot.valid === true
                    ? ''
                    : String(
                          options.requiredChecksSnapshot.stale_reason ||
                              options.requiredChecksSnapshot.reason ||
                              ''
                      ).trim(),
            valid: options.requiredChecksSnapshot.valid === true,
        };
    } else if (
        localRequiredCheckSnapshot &&
        (localRequiredCheckSnapshot.available === true ||
            localRequiredCheckSnapshot.valid === true)
    ) {
        summary.required_checks_snapshot = {
            source:
                localRequiredCheckSnapshot.reason === 'evidence'
                    ? 'focus_evidence'
                    : 'local_snapshot',
            path: String(localRequiredCheckSnapshot.path || '').trim(),
            generated_at: String(
                localRequiredCheckSnapshot.snapshot?.checked_at || ''
            ).trim(),
            context_task_id: '',
            stale_reason:
                localRequiredCheckSnapshot.valid === true
                    ? ''
                    : String(localRequiredCheckSnapshot.reason || '').trim(),
            valid: localRequiredCheckSnapshot.valid === true,
        };
    }
    summary.required_checks_ok =
        summary.required_checks.length > 0 &&
        summary.required_checks.every((item) => item.ok === true);

    if (!activeFocus && focus.status === 'active') {
        summary.warnings.push('strategy_has_no_active_focus');
    }
    if (summary.idle) {
        summary.warnings.push('focus_without_active_tasks');
    }
    if (summary.missing_focus_task_ids.length > 0) {
        summary.blocking_errors.push('task_missing_focus_fields');
    }
    if (summary.outside_next_step_task_ids.length > 0) {
        summary.blocking_errors.push('task_outside_next_step');
    }
    if (summary.invalid_slice_task_ids.length > 0) {
        summary.blocking_errors.push('slice_not_allowed_for_lane');
    }
    if (summary.rework_without_reason_task_ids.length > 0) {
        summary.blocking_errors.push('rework_without_reason');
    }
    if (summary.too_many_active_slices) {
        summary.blocking_errors.push('too_many_active_slices');
    }
    if (
        summary.required_checks.some(
            (item) => item.state === 'unverified' || item.state === 'red'
        )
    ) {
        summary.release_blocking_errors.push('required_check_unverified');
        summary.warnings.push('required_check_unverified');
    }
    if (summary.support_only) {
        summary.warnings.push('support_only_active');
    }
    if (summary.decisions.overdue > 0) {
        summary.warnings.push('decision_overdue');
    }
    const closedFocusReady =
        focus.status === 'closed' &&
        summary.required_checks_ok &&
        !summary.support_only &&
        summary.blocking_errors.length === 0 &&
        Boolean(String(focus.evidence_ref || '').trim());
    summary.release_ready =
        closedFocusReady ||
        (summary.active_tasks_total > 0 &&
            summary.aligned_tasks === summary.active_tasks_total &&
            summary.required_checks_ok &&
            !summary.support_only &&
            summary.blocking_errors.length === 0);

    return summary;
}

async function buildLiveFocusSummary(board, deps = {}) {
    const now = deps.now instanceof Date ? deps.now : new Date();
    const summaryBuilder =
        typeof deps.buildFocusSummary === 'function'
            ? deps.buildFocusSummary
            : buildFocusSummary;
    const decisionsDataRaw =
        typeof deps.parseDecisions === 'function'
            ? deps.parseDecisions()
            : { decisions: [] };
    const decisionsData =
        decisionsDataRaw && typeof decisionsDataRaw === 'object'
            ? decisionsDataRaw
            : { decisions: [] };
    const jobsRaw =
        typeof deps.loadJobsSnapshot === 'function'
            ? await deps.loadJobsSnapshot()
            : [];
    const jobs = Array.isArray(jobsRaw) ? jobsRaw : [];
    const configuredFocus = getConfiguredFocus(board);
    const requestedTaskId = String(
        deps.taskId || deps.preferredTaskId || ''
    ).trim();
    const localRequiredCheckSnapshot = hasLocalRequiredCheck(configuredFocus)
        ? loadLocalRequiredCheckSnapshot(configuredFocus, {
              board,
              rootPath: deps.rootPath,
              existsSync: deps.existsSync,
              readFileSync: deps.readFileSync,
          })
        : null;
    let requiredChecksSnapshot = null;
    if (requestedTaskId && hasFrontendRequiredCheck(configuredFocus)) {
        try {
            requiredChecksSnapshot = loadRequiredChecksSnapshotContext(board, {
                taskId: requestedTaskId,
                preferredTaskId: requestedTaskId,
                now,
                cwd: deps.cwd || deps.rootPath || process.cwd(),
                rootPath: deps.rootPath || deps.cwd || process.cwd(),
                governancePolicy: deps.governancePolicy || null,
            });
        } catch (error) {
            requiredChecksSnapshot = buildRequiredChecksSnapshotState({
                available: false,
                valid: false,
                reason:
                    String(
                        error?.error_code || error?.code || 'missing'
                    ).trim() || 'missing',
                path: getRequiredChecksSnapshotPath(requestedTaskId, {
                    cwd: deps.cwd || deps.rootPath || process.cwd(),
                    rootPath: deps.rootPath || deps.cwd || process.cwd(),
                    governancePolicy: deps.governancePolicy || null,
                }),
                context_task_id: requestedTaskId,
            });
        }
    }
    const initialSummary = summaryBuilder(board, {
        decisionsData,
        jobsSnapshot: jobs,
        localRequiredCheckSnapshot,
        requiredChecksSnapshot,
        rootPath: deps.rootPath,
        now,
    });
    const runtimeVerification =
        hasRuntimeRequiredCheck(initialSummary) &&
        typeof deps.verifyOpenClawRuntime === 'function'
            ? await deps.verifyOpenClawRuntime()
            : null;
    const summary = summaryBuilder(board, {
        decisionsData,
        jobsSnapshot: jobs,
        runtimeVerification,
        localRequiredCheckSnapshot,
        requiredChecksSnapshot,
        rootPath: deps.rootPath,
        now,
    });

    return {
        decisionsData,
        jobs,
        runtimeVerification,
        localRequiredCheckSnapshot,
        requiredChecksSnapshot,
        summary,
    };
}

function buildFocusSeed(strategy, options = {}) {
    const strategyId = String(strategy?.id || '').trim();
    const reviewDueAt =
        String(strategy?.review_due_at || '').trim() || '2026-03-21';
    const owner =
        String(strategy?.owner || options.owner || '').trim() || 'ernesto';
    if (strategyId === 'STRAT-2026-03-codex-governance-v2-adoption') {
        return {
            focus_id: 'FOCUS-2026-03-codex-governance-v2-adoption-cut-1',
            focus_title: 'Canon v2 y cuarentena del donor',
            focus_summary:
                'Adoptar el canon v2, aislar el root donor no canonico y preparar el rescate posterior por lanes sin heredar checks de producto.',
            focus_status: 'active',
            focus_proof:
                'La gobernanza corre sobre un frente transversal corto, el root donor queda inventariado como fuente de diff y el siguiente rescate se abre por slices separadas y canonicas.',
            focus_steps: [
                'canon_adoption',
                'root_donor_quarantine',
                'rescue_slice_preparation',
            ],
            focus_next_step: 'canon_adoption',
            focus_required_checks: [],
            focus_non_goals: [
                'product_runtime_changes',
                'root_donor_execution',
                'mass_merge_from_donor',
            ],
            focus_owner: owner,
            focus_review_due_at: reviewDueAt,
            focus_evidence_ref: '',
            focus_max_active_slices: 1,
        };
    }
    if (strategyId === 'STRAT-2026-03-admin-shell-rc2-polish') {
        return {
            focus_id: 'FOCUS-2026-03-admin-shell-rc2-polish-cut-1',
            focus_title: 'Admin shell clinico diario sin ruido de turnero',
            focus_summary:
                'Pulir el shell admin diario para dejar solo cinco secciones visibles, navegacion mas legible y cero ruido de queue/turnero o reviews en el carril principal.',
            focus_status: 'active',
            focus_proof:
                'El operador entra al admin y ve inicio, agenda, pendientes, horarios e historia clinica como unico shell visible; queue/turnero y reviews quedan fuera de sidebar, hash routing y quick commands.',
            focus_steps: ['shell_nav_ergonomics', 'qa_closeout'],
            focus_next_step: 'shell_nav_ergonomics',
            focus_required_checks: ['test:frontend:qa:admin'],
            focus_non_goals: [
                'reactivar_queue_turnero',
                'reactivar_reviews',
                'recover_public_main_sync',
                'refactor_backend_runtime',
            ],
            focus_owner: owner,
            focus_review_due_at: reviewDueAt,
            focus_evidence_ref: '',
            focus_max_active_slices: 1,
        };
    }
    if (strategyId === 'STRAT-2026-03-admin-operativo') {
        return {
            focus_id: 'FOCUS-2026-03-admin-operativo-cut-1',
            focus_title: 'Admin operativo demostrable',
            focus_summary:
                'Unificar admin clinico, quick-nav, queue/turnero piloto y readiness operacional en un solo corte legible.',
            focus_status: 'active',
            focus_proof:
                'Operador inicia sesion, entra al admin, usa quick-nav, revisa queue/turnero piloto y el corte queda respaldado por runtime/deploy verificables',
            focus_steps: [
                'admin_queue_pilot_cut',
                'pilot_readiness_evidence',
                'feedback_trim',
            ],
            focus_next_step: 'admin_queue_pilot_cut',
            focus_required_checks: [
                'job:public_main_sync',
                'runtime:operator_auth',
            ],
            focus_non_goals: [
                'rediseno_publico',
                'expansion_payments',
                'refactor_orchestrator_no_bloqueante',
                'modularizacion_fuera_del_corte',
            ],
            focus_owner: owner,
            focus_review_due_at: reviewDueAt,
            focus_evidence_ref: '',
            focus_max_active_slices: 3,
        };
    }
    if (strategyId === 'STRAT-2026-03-turnero-web-pilot-local-first') {
        return {
            focus_id: 'FOCUS-2026-03-turnero-web-pilot-local-cut-1',
            focus_title: 'Turnero web pilot local-first por clinica',
            focus_summary:
                'Alinear perfil clinico, surfaces web y gate local para operar turnero como web_pilot por clinica, sin depender de native apps ni de verificacion remota.',
            focus_status: 'active',
            focus_proof:
                'Admin, operador, kiosco y sala leen el perfil web_pilot de la clinica activa, el gate local vuelve a verde y desktop/Android quedan como carriles diferidos del piloto.',
            focus_steps: [
                'web_pilot_contract_alignment',
                'web_surface_local_readiness',
                'local_gate_validation',
            ],
            focus_next_step: 'web_pilot_contract_alignment',
            focus_required_checks: [
                'test:turnero:web-pilot:contracts',
                'test:turnero:web-pilot:php-contract',
                'test:turnero:web-pilot:ui',
            ],
            focus_non_goals: [
                'verify_remote_turnero',
                'prod_smoke_turnero',
                'desktop_android_blocking',
                'public_main_sync_recovery',
            ],
            focus_owner: owner,
            focus_review_due_at: reviewDueAt,
            focus_evidence_ref: '',
            focus_max_active_slices: 2,
        };
    }
    if (strategyId === 'STRAT-2026-03-turnero-web-pilot-multi-clinic-local') {
        return {
            focus_id: 'FOCUS-2026-03-turnero-web-pilot-multi-clinic-cut-1',
            focus_title: 'Turnero web pilot multi-clinic local-first',
            focus_summary:
                'Habilitar una segunda clinica web_pilot dentro del catalogo local-first de turnero, mostrando readiness multi-clinica sin depender de verify-remote ni de carriles nativos.',
            focus_status: 'active',
            focus_proof:
                'clinica-norte-demo valida y stagea como web_pilot, el admin expone el catalogo multi-clinica con readiness local y los tres checks del frente vuelven a verde.',
            focus_steps: [
                'second_clinic_web_pilot_contract',
                'multi_clinic_local_readiness',
                'local_gate_validation',
            ],
            focus_next_step: 'second_clinic_web_pilot_contract',
            focus_required_checks: [
                'test:turnero:web-pilot:contracts',
                'test:turnero:web-pilot:php-contract',
                'test:turnero:web-pilot:ui',
            ],
            focus_non_goals: [
                'public_main_sync_recovery',
                'verify_remote_turnero',
                'prod_smoke_turnero',
                'desktop_android_blocking',
                'new_clinic_from_scratch',
            ],
            focus_owner: owner,
            focus_review_due_at: reviewDueAt,
            focus_evidence_ref: '',
            focus_max_active_slices: 2,
        };
    }
    if (strategyId === 'STRAT-2026-03-turnero-web-pilot') {
        return {
            focus_id: 'FOCUS-2026-03-turnero-web-pilot-cut-1',
            focus_title: 'Turnero web remoto por clinica',
            focus_summary:
                'Reintroducir admin queue, operator, kiosk y display bajo un mismo clinic-profile remoto por clinica, con readiness local y salida remota verificable.',
            focus_status: 'active',
            focus_proof:
                'Las cuatro superficies web del piloto quedan alineadas a una sola clinica canonica, los checks locales quedan verdes y la validacion remota decide salida o bloqueo con evidencia host-side.',
            focus_steps: [
                'clinic_canon_alignment',
                'web_surface_reintro',
                'remote_release_validation',
            ],
            focus_next_step: 'clinic_canon_alignment',
            focus_required_checks: [
                'test:turnero:web-pilot:contracts',
                'test:turnero:web-pilot:php-contract',
                'test:turnero:web-pilot:ui',
            ],
            focus_non_goals: [
                'desktop_electron',
                'android_tv_as_blocker',
                'public_commercial_surfaces',
                'payments',
                'multi_clinic',
            ],
            focus_owner: owner,
            focus_review_due_at: reviewDueAt,
            focus_evidence_ref: '',
            focus_max_active_slices: 2,
        };
    }
    throw new Error(
        `focus set-active: seed no soportado para estrategia ${strategyId || 'vacia'}`
    );
}

module.exports = {
    ACTIVE_TASK_STATUSES,
    ALLOWED_FOCUS_STATUSES,
    ALLOWED_WORK_TYPES,
    ALLOWED_INTEGRATION_SLICES,
    LANE_ALLOWED_SLICES,
    normalizeFocusStatus,
    normalizeStrategyFocus,
    getConfiguredFocus,
    getActiveFocus,
    normalizeTaskFocusFields,
    getAllowedSlicesForLane,
    ensureTaskFocusDefaults,
    validateFocusConfiguration,
    validateTaskFocusAlignment,
    evaluateRequiredChecks,
    hasFrontendRequiredCheck,
    hasLocalRequiredCheck,
    hasRuntimeRequiredCheck,
    listPendingRequiredChecks,
    hasPendingRequiredChecks,
    buildFocusSummary,
    buildLiveFocusSummary,
    refreshRequiredChecksSnapshot,
    buildFocusSeed,
    isAcknowledgedExternalBlockedTask,
    isAllowedExternalBlockerCarryoverTask,
    isFrontendRequiredCheckType,
    isLocalRequiredCheckType,
    loadLocalRequiredCheckSnapshot,
    loadRequiredChecksSnapshotContext,
    LOCAL_REQUIRED_CHECK_TYPES,
    LOCAL_REQUIRED_CHECK_SNAPSHOT_VERSION,
    REQUIRED_CHECKS_SNAPSHOT_VERSION,
    normalizeLocalRequiredCheckSnapshot,
    normalizeRequiredCheckId,
    parseRequiredCheckToken,
    resolveFocusCheckSnapshotPath,
    getRequiredChecksSnapshotPath,
    buildLocalRequiredCheckSnapshotFromEvidence,
};
