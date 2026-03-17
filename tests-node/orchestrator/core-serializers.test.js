#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const parsers = require('../../tools/agent-orchestrator/core/parsers');
const serializers = require('../../tools/agent-orchestrator/core/serializers');

test('core-serializers quote y serializeArrayInline escapan comillas', () => {
    assert.equal(serializers.quote('a"b'), '"a\\"b"');
    assert.equal(
        serializers.serializeArrayInline(['a', 'b"c']),
        '["a", "b\\"c"]'
    );
    assert.equal(serializers.serializeArrayInline([]), '[]');
});

test('core-serializers serializeHandoffs incluye campos opcionales de cierre', () => {
    const yaml = serializers.serializeHandoffs({
        version: 1,
        handoffs: [
            {
                id: 'HO-001',
                status: 'closed',
                from_task: 'AG-001',
                to_task: 'CDX-001',
                reason: 'soporte',
                files: ['docs/a.md'],
                approved_by: 'ernesto',
                created_at: '2026-02-25T00:00:00Z',
                expires_at: '2026-02-25T03:00:00Z',
                closed_at: '2026-02-25T02:00:00Z',
                close_reason: 'handoff_done',
            },
        ],
    });

    assert.match(yaml, /^version: 1/m);
    assert.match(yaml, /closed_at:\s+2026-02-25T02:00:00Z/);
    assert.match(yaml, /close_reason:\s+"handoff_done"/);

    const parsed = parsers.parseHandoffsContent(yaml);
    assert.equal(parsed.handoffs[0].status, 'closed');
    assert.deepEqual(parsed.handoffs[0].files, ['docs/a.md']);
});

test('core-serializers serializeBoard roundtrip basico con currentDate inyectado', () => {
    const board = {
        version: 1,
        policy: {
            canonical: 'AGENTS.md',
            autonomy: 'semi_autonomous_guardrails',
            kpi: 'reduce_rework',
            revision: 7,
            updated_at: '2026-02-25',
        },
        strategy: {
            active: {
                id: 'STRAT-2026-03-admin-operativo',
                title: 'Admin operativo',
                objective: 'Cerrar admin operativo',
                owner: 'ernesto',
                owner_policy: 'detected_default_owner',
                status: 'active',
                started_at: '2026-03-14',
                review_due_at: '2026-03-21',
                exit_criteria: ['uno', 'dos'],
                success_signal: 'demo',
                focus_id: 'FOCUS-2026-03-admin-operativo-cut-1',
                focus_title: 'Admin operativo demostrable',
                focus_summary: 'Corte comun',
                focus_status: 'active',
                focus_proof: 'Demo comun',
                focus_steps: [
                    'admin_queue_pilot_cut',
                    'pilot_readiness_evidence',
                ],
                focus_next_step: 'admin_queue_pilot_cut',
                focus_required_checks: [
                    'job:public_main_sync',
                    'runtime:openclaw_chatgpt',
                ],
                focus_non_goals: ['rediseno_publico'],
                focus_owner: 'ernesto',
                focus_review_due_at: '2026-03-21',
                focus_evidence_ref: '',
                focus_max_active_slices: 3,
                subfronts: [
                    {
                        codex_instance: 'codex_frontend',
                        subfront_id: 'SF-frontend-admin-operativo',
                        title: 'Admin UX',
                        allowed_scopes: ['frontend-admin'],
                        support_only_scopes: ['docs'],
                        blocked_scopes: ['payments'],
                        wip_limit: 2,
                        default_acceptance_profile:
                            'frontend_delivery_checkpoint',
                        exception_ttl_hours: 8,
                    },
                ],
            },
            next: {
                id: 'STRAT-2026-03-admin-operativo',
                title: 'Admin operativo draft',
                objective: 'Cerrar admin operativo sin ambiguedad',
                owner: 'ernesto',
                owner_policy: 'detected_default_owner',
                status: 'draft',
                started_at: '2026-03-17',
                review_due_at: '2026-03-21',
                exit_criteria: ['uno'],
                success_signal: 'demo draft',
                focus_id: 'FOCUS-2026-03-admin-operativo-cut-1',
                focus_title: 'Admin draft',
                focus_summary: 'Corte draft',
                focus_status: 'active',
                focus_proof: 'Demo draft',
                focus_steps: ['admin_queue_pilot_cut', 'feedback_trim'],
                focus_next_step: 'feedback_trim',
                focus_required_checks: ['job:public_main_sync'],
                focus_non_goals: ['rediseno_publico'],
                focus_owner: 'ernesto',
                focus_review_due_at: '2026-03-21',
                focus_evidence_ref: '',
                focus_max_active_slices: 3,
                subfronts: [
                    {
                        codex_instance: 'codex_backend_ops',
                        subfront_id: 'SF-backend-admin-operativo',
                        title: 'Backend',
                        allowed_scopes: ['auth'],
                        support_only_scopes: ['tests'],
                        blocked_scopes: ['frontend-public'],
                        wip_limit: 2,
                        default_acceptance_profile: 'backend_gate_checkpoint',
                        exception_ttl_hours: 6,
                    },
                ],
            },
            updated_at: '2026-03-17',
        },
        tasks: [
            {
                id: 'AG-001',
                title: 'Task "uno"',
                owner: 'ernesto',
                executor: 'codex',
                status: 'ready',
                risk: 'medium',
                scope: 'governance',
                strategy_id: 'STRAT-2026-03-admin-operativo',
                subfront_id: 'SF-frontend-admin-operativo',
                strategy_role: 'support',
                strategy_reason: 'soporte directo al frente activo',
                focus_id: 'FOCUS-2026-03-admin-operativo-cut-1',
                focus_step: 'admin_queue_pilot_cut',
                integration_slice: 'governance_evidence',
                work_type: 'support',
                expected_outcome: 'Actualizar evidencia del corte',
                decision_ref: 'DEC-001',
                files: ['agent-orchestrator.js'],
                acceptance: 'ok',
                acceptance_ref: 'verification/agent-runs/AG-001.md',
                depends_on: [],
                prompt: 'Task "uno"',
                created_at: '2026-02-25',
                updated_at: '2026-02-25',
            },
        ],
    };

    const yaml = serializers.serializeBoard(board, {
        currentDate: () => '2099-01-01',
    });

    assert.match(yaml, /^version: 1/m);
    assert.match(yaml, /revision:\s+7/);
    assert.match(yaml, /strategy:/);
    assert.match(yaml, /owner_policy:\s+"detected_default_owner"/);
    assert.match(yaml, /focus_id:\s+"FOCUS-2026-03-admin-operativo-cut-1"/);
    assert.match(yaml, /next:\n\s+id:\s+STRAT-2026-03-admin-operativo/);
    assert.match(yaml, /updated_at:\s+"2026-03-17"/);
    assert.match(yaml, /subfront_id:\s+SF-frontend-admin-operativo/);
    assert.match(yaml, /title:\s+"Task \\"uno\\""/);
    assert.match(yaml, /files:\s+\["agent-orchestrator\.js"\]/);

    const parsed = parsers.parseBoardContent(yaml, {
        allowedStatuses: new Set(['ready']),
    });
    assert.equal(parsed.tasks.length, 1);
    assert.equal(parsed.policy.revision, '7');
    assert.equal(parsed.strategy.active.id, 'STRAT-2026-03-admin-operativo');
    assert.equal(parsed.strategy.active.owner_policy, 'detected_default_owner');
    assert.equal(
        parsed.strategy.active.focus_id,
        'FOCUS-2026-03-admin-operativo-cut-1'
    );
    assert.equal(parsed.strategy.active.subfronts[0].wip_limit, '2');
    assert.equal(
        parsed.strategy.active.subfronts[0].default_acceptance_profile,
        'frontend_delivery_checkpoint'
    );
    assert.equal(parsed.strategy.next.id, 'STRAT-2026-03-admin-operativo');
    assert.equal(parsed.strategy.next.status, 'draft');
    assert.equal(parsed.strategy.updated_at, '2026-03-17');
    assert.equal(parsed.tasks[0].title, 'Task "uno"');
    assert.deepEqual(parsed.tasks[0].files, ['agent-orchestrator.js']);
    assert.equal(parsed.tasks[0].codex_instance, 'codex_backend_ops');
    assert.equal(parsed.tasks[0].domain_lane, 'backend_ops');
    assert.equal(parsed.tasks[0].lane_lock, 'strict');
    assert.equal(parsed.tasks[0].cross_domain, false);
    assert.equal(parsed.tasks[0].strategy_id, 'STRAT-2026-03-admin-operativo');
    assert.equal(parsed.tasks[0].subfront_id, 'SF-frontend-admin-operativo');
    assert.equal(parsed.tasks[0].strategy_role, 'support');
    assert.equal(
        parsed.tasks[0].strategy_reason,
        'soporte directo al frente activo'
    );
    assert.equal(parsed.tasks[0].focus_step, 'admin_queue_pilot_cut');
    assert.equal(parsed.tasks[0].integration_slice, 'governance_evidence');
    assert.equal(parsed.tasks[0].work_type, 'support');
    assert.equal(parsed.tasks[0].decision_ref, 'DEC-001');
});

test('core-serializers serializeDecisions roundtrip basico', () => {
    const yaml = serializers.serializeDecisions({
        version: 1,
        policy: {
            owner_model: 'human_supervisor',
            revision: 2,
            updated_at: '2026-03-14',
        },
        decisions: [
            {
                id: 'DEC-001',
                strategy_id: 'STRAT-2026-03-admin-operativo',
                focus_id: 'FOCUS-2026-03-admin-operativo-cut-1',
                focus_step: 'admin_queue_pilot_cut',
                title: 'Resolver gate de pilot',
                owner: 'ernesto',
                status: 'open',
                due_at: '2026-03-15',
                recommended_option: 'repair_sync',
                selected_option: '',
                rationale: 'public_main_sync esta rojo',
                related_tasks: ['CDX-001'],
                opened_at: '2026-03-14',
                resolved_at: '',
            },
        ],
    });

    assert.match(yaml, /^version: 1/m);
    assert.match(yaml, /owner_model:\s+human_supervisor/);
    assert.match(yaml, /focus_step:\s+"admin_queue_pilot_cut"/);
    const parsed = parsers.parseDecisionsContent(yaml);
    assert.equal(parsed.decisions.length, 1);
    assert.equal(parsed.decisions[0].id, 'DEC-001');
    assert.deepEqual(parsed.decisions[0].related_tasks, ['CDX-001']);
});
