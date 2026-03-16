#!/usr/bin/env node
'use strict';

const path = require('node:path');
const {
    DOCTOR_STATE_CLEAN,
    DOCTOR_STATE_ERROR,
    buildDoctorPayload,
    collectWorkspaceDoctor,
    formatIssueSummary,
    getFirstRemediationStep,
} = require('./lib/workspace-hygiene.js');

function parseArgs(argv) {
    const args = {
        command: 'doctor',
        json: false,
        quiet: false,
        allWorktrees: true,
        currentOnly: false,
        applySafe: false,
        includeEntries: false,
        strict: false,
    };

    const positionals = [];
    for (let index = 0; index < argv.length; index += 1) {
        const token = String(argv[index] || '').trim();
        if (!token) continue;

        if (token === '--json') {
            args.json = true;
            continue;
        }
        if (token === '--quiet') {
            args.quiet = true;
            continue;
        }
        if (token === '--all-worktrees') {
            args.allWorktrees = true;
            args.currentOnly = false;
            continue;
        }
        if (token === '--current-only') {
            args.currentOnly = true;
            args.allWorktrees = false;
            continue;
        }
        if (token === '--apply-safe') {
            args.applySafe = true;
            continue;
        }
        if (token === '--include-entries') {
            args.includeEntries = true;
            continue;
        }
        if (token === '--strict') {
            args.strict = true;
            continue;
        }

        positionals.push(token);
    }

    if (positionals.length > 0) {
        args.command = positionals[0];
    }

    if (args.command === 'status') {
        args.command = 'doctor';
        args.allWorktrees = true;
        args.currentOnly = false;
    }

    if (args.command === 'fix') {
        args.command = 'doctor';
        args.applySafe = true;
        args.currentOnly = true;
        args.allWorktrees = false;
    }

    return args;
}

function buildPayload(args, cwd) {
    const diagnosis = collectWorkspaceDoctor(cwd, {
        allWorktrees: args.allWorktrees,
        currentOnly: args.currentOnly,
        applySafe: args.applySafe,
    });
    return buildDoctorPayload(diagnosis, {
        command: 'workspace-hygiene doctor',
        includeEntries: args.includeEntries,
    });
}

function renderSummary(summary) {
    const issueTotals = formatIssueSummary(
        Object.entries(summary.issue_totals?.byCategory || {}).map(
            ([category, count]) => ({ category, count })
        )
    );
    return [
        `worktrees=${summary.total_worktrees}`,
        `dirty=${summary.dirty_worktrees}`,
        `blocked=${summary.blocked_worktrees}`,
        `fixable=${summary.fixable_worktrees}`,
        `clean=${summary.clean_worktrees}`,
        `error=${summary.error_worktrees}`,
        issueTotals ? `issues=${issueTotals}` : '',
    ]
        .filter(Boolean)
        .join(' ');
}

function renderRow(row) {
    const branch = row.branch || '(unknown)';
    const issues = formatIssueSummary(row.issues || []);
    const firstStep = getFirstRemediationStep(row);
    const parts = [
        path.resolve(row.path),
        `  branch=${branch}`,
        `  overall_state=${row.overall_state}`,
        `  dirty=${row.dirty_total}`,
    ];

    if (issues) {
        parts.push(`  issues=${issues}`);
    }

    if (firstStep) {
        parts.push(`  first_step=${firstStep.id} -> ${firstStep.command}`);
    }

    if (row.error) {
        parts.push(`  error=${row.error}`);
    }

    if (Array.isArray(row.removed) && row.removed.length > 0) {
        parts.push(`  removed=${row.removed.join(', ')}`);
    }

    return parts.join('\n');
}

function shouldFailStrict(payload) {
    return payload.rows.some((row) => row.overall_state !== DOCTOR_STATE_CLEAN);
}

function shouldFailAliasFix(payload) {
    return payload.rows.some((row) => row.overall_state !== DOCTOR_STATE_CLEAN);
}

function main() {
    const argv = process.argv.slice(2);
    const rawArgs = parseArgs(argv);
    const cwd = process.cwd();

    if (rawArgs.command !== 'doctor') {
        throw new Error(
            'Uso: node bin/workspace-hygiene.js <doctor|status|fix> [--all-worktrees|--current-only] [--apply-safe] [--include-entries] [--json] [--strict]'
        );
    }

    const payload = buildPayload(rawArgs, cwd);

    if (rawArgs.json) {
        process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    } else if (!rawArgs.quiet) {
        process.stdout.write(`${renderSummary(payload.summary)}\n`);
        for (const row of payload.rows) {
            process.stdout.write(`${renderRow(row)}\n`);
        }
    }

    const invokedAsFix = argv.some((token) => String(token || '').trim() === 'fix');
    if (invokedAsFix && shouldFailAliasFix(payload)) {
        process.exitCode = 1;
        return;
    }

    if (rawArgs.strict && shouldFailStrict(payload)) {
        process.exitCode = 1;
        return;
    }

    const hasErrorState = payload.rows.some(
        (row) => row.overall_state === DOCTOR_STATE_ERROR
    );
    if (hasErrorState) {
        process.exitCode = 1;
    }
}

if (require.main === module) {
    try {
        main();
    } catch (error) {
        process.stderr.write(
            `${error && error.message ? error.message : 'workspace hygiene failed'}\n`
        );
        process.exit(1);
    }
}

module.exports = {
    buildPayload,
    parseArgs,
    renderRow,
    renderSummary,
    shouldFailAliasFix,
    shouldFailStrict,
};
