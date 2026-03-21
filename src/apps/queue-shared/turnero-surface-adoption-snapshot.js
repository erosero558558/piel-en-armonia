import { normalizeTurneroSurfaceRecoveryKey } from './turnero-surface-contract-snapshot.js';
import {
    asObject,
    normalizePathToken,
    toArray,
    toString,
} from './turnero-surface-helpers.js';

const SURFACE_META = Object.freeze({
    operator: {
        surfaceId: 'operator',
        role: 'operator',
        roleLabel: 'Operador',
        handoffMode: 'guided',
        fallbackRoute: '/operador-turnos.html',
    },
    kiosk: {
        surfaceId: 'kiosk',
        role: 'frontdesk',
        roleLabel: 'Recepcion',
        handoffMode: 'manual',
        fallbackRoute: '/kiosco-turnos.html',
    },
    display: {
        surfaceId: 'sala_tv',
        role: 'display',
        roleLabel: 'Pantalla',
        handoffMode: 'broadcast',
        fallbackRoute: '/sala-turnos.html',
    },
});

function normalizeState(value, fallback = 'watch') {
    const normalized = toString(value, fallback).toLowerCase();
    switch (normalized) {
        case 'ready':
        case 'watch':
        case 'degraded':
        case 'blocked':
            return normalized;
        case 'aligned':
        case 'healthy':
        case 'live':
        case 'success':
            return 'ready';
        case 'warning':
        case 'pending':
        case 'safe':
            return 'watch';
        case 'offline':
        case 'fallback':
        case 'error':
        case 'failure':
            return 'degraded';
        default:
            return fallback;
    }
}

function normalizeScope(value) {
    return toString(value, 'regional') || 'regional';
}

function resolveSurfaceMeta(surfaceKey) {
    return (
        SURFACE_META[surfaceKey] || {
            surfaceId: surfaceKey,
            role: surfaceKey,
            roleLabel: surfaceKey,
            handoffMode: 'manual',
            fallbackRoute: '',
        }
    );
}

function buildFallbackSurfaceDefinition(surfaceKey, meta) {
    return {
        id: toString(meta.surfaceId, surfaceKey),
        key: toString(meta.surfaceId, surfaceKey),
        route: toString(meta.fallbackRoute, ''),
        webFallbackUrl: toString(meta.fallbackRoute, ''),
        productName: toString(meta.roleLabel, surfaceKey),
        catalog: {
            title: toString(meta.roleLabel, surfaceKey),
        },
        ops: {
            installHub: {
                title: toString(meta.roleLabel, surfaceKey),
            },
        },
    };
}

function resolveSurfaceDefinition(registry, surfaceKey, meta) {
    const surfaces = toArray(registry?.surfaces);
    if (!surfaces.length) {
        return buildFallbackSurfaceDefinition(surfaceKey, meta);
    }

    const match =
        surfaces.find((surface) => {
            const source = asObject(surface);
            const normalizedSurfaceKey = normalizeTurneroSurfaceRecoveryKey(
                source.id || source.key || source.surfaceKey || ''
            );
            return normalizedSurfaceKey === surfaceKey;
        }) || null;

    return match || buildFallbackSurfaceDefinition(surfaceKey, meta);
}

function resolveSurfaceLabel(definition, meta, surfaceKey) {
    const source = asObject(definition);
    return toString(
        source.productName ||
            source.catalog?.title ||
            source.ops?.installHub?.title ||
            source.name ||
            meta.roleLabel ||
            surfaceKey
    );
}

function resolveExpectedRoute(definition, meta) {
    const source = asObject(definition);
    return toString(
        source.route ||
            source.webFallbackUrl ||
            source.path ||
            meta.fallbackRoute
    );
}

function resolveCurrentRoute(input = {}) {
    const raw = toString(input.currentRoute || input.route);
    if (raw) {
        return raw;
    }

    if (
        typeof window !== 'undefined' &&
        window.location &&
        typeof window.location.pathname === 'string'
    ) {
        return `${window.location.pathname || ''}${window.location.search || ''}${
            window.location.hash || ''
        }`;
    }

    return '';
}

function normalizeRuntimeState(input = {}) {
    const source = asObject(input);
    const state = normalizeState(
        source.state || source.status || source.runtimeState || '',
        'watch'
    );
    const summary = toString(
        source.summary,
        state === 'ready'
            ? 'Runtime listo.'
            : state === 'watch'
              ? 'Runtime en observacion.'
              : state === 'degraded'
                ? 'Runtime degradado.'
                : 'Runtime bloqueado.'
    );

    return {
        state,
        summary,
        online:
            typeof source.online === 'boolean'
                ? source.online
                : source.connectivity !== 'offline',
        connectivity: toString(
            source.connectivity,
            source.online === false ? 'offline' : 'online'
        ),
        mode: toString(source.mode, 'live'),
        reason: toString(source.reason, ''),
        details:
            source.details && typeof source.details === 'object'
                ? { ...source.details }
                : {},
    };
}

function normalizeEvidenceEntry(entry = {}, fallbackSurfaceKey = 'operator') {
    const source = asObject(entry);
    const surfaceKey = normalizeTurneroSurfaceRecoveryKey(
        source.surfaceKey || source.surface || fallbackSurfaceKey
    );
    const createdAt = toString(
        source.createdAt || source.created_at || source.updatedAt || source.at,
        new Date().toISOString()
    );
    const updatedAt = toString(
        source.updatedAt || source.updated_at,
        createdAt
    );
    const kind = toString(
        source.kind || source.type || 'training'
    ).toLowerCase();

    return {
        id:
            toString(source.id) ||
            `${surfaceKey}-${kind}-${createdAt}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,
        scope: normalizeScope(source.scope),
        surfaceKey,
        kind:
            kind === 'manual_handoff' || kind === 'handoff' || kind === 'manual'
                ? 'manual_handoff'
                : kind === 'ack' || kind === 'acknowledgement'
                  ? 'ack'
                  : 'training',
        title: toString(
            source.title ||
                source.label ||
                (kind === 'manual_handoff'
                    ? 'Manual handoff evidence'
                    : kind === 'ack' || kind === 'acknowledgement'
                      ? 'Operator acknowledgement'
                      : 'Training readiness')
        ),
        detail: toString(source.detail || source.note || ''),
        owner: toString(source.owner || source.actor || 'ops'),
        state: toString(source.state, 'recorded') || 'recorded',
        source: toString(source.source || 'manual'),
        createdAt,
        updatedAt,
        at: toString(source.at, createdAt),
        meta:
            source.meta && typeof source.meta === 'object'
                ? { ...source.meta }
                : {},
    };
}

function sortEntries(entries) {
    return [...entries].sort((left, right) => {
        const leftTime = Date.parse(
            String(left.updatedAt || left.createdAt || '')
        );
        const rightTime = Date.parse(
            String(right.updatedAt || right.createdAt || '')
        );
        const safeLeft = Number.isFinite(leftTime) ? leftTime : 0;
        const safeRight = Number.isFinite(rightTime) ? rightTime : 0;
        return (
            safeRight - safeLeft ||
            String(right.id).localeCompare(String(left.id))
        );
    });
}

function buildTrainingSummary(entries) {
    const trainingCount = entries.filter(
        (entry) => entry.kind === 'training'
    ).length;
    const manualHandoffCount = entries.filter(
        (entry) => entry.kind === 'manual_handoff'
    ).length;

    return {
        total: entries.length,
        training: trainingCount,
        manualHandoff: manualHandoffCount,
        lastAt: entries[0] ? entries[0].updatedAt || entries[0].createdAt : '',
        summary:
            entries.length === 0
                ? 'Sin evidencia de training.'
                : `${trainingCount} training · ${manualHandoffCount} manual handoff`,
    };
}

function buildAckSummary(entries) {
    return {
        total: entries.length,
        lastAt: entries[0] ? entries[0].updatedAt || entries[0].createdAt : '',
        summary:
            entries.length === 0
                ? 'Sin acknowledgements.'
                : `${entries.length} acknowledgement(s)`,
    };
}

function buildChecklist(snapshot) {
    const truthAligned = snapshot.truth.state === 'aligned';
    const routeChecked = snapshot.routeChecked !== false;
    const runtimeReady = snapshot.runtime.state === 'ready';
    const trainingReady = snapshot.training.training > 0;
    const manualHandoffReady = snapshot.training.manualHandoff > 0;
    const ackReady = snapshot.acknowledgements.total > 0;

    const items = [
        {
            key: 'truth',
            label: 'Truth aligned',
            pass: truthAligned,
        },
        {
            key: 'route',
            label: 'Route matched',
            pass: routeChecked,
        },
        {
            key: 'runtime',
            label: 'Runtime ready',
            pass: runtimeReady,
        },
        {
            key: 'training',
            label: 'Training recorded',
            pass: trainingReady,
        },
        {
            key: 'handoff',
            label: 'Manual handoff recorded',
            pass: manualHandoffReady,
        },
        {
            key: 'ack',
            label: 'Operator acknowledgement',
            pass: ackReady,
        },
    ];

    const passCount = items.filter((item) => item.pass).length;
    const failCount = items.length - passCount;

    return {
        items,
        summary: {
            all: items.length,
            pass: passCount,
            fail: failCount,
        },
        truthAligned,
        routeChecked,
        runtimeReady,
        trainingReady,
        manualHandoffReady,
        ackReady,
        almostComplete: passCount >= Math.max(0, items.length - 1),
    };
}

function buildTruthSnapshot(snapshot) {
    const surfaceLabel = toString(snapshot.surfaceLabel, snapshot.surfaceKey);
    if (snapshot.truth.state === 'blocked') {
        return `${surfaceLabel} bloqueado: ${snapshot.truth.detail}`;
    }
    if (snapshot.truth.state === 'degraded') {
        return `${surfaceLabel} degradado: ${snapshot.truth.detail}`;
    }
    if (snapshot.truth.state === 'watch') {
        return `${surfaceLabel} en observacion: ${snapshot.truth.detail}`;
    }
    return `${surfaceLabel} alineado: ${snapshot.truth.detail}`;
}

export function buildTurneroSurfaceAdoptionSnapshot(input = {}) {
    const scope = normalizeScope(input.scope);
    const clinicProfile = asObject(input.clinicProfile || input.profile);
    const registry = asObject(input.registry);
    const surfaceKey = normalizeTurneroSurfaceRecoveryKey(
        input.surfaceKey || input.surface || 'operator'
    );
    const meta = resolveSurfaceMeta(surfaceKey);
    const definition =
        asObject(input.surfaceDefinition) ||
        resolveSurfaceDefinition(registry, surfaceKey, meta);
    const surfaceId = toString(
        input.surfaceId,
        toString(definition?.id, meta.surfaceId)
    );
    const surfaceLabel = resolveSurfaceLabel(definition, meta, surfaceKey);
    const role = toString(input.role, meta.role || surfaceKey);
    const roleLabel = toString(input.roleLabel, meta.roleLabel || role);
    const handoffMode = toString(
        input.handoffMode,
        meta.handoffMode || 'manual'
    );
    const currentRoute = resolveCurrentRoute(input);
    const expectedRoute = resolveExpectedRoute(definition, meta);
    const routeChecked = Boolean(currentRoute);
    const routeMatches = routeChecked
        ? normalizePathToken(currentRoute) === normalizePathToken(expectedRoute)
        : true;
    const inputTruthState = normalizeState(
        input.truthState || input.truth?.state || '',
        'aligned'
    );
    const truthState =
        inputTruthState === 'blocked'
            ? 'blocked'
            : routeChecked && !routeMatches
              ? 'degraded'
              : inputTruthState === 'degraded'
                ? 'degraded'
                : inputTruthState === 'watch'
                  ? 'watch'
                  : 'aligned';
    const truth = {
        state: truthState,
        summary: toString(
            input.truthSummary,
            truthState === 'aligned'
                ? `${surfaceLabel} alineado.`
                : truthState === 'degraded'
                  ? `${surfaceLabel} con drift visible.`
                  : truthState === 'watch'
                    ? `${surfaceLabel} bajo observacion.`
                    : `${surfaceLabel} bloqueado.`
        ),
        detail: toString(
            input.truthDetail,
            truthState === 'aligned'
                ? routeChecked
                    ? `Ruta ${normalizePathToken(currentRoute)} / ${normalizePathToken(
                          expectedRoute
                      )}`
                    : 'Ruta no evaluada.'
                : truthState === 'degraded'
                  ? `Ruta esperada ${expectedRoute} y actual ${currentRoute || 'n/a'}.`
                  : 'No se pudo resolver la surface.'
        ),
        aligned: truthState === 'aligned',
        routeMatches,
        routeChecked,
        expectedRoute,
        currentRoute,
        surfacePresent: Boolean(definition),
        registryState:
            toArray(registry.surfaces).length > 0 ? 'ready' : 'watch',
        manifestState: registry.manifest || input.manifest ? 'ready' : 'watch',
    };
    const runtime = normalizeRuntimeState(input.runtimeState || input.runtime);
    const trainingEntries = sortEntries(
        toArray(input.trainingEntries).map((entry) =>
            normalizeEvidenceEntry(entry, surfaceKey)
        )
    );
    const ackEntries = sortEntries(
        toArray(input.ackEntries).map((entry) =>
            normalizeEvidenceEntry(entry, surfaceKey)
        )
    );
    const evidenceEntries = sortEntries([...trainingEntries, ...ackEntries]);
    const training = buildTrainingSummary(trainingEntries);
    const acknowledgements = buildAckSummary(ackEntries);
    const checklist = buildChecklist({
        truth,
        runtime,
        training,
        acknowledgements,
        routeChecked,
    });

    return {
        scope,
        clinicId: toString(
            clinicProfile?.clinic_id || clinicProfile?.clinicId,
            'default-clinic'
        ),
        clinicName: toString(
            clinicProfile?.branding?.name ||
                clinicProfile?.branding?.short_name ||
                clinicProfile?.clinic_name ||
                clinicProfile?.clinicName ||
                'Aurora Derm'
        ),
        clinicShortName: toString(
            clinicProfile?.branding?.short_name ||
                clinicProfile?.branding?.name ||
                clinicProfile?.clinicName ||
                'Aurora Derm'
        ),
        registrySource: toString(registry.manifestSource, 'missing'),
        manifestVersion: toString(
            registry.manifest?.version || input.manifest?.version
        ),
        surfaceKey,
        surfaceId,
        surfaceToken: surfaceKey,
        surfaceLabel,
        role,
        roleLabel,
        handoffMode,
        currentRoute,
        expectedRoute,
        routeMatches,
        routeChecked,
        truth,
        runtime,
        training,
        acknowledgements,
        evidenceEntries,
        trainingEntries,
        ackEntries,
        checklist,
        generatedAt: new Date().toISOString(),
    };
}

export { normalizeState as normalizeTurneroSurfaceAdoptionState };
