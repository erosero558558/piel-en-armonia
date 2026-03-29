#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {
    getTurneroSurfaceDefinition,
    resolveTurneroDownloadPublicPath,
    resolveTurneroUpdatePublicFeedPath,
    resolveTurneroUpdatePublicPayloadPath,
} = require('../lib/turnero-surface-registry.js');

function parseArgs(argv) {
    const parsed = {};
    for (let index = 0; index < argv.length; index += 1) {
        const token = String(argv[index] || '').trim();
        if (!token.startsWith('--')) {
            continue;
        }

        const key = token.slice(2);
        const next = String(argv[index + 1] || '').trim();
        if (next === '' || next.startsWith('--')) {
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

function parseFilter(value) {
    return Array.from(
        new Set(
            String(value || '')
                .split(',')
                .map((entry) => normalizeId(entry))
                .filter(Boolean)
        )
    );
}

function ensure(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function publicPathToAbsolute(outputRoot, publicPath) {
    return path.join(
        outputRoot,
        ...String(publicPath || '')
            .replace(/^\/+/, '')
            .split('/')
            .filter(Boolean)
    );
}

function sha256(filePath) {
    return crypto
        .createHash('sha256')
        .update(fs.readFileSync(filePath))
        .digest('hex');
}

function stripQuotes(value) {
    return String(value || '')
        .trim()
        .replace(/^['"]|['"]$/g, '');
}

function parseSha256Sums(filePath) {
    const payload = fs.readFileSync(filePath, 'utf8');
    const entries = new Map();
    for (const line of payload.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed === '') {
            continue;
        }

        const match = trimmed.match(/^([a-f0-9]{64})\s+(.+)$/i);
        ensure(match, `Linea invalida en SHA256SUMS: ${trimmed}`);
        entries.set(
            match[2].trim().replace(/\\/g, '/'),
            match[1].toLowerCase()
        );
    }
    return entries;
}

function parseFeedMetadata(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const versionMatch = raw.match(/^\s*version:\s*(.+)\s*$/m);
    const pathMatch = raw.match(/^\s*path:\s*(.+)\s*$/m);
    const fileUrlMatch = raw.match(/^\s*-\s*url:\s*(.+)\s*$/m);

    return {
        version: stripQuotes(versionMatch ? versionMatch[1] : ''),
        path: stripQuotes(pathMatch ? pathMatch[1] : ''),
        fileUrl: stripQuotes(fileUrlMatch ? fileUrlMatch[1] : ''),
    };
}

function discoverManifestPaths(outputRoot, requestedChannels = []) {
    const appDownloadsRoot = path.join(outputRoot, 'app-downloads');
    ensure(
        fs.existsSync(appDownloadsRoot) &&
            fs.statSync(appDownloadsRoot).isDirectory(),
        `No existe app-downloads/: ${appDownloadsRoot}`
    );

    if (requestedChannels.length > 0) {
        return requestedChannels.map((channel) => {
            const manifestPath = path.join(
                appDownloadsRoot,
                channel,
                'release-manifest.json'
            );
            ensure(
                fs.existsSync(manifestPath),
                `No existe release-manifest.json para canal ${channel}: ${manifestPath}`
            );
            return manifestPath;
        });
    }

    const manifestPaths = fs
        .readdirSync(appDownloadsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) =>
            path.join(appDownloadsRoot, entry.name, 'release-manifest.json')
        )
        .filter((manifestPath) => fs.existsSync(manifestPath))
        .sort();

    ensure(
        manifestPaths.length > 0,
        `No se encontraron manifests en ${appDownloadsRoot}`
    );

    return manifestPaths;
}

function findTrackedFile(surfaceManifest, publicPath) {
    const files = Array.isArray(surfaceManifest?.files)
        ? surfaceManifest.files
        : [];
    return (
        files.find((entry) => String(entry?.path || '') === publicPath) || null
    );
}

function verifyTrackedFile({
    outputRoot,
    shaEntries,
    surfaceId,
    targetKey,
    publicPath,
    expectedSha256,
    expectedBytes,
    sourceLabel,
}) {
    ensure(
        publicPath,
        `Ruta publica vacia para ${surfaceId}/${targetKey} (${sourceLabel})`
    );

    const absolutePath = publicPathToAbsolute(outputRoot, publicPath);
    ensure(
        fs.existsSync(absolutePath),
        `Falta archivo ${sourceLabel} para ${surfaceId}/${targetKey}: ${absolutePath}`
    );

    const stats = fs.statSync(absolutePath);
    ensure(
        stats.isFile(),
        `La ruta ${sourceLabel} no es archivo para ${surfaceId}/${targetKey}: ${absolutePath}`
    );

    const actualSha256 = sha256(absolutePath);
    const relativeShaPath = publicPath.replace(/^\/+/, '');
    const shaFromFile = shaEntries.get(relativeShaPath);

    ensure(
        actualSha256 === String(expectedSha256 || '').toLowerCase(),
        `SHA256 no coincide para ${sourceLabel} ${surfaceId}/${targetKey}: ${publicPath}`
    );
    ensure(
        Number(stats.size) === Number(expectedBytes || 0),
        `Bytes no coinciden para ${sourceLabel} ${surfaceId}/${targetKey}: ${publicPath}`
    );
    ensure(
        shaFromFile === actualSha256,
        `SHA256SUMS no coincide para ${sourceLabel} ${surfaceId}/${targetKey}: ${relativeShaPath}`
    );

    return {
        absolutePath,
        bytes: Number(stats.size),
        sha256: actualSha256,
    };
}

function verifySurfaceTarget({
    outputRoot,
    manifest,
    shaEntries,
    surfaceId,
    targetKey,
    surfaceManifest,
    targetManifest,
}) {
    const expectedManualUrl = resolveTurneroDownloadPublicPath(
        surfaceId,
        targetKey,
        {
            channel: manifest.channel,
        }
    );
    ensure(
        targetManifest.url === expectedManualUrl,
        `URL publica inesperada para ${surfaceId}/${targetKey}: ${targetManifest.url}`
    );

    const trackedManualFile = findTrackedFile(
        surfaceManifest,
        targetManifest.url
    );
    ensure(
        trackedManualFile,
        `El manifest no registra ${targetManifest.url} en files[] para ${surfaceId}/${targetKey}`
    );

    verifyTrackedFile({
        outputRoot,
        shaEntries,
        surfaceId,
        targetKey,
        publicPath: targetManifest.url,
        expectedSha256: targetManifest.sha256,
        expectedBytes: targetManifest.bytes,
        sourceLabel: 'instalador',
    });

    ensure(
        String(trackedManualFile.sha256 || '').toLowerCase() ===
            String(targetManifest.sha256 || '').toLowerCase(),
        `files[] no coincide con target sha256 para ${surfaceId}/${targetKey}`
    );
    ensure(
        Number(trackedManualFile.bytes || 0) ===
            Number(targetManifest.bytes || 0),
        `files[] no coincide con target bytes para ${surfaceId}/${targetKey}`
    );

    const expectedFeedUrl = resolveTurneroUpdatePublicFeedPath(
        surfaceId,
        targetKey,
        {
            channel: manifest.channel,
        }
    );
    const expectedPayloadUrl = resolveTurneroUpdatePublicPayloadPath(
        surfaceId,
        targetKey,
        {
            channel: manifest.channel,
        }
    );

    if (expectedFeedUrl === '' || expectedPayloadUrl === '') {
        return 1;
    }

    const updateManifest = surfaceManifest?.updates?.[targetKey];
    ensure(
        updateManifest,
        `Falta updates.${targetKey} en manifest para ${surfaceId}/${targetKey}`
    );
    ensure(
        updateManifest.feedUrl === expectedFeedUrl,
        `Feed inesperado para ${surfaceId}/${targetKey}: ${updateManifest.feedUrl}`
    );
    ensure(
        updateManifest.payloadUrl === expectedPayloadUrl,
        `Payload update inesperado para ${surfaceId}/${targetKey}: ${updateManifest.payloadUrl}`
    );

    const trackedFeed = findTrackedFile(
        surfaceManifest,
        updateManifest.feedUrl
    );
    const trackedPayload = findTrackedFile(
        surfaceManifest,
        updateManifest.payloadUrl
    );
    ensure(
        trackedFeed,
        `El manifest no registra ${updateManifest.feedUrl} en files[] para ${surfaceId}/${targetKey}`
    );
    ensure(
        trackedPayload,
        `El manifest no registra ${updateManifest.payloadUrl} en files[] para ${surfaceId}/${targetKey}`
    );

    const feedFile = verifyTrackedFile({
        outputRoot,
        shaEntries,
        surfaceId,
        targetKey,
        publicPath: updateManifest.feedUrl,
        expectedSha256: trackedFeed.sha256,
        expectedBytes: trackedFeed.bytes,
        sourceLabel: 'feed',
    });
    verifyTrackedFile({
        outputRoot,
        shaEntries,
        surfaceId,
        targetKey,
        publicPath: updateManifest.payloadUrl,
        expectedSha256: trackedPayload.sha256,
        expectedBytes: trackedPayload.bytes,
        sourceLabel: 'payload update',
    });

    const feedMetadata = parseFeedMetadata(feedFile.absolutePath);
    const expectedPayloadName = path.basename(updateManifest.payloadUrl);
    ensure(
        feedMetadata.version === manifest.version,
        `Feed ${surfaceId}/${targetKey} version mismatch: ${feedMetadata.version}`
    );
    ensure(
        path.basename(feedMetadata.path || '') === expectedPayloadName,
        `Feed ${surfaceId}/${targetKey} path mismatch: ${feedMetadata.path}`
    );

    if (feedMetadata.fileUrl) {
        ensure(
            path.basename(feedMetadata.fileUrl) === expectedPayloadName,
            `Feed ${surfaceId}/${targetKey} files[0].url mismatch: ${feedMetadata.fileUrl}`
        );
    }

    return 3;
}

function verifyManifestFile(
    manifestPath,
    outputRoot,
    requestedSurfaceIds = [],
    requestedTargetIds = [],
    expectedVersion = ''
) {
    const manifest = readJson(manifestPath);
    const shaPath = path.join(path.dirname(manifestPath), 'SHA256SUMS.txt');

    ensure(
        manifest.schema === 'turnero-release-bundle/v1',
        `Schema invalido en ${manifestPath}`
    );
    ensure(manifest.channel, `Canal vacio en ${manifestPath}`);
    ensure(manifest.version, `Version vacia en ${manifestPath}`);
    ensure(manifest.baseUrl, `baseUrl vacio en ${manifestPath}`);
    if (expectedVersion) {
        ensure(
            manifest.version === expectedVersion,
            `Version inesperada en ${manifestPath}: ${manifest.version}`
        );
    }
    ensure(
        fs.existsSync(shaPath),
        `Falta SHA256SUMS.txt para ${manifest.channel}`
    );

    const shaEntries = parseSha256Sums(shaPath);
    const availableSurfaceIds = Object.keys(manifest.apps || {});
    ensure(
        availableSurfaceIds.length > 0,
        `Manifest sin apps en ${manifestPath}`
    );

    const surfaceIds =
        requestedSurfaceIds.length > 0
            ? requestedSurfaceIds.filter((surfaceId) =>
                  availableSurfaceIds.includes(surfaceId)
              )
            : availableSurfaceIds;
    if (requestedSurfaceIds.length > 0 && surfaceIds.length === 0) {
        return null;
    }

    const explicitSurfaceSelection = requestedSurfaceIds.length > 0;
    let verifiedTargets = 0;
    const verifiedSurfaceIds = [];

    for (const surfaceId of surfaceIds) {
        const surfaceManifest = manifest.apps?.[surfaceId];
        ensure(
            surfaceManifest,
            `La superficie ${surfaceId} no existe en ${manifestPath}`
        );

        const surfaceDefinition = getTurneroSurfaceDefinition(surfaceId);
        ensure(
            surfaceDefinition,
            `Superficie desconocida en registry: ${surfaceId}`
        );
        ensure(
            surfaceManifest.version === manifest.version,
            `Version inconsistente para ${surfaceId} en ${manifestPath}`
        );
        ensure(
            surfaceManifest.updatedAt,
            `updatedAt vacio para ${surfaceId} en ${manifestPath}`
        );

        const availableTargetIds = Object.keys(surfaceManifest.targets || {});
        ensure(
            availableTargetIds.length > 0,
            `La superficie ${surfaceId} no tiene targets en ${manifestPath}`
        );

        let targetIds = availableTargetIds;
        if (requestedTargetIds.length > 0) {
            targetIds = availableTargetIds.filter((targetId) =>
                requestedTargetIds.includes(targetId)
            );
            if (targetIds.length === 0) {
                if (explicitSurfaceSelection) {
                    throw new Error(
                        `La superficie ${surfaceId} no tiene targets compatibles con ${requestedTargetIds.join(', ')}`
                    );
                }
                continue;
            }
        }

        for (const targetKey of targetIds) {
            verifiedTargets += verifySurfaceTarget({
                outputRoot,
                manifest,
                shaEntries,
                surfaceId,
                targetKey,
                surfaceManifest,
                targetManifest: surfaceManifest.targets[targetKey],
            });
        }

        for (const trackedFile of surfaceManifest.files || []) {
            ensure(
                trackedFile.path &&
                    trackedFile.sha256 &&
                    trackedFile.bytes >= 0,
                `Entrada invalida en files[] para ${surfaceId} en ${manifestPath}`
            );
        }

        verifiedSurfaceIds.push(surfaceId);
    }

    if (verifiedSurfaceIds.length === 0) {
        return null;
    }

    return {
        channel: manifest.channel,
        manifestPath,
        surfaceIds: verifiedSurfaceIds,
        targetCount: verifiedTargets,
    };
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const outputRoot = path.resolve(
        String(args.outputRoot || 'release/turnero-apps').trim()
    );
    const requestedChannels = parseFilter(args.channels || args.channel);
    const requestedSurfaceIds = parseFilter(args.surfaces || args.surface);
    const requestedTargetIds = parseFilter(args.targets || args.target);
    const expectedVersion = String(args.version || '').trim();

    for (const surfaceId of requestedSurfaceIds) {
        ensure(
            getTurneroSurfaceDefinition(surfaceId),
            `Superficie desconocida en --surface(s): ${surfaceId}`
        );
    }

    const manifestPaths = discoverManifestPaths(outputRoot, requestedChannels);
    const results = manifestPaths
        .map((manifestPath) =>
            verifyManifestFile(
                manifestPath,
                outputRoot,
                requestedSurfaceIds,
                requestedTargetIds,
                expectedVersion
            )
        )
        .filter(Boolean);

    ensure(
        results.length > 0,
        'Ningun manifest coincide con los filtros solicitados'
    );

    const totalTargets = results.reduce(
        (sum, entry) => sum + Number(entry.targetCount || 0),
        0
    );
    const summary = results
        .map(
            (entry) =>
                `${entry.channel}: ${entry.surfaceIds.join(', ')} (${entry.targetCount} chequeos)`
        )
        .join(' | ');

    process.stdout.write(
        `[turnero-release-verify] OK ${results.length} canal(es), ${totalTargets} chequeos. ${summary}\n`
    );
}

if (require.main === module) {
    try {
        main();
    } catch (error) {
        process.stderr.write(
            `[turnero-release-verify] ${error.message || String(error)}\n`
        );
        process.exit(1);
    }
}

module.exports = {
    discoverManifestPaths,
    parseArgs,
    parseFeedMetadata,
    parseFilter,
    parseSha256Sums,
    publicPathToAbsolute,
    verifyManifestFile,
};
