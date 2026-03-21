import {
    getTurneroClinicBrandName,
    getTurneroClinicProfileFingerprint,
    getTurneroClinicReleaseMode,
    getTurneroClinicShortName,
    getTurneroSurfaceContract,
} from './clinic-profile.js';
import { buildTurneroSurfaceAssetChecklist } from './turnero-surface-asset-checklist.js';
import { asObject, toArray, toString } from './turnero-surface-helpers.js';

const SURFACE_TOKEN_TO_ID = Object.freeze({
    'operator-turnos': 'operator',
    'operador-turnos': 'operator',
    operator: 'operator',
    operador: 'operator',
    kiosk: 'kiosk',
    'kiosco-turnos': 'kiosk',
    'kiosk-turnos': 'kiosk',
    'kiosko-turnos': 'kiosk',
    kiosco: 'kiosk',
    kiosko: 'kiosk',
    display: 'display',
    'sala-turnos': 'display',
    sala_tv: 'display',
    'sala-tv': 'display',
    sala: 'display',
});

const SURFACE_ID_TO_TOKEN = Object.freeze({
    operator: 'operator-turnos',
    kiosk: 'kiosco-turnos',
    display: 'sala-turnos',
});

const SURFACE_ROLLOUT_DEFAULTS = Object.freeze({
    operator: {
        id: 'operator',
        key: 'operator-turnos',
        label: 'Turnero Operador',
        route: '/operador-turnos.html',
        family: 'desktop',
        description: 'Operador web para el rollout por clínica.',
        recommendedFor: 'PC operador',
        installMode: 'guided',
        truth: 'watch',
        visitDate: '2026-04-01',
        rolloutOwner: 'ops-lead',
        assetTag: 'OPS-OP-01',
        stationLabel: 'Consultorio 1',
        runtimeState: 'ready',
    },
    kiosk: {
        id: 'kiosk',
        key: 'kiosco-turnos',
        label: 'Turnero Kiosco',
        route: '/kiosco-turnos.html',
        family: 'desktop',
        description: 'Kiosco web para recepcion y emision de tickets.',
        recommendedFor: 'PC o mini PC de kiosco',
        installMode: 'manual',
        truth: 'watch',
        visitDate: '',
        rolloutOwner: '',
        assetTag: '',
        stationLabel: 'Ingreso',
        runtimeState: 'ready',
    },
    display: {
        id: 'display',
        key: 'sala-turnos',
        label: 'Turnero Sala TV',
        route: '/sala-turnos.html',
        family: 'android',
        description: 'Pantalla de llamados para sala de espera.',
        recommendedFor: 'TCL C655 / Google TV',
        installMode: 'broadcast',
        truth: 'aligned',
        visitDate: '2026-04-02',
        rolloutOwner: 'ops-display',
        assetTag: 'OPS-DIS-01',
        stationLabel: 'Sala de espera',
        runtimeState: 'ready',
    },
});

function hasOwn(source, key) {
    return Object.prototype.hasOwnProperty.call(source, key);
}

function pickProvidedField(source, keys = []) {
    for (const key of keys) {
        if (hasOwn(source, key)) {
            return source[key];
        }
    }
    return undefined;
}

function resolveMaybeText(value, fallback = '') {
    if (value === undefined || value === null) {
        return toString(fallback);
    }
    return toString(value);
}

function resolveTurneroSurfaceRolloutDefaults(surfaceId) {
    return (
        SURFACE_ROLLOUT_DEFAULTS[surfaceId] || SURFACE_ROLLOUT_DEFAULTS.operator
    );
}

function normalizeSurfaceId(value) {
    const normalized = toString(value).toLowerCase();
    if (!normalized) {
        return 'operator';
    }
    return SURFACE_TOKEN_TO_ID[normalized] || normalized || 'operator';
}

function normalizeSurfaceToken(value) {
    const normalized = toString(value).toLowerCase();
    const surfaceId = SURFACE_TOKEN_TO_ID[normalized];
    if (surfaceId) {
        return SURFACE_ID_TO_TOKEN[surfaceId];
    }

    if (SURFACE_ROLLOUT_DEFAULTS[normalized]) {
        return SURFACE_ID_TO_TOKEN[normalized] || normalized;
    }

    return (
        SURFACE_ID_TO_TOKEN[normalizeSurfaceId(normalized)] || 'operator-turnos'
    );
}

function normalizeTruth(value, surfaceId) {
    const normalized = toString(value).toLowerCase();
    if (!normalized) {
        return '';
    }
    if (['aligned', 'watch', 'blocked', 'pending'].includes(normalized)) {
        return normalized;
    }
    return resolveTurneroSurfaceRolloutDefaults(surfaceId).truth;
}

function normalizeInstallMode(value, surfaceId) {
    const normalized = toString(value).toLowerCase();
    if (!normalized) {
        return '';
    }
    if (['guided', 'manual', 'broadcast'].includes(normalized)) {
        return normalized;
    }
    return resolveTurneroSurfaceRolloutDefaults(surfaceId).installMode || '';
}

function resolveSurfaceDefinition(profile, registry, surfaceId, surfaceToken) {
    const fallback = resolveTurneroSurfaceRolloutDefaults(surfaceId);
    const profileSurface = asObject(profile?.surfaces?.[surfaceId]);
    const registrySurfaces = Array.isArray(registry?.surfaces)
        ? registry.surfaces
        : [];
    const registrySurface = registrySurfaces.find((surface) => {
        const candidateId = normalizeSurfaceId(
            surface?.id ||
                surface?.key ||
                surface?.route ||
                surface?.productName
        );
        return candidateId === surfaceId;
    });

    const route =
        toString(profileSurface.route) ||
        toString(registrySurface?.route) ||
        fallback.route;
    const label =
        toString(profileSurface.label) ||
        toString(registrySurface?.productName) ||
        toString(registrySurface?.ops?.installHub?.title) ||
        fallback.label;
    const family = toString(registrySurface?.family || fallback.family);

    return {
        id: surfaceId,
        key: surfaceToken,
        label,
        route,
        family,
        description: toString(
            registrySurface?.ops?.installHub?.description ||
                registrySurface?.catalog?.description ||
                fallback.description
        ),
        recommendedFor: toString(
            registrySurface?.ops?.installHub?.recommendedFor ||
                registrySurface?.catalog?.eyebrow ||
                fallback.recommendedFor
        ),
        productName: toString(registrySurface?.productName || label),
    };
}

function resolveManifestApp(releaseManifest, surfaceId, surfaceToken) {
    const manifest = asObject(releaseManifest);
    const apps = asObject(manifest.apps);
    return (
        apps[surfaceId] ||
        apps[surfaceToken] ||
        apps[surfaceId === 'display' ? 'sala_tv' : surfaceId] ||
        null
    );
}

function buildManifestSummary(releaseManifest, surfaceId, surfaceToken) {
    const manifest = asObject(releaseManifest);
    const app = resolveManifestApp(manifest, surfaceId, surfaceToken);
    const expectedAppKey = surfaceId === 'display' ? 'sala_tv' : surfaceId;
    const targetEntries =
        app?.targets && typeof app.targets === 'object'
            ? Object.entries(app.targets)
            : [];
    const hasTargets = targetEntries.filter(([, target]) => {
        const url = toString(target?.url);
        return Boolean(url);
    }).length;
    const fileCount = Array.isArray(app?.files) ? app.files.length : 0;
    const hasApp = Boolean(app);
    const hasVersion = Boolean(toString(app?.version || manifest.version));
    const hasManifest = Object.keys(manifest).length > 0;
    const state = hasApp
        ? hasVersion && (hasTargets > 0 || fileCount > 0)
            ? 'ready'
            : 'watch'
        : hasManifest
          ? 'pending'
          : 'watch';

    return {
        state,
        channel: toString(manifest.channel || ''),
        version: toString(app?.version || manifest.version || ''),
        releasedAt: toString(manifest.releasedAt || ''),
        appKey: hasApp ? expectedAppKey : expectedAppKey,
        expectedAppKey,
        targetCount: targetEntries.length,
        fileCount,
        hasApp,
        hasManifest,
        hasVersion,
        hasTargets: hasTargets > 0,
        summary:
            state === 'ready'
                ? 'Manifest listo.'
                : state === 'pending'
                  ? `Entrada ${expectedAppKey} pendiente.`
                  : hasApp
                    ? 'Manifest parcial.'
                    : 'Manifest pendiente.',
    };
}

function buildRuntimeState(input = {}, truth) {
    const source = asObject(input);
    const explicit = toString(source.state || source.status || source.mode);
    const normalized =
        explicit === 'ready' ||
        explicit === 'watch' ||
        explicit === 'blocked' ||
        explicit === 'pending'
            ? explicit
            : truth === 'aligned'
              ? 'ready'
              : truth === 'blocked'
                ? 'blocked'
                : 'watch';

    return {
        state: normalized,
        summary: toString(
            source.summary ||
                (normalized === 'ready'
                    ? 'Runtime listo.'
                    : normalized === 'blocked'
                      ? 'Runtime bloqueado.'
                      : 'Runtime en observación.')
        ),
        online:
            typeof source.online === 'boolean'
                ? source.online
                : normalized !== 'blocked',
        connectivity: toString(
            source.connectivity,
            normalized === 'blocked' ? 'offline' : 'online'
        ),
        mode: toString(
            source.mode,
            normalized === 'blocked' ? 'offline' : 'live'
        ),
        reason: toString(source.reason || ''),
        details:
            source.details && typeof source.details === 'object'
                ? { ...source.details }
                : {},
    };
}

function normalizeLedgerSnapshot(input = {}, surfaceKey) {
    const source = asObject(input);
    const rawEntries = Array.isArray(source.entries)
        ? source.entries
        : Array.isArray(input)
          ? input
          : [];
    const entries = rawEntries
        .map((entry) => asObject(entry))
        .map((entry) => ({
            id: toString(entry.id || ''),
            surfaceKey: normalizeSurfaceToken(
                entry.surfaceKey || entry.surface || surfaceKey
            ),
            state: toString(
                entry.state || entry.status || 'open'
            ).toLowerCase(),
            owner: toString(
                entry.owner || entry.responsible || entry.assignee || ''
            ),
            assetTag: toString(entry.assetTag || entry.asset || ''),
            stationLabel: toString(entry.stationLabel || entry.station || ''),
            installMode: normalizeInstallMode(
                entry.installMode || entry.mode || '',
                normalizeSurfaceId(surfaceKey)
            ),
            visitDate: toString(entry.visitDate || entry.visit_at || ''),
            title: toString(entry.title || entry.label || 'Rollout entry'),
            detail: toString(entry.detail || entry.note || ''),
            createdAt: toString(entry.createdAt || entry.created_at || ''),
            updatedAt: toString(entry.updatedAt || entry.updated_at || ''),
            closedAt: toString(entry.closedAt || entry.closed_at || ''),
            resolvedAt: toString(entry.resolvedAt || entry.resolved_at || ''),
        }))
        .filter((entry) => Boolean(entry.id || entry.title || entry.detail));

    const openCount = entries.filter((entry) => {
        const state = toString(entry.state).toLowerCase();
        return !['closed', 'resolved', 'dismissed'].includes(state);
    }).length;
    const blockedCount = entries.filter((entry) => {
        const state = toString(entry.state).toLowerCase();
        return ['blocked', 'hold', 'failed', 'failure'].includes(state);
    }).length;
    const latestAt = entries[0]?.updatedAt || entries[0]?.createdAt || '';

    return {
        schema: 'turnero-surface-rollout-ledger/v1',
        state: blockedCount > 0 ? 'blocked' : openCount > 0 ? 'watch' : 'ready',
        totalCount: entries.length,
        openCount,
        blockedCount,
        latestAt,
        entries,
        summary: {
            total: entries.length,
            open: openCount,
            blocked: blockedCount,
            latestAt,
        },
    };
}

export function buildTurneroSurfaceRolloutSnapshot(input = {}) {
    const profile = asObject(input.clinicProfile || input.profile);
    const registry = asObject(input.surfaceRegistry || input.registry);
    const surfaceId = normalizeSurfaceId(
        input.surfaceId || input.surfaceKey || input.surface || 'operator'
    );
    const surfaceKey = normalizeSurfaceToken(
        input.surfaceKey || input.surfaceId || input.surface || surfaceId
    );
    const defaults = resolveTurneroSurfaceRolloutDefaults(surfaceId);
    const surfaceDefinition = resolveSurfaceDefinition(
        profile,
        registry,
        surfaceId,
        surfaceKey
    );
    const contract = getTurneroSurfaceContract(profile, surfaceId, {
        currentRoute: toString(input.currentRoute || input.route),
    });
    const releaseManifest = asObject(
        input.releaseManifest || registry.manifest
    );
    const manifest = buildManifestSummary(
        releaseManifest,
        surfaceId,
        surfaceKey
    );
    const truthInput = pickProvidedField(input, ['truth']);
    const truth =
        truthInput === undefined ||
        truthInput === null ||
        toString(truthInput) === ''
            ? defaults.truth
            : normalizeTruth(truthInput, surfaceId);
    const runtimeState = buildRuntimeState(input.runtimeState, truth);
    const visitDateInput = pickProvidedField(input, [
        'visitDate',
        'visit_date',
    ]);
    const visitDate =
        visitDateInput === undefined || visitDateInput === null
            ? resolveMaybeText(defaults.visitDate)
            : resolveMaybeText(visitDateInput);
    const ownerInput = pickProvidedField(input, [
        'owner',
        'rolloutOwner',
        'rollout_owner',
    ]);
    const owner =
        ownerInput === undefined || ownerInput === null
            ? resolveMaybeText(
                  defaults.rolloutOwner,
                  getTurneroClinicShortName(profile) ||
                      getTurneroClinicBrandName(profile) ||
                      'ops'
              )
            : resolveMaybeText(ownerInput);
    const assetInput = pickProvidedField(input, [
        'assetTag',
        'asset',
        'asset_tag',
    ]);
    const assetTag =
        assetInput === undefined || assetInput === null
            ? resolveMaybeText(
                  defaults.assetTag,
                  `TURNERO-${surfaceId.toUpperCase()}-01`
              )
            : resolveMaybeText(assetInput);
    const stationInput = pickProvidedField(input, [
        'stationLabel',
        'station',
        'station_label',
    ]);
    const stationLabel =
        stationInput === undefined || stationInput === null
            ? resolveMaybeText(defaults.stationLabel, surfaceDefinition.label)
            : resolveMaybeText(stationInput);
    const installInput = pickProvidedField(input, [
        'installMode',
        'install_mode',
    ]);
    const installMode =
        installInput === undefined || installInput === null
            ? normalizeInstallMode(defaults.installMode, surfaceId)
            : normalizeInstallMode(installInput, surfaceId);
    const scope = toString(pickProvidedField(input, ['scope']), 'regional');
    const ledgerInput =
        input.ledgerSnapshot ||
        (input.ledgerStore && typeof input.ledgerStore.snapshot === 'function'
            ? input.ledgerStore.snapshot({ surfaceKey })
            : input.ledger) ||
        [];
    const checklist =
        input.checklist && typeof input.checklist === 'object'
            ? input.checklist
            : buildTurneroSurfaceAssetChecklist({
                  snapshot: {
                      surfaceId,
                      surfaceKey,
                      surfaceLabel: surfaceDefinition.label,
                      owner,
                      assetTag,
                      stationLabel,
                      installMode,
                      ledger: ledgerInput,
                  },
              });
    const ledger = normalizeLedgerSnapshot(ledgerInput, surfaceKey);

    return {
        scope,
        surfaceId,
        surfaceKey,
        surfaceLabel: surfaceDefinition.label,
        surfaceRoute: surfaceDefinition.route,
        surfaceFamily: surfaceDefinition.family,
        surfaceDescription: surfaceDefinition.description,
        recommendedFor: surfaceDefinition.recommendedFor,
        surfaceDefinition,
        clinicId: toString(profile?.clinic_id || 'default-clinic'),
        clinicName: getTurneroClinicBrandName(profile),
        clinicShortName: getTurneroClinicShortName(profile),
        profileFingerprint: getTurneroClinicProfileFingerprint(profile),
        releaseMode: getTurneroClinicReleaseMode(profile),
        contract,
        registryState:
            registry &&
            Object.keys(registry).length > 0 &&
            Array.isArray(registry.surfaces) &&
            registry.surfaces.length > 0
                ? 'ready'
                : 'watch',
        manifest,
        manifestState: manifest.state,
        truth,
        runtimeState,
        visitDate,
        owner,
        assetTag,
        stationLabel,
        installMode,
        checklist,
        ledger,
        checklistState: checklist.state,
        checklistCoverage: checklist.coverage,
        ledgerState: ledger.state,
        generatedAt: new Date().toISOString(),
    };
}

export {
    normalizeInstallMode as normalizeTurneroSurfaceRolloutInstallMode,
    normalizeSurfaceId as normalizeTurneroSurfaceRolloutId,
    normalizeSurfaceToken as normalizeTurneroSurfaceRolloutKey,
    resolveManifestApp as resolveTurneroSurfaceRolloutManifestApp,
    resolveSurfaceDefinition as resolveTurneroSurfaceRolloutDefinition,
    resolveTurneroSurfaceRolloutDefaults,
};
