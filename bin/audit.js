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
    const steps = AUDIT_STEPS.map((step) => runAuditStep(step, runner));
    const ok = steps.every((step) => step.ok);

    return {
        ok,
        stepCount: steps.length,
        passedCount: steps.filter((step) => step.ok).length,
        failedCount: steps.filter((step) => !step.ok).length,
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
