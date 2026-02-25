#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    analyzeFileOverlap,
    analyzeConflicts,
    normalizePathToken,
} = require('../../tools/agent-orchestrator/domain/conflicts');

test('conflicts-engine normaliza paths y detecta overlap exacto', () => {
    assert.equal(
        normalizePathToken('.\\Lib\\Calendar\\A.php'),
        'lib/calendar/a.php'
    );

    const overlap = analyzeFileOverlap(
        ['lib/calendar/A.php'],
        ['.\\lib\\calendar\\a.php']
    );

    assert.equal(overlap.anyOverlap, true);
    assert.equal(overlap.ambiguousWildcardOverlap, false);
    assert.deepEqual(overlap.overlapFiles, ['lib/calendar/a.php']);
});

test('conflicts-engine exime conflicto con handoff valido que cubre todos los files', () => {
    const tasks = [
        {
            id: 'AG-001',
            status: 'in_progress',
            executor: 'jules',
            scope: 'docs',
            domain_lane: 'backend_ops',
            codex_instance: 'codex_backend_ops',
            files: ['docs/a.md'],
        },
        {
            id: 'CDX-001',
            status: 'review',
            executor: 'codex',
            scope: 'codex-governance',
            domain_lane: 'backend_ops',
            codex_instance: 'codex_backend_ops',
            files: ['docs/a.md'],
        },
    ];
    const handoffs = [
        {
            id: 'HO-001',
            status: 'active',
            from_task: 'AG-001',
            to_task: 'CDX-001',
            files: ['docs/a.md'],
            expires_at: '2099-01-01T00:00:00.000Z',
        },
    ];

    const analysis = analyzeConflicts(tasks, handoffs, {
        activeStatuses: new Set(['in_progress', 'review']),
    });

    assert.equal(analysis.all.length, 1);
    assert.equal(analysis.handoffCovered.length, 1);
    assert.equal(analysis.blocking.length, 0);
    assert.equal(analysis.handoffCovered[0].exempted_by_handoff, true);
    assert.equal(analysis.handoffCovered[0].cross_lane, false);
    assert.equal(analysis.handoffCovered[0].cross_codex_instance, false);
});

test('conflicts-engine conserva bloqueo cuando overlap por wildcard es ambiguo', () => {
    const tasks = [
        {
            id: 'AG-001',
            status: 'in_progress',
            executor: 'jules',
            scope: 'docs',
            files: ['docs/*'],
        },
        {
            id: 'AG-002',
            status: 'review',
            executor: 'kimi',
            scope: 'docs',
            files: ['docs/*.md'],
        },
    ];
    const handoffs = [
        {
            id: 'HO-001',
            status: 'active',
            from_task: 'AG-001',
            to_task: 'AG-002',
            files: ['docs/a.md'],
            expires_at: '2099-01-01T00:00:00.000Z',
        },
    ];

    const analysis = analyzeConflicts(tasks, handoffs, {
        activeStatuses: new Set(['in_progress', 'review']),
    });

    assert.equal(analysis.all.length, 1);
    assert.equal(analysis.all[0].ambiguous_wildcard_overlap, true);
    assert.equal(analysis.blocking.length, 1);
    assert.equal(analysis.handoffCovered.length, 0);
});

test('conflicts-engine marca conflicto cross-lane/cross-instance cuando aplica', () => {
    const tasks = [
        {
            id: 'AG-001',
            status: 'in_progress',
            executor: 'codex',
            scope: 'backend',
            domain_lane: 'backend_ops',
            codex_instance: 'codex_backend_ops',
            files: ['src/apps/chat/engine.js'],
        },
        {
            id: 'AG-002',
            status: 'review',
            executor: 'codex',
            scope: 'frontend',
            domain_lane: 'frontend_content',
            codex_instance: 'codex_frontend',
            files: ['src/apps/chat/engine.js'],
        },
    ];
    const analysis = analyzeConflicts(tasks, [], {
        activeStatuses: new Set(['in_progress', 'review']),
    });

    assert.equal(analysis.all.length, 1);
    assert.equal(analysis.blocking.length, 1);
    assert.equal(analysis.all[0].cross_lane, true);
    assert.equal(analysis.all[0].cross_codex_instance, true);
});
