'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const packageJson = JSON.parse(
    readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf8')
);
const {
    CANONICAL_TASK_ID_FRAGMENT,
    evaluateConvergenceHealth,
    evaluateRegexConsistency,
    formatHealthText,
    parseOrchestratorSummary,
    parseReportSummary,
    runHealthCheck,
} = require('../bin/health-check.js');

test('package script expone agent:health', () => {
    assert.equal(packageJson.scripts['agent:health'], 'node bin/health-check.js');
});

test('parse helpers leen report y orchestrator', () => {
    assert.deepEqual(
        parseReportSummary('175/420 tareas completadas, 245 pendientes'),
        {
            done: 175,
            total: 420,
            pending: 245,
        }
    );
    assert.deepEqual(
        parseOrchestratorSummary(
            JSON.stringify({
                backlog: { done: 175, pending: 245, total: 420 },
            })
        ),
        {
            done: 175,
            total: 420,
            pending: 245,
        }
    );
});

test('regex consistency stays green with the canonical task id fragment', () => {
    const check = evaluateRegexConsistency({
        sources: [
            { file: 'claim.js', source: `/${CANONICAL_TASK_ID_FRAGMENT}/` },
            { file: 'dispatch.js', source: `/${CANONICAL_TASK_ID_FRAGMENT}/` },
            { file: 'report.js', source: `/${CANONICAL_TASK_ID_FRAGMENT}/` },
            { file: 'velocity.js', source: `/${CANONICAL_TASK_ID_FRAGMENT}/` },
        ],
    });

    assert.equal(check.state, 'green');
});

test('convergence check turns green when report and orchestrator agree', () => {
    const check = evaluateConvergenceHealth({
        reportResult: {
            stdout: '175/420 tareas completadas, 245 pendientes',
        },
        orchestratorResult: {
            stdout: JSON.stringify({
                backlog: { done: 175, pending: 245, total: 420 },
            }),
        },
    });

    assert.equal(check.state, 'green');
    assert.match(check.summary, /convergen/i);
});

test('runHealthCheck reports green and exits logically when every check is healthy', () => {
    const report = runHealthCheck({
        regexConsistency: {
            sources: [
                { file: 'claim.js', source: CANONICAL_TASK_ID_FRAGMENT },
                { file: 'dispatch.js', source: CANONICAL_TASK_ID_FRAGMENT },
                { file: 'report.js', source: CANONICAL_TASK_ID_FRAGMENT },
                { file: 'velocity.js', source: CANONICAL_TASK_ID_FRAGMENT },
            ],
        },
        backlogSync: {
            result: { ok: true, status: 0, stdout: '✅ BACKLOG.md is up to date' },
        },
        sitemapCoverage: {
            sitemapXml:
                '<urlset>' + '<loc>https://pielarmonia.com/es/</loc>'.repeat(71) + '</urlset>',
        },
        brokenScripts: {
            verifyResult: { ok: true, status: 0, stdout: '' },
            report: { count: 0, broken: [], domains: {} },
        },
        orchestratorConvergence: {
            reportResult: {
                stdout: '175/420 tareas completadas, 245 pendientes',
            },
            orchestratorResult: {
                stdout: JSON.stringify({
                    backlog: { done: 175, pending: 245, total: 420 },
                }),
            },
        },
    });

    assert.equal(report.ok, true);
    assert.equal(report.overallState, 'green');
    assert.equal(report.counts.green, 5);
    assert.match(formatHealthText(report), /Estado general: GREEN/);
});
