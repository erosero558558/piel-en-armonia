#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'verification', 'turnero-web-pilot');
const OUTPUT_JSON = path.join(OUT_DIR, 'ui-report.json');
const OUTPUT_MD = path.join(OUT_DIR, 'ui-report.md');
const LOCAL_PLAYWRIGHT_RUNNER = path.join(__dirname, 'run-playwright-local.js');

const SUITES = [
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
];

function tailLines(text, maxLines = 20) {
    return String(text || '')
        .replace(/\r\n/g, '\n')
        .split('\n')
        .filter(Boolean)
        .slice(-maxLines)
        .join('\n');
}

function runSuite(suite) {
    const startedAt = new Date();
    const result = spawnSync(
        process.execPath,
        [LOCAL_PLAYWRIGHT_RUNNER, ...suite.args],
        {
            cwd: ROOT,
            encoding: 'utf8',
            env: {
                ...process.env,
            },
            shell: false,
            maxBuffer: 1024 * 1024 * 40,
        }
    );
    const endedAt = new Date();
    const exitCode =
        typeof result.status === 'number'
            ? result.status
            : result.error
              ? 1
              : 0;

    return {
        id: suite.id,
        label: suite.label,
        command: `${process.execPath} ${path.relative(ROOT, LOCAL_PLAYWRIGHT_RUNNER).replace(/\\/g, '/')} ${suite.args.join(' ')}`,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs: endedAt.getTime() - startedAt.getTime(),
        exitCode,
        success: exitCode === 0,
        stdoutTail: tailLines(result.stdout),
        stderrTail: tailLines(result.stderr),
        error: result.error ? String(result.error.message || result.error) : '',
    };
}

function buildMarkdown(report) {
    const lines = [
        '# Turnero Web Pilot UI',
        '',
        `- Generated At: ${report.generatedAt}`,
        `- Status: ${report.ok ? 'PASS' : 'FAIL'}`,
        `- TEST_LOCAL_SERVER_PORT: ${report.testLocalServerPort}`,
        '',
        '| Suite | Status | Exit |',
        '| --- | --- | --- |',
        ...report.suites.map((suite) => {
            const status = suite.success ? 'PASS' : 'FAIL';
            return `| ${suite.label} | ${status} | ${suite.exitCode} |`;
        }),
        '',
    ];

    if (report.failures.length) {
        lines.push('## Failures');
        lines.push('');
        report.failures.forEach((failure) => lines.push(`- ${failure}`));
        lines.push('');
    }

    return `${lines.join('\n')}\n`;
}

function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const suites = [];
    for (const suite of SUITES) {
        process.stdout.write(`[turnero-web-pilot-ui] Running ${suite.label}\n`);
        const result = runSuite(suite);
        suites.push(result);
        process.stdout.write(
            `[turnero-web-pilot-ui] ${suite.label}: ${result.success ? 'PASS' : 'FAIL'} (${result.durationMs}ms)\n`
        );
    }

    const failures = suites
        .filter((suite) => !suite.success)
        .map((suite) => `${suite.label} failed`);

    const report = {
        generatedAt: new Date().toISOString(),
        ok: failures.length === 0,
        testLocalServerPort: process.env.TEST_LOCAL_SERVER_PORT || 'auto',
        suites,
        failures,
    };

    fs.writeFileSync(
        OUTPUT_JSON,
        `${JSON.stringify(report, null, 2)}\n`,
        'utf8'
    );
    fs.writeFileSync(OUTPUT_MD, buildMarkdown(report), 'utf8');

    process.stdout.write(
        [
            `[turnero-web-pilot-ui] Report JSON: ${path.relative(ROOT, OUTPUT_JSON).replace(/\\/g, '/')}`,
            `[turnero-web-pilot-ui] Report MD: ${path.relative(ROOT, OUTPUT_MD).replace(/\\/g, '/')}`,
            '',
        ].join('\n')
    );

    if (!report.ok) {
        process.exitCode = 1;
    }
}

main();
