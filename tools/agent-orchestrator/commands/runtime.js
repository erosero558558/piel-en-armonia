'use strict';

const path = require('node:path');

const coreIo = require('../core/io');
const coreParsers = require('../core/parsers');
const domainFocus = require('../domain/focus');
const domainJobs = require('../domain/jobs');
const domainRuntime = require('../domain/runtime');

const ACTIVE_TASK_STATUSES = new Set([
    'ready',
    'in_progress',
    'review',
    'blocked',
]);

function readJobsRegistry(rootPath) {
    return coreIo.readJobsFile({
        jobsPath: path.resolve(rootPath, 'AGENT_JOBS.yaml'),
        exists: require('node:fs').existsSync,
        readFile: require('node:fs').readFileSync,
        parseJobsContent: coreParsers.parseJobsContent,
        currentDate: () => new Date().toISOString().slice(0, 10),
    });
}

async function loadJobsSnapshotLocal(rootPath, fetchImpl) {
    const registry = readJobsRegistry(rootPath);
    return domainJobs.buildJobsSnapshot(registry, {
        existsSync: require('node:fs').existsSync,
        readFileSync: require('node:fs').readFileSync,
        fetchImpl: typeof fetchImpl === 'function' ? fetchImpl : null,
    });
}

function buildFocusSummaryLocal(board, options = {}) {
    return domainFocus.buildFocusSummary(board, {
        ...options,
        activeStatuses: ACTIVE_TASK_STATUSES,
    });
}

async function buildLiveFocusSummaryLocal(
    board,
    {
        now,
        fetchImpl,
        verifyOpenClawRuntime,
        rootPath,
    } = {}
) {
    const jobs = await loadJobsSnapshotLocal(rootPath, fetchImpl);
    return domainFocus.buildLiveFocusSummary(board, {
        buildFocusSummary: buildFocusSummaryLocal,
        loadJobsSnapshot: async () => jobs,
        verifyOpenClawRuntime,
        now,
    });
}

function parseExpectedRevisionFromFlags(
    flags = {},
    parseExpectedBoardRevisionFlag,
    options = {}
) {
    const { required = false, commandLabel = 'runtime command' } = options;
    if (typeof parseExpectedBoardRevisionFlag !== 'function') return null;
    const parsed = parseExpectedBoardRevisionFlag(flags);
    if (parsed instanceof Error) throw parsed;
    if (required && (parsed === null || parsed === undefined)) {
        const error = new Error(
            `${commandLabel} requiere --expect-rev para evitar carreras de AGENT_BOARD.yaml`
        );
        error.code = 'expect_rev_required';
        error.error_code = 'expect_rev_required';
        throw error;
    }
    return parsed;
}

function normalizeRuntimeVerifyProvider(
    rawProvider,
    {
        pilotProvider,
        legacyProvider,
        canonicalProvider,
    }
) {
    const provider = String(rawProvider || '')
        .trim()
        .toLowerCase();
    if (!provider) {
        return {
            requested_provider: canonicalProvider,
            normalized_provider: canonicalProvider,
            legacy_alias_used: false,
        };
    }
    if (provider === legacyProvider) {
        return {
            requested_provider: provider,
            normalized_provider: canonicalProvider,
            legacy_alias_used: true,
        };
    }
    if (provider === canonicalProvider || provider === pilotProvider) {
        return {
            requested_provider: provider,
            normalized_provider: provider,
            legacy_alias_used: false,
        };
    }
    return null;
}

function buildRuntimeSurfaceStates(runtime = {}) {
    const diagnostics = Array.isArray(runtime?.summary?.diagnostics)
        ? runtime.summary.diagnostics
        : [];
    return diagnostics.map((item) => ({
        surface: String(item?.surface || '').trim() || null,
        state: String(item?.state || '').trim() || 'unknown',
        healthy: item?.healthy === true,
        blocking: item?.blocking === true,
        reason: String(item?.reason || '').trim() || null,
        message: String(item?.message || '').trim() || null,
        next_action: String(item?.next_action || '').trim() || null,
    }));
}

function buildRuntimeSharedIncident(runtime = {}, surfaceStates = []) {
    const blockingSurfaces = surfaceStates.filter((item) => item.blocking);
    if (blockingSurfaces.length === 0) return null;
    return {
        reason:
            String(runtime?.summary?.message || '').trim() ||
            `blocking runtime surfaces: ${blockingSurfaces
                .map((item) => item.surface)
                .filter(Boolean)
                .join(', ')}`,
        blocking_surfaces: blockingSurfaces
            .map((item) => item.surface)
            .filter(Boolean),
        overall_state: String(runtime?.overall_state || '').trim() || 'unhealthy',
    };
}

async function handleRuntimeCommand(ctx) {
    const {
        args = [],
        parseFlags,
        parseBoard,
        ensureTask,
        currentDate,
        isoNow,
        writeBoardAndSync,
        toTaskJson,
        printJson = (value) => console.log(JSON.stringify(value, null, 2)),
        verifyOpenClawRuntime,
        invokeOpenClawRuntime,
        buildLiveFocusSummary,
        parseExpectedBoardRevisionFlag,
        OPENCLAW_PROVIDER,
        PILOT_RUNTIME_PROVIDER,
        OPERATOR_AUTH_CANONICAL_PROVIDER,
        getGovernancePolicy,
        rootPath,
        fetchImpl,
    } = ctx;
    const runtimeModule = domainRuntime;
    const legacyProvider =
        OPENCLAW_PROVIDER || runtimeModule.OPENCLAW_PROVIDER;
    const pilotProvider =
        PILOT_RUNTIME_PROVIDER || runtimeModule.PILOT_RUNTIME_PROVIDER;
    const canonicalProvider =
        OPERATOR_AUTH_CANONICAL_PROVIDER ||
        runtimeModule.OPERATOR_AUTH_CANONICAL_PROVIDER;
    const subcommand = String(args[0] || 'verify')
        .trim()
        .toLowerCase();
    const wantsJson = args.includes('--json');
    const { flags, positionals } = parseFlags(args.slice(1));

    if (!['verify', 'invoke'].includes(subcommand)) {
        throw new Error(
            'Uso: node agent-orchestrator.js runtime <verify|invoke> [google_oauth|openclaw_chatgpt|pilot_runtime|task_id] [--expect-rev n] [--json]'
        );
    }

    if (subcommand === 'verify') {
        const normalized = normalizeRuntimeVerifyProvider(positionals[0], {
            pilotProvider,
            legacyProvider,
            canonicalProvider,
        });
        if (!normalized) {
            const provider = String(positionals[0] || '').trim().toLowerCase();
            const error = new Error(
                `runtime verify: provider invalido (${provider})`
            );
            error.code = 'invalid_provider';
            error.error_code = 'invalid_provider';
            throw error;
        }
        const runtime = await domainRuntime.verifyOpenClawRuntime({
            fetchImpl,
            governancePolicy: getGovernancePolicy(),
            rootPath,
            provider: normalized.normalized_provider,
        });
        const board = typeof parseBoard === 'function' ? parseBoard() : null;
        const liveFocus =
            board && typeof buildLiveFocusSummary === 'function'
                ? await buildLiveFocusSummary(board, {
                      now: new Date(),
                      verifyOpenClawRuntime: async () => runtime,
                  })
                : board
                  ? await buildLiveFocusSummaryLocal(board, {
                        now: new Date(),
                        fetchImpl,
                        rootPath,
                        verifyOpenClawRuntime: async () => runtime,
                    })
                : null;
        const requiredChecks = Array.isArray(liveFocus?.summary?.required_checks)
            ? liveFocus.summary.required_checks
            : [];
        const requiredChecksOk =
            requiredChecks.length > 0 &&
            requiredChecks.every((item) => item?.ok === true);
        const surfaceStates = buildRuntimeSurfaceStates(runtime);
        const sharedIncident = buildRuntimeSharedIncident(runtime, surfaceStates);
        const report = {
            version: 1,
            ok:
                Boolean(runtime.ok) &&
                (requiredChecks.length === 0 || requiredChecksOk),
            command: 'runtime verify',
            provider: runtime?.provider || normalized.normalized_provider,
            requested_provider: normalized.requested_provider,
            normalized_provider:
                runtime?.normalized_provider || normalized.normalized_provider,
            legacy_alias_used:
                runtime?.legacy_alias_used === true ||
                normalized.legacy_alias_used === true,
            surface_states: surfaceStates,
            shared_incident: sharedIncident,
            required_checks: requiredChecks,
            runtime,
        };
        if (wantsJson) {
            printJson(report);
            if (!report.ok) process.exitCode = 1;
            return report;
        }
        if (!report.ok) {
            const summaryMessage = String(
                sharedIncident?.reason || runtime?.summary?.message || ''
            ).trim();
            throw new Error(
                `runtime verify fallo para ${report.normalized_provider}: ${
                    summaryMessage ||
                    surfaceStates
                        .filter((surface) => !surface.healthy)
                        .map((surface) => surface.surface)
                        .join(', ')
                }`
            );
        }
        const runtimeState = String(runtime?.summary?.state || 'healthy').trim();
        console.log(
            `OK: ${report.normalized_provider} ${runtimeState === 'healthy' ? 'healthy' : `ready (${runtimeState})`} en ${
                String(runtime?.summary?.message || '').trim() ||
                surfaceStates
                    .map((surface) => `${surface.surface}=${surface.state}`)
                    .join(', ')
            }`
        );
        return report;
    }

    const taskId = String(positionals[0] || flags.id || '').trim();
    if (!taskId) {
        throw new Error('runtime invoke requiere task_id');
    }

    const board = parseBoard();
    const task = ensureTask(board, taskId);
    const expectRevision = parseExpectedRevisionFromFlags(
        flags,
        parseExpectedBoardRevisionFlag,
        { required: true, commandLabel: 'runtime invoke' }
    );
    const result = await invokeOpenClawRuntime(task, {
        fetchImpl,
        governancePolicy: getGovernancePolicy(),
        rootPath,
    });

    task.runtime_last_transport = String(result.runtime_transport || '').trim();
    task.last_attempt_at = isoNow();
    task.attempts =
        (Number.parseInt(String(task.attempts || '0'), 10) || 0) + 1;
    task.updated_at = currentDate();
    if (!result.ok) {
        task.blocked_reason = String(
            result.errorCode || result.error || 'runtime_invoke_failed'
        );
    } else {
        task.blocked_reason = '';
    }

    writeBoardAndSync(board, {
        silentSync: wantsJson,
        command: 'runtime invoke',
        actor: task.owner || 'runtime',
        expectRevision,
    });

    const report = {
        version: 1,
        ok: Boolean(result.ok),
        command: 'runtime invoke',
        task: toTaskJson(task),
        result,
    };
    if (wantsJson) {
        printJson(report);
        if (!report.ok) process.exitCode = 1;
        return report;
    }
    if (!report.ok) {
        throw new Error(
            `runtime invoke fallo para ${taskId}: ${result.errorCode || result.error || 'unknown_error'}`
        );
    }
    console.log(
        `Runtime invoke OK: ${taskId} -> ${result.runtime_surface} (${result.runtime_transport})`
    );
    return report;
}

module.exports = {
    handleRuntimeCommand,
};
