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
    retryLoad() {
        return ipcRenderer.invoke('turnero:retry-load');
    },
});
