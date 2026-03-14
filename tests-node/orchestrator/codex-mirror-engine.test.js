#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildCodexActiveComment,
    upsertCodexActiveBlock,
    buildCodexCheckReport,
} = require('../../tools/agent-orchestrator/domain/codex-mirror');
const {
    normalizePathToken,
} = require('../../tools/agent-orchestrator/domain/conflicts');

const ACTIVE_STATUSES = new Set(['ready', 'in_progress', 'review', 'blocked']);

function buildValidStrategyState() {
    return {
        active: {
            id: 'STRAT-2026-03-admin-operativo',
            title: 'Admin operativo',
            objective: 'Cerrar admin operativo',
            owner: 'ernesto',
            owner_policy: 'detected_default_owner',
            status: 'active',
            started_at: '2026-03-14',
            review_due_at: '2026-03-21',
            exit_criteria: ['uno'],
            success_signal: 'demo',
            subfronts: [
                {
                    codex_instance: 'codex_frontend',
                    subfront_id: 'SF-frontend-admin-operativo',
                    title: 'Admin UX',
                    allowed_scopes: ['frontend-admin'],
                    support_only_scopes: ['docs'],
                    blocked_scopes: ['payments'],
                    wip_limit: 1,
                    default_acceptance_profile: 'frontend_delivery_checkpoint',
                    exception_ttl_hours: 8,
                },
                {
                    codex_instance: 'codex_backend_ops',
                    subfront_id: 'SF-backend-admin-operativo',
                    title: 'Backend soporte',
                    allowed_scopes: ['backend'],
                    support_only_scopes: ['tests'],
                    blocked_scopes: ['frontend-public'],
                    wip_limit: 1,
                    default_acceptance_profile: 'backend_gate_checkpoint',
                    exception_ttl_hours: 6,
                },
                {
                    codex_instance: 'codex_transversal',
                    subfront_id: 'SF-transversal-admin-operativo',
                    title: 'Runtime soporte',
                    allowed_scopes: [],
                    support_only_scopes: ['openclaw_runtime'],
                    blocked_scopes: ['auth'],
                    wip_limit: 1,
                    default_acceptance_profile:
                        'transversal_runtime_checkpoint',
                    exception_ttl_hours: 4,
                },
            ],
        },
        next: {
            id: 'STRAT-2026-04-admin-operativo',
            title: 'Admin operativo next',
            objective: 'Cerrar admin operativo next',
            owner: 'ernesto',
            owner_policy: 'detected_default_owner',
            status: 'draft',
            started_at: '2026-03-20',
            review_due_at: '2026-03-28',
            exit_criteria: ['dos'],
            success_signal: 'demo next',
            subfronts: [
                {
                    codex_instance: 'codex_frontend',
                    subfront_id: 'SF-frontend-admin-operativo',
                    title: 'Admin UX',
                    allowed_scopes: ['frontend-admin'],
                    support_only_scopes: ['docs'],
                    blocked_scopes: ['payments'],
                    wip_limit: 1,
                    default_acceptance_profile: 'frontend_delivery_checkpoint',
                    exception_ttl_hours: 8,
                },
                {
                    codex_instance: 'codex_backend_ops',
                    subfront_id: 'SF-backend-admin-operativo',
                    title: 'Backend soporte',
                    allowed_scopes: ['backend'],
                    support_only_scopes: ['tests'],
                    blocked_scopes: ['frontend-public'],
                    wip_limit: 1,
                    default_acceptance_profile: 'backend_gate_checkpoint',
                    exception_ttl_hours: 6,
                },
                {
                    codex_instance: 'codex_transversal',
                    subfront_id: 'SF-transversal-admin-operativo',
                    title: 'Runtime soporte',
                    allowed_scopes: [],
                    support_only_scopes: ['openclaw_runtime'],
                    blocked_scopes: ['auth'],
                    wip_limit: 1,
                    default_acceptance_profile:
                        'transversal_runtime_checkpoint',
                    exception_ttl_hours: 4,
                },
            ],
        },
        updated_at: '2026-03-14',
    };
}

test('codex-mirror helpers construyen y upsertan bloque CODEX_ACTIVE', () => {
    const comment = buildCodexActiveComment(
        {
            block: 'C1',
            task_id: 'CDX-001',
            status: 'in_progress',
            files: ['AGENTS.md', 'agent-orchestrator.js'],
        },
        {
            serializeArrayInline: (values) => `["${values.join('", "')}"]`,
            currentDate: () => '2026-02-25',
        }
    );

    assert.match(comment, /<!-- CODEX_ACTIVE/);
    assert.match(comment, /task_id: CDX-001/);
    assert.match(comment, /updated_at: 2026-02-25/);

    const raw = `# Plan\n\nRelacion con Operativo 2026:\n- x\n`;
    const next = upsertCodexActiveBlock(
        raw,
        {
            block: 'C1',
            task_id: 'CDX-001',
            status: 'in_progress',
            files: ['AGENTS.md'],
            updated_at: '2026-02-25',
        },
        {
            buildComment: (block) =>
                buildCodexActiveComment(block, {
                    serializeArrayInline: (values) =>
                        `["${values.join('", "')}"]`,
                    currentDate: () => '2026-02-25',
                }),
        }
    );

    assert.match(next, /CODEX_ACTIVE/);
    assert.match(next, /Relacion con Operativo 2026:/);

    const removed = upsertCodexActiveBlock(next, null);
    assert.equal(/CODEX_ACTIVE/.test(removed), false);
});

test('codex-mirror engine valida espejo alineado', () => {
    const report = buildCodexCheckReport(
        {
            board: {
                tasks: [
                    {
                        id: 'CDX-001',
                        executor: 'codex',
                        status: 'in_progress',
                        files: ['AGENTS.md', 'agent-orchestrator.js'],
                    },
                ],
            },
            blocks: [
                {
                    block: 'C1',
                    task_id: 'CDX-001',
                    status: 'in_progress',
                    files: ['AGENTS.md', 'agent-orchestrator.js'],
                    updated_at: '2026-02-25',
                },
            ],
            codexPlanPath: 'PLAN_MAESTRO_CODEX_2026.md',
        },
        {
            normalizePathToken,
            activeStatuses: ACTIVE_STATUSES,
        }
    );

    assert.equal(report.ok, true);
    assert.equal(report.error_count, 0);
    assert.equal(report.summary.codex_in_progress, 1);
});

test('codex-mirror engine detecta drift de status y file no reservado', () => {
    const report = buildCodexCheckReport(
        {
            board: {
                tasks: [
                    {
                        id: 'CDX-001',
                        executor: 'codex',
                        status: 'review',
                        files: ['AGENTS.md'],
                    },
                ],
            },
            blocks: [
                {
                    block: 'C1',
                    task_id: 'CDX-001',
                    status: 'in_progress',
                    files: ['AGENTS.md', 'agent-orchestrator.js'],
                    updated_at: '2026-02-25',
                },
            ],
            codexPlanPath: 'PLAN_MAESTRO_CODEX_2026.md',
        },
        {
            normalizePathToken,
            activeStatuses: ACTIVE_STATUSES,
        }
    );

    assert.equal(report.ok, false);
    assert.equal(report.error_count >= 2, true);
    assert.equal(
        report.errors.some((e) => /status desalineado/i.test(String(e))),
        true
    );
    assert.equal(
        report.errors.some((e) => /no reservado en board/i.test(String(e))),
        true
    );
});

test('codex-mirror engine detecta doble in_progress por codex_instance', () => {
    const report = buildCodexCheckReport(
        {
            board: {
                tasks: [
                    {
                        id: 'CDX-001',
                        executor: 'codex',
                        status: 'in_progress',
                        codex_instance: 'codex_backend_ops',
                        files: ['AGENTS.md'],
                    },
                    {
                        id: 'AG-900',
                        executor: 'codex',
                        status: 'in_progress',
                        codex_instance: 'codex_backend_ops',
                        files: ['agent-orchestrator.js'],
                    },
                ],
            },
            blocks: [],
            handoffs: [],
            codexPlanPath: 'PLAN_MAESTRO_CODEX_2026.md',
        },
        {
            normalizePathToken,
            activeStatuses: ACTIVE_STATUSES,
            isExpired: () => false,
        }
    );

    assert.equal(report.ok, false);
    assert.equal(
        report.errors.some((e) =>
            /Mas de una tarea in_progress para codex_backend_ops/i.test(
                String(e)
            )
        ),
        true
    );
});

test('codex-mirror engine exige handoff activo para cross_domain activo', () => {
    const report = buildCodexCheckReport(
        {
            board: {
                tasks: [
                    {
                        id: 'AG-777',
                        executor: 'codex',
                        status: 'in_progress',
                        codex_instance: 'codex_backend_ops',
                        cross_domain: true,
                        files: ['src/apps/chat/engine.js'],
                    },
                ],
            },
            blocks: [],
            handoffs: [],
            codexPlanPath: 'PLAN_MAESTRO_CODEX_2026.md',
        },
        {
            normalizePathToken,
            activeStatuses: ACTIVE_STATUSES,
            isExpired: () => false,
        }
    );

    assert.equal(report.ok, false);
    assert.equal(
        report.errors.some((e) =>
            /cross_domain activo requiere handoff activo/i.test(String(e))
        ),
        true
    );
});

test('codex-mirror engine tolera tres bloques CODEX_ACTIVE y runtime transversal saludable', () => {
    const report = buildCodexCheckReport(
        {
            board: {
                tasks: [
                    {
                        id: 'CDX-001',
                        executor: 'codex',
                        status: 'in_progress',
                        codex_instance: 'codex_backend_ops',
                        domain_lane: 'backend_ops',
                        files: ['controllers/AdminController.php'],
                    },
                    {
                        id: 'CDX-002',
                        executor: 'codex',
                        status: 'review',
                        codex_instance: 'codex_frontend',
                        domain_lane: 'frontend_content',
                        files: ['src/apps/chat/engine.js'],
                    },
                    {
                        id: 'CDX-003',
                        executor: 'codex',
                        status: 'ready',
                        codex_instance: 'codex_transversal',
                        domain_lane: 'transversal_runtime',
                        provider_mode: 'openclaw_chatgpt',
                        runtime_surface: 'figo_queue',
                        runtime_transport: 'hybrid_http_cli',
                        critical_zone: true,
                        runtime_impact: 'high',
                        files: ['figo-ai-bridge.php'],
                    },
                ],
            },
            blocks: [
                {
                    block: 'C1',
                    codex_instance: 'codex_backend_ops',
                    task_id: 'CDX-001',
                    status: 'in_progress',
                    files: ['controllers/AdminController.php'],
                    updated_at: '2026-02-25',
                },
                {
                    block: 'C2',
                    codex_instance: 'codex_frontend',
                    task_id: 'CDX-002',
                    status: 'review',
                    files: ['src/apps/chat/engine.js'],
                    updated_at: '2026-02-25',
                },
                {
                    block: 'C3',
                    codex_instance: 'codex_transversal',
                    task_id: 'CDX-003',
                    status: 'ready',
                    files: ['figo-ai-bridge.php'],
                    updated_at: '2026-02-25',
                },
            ],
            handoffs: [],
            codexPlanPath: 'PLAN_MAESTRO_CODEX_2026.md',
        },
        {
            normalizePathToken,
            activeStatuses: ACTIVE_STATUSES,
            isExpired: () => false,
        }
    );

    assert.equal(report.ok, true);
    assert.equal(report.summary.plan_blocks, 3);
    assert.equal(report.summary.codex_active, 3);
});

test('codex-mirror engine valida espejo de strategy active y next alineados', () => {
    const strategy = buildValidStrategyState();
    const report = buildCodexCheckReport(
        {
            board: {
                tasks: [],
                strategy,
            },
            blocks: [],
            strategyBlocks: {
                active: [
                    {
                        id: strategy.active.id,
                        title: strategy.active.title,
                        status: strategy.active.status,
                        owner: strategy.active.owner,
                        owner_policy: strategy.active.owner_policy,
                        subfront_ids: strategy.active.subfronts.map(
                            (subfront) => subfront.subfront_id
                        ),
                    },
                ],
                next: [
                    {
                        id: strategy.next.id,
                        title: strategy.next.title,
                        status: strategy.next.status,
                        owner: strategy.next.owner,
                        owner_policy: strategy.next.owner_policy,
                        subfront_ids: strategy.next.subfronts.map(
                            (subfront) => subfront.subfront_id
                        ),
                    },
                ],
            },
            codexPlanPath: 'PLAN_MAESTRO_CODEX_2026.md',
        },
        {
            normalizePathToken,
            activeStatuses: ACTIVE_STATUSES,
            isExpired: () => false,
        }
    );

    assert.equal(report.ok, true);
    assert.equal(report.error_count, 0);
    assert.equal(report.strategy.plan_next_block.id, strategy.next.id);
    assert.equal(report.plan_strategy_blocks.next.length, 1);
});

test('codex-mirror engine detecta drift en CODEX_STRATEGY_NEXT', () => {
    const strategy = buildValidStrategyState();
    const report = buildCodexCheckReport(
        {
            board: {
                tasks: [],
                strategy,
            },
            blocks: [],
            strategyBlocks: {
                active: [
                    {
                        id: strategy.active.id,
                        title: strategy.active.title,
                        status: strategy.active.status,
                        owner: strategy.active.owner,
                        owner_policy: strategy.active.owner_policy,
                        subfront_ids: strategy.active.subfronts.map(
                            (subfront) => subfront.subfront_id
                        ),
                    },
                ],
                next: [
                    {
                        id: strategy.next.id,
                        title: strategy.next.title,
                        status: strategy.next.status,
                        owner: 'otro-owner',
                        owner_policy: strategy.next.owner_policy,
                        subfront_ids: strategy.next.subfronts.map(
                            (subfront) => subfront.subfront_id
                        ),
                    },
                ],
            },
            codexPlanPath: 'PLAN_MAESTRO_CODEX_2026.md',
        },
        {
            normalizePathToken,
            activeStatuses: ACTIVE_STATUSES,
            isExpired: () => false,
        }
    );

    assert.equal(report.ok, false);
    assert.equal(
        report.errors.some((error) =>
            /CODEX_STRATEGY_NEXT\.owner desalineado/i.test(String(error))
        ),
        true
    );
});
