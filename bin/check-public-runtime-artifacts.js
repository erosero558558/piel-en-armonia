#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
    GENERATED_SITE_ROOT,
    REPO_ROOT,
} = require('./lib/generated-site-root.js');
const {
    inspectPublishedAdminArtifacts,
    inspectPublicRuntimeArtifacts,
} = require('./lib/public-runtime-artifacts.js');

const ROOT = REPO_ROOT;
const DEFAULT_OUTPUT = path.join(
    ROOT,
    'verification',
    'public-v6-canonical',
    'runtime-artifacts-report.json'
);

function parseArgs(argv) {
    const args = {
        root: GENERATED_SITE_ROOT,
        publishedRoot: ROOT,
        supportRoot: '',
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

        if (token === '--support-root') {
            const nextValue = String(argv[index + 1] || '').trim();
            if (nextValue) {
                args.supportRoot = path.resolve(ROOT, nextValue);
                index += 1;
            }
            continue;
        }

        if (token.startsWith('--support-root=')) {
            args.supportRoot = path.resolve(
                ROOT,
                token.slice('--support-root='.length).trim()
            );
            continue;
        }

        if (token === '--published-root') {
            const nextValue = String(argv[index + 1] || '').trim();
            if (nextValue) {
                args.publishedRoot = path.resolve(ROOT, nextValue);
                index += 1;
            }
            continue;
        }

        if (token.startsWith('--published-root=')) {
            args.publishedRoot = path.resolve(
                ROOT,
                token.slice('--published-root='.length).trim()
            );
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
    const inspectionRoot = args.root
        ? path.resolve(args.root)
        : GENERATED_SITE_ROOT;
    const supportRoot = args.supportRoot
        ? path.resolve(args.supportRoot)
        : inspectionRoot === GENERATED_SITE_ROOT
          ? ROOT
          : inspectionRoot;
    const publishedRoot = args.publishedRoot
        ? path.resolve(args.publishedRoot)
        : ROOT;
    const inspectionWithSupport = inspectPublicRuntimeArtifacts({
        root: inspectionRoot,
        supportRoot,
    });
    const adminPublishedInspection = inspectPublishedAdminArtifacts({
        sourceRoot: inspectionRoot,
        publishedRoot,
    });
    const combinedDiagnostics = [
        ...inspectionWithSupport.diagnostics,
        ...adminPublishedInspection.diagnostics,
    ];
    const report = {
        generatedAt: new Date().toISOString(),
        reportPath: args.output,
        passed:
            inspectionWithSupport.passed && adminPublishedInspection.passed,
        rootPath: inspectionWithSupport.rootPath,
        supportRootPath: inspectionWithSupport.supportRootPath,
        publishedRootPath: publishedRoot,
        entryPath: inspectionWithSupport.entryRelativePath,
        chunksDir: inspectionWithSupport.chunksDirRelativePath,
        enginesDir: inspectionWithSupport.enginesDirRelativePath,
        rootJsFiles: inspectionWithSupport.rootJsFiles,
        legacyRootRuntimeArtifactsPresent:
            inspectionWithSupport.legacyRootRuntimeArtifactsPresent,
        chunkFilesCount: inspectionWithSupport.chunkFilesCount,
        reachableChunkCount: inspectionWithSupport.reachableChunkCount,
        engineFilesCount: inspectionWithSupport.engineFilesCount,
        engineFilesOnDisk: inspectionWithSupport.engineFilesOnDisk,
        referencedEngineFiles: inspectionWithSupport.referencedEngineFiles,
        missingReferencedEngineFiles:
            inspectionWithSupport.missingReferencedEngineFiles,
        supportAssets: inspectionWithSupport.supportAssets,
        missingSupportAssets: inspectionWithSupport.missingSupportAssets,
        activeShellChunks: inspectionWithSupport.activeShellChunks,
        allChunks: inspectionWithSupport.allChunks,
        reachableChunks: inspectionWithSupport.reachableChunks,
        staleChunks: inspectionWithSupport.staleChunks,
        missingReferencedChunks: inspectionWithSupport.missingReferencedChunks,
        mergeConflictFindings: inspectionWithSupport.mergeConflictFindings,
        adminPublished: {
            passed: adminPublishedInspection.passed,
            sameRoots: adminPublishedInspection.sameRoots,
            sourceRootPath: adminPublishedInspection.sourceRootPath,
            publishedRootPath: adminPublishedInspection.publishedRootPath,
            sourceReachableChunks: adminPublishedInspection.sourceReachableChunks,
            publishedReachableChunks:
                adminPublishedInspection.publishedReachableChunks,
            sourceMissingReferencedChunks:
                adminPublishedInspection.sourceMissingReferencedChunks,
            publishedMissingReferencedChunks:
                adminPublishedInspection.publishedMissingReferencedChunks,
            expectedActiveGraph: adminPublishedInspection.expectedActiveGraph,
            publishedActiveGraph: adminPublishedInspection.publishedActiveGraph,
            missingPublishedActivePaths:
                adminPublishedInspection.missingPublishedActivePaths,
            extraPublishedActivePaths:
                adminPublishedInspection.extraPublishedActivePaths,
            chunkContentDrift: adminPublishedInspection.chunkContentDrift,
            diagnostics: adminPublishedInspection.diagnostics,
        },
        diagnostics: combinedDiagnostics,
    };

    writeReport(args.output, report);

    if (args.json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else if (!args.quiet) {
        if (report.passed) {
            const shellSummary =
                report.activeShellChunks[0] || 'sin shell activo';
            process.stdout.write(
                `[public-runtime] OK: ${report.reachableChunkCount} chunk(s) alcanzables, shell activo ${shellSummary}, admin publish parity OK. Report: ${path.relative(
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
