import { formatDesktopPlatformLabel } from '../../../queue-shared/desktop-shell-support.mjs';
import {
    normalizeAutoStart,
    normalizeLaunchMode,
} from '../../../queue-shared/turnero-runtime-contract.mjs';
import {
    buildDesktopRuntimeSnapshotBase,
    getDesktopOperatorProfile,
    getDesktopSnapshotPhase,
    getDesktopSurfaceContext,
} from '../runtime/snapshot-contract.mjs';

function getSurfaceLabel(snapshot) {
    const surfaceLabel = String(
        snapshot?.surfaceLabel || snapshot?.config?.surface || 'Superficie'
    ).trim();
    return surfaceLabel || 'Superficie';
}

function getSurfaceDesktopLabel(snapshot) {
    const surfaceDesktopLabel = String(
        snapshot?.surfaceDesktopLabel || ''
    ).trim();
    if (surfaceDesktopLabel) {
        return surfaceDesktopLabel;
    }

    return `Turnero ${getSurfaceLabel(snapshot)}`;
}

function formatShellSummary(snapshot) {
    const surfaceDesktopLabel = getSurfaceDesktopLabel(snapshot);
    if (!snapshot || !snapshot.packaged) {
        return `${surfaceDesktopLabel} en validacion local`;
    }

    const name = String(snapshot.name || surfaceDesktopLabel).trim();
    const version = String(snapshot.version || '').trim();
    return version ? `${name} v${version}` : name;
}

function formatOpenSurfaceLabel(snapshot) {
    if (!snapshot || !snapshot.packaged) {
        return 'Abrir superficie';
    }

    const surfaceLabel = getSurfaceLabel(snapshot).toLowerCase();
    return `Abrir ${surfaceLabel} ${formatDesktopPlatformLabel(
        snapshot.platform,
        {
            fallbackLabel: 'Equipo local',
        }
    )}`;
}

function formatShellMeta(snapshot) {
    if (!snapshot) {
        return 'Sin metadata del shell.';
    }

    const platformLabel = formatDesktopPlatformLabel(snapshot.platform, {
        fallbackLabel: 'Equipo local',
    });
    const appMode = snapshot.packaged
        ? 'Desktop instalada'
        : 'Desktop en desarrollo';
    const updateChannel = String(snapshot.config?.updateChannel || 'stable');
    const configPath = String(snapshot.configPath || '').trim();
    const configSuffix = configPath ? ` · Config: ${configPath}` : '';

    return `${platformLabel} · ${appMode} · Canal ${updateChannel}${configSuffix}`;
}

function formatLaunchModeLabel(value) {
    return normalizeLaunchMode(value) === 'windowed'
        ? 'Ventana'
        : 'Pantalla completa';
}

function formatAutoStartLabel(value) {
    return normalizeAutoStart(value, true)
        ? 'Autoarranque ON'
        : 'Autoarranque OFF';
}

function formatOperatorProfile(snapshot) {
    const surfaceContext = getDesktopSurfaceContext(snapshot?.config || {});
    if (surfaceContext.surface !== 'operator') {
        return getSurfaceDesktopLabel(snapshot);
    }

    const profileLabel = surfaceContext.locked
        ? `C${surfaceContext.stationConsultorio} fijo`
        : 'Modo libre';
    const oneTapLabel = surfaceContext.oneTap ? '1 tecla ON' : '1 tecla OFF';
    return `Operador ${profileLabel} · ${oneTapLabel}`;
}

function formatProvisioningMeta(snapshot) {
    const config = snapshot?.config || {};
    return `${formatLaunchModeLabel(config.launchMode)} · ${formatAutoStartLabel(
        config.autoStart
    )}`;
}

function buildGuideUrl(snapshot) {
    return String(snapshot?.installGuideUrl || '').trim();
}

function buildFeedMetadataUrl(snapshot) {
    return String(snapshot?.updateMetadataUrl || '').trim();
}

function getSupportSummary(snapshot) {
    const shellMeta = formatShellMeta(snapshot);
    if (!snapshot?.packaged) {
        return `${shellMeta}. Usa esta tarjeta para validar la configuración local aunque el updater nativo no aplique en desarrollo.`;
    }

    return `${shellMeta}. Confirma feed, guía y perfil local antes de clonar esta desktop en otra PC.`;
}

export function getBootConfigFormView(snapshot) {
    const config = snapshot?.config || {};
    const operator = getDesktopSurfaceContext(config).surface === 'operator';

    return {
        baseUrl: String(config.baseUrl || ''),
        profile: getDesktopOperatorProfile(config),
        oneTap: Boolean(config.oneTap),
        launchMode: String(config.launchMode || 'fullscreen'),
        autoStart: config.autoStart !== false,
        operator,
    };
}

export function getBootSupportView(snapshot) {
    const runtimeSnapshot = buildDesktopRuntimeSnapshotBase(snapshot);
    return {
        summary: getSupportSummary(runtimeSnapshot),
        profile: formatOperatorProfile(runtimeSnapshot),
        provisioning: formatProvisioningMeta(runtimeSnapshot),
        feedUrl: buildFeedMetadataUrl(runtimeSnapshot),
        guideUrl: buildGuideUrl(runtimeSnapshot),
        configPath: String(runtimeSnapshot?.configPath || '').trim(),
    };
}

export function getBootShellView(snapshot) {
    const runtimeSnapshot = buildDesktopRuntimeSnapshotBase(snapshot);
    const phase = getDesktopSnapshotPhase(runtimeSnapshot);
    const firstRun = Boolean(runtimeSnapshot?.firstRun);
    const settingsMode = Boolean(runtimeSnapshot?.settingsMode);
    const runtimeMode = firstRun
        ? 'Primer arranque'
        : settingsMode
          ? 'Reconfiguracion'
          : 'Perfil persistido';
    const shellSummary = formatShellSummary(runtimeSnapshot);
    const shellMeta = formatShellMeta(runtimeSnapshot);
    const runtimeMessage = String(
        runtimeSnapshot?.message || runtimeSnapshot?.status?.message || ''
    )
        .trim()
        .replace(/[.!?]\s*$/u, '');

    return {
        title:
            phase === 'ready'
                ? 'Shell conectado'
                : firstRun || settingsMode
                  ? 'Configura este equipo'
                  : 'Inicializando shell operativo',
        message: runtimeMessage
            ? `${runtimeMessage}. ${shellSummary}.`
            : `${shellSummary}.`,
        surface: String(runtimeSnapshot?.config?.surface || '-'),
        baseUrl: String(runtimeSnapshot?.config?.baseUrl || '-'),
        phase,
        configMode: `${runtimeMode} · ${formatDesktopPlatformLabel(
            runtimeSnapshot?.platform,
            {
                fallbackLabel: 'Equipo local',
            }
        )}`,
        configHintHtml: firstRun
            ? 'Confirma este equipo antes de abrir el turnero. Mismo instalador para <code>C1</code> y <code>C2</code>; cambia solo el perfil local.'
            : `Presiona <code>F10</code> o <code>Ctrl/Cmd + ,</code> para volver a esta configuracion. ${shellMeta}`,
        openSurfaceHidden: firstRun,
        openSurfaceLabel: formatOpenSurfaceLabel(runtimeSnapshot),
        support: getBootSupportView(runtimeSnapshot),
    };
}
