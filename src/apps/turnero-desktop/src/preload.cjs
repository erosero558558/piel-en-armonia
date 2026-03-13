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
    onShellEvent(callback) {
        if (typeof callback !== 'function') {
            return () => {};
        }
        const handler = (_event, payload) => callback(payload);
        ipcRenderer.on('turnero:shell-event', handler);
        return () => {
            ipcRenderer.removeListener('turnero:shell-event', handler);
        };
    },
    getRuntimeSnapshot() {
        return ipcRenderer.invoke('turnero:get-runtime-snapshot');
    },
    getShellStatus() {
        return ipcRenderer.invoke('turnero:get-shell-status');
    },
    getOfflineSnapshot() {
        return ipcRenderer.invoke('turnero:get-offline-snapshot');
    },
    reportShellState(payload) {
        return ipcRenderer.invoke('turnero:report-shell-state', payload);
    },
    markSessionAuthenticated(payload) {
        return ipcRenderer.invoke(
            'turnero:mark-session-authenticated',
            payload
        );
    },
    saveOfflineSnapshot(payload) {
        return ipcRenderer.invoke('turnero:save-offline-snapshot', payload);
    },
    enqueueQueueAction(payload) {
        return ipcRenderer.invoke('turnero:enqueue-queue-action', payload);
    },
    flushQueueOutbox(payload) {
        return ipcRenderer.invoke('turnero:flush-queue-outbox', payload);
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
