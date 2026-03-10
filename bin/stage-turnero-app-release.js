#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DESKTOP_SURFACES = Object.freeze({
    operator: {
        artifactBase: 'TurneroOperador',
        webFallbackUrl: '/operador-turnos.html',
        guideUrl: '/app-downloads/?surface=operator',
        targets: {
            win: {
                label: 'Windows',
                manualFile: 'TurneroOperadorSetup.exe',
                feedFile: 'latest.yml',
            },
            mac: {
                label: 'macOS',
                manualFile: 'TurneroOperador.dmg',
                updateFile: 'TurneroOperador.zip',
                feedFile: 'latest-mac.yml',
            },
        },
    },
    kiosk: {
        artifactBase: 'TurneroKiosco',
        webFallbackUrl: '/kiosco-turnos.html',
        guideUrl: '/app-downloads/?surface=kiosk',
        targets: {
            win: {
                label: 'Windows',
                manualFile: 'TurneroKioscoSetup.exe',
                feedFile: 'latest.yml',
            },
            mac: {
                label: 'macOS',
                manualFile: 'TurneroKiosco.dmg',
                updateFile: 'TurneroKiosco.zip',
                feedFile: 'latest-mac.yml',
            },
        },
    },
});

const TV_SURFACE = Object.freeze({
    artifactName: 'TurneroSalaTV.apk',
    webFallbackUrl: '/sala-turnos.html',
    guideUrl: '/app-downloads/?surface=sala_tv',
    label: 'Android TV APK',
});

function parseArgs(argv) {
    const parsed = {};
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith('--')) {
            continue;
        }
        const key = token.slice(2);
        const next = argv[index + 1];
        if (!next || next.startsWith('--')) {
            parsed[key] = 'true';
            continue;
        }
        parsed[key] = next;
        index += 1;
    }
    return parsed;
}

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function resetDir(dirPath) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    ensureDir(dirPath);
}

function toWebPath(filePath, outputRoot) {
    return `/${path.relative(outputRoot, filePath).split(path.sep).join('/')}`;
}

function sha256(filePath) {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function copyTrackedFile(sourcePath, destinationPath, outputRoot, records) {
    ensureDir(path.dirname(destinationPath));
    fs.copyFileSync(sourcePath, destinationPath);
    const stats = fs.statSync(destinationPath);
    const record = {
        path: toWebPath(destinationPath, outputRoot),
        bytes: stats.size,
        sha256: sha256(destinationPath),
    };
    records.push(record);
    return record;
}

function copyCompanionBlockmap(sourcePath, destinationPath, outputRoot, records) {
    const blockmapSource = `${sourcePath}.blockmap`;
    if (!fs.existsSync(blockmapSource)) {
        return null;
    }
    return copyTrackedFile(
        blockmapSource,
        `${destinationPath}.blockmap`,
        outputRoot,
        records
    );
}

function requireFile(filePath, description) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Falta ${description}: ${filePath}`);
    }
    return filePath;
}

function requireApk(tvRoot) {
    const exactMatch = path.join(tvRoot, TV_SURFACE.artifactName);
    if (fs.existsSync(exactMatch)) {
        return exactMatch;
    }

    const candidates = fs
        .readdirSync(tvRoot, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.apk'))
        .map((entry) => entry.name)
        .sort();

    if (candidates.length === 0) {
        throw new Error(`No se encontro ningun APK en ${tvRoot}`);
    }

    return path.join(tvRoot, candidates[0]);
}

function buildShaLines(records) {
    return records
        .map((record) => `${record.sha256}  ${record.path.replace(/^\//, '')}`)
        .join('\n');
}

function stageDesktopSurface(surfaceKey, meta, outputRoot, desktopRoot, channel, version, releasedAt) {
    const surfaceManifest = {
        version,
        updatedAt: releasedAt,
        webFallbackUrl: meta.webFallbackUrl,
        guideUrl: meta.guideUrl,
        targets: {},
        updates: {},
        files: [],
    };

    for (const [platformKey, platformMeta] of Object.entries(meta.targets)) {
        const sourceDir = path.join(desktopRoot, surfaceKey, platformKey);
        requireFile(sourceDir, `directorio ${surfaceKey}/${platformKey}`);

        const manualSource = requireFile(
            path.join(sourceDir, platformMeta.manualFile),
            `instalador ${surfaceKey}/${platformKey}`
        );
        const manualDestination = path.join(
            outputRoot,
            'app-downloads',
            channel,
            surfaceKey,
            platformKey,
            path.basename(platformMeta.manualFile)
        );
        const manualRecord = copyTrackedFile(
            manualSource,
            manualDestination,
            outputRoot,
            surfaceManifest.files
        );
        copyCompanionBlockmap(
            manualSource,
            manualDestination,
            outputRoot,
            surfaceManifest.files
        );

        surfaceManifest.targets[platformKey] = {
            label: platformMeta.label,
            url: manualRecord.path,
            sha256: manualRecord.sha256,
            bytes: manualRecord.bytes,
        };

        const feedSource = requireFile(
            path.join(sourceDir, platformMeta.feedFile),
            `feed update ${surfaceKey}/${platformKey}`
        );
        const updateDir = path.join(
            outputRoot,
            'desktop-updates',
            channel,
            surfaceKey,
            platformKey
        );
        const feedRecord = copyTrackedFile(
            feedSource,
            path.join(updateDir, path.basename(platformMeta.feedFile)),
            outputRoot,
            surfaceManifest.files
        );

        const updateFileName = platformMeta.updateFile || platformMeta.manualFile;
        const updateSource = requireFile(
            path.join(sourceDir, updateFileName),
            `payload update ${surfaceKey}/${platformKey}`
        );
        const updateDestination = path.join(updateDir, path.basename(updateFileName));
        const updateRecord = copyTrackedFile(
            updateSource,
            updateDestination,
            outputRoot,
            surfaceManifest.files
        );
        copyCompanionBlockmap(
            updateSource,
            updateDestination,
            outputRoot,
            surfaceManifest.files
        );

        surfaceManifest.updates[platformKey] = {
            feedUrl: feedRecord.path,
            payloadUrl: updateRecord.path,
        };
    }

    return surfaceManifest;
}

function stageTvSurface(outputRoot, tvRoot, channel, version, releasedAt) {
    const apkSource = requireApk(tvRoot);
    const destination = path.join(
        outputRoot,
        'app-downloads',
        channel,
        'sala-tv',
        'android',
        TV_SURFACE.artifactName
    );
    const files = [];
    const apkRecord = copyTrackedFile(apkSource, destination, outputRoot, files);

    return {
        version,
        updatedAt: releasedAt,
        webFallbackUrl: TV_SURFACE.webFallbackUrl,
        guideUrl: TV_SURFACE.guideUrl,
        targets: {
            android_tv: {
                label: TV_SURFACE.label,
                url: apkRecord.path,
                sha256: apkRecord.sha256,
                bytes: apkRecord.bytes,
            },
        },
        files,
    };
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const version = String(args.version || '').trim();
    if (!version) {
        throw new Error('Debes pasar --version');
    }

    const channel = String(args.channel || 'stable').trim() || 'stable';
    const outputRoot = path.resolve(
        String(args.outputRoot || 'release/turnero-apps').trim()
    );
    const desktopRoot = path.resolve(
        String(args.desktopRoot || 'src/apps/turnero-desktop/dist').trim()
    );
    const tvRoot = path.resolve(
        String(
            args.tvRoot ||
                'src/apps/turnero-sala-tv-android/app/build/outputs/apk/release'
        ).trim()
    );
    const baseUrl = String(args.baseUrl || 'https://pielarmonia.com').trim();
    const releasedAt = String(args.releasedAt || new Date().toISOString()).trim();

    resetDir(outputRoot);

    const manifest = {
        schema: 'turnero-release-bundle/v1',
        channel,
        version,
        releasedAt,
        baseUrl,
        apps: {},
    };

    manifest.apps.operator = stageDesktopSurface(
        'operator',
        DESKTOP_SURFACES.operator,
        outputRoot,
        desktopRoot,
        channel,
        version,
        releasedAt
    );
    manifest.apps.kiosk = stageDesktopSurface(
        'kiosk',
        DESKTOP_SURFACES.kiosk,
        outputRoot,
        desktopRoot,
        channel,
        version,
        releasedAt
    );
    manifest.apps.sala_tv = stageTvSurface(
        outputRoot,
        tvRoot,
        channel,
        version,
        releasedAt
    );

    const manifestPath = path.join(
        outputRoot,
        'app-downloads',
        channel,
        'release-manifest.json'
    );
    ensureDir(path.dirname(manifestPath));
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const shaRecords = []
        .concat(manifest.apps.operator.files)
        .concat(manifest.apps.kiosk.files)
        .concat(manifest.apps.sala_tv.files);
    const shaPath = path.join(outputRoot, 'app-downloads', channel, 'SHA256SUMS.txt');
    fs.writeFileSync(shaPath, `${buildShaLines(shaRecords)}\n`);

    const summary = {
        version,
        channel,
        releasedAt,
        outputRoot,
        manifestPath,
        fileCount: shaRecords.length + 2,
    };

    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

try {
    main();
} catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
}
