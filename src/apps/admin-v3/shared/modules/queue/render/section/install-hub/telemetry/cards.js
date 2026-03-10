import { DEFAULT_APP_DOWNLOADS, SURFACE_TELEMETRY_COPY } from '../constants.js';
import { buildPreparedSurfaceUrl } from '../manifest.js';
import { ensureInstallPreset } from '../state.js';
import { formatHeartbeatAge } from './format.js';
import { getSurfaceTelemetryState } from './state.js';

function buildSurfaceTelemetryChips(surfaceKey, latest) {
    if (!latest || typeof latest !== 'object') return ['Sin señal'];
    const details =
        latest.details && typeof latest.details === 'object'
            ? latest.details
            : {};
    const chips = [];
    const appMode = String(latest.appMode || '').trim();
    chips.push(
        appMode === 'desktop'
            ? 'Desktop'
            : appMode === 'android_tv'
              ? 'Android TV'
              : 'Web'
    );

    if (surfaceKey === 'operator') {
        const station = String(details.station || '').toUpperCase();
        const stationMode = String(details.stationMode || '');
        if (station)
            chips.push(
                stationMode === 'locked'
                    ? `${station} fijo`
                    : `${station} libre`
            );
        chips.push(details.oneTap ? '1 tecla ON' : '1 tecla OFF');
        chips.push(details.numpadSeen ? 'Numpad listo' : 'Numpad pendiente');
    } else if (surfaceKey === 'kiosk') {
        chips.push(details.printerPrinted ? 'Térmica OK' : 'Térmica pendiente');
        chips.push(`Offline ${Number(details.pendingOffline || 0)}`);
        chips.push(
            String(details.connection || '').toLowerCase() === 'live'
                ? 'Cola en vivo'
                : 'Cola degradada'
        );
    } else if (surfaceKey === 'display') {
        chips.push(details.bellPrimed ? 'Audio listo' : 'Audio pendiente');
        chips.push(details.bellMuted ? 'Campanilla Off' : 'Campanilla On');
        chips.push(
            String(details.connection || '').toLowerCase() === 'live'
                ? 'Sala en vivo'
                : 'Sala degradada'
        );
    }

    return chips.slice(0, 4);
}

export function buildSurfaceTelemetryCards(manifest, detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const cards = [
        {
            key: 'operator',
            appConfig: manifest.operator || DEFAULT_APP_DOWNLOADS.operator,
            fallbackSurface: 'operator',
            actionLabel: 'Abrir operador',
        },
        {
            key: 'kiosk',
            appConfig: manifest.kiosk || DEFAULT_APP_DOWNLOADS.kiosk,
            fallbackSurface: 'kiosk',
            actionLabel: 'Abrir kiosco',
        },
        {
            key: 'display',
            appConfig: manifest.sala_tv || DEFAULT_APP_DOWNLOADS.sala_tv,
            fallbackSurface: 'sala_tv',
            actionLabel: 'Abrir sala TV',
        },
    ];

    return cards.map((entry) => {
        const group = getSurfaceTelemetryState(entry.key);
        const latest =
            group.latest && typeof group.latest === 'object'
                ? group.latest
                : null;
        const effectiveState = String(group.status || 'unknown');
        const summary =
            String(group.summary || '').trim() ||
            SURFACE_TELEMETRY_COPY[entry.key]?.emptySummary ||
            'Sin señal todavía.';
        const route = buildPreparedSurfaceUrl(
            entry.fallbackSurface,
            entry.appConfig,
            { ...preset, surface: entry.fallbackSurface }
        );

        return {
            key: entry.key,
            title: SURFACE_TELEMETRY_COPY[entry.key]?.title || entry.key,
            state: ['ready', 'warning', 'alert'].includes(effectiveState)
                ? effectiveState
                : 'unknown',
            badge:
                effectiveState === 'ready'
                    ? 'En vivo'
                    : effectiveState === 'alert'
                      ? 'Atender'
                      : effectiveState === 'warning'
                        ? 'Revisar'
                        : 'Sin señal',
            deviceLabel: String(latest?.deviceLabel || 'Sin equipo reportando'),
            summary,
            ageLabel:
                latest && latest.ageSec !== undefined && latest.ageSec !== null
                    ? `Heartbeat hace ${formatHeartbeatAge(latest.ageSec)}`
                    : 'Sin heartbeat todavía',
            chips: buildSurfaceTelemetryChips(entry.key, latest),
            route,
            actionLabel: entry.actionLabel,
        };
    });
}
