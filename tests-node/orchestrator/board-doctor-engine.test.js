#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const boardDoctor = require('../../tools/agent-orchestrator/domain/board-doctor');
const boardLeases = require('../../tools/agent-orchestrator/domain/board-leases');
const diagnostics = require('../../tools/agent-orchestrator/domain/diagnostics');

test('board-doctor reporta lease missing en task in_progress sin lease', () => {
    const board = {
        tasks: [
            {
                id: 'AG-001',
                owner: 'ernesto',
                executor: 'jules',
                status: 'in_progress',
                scope: 'ops',
                files: ['docs/a.md'],
                updated_at: '2026-02-25',
            },
        ],
    };
    const policy = {
        enforcement: {
            warning_policies: {
                lease_missing_active: { enabled: true, severity: 'warning' },
                lease_expired_active: { enabled: true, severity: 'warning' },
                heartbeat_stale: { enabled: true, severity: 'warning' },
                task_in_progress_stale: { enabled: true, severity: 'warning' },
                task_blocked_stale: { enabled: true, severity: 'warning' },
                done_without_evidence: { enabled: true, severity: 'warning' },
                wip_limit_executor: { enabled: true, severity: 'warning' },
                wip_limit_scope: { enabled: true, severity: 'warning' },
            },
            board_doctor: { enabled: true },
        },
    };

    const report = boardDoctor.buildBoardDoctorReport(
        {
            board,
            policy,
            leasePolicy: boardLeases.normalizeBoardLeasesPolicy(policy),
            handoffData: { handoffs: [] },
            conflictAnalysis: { blocking: [], handoffCovered: [] },
            now: new Date('2026-02-25T10:00:00.000Z'),
        },
        {
            getTaskLeaseSummary: boardLeases.getTaskLeaseSummary,
            makeDiagnostic: diagnostics.makeDiagnostic,
            getWarnPolicyMap: diagnostics.getWarnPolicyMap,
            warnPolicyEnabled: diagnostics.warnPolicyEnabled,
            warnPolicySeverity: diagnostics.warnPolicySeverity,
            isBroadGlobPath: diagnostics.isBroadGlobPath,
        }
    );

    assert.equal(report.command, 'board doctor');
    assert.equal(Array.isArray(report.diagnostics), true);
    assert.equal(
        report.diagnostics.some(
            (d) => d.code === 'warn.board.lease_missing_active'
        ),
        true
    );
});

test('board-doctor reporta WIP limits por executor/scope en modo warn', () => {
    const board = {
        tasks: [
            {
                id: 'AG-001',
                executor: 'codex',
                owner: 'e',
                status: 'in_progress',
                scope: 'calendar',
                files: [],
            },
            {
                id: 'AG-002',
                executor: 'codex',
                owner: 'e',
                status: 'review',
                scope: 'calendar',
                files: [],
            },
            {
                id: 'AG-003',
                executor: 'codex',
                owner: 'e',
                status: 'blocked',
                scope: 'calendar',
                files: [],
                blocked_reason: 'x',
            },
        ],
    };
    const policy = {
        enforcement: {
            warning_policies: {
                lease_missing_active: { enabled: true, severity: 'warning' },
                lease_expired_active: { enabled: true, severity: 'warning' },
                heartbeat_stale: { enabled: true, severity: 'warning' },
                task_in_progress_stale: { enabled: true, severity: 'warning' },
                task_blocked_stale: { enabled: true, severity: 'warning' },
                done_without_evidence: { enabled: true, severity: 'warning' },
                wip_limit_executor: { enabled: true, severity: 'warning' },
                wip_limit_scope: { enabled: true, severity: 'warning' },
            },
            board_doctor: { enabled: true },
            wip_limits: {
                enabled: true,
                mode: 'warn',
                count_statuses: ['in_progress', 'review', 'blocked'],
                by_executor: { codex: 2 },
                by_scope: { calendar: 2, default: 4 },
            },
        },
    };
    const report = boardDoctor.buildBoardDoctorReport(
        {
            board,
            policy,
            leasePolicy: boardLeases.normalizeBoardLeasesPolicy(policy),
            handoffData: { handoffs: [] },
            conflictAnalysis: { blocking: [], handoffCovered: [] },
            now: new Date('2026-02-25T10:00:00.000Z'),
        },
        {
            getTaskLeaseSummary: boardLeases.getTaskLeaseSummary,
            makeDiagnostic: diagnostics.makeDiagnostic,
            getWarnPolicyMap: diagnostics.getWarnPolicyMap,
            warnPolicyEnabled: diagnostics.warnPolicyEnabled,
            warnPolicySeverity: diagnostics.warnPolicySeverity,
            isBroadGlobPath: diagnostics.isBroadGlobPath,
        }
    );
    assert.equal(
        report.diagnostics.some(
            (d) => d.code === 'warn.board.wip_limit_executor'
        ),
        true
    );
    assert.equal(
        report.diagnostics.some((d) => d.code === 'warn.board.wip_limit_scope'),
        true
    );
});

test('board-doctor resume deuda de evidencia canónica y no redacta checks exitosos como fallos', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'board-doctor-'));
    fs.mkdirSync(path.join(rootDir, 'verification', 'agent-runs'), {
        recursive: true,
    });
    fs.mkdirSync(path.join(rootDir, 'verification', 'public-v6-canonical'), {
        recursive: true,
    });
    fs.writeFileSync(
        path.join(rootDir, 'verification', 'agent-runs', 'AG-001.md'),
        '# AG-001 evidence\n',
        'utf8'
    );
    fs.writeFileSync(
        path.join(rootDir, 'verification', 'public-v6-canonical', 'summary.md'),
        '# AG-152 summary\n',
        'utf8'
    );

    const policy = {
        enforcement: {
            warning_policies: {
                done_without_evidence: { enabled: true, severity: 'warning' },
            },
            board_doctor: { enabled: true },
        },
    };
    const report = boardDoctor.buildBoardDoctorReport(
        {
            board: {
                tasks: [
                    {
                        id: 'AG-001',
                        owner: 'ernes',
                        executor: 'codex',
                        status: 'done',
                        evidence_ref: 'verification/agent-runs/AG-001.md',
                        acceptance_ref: 'verification/agent-runs/AG-001.md',
                    },
                    {
                        id: 'AG-152',
                        owner: 'ernes',
                        executor: 'codex',
                        status: 'done',
                        evidence_ref:
                            'verification/public-v6-canonical/summary.md',
                        acceptance_ref:
                            'verification/public-v6-canonical/summary.md',
                    },
                ],
            },
            policy,
            leasePolicy: boardLeases.normalizeBoardLeasesPolicy(policy),
            handoffData: { handoffs: [] },
            conflictAnalysis: { blocking: [], handoffCovered: [] },
            now: new Date('2026-03-10T10:00:00.000Z'),
            rootDir,
            evidenceDir: path.join(rootDir, 'verification', 'agent-runs'),
        },
        {
            getTaskLeaseSummary: boardLeases.getTaskLeaseSummary,
            makeDiagnostic: diagnostics.makeDiagnostic,
            getWarnPolicyMap: diagnostics.getWarnPolicyMap,
            warnPolicyEnabled: diagnostics.warnPolicyEnabled,
            warnPolicySeverity: diagnostics.warnPolicySeverity,
            isBroadGlobPath: diagnostics.isBroadGlobPath,
        }
    );

    assert.equal(report.evidence_summary.terminal_tasks, 2);
    assert.equal(report.evidence_summary.aligned_count, 1);
    assert.equal(report.evidence_summary.missing_expected_count, 1);
    assert.deepEqual(report.evidence_summary.sample_task_ids, ['AG-152']);

    const ag001Check = report.checks.find(
        (check) =>
            check.code === 'warn.board.done_without_evidence' &&
            check.task_ids?.includes('AG-001')
    );
    assert.ok(ag001Check);
    assert.equal(ag001Check.pass, true);
    assert.match(ag001Check.message, /con evidencia canónica/);

    const ag152Diagnostic = report.diagnostics.find((diag) =>
        Array.isArray(diag.task_ids) ? diag.task_ids.includes('AG-152') : false
    );
    assert.ok(ag152Diagnostic);
    assert.equal(ag152Diagnostic.meta.reason, 'missing_expected_file');
});
