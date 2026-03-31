#!/usr/bin/env node
'use strict';

/**
 * bin/audit.js — Wrapper canónico para auditoría operativa rápida.
 *
 * Ejecuta en secuencia:
 *   1. node bin/velocity.js
 *   2. node bin/verify.js
 *   3. node bin/conflict.js --json
 *   4. php -l lib/email.php
 *   5. php -l controllers/OpenclawController.php
 *
 * Exit 0 solo si todos los pasos pasan.
 */

const { spawnSync } = require('child_process');
const { resolve } = require('path');

const ROOT = resolve(__dirname, '..');

const AUDIT_STEPS = [
    {
        id: 'velocity',
        label: 'Velocity',
        command: 'node',
        args: ['bin/velocity.js'],
    },
    {
        id: 'openapi_drift',
        label: 'OpenAPI Drift',
        command: 'node',
        args: ['bin/check-openapi-drift.js'],
    },
    {
        id: 'verify',
        label: 'Verify',
        command: 'node',
        args: ['bin/verify.js'],
    },
    {
        id: 'conflict',
        label: 'Conflict',
        command: 'node',
        args: ['bin/conflict.js', '--json'],
    },
    {
        id: 'email_php_lint',
        label: 'PHP lint email',
        command: 'php',
        args: ['-l', 'lib/email.php'],
    },
    {
        id: 'openclaw_php_lint',
        label: 'PHP lint OpenClaw',
        command: 'php',
        args: ['-l', 'controllers/OpenclawController.php'],
    },
    {
        // S15-07: verify-scripts integrado en gov:audit
        id: 'verify_scripts',
        label: 'Broken Scripts',
        command: 'node',
        args: ['bin/verify-scripts.js', '--json'],
    },
    {
        // S14-09: Registry de Warnings Operativos
        id: 'warnings_registry',
        label: 'Warning Registry',
        command: 'node',
        args: ['bin/check-warnings.js'],
    },
    {
        id: 'evidence_health',
        label: 'Evidence Health',
        command: 'node',
        args: ['bin/check-evidence-health.js', '--json'],
    },
    {
        id: 'sprint30_smoke',
        label: 'Sprint 30 Smoke Test',
        command: 'node',
        args: ['--test', 'tests-node/sprint30-smoke.test.js'],
        optional: false,
    },
    {
        // Carencia #1: claim expiry + orphan detection
        id: 'claim_gc',
        label: 'Claim GC',
        command: 'node',
        args: ['bin/claim-gc.js', '--json'],
        // Non-blocking: exit 1 means there are stale claims, but doesn't halt the audit
        optional: true,
    },
    {
        // Carencia #2: task contract gate — M/L/XL must have Verificable:
        id: 'task_contract',
        label: 'Task Contracts',
        command: 'node',
        args: ['bin/verify-task-contract.js', '--json'],
        // Optional until all REBORN tasks have Verificable: fields
        optional: true,
    },
];

function formatCommand(step) {
    return [step.command, ...step.args].join(' ');
}

function compactOutput(output) {
    return String(output || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(-3)
        .join(' | ');
}

function runAuditStep(step, runner = defaultRunner) {
    const result = runner(step.command, step.args);
    const exitCode = typeof result.status === 'number' ? result.status : 1;
    const stdout = String(result.stdout || '');
    const stderr = String(result.stderr || '');
    const detail = compactOutput(stderr || stdout) || `exit ${exitCode}`;

    return {
        id: step.id,
        label: step.label,
        command: formatCommand(step),
        exitCode,
        ok: exitCode === 0,
        detail,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
    };
}

function defaultRunner(command, args) {
    return spawnSync(command, args, {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: 'pipe',
    });
}

function runAudit(runner = defaultRunner) {
    const steps = AUDIT_STEPS.map((step) => {
        const result = runAuditStep(step, runner);
        return { ...result, optional: !!step.optional };
    });
    // optional steps don't contribute to the overall ok flag
    const requiredSteps = steps.filter((s) => !s.optional);
    const ok = requiredSteps.every((step) => step.ok);

    return {
        ok,
        stepCount: steps.length,
        passedCount: steps.filter((step) => step.ok).length,
        failedCount: steps.filter((step) => !step.ok).length,
        requiredFailed: requiredSteps.filter((step) => !step.ok).length,
        steps,
    };
}

function formatAuditText(report) {
    const lines = [];
    lines.push('');
    lines.push('🩺 Aurora Derm — Audit Wrapper');
    lines.push('');

    report.steps.forEach((step) => {
        lines.push(`${step.ok ? '✅' : '❌'} ${step.label}`);
        lines.push(`   ${step.command}`);
        lines.push(`   ${step.detail}`);
    });

    lines.push('');
    lines.push(
        `📊 Summary: ${report.passedCount}/${report.stepCount} passed, ${report.failedCount} failed`
    );
    lines.push('');

    if (report.ok) {
        lines.push('🚀 Todo verde — audit completo.');
    } else {
        lines.push('🚨 Audit falló — revisar el primer paso rojo antes de continuar.');
    }

    try {
        const { existsSync, readFileSync } = require('fs');
        const perfJsonPath = require('path').resolve(__dirname, '../governance/performance-gate.json');
        lines.push('');
        lines.push('\u26a1 Performance Gate');
        if (existsSync(perfJsonPath)) {
            const pData = JSON.parse(readFileSync(perfJsonPath, 'utf8'));
            let maxLcp = 0;
            if (pData.routes && Array.isArray(pData.routes)) {
                maxLcp = Math.max(...pData.routes.map(r => r.metrics?.lcpMs || 0));
            }
            if (pData.passed) {
                lines.push(`   \uD83D\uDFE2 Budget OK (Max LCP: ${Math.round(maxLcp)}ms)`);
            } else {
                lines.push(`   \uD83D\uDD34 LCP over budget (Max LCP: ${Math.round(maxLcp)}ms)`);
            }
        } else {
            lines.push('   \u26AA No performance data available');
        }
    } catch (e) {}

    // S15-07: Scripts rotos
    try {
        const { existsSync, readFileSync } = require('fs');
        const brokenPath = require('path').resolve(__dirname, '../governance/broken-scripts.json');
        lines.push('');
        lines.push('\uD83D\uDD27 Scripts rotos');
        if (existsSync(brokenPath)) {
            const broken = JSON.parse(readFileSync(brokenPath, 'utf8'));
            const items = Array.isArray(broken) ? broken : (broken.broken || []);
            if (items.length === 0) {
                lines.push('   \u2705 0 scripts rotos');
            } else {
                lines.push(`   \u26A0\uFE0F ${items.length} script(s) roto(s):`);
                items.slice(0, 5).forEach(item => {
                    const name = typeof item === 'string' ? item : (item.script || item.name || JSON.stringify(item));
                    lines.push(`   - ${name}`);
                });
                if (items.length > 5) {
                    lines.push(`   ... y ${items.length - 5} m\u00e1s`);
                }
            }
        } else {
            lines.push('   \u26AA governance/broken-scripts.json no existe a\u00FAn');
        }
    } catch (e) {}

    try {
        const { existsSync, readFileSync } = require('fs');
        const evPath = require('path').resolve(__dirname, '../governance/evidence-health.json');
        lines.push('');
        lines.push('🛡️  Evidence Health');
        if (existsSync(evPath)) {
            const ev = JSON.parse(readFileSync(evPath, 'utf8'));
            const c = ev.counts;
            lines.push(`   - missing_refs: ${c.missing_refs}`);
            lines.push(`   - missing_expected_file: ${c.missing_expected_file}`);
            lines.push(`   - noncanonical_ref: ${c.noncanonical_ref}`);
            const recon = c.reconstructed_evidence;
            const reconStatus = recon > 25 ? '🔴 ERROR' : recon > 10 ? '🟡 WARNING' : '🟢 OK';
            lines.push(`   - reconstructed_evidence: ${recon} (${reconStatus})`);
        } else {
            lines.push('   ⚪ governance/evidence-health.json no existe aún');
        }
    } catch (e) {}

    lines.push('');
    lines.push('🎯 Sentry section');
    const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN || '';
    const sentryOrg = process.env.SENTRY_ORG || '';
    
    if (sentryAuthToken && sentryOrg) {
        lines.push('   sentry.configured: true');
        lines.push(`   sentry.configured: true, sin missing_env en Sentry section`);
    } else {
        const missing = [];
        if (!sentryAuthToken) missing.push('SENTRY_AUTH_TOKEN');
        if (!sentryOrg) missing.push('SENTRY_ORG');
        lines.push(`   sentry.configured: false`);
        lines.push(`   sentry.missing_env: ${missing.join(', ')}`);
        lines.push(`   ⚠️  Configura las secrets en CI: ${missing.join(', ')}`);
    }
    
    lines.push('');
    return lines.join('\n');
}

function main() {
    const asJson = process.argv.includes('--json');
    const fixRequested = process.argv.includes('--fix');
    const report = runAudit();

    if (asJson) {
        console.log(
            JSON.stringify(
                {
                    ...report,
                    fix_supported: false,
                    note: fixRequested
                        ? '--fix no aplica en este wrapper; corrige el paso fallido manualmente.'
                        : '',
                },
                null,
                2
            )
        );
    } else {
        if (fixRequested) {
            console.log(
                '⚠️  --fix no aplica en este wrapper; corrige el paso fallido manualmente.'
            );
        }
        console.log(formatAuditText(report));
    }

    return report.ok ? 0 : 1;
}

if (require.main === module) {
    process.exit(main());
}

module.exports = {
    AUDIT_STEPS,
    compactOutput,
    formatAuditText,
    formatCommand,
    main,
    runAudit,
    runAuditStep,
};
