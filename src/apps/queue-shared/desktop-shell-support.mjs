import {
    applyOperatorSurfaceSearchParams,
    normalizeOneTap,
    normalizeStationConsultorio,
    normalizeStationMode,
} from './turnero-runtime-contract.mjs';

export function formatDesktopPlatformLabel(
    platform,
    { fallbackLabel = 'Web' } = {}
) {
    const normalized = String(platform || '')
        .trim()
        .toLowerCase();
    if (normalized === 'win32') {
        return 'Windows';
    }
    if (normalized === 'darwin') {
        return 'macOS';
    }
    if (normalized === 'linux') {
        return 'Linux';
    }
    return normalized || String(fallbackLabel || 'Web');
}

export function buildDesktopUpdateMetadataUrl({
    updateMetadataUrl,
    updateFeedUrl,
    platform,
} = {}) {
    const rawMetadataUrl = String(updateMetadataUrl || '').trim();
    if (rawMetadataUrl) {
        return rawMetadataUrl;
    }

    const rawFeedUrl = String(updateFeedUrl || '').trim();
    if (!rawFeedUrl) {
        return '';
    }

    const metadataFile =
        String(platform || '')
            .trim()
            .toLowerCase() === 'darwin'
            ? 'latest-mac.yml'
            : 'latest.yml';

    return `${rawFeedUrl.endsWith('/') ? rawFeedUrl : `${rawFeedUrl}/`}${metadataFile}`;
}

export function resolveDesktopGuidePlatform(surface, platform) {
    const normalizedSurface = String(surface || 'operator')
        .trim()
        .toLowerCase();
    if (normalizedSurface === 'sala_tv') {
        return 'android_tv';
    }

    return String(platform || '')
        .trim()
        .toLowerCase() === 'darwin'
        ? 'mac'
        : 'win';
}

export function buildDesktopSupportGuideUrl({
    installGuideUrl,
    baseUrl = 'https://pielarmonia.com',
    surface = 'operator',
    platform,
    stationMode = 'free',
    stationConsultorio = 1,
    oneTap = false,
} = {}) {
    const configuredUrl = String(installGuideUrl || '').trim();
    if (configuredUrl) {
        return configuredUrl;
    }

    try {
        const normalizedSurface = String(surface || 'operator')
            .trim()
            .toLowerCase();
        const url = new URL(
            `/app-downloads/?surface=${normalizedSurface}`,
            `${String(baseUrl || 'https://pielarmonia.com').trim() || 'https://pielarmonia.com'}/`
        );
        url.searchParams.set('surface', normalizedSurface);
        url.searchParams.set(
            'platform',
            resolveDesktopGuidePlatform(normalizedSurface, platform)
        );

        if (normalizedSurface === 'operator') {
            applyOperatorSurfaceSearchParams(url.searchParams, {
                stationMode: normalizeStationMode(stationMode, 'free'),
                stationConsultorio: normalizeStationConsultorio(
                    stationConsultorio,
                    1
                ),
                oneTap: normalizeOneTap(oneTap, false),
            });
        } else {
            url.searchParams.delete('station');
            url.searchParams.delete('lock');
            url.searchParams.delete('one_tap');
        }

        return url.toString();
    } catch (_error) {
        return '';
    }
}
