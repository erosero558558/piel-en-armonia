#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { DEFAULT_SERVER_ENGINE } = require('./run-playwright-local.js');
const {
    ADMIN_QUEUE_UI_SUITES,
    buildAdminQueueSuiteArgs,
} = require('./lib/admin-queue-ui-suites.js');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'verification', 'admin-queue');
const OUTPUT_JSON = path.join(OUT_DIR, 'ui-report.json');
const OUTPUT_MD = path.join(OUT_DIR, 'ui-report.md');
const LOCAL_PLAYWRIGHT_RUNNER = path.join(__dirname, 'run-playwright-local.js');
const DEFAULT_TEST_LOCAL_SERVER_ENGINE = 'node';
const SUITES = ADMIN_QUEUE_UI_SUITES;

function tailLines(text, maxLines = 20) {
    return String(text || '')
        .replace(/\r\n/g, '\n')
        .split('\n')
        .filter(Boolean)
        .slice(-maxLines)
        .join('\n');
}

function resolveSuiteServerEngine(suite, env = process.env) {
    const value =
        suite.serverEngine ||
        env.TEST_LOCAL_SERVER_ENGINE ||
        DEFAULT_TEST_LOCAL_SERVER_ENGINE;
    return String(value || DEFAULT_TEST_LOCAL_SERVER_ENGINE).trim();
}

function buildSuiteArgs(suite) {
    return buildAdminQueueSuiteArgs(suite);
}

function runSuite(suite) {
    const startedAt = new Date();
    const args = buildSuiteArgs(suite);
    const serverEngine = resolveSuiteServerEngine(suite, process.env);
    const result = spawnSync(process.execPath, [LOCAL_PLAYWRIGHT_RUNNER, ...args], {
        cwd: ROOT,
        encoding: 'utf8',
        env: {
            ...process.env,
            TEST_LOCAL_SERVER_ENGINE: serverEngine,
        },
        shell: false,
        maxBuffer: 1024 * 1024 * 40,
    });
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
        spec: suite.spec,
        serverEngine,
        command: `${process.execPath} ${path.relative(ROOT, LOCAL_PLAYWRIGHT_RUNNER).replace(/\\/g, '/')} ${args.join(' ')}`,
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

function writeLine(io, line) {
    if (io && io.stdout && typeof io.stdout.write === 'function') {
        io.stdout.write(`${line}\n`);
    }
}

function collectSuiteResults(runSuiteFn = runSuite, io = process) {
    const suites = [];
    for (const suite of SUITES) {
        writeLine(io, `[admin-queue-ui] Running ${suite.label}`);
        const result = runSuiteFn(suite);
        suites.push(result);
        writeLine(
            io,
            `[admin-queue-ui] ${suite.label}: ${result.success ? 'PASS' : 'FAIL'} (${result.durationMs}ms)`
        );
    }
    return suites;
}

function buildReport(suites, env = process.env) {
    const failures = suites
        .filter((suite) => !suite.success)
        .map((suite) => `${suite.label} failed`);

    return {
        generatedAt: new Date().toISOString(),
        ok: failures.length === 0,
        defaultServerEngine: DEFAULT_SERVER_ENGINE,
        defaultTestLocalServerEngine:
            env.TEST_LOCAL_SERVER_ENGINE || DEFAULT_TEST_LOCAL_SERVER_ENGINE,
        testLocalServerPort: env.TEST_LOCAL_SERVER_PORT || 'auto',
        suites,
        failures,
    };
}

function buildMarkdown(report) {
    const lines = [
        '# Admin Queue UI',
        '',
        `- Generated At: ${report.generatedAt}`,
        `- Status: ${report.ok ? 'PASS' : 'FAIL'}`,
        `- TEST_LOCAL_SERVER_PORT: ${report.testLocalServerPort}`,
        `- Default server engine: ${report.defaultServerEngine}`,
        `- Admin queue server engine: ${report.defaultTestLocalServerEngine}`,
        '',
        '| Suite | Spec | Engine | Status | Exit | Duration (ms) |',
        '| --- | --- | --- | --- | --- | --- |',
        ...report.suites.map((suite) => {
            const status = suite.success ? 'PASS' : 'FAIL';
            return `| ${suite.label} | ${suite.spec} | ${suite.serverEngine} | ${status} | ${suite.exitCode} | ${suite.durationMs} |`;
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

    const suites = collectSuiteResults(runSuite, process);
    const report = buildReport(suites, process.env);

    fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    fs.writeFileSync(OUTPUT_MD, buildMarkdown(report), 'utf8');

    process.stdout.write(
        [
            `[admin-queue-ui] Report JSON: ${path.relative(ROOT, OUTPUT_JSON).replace(/\\/g, '/')}`,
            `[admin-queue-ui] Report MD: ${path.relative(ROOT, OUTPUT_MD).replace(/\\/g, '/')}`,
            '',
        ].join('\n')
    );

    if (!report.ok) {
        process.exitCode = 1;
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    DEFAULT_TEST_LOCAL_SERVER_ENGINE,
    SUITES,
    OUTPUT_JSON,
    OUTPUT_MD,
    buildReport,
    buildMarkdown,
    buildSuiteArgs,
    collectSuiteResults,
    resolveSuiteServerEngine,
    runSuite,
};
