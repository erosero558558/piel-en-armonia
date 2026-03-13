import {
    buildDesktopBootPageTransition,
    buildDesktopLoadSurfaceTransition,
    buildDesktopOpenSettingsTransition,
    buildDesktopRetryTransition,
} from './boot-lifecycle-state.mjs';
import {
    buildDesktopHeartbeatRequest,
    DESKTOP_HEARTBEAT_INTERVAL_MS,
    shouldRunDesktopHeartbeat,
} from './desktop-heartbeat.mjs';
import { createInitialDesktopBootStatus } from './boot-status-contract.mjs';
import { createEmptyRetryState } from './retry-state.mjs';

export function createDesktopRuntimeController({
    bootHtmlPath,
    getWindow,
    getConfig,
    getSurfaceUrl,
    getRuntimeSnapshot,
    log = () => {},
    postHeartbeat = async () => false,
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
    heartbeatIntervalMs = DESKTOP_HEARTBEAT_INTERVAL_MS,
} = {}) {
    let retryCount = 0;
    let retryTimer = null;
    let settingsMode = false;
    let firstRunPending = false;
    let heartbeatTimer = null;
    let heartbeatInFlight = false;
    let heartbeatActive = false;
    let currentRetryState = createEmptyRetryState();
    let lastBootStatus = createInitialDesktopBootStatus();

    function getRuntimeState() {
        return {
            retryCount,
            settingsMode,
            firstRunPending,
            heartbeatActive,
            heartbeatInFlight,
            currentRetryState,
            lastBootStatus,
        };
    }

    function setFirstRunPending(value) {
        firstRunPending = Boolean(value);
    }

    function clearHeartbeatTimer() {
        if (heartbeatTimer) {
            clearIntervalFn(heartbeatTimer);
            heartbeatTimer = null;
        }
    }

    async function sendDesktopHeartbeat(reason = 'interval') {
        if (heartbeatInFlight || !getConfig()) {
            return false;
        }

        const snapshot = getRuntimeSnapshot();
        if (!shouldRunDesktopHeartbeat(snapshot)) {
            return false;
        }

        const request = buildDesktopHeartbeatRequest(snapshot, {
            reason,
        });
        if (!request) {
            return false;
        }

        heartbeatInFlight = true;
        try {
            return await postHeartbeat(request);
        } catch (error) {
            log('warn', `desktop heartbeat failed: ${error.message}`);
            return false;
        } finally {
            heartbeatInFlight = false;
        }
    }

    function startDesktopHeartbeat(reason = 'boot_page') {
        clearHeartbeatTimer();
        heartbeatActive = false;

        const snapshot = getRuntimeSnapshot();
        if (!shouldRunDesktopHeartbeat(snapshot)) {
            return false;
        }

        heartbeatActive = true;
        void sendDesktopHeartbeat(reason);
        heartbeatTimer = setIntervalFn(() => {
            void sendDesktopHeartbeat('interval');
        }, heartbeatIntervalMs);
        return true;
    }

    function stopDesktopHeartbeat() {
        heartbeatActive = false;
        clearHeartbeatTimer();
    }

    function setBootStatus(payload) {
        lastBootStatus = {
            ...lastBootStatus,
            ...payload,
            at: new Date().toISOString(),
        };

        const windowRef = getWindow();
        if (windowRef && !windowRef.isDestroyed()) {
            windowRef.webContents.send('turnero:boot-status', lastBootStatus);
        }
        if (heartbeatActive) {
            void sendDesktopHeartbeat('status_change');
        }
    }

    async function loadBootPage() {
        const windowRef = getWindow();
        if (!windowRef || windowRef.isDestroyed()) {
            return false;
        }

        const transition = buildDesktopBootPageTransition({
            firstRunPending,
            lastBootStatus,
        });
        settingsMode = transition.settingsMode;
        await windowRef.loadFile(bootHtmlPath);
        startDesktopHeartbeat(transition.heartbeatReason);
        setBootStatus(transition.status);
        return true;
    }

    function clearRetryTimer() {
        if (retryTimer) {
            clearTimeoutFn(retryTimer);
            retryTimer = null;
        }
        currentRetryState = createEmptyRetryState();
    }

    function scheduleReload(reason) {
        clearRetryTimer();
        const transition = buildDesktopRetryTransition({
            retryCount,
            reason,
        });
        settingsMode = transition.settingsMode;
        currentRetryState = transition.retryState;
        retryCount = transition.retryCount;
        setBootStatus(transition.status);
        retryTimer = setTimeoutFn(() => {
            void loadSurface('retry');
        }, transition.delayMs);
        return transition;
    }

    async function loadSurface(source = 'launch') {
        const windowRef = getWindow();
        if (!windowRef || windowRef.isDestroyed()) {
            return false;
        }

        clearRetryTimer();
        stopDesktopHeartbeat();
        const transition = buildDesktopLoadSurfaceTransition(getConfig(), {
            source,
        });
        settingsMode = transition.settingsMode;
        setBootStatus(transition.status);

        try {
            await windowRef.loadURL(getSurfaceUrl());
            return true;
        } catch (error) {
            log('error', `loadURL failed: ${error.message}`);
            await loadBootPage();
            scheduleReload(
                `No se pudo abrir la superficie ${String(
                    getConfig()?.surface || 'operator'
                )}`
            );
            return false;
        }
    }

    async function openSettings(reason = 'manual') {
        clearRetryTimer();
        const transition = buildDesktopOpenSettingsTransition(getConfig(), {
            firstRun: firstRunPending,
            reason,
        });
        await loadBootPage();
        settingsMode = transition.settingsMode;
        setBootStatus(transition.status);
        return true;
    }

    function applyReadyTransition(transition) {
        if (!transition || typeof transition !== 'object') {
            return;
        }

        currentRetryState = transition.retryState || createEmptyRetryState();
        retryCount = Number(transition.retryCount || 0);
        firstRunPending = Boolean(transition.firstRunPending);
        setBootStatus(transition.status || {});
    }

    function dispose() {
        clearRetryTimer();
        stopDesktopHeartbeat();
    }

    return {
        applyReadyTransition,
        clearRetryTimer,
        dispose,
        getRuntimeState,
        getSettingsMode() {
            return settingsMode;
        },
        loadBootPage,
        loadSurface,
        openSettings,
        scheduleReload,
        sendDesktopHeartbeat,
        setBootStatus,
        setFirstRunPending,
        startDesktopHeartbeat,
        stopDesktopHeartbeat,
    };
}
