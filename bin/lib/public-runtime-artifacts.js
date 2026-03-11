'use strict';

const { existsSync, readFileSync, readdirSync } = require('node:fs');
const { relative, resolve } = require('node:path');

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

function toChunkFilename(specifier) {
    const cleanValue = String(specifier || '')
        .split('?')[0]
        .split('#')[0];
    if (!cleanValue) return '';

    if (cleanValue.includes('js/chunks/')) {
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

    while (pendingFiles.length > 0) {
        const current = pendingFiles.shift();
        if (!current || visited.has(current) || !existsSync(current)) {
            continue;
        }

        visited.add(current);

        const source = readFileSync(current, 'utf8');
        const specifiers = parseModuleSpecifiers(source);

        for (const specifier of specifiers) {
            const chunkFilename = toChunkFilename(specifier);
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

function inspectPublicRuntimeArtifacts(options = {}) {
    const rootPath = options.root
        ? resolve(options.root)
        : resolve(__dirname, '..', '..');
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
        exists: existsSync(resolve(rootPath, relativePath)),
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
    inspectPublicRuntimeArtifacts,
    parseModuleSpecifiers,
    toChunkFilename,
    toRepoRelativePath,
};
