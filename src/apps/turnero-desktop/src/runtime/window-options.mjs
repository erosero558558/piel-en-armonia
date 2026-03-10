export function shouldUseKioskMode(config) {
    return config.surface === 'kiosk' && config.launchMode === 'fullscreen';
}

export function shouldPreventDisplaySleep(config) {
    return config.surface === 'kiosk';
}

export function getBrowserWindowOptions(config, preloadPath, runtime = {}) {
    const fullscreen = config.launchMode === 'fullscreen';
    const packaged = Boolean(runtime.packaged);
    return {
        width: 1440,
        height: 960,
        minWidth: 1024,
        minHeight: 720,
        show: false,
        backgroundColor: '#0f1720',
        autoHideMenuBar: true,
        fullscreen,
        kiosk: shouldUseKioskMode(config),
        frame: !fullscreen,
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            devTools: !packaged,
            spellcheck: false,
        },
    };
}
