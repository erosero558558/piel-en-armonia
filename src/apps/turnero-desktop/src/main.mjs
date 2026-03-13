import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, Menu, ipcMain, powerSaveBlocker } from 'electron';
import { ensureRuntimeConfig, persistRuntimeConfig } from './config/store.mjs';
import {
    buildSupportGuideUrl,
    buildUpdateFeedUrl,
    buildUpdateMetadataUrl,
    mergeRuntimeConfig,
} from './config/contracts.mjs';
import { createNavigationPolicy } from './runtime/navigation.mjs';
import { runPreflightChecks } from './runtime/preflight.mjs';
import {
    getBrowserWindowOptions,
    shouldPreventDisplaySleep,
} from './runtime/window-options.mjs';
import {
    buildDesktopHeartbeatEndpoint,
    buildDesktopHeartbeatPayload,
    DESKTOP_HEARTBEAT_INTERVAL_MS,
    shouldRunDesktopHeartbeat,
} from './runtime/desktop-heartbeat.mjs';
import { createShellStateStore } from './runtime/shell-state.mjs';
import { createEmptyRetryState } from './runtime/retry-state.mjs';
import {
    buildDesktopBootEntryStatus,
    buildDesktopConfigSavedStatus,
    buildDesktopUpdateCheckFailedStatus,
    buildDesktopUpdateDisabledStatus,
    createInitialDesktopBootStatus,
} from './runtime/boot-status-contract.mjs';
import {
    buildDesktopBootPageTransition,
    buildDesktopLoadSurfaceTransition,
    buildDesktopOpenSettingsTransition,
    buildDesktopRetryTransition,
} from './runtime/boot-lifecycle-state.mjs';
import { buildDesktopRuntimeSnapshotBase } from './runtime/snapshot-contract.mjs';
import {
    getDesktopBlockedNavigationDecision,
    getDesktopDidFailLoadRecovery,
    getDesktopDidFinishLoadDecision,
    getDesktopRenderProcessGoneRecovery,
    shouldOpenDesktopSettingsShortcut,
} from './runtime/navigation-guard-policy.mjs';
import { createUpdater } from './updater.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const preloadPath = path.join(__dirname, 'preload.cjs');
const bootHtmlPath = path.join(__dirname, 'renderer', 'boot.html');

let mainWindow = null;
let currentRuntime = null;
let currentConfig = null;
let navigationPolicy = null;
let retryCount = 0;
let retryTimer = null;
let displaySleepBlockerId = null;
let updater = null;
let settingsMode = false;
let firstRunPending = false;
let desktopHeartbeatTimer = null;
let desktopHeartbeatInFlight = false;
let desktopHeartbeatActive = false;
let shellStateStore = null;
let currentRetryState = createEmptyRetryState();
let lastBootStatus = createInitialDesktopBootStatus();

function getRuntimeSnapshot() {
    const packaged = app.isPackaged;
    const supportsNativeUpdate =
        process.platform === 'win32' || process.platform === 'darwin';
    return buildDesktopRuntimeSnapshotBase({
        config: currentConfig,
        status: lastBootStatus,
        surfaceUrl: navigationPolicy ? navigationPolicy.surfaceUrl : '',
        packaged,
        platform: process.platform,
        arch: process.arch,
        version: app.getVersion(),
        name: app.getName(),
        configPath: currentRuntime ? currentRuntime.configPath : '',
        retry: currentRetryState,
        updateFeedUrl:
            supportsNativeUpdate && currentConfig
                ? buildUpdateFeedUrl(currentConfig, process.platform)
                : '',
        updateMetadataUrl:
            supportsNativeUpdate && currentConfig
                ? buildUpdateMetadataUrl(currentConfig, process.platform)
                : '',
        installGuideUrl:
            currentConfig && currentConfig.baseUrl
                ? buildSupportGuideUrl(currentConfig, process.platform)
                : '',
        firstRun: firstRunPending,
        settingsMode,
    });
}

function log(level, message) {
    const prefix = `[turnero-desktop:${level}]`;
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
        prefix,
        message
    );
}

function setBootStatus(payload) {
    lastBootStatus = {
        ...lastBootStatus,
        ...payload,
        at: new Date().toISOString(),
    };
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('turnero:boot-status', lastBootStatus);
    }
    if (desktopHeartbeatActive) {
        void sendDesktopHeartbeat('status_change');
    }
}

function emitShellSnapshot() {
    if (!mainWindow || mainWindow.isDestroyed() || !shellStateStore) {
        return;
    }

    mainWindow.webContents.send('turnero:shell-event', {
        status: shellStateStore.getStatus(),
        ...shellStateStore.getOfflineSnapshot(),
    });
}

function clearDesktopHeartbeatTimer() {
    if (desktopHeartbeatTimer) {
        clearInterval(desktopHeartbeatTimer);
        desktopHeartbeatTimer = null;
    }
}

async function sendDesktopHeartbeat(reason = 'interval') {
    if (desktopHeartbeatInFlight || !currentConfig) {
        return false;
    }

    const snapshot = getRuntimeSnapshot();
    if (!shouldRunDesktopHeartbeat(snapshot)) {
        return false;
    }

    const endpoint = buildDesktopHeartbeatEndpoint(snapshot);
    const payload = buildDesktopHeartbeatPayload(snapshot, {
        reason,
    });
    if (!endpoint || !payload) {
        return false;
    }

    desktopHeartbeatInFlight = true;
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        return response.ok;
    } catch (error) {
        log('warn', `desktop heartbeat failed: ${error.message}`);
        return false;
    } finally {
        desktopHeartbeatInFlight = false;
    }
}

function startDesktopHeartbeat(reason = 'boot_page') {
    clearDesktopHeartbeatTimer();
    desktopHeartbeatActive = false;

    const snapshot = getRuntimeSnapshot();
    if (!shouldRunDesktopHeartbeat(snapshot)) {
        return;
    }

    desktopHeartbeatActive = true;
    void sendDesktopHeartbeat(reason);
    desktopHeartbeatTimer = setInterval(() => {
        void sendDesktopHeartbeat('interval');
    }, DESKTOP_HEARTBEAT_INTERVAL_MS);
}

function stopDesktopHeartbeat() {
    desktopHeartbeatActive = false;
    clearDesktopHeartbeatTimer();
}

async function loadBootPage() {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }
    const transition = buildDesktopBootPageTransition({
        firstRunPending,
        lastBootStatus,
    });
    settingsMode = transition.settingsMode;
    await mainWindow.loadFile(bootHtmlPath);
    startDesktopHeartbeat(transition.heartbeatReason);
    setBootStatus(transition.status);
}

function clearRetryTimer() {
    if (retryTimer) {
        clearTimeout(retryTimer);
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
    retryTimer = setTimeout(() => {
        void loadSurface('retry');
    }, transition.delayMs);
}

async function loadSurface(source = 'launch') {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    clearRetryTimer();
    stopDesktopHeartbeat();
    const transition = buildDesktopLoadSurfaceTransition(currentConfig, {
        source,
    });
    settingsMode = transition.settingsMode;
    setBootStatus(transition.status);

    try {
        await mainWindow.loadURL(navigationPolicy.surfaceUrl);
    } catch (error) {
        log('error', `loadURL failed: ${error.message}`);
        shellStateStore?.reportShellState({
            connectivity: 'offline',
        });
        await loadBootPage();
        scheduleReload(
            `No se pudo abrir la superficie ${currentConfig.surface}`
        );
    }
}

async function openSettings(reason = 'manual') {
    clearRetryTimer();
    const transition = buildDesktopOpenSettingsTransition(currentConfig, {
        firstRun: firstRunPending,
        reason,
    });
    await loadBootPage();
    settingsMode = transition.settingsMode;
    setBootStatus(transition.status);
}

function attachNavigationGuards(windowRef) {
    const contents = windowRef.webContents;

    contents.on('will-navigate', (event, targetUrl) => {
        const decision = getDesktopBlockedNavigationDecision({
            targetUrl,
            isAllowedNavigation:
                navigationPolicy.isAllowedNavigation(targetUrl),
        });
        if (decision) {
            event.preventDefault();
            setBootStatus(decision.status);
        }
    });

    contents.setWindowOpenHandler(() => ({
        action: 'deny',
    }));

    contents.on('before-input-event', (event, input) => {
        if (!shouldOpenDesktopSettingsShortcut(input)) {
            return;
        }

        event.preventDefault();
        void openSettings('shortcut');
    });

    contents.on('render-process-gone', async (_event, details) => {
        const recovery = getDesktopRenderProcessGoneRecovery(details);
        log('warn', recovery.logMessage);
        await loadBootPage();
        scheduleReload(recovery.retryReason);
    });

    contents.on(
        'did-fail-load',
        async (
            _event,
            errorCode,
            errorDescription,
            validatedUrl,
            isMainFrame
        ) => {
            const recovery = getDesktopDidFailLoadRecovery({
                errorCode,
                errorDescription,
                validatedUrl,
                isMainFrame,
                isAllowedNavigation:
                    Boolean(validatedUrl) &&
                    navigationPolicy.isAllowedNavigation(validatedUrl),
                config: currentConfig,
            });
            if (!recovery) {
                return;
            }

            log('warn', recovery.logMessage);
            shellStateStore?.reportShellState({
                connectivity: 'offline',
            });
            await loadBootPage();
            scheduleReload(recovery.retryReason);
        }
    );

    contents.on('did-finish-load', () => {
        const currentUrl = contents.getURL();
        const decision = getDesktopDidFinishLoadDecision({
            currentUrl,
            isAllowedNavigation:
                navigationPolicy.isAllowedNavigation(currentUrl),
            config: currentConfig,
        });
        if (!decision) {
            return;
        }

        const transition = decision.transition;
        currentRetryState = transition.retryState;
        retryCount = transition.retryCount;
        firstRunPending = transition.firstRunPending;
        shellStateStore?.reportShellState({
            connectivity: 'online',
        });
        setBootStatus(transition.status);
        if (decision.presentation === 'kiosk') {
            windowRef.setKiosk(true);
        } else if (decision.presentation === 'fullscreen') {
            windowRef.setFullScreen(true);
        }
        windowRef.show();
        windowRef.focus();
    });
}

function applyAutoStart(config) {
    app.setLoginItemSettings({
        openAtLogin: Boolean(config.autoStart),
        openAsHidden: false,
    });
}

function applyDisplaySleepPolicy(config) {
    if (displaySleepBlockerId !== null) {
        powerSaveBlocker.stop(displaySleepBlockerId);
        displaySleepBlockerId = null;
    }

    if (shouldPreventDisplaySleep(config)) {
        displaySleepBlockerId = powerSaveBlocker.start('prevent-display-sleep');
    }
}

async function createMainWindow() {
    const runtime = ensureRuntimeConfig(app);
    currentRuntime = runtime;
    currentConfig = runtime.runtimeConfig;
    navigationPolicy = createNavigationPolicy(currentConfig);
    firstRunPending = Boolean(runtime.firstRun);
    shellStateStore = createShellStateStore(
        path.join(app.getPath('userData'), 'turnero-shell-state.json'),
        () =>
            currentConfig ||
            currentRuntime?.runtimeConfig ||
            runtime.runtimeConfig
    );
    shellStateStore.subscribe(() => {
        emitShellSnapshot();
    });

    mainWindow = new BrowserWindow(
        getBrowserWindowOptions(currentConfig, preloadPath, {
            packaged: app.isPackaged,
        })
    );
    mainWindow.removeMenu();

    attachNavigationGuards(mainWindow);
    applyAutoStart(currentConfig);
    applyDisplaySleepPolicy(currentConfig);

    await loadBootPage();
    mainWindow.show();
    setBootStatus(
        buildDesktopBootEntryStatus(currentConfig, {
            firstRun: firstRunPending,
            configPath: runtime.configPath,
        })
    );
    emitShellSnapshot();
    if (firstRunPending) {
        await openSettings('first-run');
        return;
    }

    await loadSurface('boot');
}

function setupUpdater() {
    if (!app.isPackaged) {
        setBootStatus(buildDesktopUpdateDisabledStatus());
        return;
    }

    updater = createUpdater(currentConfig, setBootStatus, log);
    if (!updater) {
        return;
    }

    setTimeout(() => {
        updater.checkForUpdates().catch((error) => {
            setBootStatus(buildDesktopUpdateCheckFailedStatus(error));
        });
    }, 6000);
}

ipcMain.handle('turnero:get-runtime-snapshot', () => ({
    ...getRuntimeSnapshot(),
    shellStatus: shellStateStore?.getStatus() || null,
}));

ipcMain.handle('turnero:run-preflight', async (_event, payload = {}) => {
    if (!currentRuntime) {
        throw new Error('Runtime config no inicializado');
    }

    const nextConfig = mergeRuntimeConfig(
        currentRuntime.buildConfig,
        payload && typeof payload === 'object'
            ? {
                  ...currentConfig,
                  ...payload,
              }
            : currentConfig
    );

    return runPreflightChecks(nextConfig, {
        packaged: app.isPackaged,
    });
});

ipcMain.handle('turnero:retry-load', async () => {
    await loadBootPage();
    await loadSurface('manual-retry');
    return true;
});

ipcMain.handle('turnero:save-runtime-config', async (_event, payload = {}) => {
    if (!currentRuntime) {
        throw new Error('Runtime config no inicializado');
    }

    const nextConfig = persistRuntimeConfig(
        currentRuntime.configPath,
        currentRuntime.buildConfig,
        payload && typeof payload === 'object' ? payload : {}
    );

    currentRuntime = {
        ...currentRuntime,
        runtimeConfig: nextConfig,
        firstRun: false,
    };
    currentConfig = nextConfig;
    navigationPolicy = createNavigationPolicy(currentConfig);
    firstRunPending = false;

    applyAutoStart(currentConfig);
    applyDisplaySleepPolicy(currentConfig);

    setBootStatus(buildDesktopConfigSavedStatus(currentConfig));
    emitShellSnapshot();

    return {
        ...getRuntimeSnapshot(),
        shellStatus: shellStateStore?.getStatus() || null,
    };
});

ipcMain.handle(
    'turnero:get-shell-status',
    () => shellStateStore?.getStatus() || null
);

ipcMain.handle(
    'turnero:get-offline-snapshot',
    () => shellStateStore?.getOfflineSnapshot() || null
);

ipcMain.handle(
    'turnero:report-shell-state',
    (_event, payload = {}) =>
        shellStateStore?.reportShellState(
            payload && typeof payload === 'object' ? payload : {}
        ) || null
);

ipcMain.handle(
    'turnero:mark-session-authenticated',
    (_event, payload = {}) =>
        shellStateStore?.markSessionAuthenticated(
            payload && typeof payload === 'object' ? payload : {}
        ) || null
);

ipcMain.handle(
    'turnero:save-offline-snapshot',
    (_event, payload = {}) =>
        shellStateStore?.saveOfflineSnapshot(
            payload && typeof payload === 'object' ? payload : {}
        ) || null
);

ipcMain.handle(
    'turnero:enqueue-queue-action',
    (_event, payload = {}) =>
        shellStateStore?.enqueueQueueAction(
            payload && typeof payload === 'object' ? payload : {}
        ) || null
);

ipcMain.handle(
    'turnero:flush-queue-outbox',
    (_event, payload = {}) =>
        shellStateStore?.flushQueueOutbox(
            payload && typeof payload === 'object' ? payload : {}
        ) || null
);

ipcMain.handle('turnero:open-surface', async () => {
    await loadSurface(settingsMode ? 'settings-open' : 'manual-open');
    return true;
});

ipcMain.handle('turnero:open-settings', async () => {
    await openSettings('renderer');
    return true;
});

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
    app.quit();
} else {
    app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
    app.commandLine.appendSwitch('disable-renderer-backgrounding');

    app.on('second-instance', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }
            mainWindow.focus();
        }
    });

    app.whenReady().then(async () => {
        Menu.setApplicationMenu(null);
        await createMainWindow();
        setupUpdater();
    });

    app.on('activate', async () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            await createMainWindow();
        }
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    app.on('before-quit', () => {
        clearRetryTimer();
        stopDesktopHeartbeat();
        if (displaySleepBlockerId !== null) {
            powerSaveBlocker.stop(displaySleepBlockerId);
            displaySleepBlockerId = null;
        }
    });
}
