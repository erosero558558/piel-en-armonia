import {
    buildDesktopSupportGuideUrl,
    buildDesktopUpdateMetadataUrl,
    formatDesktopPlatformLabel,
} from '../queue-shared/desktop-shell-support.mjs';
import {
    normalizeAutoStart,
    normalizeLaunchMode,
    normalizeOneTap,
    normalizeStationConsultorio,
    normalizeStationMode,
    normalizeUpdateChannel,
} from '../queue-shared/turnero-runtime-contract.mjs';

export function createEmptyOperatorShellState() {
    return {
        available: false,
        packaged: false,
        appMode: 'web',
        surface: 'operator',
        baseUrl: '',
        version: '',
        name: '',
        platform: '',
        arch: '',
        updateChannel: 'stable',
        stationMode: 'free',
        stationConsultorio: 1,
        oneTap: false,
        configPath: '',
        updateFeedUrl: '',
        updateMetadataUrl: '',
        installGuideUrl: '',
        launchMode: 'fullscreen',
        autoStart: false,
        statusPhase: '',
        statusLevel: '',
        statusMessage: '',
        statusPercent: 0,
        statusVersion: '',
    };
}

export function hydrateOperatorShellState(
    snapshot,
    { defaultName = 'Turnero Operador' } = {}
) {
    if (!snapshot || typeof snapshot !== 'object') {
        return createEmptyOperatorShellState();
    }

    return {
        available: true,
        packaged: Boolean(snapshot.packaged),
        appMode: String(
            snapshot.appMode || (snapshot.packaged ? 'packaged' : 'development')
        ),
        surface: String(snapshot?.config?.surface || 'operator'),
        baseUrl: String(snapshot?.config?.baseUrl || ''),
        version: String(snapshot.version || ''),
        name: String(snapshot.name || defaultName),
        platform: String(snapshot.platform || ''),
        arch: String(snapshot.arch || ''),
        updateChannel: normalizeUpdateChannel(
            snapshot?.config?.updateChannel,
            'stable'
        ),
        stationMode: normalizeStationMode(
            snapshot?.config?.stationMode,
            'free'
        ),
        stationConsultorio: normalizeStationConsultorio(
            snapshot?.config?.stationConsultorio,
            1
        ),
        oneTap: normalizeOneTap(snapshot?.config?.oneTap, false),
        configPath: String(snapshot.configPath || ''),
        updateFeedUrl: String(snapshot.updateFeedUrl || ''),
        updateMetadataUrl: String(snapshot.updateMetadataUrl || ''),
        installGuideUrl: String(snapshot.installGuideUrl || ''),
        launchMode: normalizeLaunchMode(snapshot?.config?.launchMode),
        autoStart: normalizeAutoStart(snapshot?.config?.autoStart, true),
        statusPhase: String(snapshot?.status?.phase || ''),
        statusLevel: String(snapshot?.status?.level || ''),
        statusMessage: String(snapshot?.status?.message || ''),
        statusPercent: Number(snapshot?.status?.percent || 0),
        statusVersion: String(
            snapshot?.status?.version || snapshot.version || ''
        ),
    };
}

export function formatOperatorShellPlatformLabel(platform) {
    return formatDesktopPlatformLabel(platform, {
        fallbackLabel: 'Web',
    });
}

export function getOperatorShellStatusPhase(shell) {
    return String(shell?.statusPhase || '')
        .trim()
        .toLowerCase();
}

export function isOperatorShellUpdateReady(shell) {
    return (
        getOperatorShellStatusPhase(shell) === 'ready' &&
        /^actualizacion lista/i.test(String(shell?.statusMessage || '').trim())
    );
}

export function getOperatorShellStatusLabel(shell) {
    if (!shell?.available) {
        return '';
    }

    const phase = getOperatorShellStatusPhase(shell);
    const message = String(shell?.statusMessage || '').trim();
    const percent = Math.max(0, Math.round(Number(shell?.statusPercent || 0)));

    if (phase === 'error' || shell?.statusLevel === 'error') {
        return 'Actualización con error';
    }
    if (phase === 'download') {
        return percent > 0
            ? `Actualización ${percent}%`
            : 'Descargando actualización';
    }
    if (isOperatorShellUpdateReady(shell)) {
        return 'Actualización lista';
    }
    if (phase === 'update' && /sin actualizaciones pendientes/i.test(message)) {
        return 'App al día';
    }
    if (phase === 'update' && /actualizacion disponible/i.test(message)) {
        return 'Actualización disponible';
    }
    if (phase === 'update' && /buscando actualizaciones/i.test(message)) {
        return 'Buscando actualización';
    }

    return '';
}

export function getOperatorShellStatusDetail(shell) {
    if (!shell?.available) {
        return '';
    }

    const phase = getOperatorShellStatusPhase(shell);
    const message = String(shell?.statusMessage || '').trim();

    if (phase === 'download' && message) {
        return message;
    }
    if (phase === 'error' || shell?.statusLevel === 'error') {
        return message || 'La actualización automática no está disponible.';
    }
    if (isOperatorShellUpdateReady(shell)) {
        return message
            ? `${message}. Se instalará al cerrar la app.`
            : 'Actualización lista. Se instalará al cerrar la app.';
    }
    if (
        phase === 'update' &&
        /buscando actualizaciones|actualizacion disponible|sin actualizaciones pendientes/i.test(
            message
        )
    ) {
        return message;
    }

    return '';
}

export function getOperatorShellModeLabel(shell) {
    if (!shell?.available) {
        return 'Usando navegador';
    }

    const baseLabel = shell.packaged
        ? 'App del equipo lista'
        : 'App del equipo en pruebas';
    const statusLabel = getOperatorShellStatusLabel(shell);
    return statusLabel ? `${baseLabel} · ${statusLabel}` : baseLabel;
}

export function getOperatorShellMetaLabel(shell) {
    if (!shell?.available) {
        return 'La app del equipo ayuda con arranque automático, actualizaciones y ajustes locales.';
    }

    const platformLabel = formatOperatorShellPlatformLabel(shell.platform);
    const launchModeLabel =
        normalizeLaunchMode(shell.launchMode) === 'windowed'
            ? 'ventana'
            : 'pantalla completa';
    const autoStartLabel = shell.autoStart
        ? 'abre sola al iniciar'
        : 'inicio manual';
    const statusDetail = getOperatorShellStatusDetail(shell);

    return `${platformLabel} · ${launchModeLabel} · ${autoStartLabel}${statusDetail ? ` · ${statusDetail}` : ''} · F10 o Ctrl/Cmd + ,`;
}

export function buildOperatorShellUpdateMetadataUrl(shell) {
    return buildDesktopUpdateMetadataUrl(shell);
}

export function getOperatorShellSupportValues(shell) {
    if (!shell?.available) {
        return [];
    }

    const values = [];
    const updateMetadataUrl = buildOperatorShellUpdateMetadataUrl(shell);
    const installGuideUrl = buildDesktopSupportGuideUrl({
        installGuideUrl: shell.installGuideUrl,
        baseUrl: shell.baseUrl,
        surface: shell.surface,
        platform: shell.platform,
        stationMode: shell.stationMode,
        stationConsultorio: shell.stationConsultorio,
        oneTap: shell.oneTap,
    });
    const configPath = String(shell.configPath || '').trim();

    if (updateMetadataUrl) {
        values.push(`Feed ${updateMetadataUrl}`);
    }
    if (installGuideUrl) {
        values.push(`Guía ${installGuideUrl}`);
    }
    if (configPath) {
        values.push(`Config ${configPath}`);
    }

    return values;
}

export function getOperatorShellSupportLabel(shell) {
    if (!shell?.available) {
        return 'La guía de instalación y la configuración local aparecerán aquí al instalar la app.';
    }

    const values = getOperatorShellSupportValues(shell);
    if (values.length === 0) {
        return 'Sin datos extra de soporte desde la app.';
    }

    return values.join(' · ');
}

export function getOperatorShellReadiness(
    shell,
    { defaultName = 'Turnero Operador' } = {}
) {
    if (!shell?.available) {
        return {
            state: 'warning',
            detail: 'Estás usando navegador. La app del equipo ayuda con arranque automático y actualizaciones.',
        };
    }

    const shellName = String(shell.name || defaultName).trim();
    const platformLabel = formatOperatorShellPlatformLabel(shell.platform);
    const version = shell.version ? ` v${shell.version}` : '';
    const updateChannel = String(shell.updateChannel || 'stable').trim();
    const channelSuffix = updateChannel ? ` · canal ${updateChannel}` : '';
    const shellIdentity = `${shellName}${version} · ${platformLabel}${channelSuffix}`;
    const statusPhase = getOperatorShellStatusPhase(shell);
    const statusLabel = getOperatorShellStatusLabel(shell);
    const statusDetail = getOperatorShellStatusDetail(shell);

    if (statusPhase === 'error' || shell.statusLevel === 'error') {
        return {
            state: 'danger',
            detail: `${statusDetail || 'La actualización automática no está disponible.'} · ${shellIdentity}`,
        };
    }
    if (statusLabel) {
        return {
            state:
                statusPhase === 'download' ||
                statusPhase === 'update' ||
                isOperatorShellUpdateReady(shell)
                    ? 'warning'
                    : 'ready',
            detail: `${statusDetail || statusLabel} · ${shellIdentity}`,
        };
    }

    if (shell.packaged) {
        return {
            state: 'ready',
            detail: `App del equipo lista · ${shellIdentity} · F10 abre configuración.`,
        };
    }

    return {
        state: 'warning',
        detail: `App del equipo en pruebas · ${shellIdentity} · valida el instalador antes del piloto.`,
    };
}

export function getOperatorShellSettingsButtonCopy(
    shell,
    { defaultName = 'Turnero Desktop' } = {}
) {
    const shellName = String(shell?.name || defaultName).trim();
    const platformLabel = formatOperatorShellPlatformLabel(shell?.platform);

    return {
        text:
            shell?.packaged && shell?.platform === 'win32'
                ? 'Configurar este equipo (F10)'
                : 'Abrir ajustes del equipo (F10)',
        title: shell?.available
            ? `Reabre la configuración local de ${shellName} (${platformLabel}). Atajos: F10 o Ctrl/Cmd + ,`
            : 'Reabre la configuración local de la app del equipo. Atajos: F10 o Ctrl/Cmd + ,',
    };
}
