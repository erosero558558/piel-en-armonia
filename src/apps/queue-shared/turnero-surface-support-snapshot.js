import { normalizeTurneroSurfaceRecoveryKey } from './turnero-surface-contract-snapshot.js';
import { asObject, toString } from './turnero-surface-helpers.js';
import {
    normalizeTurneroSurfaceSupportBackupMode,
    normalizeTurneroSurfaceSupportMaintenanceWindow,
    summarizeTurneroSurfaceSupportContacts,
    summarizeTurneroSurfaceSupportEscalations,
} from './turnero-surface-support-checklist.js';

const SUPPORT_SURFACE_LABELS = Object.freeze({
    admin: 'Admin',
    operator: 'Operator',
    kiosk: 'Kiosk',
    display: 'Display',
});

function resolveSupportScope(inputScope, clinicProfile) {
    return toString(
        inputScope ||
            clinicProfile?.region ||
            clinicProfile?.branding?.city ||
            'queue-support',
        'queue-support'
    );
}

function resolveSurfaceLabel(clinicProfile, surfaceKey) {
    const normalizedSurfaceKey = normalizeTurneroSurfaceRecoveryKey(surfaceKey);
    const profileSurface =
        clinicProfile?.surfaces &&
        typeof clinicProfile.surfaces === 'object' &&
        clinicProfile.surfaces[normalizedSurfaceKey]
            ? clinicProfile.surfaces[normalizedSurfaceKey]
            : null;

    return toString(
        profileSurface?.label ||
            profileSurface?.short_label ||
            SUPPORT_SURFACE_LABELS[normalizedSurfaceKey] ||
            normalizedSurfaceKey,
        SUPPORT_SURFACE_LABELS[normalizedSurfaceKey] || normalizedSurfaceKey
    );
}

function resolveSurfaceRoute(clinicProfile, surfaceKey) {
    const normalizedSurfaceKey = normalizeTurneroSurfaceRecoveryKey(surfaceKey);
    const profileSurface =
        clinicProfile?.surfaces &&
        typeof clinicProfile.surfaces === 'object' &&
        clinicProfile.surfaces[normalizedSurfaceKey]
            ? clinicProfile.surfaces[normalizedSurfaceKey]
            : null;
    return toString(profileSurface?.route || '');
}

function normalizeRoute(value) {
    return toString(value).trim().replace(/\s+/g, '').replace(/\/+$/, '');
}

function resolveCurrentRoute(value) {
    const direct = toString(value);
    if (direct) {
        return direct;
    }

    if (
        typeof window !== 'undefined' &&
        window.location &&
        typeof window.location.pathname === 'string'
    ) {
        return `${window.location.pathname || ''}${window.location.hash || ''}`;
    }

    return '';
}

function resolveSupportState(snapshot) {
    const openEscalations = Number(snapshot.openEscalations || 0) || 0;
    const contactSummary = asObject(snapshot.contactSummary);
    const maintenanceState = toString(
        snapshot.maintenanceWindow?.state,
        'ready'
    );
    const backupState = toString(snapshot.backupMode?.state, 'ready');
    const routeMatch =
        typeof snapshot.routeMatch === 'boolean' ? snapshot.routeMatch : true;

    if (openEscalations >= 2) {
        return 'blocked';
    }
    if (
        contactSummary.active === 0 ||
        maintenanceState === 'degraded' ||
        backupState === 'degraded'
    ) {
        return 'degraded';
    }
    if (
        contactSummary.primary === 0 ||
        contactSummary.backup === 0 ||
        openEscalations === 1 ||
        maintenanceState === 'watch' ||
        backupState === 'watch' ||
        routeMatch === false
    ) {
        return 'watch';
    }
    return 'ready';
}

function buildSupportSummary(snapshot) {
    const state = resolveSupportState(snapshot);

    switch (state) {
        case 'blocked':
            return '2 escalaciones abiertas bloquean el soporte.';
        case 'degraded':
            return 'La cobertura de soporte esta degradada.';
        case 'watch':
            return 'La cobertura de soporte requiere observacion.';
        default:
            return 'Soporte listo.';
    }
}

function buildSupportDetail(snapshot) {
    const contactSummary = asObject(snapshot.contactSummary);
    const escalationSummary = asObject(snapshot.escalationSummary);
    const maintenance = asObject(snapshot.maintenanceWindow);
    const backup = asObject(snapshot.backupMode);
    const lines = [
        `${Number(contactSummary.active || 0)} contacto(s) activo(s)`,
        `${Number(contactSummary.primary || 0)} primario(s)`,
        `${Number(contactSummary.backup || 0)} respaldo(s)`,
        `${Number(escalationSummary.open || 0)} escalacion(es) abierta(s)`,
        `mantenimiento ${toString(maintenance.state, 'ready')}`,
        `backup ${toString(backup.state, 'ready')}`,
    ];

    if (snapshot.routeMatch === false) {
        lines.push('ruta fuera de canon');
    }

    return lines.join(' · ');
}

export function buildTurneroSurfaceSupportSnapshot(input = {}) {
    const clinicProfile = asObject(input.clinicProfile);
    const scope = resolveSupportScope(input.scope, clinicProfile);
    const surfaceKey = normalizeTurneroSurfaceRecoveryKey(
        input.surfaceKey || input.surface || 'admin'
    );
    const surfaceLabel = toString(
        input.surfaceLabel ||
            resolveSurfaceLabel(clinicProfile, surfaceKey) ||
            surfaceKey,
        surfaceKey
    );
    const clinicId = toString(
        clinicProfile.clinic_id || clinicProfile.clinicId,
        'default-clinic'
    );
    const clinicName = toString(
        clinicProfile?.branding?.name || clinicProfile?.branding?.short_name,
        'Aurora Derm'
    );
    const clinicShortName = toString(
        clinicProfile?.branding?.short_name || clinicName,
        clinicName
    );
    const contactStoreSnapshot =
        input.contactStore && typeof input.contactStore.snapshot === 'function'
            ? input.contactStore.snapshot()
            : {
                  scope,
                  clinicId,
                  contacts: [],
                  activeContacts: [],
                  summary: summarizeTurneroSurfaceSupportContacts([]),
                  generatedAt: new Date().toISOString(),
              };
    const escalationLedgerSnapshot =
        input.escalationLedger &&
        typeof input.escalationLedger.snapshot === 'function'
            ? input.escalationLedger.snapshot()
            : {
                  scope,
                  clinicId,
                  escalations: [],
                  openEscalations: [],
                  summary: summarizeTurneroSurfaceSupportEscalations([]),
                  generatedAt: new Date().toISOString(),
              };
    const allContacts = Array.isArray(input.contacts)
        ? input.contacts
        : Array.isArray(contactStoreSnapshot.contacts)
          ? contactStoreSnapshot.contacts
          : [];
    const activeContacts = Array.isArray(input.activeContacts)
        ? input.activeContacts
        : Array.isArray(contactStoreSnapshot.activeContacts)
          ? contactStoreSnapshot.activeContacts
          : allContacts.filter((contact) => {
                const state = toString(contact?.state, 'active').toLowerCase();
                return ![
                    'inactive',
                    'archived',
                    'disabled',
                    'hidden',
                    'removed',
                ].includes(state);
            });
    const allEscalations = Array.isArray(input.escalations)
        ? input.escalations
        : Array.isArray(escalationLedgerSnapshot.escalations)
          ? escalationLedgerSnapshot.escalations
          : [];
    const openEscalations = Array.isArray(input.openEscalations)
        ? input.openEscalations
        : Array.isArray(escalationLedgerSnapshot.openEscalations)
          ? escalationLedgerSnapshot.openEscalations
          : allEscalations.filter((escalation) => {
                const state = toString(escalation?.state, 'open').toLowerCase();
                return !['closed', 'resolved', 'dismissed'].includes(state);
            });
    const contactSummary = summarizeTurneroSurfaceSupportContacts(allContacts);
    const escalationSummary =
        summarizeTurneroSurfaceSupportEscalations(allEscalations);
    const maintenanceWindow = normalizeTurneroSurfaceSupportMaintenanceWindow(
        input.maintenanceWindow ||
            clinicProfile?.maintenanceWindow ||
            clinicProfile?.release?.maintenanceWindow ||
            {}
    );
    const backupMode = normalizeTurneroSurfaceSupportBackupMode(
        input.backupMode ||
            clinicProfile?.backupMode ||
            clinicProfile?.release?.backupMode ||
            {},
        clinicProfile
    );
    const currentRoute = resolveCurrentRoute(input.currentRoute);
    const expectedRoute = resolveSurfaceRoute(clinicProfile, surfaceKey);
    const routeMatch = expectedRoute
        ? normalizeRoute(currentRoute) === normalizeRoute(expectedRoute)
        : true;
    const snapshot = {
        scope,
        clinicId,
        clinicName,
        clinicShortName,
        surfaceKey,
        surfaceLabel,
        expectedRoute,
        currentRoute,
        routeMatch,
        contactStore: {
            ...asObject(contactStoreSnapshot),
            contacts: allContacts,
            activeContacts,
            summary: contactSummary,
        },
        escalationLedger: {
            ...asObject(escalationLedgerSnapshot),
            escalations: allEscalations,
            openEscalations,
            summary: escalationSummary,
        },
        contacts: activeContacts,
        allContacts,
        contactSummary,
        escalations: openEscalations,
        allEscalations,
        escalationSummary,
        openEscalations: Array.isArray(openEscalations)
            ? openEscalations.length
            : Number(escalationSummary.open || 0) || 0,
        maintenanceWindow,
        backupMode,
        state: 'ready',
        summary: '',
        detail: '',
        generatedAt: new Date().toISOString(),
    };

    snapshot.state = resolveSupportState(snapshot);
    snapshot.summary = buildSupportSummary(snapshot);
    snapshot.detail = buildSupportDetail(snapshot);

    return snapshot;
}

export {
    buildSupportDetail as formatTurneroSurfaceSupportSnapshotDetail,
    buildSupportSummary as formatTurneroSurfaceSupportSnapshotSummary,
    resolveSupportScope as normalizeTurneroSurfaceSupportScope,
    resolveSurfaceLabel as resolveTurneroSurfaceSupportLabel,
};
