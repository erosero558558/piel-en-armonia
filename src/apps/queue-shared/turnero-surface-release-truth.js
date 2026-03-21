import {
    asObject,
    normalizePathToken,
    toArray,
    toString,
} from './turnero-surface-helpers.js';

const SURFACE_ORDER = Object.freeze(['operator', 'kiosk', 'sala_tv']);

const SURFACE_DEFINITIONS = Object.freeze({
    operator: {
        id: 'operator',
        key: 'operator-turnos',
        path: '/operador-turnos.html',
        label: 'Turnero Operador',
        aliases: [
            'operator-turnos',
            'operador-turnos',
            'operador-turnos.html',
            'queue-operator',
            'operator',
        ],
    },
    kiosk: {
        id: 'kiosk',
        key: 'kiosco-turnos',
        path: '/kiosco-turnos.html',
        label: 'Turnero Kiosco',
        aliases: [
            'kiosco-turnos',
            'kiosco-turnos.html',
            'queue-kiosk',
            'kiosk',
        ],
    },
    sala_tv: {
        id: 'sala_tv',
        key: 'sala-turnos',
        path: '/sala-turnos.html',
        label: 'Turnero Sala TV',
        aliases: [
            'sala-turnos',
            'sala-turnos.html',
            'queue-display',
            'display',
            'sala-tv',
        ],
    },
});

const SURFACE_ID_BY_TOKEN = new Map();
const SURFACE_KEY_BY_ID = new Map();
const SURFACE_PATH_BY_ID = new Map();

for (const definition of Object.values(SURFACE_DEFINITIONS)) {
    SURFACE_KEY_BY_ID.set(definition.id, definition.key);
    SURFACE_PATH_BY_ID.set(definition.id, definition.path);
    SURFACE_ID_BY_TOKEN.set(normalizePathToken(definition.id), definition.id);
    SURFACE_ID_BY_TOKEN.set(normalizePathToken(definition.key), definition.id);
    SURFACE_ID_BY_TOKEN.set(normalizePathToken(definition.path), definition.id);
    definition.aliases.forEach((alias) => {
        SURFACE_ID_BY_TOKEN.set(normalizePathToken(alias), definition.id);
    });
}

function getSurfaceDefinition(surfaceId) {
    return SURFACE_DEFINITIONS[surfaceId] || null;
}

function normalizeSurfaceFamily(value) {
    const family = normalizePathToken(value);
    if (family === 'android' || family === 'android_tv') {
        return 'android';
    }

    if (family === 'desktop' || family === 'win' || family === 'mac') {
        return 'desktop';
    }

    return family || 'desktop';
}

function normalizeTurneroSurfaceId(value) {
    const token = normalizePathToken(value);
    if (!token) {
        return '';
    }

    if (SURFACE_ID_BY_TOKEN.has(token)) {
        return SURFACE_ID_BY_TOKEN.get(token);
    }

    if (token.includes('operator')) {
        return 'operator';
    }

    if (token.includes('kiosk') || token.includes('kiosco')) {
        return 'kiosk';
    }

    if (token.includes('sala') || token.includes('display')) {
        return 'sala_tv';
    }

    return '';
}

function normalizeTurneroSurfaceKey(value) {
    const surfaceId = normalizeTurneroSurfaceId(value);
    return surfaceId ? SURFACE_KEY_BY_ID.get(surfaceId) || surfaceId : '';
}

function normalizeTurneroSurfacePath(value) {
    const surfaceId = normalizeTurneroSurfaceId(value);
    return surfaceId ? SURFACE_PATH_BY_ID.get(surfaceId) || '' : '';
}

function normalizeRegistrySurface(surface, index = 0) {
    const source = asObject(surface);
    const surfaceId = normalizeTurneroSurfaceId(
        source.id ||
            source.key ||
            source.route ||
            source.path ||
            source.routeKey
    );
    const canonicalId =
        surfaceId || toString(source.id, `surface-${index + 1}`);
    const canonicalDefinition = getSurfaceDefinition(canonicalId);
    const route = toString(
        source.route || source.path || source.href,
        canonicalDefinition?.path || ''
    );
    const label = toString(
        source.productName ||
            source.label ||
            source.name ||
            source.catalog?.title ||
            source.ops?.installHub?.title ||
            canonicalDefinition?.label ||
            canonicalId,
        canonicalDefinition?.label || canonicalId
    );
    const key = canonicalDefinition?.key || normalizeTurneroSurfaceKey(route);
    const family = normalizeSurfaceFamily(
        source.family || canonicalDefinition?.family
    );

    return {
        ...source,
        id: canonicalId,
        key: key || normalizeTurneroSurfaceKey(canonicalId),
        path: route || canonicalDefinition?.path || '',
        route: route || canonicalDefinition?.path || '',
        label,
        family,
        enabled: typeof source.enabled === 'boolean' ? source.enabled : true,
    };
}

function getManifestEntry(manifest, surfaceId, surfaceKey) {
    const manifestObject = asObject(manifest);
    const apps = asObject(manifestObject.apps);
    return (
        apps[surfaceId] ||
        apps[surfaceKey] ||
        apps[normalizeTurneroSurfaceId(surfaceId)] ||
        apps[normalizeTurneroSurfaceId(surfaceKey)] ||
        null
    );
}

function getManifestState(registry) {
    const manifestSource = toString(registry?.manifestSource, 'missing');
    if (!registry?.manifest) {
        return 'degraded';
    }

    if (manifestSource === 'fallback') {
        return 'watch';
    }

    return 'ready';
}

function getRuntimeState(surface, canonicalDefinition) {
    if (!surface) {
        return 'unknown';
    }

    if (surface.enabled === false) {
        return 'degraded';
    }

    if (!canonicalDefinition) {
        return 'unknown';
    }

    const currentRoute = normalizePathToken(surface.route || surface.path);
    const expectedRoute = normalizePathToken(canonicalDefinition.path);
    if (!currentRoute && !expectedRoute) {
        return 'unknown';
    }

    if (currentRoute && expectedRoute && currentRoute !== expectedRoute) {
        return 'watch';
    }

    return 'ready';
}

function getReleaseState(manifestState, manifestEntry) {
    if (manifestState === 'degraded') {
        return 'degraded';
    }

    if (!manifestEntry) {
        return 'degraded';
    }

    const targets = asObject(manifestEntry.targets);
    const targetCount = Object.keys(targets).length;
    const fileCount = toArray(manifestEntry.files).length;

    if (targetCount === 0 || fileCount === 0) {
        return 'watch';
    }

    return manifestState;
}

function getTruthState(runtimeState, releaseState) {
    if (runtimeState === 'degraded' || releaseState === 'degraded') {
        return 'degraded';
    }

    if (runtimeState === 'unknown' || releaseState === 'unknown') {
        return 'unknown';
    }

    if (runtimeState === 'watch' || releaseState === 'watch') {
        return 'watch';
    }

    return 'aligned';
}

function buildSurfaceRow(surface, registry = {}, index = 0) {
    const canonical = normalizeRegistrySurface(surface, index);
    const canonicalDefinition = getSurfaceDefinition(canonical.id);
    const manifestState = getManifestState(registry);
    const manifestEntry = getManifestEntry(
        registry.manifest,
        canonical.id,
        canonical.key
    );
    const runtimeState = getRuntimeState(canonical, canonicalDefinition);
    const releaseState = getReleaseState(manifestState, manifestEntry);
    const truth = getTruthState(runtimeState, releaseState);
    const manifestVersion = toString(
        manifestEntry?.version ||
            manifestEntry?.releaseVersion ||
            registry.manifest?.version ||
            ''
    );
    const manifestTargets = Object.keys(asObject(manifestEntry?.targets));
    const manifestFiles = toArray(manifestEntry?.files);

    return {
        ...canonical,
        surfaceId: canonical.id,
        surfaceKey: canonical.key,
        surfacePath: canonical.path,
        manifestKey: canonical.id,
        manifestEntry,
        manifestVersion,
        manifestSource: toString(registry.manifestSource, 'missing'),
        manifestRequestedUrl: toString(registry.requestedManifestUrl, ''),
        manifestResolvedUrl: toString(registry.resolvedManifestUrl, ''),
        manifestState,
        runtimeState,
        releaseState,
        truth,
        truthLabel:
            truth === 'aligned'
                ? 'alineado'
                : truth === 'watch'
                  ? 'watch'
                  : truth === 'degraded'
                    ? 'degradado'
                    : 'desconocido',
        manifestTargets,
        manifestFiles,
        badge: {
            state: truth,
            label: `${canonical.label} · ${truth}`,
        },
        runtimeBadge: {
            state: runtimeState,
            label: `runtime ${runtimeState}`,
        },
        releaseBadge: {
            state: releaseState,
            label: `release ${releaseState}`,
        },
    };
}

function buildSurfaceRows(registry = {}) {
    const rows = toArray(registry.surfaces).map((surface, index) =>
        buildSurfaceRow(surface, registry, index)
    );

    const unknownRows = rows.filter((row) => row.truth === 'unknown');
    const watchRows = rows.filter((row) => row.truth === 'watch');
    const degradedRows = rows.filter((row) => row.truth === 'degraded');
    const alignedRows = rows.filter((row) => row.truth === 'aligned');

    return {
        rows,
        summary: {
            totalCount: rows.length,
            readyCount: alignedRows.length,
            aligned: alignedRows.length,
            watch: watchRows.length,
            degraded: degradedRows.length,
            unknown: unknownRows.length,
            mode:
                rows.length === 0
                    ? 'unknown'
                    : degradedRows.length > 0
                      ? 'degraded'
                      : watchRows.length > 0
                        ? 'watch'
                        : 'ready',
        },
    };
}

export function buildTurneroSurfaceReleaseTruthPack(input = {}) {
    const registry = asObject(input.registry);
    const pack = buildSurfaceRows(registry);

    return {
        rows: pack.rows,
        summary: {
            ...pack.summary,
            mode: pack.summary.mode,
            registryMode: toString(registry.mode, pack.summary.mode),
            requestedManifestUrl: toString(registry.requestedManifestUrl, ''),
            resolvedManifestUrl: toString(registry.resolvedManifestUrl, ''),
            manifestSource: toString(registry.manifestSource, 'missing'),
            surfacesUrl: toString(registry.surfacesUrl, ''),
            warnings: toArray(registry.warnings),
            errors: toArray(registry.errors),
            loadedAt: toString(
                registry.loadedAt || input.loadedAt || new Date().toISOString()
            ),
        },
        registry: {
            surfacesUrl: toString(registry.surfacesUrl, ''),
            requestedManifestUrl: toString(registry.requestedManifestUrl, ''),
            resolvedManifestUrl: toString(registry.resolvedManifestUrl, ''),
            manifestUrl: toString(registry.manifestUrl, ''),
            manifestSource: toString(registry.manifestSource, 'missing'),
            mode: toString(registry.mode, 'unknown'),
            warnings: toArray(registry.warnings),
            errors: toArray(registry.errors),
            loadedAt: toString(registry.loadedAt, ''),
        },
        generatedAt: new Date().toISOString(),
    };
}

export function formatTurneroSurfaceReleaseTruthBrief(pack = {}) {
    const summary = asObject(pack.summary);
    const registry = asObject(pack.registry);
    const rows = toArray(pack.rows);
    const lines = [
        '# Turnero Surface Truth',
        '',
        `Mode: ${toString(summary.mode, 'unknown')}`,
        `Aligned: ${Number(summary.aligned || 0)}/${Number(
            summary.totalCount || rows.length || 0
        )}`,
        `Watch: ${Number(summary.watch || 0)}`,
        `Degraded: ${Number(summary.degraded || 0)}`,
        `Unknown: ${Number(summary.unknown || 0)}`,
        `Manifest source: ${toString(summary.manifestSource, registry.manifestSource || 'missing')}`,
        `Requested manifest: ${toString(
            summary.requestedManifestUrl,
            registry.requestedManifestUrl || ''
        )}`,
        `Resolved manifest: ${toString(
            summary.resolvedManifestUrl,
            registry.resolvedManifestUrl || ''
        )}`,
        '',
    ];

    rows.forEach((row) => {
        lines.push(
            `- ${row.label} (${row.surfaceKey}) · ${row.truth} · ${row.runtimeState}/${row.releaseState} · ${row.path} · v${row.manifestVersion || 'n/a'}`
        );
    });

    return lines.join('\n').trim();
}

export {
    SURFACE_DEFINITIONS,
    SURFACE_ORDER,
    getSurfaceDefinition,
    normalizeTurneroSurfaceId,
    normalizeTurneroSurfaceKey,
    normalizeTurneroSurfacePath,
};
