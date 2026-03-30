#!/usr/bin/env node
'use strict';

const { execFileSync } = require('node:child_process');
const { existsSync, readFileSync, statSync } = require('node:fs');
const { resolve } = require('node:path');

const ROOT = process.env.AURORA_DERM_ROOT
    ? resolve(process.env.AURORA_DERM_ROOT)
    : resolve(__dirname, '..');
const AGENTS_FILE = resolve(ROOT, 'AGENTS.md');
const DEFAULT_DEPTH = 5;
const JSON_MODE = process.argv.includes('--json');
const DEPTH_ARG = process.argv.find((arg) => arg.startsWith('--depth='));
const TASK_ID_RE = /(?:S\d+|UI\d*)-[A-Z0-9]+/;
const EXPLICIT_FILE_RE = /[`'"]([A-Za-z0-9][A-Za-z0-9_./-]*\.[A-Za-z0-9]{2,10})[`'"]/g;

function read(filePath) {
    return existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
}

function runGit(args) {
    try {
        return execFileSync('git', args, {
            cwd: ROOT,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            maxBuffer: 1024 * 1024 * 8,
        }).trim();
    } catch (error) {
        return typeof error.stdout === 'string' ? error.stdout.trim() : '';
    }
}

function normalizePathCandidate(candidate) {
    const value = String(candidate || '').trim();
    if (!value || value.includes('*') || value.includes('?')) {
        return null;
    }
    if (/^(https?:)?\/\//i.test(value)) {
        return null;
    }

    const normalized = value.replace(/^\.?\//, '');
    if (!normalized.includes('.') || normalized.endsWith('/')) {
        return null;
    }

    return normalized;
}

function extractExplicitFiles(text) {
    const files = new Set();
    const source = String(text || '');

    for (const match of source.matchAll(EXPLICIT_FILE_RE)) {
        const normalized = normalizePathCandidate(match[1]);
        if (normalized) {
            files.add(normalized);
        }
    }

    return Array.from(files);
}

function parseDoneTasks(markdown) {
    return String(markdown || '')
        .split('\n')
        .map((line) => {
            const match = line.match(
                /^- \[x\] \*\*((?:S\d+|UI\d*)-[A-Z0-9]+)\*\*(.*)$/
            );
            if (!match) {
                return null;
            }

            const files = extractExplicitFiles(line);
            return files.length > 0
                ? {
                      id: match[1],
                      line: line.trim(),
                      files,
                  }
                : null;
        })
        .filter(Boolean);
}

function resolveBaseRef(depth = DEFAULT_DEPTH) {
    const parsedDepth = Number.isFinite(Number(depth)) && Number(depth) > 0
        ? Number(depth)
        : DEFAULT_DEPTH;
    const candidate = `HEAD~${parsedDepth}`;
    const resolved = runGit(['rev-parse', '--verify', candidate]);
    if (resolved) {
        return candidate;
    }

    return runGit(['rev-list', '--max-parents=0', 'HEAD']) || 'HEAD';
}

function parseDiffStat(raw) {
    return String(raw || '')
        .split('\n')
        .map((line) => {
            const match = line.match(/^\s*(.+?)\s+\|\s+/);
            if (!match) {
                return null;
            }

            return match[1].trim();
        })
        .filter(Boolean);
}

function parseNameStatus(raw) {
    const entries = new Map();

    String(raw || '')
        .split('\n')
        .filter(Boolean)
        .forEach((line) => {
            const parts = line.split('\t');
            const status = String(parts[0] || '').trim();
            if (!status) {
                return;
            }

            if (status.startsWith('R')) {
                const from = normalizePathCandidate(parts[1]);
                const to = normalizePathCandidate(parts[2]);
                if (from) {
                    entries.set(from, { status: 'R', from, to });
                }
                if (to) {
                    entries.set(to, { status: 'R', from, to });
                }
                return;
            }

            const file = normalizePathCandidate(parts[1]);
            if (file) {
                entries.set(file, { status: status[0], file });
            }
        });

    return entries;
}

function lookupRecentCommit(filePath, baseRef) {
    return (
        runGit([
            'log',
            '--format=%h',
            '--max-count=1',
            `${baseRef}..HEAD`,
            '--',
            filePath,
        ]) || 'unknown'
    );
}

function inspectFileState(filePath) {
    const absolutePath = resolve(ROOT, filePath);
    if (!existsSync(absolutePath)) {
        return {
            exists: false,
            size: 0,
        };
    }

    return {
        exists: true,
        size: statSync(absolutePath).size,
    };
}

function buildFinding({ taskId, file, reason, commit, line, status }) {
    const summary =
        reason === 'deleted'
            ? `${file} mencionado en ${taskId} quedó eliminado en ${commit}.`
            : `${file} mencionado en ${taskId} quedó vacío en ${commit}.`;

    return {
        taskId,
        file,
        reason,
        commit,
        status,
        line,
        summary,
    };
}

function buildRegressionReport({
    agentsMarkdown = read(AGENTS_FILE),
    diffStat = null,
    nameStatus = null,
    depth = DEFAULT_DEPTH,
} = {}) {
    const baseRef = resolveBaseRef(depth);
    const diffStatOutput =
        diffStat !== null
            ? diffStat
            : runGit(['diff', '--stat', '--no-color', baseRef, 'HEAD']);
    const nameStatusOutput =
        nameStatus !== null
            ? nameStatus
            : runGit(['diff', '--name-status', '--no-color', baseRef, 'HEAD']);

    const doneTasks = parseDoneTasks(agentsMarkdown);
    const touchedPaths = new Set(parseDiffStat(diffStatOutput));
    const statusEntries = parseNameStatus(nameStatusOutput);
    const findings = [];
    const touchedReferences = [];

    doneTasks.forEach((task) => {
        task.files.forEach((file) => {
            if (!touchedPaths.has(file) && !statusEntries.has(file)) {
                return;
            }

            const entry = statusEntries.get(file) || { status: 'M', file };
            touchedReferences.push({
                taskId: task.id,
                file,
                status: entry.status,
            });

            if (entry.status === 'R') {
                return;
            }

            const state = inspectFileState(file);
            if (!state.exists) {
                findings.push(
                    buildFinding({
                        taskId: task.id,
                        file,
                        reason: 'deleted',
                        commit: lookupRecentCommit(file, baseRef),
                        line: task.line,
                        status: entry.status,
                    })
                );
                return;
            }

            if (state.size === 0) {
                findings.push(
                    buildFinding({
                        taskId: task.id,
                        file,
                        reason: 'empty',
                        commit: lookupRecentCommit(file, baseRef),
                        line: task.line,
                        status: entry.status,
                    })
                );
            }
        });
    });

    return {
        ok: findings.length === 0,
        depth: Number(depth) || DEFAULT_DEPTH,
        baseRef,
        totals: {
            doneTasks: doneTasks.length,
            explicitFiles: doneTasks.reduce(
                (total, task) => total + task.files.length,
                0
            ),
            touchedPaths: touchedPaths.size,
            touchedReferences: touchedReferences.length,
            findings: findings.length,
        },
        findings,
        touchedReferences,
    };
}

function formatRegressionReport(report) {
    const lines = [
        '🛡️ Aurora Derm — Regression Watch',
        '',
        `Ventana analizada: ${report.baseRef}..HEAD`,
        `Tareas done con archivos explícitos: ${report.totals.doneTasks}`,
        `Cruces recientes: ${report.totals.touchedReferences}`,
        '',
    ];

    if (report.findings.length === 0) {
        lines.push('✅ 0 regresiones detectadas');
        return `${lines.join('\n')}\n`;
    }

    lines.push(`⚠️ Regresiones detectadas: ${report.findings.length}`);
    report.findings.forEach((finding) => {
        lines.push(`- ${finding.summary}`);
    });

    return `${lines.join('\n')}\n`;
}

function main() {
    const depth = DEPTH_ARG ? DEPTH_ARG.split('=')[1] : DEFAULT_DEPTH;
    const report = buildRegressionReport({ depth });

    if (JSON_MODE) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
        process.stdout.write(formatRegressionReport(report));
    }

    return report.ok ? 0 : 1;
}

if (require.main === module) {
    process.exit(main());
}

module.exports = {
    DEFAULT_DEPTH,
    EXPLICIT_FILE_RE,
    buildRegressionReport,
    extractExplicitFiles,
    formatRegressionReport,
    inspectFileState,
    lookupRecentCommit,
    main,
    normalizePathCandidate,
    parseDiffStat,
    parseDoneTasks,
    parseNameStatus,
    resolveBaseRef,
};
