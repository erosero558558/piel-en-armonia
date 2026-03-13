#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {
    buildTurneroReleaseArtifactName,
    getTurneroDefaultTargetKey,
    getTurneroRegistryDefaults,
    getTurneroTargetDefinition,
    listTurneroSurfaceDefinitions,
    listTurneroTargetKeys,
    resolveTurneroChannel,
    resolveTurneroDownloadPublicPath,
    resolveTurneroUpdatePublicFeedPath,
    resolveTurneroUpdatePublicPayloadPath,
} = require('../lib/turnero-surface-registry.js');

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

function normalizeId(value) {
    return String(value || '')
        .trim()
        .toLowerCase();
}

function parseSurfaceFilter(value) {
    return Array.from(
        new Set(
            String(value || '')
                .split(',')
                .map((entry) => normalizeId(entry))
                .filter(Boolean)
        )
    );
}

function parseTargetFilter(value) {
    return Array.from(
        new Set(
            String(value || '')
                .split(',')
                .map((entry) => normalizeId(entry))
                .filter(Boolean)
        )
    );
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
    return crypto
        .createHash('sha256')
        .update(fs.readFileSync(filePath))
        .digest('hex');
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

function copyCompanionBlockmap(
    sourcePath,
    destinationPath,
    outputRoot,
    records
) {
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

function buildShaLines(records) {
    return records
        .map((record) => `${record.sha256}  ${record.path.replace(/^\//, '')}`)
        .join('\n');
}

function publicPathToOutputPath(outputRoot, publicPath) {
    return path.join(
        outputRoot,
        ...String(publicPath || '')
            .replace(/^\/+/, '')
            .split('/')
            .filter(Boolean)
    );
}

function resolveDesktopSourceDir(desktopRoot, surface, targetKey) {
    const candidates = [
        path.join(desktopRoot, surface.id, targetKey),
        path.join(
            desktopRoot,
            buildTurneroReleaseArtifactName(surface, targetKey)
        ),
        path.join(
            desktopRoot,
            String(surface.desktop?.distDir || ''),
            targetKey
        ),
    ];

    for (const candidate of candidates) {
        const resolved = path.resolve(candidate);
        if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
            return resolved;
        }
    }

    throw new Error(
        `No se encontro build desktop para ${surface.id}/${targetKey} en ${desktopRoot}`
    );
}

function resolveAndroidArtifactFile(androidRoot, surface, targetKey) {
    const target = getTurneroTargetDefinition(surface, targetKey);
    const candidates = [
        path.join(androidRoot, String(surface.android?.stagedArtifact || '')),
        path.join(
            androidRoot,
            buildTurneroReleaseArtifactName(surface, targetKey),
            String(surface.android?.stagedArtifact || target?.manualFile || '')
        ),
        path.join(androidRoot, String(surface.android?.sourceArtifact || '')),
        path.join(
            androidRoot,
            buildTurneroReleaseArtifactName(surface, targetKey),
            path.basename(String(surface.android?.sourceArtifact || ''))
        ),
    ].filter((candidate) => String(candidate || '').trim() !== '');

    for (const candidate of candidates) {
        const resolved = path.resolve(candidate);
        if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
            return resolved;
        }
    }

    const apkCandidates = fs
        .readdirSync(androidRoot, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.apk'))
        .map((entry) => path.join(androidRoot, entry.name))
        .sort();

    if (apkCandidates.length > 0) {
        return apkCandidates[0];
    }

    throw new Error(
        `No se encontro artefacto Android para ${surface.id}/${targetKey} en ${androidRoot}`
    );
}

function stageDesktopSurface(
    surface,
    outputRoot,
    desktopRoot,
    channel,
    version,
    releasedAt,
    targetFilter = []
) {
    const surfaceManifest = {
        version,
        updatedAt: releasedAt,
        webFallbackUrl: surface.webFallbackUrl,
        guideUrl: surface.guideUrl,
        targets: {},
        updates: {},
        files: [],
    };

    const targetKeys = listTurneroTargetKeys(surface).filter(
        (targetKey) =>
            targetFilter.length === 0 || targetFilter.includes(targetKey)
    );

    if (targetKeys.length === 0) {
        return null;
    }

    for (const targetKey of targetKeys) {
        const target = getTurneroTargetDefinition(surface, targetKey);
        const sourceDir = resolveDesktopSourceDir(
            desktopRoot,
            surface,
            targetKey
        );

        const manualSource = requireFile(
            path.join(sourceDir, target.manualFile),
            `instalador ${surface.id}/${targetKey}`
        );
        const manualDestination = publicPathToOutputPath(
            outputRoot,
            resolveTurneroDownloadPublicPath(surface, targetKey, { channel })
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

        surfaceManifest.targets[targetKey] = {
            label: target.label,
            url: manualRecord.path,
            sha256: manualRecord.sha256,
            bytes: manualRecord.bytes,
        };

        if (
            target.feedFile === '' ||
            target.updateFile === '' ||
            target.updatePath === ''
        ) {
            continue;
        }

        const feedSource = requireFile(
            path.join(sourceDir, target.feedFile),
            `feed update ${surface.id}/${targetKey}`
        );
        const feedRecord = copyTrackedFile(
            feedSource,
            publicPathToOutputPath(
                outputRoot,
                resolveTurneroUpdatePublicFeedPath(surface, targetKey, {
                    channel,
                })
            ),
            outputRoot,
            surfaceManifest.files
        );

        const updateFileName = target.updateFile || target.manualFile;
        const updateSource = requireFile(
            path.join(sourceDir, updateFileName),
            `payload update ${surface.id}/${targetKey}`
        );
        const updateDestination = publicPathToOutputPath(
            outputRoot,
            resolveTurneroUpdatePublicPayloadPath(surface, targetKey, {
                channel,
            })
        );
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

        surfaceManifest.updates[targetKey] = {
            feedUrl: feedRecord.path,
            payloadUrl: updateRecord.path,
        };
    }

    return surfaceManifest;
}

function stageAndroidSurface(
    surface,
    outputRoot,
    androidRoot,
    channel,
    version,
    releasedAt,
    targetFilter = []
) {
    const targetKey = getTurneroDefaultTargetKey(surface, {
        targetKey: String(surface.android?.targetKey || ''),
    });
    if (targetFilter.length > 0 && !targetFilter.includes(targetKey)) {
        return null;
    }
    const target = getTurneroTargetDefinition(surface, targetKey);
    const artifactSource = resolveAndroidArtifactFile(
        androidRoot,
        surface,
        targetKey
    );
    const destination = publicPathToOutputPath(
        outputRoot,
        resolveTurneroDownloadPublicPath(surface, targetKey, { channel })
    );
    const files = [];
    const artifactRecord = copyTrackedFile(
        artifactSource,
        destination,
        outputRoot,
        files
    );

    return {
        version,
        updatedAt: releasedAt,
        webFallbackUrl: surface.webFallbackUrl,
        guideUrl: surface.guideUrl,
        targets: {
            [targetKey]: {
                label: target?.label || 'Android',
                url: artifactRecord.path,
                sha256: artifactRecord.sha256,
                bytes: artifactRecord.bytes,
            },
        },
        files,
    };
}

function createChannelManifest(channel, version, releasedAt, baseUrl) {
    return {
        schema: 'turnero-release-bundle/v1',
        channel,
        version,
        releasedAt,
        baseUrl,
        apps: {},
    };
}

function writeChannelManifest(outputRoot, defaults, manifest) {
    const shaRecords = Object.values(manifest.apps).flatMap((surface) =>
        Array.isArray(surface.files) ? surface.files : []
    );
    const manifestPath = path.join(
        outputRoot,
        trimBasePath(defaults.downloadBasePath),
        manifest.channel,
        'release-manifest.json'
    );
    ensureDir(path.dirname(manifestPath));
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const shaPath = path.join(
        outputRoot,
        trimBasePath(defaults.downloadBasePath),
        manifest.channel,
        'SHA256SUMS.txt'
    );
    fs.writeFileSync(shaPath, `${buildShaLines(shaRecords)}\n`);

    return {
        manifestPath,
        shaPath,
        fileCount: shaRecords.length + 2,
    };
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const version = String(args.version || '').trim();
    if (!version) {
        throw new Error('Debes pasar --version');
    }

    const channelOverride = String(args.channel || '').trim();
    const requestedSurfaceIds = parseSurfaceFilter(
        args.surfaces || args.surface
    );
    const requestedTargetIds = parseTargetFilter(args.targets || args.target);
    const outputRoot = path.resolve(
        String(args.outputRoot || 'release/turnero-apps').trim()
    );
    const defaults = getTurneroRegistryDefaults();
    const desktopRoot = path.resolve(
        String(args.desktopRoot || 'src/apps/turnero-desktop/dist').trim()
    );
    const androidRoot = path.resolve(
        String(
            args.tvRoot ||
                args.androidRoot ||
                'src/apps/turnero-sala-tv-android/app/build/outputs/apk/release'
        ).trim()
    );
    const baseUrl = String(args.baseUrl || defaults.baseUrl).trim();
    const releasedAt = String(
        args.releasedAt || new Date().toISOString()
    ).trim();

    resetDir(outputRoot);

    const allSurfaces = listTurneroSurfaceDefinitions();
    const knownSurfaceIds = new Set(allSurfaces.map((surface) => surface.id));
    for (const surfaceId of requestedSurfaceIds) {
        if (!knownSurfaceIds.has(surfaceId)) {
            throw new Error(
                `Superficie desconocida en --surfaces: ${surfaceId}`
            );
        }
    }

    const selectedSurfaces =
        requestedSurfaceIds.length === 0
            ? allSurfaces
            : allSurfaces.filter((surface) =>
                  requestedSurfaceIds.includes(surface.id)
              );

    const manifests = new Map();

    for (const surface of selectedSurfaces.filter(
        (entry) => entry.family === 'desktop'
    )) {
        const surfaceChannel = resolveTurneroChannel(surface, channelOverride);
        if (!manifests.has(surfaceChannel)) {
            manifests.set(
                surfaceChannel,
                createChannelManifest(
                    surfaceChannel,
                    version,
                    releasedAt,
                    baseUrl
                )
            );
        }

        const stagedSurface = stageDesktopSurface(
            surface,
            outputRoot,
            desktopRoot,
            surfaceChannel,
            version,
            releasedAt,
            requestedTargetIds
        );
        if (stagedSurface) {
            manifests.get(surfaceChannel).apps[surface.id] = stagedSurface;
        }
    }

    for (const surface of selectedSurfaces.filter(
        (entry) => entry.family === 'android'
    )) {
        const surfaceChannel = resolveTurneroChannel(surface, channelOverride);
        if (!manifests.has(surfaceChannel)) {
            manifests.set(
                surfaceChannel,
                createChannelManifest(
                    surfaceChannel,
                    version,
                    releasedAt,
                    baseUrl
                )
            );
        }

        const stagedSurface = stageAndroidSurface(
            surface,
            outputRoot,
            androidRoot,
            surfaceChannel,
            version,
            releasedAt,
            requestedTargetIds
        );
        if (stagedSurface) {
            manifests.get(surfaceChannel).apps[surface.id] = stagedSurface;
        }
    }

    const channels = Array.from(manifests.keys()).sort();
    const manifestPaths = [];
    let fileCount = 0;

    for (const channel of channels) {
        if (Object.keys(manifests.get(channel).apps).length === 0) {
            continue;
        }
        const writeResult = writeChannelManifest(
            outputRoot,
            defaults,
            manifests.get(channel)
        );
        manifestPaths.push(writeResult.manifestPath);
        fileCount += writeResult.fileCount;
    }

    if (manifestPaths.length === 0) {
        throw new Error('No hubo superficies/targets compatibles para stagear');
    }

    const summary = {
        version,
        channel:
            channelOverride !== ''
                ? channelOverride
                : channels.length === 1
                  ? channels[0]
                  : '',
        channels,
        surfaces: selectedSurfaces.map((surface) => surface.id),
        targets: requestedTargetIds,
        releasedAt,
        outputRoot,
        manifestPaths,
        fileCount,
    };

    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

function trimBasePath(value) {
    return String(value || '')
        .replace(/^\/+/, '')
        .replace(/\/+$/, '');
}

try {
    main();
} catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
}
