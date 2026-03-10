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

    return {
        preset,
        surfaceKey,
        appConfig,
        downloadTarget,
        preparedWebUrl,
        qrUrl,
        guideUrl: buildGuideUrl(surfaceKey, preset, appConfig),
        summaryTitle: buildPresetSummaryTitle(preset),
        setupSteps: buildPresetSteps(preset),
    };
}
