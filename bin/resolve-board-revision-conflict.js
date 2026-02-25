#!/usr/bin/env node
'use strict';

const { existsSync, readFileSync, writeFileSync } = require('fs');
const { resolve } = require('path');

const DEFAULT_BOARD_PATH = resolve(__dirname, '..', 'AGENT_BOARD.yaml');

function parseArgs(argv = []) {
    let file = DEFAULT_BOARD_PATH;
    let json = false;
    let checkOnly = false;

    for (let i = 0; i < argv.length; i += 1) {
        const arg = String(argv[i] || '').trim();
        if (arg === '--json') {
            json = true;
            continue;
        }
        if (arg === '--check') {
            checkOnly = true;
            continue;
        }
        if (arg === '--file') {
            const next = String(argv[i + 1] || '').trim();
            if (!next) {
                throw new Error('--file requiere una ruta');
            }
            file = resolve(process.cwd(), next);
            i += 1;
        }
    }

    return { file, json, checkOnly };
}

function parseRevisionLine(segment) {
    const lines = String(segment || '')
        .split('\n')
        .map((line) => line.replace(/\r$/, ''))
        .filter((line) => line.trim() !== '');

    if (lines.length !== 1) return null;
    const match = lines[0].match(/^(\s*)revision:\s*(\d+)\s*$/);
    if (!match) return null;
    return {
        indent: match[1] || '',
        revision: Number(match[2]),
    };
}

function resolveRevisionConflicts(raw) {
    const input = String(raw || '');
    const conflictPattern =
        /^<<<<<<<[^\n]*\n([\s\S]*?)^=======\n([\s\S]*?)^>>>>>>>[^\n]*\n?/gm;
    let resolved = input;
    let replaced = 0;
    let remaining = 0;
    const diagnostics = [];

    resolved = resolved.replace(
        conflictPattern,
        (fullMatch, left, right, offset) => {
            const leftRevision = parseRevisionLine(left);
            const rightRevision = parseRevisionLine(right);
            if (!leftRevision || !rightRevision) {
                remaining += 1;
                diagnostics.push({
                    kind: 'non_revision_conflict',
                    offset,
                });
                return fullMatch;
            }

            replaced += 1;
            const revision = Math.max(
                leftRevision.revision,
                rightRevision.revision
            );
            const indent = leftRevision.indent || rightRevision.indent || '  ';
            diagnostics.push({
                kind: 'revision_conflict_resolved',
                offset,
                left_revision: leftRevision.revision,
                right_revision: rightRevision.revision,
                resolved_revision: revision,
            });
            return `${indent}revision: ${revision}\n`;
        }
    );

    const hasConflictMarkers =
        resolved.includes('<<<<<<<') ||
        resolved.includes('=======') ||
        resolved.includes('>>>>>>>');
    const hasUnresolvedMarkers = hasConflictMarkers && remaining > 0;

    return {
        replaced,
        remaining,
        diagnostics,
        hasUnresolvedMarkers,
        changed: replaced > 0 && resolved !== input,
        resolvedContent: resolved,
    };
}

function print(payload, asJson) {
    if (asJson) {
        console.log(JSON.stringify(payload, null, 2));
        return;
    }

    const status = payload.ok ? 'OK' : 'FAIL';
    console.log(
        `${status}: replaced=${payload.replaced}, remaining=${payload.remaining}, file=${payload.file}`
    );
    if (payload.diagnostics.length > 0) {
        for (const item of payload.diagnostics) {
            if (item.kind === 'revision_conflict_resolved') {
                console.log(
                    `- resolved revision conflict at ${item.offset}: ${item.left_revision} vs ${item.right_revision} -> ${item.resolved_revision}`
                );
            } else {
                console.log(
                    `- unresolved non-revision conflict at ${item.offset}`
                );
            }
        }
    }
}

function run(argv = process.argv.slice(2)) {
    const opts = parseArgs(argv);
    if (!existsSync(opts.file)) {
        const payload = {
            version: 1,
            ok: false,
            error_code: 'board_not_found',
            error: `No existe archivo: ${opts.file}`,
            file: opts.file,
        };
        print(payload, opts.json);
        return 1;
    }

    const raw = readFileSync(opts.file, 'utf8');
    const result = resolveRevisionConflicts(raw);

    if (!opts.checkOnly && result.changed && !result.hasUnresolvedMarkers) {
        writeFileSync(opts.file, result.resolvedContent, 'utf8');
    }

    const payload = {
        version: 1,
        ok: result.remaining === 0,
        file: opts.file,
        mode: opts.checkOnly ? 'check' : 'write',
        replaced: result.replaced,
        remaining: result.remaining,
        changed: result.changed,
        diagnostics: result.diagnostics,
        error_code:
            result.remaining > 0 ? 'non_revision_conflict_detected' : '',
    };

    print(payload, opts.json);
    return payload.ok ? 0 : 2;
}

if (require.main === module) {
    process.exit(run());
}

module.exports = {
    parseArgs,
    parseRevisionLine,
    resolveRevisionConflicts,
    run,
};
