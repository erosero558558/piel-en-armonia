import {
    normalizeTurneroSurfaceRecoveryHeartbeatState,
    normalizeTurneroSurfaceRecoveryKey,
    normalizeTurneroSurfaceRecoveryRuntimeState,
    normalizeTurneroSurfaceRecoveryStorageState,
} from './turnero-surface-contract-snapshot.js';
import { asObject, toArray, toString } from './turnero-surface-helpers.js';

function normalizeSeverity(value) {
    const normalized = toString(value).toLowerCase();
    switch (normalized) {
        case 'high':
        case 'medium':
        case 'low':
            return normalized;
        default:
            return 'low';
    }
}

function severityRank(severity) {
    switch (normalizeSeverity(severity)) {
        case 'high':
            return 3;
        case 'medium':
            return 2;
        default:
            return 1;
    }
}

function pushFlag(flags, flag) {
    if (!flag || typeof flag !== 'object') {
        return;
    }

    const normalized = {
        key: toString(flag.key || flag.id || flag.scope || 'flag'),
        scope: toString(flag.scope || flag.key || 'surface'),
        label: toString(flag.label || flag.key || 'Flag'),
        state: toString(flag.state || 'watch'),
        severity: normalizeSeverity(flag.severity || 'low'),
        detail: toString(flag.detail || ''),
    };

    if (!normalized.key) {
        return;
    }

    flags.push(normalized);
}

function summarizeFlags(flags) {
    return flags
        .slice(0, 4)
        .map((flag) => `${flag.label}: ${flag.detail || flag.state}`)
        .join(' · ');
}

function resolveOverallState(flags) {
    if (flags.some((flag) => flag.severity === 'high')) {
        return 'blocked';
    }
    if (flags.some((flag) => flag.severity === 'medium')) {
        return 'degraded';
    }
    if (flags.some((flag) => flag.severity === 'low')) {
        return 'watch';
    }
    return 'aligned';
}

function resolveSummary(state, primaryFlag, openActionCount) {
    if (state === 'blocked') {
        return `Recuperacion bloqueada por ${primaryFlag?.label || 'drift de contrato'}.`;
    }
    if (state === 'degraded') {
        return `Recuperacion degradada por ${primaryFlag?.label || 'drift operativo'}.`;
    }
    if (state === 'watch') {
        return openActionCount > 0
            ? `${openActionCount} accion(es) abiertas bajo observacion.`
            : 'Recuperacion bajo observacion.';
    }
    return 'Sin drift visible.';
}

export function buildTurneroSurfaceContractDrift(input = {}) {
    const snapshot = asObject(input.snapshot);
    const contract = asObject(snapshot.contract);
    const readiness = asObject(snapshot.readiness);
    const profile = asObject(snapshot.profile);
    const storage = asObject(snapshot.storage);
    const runtime = asObject(snapshot.runtime);
    const heartbeat = asObject(snapshot.heartbeat);
    const actions = Array.isArray(input.actions)
        ? input.actions
        : Array.isArray(snapshot.actions)
          ? snapshot.actions
          : [];
    const openActionCount =
        Number(snapshot.openActionCount || 0) ||
        actions.filter((action) => {
            const state = toString(action?.state).toLowerCase();
            return !['closed', 'resolved', 'dismissed'].includes(state);
        }).length;
    const flags = [];

    if (contract.state === 'alert') {
        pushFlag(flags, {
            key: 'contract',
            scope: 'profile',
            label: 'Contract',
            severity: 'high',
            state: 'blocked',
            detail: contract.detail || 'Contrato de superficie fuera de canon.',
        });
    }

    if (contract.reason === 'profile_missing') {
        pushFlag(flags, {
            key: 'profile_missing',
            scope: 'profile',
            label: 'Profile',
            severity: 'high',
            state: 'blocked',
            detail: 'clinic-profile.json remoto ausente.',
        });
    } else if (profile.source && profile.source !== 'remote') {
        pushFlag(flags, {
            key: 'profile_source',
            scope: 'profile',
            label: 'Profile',
            severity: 'high',
            state: 'blocked',
            detail: `Source activo: ${profile.source}.`,
        });
    }

    if (contract.reason === 'route_mismatch') {
        pushFlag(flags, {
            key: 'route_mismatch',
            scope: 'profile',
            label: 'Route',
            severity: 'high',
            state: 'blocked',
            detail: `Ruta activa ${contract.currentRoute || 'sin ruta'} no coincide con ${contract.expectedRoute || 'sin canon'}.`,
        });
    }

    if (readiness.state === 'alert') {
        pushFlag(flags, {
            key: 'readiness_alert',
            scope: 'profile',
            label: 'Readiness',
            severity: 'high',
            state: 'blocked',
            detail: readiness.summary || 'Readiness bloqueada.',
        });
    } else if (toArray(readiness.warnings).length > 0) {
        pushFlag(flags, {
            key: 'readiness_warning',
            scope: 'profile',
            label: 'Readiness',
            severity: 'low',
            state: 'watch',
            detail: readiness.summary || 'Readiness con avisos.',
        });
    }

    const storageState = normalizeTurneroSurfaceRecoveryStorageState(
        storage.state,
        openActionCount
    );
    if (storage.available === false) {
        pushFlag(flags, {
            key: 'storage_unavailable',
            scope: 'storage',
            label: 'Storage',
            severity: 'medium',
            state: 'degraded',
            detail: 'localStorage no disponible o no escribible.',
        });
    } else if (storageState === 'degraded') {
        pushFlag(flags, {
            key: 'storage_degraded',
            scope: 'storage',
            label: 'Storage',
            severity: 'medium',
            state: 'degraded',
            detail: storage.summary || 'Storage degradado.',
        });
    }

    const runtimeState = normalizeTurneroSurfaceRecoveryRuntimeState(
        runtime.state ||
            runtime.mode ||
            runtime.connectivity ||
            runtime.status ||
            ''
    );
    if (runtimeState === 'blocked') {
        pushFlag(flags, {
            key: 'runtime_blocked',
            scope: 'runtime',
            label: 'Runtime',
            severity: 'high',
            state: 'blocked',
            detail: runtime.summary || 'Runtime bloqueado.',
        });
    } else if (runtimeState === 'degraded') {
        pushFlag(flags, {
            key: 'runtime_degraded',
            scope: 'runtime',
            label: 'Runtime',
            severity: 'medium',
            state: 'degraded',
            detail: runtime.summary || 'Runtime degradado.',
        });
    } else if (runtimeState === 'watch') {
        pushFlag(flags, {
            key: 'runtime_watch',
            scope: 'runtime',
            label: 'Runtime',
            severity: 'low',
            state: 'watch',
            detail: runtime.summary || 'Runtime en observacion.',
        });
    }

    const heartbeatState = normalizeTurneroSurfaceRecoveryHeartbeatState(
        heartbeat.state || heartbeat.status || heartbeat.effectiveStatus || ''
    );
    if (heartbeatState === 'blocked') {
        pushFlag(flags, {
            key: 'heartbeat_blocked',
            scope: 'heartbeat',
            label: 'Heartbeat',
            severity: 'medium',
            state: 'degraded',
            detail: heartbeat.summary || 'Heartbeat bloqueado.',
        });
    } else if (heartbeatState === 'degraded') {
        pushFlag(flags, {
            key: 'heartbeat_degraded',
            scope: 'heartbeat',
            label: 'Heartbeat',
            severity: 'medium',
            state: 'degraded',
            detail: heartbeat.summary || 'Heartbeat degradado.',
        });
    } else if (heartbeatState === 'watch') {
        pushFlag(flags, {
            key: 'heartbeat_watch',
            scope: 'heartbeat',
            label: 'Heartbeat',
            severity: 'low',
            state: 'watch',
            detail: heartbeat.summary || 'Heartbeat en observacion.',
        });
    }

    if (openActionCount > 0) {
        pushFlag(flags, {
            key: 'open_actions',
            scope: 'actions',
            label: 'Actions',
            severity: openActionCount > 2 ? 'medium' : 'low',
            state: openActionCount > 2 ? 'degraded' : 'watch',
            detail: `${openActionCount} accion(es) abiertas.`,
        });
    }

    const severity = flags.reduce(
        (highest, flag) =>
            severityRank(flag.severity) > severityRank(highest)
                ? flag.severity
                : highest,
        'low'
    );
    const state = resolveOverallState(flags);
    const primaryFlag =
        flags.slice().sort((left, right) => {
            const rankDelta =
                severityRank(right.severity) - severityRank(left.severity);
            if (rankDelta !== 0) {
                return rankDelta;
            }
            return left.label.localeCompare(right.label);
        })[0] || null;

    return {
        surfaceKey: normalizeTurneroSurfaceRecoveryKey(
            snapshot.surfaceKey || input.surfaceKey || 'operator'
        ),
        surfaceLabel: toString(
            snapshot.surfaceLabel || snapshot.profile?.surfaceLabel || ''
        ),
        severity,
        state,
        driftFlags: flags,
        primaryFlag,
        summary: resolveSummary(state, primaryFlag, openActionCount),
        detail: summarizeFlags(flags),
        openActionCount,
        generatedAt: new Date().toISOString(),
    };
}

export const buildTurneroSurfaceRecoveryDrift =
    buildTurneroSurfaceContractDrift;
