import {
    buildGuideUrl,
    buildPreparedSurfaceUrl,
    getDesktopTarget,
} from '../manifest.js';
import { buildQrUrl } from '../platform.js';
import {
    buildPresetSteps,
    buildPresetSummaryTitle,
    ensureInstallPreset,
} from '../state.js';

function resolveSurfaceKey(preset) {
    return preset.surface === 'kiosk' || preset.surface === 'sala_tv'
        ? preset.surface
        : 'operator';
}

function resolveTargetKey(surfaceKey, preset) {
    if (surfaceKey === 'sala_tv') {
        return 'android_tv';
    }
    return preset.platform === 'mac' ? 'mac' : 'win';
}

function getFileName(value) {
    const parts = String(value || '')
        .split('/')
        .filter(Boolean);
    return parts[parts.length - 1] || '';
}

function buildOperatorRollout(preset, appConfig, downloadTarget) {
    if (preset.surface !== 'operator' || preset.platform !== 'win') {
        return null;
    }

    const installerName =
        getFileName(downloadTarget?.url) || 'TurneroOperadorSetup.exe';
    const feedName = getFileName(downloadTarget?.feedUrl) || 'latest.yml';
    const lanes = ['c1', 'c2'].map((station) => {
        const lanePreset = {
            ...preset,
            surface: 'operator',
            platform: 'win',
            station,
            lock: true,
        };
        return {
            key: station,
            title: station === 'c2' ? 'PC 2 · C2 fijo' : 'PC 1 · C1 fijo',
            summary: `${installerName} · ${
                preset.oneTap ? '1 tecla ON' : '1 tecla OFF'
            }`,
            preparedWebUrl: buildPreparedSurfaceUrl(
                'operator',
                appConfig,
                lanePreset
            ),
            active: Boolean(preset.lock && preset.station === station),
        };
    });

    return {
        title: 'Despliegue operador Windows',
        summary: `Usa el mismo ${installerName} en las dos PCs operador. El auto-update debe quedar apuntando a ${feedName} y cada equipo se provisiona una sola vez como C1 fijo o C2 fijo.`,
        lanes,
    };
}

export function buildInstallConfiguratorViewModel(manifest, detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const surfaceKey = resolveSurfaceKey(preset);
    const appConfig = manifest[surfaceKey];
    if (!appConfig) {
        return null;
    }

    const downloadTarget =
        (appConfig.targets &&
            appConfig.targets[resolveTargetKey(surfaceKey, preset)]) ||
        getDesktopTarget(appConfig, detectedPlatform) ||
        null;
    const preparedWebUrl = buildPreparedSurfaceUrl(
        surfaceKey,
        appConfig,
        preset
    );
    const qrUrl =
        surfaceKey === 'sala_tv'
            ? buildQrUrl(
                  (downloadTarget && downloadTarget.url) || preparedWebUrl
              )
            : buildQrUrl(preparedWebUrl);
    const operatorRollout = buildOperatorRollout(
        preset,
        appConfig,
        downloadTarget
    );

    return {
        preset,
        surfaceKey,
        appConfig,
        downloadTarget,
        autoUpdateFeedUrl: String(downloadTarget?.feedUrl || ''),
        supportsAutoUpdate: Boolean(downloadTarget?.supportsAutoUpdate),
        preparedWebUrl,
        qrUrl,
        guideUrl: buildGuideUrl(surfaceKey, preset, appConfig),
        summaryTitle: buildPresetSummaryTitle(preset),
        setupSteps: buildPresetSteps(preset),
        operatorRollout,
    };
}
