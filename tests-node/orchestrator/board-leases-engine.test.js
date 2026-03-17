#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const boardLeases = require('../../tools/agent-orchestrator/domain/board-leases');

test('board-leases applyTaskLeaseLifecycle crea lease y status_since al activar tarea', () => {
    const task = {
        id: 'AG-001',
        owner: 'ernesto',
        status: 'in_progress',
        created_at: '2026-02-25',
        updated_at: '2026-02-25',
    };
    const prev = {
        id: 'AG-001',
        owner: 'ernesto',
        status: 'ready',
        updated_at: '2026-02-25',
    };
    const result = boardLeases.applyTaskLeaseLifecycle(task, prev, {
        nowIso: '2026-02-25T10:00:00.000Z',
        currentDate: '2026-02-25',
        terminalStatuses: new Set(['done', 'failed']),
    });

    assert.equal(['created', 'renewed'].includes(result.lease_action), true);
    assert.equal(typeof task.status_since_at, 'string');
    assert.equal(task.status_since_at, '2026-02-25T10:00:00.000Z');
    assert.equal(typeof task.lease_id, 'string');
    assert.equal(task.lease_id.length > 0, true);
    assert.equal(task.lease_owner, 'ernesto');
    assert.equal(task.heartbeat_at, '2026-02-25T10:00:00.000Z');
});

test('board-leases applyTaskLeaseLifecycle limpia lease al pasar a terminal', () => {
    const task = {
        id: 'AG-001',
        owner: 'ernesto',
        status: 'done',
        lease_id: 'lease_AG_001',
        lease_owner: 'ernesto',
        lease_created_at: '2026-02-25T09:00:00.000Z',
        heartbeat_at: '2026-02-25T09:30:00.000Z',
        lease_expires_at: '2026-02-25T13:30:00.000Z',
        updated_at: '2026-02-25',
    };
    const prev = {
        id: 'AG-001',
        status: 'in_progress',
        lease_id: 'lease_AG_001',
    };
    const result = boardLeases.applyTaskLeaseLifecycle(task, prev, {
        nowIso: '2026-02-25T10:00:00.000Z',
        currentDate: '2026-02-25',
        terminalStatuses: new Set(['done', 'failed']),
    });

    assert.equal(result.lease_action, 'cleared');
    assert.equal(task.lease_id, '');
    assert.equal(task.heartbeat_at, '');
    assert.equal(task.lease_cleared_reason.includes('terminal'), true);
});

test('board-leases applyTaskLeaseLifecycle limpia lease al salir de tracked hacia ready', () => {
    const task = {
        id: 'AG-001',
        owner: 'ernesto',
        status: 'ready',
        lease_id: 'lease_AG_001',
        lease_owner: 'ernesto',
        lease_created_at: '2026-02-25T09:00:00.000Z',
        heartbeat_at: '2026-02-25T09:30:00.000Z',
        lease_expires_at: '2026-02-25T13:30:00.000Z',
        updated_at: '2026-02-25',
    };
    const prev = {
        id: 'AG-001',
        status: 'in_progress',
        lease_id: 'lease_AG_001',
    };
    const result = boardLeases.applyTaskLeaseLifecycle(task, prev, {
        nowIso: '2026-02-25T10:00:00.000Z',
        currentDate: '2026-02-25',
        terminalStatuses: new Set(['done', 'failed']),
    });

    assert.equal(result.lease_action, 'cleared');
    assert.equal(task.lease_id, '');
    assert.equal(task.heartbeat_at, '');
    assert.equal(task.lease_cleared_reason, 'status_exit:ready');
});

test('board-leases listBoardLeases resume missing/expired en tracked statuses', () => {
    const board = {
        tasks: [
            {
                id: 'AG-001',
                status: 'in_progress',
                owner: 'a',
                executor: 'jules',
            },
            {
                id: 'AG-002',
                status: 'review',
                owner: 'b',
                executor: 'codex',
                lease_id: 'lease_x',
                lease_owner: 'b',
                heartbeat_at: '2026-02-25T08:00:00.000Z',
                lease_expires_at: '2026-02-25T09:00:00.000Z',
            },
        ],
    };
    const report = boardLeases.listBoardLeases(board, {
        nowIso: '2026-02-25T10:00:00.000Z',
        activeOnly: true,
    });
    assert.equal(report.rows.length, 2);
    assert.equal(report.summary.active_required_missing, 1);
    assert.equal(report.summary.active_expired, 1);
});
