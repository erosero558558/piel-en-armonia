import { getState } from '../../../../../core/store.js';
import {
    asObject,
    toText,
} from '../../../../../../../queue-shared/turnero-release-control-center.js';
import { mountTurneroReleaseMainlineClosureCockpit } from '../../../../../../../queue-shared/turnero-release-mainline-closure-cockpit.js';

const DEFAULT_MAINLINE_CLOSURE_SURFACES = Object.freeze([
    { id: 'admin-queue', label: 'Admin Queue' },
    { id: 'operator-turnos', label: 'Operator Turnos' },
    { id: 'kiosco-turnos', label: 'Kiosco Turnos' },
    { id: 'sala-turnos', label: 'Sala Turnos' },
]);

const DEFAULT_MAINLINE_CLOSURE_RUNTIME_ROWS = Object.freeze([
    {
        key: 'admin-queue',
        surface: 'admin-queue',
        present: true,
        fingerprint: 'runtime-admin',
    },
    {
        key: 'operator-turnos',
        surface: 'operator-turnos',
        present: true,
        fingerprint: 'runtime-operator',
    },
    {
        key: 'kiosco-turnos',
        surface: 'kiosco-turnos',
        present: true,
        fingerprint: 'runtime-kiosk',
    },
    {
        key: 'sala-turnos',
        surface: 'sala-turnos',
        present: true,
        fingerprint: 'runtime-display',
    },
    {
        key: 'remote-health',
        surface: 'admin-queue',
        present: true,
        fingerprint: 'runtime-health',
    },
    {
        key: 'public-sync',
        surface: 'admin-queue',
        present: true,
        fingerprint: 'runtime-public-sync',
    },
    {
        key: 'figo-bridge',
        surface: 'admin-queue',
        present: true,
        fingerprint: 'runtime-figo',
    },
    {
        key: 'final-diagnostic',
        surface: 'admin-queue',
        present: true,
        fingerprint: 'runtime-diagnostic',
    },
]);

const DEFAULT_MAINLINE_CLOSURE_AUDIT_ROWS = Object.freeze([
    { surfaceId: 'admin-queue', state: 'strong' },
    { surfaceId: 'operator-turnos', state: 'watch' },
    { surfaceId: 'kiosco-turnos', state: 'watch' },
    { surfaceId: 'sala-turnos', state: 'watch' },
    { key: 'remote-health', state: 'pass' },
    { key: 'public-sync', state: 'watch' },
    { key: 'figo-bridge', state: 'pass' },
    { key: 'final-diagnostic', state: 'watch' },
]);

function isDomElement(value) {
    return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement;
}

function resolveMainlineClosureCockpitHost(mountNode) {
    if (mountNode) {
        return mountNode;
    }

    if (typeof document === 'undefined') {
        return null;
    }

    return (
        document.getElementById('queueReleaseMainlineClosureCockpitHost') ||
        document.querySelector(
            '[data-turnero-release-mainline-closure-cockpit]'
        )
    );
}

function pickArray(...candidates) {
    for (const candidate of candidates) {
        if (Array.isArray(candidate) && candidate.length > 0) {
            return candidate;
        }
    }

    return null;
}

export function buildQueueMainlineClosureCockpitInput(
    manifest,
    detectedPlatform,
    deps = {}
) {
    const state = asObject(getState().data || {});
    const currentSnapshot = asObject(
        deps.currentSnapshot ||
            state.turneroReleaseEvidenceBundle ||
            state.turneroReleaseSnapshot ||
            state.currentSnapshot ||
            {}
    );
    const clinicProfile = asObject(
        deps.clinicProfile ||
            currentSnapshot.turneroClinicProfile ||
            currentSnapshot.clinicProfile ||
            state.turneroClinicProfile ||
            {}
    );
    const region = toText(
        deps.region ||
            currentSnapshot.region ||
            clinicProfile.region ||
            clinicProfile.address?.region ||
            'regional',
        'regional'
    );
    const scope = toText(deps.scope || region, region || 'regional');
    const clinicId = toText(
        deps.clinicId ||
            currentSnapshot.clinicId ||
            clinicProfile.clinic_id ||
            clinicProfile.clinicId ||
            '',
        ''
    );
    const clinicLabel = toText(
        deps.clinicLabel ||
            currentSnapshot.clinicLabel ||
            currentSnapshot.clinicName ||
            clinicProfile.branding?.name ||
            clinicProfile.branding?.short_name ||
            clinicId ||
            region,
        region
    );
    const clinicShortName = toText(
        deps.clinicShortName ||
            currentSnapshot.clinicShortName ||
            clinicProfile.branding?.short_name ||
            clinicProfile.branding?.name ||
            clinicLabel,
        clinicLabel
    );
    const surfaces =
        pickArray(deps.surfaces, currentSnapshot.surfaces) ||
        DEFAULT_MAINLINE_CLOSURE_SURFACES;
    const runtimeRows =
        pickArray(
            deps.runtimeRows,
            currentSnapshot.runtimeRows,
            currentSnapshot.surfaceRows
        ) || DEFAULT_MAINLINE_CLOSURE_RUNTIME_ROWS;
    const auditRows =
        pickArray(
            deps.auditRows,
            currentSnapshot.auditRows,
            currentSnapshot.surfaceAuditRows
        ) || DEFAULT_MAINLINE_CLOSURE_AUDIT_ROWS;

    return {
        manifest,
        detectedPlatform,
        scope,
        region,
        clinicId,
        clinicLabel,
        clinicShortName,
        clinicProfile,
        currentSnapshot,
        surfaces,
        runtimeRows,
        auditRows,
    };
}

export function wireTurneroMainlineClosureCockpit({
    mountNode,
    manifest,
    detectedPlatform,
    ...deps
} = {}) {
    const host = resolveMainlineClosureCockpitHost(mountNode);
    if (!isDomElement(host)) {
        return null;
    }

    return mountTurneroReleaseMainlineClosureCockpit(
        host,
        buildQueueMainlineClosureCockpitInput(manifest, detectedPlatform, deps)
    );
}

export function renderQueueMainlineClosureCockpit(
    manifest,
    detectedPlatform,
    deps = {}
) {
    return wireTurneroMainlineClosureCockpit({
        manifest,
        detectedPlatform,
        ...deps,
    });
}
