import registryModule from '../../../../../lib/turnero-surface-registry.js';
import {
    applyOperatorSurfaceSearchParams,
    buildOperatorSurfaceState,
    normalizeAutoStart,
    normalizeLaunchMode,
    normalizeOneTap,
    normalizeStationConsultorio,
    normalizeStationMode,
    normalizeUpdateChannel,
} from '../../../queue-shared/turnero-runtime-contract.mjs';

const {
    getTurneroDefaultTargetKey,
    getTurneroRegistryDefaults,
    getTurneroSurfaceDefinition,
    normalizeTurneroSurfaceId,
    resolveTurneroUpdateRelativeDirectory,
} = registryModule;

export {
    applyOperatorSurfaceSearchParams,
    buildOperatorSurfaceState,
    normalizeAutoStart,
    normalizeLaunchMode,
    normalizeOneTap,
    normalizeStationConsultorio,
    normalizeStationMode,
    normalizeUpdateChannel,
};

const REGISTRY_DEFAULTS = getTurneroRegistryDefaults();
const DEFAULT_BASE_URL = REGISTRY_DEFAULTS.baseUrl;
const DEFAULT_UPDATE_BASE_URL = new URL(
    REGISTRY_DEFAULTS.updateBasePath,
    `${DEFAULT_BASE_URL}/`
).toString();

export function normalizeSurface(value) {
    return normalizeTurneroSurfaceId(value, {
        family: 'desktop',
        fallback: 'operator',
    });
}

export function sanitizeBaseUrl(value, fallback = DEFAULT_BASE_URL) {
    try {
        const url = new URL(String(value || fallback).trim() || fallback);
        if (!['http:', 'https:'].includes(url.protocol)) {
            return fallback;
        }
        url.pathname = '/';
        url.search = '';
        url.hash = '';
        return url.toString().replace(/\/$/, '');
    } catch (_error) {
        return fallback;
    }
}

export function sanitizeUpdateBaseUrl(value, baseUrl = DEFAULT_BASE_URL) {
    const fallback = new URL(
        '/desktop-updates/',
        `${sanitizeBaseUrl(baseUrl)}/`
    );
    try {
        const url = new URL(
            String(value || fallback.toString()).trim() || fallback
        );
        if (!['http:', 'https:'].includes(url.protocol)) {
            return fallback.toString();
        }
        if (!url.pathname.endsWith('/')) {
            url.pathname = `${url.pathname}/`;
        }
        url.search = '';
        url.hash = '';
        return url.toString();
    } catch (_error) {
        return fallback.toString();
    }
}

export function getSurfaceMeta(surface) {
    return getTurneroSurfaceDefinition(normalizeSurface(surface), {
        family: 'desktop',
    });
}

export function getSurfaceRoute(surface) {
    return String(getSurfaceMeta(surface)?.route || '');
}

export function createBuildConfig(partial = {}) {
    const surface = normalizeSurface(partial.surface);
    const surfaceMeta = getSurfaceMeta(surface);
    const baseUrl = sanitizeBaseUrl(partial.baseUrl, DEFAULT_BASE_URL);
    return {
        surface,
        baseUrl,
        launchMode: normalizeLaunchMode(partial.launchMode),
        stationMode: normalizeStationMode(partial.stationMode, 'free'),
        stationConsultorio: normalizeStationConsultorio(
            partial.stationConsultorio,
            1
        ),
        oneTap: normalizeOneTap(partial.oneTap, false),
        autoStart: normalizeAutoStart(partial.autoStart, true),
        updateChannel: normalizeUpdateChannel(
            partial.updateChannel,
            surfaceMeta?.updateChannel || 'stable'
        ),
        updateBaseUrl: sanitizeUpdateBaseUrl(partial.updateBaseUrl, baseUrl),
    };
}

export function mergeRuntimeConfig(buildConfig, persisted = {}) {
    return {
        surface: normalizeSurface(buildConfig.surface),
        baseUrl: sanitizeBaseUrl(persisted.baseUrl, buildConfig.baseUrl),
        launchMode: normalizeLaunchMode(
            persisted.launchMode || buildConfig.launchMode
        ),
        stationMode: normalizeStationMode(
            persisted.stationMode,
            buildConfig.stationMode
        ),
        stationConsultorio: normalizeStationConsultorio(
            persisted.stationConsultorio,
            buildConfig.stationConsultorio
        ),
        oneTap: normalizeOneTap(persisted.oneTap, buildConfig.oneTap),
        autoStart: normalizeAutoStart(
            persisted.autoStart,
            buildConfig.autoStart
        ),
        updateChannel: normalizeUpdateChannel(
            persisted.updateChannel || buildConfig.updateChannel,
            buildConfig.updateChannel
        ),
        updateBaseUrl: sanitizeUpdateBaseUrl(
            persisted.updateBaseUrl || buildConfig.updateBaseUrl,
            persisted.baseUrl || buildConfig.baseUrl
        ),
    };
}

export function createSurfaceUrl(config) {
    const url = new URL(
        getSurfaceRoute(config.surface),
        `${sanitizeBaseUrl(config.baseUrl)}/`
    );

    if (normalizeSurface(config.surface) === 'operator') {
        applyOperatorSurfaceSearchParams(url.searchParams, config);
    }

    return url.toString();
}

function resolveGuideTargetKey(surface, platform = process.platform) {
    if (normalizeSurface(surface) === 'sala_tv') {
        return getTurneroDefaultTargetKey(surface, {
            targetKey: 'android_tv',
        });
    }

    return getTurneroDefaultTargetKey(surface, {
        targetKey:
            String(platform || '')
                .trim()
                .toLowerCase() === 'darwin'
                ? 'mac'
                : 'win',
    });
}

export function buildSupportGuideUrl(config, platform = process.platform) {
    const surface = normalizeSurface(config.surface);
    const surfaceMeta = getSurfaceMeta(surface);
    const url = new URL(
        String(surfaceMeta?.guideUrl || `/app-downloads/?surface=${surface}`),
        `${sanitizeBaseUrl(config.baseUrl)}/`
    );

    url.searchParams.set('surface', surface);
    const targetKey = resolveGuideTargetKey(surface, platform);
    if (targetKey) {
        url.searchParams.set('platform', targetKey);
    }

    if (surface === 'operator') {
        applyOperatorSurfaceSearchParams(url.searchParams, config);
    } else {
        url.searchParams.delete('station');
        url.searchParams.delete('lock');
        url.searchParams.delete('one_tap');
    }

    return url.toString();
}

export function buildUpdateFeedUrl(config, platform = process.platform) {
    const platformSegment = platform === 'darwin' ? 'mac' : 'win';
    const relativePath = resolveTurneroUpdateRelativeDirectory(
        normalizeSurface(config.surface),
        getTurneroDefaultTargetKey(normalizeSurface(config.surface), {
            targetKey: platformSegment,
        }),
        {
            channel: normalizeUpdateChannel(config.updateChannel, 'stable'),
        }
    );
    return new URL(
        relativePath,
        sanitizeUpdateBaseUrl(config.updateBaseUrl, config.baseUrl)
    ).toString();
}

export function buildUpdateMetadataUrl(config, platform = process.platform) {
    const feedUrl = buildUpdateFeedUrl(config, platform);
    const metadataFile =
        platform === 'darwin' ? 'latest-mac.yml' : 'latest.yml';

    return new URL(
        metadataFile,
        feedUrl.endsWith('/') ? feedUrl : `${feedUrl}/`
    ).toString();
}

export function buildGenericUpdateProvider(
    config,
    platform = process.platform
) {
    return {
        provider: 'generic',
        url: buildUpdateFeedUrl(config, platform),
    };
}

export function getDefaultBaseUrl() {
    return DEFAULT_BASE_URL;
}

export function getDefaultUpdateBaseUrl() {
    return DEFAULT_UPDATE_BASE_URL;
}
