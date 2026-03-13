function getDesktopSurfaceToken(config = {}) {
    return (
        String(config?.surface || 'operator')
            .trim()
            .toLowerCase() || 'operator'
    );
}

function normalizeErrorMessage(error) {
    return (
        String(error?.message || error || 'Error desconocido').trim() ||
        'Error desconocido'
    );
}

export function createInitialDesktopBootStatus() {
    return {
        level: 'info',
        phase: 'boot',
        message: 'Inicializando shell desktop...',
    };
}

export function buildDesktopBootEntryStatus(
    config,
    { firstRun = false, configPath = '' } = {}
) {
    const surface = getDesktopSurfaceToken(config);
    const payload = {
        level: 'info',
        phase: 'boot',
        message: firstRun
            ? `${surface} listo para configuracion inicial.`
            : `${surface} listo para conectar.`,
    };
    const normalizedConfigPath = String(configPath || '').trim();
    if (normalizedConfigPath) {
        payload.configPath = normalizedConfigPath;
    }
    return payload;
}

export function buildDesktopLoadingStatus(config, { source = 'launch' } = {}) {
    const surface = getDesktopSurfaceToken(config);
    return {
        level: 'info',
        phase: 'loading',
        message: `Conectando ${surface} a ${String(config?.baseUrl || '').trim()} (${
            String(source || 'launch').trim() || 'launch'
        })`,
    };
}

export function buildDesktopRetryStatus(reason, { delayMs = 0 } = {}) {
    return {
        level: 'warn',
        phase: 'retry',
        message: `${String(reason || '').trim()}. Reintentando en ${Math.round(
            Number(delayMs || 0) / 1000
        )}s.`,
    };
}

export function buildDesktopSettingsStatus(
    config,
    { firstRun = false, reason = 'manual' } = {}
) {
    const surface = getDesktopSurfaceToken(config);
    return {
        level: 'info',
        phase: 'settings',
        message: firstRun
            ? `Configura ${surface} antes del primer arranque.`
            : `Configuracion del equipo abierta (${String(reason || 'manual').trim() || 'manual'}).`,
    };
}

export function buildDesktopBlockedStatus() {
    return {
        level: 'warn',
        phase: 'blocked',
        message: 'Navegacion externa bloqueada por el shell desktop.',
    };
}

export function buildDesktopReadyStatus(config, { url = '' } = {}) {
    const surface = getDesktopSurfaceToken(config);
    const payload = {
        level: 'info',
        phase: 'ready',
        message: `${surface} conectado correctamente.`,
    };
    const normalizedUrl = String(url || '').trim();
    if (normalizedUrl) {
        payload.url = normalizedUrl;
    }
    return payload;
}

export function buildDesktopConfigSavedStatus(config) {
    const surface = getDesktopSurfaceToken(config);
    return {
        level: 'info',
        phase: 'settings',
        message: `Configuracion guardada para ${surface}.`,
    };
}

export function buildDesktopUpdateDisabledStatus() {
    return {
        level: 'info',
        phase: 'update',
        message: 'Auto-update desactivado en modo desarrollo.',
    };
}

export function buildDesktopUpdateCheckFailedStatus(error) {
    return {
        level: 'warn',
        phase: 'update',
        message: `No se pudo comprobar update: ${normalizeErrorMessage(error)}`,
    };
}
