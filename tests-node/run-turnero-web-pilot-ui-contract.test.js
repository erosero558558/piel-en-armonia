'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    SUITES,
    OUTPUT_JSON,
    OUTPUT_MD,
    buildReport,
    collectSuiteResults,
} = require('../bin/run-turnero-web-pilot-ui.js');

test('turnero web-pilot ui mantiene el orden canonico de suites con workers=1', () => {
    assert.deepEqual(
        SUITES.map((suite) => ({
            id: suite.id,
            label: suite.label,
            args: suite.args,
        })),
        [
            {
                id: 'admin_queue',
                label: 'Admin queue',
                args: ['tests/admin-queue.spec.js', '--workers=1'],
            },
            {
                id: 'queue_kiosk',
                label: 'Queue kiosk',
                args: ['tests/queue-kiosk.spec.js', '--workers=1'],
            },
            {
                id: 'queue_operator',
                label: 'Queue operator',
                args: ['tests/queue-operator.spec.js', '--workers=1'],
            },
            {
                id: 'queue_display',
                label: 'Queue display',
                args: ['tests/queue-display.spec.js', '--workers=1'],
            },
            {
                id: 'queue_integrated_flow',
                label: 'Queue integrated flow',
                args: ['tests/queue-integrated-flow.spec.js', '--workers=1'],
            },
        ]
    );
    assert.match(OUTPUT_JSON, /verification\/turnero-web-pilot\/ui-report\.json$/);
    assert.match(OUTPUT_MD, /verification\/turnero-web-pilot\/ui-report\.md$/);
});

test('turnero web-pilot ui sigue corriendo suites despues de un fallo y reporta la suite roja', () => {
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
                command: suite.args.join(' '),
                startedAt: '2026-03-27T00:00:00.000Z',
                endedAt: '2026-03-27T00:00:01.000Z',
                durationMs: 1000,
                exitCode: suite.id === 'queue_operator' ? 1 : 0,
                success: suite.id !== 'queue_operator',
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
    assert.match(stdout, /\[turnero-web-pilot-ui\] Running Admin queue/);
    assert.match(stdout, /\[turnero-web-pilot-ui\] Queue operator: FAIL \(1000ms\)/);

    const report = buildReport(suites, { TEST_LOCAL_SERVER_PORT: '8019' });
    assert.equal(report.ok, false);
    assert.equal(report.testLocalServerPort, '8019');
    assert.deepEqual(report.failures, ['Queue operator failed']);
});
