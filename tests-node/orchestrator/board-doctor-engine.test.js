#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

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
