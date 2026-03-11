#!/usr/bin/env node
'use strict';

const { unlinkSync } = require('node:fs');
const { resolve } = require('node:path');
const {
    inspectPublicRuntimeArtifacts,
} = require('./lib/public-runtime-artifacts.js');

function parseCliArgs(argv) {
    const options = {
        dryRun: false,
        strict: false,
        quiet: false,
        root: '',
    };

    for (let index = 0; index < argv.length; index += 1) {
        const value = String(argv[index] || '').trim();
        if (!value) continue;

        if (value === '--dry-run') {
            options.dryRun = true;
            continue;
        }
        if (value === '--strict') {
            options.strict = true;
            continue;
        }
        if (value === '--quiet') {
            options.quiet = true;
            continue;
        }
        if (value === '--root') {
            const nextValue = String(argv[index + 1] || '').trim();
            if (nextValue) {
                options.root = nextValue;
                index += 1;
            }
            continue;
        }
        if (value.startsWith('--root=')) {
            options.root = value.slice('--root='.length).trim();
        }
    }

    return options;
}

const cli = parseCliArgs(process.argv.slice(2));
const ROOT = cli.root
    ? resolve(process.cwd(), cli.root)
    : resolve(__dirname, '..');
const dryRun = cli.dryRun;
const strict = cli.strict;
const quiet = cli.quiet;

function log(message) {
    if (!quiet) {
        process.stdout.write(`${message}\n`);
    }
}

function warn(message) {
    process.stderr.write(`${message}\n`);
}

function main() {
    const inspection = inspectPublicRuntimeArtifacts({ root: ROOT });

    if (!inspection.entryExists) {
        warn('[public-chunks] script.js no existe, no se ejecuta limpieza.');
        process.exit(strict ? 1 : 0);
    }

    if (!inspection.chunksDirExists) {
        warn(
            '[public-chunks] js/chunks no existe, no hay archivos por limpiar.'
        );
        process.exit(0);
    }

    if (inspection.chunkFilesCount === 0) {
        log('[public-chunks] No hay chunks para limpiar.');
        process.exit(0);
    }

    if (inspection.reachableChunkCount === 0) {
        warn(
            '[public-chunks] No se detectaron referencias a chunks desde script.js; se omite limpieza por seguridad.'
        );
        process.exit(strict ? 1 : 0);
    }

    if (inspection.missingReferencedChunks.length > 0) {
        warn(
            `[public-chunks] script.js referencia chunks faltantes (${inspection.missingReferencedChunks.join(', ')}); se omite limpieza por seguridad.`
        );
        process.exit(strict ? 1 : 0);
    }

    if (inspection.mergeConflictFindings.length > 0) {
        const locations = inspection.mergeConflictFindings.map(
            (finding) =>
                `${finding.filePath}:${finding.lineNumber} (${finding.marker})`
        );
        warn(
            `[public-chunks] Detectados marcadores de merge en assets publicos activos: ${locations.join(', ')}`
        );
        process.exit(1);
    }

    const staleChunks = inspection.staleChunks;
    if (staleChunks.length === 0) {
        log(
            `[public-chunks] Limpieza OK. Chunks vigentes: ${inspection.reachableChunkCount}.`
        );
        process.exit(0);
    }

    if (dryRun) {
        log(
            `[public-chunks] DRY RUN. Se eliminarian ${staleChunks.length} chunk(s): ${staleChunks.join(', ')}`
        );
        process.exit(0);
    }

    let deleted = 0;
    for (const chunk of staleChunks) {
        const targetPath = resolve(inspection.chunksDir, chunk);
        try {
            unlinkSync(targetPath);
            deleted += 1;
            log(`[public-chunks] Eliminado: ${chunk}`);
        } catch (error) {
            warn(
                `[public-chunks] No se pudo eliminar ${chunk}: ${error.message}`
            );
            if (strict) {
                process.exit(1);
            }
        }
    }

    log(
        `[public-chunks] Limpieza completada. Eliminados ${deleted}, vigentes ${inspection.reachableChunkCount}.`
    );
}

main();
