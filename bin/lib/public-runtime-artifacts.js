'use strict';

const { existsSync, readFileSync, readdirSync } = require('node:fs');
const { dirname, relative, resolve } = require('node:path');

const MERGE_CONFLICT_MARKER_PATTERN = /^(<{7,}.*|={7,}|>{7,}.*)$/m;
const LEGACY_ROOT_RUNTIME_FILE_PATTERN = /(^|\/)[^/]+-engine\.js$/;
const LEGACY_ROOT_RUNTIME_FILES = new Set(['utils.js']);

function parseModuleSpecifiers(source) {
    const specifiers = [];
    const patterns = [
        /\bimport\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g,
        /\bfrom\s*(['"`])([^'"`]+)\1/g,
        /\bimport\s*(['"`])([^'"`]+)\1/g,
    ];

    for (const pattern of patterns) {
        let match = pattern.exec(source);
        while (match) {
            const value = String(match[2] || '').trim();
            if (value) {
                specifiers.push(value);
            }
            match = pattern.exec(source);
        }
    }

    return specifiers;
}

function toChunkFilename(specifier, options = {}) {
    const cleanValue = String(specifier || '')
        .split('?')[0]
        .split('#')[0];
    if (!cleanValue) return '';
    const chunkDirectorySegment = String(
        options.chunkDirectorySegment || 'js/chunks'
    )
        .trim()
        .replace(/\\/g, '/')
        .replace(/^\.\//, '')
        .replace(/^\/+/, '');

    if (
        chunkDirectorySegment &&
        cleanValue.includes(`${chunkDirectorySegment}/`)
    ) {
        return cleanValue.slice(cleanValue.lastIndexOf('/') + 1);
    }

    if (cleanValue.startsWith('./') && !cleanValue.slice(2).includes('/')) {
        return cleanValue.slice(2);
    }

    return '';
}

function collectReferencedEngineFiles(source) {
    const referenced = new Set();
    const matches = String(source || '').matchAll(
        /['"`](?:\/|\.\/)?js\/engines\/([^'"`?#]+\.js)(?:\?[^'"`]*)?['"`]/g
    );

    for (const match of matches) {
        const filename = String(match[1] || '').trim();
        if (filename) {
            referenced.add(filename);
        }
    }

    return Array.from(referenced).sort();
}

function toRepoRelativePath(rootPath, filePath) {
    return relative(rootPath, filePath).replace(/\\/g, '/');
}

function findFirstMergeConflictMarker(filePath, rootPath) {
    if (!existsSync(filePath)) {
        return null;
    }

    const source = readFileSync(filePath, 'utf8');
    const match = source.match(MERGE_CONFLICT_MARKER_PATTERN);
    if (!match || typeof match.index !== 'number') {
        return null;
    }

    const linesBeforeMatch = source.slice(0, match.index).split(/\r?\n/).length;

    return {
        filePath: toRepoRelativePath(rootPath, filePath),
        lineNumber: linesBeforeMatch,
        marker: String(match[0] || '').trim(),
    };
}

function collectReachablePublicChunks({ entryPath, chunksDir }) {
    const reachable = new Set();
    const pendingFiles = [entryPath];
    const visited = new Set();
    const chunkDirectorySegment = relative(dirname(entryPath), chunksDir)
        .replace(/\\/g, '/')
        .replace(/^\.\//, '')
        .replace(/^\/+/, '')
        .replace(/\/+$/g, '');

    while (pendingFiles.length > 0) {
        const current = pendingFiles.shift();
        if (!current || visited.has(current) || !existsSync(current)) {
            continue;
        }

        visited.add(current);

        const source = readFileSync(current, 'utf8');
        const specifiers = parseModuleSpecifiers(source);

        for (const specifier of specifiers) {
            const chunkFilename = toChunkFilename(specifier, {
                chunkDirectorySegment,
            });
            if (!chunkFilename || !chunkFilename.endsWith('.js')) {
                continue;
            }

            reachable.add(chunkFilename);

            const nextChunkPath = resolve(chunksDir, chunkFilename);
            if (existsSync(nextChunkPath) && !visited.has(nextChunkPath)) {
                pendingFiles.push(nextChunkPath);
            }
        }
    }

    return reachable;
}

function readTextFileIfExists(filePath) {
    return existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
}

function inspectPublishedAdminArtifacts(options = {}) {
    const sourceRootPath = options.sourceRoot
        ? resolve(options.sourceRoot)
        : resolve(__dirname, '..', '..', '.generated', 'site-root');
    const publishedRootPath = options.publishedRoot
        ? resolve(options.publishedRoot)
        : sourceRootPath;
    const sourceEntryPath = resolve(sourceRootPath, 'admin.js');
    const sourceChunksDir = resolve(sourceRootPath, 'js', 'admin-chunks');
    const publishedEntryPath = resolve(publishedRootPath, 'admin.js');
    const publishedChunksDir = resolve(publishedRootPath, 'js', 'admin-chunks');
    const sameRoots = sourceRootPath === publishedRootPath;
    const sourceEntryExists = existsSync(sourceEntryPath);
    const sourceChunksDirExists = existsSync(sourceChunksDir);
    const publishedEntryExists = existsSync(publishedEntryPath);
    const publishedChunksDirExists = existsSync(publishedChunksDir);
    const sourceAllChunks = sourceChunksDirExists
        ? readdirSync(sourceChunksDir)
              .filter((entry) => entry.endsWith('.js'))
              .sort()
        : [];
    const publishedAllChunks = publishedChunksDirExists
        ? readdirSync(publishedChunksDir)
              .filter((entry) => entry.endsWith('.js'))
              .sort()
        : [];
    const sourceReachableChunks =
        sourceEntryExists && sourceChunksDirExists
            ? Array.from(
                  collectReachablePublicChunks({
                      entryPath: sourceEntryPath,
                      chunksDir: sourceChunksDir,
                  })
              ).sort()
            : [];
    const publishedReachableChunks =
        publishedEntryExists && publishedChunksDirExists
            ? Array.from(
                  collectReachablePublicChunks({
                      entryPath: publishedEntryPath,
                      chunksDir: publishedChunksDir,
                  })
              ).sort()
            : [];
    const sourceMissingReferencedChunks = sourceReachableChunks.filter(
        (chunkFilename) => !sourceAllChunks.includes(chunkFilename)
    );
    const publishedMissingReferencedChunks = publishedReachableChunks.filter(
        (chunkFilename) => !publishedAllChunks.includes(chunkFilename)
    );
    const expectedActiveGraph = [
        ...(sourceEntryExists ? ['admin.js'] : []),
        ...sourceReachableChunks.map(
            (chunkFilename) => `js/admin-chunks/${chunkFilename}`
        ),
    ];
    const publishedActiveGraph = [
        ...(publishedEntryExists ? ['admin.js'] : []),
        ...publishedReachableChunks.map(
            (chunkFilename) => `js/admin-chunks/${chunkFilename}`
        ),
    ];
    const missingPublishedActivePaths = expectedActiveGraph.filter(
        (relativePath) => !publishedActiveGraph.includes(relativePath)
    );
    const extraPublishedActivePaths = publishedActiveGraph.filter(
        (relativePath) => !expectedActiveGraph.includes(relativePath)
    );
    const chunkContentDrift = sourceReachableChunks
        .filter((chunkFilename) => publishedAllChunks.includes(chunkFilename))
        .filter((chunkFilename) => {
            const sourceChunkPath = resolve(sourceChunksDir, chunkFilename);
            const publishedChunkPath = resolve(publishedChunksDir, chunkFilename);
            return (
                readTextFileIfExists(sourceChunkPath) !==
                readTextFileIfExists(publishedChunkPath)
            );
        })
        .map((chunkFilename) => `js/admin-chunks/${chunkFilename}`);
    const diagnostics = [];

    if (!sourceEntryExists) {
        diagnostics.push({
            code: 'admin_source_missing_entry',
            message: `${toRepoRelativePath(sourceRootPath, sourceEntryPath)} no existe.`,
        });
    }

    if (!sourceChunksDirExists) {
        diagnostics.push({
            code: 'admin_source_missing_chunks_dir',
            message: `${toRepoRelativePath(sourceRootPath, sourceChunksDir)} no existe.`,
        });
    }

    if (sourceEntryExists && sourceChunksDirExists && sourceReachableChunks.length === 0) {
        diagnostics.push({
            code: 'admin_source_no_reachable_chunks',
            message: `${toRepoRelativePath(sourceRootPath, sourceEntryPath)} no referencia chunks admin alcanzables.`,
        });
    }

    if (sourceMissingReferencedChunks.length > 0) {
        diagnostics.push({
            code: 'admin_source_missing_referenced_chunks',
            message: `${toRepoRelativePath(sourceRootPath, sourceEntryPath)} referencia ${sourceMissingReferencedChunks.length} chunk(s) admin inexistentes en staged root.`,
            chunks: sourceMissingReferencedChunks,
        });
    }

    if (!publishedEntryExists) {
        diagnostics.push({
            code: 'published_admin_missing_entry',
            message: `${toRepoRelativePath(publishedRootPath, publishedEntryPath)} no existe.`,
        });
    }

    if (!publishedChunksDirExists) {
        diagnostics.push({
            code: 'published_admin_missing_chunks_dir',
            message: `${toRepoRelativePath(publishedRootPath, publishedChunksDir)} no existe.`,
        });
    }

    if (
        publishedEntryExists &&
        publishedChunksDirExists &&
        publishedReachableChunks.length === 0
    ) {
        diagnostics.push({
            code: 'published_admin_no_reachable_chunks',
            message: `${toRepoRelativePath(publishedRootPath, publishedEntryPath)} no referencia chunks admin alcanzables.`,
        });
    }

    if (publishedMissingReferencedChunks.length > 0) {
        diagnostics.push({
            code: 'published_admin_missing_referenced_chunks',
            message: `${toRepoRelativePath(publishedRootPath, publishedEntryPath)} referencia ${publishedMissingReferencedChunks.length} chunk(s) admin inexistentes en repo root.`,
            chunks: publishedMissingReferencedChunks,
        });
    }

    if (
        !sameRoots &&
        sourceEntryExists &&
        publishedEntryExists &&
        readTextFileIfExists(sourceEntryPath) !==
            readTextFileIfExists(publishedEntryPath)
    ) {
        diagnostics.push({
            code: 'published_admin_entry_drift',
            message: 'admin.js publicado en repo root no coincide con .generated/site-root/admin.js.',
            expectedPath: toRepoRelativePath(sourceRootPath, sourceEntryPath),
            publishedPath: toRepoRelativePath(
                publishedRootPath,
                publishedEntryPath
            ),
        });
    }

    if (
        !sameRoots &&
        (missingPublishedActivePaths.length > 0 ||
            extraPublishedActivePaths.length > 0)
    ) {
        diagnostics.push({
            code: 'published_admin_graph_drift',
            message: 'El grafo activo de admin publicado en repo root no coincide con el staged root.',
            missingPublishedActivePaths,
            extraPublishedActivePaths,
            expectedActiveGraph,
            publishedActiveGraph,
        });
    }

    if (!sameRoots && chunkContentDrift.length > 0) {
        diagnostics.push({
            code: 'published_admin_content_drift',
            message: 'Hay chunks admin activos con contenido distinto entre staged root y repo root.',
            files: chunkContentDrift,
        });
    }

    return {
        sourceRootPath,
        publishedRootPath,
        sameRoots,
        sourceEntryExists,
        sourceChunksDirExists,
        publishedEntryExists,
        publishedChunksDirExists,
        sourceAllChunks,
        publishedAllChunks,
        sourceReachableChunks,
        publishedReachableChunks,
        sourceMissingReferencedChunks,
        publishedMissingReferencedChunks,
        expectedActiveGraph,
        publishedActiveGraph,
        missingPublishedActivePaths,
        extraPublishedActivePaths,
        chunkContentDrift,
        diagnostics,
        passed: diagnostics.length === 0,
    };
}

function inspectPublicRuntimeArtifacts(options = {}) {
    const rootPath = options.root
        ? resolve(options.root)
        : resolve(__dirname, '..', '..');
    const supportRootPath = options.supportRoot
        ? resolve(options.supportRoot)
        : rootPath;
    const entryPath = resolve(rootPath, options.entryPath || 'script.js');
    const chunksDir = resolve(rootPath, options.chunksDir || 'js/chunks');
    const enginesDir = resolve(rootPath, options.enginesDir || 'js/engines');
    const entryRelativePath = toRepoRelativePath(rootPath, entryPath);
    const chunksDirRelativePath = toRepoRelativePath(rootPath, chunksDir);
    const enginesDirRelativePath = toRepoRelativePath(rootPath, enginesDir);
    const entryExists = existsSync(entryPath);
    const chunksDirExists = existsSync(chunksDir);
    const enginesDirExists = existsSync(enginesDir);
    const rootJsFiles = readdirSync(rootPath)
        .filter((entry) => entry.endsWith('.js'))
        .sort();
    const legacyRootRuntimeArtifactsPresent = rootJsFiles.filter(
        (entry) =>
            LEGACY_ROOT_RUNTIME_FILE_PATTERN.test(entry) ||
            LEGACY_ROOT_RUNTIME_FILES.has(entry)
    );
    const allChunks = chunksDirExists
        ? readdirSync(chunksDir)
              .filter((entry) => entry.endsWith('.js'))
              .sort()
        : [];
    const engineFilesOnDisk = enginesDirExists
        ? readdirSync(enginesDir)
              .filter((entry) => entry.endsWith('.js'))
              .sort()
        : [];
    const supportAssets = [
        'styles.css',
        'styles-deferred.css',
    ].map((relativePath) => ({
        relativePath,
        exists: existsSync(resolve(supportRootPath, relativePath)),
        resolvedPath: toRepoRelativePath(
            resolve(supportRootPath, relativePath),
            supportRootPath
        ),
    }));
    const missingSupportAssets = supportAssets
        .filter((entry) => !entry.exists)
        .map((entry) => entry.relativePath);
    const entrySource = entryExists ? readFileSync(entryPath, 'utf8') : '';
    const reachableChunks =
        entryExists && chunksDirExists
            ? Array.from(
                  collectReachablePublicChunks({
                      entryPath,
                      chunksDir,
                  })
              ).sort()
            : [];
    const referencedEngineFiles = entryExists
        ? collectReferencedEngineFiles(entrySource)
        : [];
    const missingReferencedEngineFiles = referencedEngineFiles.filter(
        (engineFilename) => !engineFilesOnDisk.includes(engineFilename)
    );
    const staleChunks = allChunks.filter(
        (chunkFilename) => !reachableChunks.includes(chunkFilename)
    );
    const missingReferencedChunks = reachableChunks.filter(
        (chunkFilename) => !allChunks.includes(chunkFilename)
    );
    const activeShellChunks = reachableChunks.filter((chunkFilename) =>
        chunkFilename.startsWith('shell-')
    );
    const activeAssetPaths = [
        ...(entryExists ? [entryPath] : []),
        ...reachableChunks.map((chunkFilename) =>
            resolve(chunksDir, chunkFilename)
        ),
    ];
    const mergeConflictFindings = activeAssetPaths
        .map((filePath) => findFirstMergeConflictMarker(filePath, rootPath))
        .filter(Boolean);
    const diagnostics = [];

    if (!entryExists) {
        diagnostics.push({
            code: 'missing_entry',
            message: `${entryRelativePath} no existe.`,
        });
    }

    if (!chunksDirExists) {
        diagnostics.push({
            code: 'missing_chunks_dir',
            message: `${chunksDirRelativePath} no existe.`,
        });
    }

    if (!enginesDirExists) {
        diagnostics.push({
            code: 'missing_engines_dir',
            message: `${enginesDirRelativePath} no existe.`,
        });
    }

    if (chunksDirExists && allChunks.length === 0) {
        diagnostics.push({
            code: 'no_chunks_on_disk',
            message: `${chunksDirRelativePath} no contiene archivos .js.`,
        });
    }

    if (enginesDirExists && engineFilesOnDisk.length === 0) {
        diagnostics.push({
            code: 'no_engines_on_disk',
            message: `${enginesDirRelativePath} no contiene archivos .js.`,
        });
    }

    if (missingSupportAssets.length > 0) {
        diagnostics.push({
            code: 'missing_support_assets',
            message: `Faltan assets de soporte del gateway publico: ${missingSupportAssets.join(', ')}.`,
            assets: missingSupportAssets,
        });
    }

    if (legacyRootRuntimeArtifactsPresent.length > 0) {
        diagnostics.push({
            code: 'legacy_root_runtime_artifacts_present',
            message: `La raiz contiene runtime legacy fuera de la politica canonica: ${legacyRootRuntimeArtifactsPresent.join(', ')}.`,
            files: legacyRootRuntimeArtifactsPresent,
        });
    }

    if (entryExists && chunksDirExists && reachableChunks.length === 0) {
        diagnostics.push({
            code: 'no_reachable_chunks',
            message: `${entryRelativePath} no referencia chunks alcanzables en ${chunksDirRelativePath}.`,
        });
    }

    if (missingReferencedChunks.length > 0) {
        diagnostics.push({
            code: 'missing_referenced_chunks',
            message: `${entryRelativePath} referencia ${missingReferencedChunks.length} chunk(s) que no existen en ${chunksDirRelativePath}.`,
            chunks: missingReferencedChunks,
        });
    }

    if (missingReferencedEngineFiles.length > 0) {
        diagnostics.push({
            code: 'missing_referenced_engine_files',
            message: `${entryRelativePath} referencia ${missingReferencedEngineFiles.length} engine(s) que no existen en ${enginesDirRelativePath}.`,
            engines: missingReferencedEngineFiles,
        });
    }

    if (staleChunks.length > 0) {
        diagnostics.push({
            code: 'stale_chunks_detected',
            message: `${chunksDirRelativePath} contiene ${staleChunks.length} chunk(s) huerfano(s).`,
            chunks: staleChunks,
        });
    }

    if (activeShellChunks.length !== 1) {
        diagnostics.push({
            code: 'active_shell_count_mismatch',
            message: `${entryRelativePath} debe dejar exactamente un shell activo y hoy tiene ${activeShellChunks.length}.`,
            chunks: activeShellChunks,
        });
    }

    if (mergeConflictFindings.length > 0) {
        diagnostics.push({
            code: 'merge_conflicts_detected',
            message: 'Se detectaron marcadores de merge en assets publicos activos.',
            findings: mergeConflictFindings,
        });
    }

    return {
        rootPath,
        supportRootPath,
        entryPath,
        entryRelativePath,
        entryExists,
        chunksDir,
        chunksDirRelativePath,
        chunksDirExists,
        enginesDir,
        enginesDirRelativePath,
        enginesDirExists,
        rootJsFiles,
        legacyRootRuntimeArtifactsPresent,
        supportAssets,
        missingSupportAssets,
        chunkFilesCount: allChunks.length,
        reachableChunkCount: reachableChunks.length,
        engineFilesCount: engineFilesOnDisk.length,
        engineFilesOnDisk,
        referencedEngineFiles,
        missingReferencedEngineFiles,
        allChunks,
        reachableChunks,
        staleChunks,
        missingReferencedChunks,
        activeShellChunks,
        mergeConflictFindings,
        diagnostics,
        passed: diagnostics.length === 0,
    };
}

module.exports = {
    MERGE_CONFLICT_MARKER_PATTERN,
    collectReachablePublicChunks,
    collectReferencedEngineFiles,
    inspectPublishedAdminArtifacts,
    inspectPublicRuntimeArtifacts,
    parseModuleSpecifiers,
    toChunkFilename,
    toRepoRelativePath,
};
