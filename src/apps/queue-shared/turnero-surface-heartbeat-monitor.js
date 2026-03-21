import { buildTurneroSurfaceRuntimeWatch } from './turnero-surface-runtime-watch.js';

const SURFACE_ORDER = Object.freeze(['operator', 'kiosk', 'display']);

function normalizeSurface(surface) {
    const normalized = String(surface || '')
        .trim()
        .toLowerCase();
    return normalized === 'sala_tv' ? 'display' : normalized;
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function normalizeText(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function formatAgeLabel(ageSeconds) {
    if (!Number.isFinite(ageSeconds) || ageSeconds < 0) {
        return 'sin señal';
    }
    if (ageSeconds < 60) {
        return `${Math.round(ageSeconds)}s`;
    }
    const minutes = Math.floor(ageSeconds / 60);
    const seconds = Math.round(ageSeconds % 60);
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

function resolveRegistryEntry(surfaceRegistry, surface) {
    const normalizedRegistry = asObject(surfaceRegistry);
    return (
        normalizedRegistry[normalizeSurface(surface)] ||
        normalizedRegistry[
            normalizeSurface(surface) === 'display' ? 'sala_tv' : ''
        ] ||
        {}
    );
}

export function buildTurneroSurfaceHeartbeatMonitor({
    telemetryMap = {},
    clinicProfile = null,
    surfaceRegistry = null,
    safeModes = {},
    now = Date.now(),
} = {}) {
    const telemetry = asObject(telemetryMap);
    const runtimeSafeModes = asObject(safeModes);
    const rows = SURFACE_ORDER.map((surface) => {
        const registryEntry = resolveRegistryEntry(surfaceRegistry, surface);
        const telemetryEntry = {
            ...asObject(telemetry[surface]),
            label:
                registryEntry.label ||
                registryEntry.title ||
                asObject(telemetry[surface]).label,
            emptySummary:
                registryEntry.emptySummary ||
                asObject(telemetry[surface]).emptySummary ||
                '',
        };
        const watch = buildTurneroSurfaceRuntimeWatch({
            surface,
            telemetryEntry,
            clinicProfile,
            safeMode: runtimeSafeModes[surface],
            now,
        });

        return {
            surface,
            label: normalizeText(watch.label, surface),
            registryId: normalizeText(registryEntry.id, surface),
            guideUrl: normalizeText(registryEntry.guideUrl),
            notes: Array.isArray(registryEntry.notes)
                ? registryEntry.notes.filter(Boolean)
                : [],
            emptySummary: normalizeText(registryEntry.emptySummary),
            watch,
            ageLabel: formatAgeLabel(watch.ageSeconds),
            state: watch.state,
            heartbeatState: watch.heartbeatState,
        };
    });

    const summary = {
        healthy: rows.filter((row) => row.state === 'healthy').length,
        watch: rows.filter((row) => row.state === 'watch').length,
        fallback: rows.filter((row) => row.state === 'fallback').length,
        unknown: rows.filter((row) => row.state === 'unknown').length,
        total: rows.length,
    };

    return {
        generatedAt: new Date(Number(now) || Date.now()).toISOString(),
        rows,
        summary,
    };
}
