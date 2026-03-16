'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
    GENERATED_SITE_ROOT_RELATIVE,
    LEGACY_GENERATED_ROOT_DIRECTORIES,
    LEGACY_GENERATED_ROOT_FILES,
    isGeneratedSiteRootPath,
    isLegacyGeneratedRootPath,
    normalizeRelativePath,
} = require('./generated-site-root.js');
const {
    LOCAL_ARTIFACT_TARGETS,
    cleanArtifacts,
    collectExistingArtifacts,
} = require('../clean-local-artifacts.js');

const DOCTOR_VERSION = 3;
const DEFAULT_PATH_SAMPLE_LIMIT = 10;

const DERIVED_QUEUE_FILES = new Set(['jules_tasks.md', 'kimi_tasks.md']);
const DEPLOY_BUNDLE_RELATIVE = '_deploy_bundle';
const LOCAL_ARTIFACT_PATHS = LOCAL_ARTIFACT_TARGETS.map((target) =>
    normalizeRelativePath(target.path)
);
const LEGACY_GENERATED_ROOT_CONTRACT_PATHS = [
    ...LEGACY_GENERATED_ROOT_DIRECTORIES,
    ...LEGACY_GENERATED_ROOT_FILES,
].sort();

const GENERATED_STAGE_CATEGORY = 'generated_stage';
const DEPLOY_BUNDLE_CATEGORY = 'deploy_bundle';
const LOCAL_ARTIFACT_CATEGORY = 'local_artifact';
const DERIVED_QUEUE_CATEGORY = 'derived_queue';
const AUTHORED_CATEGORY = 'authored';
const LEGACY_GENERATED_ROOT_CATEGORY = 'legacy_generated_root';
const LEGACY_GENERATED_ROOT_DEINDEXED_CATEGORY =
    'legacy_generated_root_deindexed';

const ISSUE_SEVERITY_ERROR = 'error';
const ISSUE_SEVERITY_BLOCKING = 'blocking';
const ISSUE_SEVERITY_FIXABLE = 'fixable';

const DOCTOR_STATE_ERROR = 'error';
const DOCTOR_STATE_BLOCKED = 'blocked';
const DOCTOR_STATE_FIXABLE = 'fixable';
const DOCTOR_STATE_CLEAN = 'clean';
const DOCTOR_STATE_PENDING_COMMIT = DOCTOR_STATE_BLOCKED;
const WORKTREE_STATES = [
    DOCTOR_STATE_ERROR,
    DOCTOR_STATE_BLOCKED,
    DOCTOR_STATE_FIXABLE,
    DOCTOR_STATE_CLEAN,
];
const WORKTREE_STATE_PRIORITY = new Map(
    WORKTREE_STATES.map((state, index) => [state, index])
);

const EPHEMERAL_DIRTY_CATEGORIES = new Set([
    GENERATED_STAGE_CATEGORY,
    DEPLOY_BUNDLE_CATEGORY,
    DERIVED_QUEUE_CATEGORY,
    LOCAL_ARTIFACT_CATEGORY,
]);
const IGNORED_PUBLISH_DIRTY_CATEGORIES = new Set([
    GENERATED_STAGE_CATEGORY,
    DEPLOY_BUNDLE_CATEGORY,
    DERIVED_QUEUE_CATEGORY,
    LOCAL_ARTIFACT_CATEGORY,
]);
const BLOCKING_DIRTY_CATEGORIES = new Set([
    AUTHORED_CATEGORY,
    LEGACY_GENERATED_ROOT_CATEGORY,
    LEGACY_GENERATED_ROOT_DEINDEXED_CATEGORY,
]);

const ISSUE_CATEGORY_ORDER = [
    LEGACY_GENERATED_ROOT_DEINDEXED_CATEGORY,
    LEGACY_GENERATED_ROOT_CATEGORY,
    AUTHORED_CATEGORY,
    GENERATED_STAGE_CATEGORY,
    DEPLOY_BUNDLE_CATEGORY,
    LOCAL_ARTIFACT_CATEGORY,
    DERIVED_QUEUE_CATEGORY,
];
const ISSUE_CATEGORY_PRIORITY = new Map(
    ISSUE_CATEGORY_ORDER.map((category, index) => [category, index])
);
const ISSUE_SEVERITY_PRIORITY = new Map([
    [ISSUE_SEVERITY_ERROR, 0],
    [ISSUE_SEVERITY_BLOCKING, 1],
    [ISSUE_SEVERITY_FIXABLE, 2],
]);

const REMEDIATION_STEP_DEFINITIONS = {
    apply_safe: {
        id: 'apply_safe',
        summary:
            'Limpia `.generated/site-root/`, `_deploy_bundle/`, artefactos locales y colas derivadas sin tocar source authored.',
        command: 'npm run workspace:hygiene:fix',
    },
    commit_or_stash_legacy_deindex: {
        id: 'commit_or_stash_legacy_deindex',
        summary:
            'Confirma o aparta las eliminaciones staged del deindexado legacy antes de publicar o sincronizar.',
        command:
            'git commit -m "chore(frontend): deindex legacy generated root outputs"',
    },
    legacy_root_cleanup: {
        id: 'review_authored_changes',
        summary:
            'Desindexa las copias legacy trackeadas del root sin borrar los archivos locales.',
        command: 'npm run legacy:generated-root:apply',
    },
    review_authored_changes: {
        id: 'review_authored_changes',
        summary:
            'Revisa o mueve los cambios authored antes de intentar publish o sync.',
        command: 'git status --short',
    },
    rerun_doctor: {
        id: 'rerun_doctor',
        summary:
            'Vuelve a correr el doctor para confirmar el estado final del workspace.',
        command: 'npm run workspace:hygiene:doctor',
    },
};

const ISSUE_CONFIG = {
    [AUTHORED_CATEGORY]: {
        severity: ISSUE_SEVERITY_BLOCKING,
        blocksPublish: false,
        blocksSync: true,
        blocksCi: true,
        command: REMEDIATION_STEP_DEFINITIONS.review_authored_changes.command,
        summary(count) {
            return `Hay ${count} cambio(s) authored fuera del ruido efimero permitido.`;
        },
    },
    [GENERATED_STAGE_CATEGORY]: {
        severity: ISSUE_SEVERITY_FIXABLE,
        blocksPublish: false,
        blocksSync: false,
        blocksCi: false,
        command: REMEDIATION_STEP_DEFINITIONS.apply_safe.command,
        summary(count) {
            return `Hay ${count} output(s) generados bajo \`.generated/site-root/\` listos para limpieza segura.`;
        },
    },
    [DEPLOY_BUNDLE_CATEGORY]: {
        severity: ISSUE_SEVERITY_FIXABLE,
        blocksPublish: false,
        blocksSync: false,
        blocksCi: false,
        command: REMEDIATION_STEP_DEFINITIONS.apply_safe.command,
        summary(count) {
            return `Hay ${count} output(s) en \`_deploy_bundle/\` listos para limpieza segura.`;
        },
    },
    [LOCAL_ARTIFACT_CATEGORY]: {
        severity: ISSUE_SEVERITY_FIXABLE,
        blocksPublish: false,
        blocksSync: false,
        blocksCi: false,
        command: REMEDIATION_STEP_DEFINITIONS.apply_safe.command,
        summary(count) {
            return `Hay ${count} artefacto(s) locales efimeros listos para limpieza segura.`;
        },
    },
    [DERIVED_QUEUE_CATEGORY]: {
        severity: ISSUE_SEVERITY_FIXABLE,
        blocksPublish: false,
        blocksSync: false,
        blocksCi: false,
        command: REMEDIATION_STEP_DEFINITIONS.apply_safe.command,
        summary(count) {
            return `Hay ${count} snapshot(s) derivados de colas de agentes listos para restaurar.`;
        },
    },
    [LEGACY_GENERATED_ROOT_CATEGORY]: {
        severity: ISSUE_SEVERITY_BLOCKING,
        blocksPublish: true,
        blocksSync: true,
        blocksCi: true,
        command: REMEDIATION_STEP_DEFINITIONS.legacy_root_cleanup.command,
        summary(count) {
            return `Hay ${count} path(s) legacy del repo root que siguen versionados o modificados fuera del contrato canonico.`;
        },
    },
    [LEGACY_GENERATED_ROOT_DEINDEXED_CATEGORY]: {
        severity: ISSUE_SEVERITY_BLOCKING,
        blocksPublish: true,
        blocksSync: true,
        blocksCi: true,
        command:
            REMEDIATION_STEP_DEFINITIONS.commit_or_stash_legacy_deindex.command,
        summary(count) {
            return `Hay ${count} eliminacion(es) staged del deindexado legacy pendientes de commit o stash.`;
        },
    },
};

function parseGitStatusPorcelain(raw = '') {
    return String(raw || '')
        .split(/\r?\n/)
        .map((line) => line.replace(/\r$/, ''))
        .filter((line) => line.trim() !== '')
        .map((line) => {
            const status = line.slice(0, 2);
            const rawPath = line.slice(3).trim();
            const normalizedPath = normalizeRelativePath(
                rawPath.includes(' -> ') ? rawPath.split(' -> ').pop() : rawPath
            );
            return {
                status,
                rawPath: rawPath.includes(' -> ')
                    ? rawPath.split(' -> ').pop()
                    : rawPath,
                path: normalizedPath,
            };
        })
        .filter((entry) => entry.path);
}

function parseNullSeparated(value = '') {
    return String(value || '')
        .split('\0')
        .map((entry) => normalizeRelativePath(entry))
        .filter(Boolean)
        .sort();
}

function isDeployBundlePath(pathValue) {
    const normalized = normalizeRelativePath(pathValue).toLowerCase();
    const prefix = `${DEPLOY_BUNDLE_RELATIVE}/`.toLowerCase();
    return (
        normalized === DEPLOY_BUNDLE_RELATIVE.toLowerCase() ||
        normalized.startsWith(prefix)
    );
}

function isLocalArtifactPath(pathValue) {
    const normalized = normalizeRelativePath(pathValue).toLowerCase();
    return LOCAL_ARTIFACT_PATHS.some((targetPath) => {
        const target = targetPath.toLowerCase();
        return normalized === target || normalized.startsWith(`${target}/`);
    });
}

function classifyDirtyPath(pathValue) {
    const normalized = normalizeRelativePath(pathValue);
    if (!normalized) {
        return AUTHORED_CATEGORY;
    }

    if (isGeneratedSiteRootPath(normalized)) {
        return GENERATED_STAGE_CATEGORY;
    }

    if (isDeployBundlePath(normalized)) {
        return DEPLOY_BUNDLE_CATEGORY;
    }

    if (isLegacyGeneratedRootPath(normalized)) {
        return LEGACY_GENERATED_ROOT_CATEGORY;
    }

    if (DERIVED_QUEUE_FILES.has(normalized.toLowerCase())) {
        return DERIVED_QUEUE_CATEGORY;
    }

    if (isLocalArtifactPath(normalized)) {
        return LOCAL_ARTIFACT_CATEGORY;
    }

    return AUTHORED_CATEGORY;
}

function classifyDirtyEntries(entries = []) {
    return entries.map((entry) => ({
        ...entry,
        category: classifyDirtyPath(entry.path),
    }));
}

function annotateLegacyDirtyEntries(entries = [], trackedPaths = []) {
    const trackedSet = new Set(
        (Array.isArray(trackedPaths) ? trackedPaths : []).map((entry) =>
            normalizeRelativePath(entry)
        )
    );

    return (Array.isArray(entries) ? entries : []).map((entry) => {
        if (entry.category !== LEGACY_GENERATED_ROOT_CATEGORY) {
            return entry;
        }

        const normalizedPath = normalizeRelativePath(entry.path);
        const isIndexDeletion =
            String(entry.status || '').startsWith('D') &&
            !trackedSet.has(normalizedPath);

        if (!isIndexDeletion) {
            return entry;
        }

        return {
            ...entry,
            category: LEGACY_GENERATED_ROOT_DEINDEXED_CATEGORY,
        };
    });
}

function summarizeDirtyEntries(entries = []) {
    const summary = {
        total: entries.length,
        byCategory: {},
    };

    for (const entry of entries) {
        const category = entry.category || classifyDirtyPath(entry.path);
        summary.byCategory[category] = (summary.byCategory[category] || 0) + 1;
    }

    return summary;
}

function isEphemeralDirtyCategory(category) {
    return EPHEMERAL_DIRTY_CATEGORIES.has(String(category || '').trim());
}

function isIgnoredPublishDirtyCategory(category) {
    return IGNORED_PUBLISH_DIRTY_CATEGORIES.has(String(category || '').trim());
}

function runGit(args, cwd, capture = true) {
    return spawnSync('git', args, {
        cwd,
        encoding: 'utf8',
        stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
}

function listTrackedLegacyGeneratedRootPaths(cwd) {
    const result = runGit(
        ['ls-files', '-z', '--', ...LEGACY_GENERATED_ROOT_CONTRACT_PATHS],
        cwd,
        true
    );
    if (result.status !== 0) {
        throw new Error(
            result.stderr ||
                result.stdout ||
                'git ls-files legacy generated root failed'
        );
    }
    return parseNullSeparated(result.stdout);
}

function readDirtyEntries(cwd, options = {}) {
    const trackedLegacyPaths = Array.isArray(options.trackedLegacyPaths)
        ? options.trackedLegacyPaths
        : listTrackedLegacyGeneratedRootPaths(cwd);
    const result = runGit(
        ['status', '--porcelain', '--untracked-files=all'],
        cwd,
        true
    );
    if (result.status !== 0) {
        throw new Error(result.stderr || result.stdout || 'git status failed');
    }
    const classifiedEntries = classifyDirtyEntries(
        parseGitStatusPorcelain(result.stdout)
    );
    return annotateLegacyDirtyEntries(classifiedEntries, trackedLegacyPaths);
}

function parseWorktreeList(raw) {
    const lines = String(raw || '').split(/\r?\n/);
    const worktrees = [];
    let current = null;

    for (const line of lines) {
        if (!line.trim()) {
            continue;
        }
        if (line.startsWith('worktree ')) {
            if (current) {
                worktrees.push(current);
            }
            current = {
                path: line.slice(9).trim(),
                branch: '',
                detached: false,
            };
            continue;
        }
        if (!current) continue;
        if (line.startsWith('branch ')) {
            current.branch = line.slice(7).replace(/^refs\/heads\//, '').trim();
            continue;
        }
        if (line === 'detached') {
            current.detached = true;
        }
    }

    if (current) {
        worktrees.push(current);
    }

    return worktrees;
}

function listWorktrees(cwd) {
    const result = runGit(['worktree', 'list', '--porcelain'], cwd, true);
    if (result.status !== 0) {
        throw new Error(
            result.stderr || result.stdout || 'git worktree list failed'
        );
    }
    return parseWorktreeList(result.stdout);
}

function readCurrentBranch(cwd) {
    const result = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd, true);
    if (result.status !== 0) {
        return '(unknown)';
    }
    const branch = String(result.stdout || '').trim();
    return branch === 'HEAD' ? '(detached)' : branch || '(unknown)';
}

function normalizeIssuePaths(paths = []) {
    return Array.from(
        new Set(
            (Array.isArray(paths) ? paths : [])
                .map((entry) => normalizeRelativePath(entry))
                .filter(Boolean)
        )
    ).sort();
}

function getIssueConfig(category) {
    return (
        ISSUE_CONFIG[category] || {
            severity: ISSUE_SEVERITY_BLOCKING,
            blocksPublish: true,
            blocksSync: true,
            blocksCi: true,
            command: REMEDIATION_STEP_DEFINITIONS.review_authored_changes.command,
            summary(count) {
                return `Hay ${count} cambio(s) en la categoria ${category}.`;
            },
        }
    );
}

function buildIssueFromPaths(category, paths = [], options = {}) {
    const normalizedPaths = normalizeIssuePaths(paths);
    const sampleLimit = Number.isFinite(options.sampleLimit)
        ? Math.max(1, Math.floor(options.sampleLimit))
        : DEFAULT_PATH_SAMPLE_LIMIT;
    const count = Number.isFinite(options.count)
        ? Number(options.count)
        : normalizedPaths.length;
    const pathsSample = normalizedPaths.slice(0, sampleLimit);
    const config = getIssueConfig(category);
    return {
        category,
        severity: config.severity,
        count,
        paths_sample: pathsSample,
        remaining_count: Math.max(0, normalizedPaths.length - pathsSample.length),
        blocks_publish: Boolean(config.blocksPublish),
        blocks_sync: Boolean(config.blocksSync),
        blocks_ci: Boolean(config.blocksCi),
        suggested_command: config.command,
        summary: config.summary(count),
    };
}

function buildIssueFromEntries(category, entries = [], options = {}) {
    const safeEntries = Array.isArray(entries) ? entries : [];
    return buildIssueFromPaths(
        category,
        safeEntries.map((entry) => entry.path),
        {
            ...options,
            count: safeEntries.length,
        }
    );
}

function sortIssues(issues = []) {
    return [...issues].sort((left, right) => {
        const severityDiff =
            (ISSUE_SEVERITY_PRIORITY.get(left.severity) ?? 999) -
            (ISSUE_SEVERITY_PRIORITY.get(right.severity) ?? 999);
        if (severityDiff !== 0) {
            return severityDiff;
        }

        const categoryDiff =
            (ISSUE_CATEGORY_PRIORITY.get(left.category) ?? 999) -
            (ISSUE_CATEGORY_PRIORITY.get(right.category) ?? 999);
        if (categoryDiff !== 0) {
            return categoryDiff;
        }

        const countDiff = Number(right.count || 0) - Number(left.count || 0);
        if (countDiff !== 0) {
            return countDiff;
        }

        return String(left.category || '').localeCompare(
            String(right.category || '')
        );
    });
}

function buildIssues(entries = [], options = {}) {
    const grouped = new Map();
    for (const entry of Array.isArray(entries) ? entries : []) {
        const category = entry.category || classifyDirtyPath(entry.path);
        if (!grouped.has(category)) {
            grouped.set(category, []);
        }
        grouped.get(category).push(entry);
    }

    const issues = ISSUE_CATEGORY_ORDER.filter((category) => grouped.has(category))
        .map((category) =>
            buildIssueFromEntries(category, grouped.get(category), {
                sampleLimit: options.sampleLimit,
            })
        );

    return sortIssues(issues);
}

function buildIssueCounts(issues = []) {
    const counts = {};
    for (const issue of Array.isArray(issues) ? issues : []) {
        counts[issue.category] = Number(issue.count || 0);
    }
    return counts;
}

function hasIssue(issueCounts = {}, category) {
    return Number(issueCounts[category] || 0) > 0;
}

function hasEphemeralIssue(issueCounts = {}) {
    return ISSUE_CATEGORY_ORDER.some(
        (category) =>
            EPHEMERAL_DIRTY_CATEGORIES.has(category) && hasIssue(issueCounts, category)
    );
}

function buildBlockingCategories(issueCounts = {}) {
    return ISSUE_CATEGORY_ORDER.filter(
        (category) =>
            BLOCKING_DIRTY_CATEGORIES.has(category) && hasIssue(issueCounts, category)
    );
}

function buildSafeFixes(issueCounts = {}) {
    const fixes = [];

    if (hasEphemeralIssue(issueCounts)) {
        fixes.push({
            id: 'apply_safe',
            description:
                'Limpia stage root, deploy bundle, artefactos locales y colas derivadas sin tocar source authored.',
            command: REMEDIATION_STEP_DEFINITIONS.apply_safe.command,
        });
    }

    if (hasIssue(issueCounts, LOCAL_ARTIFACT_CATEGORY)) {
        fixes.push({
            id: 'clean_local_artifacts',
            description: 'Limpia solo artefactos efimeros locales conocidos.',
            command: 'npm run clean:local:artifacts',
        });
    }

    return fixes;
}

function buildManualActions(issueCounts = {}) {
    const actions = [];

    if (hasIssue(issueCounts, LEGACY_GENERATED_ROOT_CATEGORY)) {
        actions.push({
            id: 'legacy_generated_root_apply',
            description:
                'Desindexa las copias legacy trackeadas del root sin borrar los archivos locales.',
            command: REMEDIATION_STEP_DEFINITIONS.legacy_root_cleanup.command,
        });
    }

    if (hasIssue(issueCounts, LEGACY_GENERATED_ROOT_DEINDEXED_CATEGORY)) {
        actions.push({
            id: 'legacy_generated_root_commit',
            description:
                'Confirma o aparta las eliminaciones staged del deindexado legacy antes de publicar o sincronizar.',
            command:
                REMEDIATION_STEP_DEFINITIONS.commit_or_stash_legacy_deindex.command,
        });
    }

    if (hasIssue(issueCounts, AUTHORED_CATEGORY)) {
        actions.push({
            id: 'inspect_authored_changes',
            description:
                'Revisa o mueve los cambios authored antes de intentar publish o sync.',
            command: REMEDIATION_STEP_DEFINITIONS.review_authored_changes.command,
        });
    }

    return actions;
}

function buildRemediationPlan(issueCounts = {}, options = {}) {
    const plan = [];

    if (hasEphemeralIssue(issueCounts)) {
        plan.push({ ...REMEDIATION_STEP_DEFINITIONS.apply_safe });
    }

    if (hasIssue(issueCounts, LEGACY_GENERATED_ROOT_DEINDEXED_CATEGORY)) {
        plan.push({
            ...REMEDIATION_STEP_DEFINITIONS.commit_or_stash_legacy_deindex,
        });
    }

    if (hasIssue(issueCounts, LEGACY_GENERATED_ROOT_CATEGORY)) {
        plan.push({ ...REMEDIATION_STEP_DEFINITIONS.legacy_root_cleanup });
    }

    if (hasIssue(issueCounts, AUTHORED_CATEGORY)) {
        plan.push({ ...REMEDIATION_STEP_DEFINITIONS.review_authored_changes });
    }

    if (
        Object.keys(issueCounts).length > 0 ||
        options.forceRerun ||
        options.error
    ) {
        plan.push({ ...REMEDIATION_STEP_DEFINITIONS.rerun_doctor });
    }

    return plan;
}

function resolveOverallState(issues = [], error = null) {
    if (error) {
        return DOCTOR_STATE_ERROR;
    }

    if (!Array.isArray(issues) || issues.length === 0) {
        return DOCTOR_STATE_CLEAN;
    }

    if (
        issues.some(
            (issue) =>
                issue.blocks_publish || issue.blocks_sync || issue.blocks_ci
        )
    ) {
        return DOCTOR_STATE_BLOCKED;
    }

    return DOCTOR_STATE_FIXABLE;
}

function buildNextCommand(overallState, remediationPlan = [], error = null) {
    if (overallState === DOCTOR_STATE_ERROR || error) {
        return 'git worktree list --porcelain';
    }
    return remediationPlan.length > 0 ? remediationPlan[0].command : '';
}

function buildIssueDiagnosis(entries = [], options = {}) {
    const dirtyEntries = Array.isArray(entries) ? entries : [];
    const issues = sortIssues(
        Array.isArray(options.issues)
            ? options.issues
            : buildIssues(dirtyEntries, {
                  sampleLimit: options.sampleLimit,
              })
    );
    const issueCounts = buildIssueCounts(issues);
    const summary = summarizeDirtyEntries(dirtyEntries);
    const overallState = resolveOverallState(issues, options.error);
    const remediationPlan = buildRemediationPlan(issueCounts, {
        error: options.error,
        forceRerun:
            overallState !== DOCTOR_STATE_CLEAN ||
            Boolean(options.forceRerun),
    });
    return {
        overall_state: overallState,
        dirty_total: Number(summary.total || 0),
        issue_counts: issueCounts,
        issues,
        remediation_plan: remediationPlan,
        next_command: buildNextCommand(
            overallState,
            remediationPlan,
            options.error
        ),
        summary,
        blockingCategories: buildBlockingCategories(issueCounts),
        safeFixes: buildSafeFixes(issueCounts),
        manualActions: buildManualActions(issueCounts),
    };
}

function serializeDirtyEntry(entry) {
    return {
        status: entry.status,
        path: entry.path,
        raw_path: entry.rawPath,
        category: entry.category,
    };
}

function toDoctorRowPayload(row, options = {}) {
    const payload = {
        path: row.path,
        branch: row.branch,
        overall_state: row.overall_state,
        dirty_total: row.dirty_total,
        issue_counts: row.issue_counts,
        issues: row.issues,
        remediation_plan: row.remediation_plan,
        next_command: row.next_command,
    };

    if (Array.isArray(row.removed) && row.removed.length > 0) {
        payload.removed = row.removed;
    }

    if (options.includeEntries) {
        payload.dirty_entries = Array.isArray(row.dirtyEntries)
            ? row.dirtyEntries.map(serializeDirtyEntry)
            : [];
    }

    if (row.error) {
        payload.error = row.error;
    }

    return payload;
}

function buildDoctorPayload(diagnosis, options = {}) {
    const rows = Array.isArray(diagnosis?.rows)
        ? diagnosis.rows.map((row) => toDoctorRowPayload(row, options))
        : [];
    return {
        version: DOCTOR_VERSION,
        command: options.command || 'workspace-hygiene doctor',
        summary: diagnosis?.summary || buildDoctorSummary([]),
        rows,
        ok: rows.every((row) => row.overall_state === DOCTOR_STATE_CLEAN),
    };
}

function buildErrorRow(rootPath, branch, error) {
    const diagnosis = buildIssueDiagnosis([], {
        error,
        forceRerun: true,
    });
    return {
        path: rootPath,
        branch,
        dirtyEntries: [],
        ...diagnosis,
        error: String(error && error.message ? error.message : error),
    };
}

function diagnoseWorktree(rootPath, options = {}) {
    const trackedLegacyPaths = Array.isArray(options.trackedLegacyPaths)
        ? options.trackedLegacyPaths
        : listTrackedLegacyGeneratedRootPaths(rootPath);
    const dirtyEntries = Array.isArray(options.dirtyEntries)
        ? annotateLegacyDirtyEntries(options.dirtyEntries, trackedLegacyPaths)
        : readDirtyEntries(rootPath, { trackedLegacyPaths });
    const branch = options.branch
        ? String(options.branch)
        : readCurrentBranch(rootPath);
    const diagnosis = buildIssueDiagnosis(dirtyEntries, {
        sampleLimit: options.sampleLimit,
    });

    return {
        path: rootPath,
        branch,
        dirtyEntries,
        ...diagnosis,
    };
}

function topIssuePriority(row) {
    const firstIssue = Array.isArray(row.issues) ? row.issues[0] : null;
    if (!firstIssue) {
        return 999;
    }
    return ISSUE_CATEGORY_PRIORITY.get(firstIssue.category) ?? 999;
}

function sortDoctorRows(rows = []) {
    return [...rows].sort((left, right) => {
        const stateDiff =
            (WORKTREE_STATE_PRIORITY.get(left.overall_state) ?? 999) -
            (WORKTREE_STATE_PRIORITY.get(right.overall_state) ?? 999);
        if (stateDiff !== 0) {
            return stateDiff;
        }

        const issuePriorityDiff = topIssuePriority(left) - topIssuePriority(right);
        if (issuePriorityDiff !== 0) {
            return issuePriorityDiff;
        }

        const dirtyDiff =
            Number(right.dirty_total || 0) - Number(left.dirty_total || 0);
        if (dirtyDiff !== 0) {
            return dirtyDiff;
        }

        return String(left.path || '').localeCompare(String(right.path || ''));
    });
}

function buildDoctorSummary(rows = []) {
    const issueTotals = {};
    for (const row of rows) {
        for (const [category, count] of Object.entries(row.issue_counts || {})) {
            issueTotals[category] = (issueTotals[category] || 0) + Number(count || 0);
        }
    }

    return {
        total_worktrees: rows.length,
        dirty_worktrees: rows.filter((row) => Number(row.dirty_total || 0) > 0)
            .length,
        blocked_worktrees: rows.filter(
            (row) => row.overall_state === DOCTOR_STATE_BLOCKED
        ).length,
        fixable_worktrees: rows.filter(
            (row) => row.overall_state === DOCTOR_STATE_FIXABLE
        ).length,
        clean_worktrees: rows.filter(
            (row) => row.overall_state === DOCTOR_STATE_CLEAN
        ).length,
        error_worktrees: rows.filter(
            (row) => row.overall_state === DOCTOR_STATE_ERROR
        ).length,
        issue_totals: {
            byCategory: Object.fromEntries(
                ISSUE_CATEGORY_ORDER.filter((category) => issueTotals[category] > 0)
                    .map((category) => [category, issueTotals[category]])
            ),
        },
    };
}

function collectDoctorTargets(cwd, options = {}) {
    const allWorktrees = options.currentOnly
        ? false
        : options.allWorktrees !== false;
    if (!allWorktrees) {
        return [
            {
                path: cwd,
                branch: readCurrentBranch(cwd),
                detached: false,
            },
        ];
    }

    const listedWorktrees = listWorktrees(cwd);
    if (listedWorktrees.length > 0) {
        return listedWorktrees;
    }

    return [
        {
            path: cwd,
            branch: readCurrentBranch(cwd),
            detached: false,
        },
    ];
}

function collectWorkspaceDoctor(cwd, options = {}) {
    const targets = collectDoctorTargets(cwd, options);
    const rows = [];

    for (const target of targets) {
        const branch = target.detached
            ? '(detached)'
            : target.branch || readCurrentBranch(target.path);
        try {
            if (options.applySafe) {
                rows.push(
                    fixWorkspace(target.path, {
                        includeDerivedQueue: options.includeDerivedQueue !== false,
                        branch,
                    })
                );
                continue;
            }

            rows.push(
                diagnoseWorktree(target.path, {
                    branch,
                    sampleLimit: options.sampleLimit,
                })
            );
        } catch (error) {
            rows.push(buildErrorRow(target.path, branch, error));
        }
    }

    const sortedRows = sortDoctorRows(rows);
    return {
        rows: sortedRows,
        summary: buildDoctorSummary(sortedRows),
    };
}

function restoreDerivedQueueFiles(cwd) {
    const dirtyEntries = readDirtyEntries(cwd).filter((entry) =>
        DERIVED_QUEUE_FILES.has(entry.path.toLowerCase())
    );

    if (dirtyEntries.length === 0) {
        return [];
    }

    const files = dirtyEntries.map((entry) => entry.rawPath);
    const result = runGit(
        ['restore', '--worktree', '--source=HEAD', '--', ...files],
        cwd,
        true
    );
    if (result.status !== 0) {
        throw new Error(
            result.stderr || result.stdout || 'git restore derived queue failed'
        );
    }

    const refreshResult = runGit(
        ['update-index', '-q', '--refresh', '--', ...files],
        cwd,
        true
    );
    if (refreshResult.status !== 0) {
        throw new Error(
            refreshResult.stderr ||
                refreshResult.stdout ||
                'git update-index refresh derived queue failed'
        );
    }

    return files.map((file) => normalizeRelativePath(file));
}

function removeDirectoryIfPresent(rootPath, relativePath) {
    const absolutePath = path.resolve(rootPath, relativePath);
    if (!fs.existsSync(absolutePath)) {
        return false;
    }

    fs.rmSync(absolutePath, { recursive: true, force: true });
    return true;
}

function fixWorkspace(rootPath, options = {}) {
    const includeDerivedQueue = options.includeDerivedQueue !== false;
    const removed = [];

    if (removeDirectoryIfPresent(rootPath, GENERATED_SITE_ROOT_RELATIVE)) {
        removed.push(GENERATED_SITE_ROOT_RELATIVE);
    }

    if (removeDirectoryIfPresent(rootPath, DEPLOY_BUNDLE_RELATIVE)) {
        removed.push(DEPLOY_BUNDLE_RELATIVE);
    }

    const localArtifacts = collectExistingArtifacts(rootPath);
    const cleanedArtifacts = cleanArtifacts(localArtifacts, { dryRun: false });
    if (cleanedArtifacts.failures.length > 0) {
        throw new Error(
            cleanedArtifacts.failures
                .map(
                    (failure) =>
                        `${failure.artifact.relativePath}: ${failure.error.message}`
                )
                .join('\n')
        );
    }
    removed.push(
        ...cleanedArtifacts.removed.map((artifact) => artifact.relativePath)
    );

    if (includeDerivedQueue) {
        removed.push(...restoreDerivedQueueFiles(rootPath));
    }

    const diagnosis = diagnoseWorktree(rootPath, {
        branch: options.branch,
    });
    const authoredEntries = diagnosis.dirtyEntries.filter(
        (entry) => entry.category === AUTHORED_CATEGORY
    );
    const blockingEntries = diagnosis.dirtyEntries.filter((entry) =>
        BLOCKING_DIRTY_CATEGORIES.has(entry.category)
    );

    return {
        ...diagnosis,
        removed: Array.from(new Set(removed)).sort(),
        authoredEntries,
        blockingEntries,
        ok: diagnosis.overall_state === DOCTOR_STATE_CLEAN,
    };
}

function getBlockingIssues(diagnosis, mode = 'publish') {
    const key =
        mode === 'sync'
            ? 'blocks_sync'
            : mode === 'ci'
              ? 'blocks_ci'
              : 'blocks_publish';
    return sortIssues(
        (Array.isArray(diagnosis?.issues) ? diagnosis.issues : []).filter(
            (issue) => Boolean(issue[key])
        )
    );
}

function formatIssueSummary(issues = []) {
    return (Array.isArray(issues) ? issues : [])
        .map((issue) => `${issue.category}=${issue.count}`)
        .join(', ');
}

function getFirstRemediationStep(diagnosis) {
    return Array.isArray(diagnosis?.remediation_plan) &&
        diagnosis.remediation_plan.length > 0
        ? diagnosis.remediation_plan[0]
        : null;
}

module.exports = {
    AUTHORED_CATEGORY,
    BLOCKING_DIRTY_CATEGORIES,
    DEFAULT_PATH_SAMPLE_LIMIT,
    DEPLOY_BUNDLE_CATEGORY,
    DEPLOY_BUNDLE_RELATIVE,
    DERIVED_QUEUE_CATEGORY,
    DERIVED_QUEUE_FILES,
    DOCTOR_STATE_BLOCKED,
    DOCTOR_STATE_CLEAN,
    DOCTOR_STATE_ERROR,
    DOCTOR_STATE_FIXABLE,
    DOCTOR_STATE_PENDING_COMMIT,
    DOCTOR_VERSION,
    EPHEMERAL_DIRTY_CATEGORIES,
    GENERATED_STAGE_CATEGORY,
    IGNORED_PUBLISH_DIRTY_CATEGORIES,
    ISSUE_CATEGORY_ORDER,
    ISSUE_SEVERITY_BLOCKING,
    ISSUE_SEVERITY_ERROR,
    ISSUE_SEVERITY_FIXABLE,
    LEGACY_GENERATED_ROOT_CATEGORY,
    LEGACY_GENERATED_ROOT_CONTRACT_PATHS,
    LEGACY_GENERATED_ROOT_DEINDEXED_CATEGORY,
    LOCAL_ARTIFACT_CATEGORY,
    LOCAL_ARTIFACT_PATHS,
    WORKTREE_STATES,
    annotateLegacyDirtyEntries,
    buildBlockingCategories,
    buildDoctorPayload,
    buildDoctorSummary,
    buildIssueCounts,
    buildIssueDiagnosis,
    buildIssueFromEntries,
    buildIssueFromPaths,
    buildIssues,
    buildManualActions,
    buildNextCommand,
    buildRemediationPlan,
    buildSafeFixes,
    classifyDirtyEntries,
    classifyDirtyPath,
    collectWorkspaceDoctor,
    diagnoseWorktree,
    fixWorkspace,
    formatIssueSummary,
    getBlockingIssues,
    getFirstRemediationStep,
    isDeployBundlePath,
    isEphemeralDirtyCategory,
    isIgnoredPublishDirtyCategory,
    isLocalArtifactPath,
    listTrackedLegacyGeneratedRootPaths,
    listWorktrees,
    parseGitStatusPorcelain,
    readDirtyEntries,
    resolveOverallState,
    sortDoctorRows,
    sortIssues,
    summarizeDirtyEntries,
    toDoctorRowPayload,
};
