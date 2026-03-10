import { MacUpdater, NsisUpdater } from 'electron-updater';
import { buildUpdateFeedUrl } from './config/contracts.mjs';

function createLogger(log) {
    return {
        info(message) {
            log('info', message);
        },
        warn(message) {
            log('warn', message);
        },
        error(message) {
            log('error', message);
        },
    };
}

export function createUpdater(config, onStatus, log) {
    if (process.platform !== 'win32' && process.platform !== 'darwin') {
        return null;
    }

    const feedUrl = buildUpdateFeedUrl(config, process.platform);
    const provider = {
        provider: 'generic',
        url: feedUrl,
        channel: config.updateChannel,
    };
    const updater =
        process.platform === 'darwin'
            ? new MacUpdater(provider)
            : new NsisUpdater(provider);

    updater.logger = createLogger(log);
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;

    updater.on('checking-for-update', () => {
        onStatus({
            level: 'info',
            phase: 'update',
            message: 'Buscando actualizaciones...',
            feedUrl,
        });
    });
    updater.on('update-available', (info) => {
        onStatus({
            level: 'info',
            phase: 'update',
            message: `Actualizacion disponible ${info.version || ''}`.trim(),
            version: info.version || '',
        });
    });
    updater.on('update-not-available', () => {
        onStatus({
            level: 'info',
            phase: 'update',
            message: 'Sin actualizaciones pendientes.',
        });
    });
    updater.on('download-progress', (progress) => {
        onStatus({
            level: 'info',
            phase: 'download',
            message: `Descargando update ${Math.round(progress.percent || 0)}%`,
            percent: Number(progress.percent || 0),
        });
    });
    updater.on('update-downloaded', (info) => {
        onStatus({
            level: 'info',
            phase: 'ready',
            message: `Actualizacion lista ${info.version || ''}`.trim(),
            version: info.version || '',
        });
    });
    updater.on('error', (error) => {
        onStatus({
            level: 'error',
            phase: 'error',
            message: `Auto-update no disponible: ${error.message}`,
        });
    });

    return updater;
}
