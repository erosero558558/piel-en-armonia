'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const focusDomain = require('../../tools/agent-orchestrator/domain/focus');

test('focus evaluateRequiredChecks marca public_main_sync health_http_502 como red y accionable', () => {
    const checks = focusDomain.evaluateRequiredChecks(
        {
            required_checks: ['job:public_main_sync'],
        },
        {
            jobsSnapshot: [
                {
                    key: 'public_main_sync',
                    configured: true,
                    verified: false,
                    healthy: false,
                    state: 'failed',
                    verification_source: 'health_url',
                    failure_reason: 'health_http_502',
                    last_error_message: 'health_http_502',
                },
            ],
        }
    );

    assert.equal(checks.length, 1);
    assert.deepEqual(checks[0], {
        id: 'job:public_main_sync',
        type: 'job',
        target: 'public_main_sync',
        state: 'red',
        ok: false,
        reason: 'health_http_502',
        next_action:
            'revisar /api.php?resource=health y recuperar backend/origen del host publico',
        message: 'job public_main_sync unhealthy: health_http_502',
    });
});

test('focus evaluateRequiredChecks trata public_main_sync registry_only/unverified como bloqueo rojo del corte', () => {
    const checks = focusDomain.evaluateRequiredChecks(
        {
            required_checks: ['job:public_main_sync'],
        },
        {
            jobsSnapshot: [
                {
                    key: 'public_main_sync',
                    configured: true,
                    verified: false,
                    healthy: false,
                    state: 'failed',
                    verification_source: 'registry_only',
                    failure_reason: 'unverified',
                    last_error_message: 'unverified',
                },
            ],
        }
    );

    assert.equal(checks.length, 1);
    assert.equal(checks[0].state, 'red');
    assert.equal(checks[0].reason, 'unverified');
    assert.match(checks[0].next_action, /health_url/i);
});

test('focus permite carryover bloqueado externo desde el step previo al avanzar a feedback_trim', () => {
    const summary = focusDomain.buildFocusSummary(
        {
            strategy: {
                active: {
                    id: 'STRAT-2026-03-admin-operativo',
                    title: 'Admin operativo',
                    status: 'active',
                    focus_id: 'FOCUS-2026-03-admin-operativo-cut-1',
                    focus_title: 'Admin operativo demostrable',
                    focus_summary: 'Corte comun',
                    focus_status: 'active',
                    focus_proof: 'Demo comun',
                    focus_steps: [
                        'admin_queue_pilot_cut',
                        'pilot_readiness_evidence',
                        'feedback_trim',
                    ],
                    focus_next_step: 'feedback_trim',
                    focus_required_checks: [
                        'job:public_main_sync',
                        'runtime:operator_auth',
                    ],
                    focus_owner: 'ernesto',
                    focus_review_due_at: '2026-03-21',
                    subfronts: [],
                },
            },
            tasks: [
                {
                    id: 'CDX-009',
                    status: 'blocked',
                    codex_instance: 'codex_backend_ops',
                    domain_lane: 'backend_ops',
                    focus_id: 'FOCUS-2026-03-admin-operativo-cut-1',
                    focus_step: 'admin_queue_pilot_cut',
                    integration_slice: 'ops_deploy',
                    work_type: 'support',
                    blocked_reason: 'host_public_health_502_external_blocker',
                },
                {
                    id: 'CDX-046',
                    status: 'in_progress',
                    codex_instance: 'codex_frontend',
                    domain_lane: 'frontend_content',
                    focus_id: 'FOCUS-2026-03-admin-operativo-cut-1',
                    focus_step: 'feedback_trim',
                    integration_slice: 'frontend_runtime',
                    work_type: 'forward',
                    blocked_reason: '',
                },
            ],
        },
        {
            decisionsData: { decisions: [] },
            jobsSnapshot: [
                {
                    key: 'public_main_sync',
                    configured: true,
                    verified: false,
                    healthy: false,
                    state: 'failed',
                    verification_source: 'health_url',
                    failure_reason: 'health_http_502',
                    last_error_message: 'health_http_502',
                },
            ],
            runtimeVerification: {
                operator_auth: {
                    status: 'unhealthy',
                    reason: 'auth_status_http_502',
                },
            },
            now: new Date('2026-03-26T20:00:00.000Z'),
        }
    );

    assert.deepEqual(summary.carryover_external_blocker_task_ids, ['CDX-009']);
    assert.deepEqual(summary.outside_next_step_task_ids, []);
    assert.equal(summary.acknowledged_external_blocker, true);
    assert.equal(summary.aligned_tasks, 2);
    assert.equal(summary.release_ready, false);
});
