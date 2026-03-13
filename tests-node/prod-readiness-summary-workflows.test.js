#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    copyFileSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} = require('fs');
const { tmpdir } = require('os');
const { join, resolve } = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = resolve(__dirname, '..');
const SUMMARY_SOURCE = resolve(REPO_ROOT, 'bin', 'prod-readiness-summary.js');
const {
    inferWorkflowFailureDiagnostic,
    computeSuggestedActions,
    markdownWorkflowLine,
} = require(SUMMARY_SOURCE);

function createFixtureDir() {
    const dir = mkdtempSync(join(tmpdir(), 'prod-readiness-workflows-'));
    mkdirSync(join(dir, 'bin'), { recursive: true });
    mkdirSync(join(dir, 'verification', 'runtime'), { recursive: true });
    mkdirSync(join(dir, 'verification', 'weekly'), { recursive: true });
    copyFileSync(SUMMARY_SOURCE, join(dir, 'bin', 'prod-readiness-summary.js'));
    return dir;
}

function writeWeeklyReportWithBom(dir, payload) {
    const weeklyPath = join(
        dir,
        'verification',
        'weekly',
        'weekly-report-20260312.json'
    );
    writeFileSync(
        weeklyPath,
        `\uFEFF${JSON.stringify(payload, null, 2)}\n`,
        'utf8'
    );
    return weeklyPath;
}

function runSummary(dir) {
    const jsonOut = join(dir, 'verification', 'runtime', 'prod-readiness.json');
    const mdOut = join(dir, 'verification', 'runtime', 'prod-readiness.md');
    const result = spawnSync(
        process.execPath,
        [
            join(dir, 'bin', 'prod-readiness-summary.js'),
            '--weekly-source=local',
            `--json-out=${jsonOut}`,
            `--md-out=${mdOut}`,
        ],
        {
            cwd: dir,
            encoding: 'utf8',
        }
    );

    return {
        result,
        jsonOut,
        mdOut,
    };
}

test('prod-readiness-summary tolera weekly report local con BOM UTF-8', () => {
    const dir = createFixtureDir();
    writeWeeklyReportWithBom(dir, {
        generatedAt: '2026-03-12T00:00:00.000Z',
        domain: 'https://pielarmonia.com',
        warningCounts: {
            total: 0,
            critical: 0,
            nonCritical: 0,
        },
        warnings: [],
        warningsBySeverity: {
            critical: [],
            nonCritical: [],
        },
        retention: {},
        retentionTrend: {},
        conversion: {
            viewBooking: 10,
            startCheckout: 4,
            startCheckoutRatePct: 40,
            bookingConfirmed: 2,
            bookingConfirmedRatePct: 20,
        },
        conversionTrend: {},
    });

    try {
        const { result, jsonOut } = runSummary(dir);
        assert.equal(result.status, 0, result.stderr || result.stdout);

        const summary = JSON.parse(readFileSync(jsonOut, 'utf8'));
        assert.equal(summary.weeklyLocalReport.found, true);
        assert.equal(summary.weeklyLocalReport.error, null);
        assert.equal(summary.weeklyLocalReport.warningCounts.critical, 0);
        assert.equal(summary.weeklyLocalReport.conversion.viewBooking, 10);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('prod-readiness-summary clasifica workflow file issue y faltantes de secretos staging', () => {
    const postDeployRun = {
        id: 456,
        status: 'completed',
        conclusion: 'failure',
        url: 'https://example.test/runs/456',
        ageLabel: '1m',
        durationLabel: '0s',
    };
    const deployHostingRun = {
        id: 123,
        status: 'completed',
        conclusion: 'failure',
        url: 'https://example.test/runs/123',
        ageLabel: '5m',
        durationLabel: '5m',
    };
    const ciRun = {
        id: 101,
        status: 'completed',
        conclusion: 'success',
        url: 'https://example.test/runs/101',
        ageLabel: '10m',
        durationLabel: '5m',
    };

    const gateDiagnostic = inferWorkflowFailureDiagnostic({
        workflowRef: '.github/workflows/post-deploy-gate.yml',
        run: postDeployRun,
        jobs: [],
        failedLogText: '',
        failedLogError: 'failed to get run log: log not found',
    });
    const deployDiagnostic = inferWorkflowFailureDiagnostic({
        workflowRef: '.github/workflows/deploy-hosting.yml',
        run: deployHostingRun,
        jobs: [{ name: 'Deploy Canary (Staging)' }],
        failedLogText: [
            '::warning::Falta el secret STAGING_FTP_SERVER',
            '::warning::Falta el secret STAGING_FTP_USERNAME',
            '::warning::Falta el secret STAGING_FTP_PASSWORD',
            'Politica bloqueante: require_staging_canary=true y faltan secretos STAGING_FTP_*.',
            'Configura staging o ejecuta override explicito allow_prod_without_staging=true.',
        ].join('\n'),
        failedLogError: null,
    });

    assert.equal(gateDiagnostic.kind, 'workflow_file_issue');
    assert.equal(deployDiagnostic.kind, 'staging_canary_missing_secrets');
    assert.match(deployDiagnostic.summary, /STAGING_FTP_SERVER/);

    const workflows = {
        ci: {
            available: true,
            latest: ciRun,
            latestEffective: ciRun,
        },
        postDeployGate: {
            available: true,
            workflowRef: '.github/workflows/post-deploy-gate.yml',
            latest: postDeployRun,
            latestEffective: postDeployRun,
            failureDiagnostic: gateDiagnostic,
        },
        deployHosting: {
            available: true,
            workflowRef: '.github/workflows/deploy-hosting.yml',
            latest: deployHostingRun,
            latestEffective: deployHostingRun,
            failureDiagnostic: deployDiagnostic,
        },
    };

    const suggestedActions = computeSuggestedActions({
        workflows,
        openProdAlerts: {
            available: true,
            count: 0,
            issues: [],
        },
        weeklyLocalReport: {
            found: true,
            error: null,
            warningCounts: {
                critical: 0,
                nonCritical: 0,
            },
        },
        weeklyKpiHistory: {
            phase6SchedulePace: {
                signal: 'done',
                reason: 'schedule_target_reached',
            },
            scheduleCyclesRemaining: 0,
        },
        planMasterProgress: {
            pending: [],
        },
        productionStability: {
            signal: 'RED',
        },
        executionEfficiency: {
            signal: 'GREEN',
        },
        sentryEvidence: {
            found: false,
            error: null,
        },
    });

    const deployAction = suggestedActions.items.find(
        (item) => item.id === 'ACT-P0-WF-DEPLOYHOSTING-FAILED'
    );
    assert.ok(
        deployAction,
        'debe generar accion explicita para deploy-hosting fallido'
    );
    assert.match(deployAction.reason, /faltan secretos de staging/i);
    assert.equal(deployAction.command, 'gh secret list');

    const gateAction = suggestedActions.items.find(
        (item) => item.id === 'ACT-P0-WF-POSTDEPLOYGATE-FAILED'
    );
    assert.ok(
        gateAction,
        'debe generar accion explicita para post-deploy-gate fallido'
    );
    assert.match(gateAction.reason, /workflow/i);
    assert.match(
        gateAction.command,
        /gh workflow view '.github\/workflows\/post-deploy-gate\.yml' --yaml/
    );

    const gateMarkdown = markdownWorkflowLine(
        'Post-Deploy Gate (Git Sync)',
        workflows.postDeployGate
    );
    const deployMarkdown = markdownWorkflowLine(
        'Deploy Hosting (Canary Pipeline)',
        workflows.deployHosting
    );
    assert.match(
        gateMarkdown,
        /diag: GitHub rechazo el workflow antes de crear jobs/i
    );
    assert.match(deployMarkdown, /diag: require_staging_canary bloquea/i);
});
