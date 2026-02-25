#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    findCriticalScopeKeyword,
    validateTaskExecutorScopeGuard,
    validateTaskDependsOn,
    validateTaskGovernancePrechecks,
} = require('../../tools/agent-orchestrator/domain/task-guards');

const CRITICAL_SCOPE_KEYWORDS = [
    'payments',
    'auth',
    'calendar',
    'deploy',
    'env',
    'security',
];
const ALLOWED_EXECUTORS = new Set(['codex', 'claude']);

test('task-guards detecta keyword critica en scope', () => {
    assert.equal(
        findCriticalScopeKeyword(
            'calendar-prod-hardening',
            CRITICAL_SCOPE_KEYWORDS
        ),
        'calendar'
    );
    assert.equal(
        findCriticalScopeKeyword('docs', CRITICAL_SCOPE_KEYWORDS),
        null
    );
});

test('task-guards bloquea executor no permitido para scope critico', () => {
    assert.throws(
        () =>
            validateTaskExecutorScopeGuard(
                { scope: 'payments-refactor', executor: 'jules' },
                {
                    criticalScopeKeywords: CRITICAL_SCOPE_KEYWORDS,
                    allowedExecutors: ALLOWED_EXECUTORS,
                }
            ),
        /task critica/
    );

    assert.doesNotThrow(() =>
        validateTaskExecutorScopeGuard(
            { scope: 'payments-refactor', executor: 'codex' },
            {
                criticalScopeKeywords: CRITICAL_SCOPE_KEYWORDS,
                allowedExecutors: ALLOWED_EXECUTORS,
            }
        )
    );
});

test('task-guards valida depends_on (existencia, duplicados y formato)', () => {
    const board = {
        tasks: [{ id: 'AG-001' }, { id: 'CDX-001' }],
    };

    assert.throws(
        () =>
            validateTaskDependsOn(board, {
                id: 'AG-010',
                depends_on: ['AG-001', 'AG-001'],
            }),
        /duplicado/
    );

    assert.throws(
        () =>
            validateTaskDependsOn(board, {
                id: 'AG-010',
                depends_on: ['BAD-1'],
            }),
        /invalido/
    );

    assert.throws(
        () =>
            validateTaskDependsOn(board, {
                id: 'AG-010',
                depends_on: ['AG-999'],
            }),
        /no existe en board/
    );

    assert.doesNotThrow(() =>
        validateTaskDependsOn(board, {
            id: 'AG-010',
            depends_on: ['AG-001', 'CDX-001'],
        })
    );
});

test('task-guards prechecks combinan scope guard y depends_on', () => {
    const board = {
        tasks: [{ id: 'AG-001' }],
    };

    assert.throws(
        () =>
            validateTaskGovernancePrechecks(
                board,
                {
                    id: 'AG-010',
                    scope: 'calendar-hardening',
                    executor: 'kimi',
                    depends_on: ['AG-001'],
                },
                {
                    criticalScopeKeywords: CRITICAL_SCOPE_KEYWORDS,
                    allowedExecutors: ALLOWED_EXECUTORS,
                }
            ),
        /task critica/
    );
});
