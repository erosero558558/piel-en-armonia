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
                        strategy_id:
                            'STRAT-2026-03-public-v6-es-voz-ecuatoriana',
                        subfront_id: 'SF-frontend-public-v6-es-copy',
                        focus_id: 'FOCUS-2026-03-public-v6-es-voz-cut-1',
                        updated_at: '2026-03-27T10:00:00Z',
                        acceptance_ref: 'verification/agent-runs/CDX-045.md',
                        evidence_ref: 'verification/agent-runs/CDX-045.md',
                    },
                    {
                        id: 'CDX-048',
                        status: 'review',
                        strategy_id:
                            'STRAT-2026-03-public-v6-es-voz-ecuatoriana',
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

test('focus loadLocalRequiredCheckSnapshot usa evidencia frontend/backend para el foco turnero local-first', (t) => {
    const root = mkdtempSync(join(tmpdir(), 'focus-turnero-evidence-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));

    mkdirSync(join(root, 'verification', 'agent-runs'), { recursive: true });
    writeFileSync(
        join(root, 'verification', 'agent-runs', 'CDX-056.md'),
        [
            '# CDX-056',
            '- required_check: test:turnero:web-pilot:contracts | state: green | command: npm run test:turnero:web-pilot:contracts',
            '- required_check: test:turnero:web-pilot:php-contract | state: green | command: npm run test:turnero:web-pilot:php-contract',
            '- required_check: test:turnero:web-pilot:ui | state: green | command: npm run test:turnero:web-pilot:ui',
            '',
        ].join('\n'),
        'utf8'
    );
    writeFileSync(
        join(root, 'verification', 'agent-runs', 'CDX-057.md'),
        [
            '# CDX-057',
            '- required_check: test:turnero:web-pilot:contracts | state: green | command: npm run test:turnero:web-pilot:contracts',
            '- required_check: test:turnero:web-pilot:php-contract | state: green | command: npm run test:turnero:web-pilot:php-contract',
            '- required_check: test:turnero:web-pilot:ui | state: green | command: npm run test:turnero:web-pilot:ui',
            '',
        ].join('\n'),
        'utf8'
    );

    const snapshotState = focusDomain.loadLocalRequiredCheckSnapshot(
        {
            id: 'FOCUS-2026-03-turnero-web-pilot-local-cut-1',
            required_checks: [
                'test:turnero:web-pilot:contracts',
                'test:turnero:web-pilot:php-contract',
                'test:turnero:web-pilot:ui',
            ],
        },
        {
            rootPath: root,
            board: {
                strategy: {
                    active: {
                        id: 'STRAT-2026-03-turnero-web-pilot-local-first',
                        started_at: '2026-03-28T12:00:00Z',
                    },
                },
                tasks: [
                    {
                        id: 'CDX-056',
                        status: 'review',
                        strategy_id:
                            'STRAT-2026-03-turnero-web-pilot-local-first',
                        subfront_id: 'SF-frontend-turnero-web-pilot-local',
                        focus_id: 'FOCUS-2026-03-turnero-web-pilot-local-cut-1',
                        updated_at: '2026-03-28T12:46:44Z',
                        acceptance_ref: 'verification/agent-runs/CDX-056.md',
                        evidence_ref: 'verification/agent-runs/CDX-056.md',
                    },
                    {
                        id: 'CDX-057',
                        status: 'review',
                        strategy_id:
                            'STRAT-2026-03-turnero-web-pilot-local-first',
                        subfront_id: 'SF-backend-turnero-web-pilot-local',
                        focus_id: 'FOCUS-2026-03-turnero-web-pilot-local-cut-1',
                        updated_at: '2026-03-28T12:46:43Z',
                        acceptance_ref: 'verification/agent-runs/CDX-057.md',
                        evidence_ref: 'verification/agent-runs/CDX-057.md',
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
                'test:turnero:web-pilot:contracts',
                'test:turnero:web-pilot:php-contract',
                'test:turnero:web-pilot:ui',
            ],
        },
        {
            localRequiredCheckSnapshot: snapshotState,
        }
    );

    assert.deepEqual(
        checks.map((item) => [item.id, item.state]),
        [
            ['test:turnero:web-pilot:contracts', 'green'],
            ['test:turnero:web-pilot:php-contract', 'green'],
            ['test:turnero:web-pilot:ui', 'green'],
        ]
    );
});

test('focus loadLocalRequiredCheckSnapshot usa evidencia frontend/backend para el foco turnero multi-clinica', (t) => {
    const root = mkdtempSync(join(tmpdir(), 'focus-turnero-multi-clinic-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));

    mkdirSync(join(root, 'verification', 'agent-runs'), { recursive: true });
    writeFileSync(
        join(root, 'verification', 'agent-runs', 'CDX-061.md'),
        [
            '# CDX-061',
            '- required_check: test:turnero:web-pilot:contracts | state: green | command: npm run test:turnero:web-pilot:contracts',
            '- required_check: test:turnero:web-pilot:php-contract | state: green | command: npm run test:turnero:web-pilot:php-contract',
            '- required_check: test:turnero:web-pilot:ui | state: green | command: npm run test:turnero:web-pilot:ui',
            '',
        ].join('\n'),
        'utf8'
    );
    writeFileSync(
        join(root, 'verification', 'agent-runs', 'CDX-062.md'),
        [
            '# CDX-062',
            '- required_check: test:turnero:web-pilot:contracts | state: green | command: npm run test:turnero:web-pilot:contracts',
            '- required_check: test:turnero:web-pilot:php-contract | state: green | command: npm run test:turnero:web-pilot:php-contract',
            '- required_check: test:turnero:web-pilot:ui | state: green | command: npm run test:turnero:web-pilot:ui',
            '',
        ].join('\n'),
        'utf8'
    );

    const snapshotState = focusDomain.loadLocalRequiredCheckSnapshot(
        {
            id: 'FOCUS-2026-03-turnero-web-pilot-multi-clinic-cut-1',
            required_checks: [
                'test:turnero:web-pilot:contracts',
                'test:turnero:web-pilot:php-contract',
                'test:turnero:web-pilot:ui',
            ],
        },
        {
            rootPath: root,
            board: {
                strategy: {
                    active: {
                        id: 'STRAT-2026-03-turnero-web-pilot-multi-clinic-local',
                        started_at: '2026-03-28T20:00:00Z',
                    },
                },
                tasks: [
                    {
                        id: 'CDX-061',
                        status: 'review',
                        strategy_id:
                            'STRAT-2026-03-turnero-web-pilot-multi-clinic-local',
                        subfront_id:
                            'SF-frontend-turnero-web-pilot-multi-clinic',
                        focus_id:
                            'FOCUS-2026-03-turnero-web-pilot-multi-clinic-cut-1',
                        updated_at: '2026-03-28T20:46:44Z',
                        acceptance_ref: 'verification/agent-runs/CDX-061.md',
                        evidence_ref: 'verification/agent-runs/CDX-061.md',
                    },
                    {
                        id: 'CDX-062',
                        status: 'review',
                        strategy_id:
                            'STRAT-2026-03-turnero-web-pilot-multi-clinic-local',
                        subfront_id:
                            'SF-backend-turnero-web-pilot-multi-clinic',
                        focus_id:
                            'FOCUS-2026-03-turnero-web-pilot-multi-clinic-cut-1',
                        updated_at: '2026-03-28T20:46:43Z',
                        acceptance_ref: 'verification/agent-runs/CDX-062.md',
                        evidence_ref: 'verification/agent-runs/CDX-062.md',
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
                'test:turnero:web-pilot:contracts',
                'test:turnero:web-pilot:php-contract',
                'test:turnero:web-pilot:ui',
            ],
        },
        {
            localRequiredCheckSnapshot: snapshotState,
        }
    );

    assert.deepEqual(
        checks.map((item) => [item.id, item.state]),
        [
            ['test:turnero:web-pilot:contracts', 'green'],
            ['test:turnero:web-pilot:php-contract', 'green'],
            ['test:turnero:web-pilot:ui', 'green'],
        ]
    );
});

test('focus loadLocalRequiredCheckSnapshot usa evidencia frontend/backend para el foco turnero remoto por clinica', (t) => {
    const root = mkdtempSync(join(tmpdir(), 'focus-turnero-web-pilot-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));

    mkdirSync(join(root, 'verification', 'agent-runs'), { recursive: true });
    writeFileSync(
        join(root, 'verification', 'agent-runs', 'CDX-062.md'),
        [
            '# CDX-062',
            '- required_check: test:turnero:web-pilot:contracts | state: green | command: npm run test:turnero:web-pilot:contracts',
            '- required_check: test:turnero:web-pilot:php-contract | state: green | command: npm run test:turnero:web-pilot:php-contract',
            '- required_check: test:turnero:web-pilot:ui | state: green | command: npm run test:turnero:web-pilot:ui',
            '',
        ].join('\n'),
        'utf8'
    );
    writeFileSync(
        join(root, 'verification', 'agent-runs', 'CDX-063.md'),
        [
            '# CDX-063',
            '- required_check: test:turnero:web-pilot:contracts | state: green | command: npm run test:turnero:web-pilot:contracts',
            '- required_check: test:turnero:web-pilot:php-contract | state: green | command: npm run test:turnero:web-pilot:php-contract',
            '- required_check: test:turnero:web-pilot:ui | state: green | command: npm run test:turnero:web-pilot:ui',
            '',
        ].join('\n'),
        'utf8'
    );

    const snapshotState = focusDomain.loadLocalRequiredCheckSnapshot(
        {
            id: 'FOCUS-2026-03-turnero-web-pilot-cut-1',
            required_checks: [
                'test:turnero:web-pilot:contracts',
                'test:turnero:web-pilot:php-contract',
                'test:turnero:web-pilot:ui',
            ],
        },
        {
            rootPath: root,
            board: {
                strategy: {
                    active: {
                        id: 'STRAT-2026-03-turnero-web-pilot',
                        started_at: '2026-03-28T17:00:00Z',
                    },
                },
                tasks: [
                    {
                        id: 'CDX-062',
                        status: 'review',
                        strategy_id: 'STRAT-2026-03-turnero-web-pilot',
                        subfront_id: 'SF-backend-turnero-web-pilot',
                        focus_id: 'FOCUS-2026-03-turnero-web-pilot-cut-1',
                        updated_at: '2026-03-28T17:46:44Z',
                        acceptance_ref: 'verification/agent-runs/CDX-062.md',
                        evidence_ref: 'verification/agent-runs/CDX-062.md',
                    },
                    {
                        id: 'CDX-063',
                        status: 'review',
                        strategy_id: 'STRAT-2026-03-turnero-web-pilot',
                        subfront_id: 'SF-frontend-turnero-web-pilot',
                        focus_id: 'FOCUS-2026-03-turnero-web-pilot-cut-1',
                        updated_at: '2026-03-28T17:46:43Z',
                        acceptance_ref: 'verification/agent-runs/CDX-063.md',
                        evidence_ref: 'verification/agent-runs/CDX-063.md',
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
                'test:turnero:web-pilot:contracts',
                'test:turnero:web-pilot:php-contract',
                'test:turnero:web-pilot:ui',
            ],
        },
        {
            localRequiredCheckSnapshot: snapshotState,
        }
    );

    assert.deepEqual(
        checks.map((item) => [item.id, item.state]),
        [
            ['test:turnero:web-pilot:contracts', 'green'],
            ['test:turnero:web-pilot:php-contract', 'green'],
            ['test:turnero:web-pilot:ui', 'green'],
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
                        strategy_id:
                            'STRAT-2026-03-public-v6-es-voz-ecuatoriana',
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
                        command:
                            'TEST_LOCAL_SERVER=php npm run test:frontend:qa:v6',
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

test('focus buildFocusSummary expone external_blocker_tasks para blockers externos reconocidos', () => {
    const board = {
        strategy: {
            active: {
                id: 'STRAT-2026-03-admin-operativo',
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
                focus_owner: 'deck',
                focus_review_due_at: '2026-03-30',
                focus_evidence_ref: '',
                focus_max_active_slices: 3,
            },
        },
        tasks: [
            {
                id: 'CDX-009',
                status: 'blocked',
                blocked_reason: 'host_public_health_502_external_blocker',
                strategy_id: 'STRAT-2026-03-admin-operativo',
                focus_id: 'FOCUS-2026-03-admin-operativo-cut-1',
                focus_step: 'pilot_readiness_evidence',
                integration_slice: 'ops_deploy',
                work_type: 'support',
            },
            {
                id: 'CDX-054',
                status: 'review',
                strategy_id: 'STRAT-2026-03-admin-operativo',
                focus_id: 'FOCUS-2026-03-admin-operativo-cut-1',
                focus_step: 'feedback_trim',
                integration_slice: 'frontend_runtime',
                work_type: 'forward',
            },
        ],
    };

    const summary = focusDomain.buildFocusSummary(board, {
        decisionsData: { decisions: [] },
        jobsSnapshot: [],
    });

    assert.equal(summary.acknowledged_external_blocker, true);
    assert.deepEqual(summary.external_blocker_task_ids, ['CDX-009']);
    assert.deepEqual(summary.external_blocker_tasks, [
        {
            id: 'CDX-009',
            blocked_reason: 'host_public_health_502_external_blocker',
            status: 'blocked',
            work_type: 'support',
            focus_step: 'pilot_readiness_evidence',
        },
    ]);
    assert.deepEqual(summary.outside_next_step_task_ids, []);
    assert.equal(
        summary.blocking_errors.includes('task_outside_next_step'),
        false
    );
});

test('focus buildFocusSeed soporta admin shell rc2 con QA admin como unico required check', () => {
    const seed = focusDomain.buildFocusSeed({
        id: 'STRAT-2026-03-admin-shell-rc2-polish',
        owner: 'deck',
        review_due_at: '2026-03-31',
    });

    assert.equal(seed.focus_id, 'FOCUS-2026-03-admin-shell-rc2-polish-cut-1');
    assert.deepEqual(seed.focus_steps, ['shell_nav_ergonomics', 'qa_closeout']);
    assert.deepEqual(seed.focus_required_checks, ['test:frontend:qa:admin']);
    assert.equal(seed.focus_next_step, 'shell_nav_ergonomics');
    assert.equal(seed.focus_max_active_slices, 1);
});

test('focus buildFocusSeed soporta codex governance v2 adoption sin required checks de producto', () => {
    const seed = focusDomain.buildFocusSeed({
        id: 'STRAT-2026-03-codex-governance-v2-adoption',
        owner: 'deck',
        review_due_at: '2026-04-02',
    });

    assert.equal(
        seed.focus_id,
        'FOCUS-2026-03-codex-governance-v2-adoption-cut-1'
    );
    assert.deepEqual(seed.focus_steps, [
        'canon_adoption',
        'root_donor_quarantine',
        'rescue_slice_preparation',
    ]);
    assert.deepEqual(seed.focus_required_checks, []);
    assert.equal(seed.focus_next_step, 'canon_adoption');
    assert.equal(seed.focus_max_active_slices, 1);
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
                        strategy_id:
                            'STRAT-2026-03-public-v6-es-voz-ecuatoriana',
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
                    'content:public-v6:validate': 'node -e "process.exit(0)"',
                    'audit:public:v6:copy': 'node -e "process.exit(0)"',
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
                    'content:public-v6:validate': 'node -e "process.exit(0)"',
                    'audit:public:v6:copy': 'node -e "process.exit(0)"',
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
    assert.equal(snapshotState.reason, 'worktree_status_fingerprint_mismatch');
    assert.equal(
        snapshotState.stale_reason,
        'worktree_status_fingerprint_mismatch'
    );
});
