const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('turneroDesktop', {
    onBootStatus(callback) {
        if (typeof callback !== 'function') {
            return () => {};
        }
        const handler = (_event, payload) => callback(payload);
        ipcRenderer.on('turnero:boot-status', handler);
        return () => {
            ipcRenderer.removeListener('turnero:boot-status', handler);
        };
    },
    getRuntimeSnapshot() {
        return ipcRenderer.invoke('turnero:get-runtime-snapshot');
    },
    saveRuntimeConfig(payload) {
        return ipcRenderer.invoke('turnero:save-runtime-config', payload);
    },
    runPreflight(payload) {
        return ipcRenderer.invoke('turnero:run-preflight', payload);
    },
    retryLoad() {
        return ipcRenderer.invoke('turnero:retry-load');
    },
    openSurface() {
        return ipcRenderer.invoke('turnero:open-surface');
    },
    openSettings() {
        return ipcRenderer.invoke('turnero:open-settings');
    },
});
