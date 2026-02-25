#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const boardEvents = require('../../tools/agent-orchestrator/domain/board-events');

test('board-events diff detecta cambios de status y lease', () => {
    const prevBoard = {
        policy: { updated_at: '2026-02-25' },
        tasks: [
            {
                id: 'AG-001',
                owner: 'ernesto',
                executor: 'jules',
                status: 'ready',
                files: ['a'],
            },
            {
                id: 'AG-002',
                owner: 'ernesto',
                executor: 'codex',
                status: 'in_progress',
                files: ['b'],
                lease_id: 'lease_old',
                heartbeat_at: '2026-02-25T09:00:00.000Z',
            },
        ],
    };
    const nextBoard = {
        policy: { updated_at: '2026-02-25' },
        tasks: [
            {
                id: 'AG-001',
                owner: 'ernesto',
                executor: 'jules',
                status: 'in_progress',
                files: ['a'],
                lease_id: 'lease_1',
                heartbeat_at: '2026-02-25T10:00:00.000Z',
            },
            {
                id: 'AG-002',
                owner: 'ernesto',
                executor: 'codex',
                status: 'in_progress',
                files: ['b'],
                lease_id: 'lease_old',
                heartbeat_at: '2026-02-25T10:00:00.000Z',
            },
        ],
    };

    const events = boardEvents.diffBoardTaskEvents(prevBoard, nextBoard, {
        command: 'task start',
        source: 'cli',
        actor: 'ernesto',
        nowIso: '2026-02-25T10:00:00.000Z',
    });
    assert.equal(Array.isArray(events), true);
    assert.equal(
        events.some((e) => e.event_type === 'task_started'),
        true
    );
    assert.equal(
        events.some((e) => e.event_type === 'lease_heartbeat'),
        true
    );
});

test('board-events append/tail/stats usan helpers JSONL', () => {
    const appended = [];
    const appendResult = boardEvents.appendBoardEventsForDiff(
        { policy: {}, tasks: [] },
        {
            policy: { updated_at: '2026-02-25' },
            tasks: [
                {
                    id: 'AG-001',
                    status: 'ready',
                    owner: 'ernesto',
                    executor: 'jules',
                    files: ['a'],
                },
            ],
        },
        {
            appendJsonlFile: (path, events) => {
                appended.push({ path, events });
                return { appended: events.length };
            },
            eventsPath: 'verification/agent-board-events.jsonl',
            nowIso: '2026-02-25T10:00:00.000Z',
        }
    );
    assert.equal(appendResult.appended, 1);
    assert.equal(appended[0].path, 'verification/agent-board-events.jsonl');

    const rows = [
        {
            occurred_at: '2026-02-25T10:00:00.000Z',
            event_type: 'task_created',
            actor: 'ernesto',
            task_id: 'AG-001',
        },
        {
            occurred_at: '2026-02-25T11:00:00.000Z',
            event_type: 'task_started',
            actor: 'codex',
            task_id: 'AG-002',
        },
    ];
    const tail = boardEvents.tailBoardEvents({
        eventsPath: 'verification/agent-board-events.jsonl',
        readJsonlFile: () => rows,
        limit: 1,
    });
    assert.deepEqual(tail, [rows[1]]);

    const stats = boardEvents.statsBoardEvents({
        eventsPath: 'verification/agent-board-events.jsonl',
        readJsonlFile: () => rows,
        days: 7,
        nowIso: '2026-02-25T12:00:00.000Z',
    });
    assert.equal(stats.ok, true);
    assert.equal(stats.total, 2);
    assert.equal(stats.by_event_type.task_created, 1);
    assert.equal(stats.by_actor.ernesto, 1);
});

test('board-events appendHandoffEvent registra eventos de handoff', () => {
    const appended = [];
    const result = boardEvents.appendHandoffEvent({
        appendJsonlFile: (path, rows) => {
            appended.push({ path, rows });
            return { appended: rows.length };
        },
        eventsPath: 'verification/agent-board-events.jsonl',
        eventType: 'handoff_created',
        handoff: {
            id: 'HO-001',
            status: 'active',
            from_task: 'AG-001',
            to_task: 'CDX-001',
            reason: 'soporte',
            files: ['tests/agenda.spec.js'],
            approved_by: 'ernesto',
            created_at: '2026-02-25T10:00:00.000Z',
            expires_at: '2026-02-25T14:00:00.000Z',
        },
        actor: 'ernesto',
        command: 'handoffs create',
        nowIso: '2026-02-25T10:00:00.000Z',
        board: {
            policy: { updated_at: '2026-02-25', revision: 7 },
        },
    });
    assert.equal(result.appended, 1);
    assert.equal(appended.length, 1);
    assert.equal(appended[0].rows[0].event_type, 'handoff_created');
    assert.equal(appended[0].rows[0].handoff_id, 'HO-001');
    assert.equal(appended[0].rows[0].command, 'handoffs create');
    assert.equal(appended[0].rows[0].board_policy_revision, 7);
    assert.equal(appended[0].rows[0].handoff.from_task, 'AG-001');
});
