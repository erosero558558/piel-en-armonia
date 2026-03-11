#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
    inspectPublicRuntimeArtifacts,
} = require('./lib/public-runtime-artifacts.js');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUTPUT = path.join(
    ROOT,
    'verification',
    'public-v6-canonical',
    'runtime-artifacts-report.json'
);

function parseArgs(argv) {
    const args = {
        root: ROOT,
        output: DEFAULT_OUTPUT,
        json: false,
        quiet: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const token = String(argv[index] || '').trim();
        if (!token) continue;

        if (token === '--root') {
            const nextValue = String(argv[index + 1] || '').trim();
            if (nextValue) {
                args.root = path.resolve(ROOT, nextValue);
                index += 1;
            }
            continue;
        }

        if (token.startsWith('--root=')) {
            args.root = path.resolve(ROOT, token.slice('--root='.length).trim());
            continue;
        }

        if (token === '--output') {
            const nextValue = String(argv[index + 1] || '').trim();
            if (nextValue) {
                args.output = path.resolve(ROOT, nextValue);
                index += 1;
            }
            continue;
        }

        if (token.startsWith('--output=')) {
            args.output = path.resolve(
                ROOT,
                token.slice('--output='.length).trim()
            );
            continue;
        }

        if (token === '--json') {
            args.json = true;
            continue;
        }

        if (token === '--quiet') {
            args.quiet = true;
        }
    }

    return args;
}

function writeReport(outputPath, report) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const inspection = inspectPublicRuntimeArtifacts({ root: args.root });
    const report = {
        generatedAt: new Date().toISOString(),
        reportPath: args.output,
        passed: inspection.passed,
        rootPath: inspection.rootPath,
        entryPath: inspection.entryRelativePath,
        chunksDir: inspection.chunksDirRelativePath,
        enginesDir: inspection.enginesDirRelativePath,
        rootJsFiles: inspection.rootJsFiles,
        legacyRootRuntimeArtifactsPresent:
            inspection.legacyRootRuntimeArtifactsPresent,
        chunkFilesCount: inspection.chunkFilesCount,
        reachableChunkCount: inspection.reachableChunkCount,
        engineFilesCount: inspection.engineFilesCount,
        engineFilesOnDisk: inspection.engineFilesOnDisk,
        referencedEngineFiles: inspection.referencedEngineFiles,
        missingReferencedEngineFiles: inspection.missingReferencedEngineFiles,
        supportAssets: inspection.supportAssets,
        missingSupportAssets: inspection.missingSupportAssets,
        activeShellChunks: inspection.activeShellChunks,
        allChunks: inspection.allChunks,
        reachableChunks: inspection.reachableChunks,
        staleChunks: inspection.staleChunks,
        missingReferencedChunks: inspection.missingReferencedChunks,
        mergeConflictFindings: inspection.mergeConflictFindings,
        diagnostics: inspection.diagnostics,
    };

    writeReport(args.output, report);

    if (args.json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else if (!args.quiet) {
        if (report.passed) {
            const shellSummary =
                report.activeShellChunks[0] || 'sin shell activo';
            process.stdout.write(
                `[public-runtime] OK: ${report.reachableChunkCount} chunk(s) alcanzables, shell activo ${shellSummary}. Report: ${path.relative(
                    ROOT,
                    args.output
                )}\n`
            );
        } else {
            const codes = report.diagnostics.map((entry) => entry.code).join(', ');
            process.stderr.write(
                `[public-runtime] Hallazgos en runtime publico generado (${codes}). Report: ${path.relative(
                    ROOT,
                    args.output
                )}\n`
            );
        }
    }

    if (!report.passed) {
        process.exitCode = 1;
    }
}

main();
