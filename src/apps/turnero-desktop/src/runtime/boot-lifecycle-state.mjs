import {
    buildDesktopLoadingStatus,
    buildDesktopReadyStatus,
    buildDesktopRetryStatus,
    buildDesktopSettingsStatus,
    createInitialDesktopBootStatus,
} from './boot-status-contract.mjs';
import {
    buildScheduledRetryState,
    createEmptyRetryState,
} from './retry-state.mjs';

export const DESKTOP_BOOT_RETRY_DELAYS_MS = [3000, 5000, 10000, 15000];

export function buildDesktopBootPageTransition({
    firstRunPending = false,
    lastBootStatus = null,
} = {}) {
    return {
        settingsMode: true,
        heartbeatReason: firstRunPending ? 'first_run' : 'boot_page',
        status:
            lastBootStatus && typeof lastBootStatus === 'object'
                ? { ...lastBootStatus }
                : createInitialDesktopBootStatus(),
    };
}

export function buildDesktopRetryTransition({
    retryCount = 0,
    retryDelaysMs = DESKTOP_BOOT_RETRY_DELAYS_MS,
    reason = '',
} = {}) {
    const delays =
        Array.isArray(retryDelaysMs) && retryDelaysMs.length > 0
            ? retryDelaysMs
            : DESKTOP_BOOT_RETRY_DELAYS_MS;
    const safeRetryCount = Math.max(0, Math.floor(Number(retryCount || 0)));
    const delayMs = Number(
        delays[Math.min(safeRetryCount, delays.length - 1)] || 0
    );
    const retryState = buildScheduledRetryState({
        retryCount: safeRetryCount,
        delayMs,
        reason,
    });

    return {
        settingsMode: false,
        delayMs,
        retryState,
        retryCount: retryState.attempt,
        status: buildDesktopRetryStatus(reason, {
            delayMs,
        }),
    };
}

export function buildDesktopLoadSurfaceTransition(
    config,
    { source = 'launch' } = {}
) {
    return {
        settingsMode: false,
        status: buildDesktopLoadingStatus(config, {
            source,
        }),
    };
}

export function buildDesktopOpenSettingsTransition(
    config,
    { firstRun = false, reason = 'manual' } = {}
) {
    return {
        settingsMode: true,
        status: buildDesktopSettingsStatus(config, {
            firstRun,
            reason,
        }),
    };
}

export function buildDesktopReadyTransition(config, { url = '' } = {}) {
    return {
        firstRunPending: false,
        retryCount: 0,
        retryState: createEmptyRetryState(),
        status: buildDesktopReadyStatus(config, {
            url,
        }),
    };
}
