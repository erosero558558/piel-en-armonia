#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const parsers = require('../../tools/agent-orchestrator/core/parsers');

test('core-parsers parseBoardContent parsea policy/tasks y arrays inline', () => {
    const raw = `
version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  updated_at: 2026-02-25
strategy:
  active:
    id: STRAT-2026-03-admin-operativo
    title: "Admin operativo"
    objective: "Cerrar admin operativo"
    owner: ernesto
    owner_policy: "detected_default_owner"
    status: active
    started_at: "2026-03-14"
    review_due_at: "2026-03-21"
    exit_criteria: ["uno", "dos"]
    success_signal: "demo"
    subfronts:
      - codex_instance: codex_frontend
        subfront_id: SF-frontend-admin-operativo
        title: "Admin UX"
        allowed_scopes: ["frontend-admin", "queue"]
        support_only_scopes: ["docs"]
        blocked_scopes: ["payments"]
        wip_limit: 2
        default_acceptance_profile: "frontend_delivery_checkpoint"
        exception_ttl_hours: 8
  next:
    id: STRAT-2026-04-admin-operativo
    title: "Admin operativo next"
    objective: "Cerrar admin operativo next"
    owner: ernesto
    owner_policy: "detected_default_owner"
    status: draft
    started_at: "2026-03-20"
    review_due_at: "2026-03-28"
    exit_criteria: ["tres"]
    success_signal: "demo next"
    subfronts:
      - codex_instance: codex_frontend
        subfront_id: SF-frontend-admin-operativo
        title: "Admin UX"
        allowed_scopes: ["frontend-admin", "queue"]
        support_only_scopes: ["docs"]
        blocked_scopes: ["payments"]
        wip_limit: 1
        default_acceptance_profile: "frontend_delivery_checkpoint"
        exception_ttl_hours: 8
  updated_at: "2026-03-14"

tasks:
  - id: AG-001
    title: "Task uno"
    owner: ernesto
    executor: codex
    status: in_progress
    risk: high
    scope: calendar
    codex_instance: codex_backend_ops
    domain_lane: backend_ops
    lane_lock: strict
    cross_domain: false
    strategy_id: STRAT-2026-03-admin-operativo
    subfront_id: SF-backend-admin-operativo
    strategy_role: exception
    strategy_reason: "hotfix critico"
    exception_opened_at: "2026-03-14T00:00:00.000Z"
    exception_expires_at: "2026-03-14T08:00:00.000Z"
    exception_state: open
    files: ["lib/calendar/A.php", "lib/calendar/B.php"]
    acceptance: "ok"
    acceptance_ref: "verification/agent-runs/AG-001.md"
    depends_on: ["AG-000"]
    prompt: "do it"
    created_at: 2026-02-25
    updated_at: 2026-02-25
`;

    const board = parsers.parseBoardContent(raw, {
        allowedStatuses: new Set(['in_progress', 'done']),
    });

    assert.equal(board.version, '1');
    assert.equal(board.policy.canonical, 'AGENTS.md');
    assert.equal(board.tasks.length, 1);
    assert.equal(board.strategy.active.id, 'STRAT-2026-03-admin-operativo');
    assert.equal(board.strategy.active.owner_policy, 'detected_default_owner');
    assert.equal(board.strategy.active.subfronts.length, 1);
    assert.equal(
        board.strategy.active.subfronts[0].subfront_id,
        'SF-frontend-admin-operativo'
    );
    assert.equal(board.strategy.active.subfronts[0].wip_limit, 2);
    assert.equal(
        board.strategy.active.subfronts[0].default_acceptance_profile,
        'frontend_delivery_checkpoint'
    );
    assert.equal(board.strategy.active.subfronts[0].exception_ttl_hours, 8);
    assert.equal(board.strategy.next.id, 'STRAT-2026-04-admin-operativo');
    assert.equal(board.strategy.next.subfronts.length, 1);
    assert.equal(
        board.strategy.next.subfronts[0].subfront_id,
        'SF-frontend-admin-operativo'
    );
    assert.equal(board.strategy.updated_at, '2026-03-14');
    assert.deepEqual(board.tasks[0].files, [
        'lib/calendar/A.php',
        'lib/calendar/B.php',
    ]);
    assert.deepEqual(board.tasks[0].depends_on, ['AG-000']);
    assert.equal(board.tasks[0].status, 'in_progress');
    assert.equal(board.tasks[0].codex_instance, 'codex_backend_ops');
    assert.equal(board.tasks[0].domain_lane, 'backend_ops');
    assert.equal(board.tasks[0].lane_lock, 'strict');
    assert.equal(board.tasks[0].cross_domain, false);
    assert.equal(board.tasks[0].strategy_id, 'STRAT-2026-03-admin-operativo');
    assert.equal(board.tasks[0].subfront_id, 'SF-backend-admin-operativo');
    assert.equal(board.tasks[0].strategy_role, 'exception');
    assert.equal(board.tasks[0].strategy_reason, 'hotfix critico');
    assert.equal(
        board.tasks[0].exception_opened_at,
        '2026-03-14T00:00:00.000Z'
    );
    assert.equal(
        board.tasks[0].exception_expires_at,
        '2026-03-14T08:00:00.000Z'
    );
    assert.equal(board.tasks[0].exception_state, 'open');
});

test('core-parsers parseBoardContent valida status permitido', () => {
    const raw = `
version: 1
policy:
  canonical: AGENTS.md
tasks:
  - id: AG-001
    status: weird
    files: []
    depends_on: []
`;

    assert.throws(
        () =>
            parsers.parseBoardContent(raw, {
                allowedStatuses: new Set(['backlog', 'done']),
            }),
        /Estado no permitido/i
    );
});

test('core-parsers parseHandoffsContent normaliza status y files', () => {
    const raw = `
version: 1
handoffs:
  - id: HO-001
    status: ACTIVE
    from_task: AG-001
    to_task: CDX-001
    reason: soporte
    files: ["docs/a.md"]
    approved_by: ernesto
    created_at: 2026-02-25T00:00:00Z
    expires_at: 2026-02-25T03:00:00Z
`;

    const data = parsers.parseHandoffsContent(raw);
    assert.equal(data.version, '1');
    assert.equal(data.handoffs.length, 1);
    assert.equal(data.handoffs[0].status, 'active');
    assert.deepEqual(data.handoffs[0].files, ['docs/a.md']);
});

test('core-parsers parseCodexActiveBlocksContent parsea multiples bloques', () => {
    const raw = `
<!-- CODEX_ACTIVE
block: C1
task_id: CDX-001
status: in_progress
files: ["AGENTS.md", "agent-orchestrator.js"]
updated_at: 2026-02-25
-->

Texto

<!-- CODEX_ACTIVE
block: C2
task_id: CDX-002
status: review
files: []
updated_at: 2026-02-26
-->
`;

    const blocks = parsers.parseCodexActiveBlocksContent(raw);
    assert.equal(blocks.length, 2);
    assert.equal(blocks[0].task_id, 'CDX-001');
    assert.deepEqual(blocks[0].files, ['AGENTS.md', 'agent-orchestrator.js']);
    assert.equal(blocks[1].status, 'review');
});

test('core-parsers parseCodexStrategyActiveBlocksContent parsea bloque de estrategia', () => {
    const raw = `
<!-- CODEX_STRATEGY_ACTIVE
id: STRAT-2026-03-admin-operativo
title: "Admin operativo"
status: ACTIVE
owner: ernesto
owner_policy: "detected_default_owner"
subfront_ids: ["SF-frontend-admin-operativo", "SF-backend-admin-operativo"]
updated_at: "2026-03-14"
-->
`;

    const blocks = parsers.parseCodexStrategyActiveBlocksContent(raw);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].id, 'STRAT-2026-03-admin-operativo');
    assert.equal(blocks[0].status, 'active');
    assert.equal(blocks[0].owner_policy, 'detected_default_owner');
    assert.deepEqual(blocks[0].subfront_ids, [
        'SF-frontend-admin-operativo',
        'SF-backend-admin-operativo',
    ]);
});

test('core-parsers parseCodexStrategyNextBlocksContent parsea bloque draft', () => {
    const raw = `
<!-- CODEX_STRATEGY_NEXT
id: STRAT-2026-04-admin-operativo
title: "Admin operativo next"
status: DRAFT
owner: ernesto
owner_policy: "detected_default_owner"
subfront_ids: ["SF-frontend-admin-operativo", "SF-backend-admin-operativo"]
updated_at: "2026-03-20"
-->
`;

    const blocks = parsers.parseCodexStrategyNextBlocksContent(raw);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].id, 'STRAT-2026-04-admin-operativo');
    assert.equal(blocks[0].status, 'draft');
    assert.equal(blocks[0].owner_policy, 'detected_default_owner');
    assert.deepEqual(blocks[0].subfront_ids, [
        'SF-frontend-admin-operativo',
        'SF-backend-admin-operativo',
    ]);
});
