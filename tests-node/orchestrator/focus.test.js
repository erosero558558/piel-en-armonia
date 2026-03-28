'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const focusDomain = require('../../tools/agent-orchestrator/domain/focus');

function runGit(cwd, args) {
    const result = spawnSync('git', args, {
        cwd,
        encoding: 'utf8',
    });
    assert.equal(
        result.status,
        0,
        `git ${args.join(' ')} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
    );
    return result;
}

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

test('focus evaluateRequiredChecks resuelve content/audit/test desde snapshot local valido', () => {
    const checks = focusDomain.evaluateRequiredChecks(
        {
            required_checks: [
                'content:public-v6:validate',
                'audit:public-v6:copy',
                'test:frontend:qa:v6',
            ],
        },
        {
            localRequiredCheckSnapshot: {
                valid: true,
                snapshot: {
                    checks: [
                        {
                            id: 'content:public-v6:validate',
                            type: 'content',
                            command: 'npm run content:public-v6:validate',
                            ok: true,
                            exit_code: 0,
                            checked_at: '2026-03-27T12:00:00.000Z',
                        },
                        {
                            id: 'audit:public-v6:copy',
                            type: 'audit',
                            command: 'npm run audit:public:v6:copy',
                            ok: true,
                            exit_code: 0,
                            checked_at: '2026-03-27T12:00:01.000Z',
                        },
                        {
                            id: 'test:frontend:qa:v6',
                            type: 'test',
                            command: 'npm run test:frontend:qa:v6',
                            ok: false,
                            exit_code: 1,
                            checked_at: '2026-03-27T12:00:02.000Z',
                        },
                    ],
                },
            },
        }
    );

    assert.equal(checks[0].state, 'green');
    assert.equal(checks[0].command, 'npm run content:public-v6:validate');
    assert.equal(checks[1].state, 'green');
    assert.equal(checks[1].command, 'npm run audit:public:v6:copy');
    assert.equal(checks[2].state, 'red');
    assert.equal(checks[2].exit_code, 1);
    assert.equal(checks[2].reason, 'command_failed');
});

test('focus loadLocalRequiredCheckSnapshot invalida snapshot si cambia focus_required_checks', (t) => {
    const root = mkdtempSync(join(tmpdir(), 'focus-snapshot-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));

    const snapshotPath = focusDomain.resolveFocusCheckSnapshotPath(
        'FOCUS-2026-03-public-v6-es-voz-cut-1',
        { rootPath: root }
    );
    mkdirSync(join(root, 'verification', 'focus-checks'), { recursive: true });
    writeFileSync(
        snapshotPath,
        `${JSON.stringify(
            {
                version: 1,
                focus_id: 'FOCUS-2026-03-public-v6-es-voz-cut-1',
                checked_at: '2026-03-27T12:00:00.000Z',
                focus_required_checks: [
                    'content:public-v6:validate',
                    'audit:public-v6:copy',
                ],
                checks: [],
            },
            null,
            2
        )}\n`,
        'utf8'
    );

    const snapshotState = focusDomain.loadLocalRequiredCheckSnapshot(
        {
            id: 'FOCUS-2026-03-public-v6-es-voz-cut-1',
            required_checks: [
                'content:public-v6:validate',
                'audit:public-v6:copy',
                'test:frontend:qa:v6',
            ],
        },
        { rootPath: root }
    );

    assert.equal(snapshotState.available, true);
    assert.equal(snapshotState.valid, false);
    assert.equal(snapshotState.reason, 'required_checks_mismatch');
});

test('focus loadLocalRequiredCheckSnapshot usa evidencia de slices en review como fuente canonica', (t) => {
    const root = mkdtempSync(join(tmpdir(), 'focus-evidence-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));

    mkdirSync(join(root, 'verification', 'agent-runs'), { recursive: true });
    writeFileSync(
        join(root, 'verification', 'agent-runs', 'CDX-045.md'),
        [
            '# CDX-045',
            '- required_check: content:public-v6:validate | state: red | command: npm run content:public-v6:validate',
            '- required_check: audit:public-v6:copy | state: red | command: npm run audit:public:v6:copy',
            '- required_check: test:frontend:qa:v6 | state: red | command: TEST_LOCAL_SERVER=php npm run test:frontend:qa:v6',
            '',
        ].join('\n'),
        'utf8'
    );
    writeFileSync(
        join(root, 'verification', 'agent-runs', 'CDX-048.md'),
        [
            '# CDX-048',
            '- required_check: content:public-v6:validate | state: green | command: npm run content:public-v6:validate',
            '- required_check: audit:public-v6:copy | state: green | command: npm run audit:public:v6:copy',
            '- required_check: test:frontend:qa:v6 | state: green | command: TEST_LOCAL_SERVER=php npm run test:frontend:qa:v6',
            '',
        ].join('\n'),
        'utf8'
    );

    const snapshotState = focusDomain.loadLocalRequiredCheckSnapshot(
        {
            id: 'FOCUS-2026-03-public-v6-es-voz-cut-1',
            required_checks: [
                'content:public-v6:validate',
                'audit:public-v6:copy',
                'test:frontend:qa:v6',
            ],
        },
        {
            rootPath: root,
            board: {
                strategy: {
                    active: {
                        id: 'STRAT-2026-03-public-v6-es-voz-ecuatoriana',
                        started_at: '2026-03-26',
                    },
                },
                tasks: [
                    {
                        id: 'CDX-045',
                        status: 'review',
                        strategy_id: 'STRAT-2026-03-public-v6-es-voz-ecuatoriana',
                        subfront_id: 'SF-frontend-public-v6-es-copy',
                        focus_id: 'FOCUS-2026-03-public-v6-es-voz-cut-1',
                        updated_at: '2026-03-27T10:00:00Z',
                        acceptance_ref: 'verification/agent-runs/CDX-045.md',
                        evidence_ref: 'verification/agent-runs/CDX-045.md',
                    },
                    {
                        id: 'CDX-048',
                        status: 'review',
                        strategy_id: 'STRAT-2026-03-public-v6-es-voz-ecuatoriana',
                        subfront_id: 'SF-frontend-public-v6-es-copy',
                        focus_id: 'FOCUS-2026-03-public-v6-es-voz-cut-1',
                        updated_at: '2026-03-27T23:36:00Z',
                        acceptance_ref: 'verification/agent-runs/CDX-048.md',
                        evidence_ref: 'verification/agent-runs/CDX-048.md',
                    },
                ],
            },
        }
    );

    assert.equal(snapshotState.available, true);
    assert.equal(snapshotState.valid, true);
    assert.equal(snapshotState.reason, 'evidence');

    const checks = focusDomain.evaluateRequiredChecks(
        {
            required_checks: [
                'content:public-v6:validate',
                'audit:public-v6:copy',
                'test:frontend:qa:v6',
            ],
        },
        {
            localRequiredCheckSnapshot: snapshotState,
        }
    );

    assert.deepEqual(
        checks.map((item) => [item.id, item.state, item.checked_at]),
        [
            ['content:public-v6:validate', 'green', '2026-03-27T23:36:00Z'],
            ['audit:public-v6:copy', 'green', '2026-03-27T23:36:00Z'],
            ['test:frontend:qa:v6', 'green', '2026-03-27T23:36:00Z'],
        ]
    );
});

test('focus loadLocalRequiredCheckSnapshot prefiere snapshot JSON valido sobre evidencia legacy', (t) => {
    const root = mkdtempSync(join(tmpdir(), 'focus-evidence-precedence-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));

    mkdirSync(join(root, 'verification', 'agent-runs'), { recursive: true });
    mkdirSync(join(root, 'verification', 'focus-checks'), { recursive: true });
    writeFileSync(
        join(root, 'verification', 'agent-runs', 'CDX-048.md'),
        [
            '# CDX-048',
            '- required_check: content:public-v6:validate | state: green | command: npm run content:public-v6:validate',
            '- required_check: audit:public-v6:copy | state: green | command: npm run audit:public:v6:copy',
            '- required_check: test:frontend:qa:v6 | state: green | command: TEST_LOCAL_SERVER=php npm run test:frontend:qa:v6',
            '',
        ].join('\n'),
        'utf8'
    );
    writeFileSync(
        focusDomain.resolveFocusCheckSnapshotPath(
            'FOCUS-2026-03-public-v6-es-voz-cut-1',
            { rootPath: root }
        ),
        `${JSON.stringify(
            {
                version: 1,
                focus_id: 'FOCUS-2026-03-public-v6-es-voz-cut-1',
                checked_at: '2026-03-28T01:00:00Z',
                focus_required_checks: [
                    'content:public-v6:validate',
                    'audit:public-v6:copy',
                    'test:frontend:qa:v6',
                ],
                checks: [
                    {
                        id: 'content:public-v6:validate',
                        type: 'content',
                        command: 'npm run content:public-v6:validate',
                        ok: true,
                        exit_code: 0,
                        checked_at: '2026-03-28T01:00:00Z',
                    },
                    {
                        id: 'audit:public-v6:copy',
                        type: 'audit',
                        command: 'npm run audit:public:v6:copy',
                        ok: true,
                        exit_code: 0,
                        checked_at: '2026-03-28T01:00:01Z',
                    },
                    {
                        id: 'test:frontend:qa:v6',
                        type: 'test',
                        command: 'npm run test:frontend:qa:v6',
                        ok: true,
                        exit_code: 0,
                        checked_at: '2026-03-28T01:00:02Z',
                    },
                ],
            },
            null,
            2
        )}\n`,
        'utf8'
    );

    const snapshotState = focusDomain.loadLocalRequiredCheckSnapshot(
        {
            id: 'FOCUS-2026-03-public-v6-es-voz-cut-1',
            required_checks: [
                'content:public-v6:validate',
                'audit:public-v6:copy',
                'test:frontend:qa:v6',
            ],
        },
        {
            rootPath: root,
            board: {
                strategy: {
                    active: {
                        id: 'STRAT-2026-03-public-v6-es-voz-ecuatoriana',
                        started_at: '2026-03-26',
                    },
                },
                tasks: [
                    {
                        id: 'CDX-048',
                        status: 'review',
                        strategy_id: 'STRAT-2026-03-public-v6-es-voz-ecuatoriana',
                        subfront_id: 'SF-frontend-public-v6-es-copy',
                        focus_id: 'FOCUS-2026-03-public-v6-es-voz-cut-1',
                        updated_at: '2026-03-27T23:36:00Z',
                        acceptance_ref: 'verification/agent-runs/CDX-048.md',
                        evidence_ref: 'verification/agent-runs/CDX-048.md',
                    },
                ],
            },
        }
    );

    assert.equal(snapshotState.available, true);
    assert.equal(snapshotState.valid, true);
    assert.equal(snapshotState.reason, 'ok');

    const checks = focusDomain.evaluateRequiredChecks(
        {
            required_checks: [
                'content:public-v6:validate',
                'audit:public-v6:copy',
                'test:frontend:qa:v6',
            ],
        },
        {
            localRequiredCheckSnapshot: snapshotState,
        }
    );

    assert.deepEqual(
        checks.map((item) => [item.id, item.state, item.checked_at]),
        [
            ['content:public-v6:validate', 'green', '2026-03-28T01:00:00Z'],
            ['audit:public-v6:copy', 'green', '2026-03-28T01:00:01Z'],
            ['test:frontend:qa:v6', 'green', '2026-03-28T01:00:02Z'],
        ]
    );
});

test('focus buildFocusSummary expone snapshot local y release_ready cuando el foco cerrado conserva evidencia verde', (t) => {
    const root = mkdtempSync(join(tmpdir(), 'focus-closed-ready-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));

    mkdirSync(join(root, 'verification', 'focus-checks'), { recursive: true });
    writeFileSync(
        focusDomain.resolveFocusCheckSnapshotPath(
            'FOCUS-2026-03-public-v6-es-voz-cut-1',
            { rootPath: root }
        ),
        `${JSON.stringify(
            {
                version: 1,
                focus_id: 'FOCUS-2026-03-public-v6-es-voz-cut-1',
                checked_at: '2026-03-28T02:13:27.882Z',
                focus_required_checks: [
                    'content:public-v6:validate',
                    'audit:public-v6:copy',
                    'test:frontend:qa:v6',
                ],
                checks: [
                    {
                        id: 'content:public-v6:validate',
                        type: 'content',
                        command: 'npm run content:public-v6:validate',
                        ok: true,
                        exit_code: 0,
                        checked_at: '2026-03-28',
                    },
                    {
                        id: 'audit:public-v6:copy',
                        type: 'audit',
                        command: 'npm run audit:public:v6:copy',
                        ok: true,
                        exit_code: 0,
                        checked_at: '2026-03-28',
                    },
                    {
                        id: 'test:frontend:qa:v6',
                        type: 'test',
                        command: 'TEST_LOCAL_SERVER=php npm run test:frontend:qa:v6',
                        ok: true,
                        exit_code: 0,
                        checked_at: '2026-03-28',
                    },
                ],
            },
            null,
            2
        )}\n`,
        'utf8'
    );

    const board = {
        strategy: {
            active: {
                id: 'STRAT-2026-03-public-v6-es-voz-ecuatoriana',
                status: 'closed',
                started_at: '2026-03-26',
                focus_id: 'FOCUS-2026-03-public-v6-es-voz-cut-1',
                focus_title: 'Public V6 ES claro y humano',
                focus_summary: 'Corte comun',
                focus_status: 'closed',
                focus_proof: 'Demo comun',
                focus_steps: [
                    'ecuadorian_copy_rewrite',
                    'copy_contract_validation',
                    'publish_readiness_review',
                ],
                focus_next_step: 'publish_readiness_review',
                focus_required_checks: [
                    'content:public-v6:validate',
                    'audit:public-v6:copy',
                    'test:frontend:qa:v6',
                ],
                focus_non_goals: ['public_publish'],
                focus_owner: 'Ernesto',
                focus_review_due_at: '2026-03-30',
                focus_evidence_ref: 'verification/agent-runs/CDX-050.md',
                focus_max_active_slices: 1,
            },
        },
        tasks: [],
    };
    const configuredFocus = focusDomain.getConfiguredFocus(board);
    const localSnapshot = focusDomain.loadLocalRequiredCheckSnapshot(
        configuredFocus,
        {
            rootPath: root,
            board,
        }
    );
    const summary = focusDomain.buildFocusSummary(board, {
        localRequiredCheckSnapshot: localSnapshot,
        rootPath: root,
    });

    assert.equal(summary.required_checks_snapshot.source, 'local_snapshot');
    assert.equal(summary.required_checks_snapshot.valid, true);
    assert.equal(
        summary.required_checks_snapshot.path,
        focusDomain.resolveFocusCheckSnapshotPath(
            'FOCUS-2026-03-public-v6-es-voz-cut-1',
            { rootPath: root }
        )
    );
    assert.equal(summary.release_ready, true);
    assert.equal(
        summary.warnings.includes('strategy_has_no_active_focus'),
        false
    );
});

test('focus evaluateRequiredChecks deja local required checks como unverified cuando la evidencia no aplica al foco activo', (t) => {
    const root = mkdtempSync(join(tmpdir(), 'focus-unverified-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));

    const checks = focusDomain.evaluateRequiredChecks(
        {
            id: 'FOCUS-2026-03-public-v6-es-voz-cut-1',
            required_checks: [
                'content:public-v6:validate',
                'audit:public-v6:copy',
                'test:frontend:qa:v6',
            ],
        },
        {
            rootPath: root,
            board: {
                strategy: {
                    active: {
                        id: 'STRAT-2026-03-public-v6-es-voz-ecuatoriana',
                        started_at: '2026-03-26',
                    },
                },
                tasks: [
                    {
                        id: 'CDX-048',
                        status: 'review',
                        strategy_id: 'STRAT-2026-03-public-v6-es-voz-ecuatoriana',
                        subfront_id: 'SF-backend-public-v6-es-support',
                        focus_id: 'FOCUS-2026-03-public-v6-es-voz-cut-1',
                        updated_at: '2026-03-27T23:36:00Z',
                        acceptance_ref: 'verification/agent-runs/CDX-048.md',
                        evidence_ref: 'verification/agent-runs/CDX-048.md',
                    },
                ],
            },
        }
    );

    assert.deepEqual(
        checks.map((item) => item.state),
        ['unverified', 'unverified', 'unverified']
    );
});

test('focus refreshRequiredChecksSnapshot persiste snapshot task-scoped y buildLiveFocusSummary lo usa por taskId', async (t) => {
    const root = mkdtempSync(join(tmpdir(), 'focus-task-snapshot-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));

    writeFileSync(join(root, '.gitignore'), '.codex-local/\n', 'utf8');
    writeFileSync(
        join(root, 'package.json'),
        `${JSON.stringify(
            {
                name: 'focus-task-snapshot-fixture',
                private: true,
                scripts: {
                    'content:public-v6:validate':
                        'node -e "process.exit(0)"',
                    'audit:public:v6:copy':
                        'node -e "process.exit(0)"',
                    'test:frontend:qa:v6': 'node -e "process.exit(0)"',
                },
            },
            null,
            2
        )}\n`,
        'utf8'
    );
    writeFileSync(join(root, 'README.md'), '# fixture\n', 'utf8');
    runGit(root, ['init']);
    runGit(root, ['config', 'user.email', 'fixture@example.com']);
    runGit(root, ['config', 'user.name', 'Fixture']);
    runGit(root, ['add', '.']);
    runGit(root, ['commit', '-m', 'fixture init']);

    const board = {
        strategy: {
            active: {
                id: 'STRAT-2026-03-public-v6-es-voz-ecuatoriana',
                status: 'active',
                focus_id: 'FOCUS-2026-03-public-v6-es-voz-cut-1',
                focus_title: 'Public V6 ES claro y humano',
                focus_summary: 'Corte comun',
                focus_status: 'active',
                focus_proof: 'Demo comun',
                focus_steps: [
                    'ecuadorian_copy_rewrite',
                    'copy_contract_validation',
                    'publish_readiness_review',
                ],
                focus_next_step: 'copy_contract_validation',
                focus_required_checks: [
                    'content:public-v6:validate',
                    'audit:public-v6:copy',
                    'test:frontend:qa:v6',
                ],
                focus_owner: 'Ernesto',
                focus_review_due_at: '2026-03-30',
                focus_evidence_ref: '',
                focus_max_active_slices: 2,
            },
        },
        tasks: [
            {
                id: 'CDX-045',
                status: 'review',
                strategy_id: 'STRAT-2026-03-public-v6-es-voz-ecuatoriana',
                focus_id: 'FOCUS-2026-03-public-v6-es-voz-cut-1',
                focus_step: 'copy_contract_validation',
                integration_slice: 'frontend_runtime',
                work_type: 'forward',
            },
        ],
    };

    const refresh = focusDomain.refreshRequiredChecksSnapshot(board, {
        taskId: 'CDX-045',
        cwd: root,
        rootPath: root,
        now: new Date('2026-03-28T01:00:00Z'),
    });
    assert.equal(refresh.ok, true);
    assert.equal(refresh.context_task_id, 'CDX-045');

    const live = await focusDomain.buildLiveFocusSummary(board, {
        buildFocusSummary: (current, options = {}) =>
            focusDomain.buildFocusSummary(current, options),
        parseDecisions: () => ({ decisions: [] }),
        loadJobsSnapshot: async () => [],
        cwd: root,
        rootPath: root,
        taskId: 'CDX-045',
        preferredTaskId: 'CDX-045',
        now: new Date('2026-03-28T01:00:01Z'),
    });

    assert.equal(
        live.summary.required_checks_snapshot.context_task_id,
        'CDX-045'
    );
    assert.equal(live.summary.required_checks_snapshot.valid, true);
    assert.deepEqual(
        live.summary.required_checks.map((item) => item.state),
        ['green', 'green', 'green']
    );
});

test('focus loadRequiredChecksSnapshotContext invalida snapshot task-scoped si cambia worktree fingerprint', (t) => {
    const root = mkdtempSync(join(tmpdir(), 'focus-task-stale-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));

    writeFileSync(join(root, '.gitignore'), '.codex-local/\n', 'utf8');
    writeFileSync(
        join(root, 'package.json'),
        `${JSON.stringify(
            {
                name: 'focus-task-stale-fixture',
                private: true,
                scripts: {
                    'content:public-v6:validate':
                        'node -e "process.exit(0)"',
                    'audit:public:v6:copy':
                        'node -e "process.exit(0)"',
                    'test:frontend:qa:v6': 'node -e "process.exit(0)"',
                },
            },
            null,
            2
        )}\n`,
        'utf8'
    );
    writeFileSync(join(root, 'README.md'), '# fixture\n', 'utf8');
    runGit(root, ['init']);
    runGit(root, ['config', 'user.email', 'fixture@example.com']);
    runGit(root, ['config', 'user.name', 'Fixture']);
    runGit(root, ['add', '.']);
    runGit(root, ['commit', '-m', 'fixture init']);

    const board = {
        strategy: {
            active: {
                id: 'STRAT-2026-03-public-v6-es-voz-ecuatoriana',
                status: 'active',
                focus_id: 'FOCUS-2026-03-public-v6-es-voz-cut-1',
                focus_title: 'Public V6 ES claro y humano',
                focus_summary: 'Corte comun',
                focus_status: 'active',
                focus_proof: 'Demo comun',
                focus_steps: ['copy_contract_validation'],
                focus_next_step: 'copy_contract_validation',
                focus_required_checks: [
                    'content:public-v6:validate',
                    'audit:public-v6:copy',
                    'test:frontend:qa:v6',
                ],
                focus_owner: 'Ernesto',
                focus_review_due_at: '2026-03-30',
                focus_evidence_ref: '',
                focus_max_active_slices: 1,
            },
        },
        tasks: [
            {
                id: 'CDX-045',
                status: 'review',
                strategy_id: 'STRAT-2026-03-public-v6-es-voz-ecuatoriana',
                focus_id: 'FOCUS-2026-03-public-v6-es-voz-cut-1',
                focus_step: 'copy_contract_validation',
                integration_slice: 'frontend_runtime',
                work_type: 'forward',
            },
        ],
    };

    focusDomain.refreshRequiredChecksSnapshot(board, {
        taskId: 'CDX-045',
        cwd: root,
        rootPath: root,
        now: new Date('2026-03-28T01:00:00Z'),
    });
    writeFileSync(join(root, 'README.md'), '# fixture dirty\n', 'utf8');

    const snapshotState = focusDomain.loadRequiredChecksSnapshotContext(board, {
        taskId: 'CDX-045',
        cwd: root,
        rootPath: root,
        now: new Date('2026-03-28T01:05:00Z'),
    });

    assert.equal(snapshotState.available, true);
    assert.equal(snapshotState.valid, false);
    assert.equal(
        snapshotState.reason,
        'worktree_status_fingerprint_mismatch'
    );
    assert.equal(
        snapshotState.stale_reason,
        'worktree_status_fingerprint_mismatch'
    );
});
