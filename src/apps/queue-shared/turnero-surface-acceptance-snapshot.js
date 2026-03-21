import { getTurneroSurfaceContract } from './clinic-profile.js';
import {
    asObject,
    normalizePathToken,
    toArray,
    toString,
} from './turnero-surface-helpers.js';
import { normalizeTurneroSurfaceRecoveryKey } from './turnero-surface-contract-snapshot.js';

const SURFACE_PRESETS = Object.freeze({
    operator: Object.freeze({
        label: 'Operador web',
        route: '/operador-turnos.html',
        truth: 'watch',
        runtimeState: 'ready',
        acceptanceOwner: 'ops-lead',
        siteStatus: 'ready',
        trainingStatus: 'ready',
        signoffMode: 'manual',
        checklist: Object.freeze({ all: 4, pass: 3, fail: 1 }),
    }),
    kiosk: Object.freeze({
        label: 'Kiosco web',
        route: '/kiosco-turnos.html',
        truth: 'watch',
        runtimeState: 'ready',
        acceptanceOwner: '',
        siteStatus: 'watch',
        trainingStatus: 'pending',
        signoffMode: 'manual',
        checklist: Object.freeze({ all: 4, pass: 2, fail: 2 }),
    }),
    display: Object.freeze({
        label: 'Sala web',
        route: '/sala-turnos.html',
        truth: 'aligned',
        runtimeState: 'ready',
        acceptanceOwner: 'ops-display',
        siteStatus: 'ready',
        trainingStatus: 'ready',
        signoffMode: 'broadcast',
        checklist: Object.freeze({ all: 4, pass: 3, fail: 1 }),
    }),
    admin: Object.freeze({
        label: 'Admin queue',
        route: '/admin.html#queue',
        truth: 'aligned',
        runtimeState: 'ready',
        acceptanceOwner: 'ops-admin',
        siteStatus: 'ready',
        trainingStatus: 'ready',
        signoffMode: 'manual',
        checklist: Object.freeze({ all: 4, pass: 4, fail: 0 }),
    }),
    default: Object.freeze({
        label: 'Surface acceptance',
        route: '',
        truth: 'watch',
        runtimeState: 'ready',
        acceptanceOwner: '',
        siteStatus: 'watch',
        trainingStatus: 'pending',
        signoffMode: 'manual',
        checklist: Object.freeze({ all: 4, pass: 2, fail: 2 }),
    }),
});

function normalizeText(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function normalizeTone(value, fallback = 'watch') {
    const normalized = normalizeText(value, fallback).toLowerCase();
    switch (normalized) {
        case 'ready':
        case 'aligned':
        case 'ok':
        case 'live':
        case 'green':
            return 'ready';
        case 'watch':
        case 'pending':
        case 'review':
        case 'warning':
        case 'safe':
            return 'watch';
        case 'degraded':
        case 'fallback':
        case 'offline':
            return 'degraded';
        case 'blocked':
        case 'alert':
        case 'danger':
        case 'critical':
        case 'hold':
            return 'blocked';
        default:
            return fallback;
    }
}

function normalizeTruthState(value, fallback = 'watch') {
    return normalizeTone(value, fallback);
}

function normalizeOperationalState(value, fallback = 'watch') {
    return normalizeTone(value, fallback);
}

function resolveChecklistSummary(input = {}) {
    const source = asObject(input.summary || input);
    const pass = Number(source.pass ?? source.passed ?? source.ok ?? 0);
    const fail = Number(source.fail ?? source.failed ?? source.blocked ?? 0);
    let all = Number(source.all ?? source.total ?? source.count ?? 0);
    let normalizedPass = Number.isFinite(pass)
        ? Math.max(0, Math.round(pass))
        : 0;
    let normalizedFail = Number.isFinite(fail)
        ? Math.max(0, Math.round(fail))
        : 0;

    if (!Number.isFinite(all) || all <= 0) {
        all = normalizedPass + normalizedFail;
    }

    if (all <= 0) {
        all = Math.max(normalizedPass + normalizedFail, 0);
    }

    if (normalizedPass > all) {
        normalizedPass = all;
    }

    if (normalizedFail > all) {
        normalizedFail = all;
    }

    if (normalizedPass + normalizedFail > all) {
        normalizedFail = Math.max(all - normalizedPass, 0);
    }

    if (normalizedFail === 0 && all > normalizedPass) {
        normalizedFail = Math.max(all - normalizedPass, 0);
    }

    const pending = Math.max(all - normalizedPass - normalizedFail, 0);
    const ratio = all > 0 ? normalizedPass / all : 0;
    const state =
        normalizedFail === 0
            ? 'ready'
            : normalizedFail >= 3
              ? 'degraded'
              : 'watch';

    return {
        all,
        pass: normalizedPass,
        fail: normalizedFail,
        pending,
        ratio,
        state,
        summary: `${normalizedPass}/${all} checklist`,
        detail:
            normalizedFail > 0
                ? `${normalizedFail} pendiente(s) de checklist`
                : 'Checklist completa.',
    };
}

function normalizeEvidenceStatus(value, fallback = 'captured') {
    const normalized = normalizeText(value, fallback).toLowerCase();
    switch (normalized) {
        case 'captured':
        case 'recorded':
        case 'ready':
        case 'done':
            return 'captured';
        case 'review':
        case 'pending':
        case 'watch':
            return 'review';
        case 'resolved':
        case 'fixed':
            return 'resolved';
        case 'missing':
        case 'absent':
            return 'missing';
        case 'stale':
        case 'expired':
        case 'old':
            return 'stale';
        default:
            return fallback;
    }
}

function normalizeSignoffVerdict(value, fallback = 'review') {
    const normalized = normalizeText(value, fallback).toLowerCase();
    switch (normalized) {
        case 'approve':
        case 'approved':
        case 'pass':
        case 'ready':
        case 'ok':
            return 'approve';
        case 'reject':
        case 'rejected':
        case 'deny':
        case 'denied':
        case 'block':
        case 'blocked':
        case 'fail':
            return 'reject';
        case 'review':
        case 'pending':
        case 'waiting':
        case 'warn':
            return 'review';
        default:
            return fallback;
    }
}

function resolvePreset(surfaceKey) {
    return {
        ...(SURFACE_PRESETS[normalizeTurneroSurfaceAcceptanceKey(surfaceKey)] ||
            SURFACE_PRESETS.default),
    };
}

function resolveSurfaceRoute(profile, surfaceKey, preset) {
    const profileRoute = toString(
        profile?.surfaces?.[surfaceKey]?.route ||
            profile?.surfaces?.[surfaceKey]?.path ||
            ''
    );
    if (profileRoute) {
        return profileRoute;
    }

    return toString(preset?.route || '', '');
}

function resolveCurrentRoute(input = {}, profile, surfaceKey, preset) {
    const explicit = toString(input.currentRoute || input.route);
    if (explicit) {
        return explicit;
    }

    if (
        typeof window !== 'undefined' &&
        window.location &&
        typeof window.location.pathname === 'string'
    ) {
        return `${window.location.pathname || ''}${window.location.hash || ''}`;
    }

    return resolveSurfaceRoute(profile, surfaceKey, preset);
}

function summarizeRuntime(state) {
    switch (state) {
        case 'ready':
            return 'Runtime listo.';
        case 'watch':
            return 'Runtime bajo observacion.';
        case 'degraded':
            return 'Runtime degradado.';
        case 'blocked':
            return 'Runtime bloqueado.';
        default:
            return 'Runtime sin señal.';
    }
}

function summarizeSimpleState(prefix, state) {
    switch (state) {
        case 'ready':
            return `${prefix} listo.`;
        case 'watch':
            return `${prefix} bajo observacion.`;
        case 'degraded':
            return `${prefix} degradado.`;
        case 'blocked':
            return `${prefix} bloqueado.`;
        default:
            return `${prefix} sin señal.`;
    }
}

function summarizeEvidence(entries = []) {
    const list = toArray(entries);
    const total = list.length;
    const captured = list.filter(
        (entry) => normalizeEvidenceStatus(entry.status) === 'captured'
    ).length;
    const review = list.filter(
        (entry) => normalizeEvidenceStatus(entry.status) === 'review'
    ).length;
    const resolved = list.filter(
        (entry) => normalizeEvidenceStatus(entry.status) === 'resolved'
    ).length;
    const missing = list.filter(
        (entry) => normalizeEvidenceStatus(entry.status) === 'missing'
    ).length;
    const stale = list.filter(
        (entry) => normalizeEvidenceStatus(entry.status) === 'stale'
    ).length;
    const state =
        stale > 0 || missing > 0 ? 'watch' : total > 0 ? 'ready' : 'watch';

    return {
        total,
        captured,
        review,
        resolved,
        missing,
        stale,
        state,
        summary:
            total > 0 ? `${total} evidencia(s)` : 'Sin evidencia registrada.',
        detail:
            total > 0
                ? `${captured} capturada(s) · ${review} en revisión · ${resolved} resuelta(s) · ${missing} faltante(s) · ${stale} obsoleta(s)`
                : 'Aun no se registra evidencia.',
    };
}

function summarizeSignoffs(entries = [], signoffMode = 'manual') {
    const list = toArray(entries);
    const total = list.length;
    const approve = list.filter(
        (entry) => normalizeSignoffVerdict(entry.verdict) === 'approve'
    ).length;
    const review = list.filter(
        (entry) => normalizeSignoffVerdict(entry.verdict) === 'review'
    ).length;
    const reject = list.filter(
        (entry) => normalizeSignoffVerdict(entry.verdict) === 'reject'
    ).length;
    const state =
        reject > 0
            ? 'blocked'
            : approve > 0 || signoffMode === 'broadcast'
              ? 'ready'
              : 'watch';

    return {
        total,
        approve,
        review,
        reject,
        state,
        summary:
            total > 0
                ? `${total} signoff(s)`
                : signoffMode === 'broadcast'
                  ? 'Sin signoff manual necesario.'
                  : 'Sin signoff registrado.',
        detail:
            total > 0
                ? `${approve} aprobado(s) · ${review} en revisión · ${reject} rechazado(s)`
                : signoffMode === 'broadcast'
                  ? 'La superficie usa un canal broadcast.'
                  : 'Aun no se registra un signoff.',
    };
}

export function normalizeTurneroSurfaceAcceptanceEvidenceEntry(
    entry = {},
    fallbackSurfaceKey = 'operator',
    fallbackIndex = 0
) {
    const source = asObject(entry);
    const surfaceKey = normalizeTurneroSurfaceRecoveryKey(
        source.surfaceKey || source.surface || fallbackSurfaceKey
    );
    const createdAt = toString(
        source.createdAt ||
            source.created_at ||
            source.capturedAt ||
            source.updatedAt ||
            new Date().toISOString()
    );
    const updatedAt = toString(
        source.updatedAt || source.updated_at,
        createdAt
    );

    return {
        id: toString(
            source.id,
            `${surfaceKey}-evidence-${createdAt}-${fallbackIndex + 1}`
        ),
        surfaceKey,
        title: toString(source.title || source.label, 'Evidence'),
        note: toString(source.note || source.detail || source.summary || ''),
        status: normalizeEvidenceStatus(source.status || source.state),
        source: toString(source.source || 'manual'),
        owner: toString(source.owner || source.author || source.actor || ''),
        createdAt,
        updatedAt,
        capturedAt: toString(
            source.capturedAt || source.evidenceAt || createdAt
        ),
        evidenceAt: toString(
            source.evidenceAt || source.capturedAt || createdAt
        ),
        meta:
            source.meta && typeof source.meta === 'object'
                ? { ...source.meta }
                : {},
    };
}

export function normalizeTurneroSurfaceAcceptanceEvidenceEntries(
    value,
    fallbackSurfaceKey = 'operator'
) {
    return toArray(value)
        .map((entry, index) =>
            normalizeTurneroSurfaceAcceptanceEvidenceEntry(
                entry,
                fallbackSurfaceKey,
                index
            )
        )
        .filter((entry) => Boolean(entry.id));
}

export function normalizeTurneroSurfaceAcceptanceSignoffEntry(
    entry = {},
    fallbackSurfaceKey = 'operator',
    fallbackIndex = 0
) {
    const source = asObject(entry);
    const surfaceKey = normalizeTurneroSurfaceRecoveryKey(
        source.surfaceKey || source.surface || fallbackSurfaceKey
    );
    const createdAt = toString(
        source.createdAt ||
            source.created_at ||
            source.updatedAt ||
            new Date().toISOString()
    );
    const updatedAt = toString(
        source.updatedAt || source.updated_at,
        createdAt
    );

    return {
        id: toString(
            source.id,
            `${surfaceKey}-signoff-${createdAt}-${fallbackIndex + 1}`
        ),
        surfaceKey,
        stakeholder: toString(
            source.stakeholder || source.reviewer || source.owner,
            'stakeholder'
        ),
        role: toString(
            source.role || source.position || source.title,
            'reviewer'
        ),
        verdict: normalizeSignoffVerdict(
            source.verdict || source.state || source.status
        ),
        note: toString(source.note || source.detail || source.summary || ''),
        source: toString(source.source || 'manual'),
        createdAt,
        updatedAt,
        meta:
            source.meta && typeof source.meta === 'object'
                ? { ...source.meta }
                : {},
    };
}

export function normalizeTurneroSurfaceAcceptanceSignoffEntries(
    value,
    fallbackSurfaceKey = 'operator'
) {
    return toArray(value)
        .map((entry, index) =>
            normalizeTurneroSurfaceAcceptanceSignoffEntry(
                entry,
                fallbackSurfaceKey,
                index
            )
        )
        .filter((entry) => Boolean(entry.id));
}

export function normalizeTurneroSurfaceAcceptanceKey(value) {
    const explicit = toString(value)
        .toLowerCase()
        .replace(/^\/+/, '')
        .replace(/\/+$/, '');
    const pathToken = normalizePathToken(value);
    return (
        normalizeTurneroSurfaceRecoveryKey(explicit) ||
        normalizeTurneroSurfaceRecoveryKey(pathToken) ||
        normalizeTurneroSurfaceRecoveryKey('operator')
    );
}

export function resolveTurneroSurfaceAcceptancePreset(surfaceKey) {
    return resolvePreset(surfaceKey);
}

export function normalizeTurneroSurfaceAcceptanceChecklistSummary(input = {}) {
    return resolveChecklistSummary(input);
}

export function normalizeTurneroSurfaceAcceptanceTruthState(
    value,
    fallback = 'watch'
) {
    return normalizeTruthState(value, fallback);
}

export function normalizeTurneroSurfaceAcceptanceOperationalState(
    value,
    fallback = 'watch'
) {
    return normalizeOperationalState(value, fallback);
}

export function buildTurneroSurfaceAcceptanceSnapshot(input = {}) {
    const profile = asObject(input.clinicProfile || input.profile);
    const surfaceKey = normalizeTurneroSurfaceAcceptanceKey(
        input.surfaceKey || input.surface || 'operator'
    );
    const preset = resolvePreset(surfaceKey);
    const currentRoute = resolveCurrentRoute(
        input,
        profile,
        surfaceKey,
        preset
    );
    const contract = getTurneroSurfaceContract(profile, surfaceKey, {
        currentRoute,
    });
    const runtimeState = normalizeOperationalState(
        input.runtimeState || preset.runtimeState,
        preset.runtimeState
    );
    const truth = normalizeTruthState(
        input.truth || preset.truth,
        preset.truth
    );
    const acceptanceOwner = toString(
        input.acceptanceOwner || input.owner || preset.acceptanceOwner
    );
    const siteStatus = normalizeOperationalState(
        input.siteStatus || input.siteState || preset.siteStatus,
        preset.siteStatus
    );
    const trainingStatus = normalizeOperationalState(
        input.trainingStatus || input.trainingState || preset.trainingStatus,
        preset.trainingStatus
    );
    const signoffMode = toString(
        input.signoffMode || preset.signoffMode,
        'manual'
    );
    const checklist = normalizeTurneroSurfaceAcceptanceChecklistSummary(
        input.checklist || preset.checklist
    );
    const evidence = normalizeTurneroSurfaceAcceptanceEvidenceEntries(
        input.evidence,
        surfaceKey
    );
    const signoffs = normalizeTurneroSurfaceAcceptanceSignoffEntries(
        input.signoffs,
        surfaceKey
    );
    const evidenceSummary = summarizeEvidence(evidence);
    const signoffSummary = summarizeSignoffs(signoffs, signoffMode);
    const clinicId = toString(
        profile?.clinic_id || profile?.clinicId,
        'default-clinic'
    );
    const clinicName = toString(
        profile?.branding?.name || profile?.branding?.short_name || clinicId,
        clinicId
    );
    const clinicShortName = toString(
        profile?.branding?.short_name || clinicName,
        clinicName
    );
    const source = toString(profile?.runtime_meta?.source, 'remote');
    const fingerprint = toString(
        profile?.runtime_meta?.profileFingerprint ||
            profile?.profileFingerprint ||
            '',
        ''
    );
    const releaseMode = toString(profile?.release?.mode, 'suite_v2');
    const surfaceLabel = toString(
        contract.label ||
            profile?.surfaces?.[surfaceKey]?.label ||
            preset.label ||
            surfaceKey,
        surfaceKey
    );
    const runtime = {
        state: runtimeState,
        summary:
            toString(input.runtimeSummary) || summarizeRuntime(runtimeState),
        mode: toString(input.runtimeMode || preset.runtimeState, 'live'),
        online: input.online !== false,
        details:
            input.runtimeDetails && typeof input.runtimeDetails === 'object'
                ? { ...input.runtimeDetails }
                : {},
    };
    const truthSnapshot = {
        state: truth,
        summary:
            toString(input.truthSummary) ||
            summarizeSimpleState('Truth', truth),
    };
    const site = {
        state: siteStatus,
        summary:
            toString(input.siteSummary) ||
            summarizeSimpleState('Site', siteStatus),
    };
    const training = {
        state: trainingStatus,
        summary:
            toString(input.trainingSummary) ||
            summarizeSimpleState('Training', trainingStatus),
    };

    return {
        generatedAt: new Date().toISOString(),
        surfaceKey,
        surfaceToken: toString(input.surfaceToken || input.surface, surfaceKey),
        surfaceLabel,
        currentRoute,
        routeMatches: Boolean(contract.routeMatches),
        contractState: toString(contract.state || 'ready'),
        contractReason: toString(contract.reason || 'ready'),
        contractDetail: toString(contract.detail || ''),
        profile: {
            clinicId,
            clinicName,
            clinicShortName,
            source,
            fingerprint,
            releaseMode,
            surfaceKey,
            surfaceLabel,
            expectedRoute: toString(contract.expectedRoute || ''),
            currentRoute: toString(contract.currentRoute || currentRoute),
            routeMatches: Boolean(contract.routeMatches),
            contractState: toString(contract.state || 'ready'),
            contractReason: toString(contract.reason || 'ready'),
            contractDetail: toString(contract.detail || ''),
        },
        contract: {
            ...contract,
            label: surfaceLabel,
        },
        runtime,
        truth: truthSnapshot,
        site,
        training,
        acceptanceOwner,
        signoffMode,
        checklist,
        evidence,
        evidenceSummary,
        signoffs,
        signoffSummary,
    };
}

export default buildTurneroSurfaceAcceptanceSnapshot;
