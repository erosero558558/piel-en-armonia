#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { GENERATED_SITE_ROOT } = require('./lib/generated-site-root.js');

const ROOT = path.resolve(__dirname, '..');
const LEGACY_INDEX_FILE = path.join(ROOT, 'index.html');
const STAGED_INDEX_FILES = [
    path.join(GENERATED_SITE_ROOT, 'es', 'index.html'),
    path.join(GENERATED_SITE_ROOT, 'en', 'index.html'),
];
const LEGACY_HTML_SYNC_FILES = [
    path.join(ROOT, 'telemedicina.html'),
    path.join(ROOT, 'servicios', 'acne.html'),
    path.join(ROOT, 'servicios', 'laser.html'),
];
const SERVICE_WORKER_FILE = path.join(ROOT, 'sw.js');

function readUtf8(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

function writeUtf8(filePath, content) {
    fs.writeFileSync(filePath, content, 'utf8');
}

function extractVersion(content, assetPattern) {
    const regex = new RegExp(`${assetPattern}\\?v=([^"'\\s]+)`, 'i');
    const match = content.match(regex);
    return match ? match[1] : null;
}

function ensureExtracted(name, value) {
    if (!value) {
        throw new Error(
            `No se pudo extraer version para ${name} desde la fuente canonica`
        );
    }
}

function replaceOrThrow(content, regex, replacer, label) {
    if (!regex.test(content)) {
        throw new Error(`No se encontro patron esperado para ${label}`);
    }
    return content.replace(regex, replacer);
}

function syncLegacyHtmlFiles(versions, checkOnly) {
    const changed = [];
    for (const filePath of LEGACY_HTML_SYNC_FILES) {
        if (!fs.existsSync(filePath)) {
            continue;
        }

        const original = readUtf8(filePath);
        const synced = replaceOrThrow(
            original,
            /(src\s*=\s*"\.\.\/script\.js\?v=)([^"]+)(")/i,
            `$1${versions.script}$3`,
            `${path.basename(filePath)} script.js`
        );

        if (synced !== original) {
            changed.push(path.relative(ROOT, filePath));
            if (!checkOnly) {
                writeUtf8(filePath, synced);
            }
        }
    }
    return changed;
}

function syncServiceWorker(versions, checkOnly) {
    const relative = path.relative(ROOT, SERVICE_WORKER_FILE);
    const original = readUtf8(SERVICE_WORKER_FILE);
    let synced = original;

    synced = replaceOrThrow(
        synced,
        /(const CACHE_NAME = 'pielarmonia-v\d+-)([^']+)(';\s*)/i,
        `$1${versions.script}$3`,
        'sw.js CACHE_NAME'
    );
    synced = replaceOrThrow(
        synced,
        /('\/styles-deferred\.css\?v=)([^']+)(',)/i,
        `$1${versions.deferredStyles}$3`,
        'sw.js styles-deferred'
    );
    synced = replaceOrThrow(
        synced,
        /('\/js\/bootstrap-inline-engine\.js\?v=)([^']+)(',)/i,
        `$1${versions.bootstrap}$3`,
        'sw.js bootstrap-inline-engine'
    );
    synced = replaceOrThrow(
        synced,
        /('\/script\.js\?v=)([^']+)(',)/i,
        `$1${versions.script}$3`,
        'sw.js script.js'
    );

    if (synced !== original) {
        if (!checkOnly) {
            writeUtf8(SERVICE_WORKER_FILE, synced);
        }
        return [relative];
    }
    return [];
}

function parseArgs() {
    const args = new Set(process.argv.slice(2));
    return {
        checkOnly: args.has('--check'),
    };
}

function extractCompatibilityVersionsFromFile(filePath, label) {
    const content = readUtf8(filePath);
    const versions = {
        script: extractVersion(content, 'script\\.js'),
        bootstrap: extractVersion(content, 'js/bootstrap-inline-engine\\.js'),
        deferredStyles: extractVersion(content, 'styles-deferred\\.css'),
    };

    ensureExtracted(`script.js en ${label}`, versions.script);
    ensureExtracted(
        `bootstrap-inline-engine.js en ${label}`,
        versions.bootstrap
    );
    ensureExtracted(`styles-deferred.css en ${label}`, versions.deferredStyles);

    return versions;
}

function extractStagedShellVersionsFromFile(filePath, label) {
    const content = readUtf8(filePath);
    const publicShell = extractVersion(content, 'js/public-v6-shell\\.js');
    const astroCssMatch = content.match(
        /href="(\/_astro\/[^"\s]+\.css(?:\?v=[^"\s]+)?)"/i
    );
    const astroCss = astroCssMatch ? astroCssMatch[1] : null;

    ensureExtracted(`public-v6-shell.js en ${label}`, publicShell);
    ensureExtracted(`/_astro/*.css en ${label}`, astroCss);

    return {
        publicShell,
        astroCss,
    };
}

function validateStagedIndexConsistency() {
    const stagedIndexPresent = STAGED_INDEX_FILES.filter((filePath) =>
        fs.existsSync(filePath)
    );

    if (stagedIndexPresent.length === 0) {
        return null;
    }

    const stagedVersions = stagedIndexPresent.map((filePath) => ({
        filePath,
        versions: extractStagedShellVersionsFromFile(
            filePath,
            path.relative(ROOT, filePath)
        ),
    }));
    const canonical = stagedVersions[0].versions;

    for (const candidate of stagedVersions.slice(1)) {
        const { versions } = candidate;
        if (
            versions.publicShell !== canonical.publicShell ||
            versions.astroCss !== canonical.astroCss
        ) {
            throw new Error(
                [
                    'Los HTML stageados en .generated/site-root no coinciden en su shell publico o CSS stageado.',
                    ...stagedVersions.map(
                        (item) =>
                            `- ${path.relative(ROOT, item.filePath)} :: public-v6-shell=${item.versions.publicShell}, astro-css=${item.versions.astroCss}`
                    ),
                ].join('\n')
            );
        }
    }

    return {
        sourceFiles: stagedIndexPresent.map((filePath) =>
            path.relative(ROOT, filePath)
        ),
        versions: canonical,
    };
}

function collectVersionSource() {
    const stagedShell = validateStagedIndexConsistency();
    const legacyPresent = [LEGACY_INDEX_FILE, ...LEGACY_HTML_SYNC_FILES].filter(
        (filePath) => fs.existsSync(filePath)
    );

    if (fs.existsSync(SERVICE_WORKER_FILE)) {
        return {
            mode: 'service_worker',
            versions: extractCompatibilityVersionsFromFile(
                SERVICE_WORKER_FILE,
                'sw.js'
            ),
            sourceFiles: [path.relative(ROOT, SERVICE_WORKER_FILE)],
            stagedShell,
        };
    }

    if (fs.existsSync(LEGACY_INDEX_FILE)) {
        return {
            mode: 'legacy_html',
            versions: extractCompatibilityVersionsFromFile(
                LEGACY_INDEX_FILE,
                'index.html'
            ),
            sourceFiles: [path.relative(ROOT, LEGACY_INDEX_FILE)],
            stagedShell,
        };
    }

    if (legacyPresent.length > 0) {
        throw new Error(
            [
                'Hay superficies HTML legacy versionadas pero falta una fuente canonica stageada en .generated/site-root/ o index.html de compatibilidad.',
                ...legacyPresent.map(
                    (filePath) => `- ${path.relative(ROOT, filePath)}`
                ),
            ].join('\n')
        );
    }

    return {
        mode: 'staged_only',
        versions: null,
        sourceFiles: stagedShell ? stagedShell.sourceFiles : [],
        stagedShell,
    };
}

function run() {
    const { checkOnly } = parseArgs();
    const { mode, versions, sourceFiles, stagedShell } = collectVersionSource();
    const stagedShellSuffix = stagedShell
        ? `; stage V6 consistente en ${stagedShell.sourceFiles.join(', ')} (public-v6-shell=${stagedShell.versions.publicShell}, astro-css=${stagedShell.versions.astroCss})`
        : '';

    const changedFiles = [
        ...((mode === 'legacy_html' || mode === 'service_worker') && versions
            ? syncLegacyHtmlFiles(versions, checkOnly)
            : []),
        ...(mode === 'legacy_html' && versions
            ? syncServiceWorker(versions, checkOnly)
            : []),
    ];

    if (checkOnly) {
        if (changedFiles.length > 0) {
            console.error(
                [
                    'Compatibilidad de versiones frontend fuera de sync.',
                    ...changedFiles.map((file) => `- ${file}`),
                ].join('\n')
            );
            process.exit(1);
        }

        if (mode === 'staged_only') {
            console.log(
                `OK: no hay superficies HTML legacy versionadas para sincronizar${stagedShellSuffix}`
            );
            return;
        }

        console.log(
            `OK: contrato de compatibilidad de versiones sincronizado desde ${sourceFiles.join(', ')} (script=${versions.script}, bootstrap=${versions.bootstrap}, styles-deferred=${versions.deferredStyles})${stagedShellSuffix}`
        );
        return;
    }

    if (changedFiles.length === 0) {
        console.log(
            versions
                ? `Sin cambios: contrato de compatibilidad ya estaba sincronizado (script=${versions.script})${stagedShellSuffix}.`
                : `Sin cambios: no hay superficies legacy para sincronizar${stagedShellSuffix}.`
        );
        return;
    }

    console.log(
        [
            `Versiones frontend de compatibilidad sincronizadas desde ${sourceFiles.join(', ')} (script=${versions.script}, bootstrap=${versions.bootstrap}, styles-deferred=${versions.deferredStyles})${stagedShellSuffix}:`,
            ...changedFiles.map((file) => `- ${file}`),
        ].join('\n')
    );
}

try {
    run();
} catch (error) {
    console.error(
        error && error.message
            ? error.message
            : 'Error inesperado al sincronizar versiones frontend'
    );
    process.exit(1);
}
