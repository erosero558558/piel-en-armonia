import { asObject, toArray, toString } from './turnero-surface-helpers.js';

const DEFAULT_SURFACES_URL = '/data/turnero-surfaces.json';
const DEFAULT_MANIFEST_URL = '/release-manifest.json';
const DEFAULT_FALLBACK_MANIFEST_URL =
    '/app-downloads/pilot/release-manifest.json';

const registrySourceCache = new Map();

async function fetchJson(url, fetchImpl = fetch) {
    const response = await fetchImpl(url, {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
            Accept: 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`fetch_failed:${url}:${response.status}`);
    }

    return response.json();
}

function normalizeSurfacesPayload(payload) {
    if (Array.isArray(payload)) {
        return payload;
    }

    const source = asObject(payload);
    if (Array.isArray(source.surfaces)) {
        return source.surfaces;
    }

    if (Array.isArray(source.items)) {
        return source.items;
    }

    if (Array.isArray(source.registry)) {
        return source.registry;
    }

    return [];
}

function normalizeManifestAppEntry(entry, key = '') {
    const source = asObject(entry);
    const normalizedKey = toString(
        key,
        source.id || source.key || source.route || source.path || ''
    );

    return {
        ...source,
        id: toString(source.id, normalizedKey),
        key: toString(source.key, normalizedKey),
        route: toString(source.route, source.path || ''),
        path: toString(source.path, source.route || ''),
        label: toString(
            source.label || source.name || source.productName,
            normalizedKey
        ),
        enabled: typeof source.enabled === 'boolean' ? source.enabled : true,
    };
}

function normalizeManifestAppsPayload(apps) {
    if (Array.isArray(apps)) {
        return apps.reduce((accumulator, entry, index) => {
            const source = normalizeManifestAppEntry(entry);
            const key = toString(
                source.id || source.key || source.route || source.path,
                `app-${index + 1}`
            );
            accumulator[key] = source;
            return accumulator;
        }, {});
    }

    const source = asObject(apps);
    return Object.keys(source).reduce((accumulator, key) => {
        accumulator[key] = normalizeManifestAppEntry(source[key], key);
        return accumulator;
    }, {});
}

function normalizeManifestPayload(payload) {
    const source = asObject(payload);
    if (Object.keys(source).length === 0) {
        return null;
    }

    return {
        ...source,
        apps: normalizeManifestAppsPayload(source.apps),
    };
}

function normalizeRegistrySourceSnapshot(source = {}, options = {}) {
    const registry = asObject(source);
    const surfaces = normalizeSurfacesPayload(registry.surfaces);
    const manifest = normalizeManifestPayload(registry.manifest);
    const requestedManifestUrl = toString(
        registry.requestedManifestUrl || options.manifestUrl,
        DEFAULT_MANIFEST_URL
    );
    const resolvedManifestUrl = toString(
        registry.resolvedManifestUrl || registry.manifestUrl,
        requestedManifestUrl
    );
    const manifestSource =
        registry.manifestSource ||
        (resolvedManifestUrl && resolvedManifestUrl !== requestedManifestUrl
            ? 'fallback'
            : manifest
              ? 'primary'
              : 'missing');
    const warnings = toArray(registry.warnings);
    const errors = toArray(registry.errors);
    const hasSurfaces = surfaces.length > 0;
    const hasManifest = Boolean(manifest);
    let mode = 'unknown';

    if (hasSurfaces && hasManifest) {
        mode =
            manifestSource === 'fallback' ||
            warnings.length > 0 ||
            errors.length > 0
                ? 'watch'
                : 'ready';
    } else if (hasSurfaces || hasManifest) {
        mode = 'degraded';
    }

    return {
        surfacesUrl: toString(
            registry.surfacesUrl || options.surfacesUrl,
            DEFAULT_SURFACES_URL
        ),
        requestedManifestUrl,
        resolvedManifestUrl,
        manifestUrl: resolvedManifestUrl || requestedManifestUrl,
        manifestSource,
        surfaces,
        manifest,
        mode,
        warnings,
        errors,
        loadedAt: toString(
            registry.loadedAt || options.loadedAt || new Date().toISOString()
        ),
    };
}

async function loadRegistrySourceSnapshot(options = {}) {
    const surfacesUrl = toString(options.surfacesUrl, DEFAULT_SURFACES_URL);
    const requestedManifestUrl = toString(
        options.manifestUrl,
        DEFAULT_MANIFEST_URL
    );
    const fallbackManifestUrl = toString(
        options.fallbackManifestUrl,
        DEFAULT_FALLBACK_MANIFEST_URL
    );
    const fetchImpl = options.fetchImpl || fetch;
    const cacheKey = [
        surfacesUrl,
        requestedManifestUrl,
        fallbackManifestUrl,
        fetchImpl === fetch ? 'default' : 'custom',
    ].join('::');

    if (!options.refresh && registrySourceCache.has(cacheKey)) {
        return registrySourceCache.get(cacheKey);
    }

    const resultPromise = (async () => {
        const warnings = [];
        const errors = [];
        let surfaces = [];
        let manifest = null;
        let resolvedManifestUrl = requestedManifestUrl;
        let manifestSource = 'missing';

        const [surfacesResult, manifestResult] = await Promise.allSettled([
            fetchJson(surfacesUrl, fetchImpl),
            fetchJson(requestedManifestUrl, fetchImpl),
        ]);

        if (surfacesResult.status === 'fulfilled') {
            surfaces = normalizeSurfacesPayload(surfacesResult.value);
        } else {
            errors.push(
                String(
                    surfacesResult.reason?.message ||
                        surfacesResult.reason ||
                        `fetch_failed:${surfacesUrl}`
                )
            );
        }

        if (manifestResult.status === 'fulfilled') {
            manifest = normalizeManifestPayload(manifestResult.value);
            manifestSource = 'primary';
        } else {
            try {
                const fallbackManifest = normalizeManifestPayload(
                    await fetchJson(fallbackManifestUrl, fetchImpl)
                );
                if (fallbackManifest) {
                    manifest = fallbackManifest;
                    resolvedManifestUrl = fallbackManifestUrl;
                    manifestSource = 'fallback';
                    warnings.push(
                        `manifest_root_fallback:${requestedManifestUrl}`
                    );
                } else {
                    errors.push(`manifest_root_missing:${fallbackManifestUrl}`);
                }
            } catch (fallbackError) {
                errors.push(
                    String(
                        fallbackError?.message ||
                            fallbackError ||
                            `fetch_failed:${fallbackManifestUrl}`
                    )
                );
            }

            if (!manifest) {
                errors.push(
                    String(
                        manifestResult.reason?.message ||
                            manifestResult.reason ||
                            `fetch_failed:${requestedManifestUrl}`
                    )
                );
            }
        }

        if (
            manifest &&
            manifest.schema &&
            manifest.schema !== 'turnero-release-bundle/v1'
        ) {
            warnings.push(`manifest_schema:${toString(manifest.schema)}`);
        }

        const snapshot = normalizeRegistrySourceSnapshot(
            {
                surfacesUrl,
                requestedManifestUrl,
                resolvedManifestUrl,
                manifestUrl: resolvedManifestUrl,
                manifestSource,
                surfaces,
                manifest,
                warnings,
                errors,
                loadedAt: new Date().toISOString(),
            },
            {
                surfacesUrl,
                manifestUrl: requestedManifestUrl,
                fallbackManifestUrl,
            }
        );

        if (!snapshot.surfaces.length && !snapshot.manifest) {
            snapshot.mode = 'unknown';
        } else if (!snapshot.surfaces.length || !snapshot.manifest) {
            snapshot.mode = 'degraded';
        } else if (snapshot.manifestSource === 'fallback') {
            snapshot.mode = 'watch';
        }

        return snapshot;
    })();

    registrySourceCache.set(cacheKey, resultPromise);

    try {
        return await resultPromise;
    } catch (_error) {
        registrySourceCache.delete(cacheKey);
        return normalizeRegistrySourceSnapshot({
            surfacesUrl,
            requestedManifestUrl,
            resolvedManifestUrl: '',
            manifestUrl: '',
            manifestSource: 'missing',
            surfaces: [],
            manifest: null,
            warnings: [],
            errors: ['registry_source_failed'],
            loadedAt: new Date().toISOString(),
        });
    }
}

export function clearTurneroSurfaceRegistrySourceCache() {
    registrySourceCache.clear();
}

export async function loadTurneroSurfaceRegistrySource(options = {}) {
    return loadRegistrySourceSnapshot(options);
}

export {
    normalizeManifestAppEntry,
    normalizeManifestAppsPayload,
    normalizeManifestPayload,
};
