import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    app,
    BrowserWindow,
    Menu,
    ipcMain,
    powerSaveBlocker,
} from 'electron';
import { ensureRuntimeConfig } from './config/store.mjs';
import { createNavigationPolicy } from './runtime/navigation.mjs';
import {
    getBrowserWindowOptions,
    shouldPreventDisplaySleep,
    shouldUseKioskMode,
} from './runtime/window-options.mjs';
import { createUpdater } from './updater.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const preloadPath = path.join(__dirname, 'preload.cjs');
const bootHtmlPath = path.join(__dirname, 'renderer', 'boot.html');
const RETRY_DELAYS_MS = [3000, 5000, 10000, 15000];

let mainWindow = null;
let currentConfig = null;
let navigationPolicy = null;
let retryCount = 0;
let retryTimer = null;
let displaySleepBlockerId = null;
let updater = null;
let lastBootStatus = {
    level: 'info',
    phase: 'boot',
    message: 'Inicializando shell desktop...',
};

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
}

async function loadBootPage() {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }
    await mainWindow.loadFile(bootHtmlPath);
    setBootStatus(lastBootStatus);
}

function clearRetryTimer() {
    if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
    }
}

function scheduleReload(reason) {
    clearRetryTimer();
    const delay = RETRY_DELAYS_MS[Math.min(retryCount, RETRY_DELAYS_MS.length - 1)];
    retryCount += 1;
    setBootStatus({
        level: 'warn',
        phase: 'retry',
        message: `${reason}. Reintentando en ${Math.round(delay / 1000)}s.`,
    });
    retryTimer = setTimeout(() => {
        void loadSurface('retry');
    }, delay);
}

async function loadSurface(source = 'launch') {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    clearRetryTimer();
    setBootStatus({
        level: 'info',
        phase: 'loading',
        message: `Conectando ${currentConfig.surface} a ${currentConfig.baseUrl} (${source})`,
    });

    try {
        await mainWindow.loadURL(navigationPolicy.surfaceUrl);
    } catch (error) {
        log('error', `loadURL failed: ${error.message}`);
        await loadBootPage();
        scheduleReload(`No se pudo abrir la superficie ${currentConfig.surface}`);
    }
}

function attachNavigationGuards(windowRef) {
    const contents = windowRef.webContents;

    contents.on('will-navigate', (event, targetUrl) => {
        if (!navigationPolicy.isAllowedNavigation(targetUrl)) {
            event.preventDefault();
            setBootStatus({
                level: 'warn',
                phase: 'blocked',
                message: 'Navegacion externa bloqueada por el shell desktop.',
            });
        }
    });

    contents.setWindowOpenHandler(() => ({
        action: 'deny',
    }));

    contents.on('render-process-gone', async (_event, details) => {
        log('warn', `render-process-gone: ${details.reason}`);
        await loadBootPage();
        scheduleReload('La aplicacion remota se cerro de forma inesperada');
    });

    contents.on(
        'did-fail-load',
        async (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
            if (!isMainFrame) {
                return;
            }

            if (
                !validatedUrl ||
                !navigationPolicy.isAllowedNavigation(validatedUrl)
            ) {
                return;
            }

            log(
                'warn',
                `did-fail-load ${errorCode}: ${errorDescription} (${validatedUrl})`
            );
            await loadBootPage();
            scheduleReload(
                `La superficie ${currentConfig.surface} no pudo cargar (${errorDescription})`
            );
        }
    );

    contents.on('did-finish-load', () => {
        const currentUrl = contents.getURL();
        if (!navigationPolicy.isAllowedNavigation(currentUrl)) {
            return;
        }

        retryCount = 0;
        setBootStatus({
            level: 'info',
            phase: 'ready',
            message: `${currentConfig.surface} conectado correctamente.`,
            url: currentUrl,
        });
        if (shouldUseKioskMode(currentConfig)) {
            windowRef.setKiosk(true);
        } else if (currentConfig.launchMode === 'fullscreen') {
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
    currentConfig = runtime.runtimeConfig;
    navigationPolicy = createNavigationPolicy(currentConfig);

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
    setBootStatus({
        level: 'info',
        phase: 'boot',
        message: `${currentConfig.surface} listo para conectar.`,
        configPath: runtime.configPath,
    });
    await loadSurface('boot');
}

function setupUpdater() {
    if (!app.isPackaged) {
        setBootStatus({
            level: 'info',
            phase: 'update',
            message: 'Auto-update desactivado en modo desarrollo.',
        });
        return;
    }

    updater = createUpdater(currentConfig, setBootStatus, log);
    if (!updater) {
        return;
    }

    setTimeout(() => {
        updater.checkForUpdates().catch((error) => {
            setBootStatus({
                level: 'warn',
                phase: 'update',
                message: `No se pudo comprobar update: ${error.message}`,
            });
        });
    }, 6000);
}

ipcMain.handle('turnero:get-runtime-snapshot', () => ({
    config: currentConfig,
    status: lastBootStatus,
    surfaceUrl: navigationPolicy ? navigationPolicy.surfaceUrl : '',
    packaged: app.isPackaged,
    version: app.getVersion(),
    name: app.getName(),
}));

ipcMain.handle('turnero:retry-load', async () => {
    await loadBootPage();
    await loadSurface('manual-retry');
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
        if (displaySleepBlockerId !== null) {
            powerSaveBlocker.stop(displaySleepBlockerId);
            displaySleepBlockerId = null;
        }
    });
}
