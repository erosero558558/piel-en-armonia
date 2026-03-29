'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    ADMIN_QUEUE_UI_SUITES,
} = require('../bin/lib/admin-queue-ui-suites.js');
const {
    DEFAULT_TEST_LOCAL_SERVER_ENGINE,
    SUITES,
    OUTPUT_JSON,
    OUTPUT_MD,
    buildReport,
    buildSuiteArgs,
    collectSuiteResults,
    resolveSuiteServerEngine,
} = require('../bin/run-admin-queue-ui.js');

test('admin queue ui runner mantiene el orden canonico de las cinco suites admin', () => {
    assert.equal(DEFAULT_TEST_LOCAL_SERVER_ENGINE, 'node');
    assert.deepEqual(SUITES, ADMIN_QUEUE_UI_SUITES);
    assert.deepEqual(
        SUITES.map((suite) => ({
            id: suite.id,
            label: suite.label,
            spec: suite.spec,
            serverEngine: suite.serverEngine,
            args: buildSuiteArgs(suite),
        })),
        [
            {
                id: 'admin_queue_guidance_live_ops',
                label: 'Admin queue guidance live ops',
                spec: 'tests/admin-queue-guidance-live-ops.spec.js',
                serverEngine: 'node',
                args: [
                    'tests/admin-queue-guidance-live-ops.spec.js',
                    '--workers=1',
                ],
            },
            {
                id: 'admin_queue_reception_escalation',
                label: 'Admin queue reception escalation',
                spec: 'tests/admin-queue-reception-escalation.spec.js',
                serverEngine: 'node',
                args: [
                    'tests/admin-queue-reception-escalation.spec.js',
                    '--workers=1',
                ],
            },
            {
                id: 'admin_queue_controls_numpad',
                label: 'Admin queue controls numpad',
                spec: 'tests/admin-queue-controls-numpad.spec.js',
                serverEngine: 'node',
                args: ['tests/admin-queue-controls-numpad.spec.js', '--workers=1'],
            },
            {
                id: 'admin_queue_pilot_governance',
                label: 'Admin queue pilot governance',
                spec: 'tests/admin-queue-pilot-governance.spec.js',
                serverEngine: 'node',
                args: [
                    'tests/admin-queue-pilot-governance.spec.js',
                    '--workers=1',
                ],
            },
            {
                id: 'admin_queue_ops_hub',
                label: 'Admin queue ops hub',
                spec: 'tests/admin-queue-ops-hub.spec.js',
                serverEngine: 'node',
                args: ['tests/admin-queue-ops-hub.spec.js', '--workers=1'],
            },
        ]
    );
    assert.match(OUTPUT_JSON, /verification\/admin-queue\/ui-report\.json$/);
    assert.match(OUTPUT_MD, /verification\/admin-queue\/ui-report\.md$/);
});

test('admin queue ui runner preserva server_engine=node y continua tras un fallo', () => {
    const executed = [];
    let stdout = '';
    const io = {
        stdout: {
            write(chunk) {
                stdout += String(chunk);
                return true;
            },
        },
    };

    const suites = collectSuiteResults(
        (suite) => {
            executed.push(suite.id);
            return {
                id: suite.id,
                label: suite.label,
                spec: suite.spec,
                serverEngine: resolveSuiteServerEngine(suite, {}),
                command: buildSuiteArgs(suite).join(' '),
                startedAt: '2026-03-28T00:00:00.000Z',
                endedAt: '2026-03-28T00:00:01.000Z',
                durationMs: 1000,
                exitCode: suite.id === 'admin_queue_ops_hub' ? 1 : 0,
                success: suite.id !== 'admin_queue_ops_hub',
                stdoutTail: '',
                stderrTail: '',
                error: '',
            };
        },
        io
    );

    assert.deepEqual(
        executed,
        SUITES.map((suite) => suite.id)
    );
    assert.match(stdout, /\[admin-queue-ui\] Running Admin queue guidance live ops/);
    assert.match(stdout, /\[admin-queue-ui\] Admin queue ops hub: FAIL \(1000ms\)/);

    const report = buildReport(suites, { TEST_LOCAL_SERVER_PORT: 'auto' });
    assert.equal(report.ok, false);
    assert.equal(report.defaultTestLocalServerEngine, 'node');
    assert.deepEqual(report.failures, ['Admin queue ops hub failed']);
    assert.equal(report.suites[0].serverEngine, 'node');
    assert.equal(report.suites.at(-1).serverEngine, 'node');
});
