#!/usr/bin/env node
'use strict';

const { execFileSync } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const ROOT = process.env.AURORA_DERM_ROOT
    ? resolve(process.env.AURORA_DERM_ROOT)
    : resolve(__dirname, '..');
const JSON_MODE = process.argv.includes('--json');
const CANONICAL_TASK_ID_FRAGMENT = '(?:S\\d+|UI\\d*)-[A-Z0-9]+';
const REGEX_SOURCE_FILES = [
    'bin/claim.js',
    'bin/dispatch.js',
    'bin/report.js',
    'bin/velocity.js',
];
const BACKLOG_FILE = resolve(ROOT, 'BACKLOG.md');
const SITEMAP_FILE = resolve(ROOT, 'sitemap.xml');
const BROKEN_SCRIPTS_FILE = resolve(ROOT, 'governance', 'broken-scripts.json');

function read(filePath) {
    return existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
}

function runNodeScript(relativeScriptPath, args = []) {
    const scriptPath = resolve(ROOT, relativeScriptPath);
    try {
        const stdout = execFileSync(process.execPath, [scriptPath, ...args], {
            cwd: ROOT,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            maxBuffer: 1024 * 1024 * 8,
        }).trim();
        return { ok: true, status: 0, stdout, stderr: '' };
    } catch (error) {
        return {
            ok: false,
            status: typeof error.status === 'number' ? error.status : 1,
            stdout:
                typeof error.stdout === 'string' ? error.stdout.trim() : '',
            stderr:
                typeof error.stderr === 'string' ? error.stderr.trim() : '',
        };
    }
}

function buildCheck(id, label, state, summary, details = {}) {
    return { id, label, state, summary, details };
}

function summarizeChecks(checks) {
    const counts = { green: 0, yellow: 0, red: 0 };
    checks.forEach((check) => {
        counts[check.state] = (counts[check.state] || 0) + 1;
    });
    const overallState =
        counts.red > 0 ? 'red' : counts.yellow > 0 ? 'yellow' : 'green';

    return {
        ok: overallState === 'green',
        overallState,
        counts,
        checks,
    };
}

function parseReportSummary(raw) {
    const match = String(raw || '').match(
        /(\d+)\/(\d+)\s+tareas completadas,\s*(\d+)\s+pendientes/i
    );
    if (!match) {
        return null;
    }

    return {
        done: Number(match[1]),
        total: Number(match[2]),
        pending: Number(match[3]),
    };
}

function parseOrchestratorSummary(raw) {
    try {
        const parsed = JSON.parse(String(raw || '{}'));
        const backlog =
            parsed &&
            parsed.backlog &&
            typeof parsed.backlog === 'object' &&
            !Array.isArray(parsed.backlog)
                ? parsed.backlog
                : null;

        if (!backlog) {
            return null;
        }

        return {
            done: Number(backlog.done || 0),
            total: Number(backlog.total || 0),
            pending: Number(backlog.pending || 0),
        };
    } catch {
        return null;
    }
}

function loadBrokenScriptsReport(filePath = BROKEN_SCRIPTS_FILE) {
    try {
        const parsed = JSON.parse(read(filePath));
        return {
            count: Number(parsed.count || 0),
            broken: Array.isArray(parsed.broken) ? parsed.broken : [],
            domains:
                parsed.domains && typeof parsed.domains === 'object'
                    ? parsed.domains
                    : {},
        };
    } catch {
        return {
            count: 0,
            broken: [],
            domains: {},
            parseError: true,
        };
    }
}

function evaluateRegexConsistency({
    sources = REGEX_SOURCE_FILES.map((relativePath) => ({
        file: relativePath,
        source: read(resolve(ROOT, relativePath)),
    })),
    fragment = CANONICAL_TASK_ID_FRAGMENT,
} = {}) {
    const missing = sources
        .filter((entry) => !String(entry.source || '').includes(fragment))
        .map((entry) => entry.file);

    return buildCheck(
        'regex_consistency',
        'Regex task IDs',
        missing.length === 0 ? 'green' : 'red',
        missing.length === 0
            ? `Patron canonico presente en ${sources.length} scripts.`
            : `Falta el patron canonico en: ${missing.join(', ')}`,
        {
            fragment,
            files: sources.map((entry) => entry.file),
            missing,
        }
    );
}

function evaluateBacklogSync({
    result = runNodeScript('bin/sync-backlog.js', ['--check']),
    backlogFile = BACKLOG_FILE,
} = {}) {
    const state = result.ok ? 'green' : existsSync(backlogFile) ? 'red' : 'red';
    const detail = (result.stdout || result.stderr || '').split('\n')[0] || '';

    return buildCheck(
        'backlog_sync',
        'Backlog sync',
        state,
        result.ok
            ? 'BACKLOG.md esta sincronizado con AGENTS.md.'
            : detail || 'BACKLOG.md no esta sincronizado.',
        {
            exitCode: result.status,
            detail,
        }
    );
}

function evaluateSitemapHealth({ sitemapXml = read(SITEMAP_FILE) } = {}) {
    const urlCount = (String(sitemapXml || '').match(/<loc>/g) || []).length;
    const state = urlCount > 70 ? 'green' : urlCount >= 60 ? 'yellow' : 'red';

    return buildCheck(
        'sitemap_coverage',
        'Sitemap coverage',
        state,
        `${urlCount} URLs detectadas en sitemap.xml.`,
        { urlCount }
    );
}

function evaluateBrokenScriptsHealth({
    verifyResult = runNodeScript('bin/verify-scripts.js'),
    report = loadBrokenScriptsReport(),
} = {}) {
    const count = Number(report.count || 0);
    const state = count < 5 ? 'green' : count < 10 ? 'yellow' : 'red';
    const topBroken = Array.isArray(report.broken) ? report.broken.slice(0, 5) : [];

    return buildCheck(
        'broken_scripts',
        'Broken scripts',
        state,
        `${count} scripts rotos en governance/broken-scripts.json.`,
        {
            exitCode: verifyResult.status,
            ok: verifyResult.ok,
            count,
            topBroken,
        }
    );
}

function evaluateConvergenceHealth({
    reportResult = runNodeScript('bin/report.js'),
    orchestratorResult = runNodeScript('agent-orchestrator.js', ['status', '--json']),
} = {}) {
    const reportSummary = parseReportSummary(reportResult.stdout || reportResult.stderr);
    const orchestratorSummary = parseOrchestratorSummary(
        orchestratorResult.stdout || orchestratorResult.stderr
    );

    if (!reportSummary || !orchestratorSummary) {
        return buildCheck(
            'orchestrator_convergence',
            'Report/orchestrator convergence',
            'red',
            'No se pudo parsear report o agent-orchestrator.',
            {
                reportSummary,
                orchestratorSummary,
            }
        );
    }

    const deltas = {
        done: Math.abs(reportSummary.done - orchestratorSummary.done),
        total: Math.abs(reportSummary.total - orchestratorSummary.total),
        pending: Math.abs(reportSummary.pending - orchestratorSummary.pending),
    };
    const maxDelta = Math.max(deltas.done, deltas.total, deltas.pending);
    const state = maxDelta === 0 ? 'green' : maxDelta <= 2 ? 'yellow' : 'red';

    return buildCheck(
        'orchestrator_convergence',
        'Report/orchestrator convergence',
        state,
        maxDelta === 0
            ? `report y agent-orchestrator convergen en ${reportSummary.done}/${reportSummary.total}.`
            : `Drift detectado entre report y agent-orchestrator (max delta ${maxDelta}).`,
        {
            reportSummary,
            orchestratorSummary,
            deltas,
        }
    );
}

function runHealthCheck(options = {}) {
    const checks = [
        evaluateRegexConsistency(options.regexConsistency),
        evaluateBacklogSync(options.backlogSync),
        evaluateSitemapHealth(options.sitemapCoverage),
        evaluateBrokenScriptsHealth(options.brokenScripts),
        evaluateConvergenceHealth(options.orchestratorConvergence),
    ];

    return summarizeChecks(checks);
}

function formatHealthText(report) {
    const icon = {
        green: '🟢',
        yellow: '🟡',
        red: '🔴',
    };
    const lines = [
        '🩺 Aurora Derm — Agent Health Check',
        '',
    ];

    report.checks.forEach((check) => {
        lines.push(`${icon[check.state]} ${check.label}`);
        lines.push(`   ${check.summary}`);
    });

    lines.push('');
    lines.push(
        `📊 Estado general: ${report.overallState.toUpperCase()} (${report.counts.green} green, ${report.counts.yellow} yellow, ${report.counts.red} red)`
    );

    return `${lines.join('\n')}\n`;
}

function main() {
    const report = runHealthCheck();

    if (JSON_MODE) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
        process.stdout.write(formatHealthText(report));
    }

    return report.ok ? 0 : 1;
}

if (require.main === module) {
    process.exit(main());
}

module.exports = {
    CANONICAL_TASK_ID_FRAGMENT,
    REGEX_SOURCE_FILES,
    buildCheck,
    evaluateBacklogSync,
    evaluateBrokenScriptsHealth,
    evaluateConvergenceHealth,
    evaluateRegexConsistency,
    evaluateSitemapHealth,
    formatHealthText,
    loadBrokenScriptsReport,
    main,
    parseOrchestratorSummary,
    parseReportSummary,
    runHealthCheck,
    runNodeScript,
    summarizeChecks,
};
