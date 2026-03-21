import {
    getTurneroClinicBrandName,
    getTurneroClinicShortName,
    normalizeTurneroClinicProfile,
} from './clinic-profile.js';

function toString(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

const SURFACE_KEY_ALIASES = Object.freeze({
    admin: 'admin',
    queue: 'admin',
    'queue-admin': 'admin',
    'admin-queue': 'admin',
    operator: 'operator',
    operador: 'operator',
    'operator-turnos': 'operator',
    'operador-turnos': 'operator',
    kiosk: 'kiosk',
    kiosko: 'kiosk',
    kiosco: 'kiosk',
    'kiosk-turnos': 'kiosk',
    'kiosko-turnos': 'kiosk',
    'kiosco-turnos': 'kiosk',
    display: 'display',
    sala: 'display',
    'sala-turnos': 'display',
    'sala-tv': 'display',
    sala_tv: 'display',
});

const SURFACE_LABELS = Object.freeze({
    operator: 'Turnero Operador',
    kiosk: 'Turnero Kiosco',
    display: 'Turnero Sala TV',
    admin: 'Admin',
});

const DEFAULT_EXPANSION_FIELDS = Object.freeze({
    operator: {
        truth: 'watch',
        opportunityState: 'watch',
        demandSignal: 'medium',
        gapState: 'triage-plus',
        expansionOwner: 'ops-lead',
        nextModuleHint: 'historia-clinica-lite',
    },
    kiosk: {
        truth: 'watch',
        opportunityState: 'watch',
        demandSignal: 'low',
        gapState: 'self-checkin',
        expansionOwner: '',
        nextModuleHint: '',
    },
    display: {
        truth: 'aligned',
        opportunityState: 'ready',
        demandSignal: 'medium',
        gapState: 'voice-announcer',
        expansionOwner: 'ops-display',
        nextModuleHint: 'analytics-board',
    },
    admin: {
        truth: 'watch',
        opportunityState: 'watch',
        demandSignal: 'medium',
        gapState: 'surface-expansion',
        expansionOwner: '',
        nextModuleHint: '',
    },
});

function normalizeSurfaceKey(value) {
    const normalized = toString(value, 'surface').toLowerCase();
    return SURFACE_KEY_ALIASES[normalized] || normalized || 'surface';
}

function resolveDefaults(surfaceKey) {
    return (
        DEFAULT_EXPANSION_FIELDS[normalizeSurfaceKey(surfaceKey)] ||
        DEFAULT_EXPANSION_FIELDS.admin
    );
}

function resolveClinicId(clinicProfile) {
    const profile = normalizeTurneroClinicProfile(clinicProfile);
    return toString(
        profile?.clinic_id || profile?.clinicId || profile?.id,
        'default-clinic'
    );
}

function resolveClinicLabel(clinicProfile, clinicId) {
    const profile = normalizeTurneroClinicProfile(clinicProfile);
    return toString(
        profile?.branding?.name ||
            profile?.branding?.short_name ||
            getTurneroClinicBrandName(profile) ||
            getTurneroClinicShortName(profile) ||
            clinicId,
        clinicId
    );
}

function resolveScope(inputScope, clinicProfile) {
    return toString(
        inputScope ||
            clinicProfile?.region ||
            clinicProfile?.branding?.city ||
            'regional',
        'regional'
    );
}

function resolveSurfaceLabel(surfaceKey, clinicProfile) {
    const normalizedSurfaceKey = normalizeSurfaceKey(surfaceKey);
    const surfaceProfile = clinicProfile?.surfaces?.[normalizedSurfaceKey];

    return toString(
        surfaceProfile?.label ||
            surfaceProfile?.title ||
            SURFACE_LABELS[normalizedSurfaceKey] ||
            normalizedSurfaceKey,
        SURFACE_LABELS[normalizedSurfaceKey] || normalizedSurfaceKey
    );
}

function normalizeTruthState(value, fallback = 'watch') {
    const normalized = toString(value, fallback).toLowerCase();
    if (
        ['aligned', 'ready', 'watch', 'draft', 'degraded', 'blocked'].includes(
            normalized
        )
    ) {
        return normalized;
    }
    return toString(fallback, 'watch').toLowerCase() || 'watch';
}

function normalizeOpportunityState(value, fallback = 'watch') {
    const normalized = toString(value, fallback).toLowerCase();
    if (
        ['ready', 'watch', 'draft', 'pending', 'degraded', 'blocked'].includes(
            normalized
        )
    ) {
        return normalized;
    }
    return toString(fallback, 'watch').toLowerCase() || 'watch';
}

function normalizeDemandSignal(value, fallback = 'none') {
    const normalized = toString(value, fallback).toLowerCase();
    if (['high', 'medium', 'low', 'none'].includes(normalized)) {
        return normalized;
    }
    return toString(fallback, 'none').toLowerCase() || 'none';
}

export function buildTurneroSurfaceExpansionSnapshot(input = {}) {
    const clinicProfile = normalizeTurneroClinicProfile(input.clinicProfile);
    const surfaceKey = normalizeSurfaceKey(input.surfaceKey);
    const clinicId = resolveClinicId(clinicProfile);
    const defaults = resolveDefaults(surfaceKey);

    return {
        scope: resolveScope(input.scope, clinicProfile),
        surfaceKey,
        surfaceLabel: resolveSurfaceLabel(surfaceKey, clinicProfile),
        clinicId,
        clinicLabel: resolveClinicLabel(clinicProfile, clinicId),
        runtimeState: toString(input.runtimeState, 'unknown'),
        truth: normalizeTruthState(input.truth, defaults.truth),
        opportunityState: normalizeOpportunityState(
            input.opportunityState,
            defaults.opportunityState
        ),
        demandSignal: normalizeDemandSignal(
            input.demandSignal,
            defaults.demandSignal
        ),
        gapState: toString(input.gapState, defaults.gapState),
        expansionOwner: toString(
            input.expansionOwner,
            defaults.expansionOwner
        ),
        nextModuleHint: toString(
            input.nextModuleHint,
            defaults.nextModuleHint
        ),
        updatedAt: toString(input.updatedAt, new Date().toISOString()),
    };
}

export {
    normalizeSurfaceKey as normalizeTurneroSurfaceExpansionSurfaceKey,
    resolveClinicId as resolveTurneroSurfaceExpansionClinicId,
    resolveClinicLabel as resolveTurneroSurfaceExpansionClinicLabel,
    resolveScope as resolveTurneroSurfaceExpansionScope,
    resolveSurfaceLabel as resolveTurneroSurfaceExpansionSurfaceLabel,
};
