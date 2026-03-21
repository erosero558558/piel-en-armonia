import { asObject, toString } from './turnero-surface-helpers.js';
import {
    buildTurneroSurfaceSupportChecklist,
    normalizeTurneroSurfaceSupportBackupMode,
    normalizeTurneroSurfaceSupportMaintenanceWindow,
} from './turnero-surface-support-checklist.js';

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function countChecklistStates(checklist = {}) {
    const items = Array.isArray(checklist.checks) ? checklist.checks : [];
    return items.reduce(
        (accumulator, item) => {
            const state = toString(item?.state, 'warn').toLowerCase();
            accumulator.all += 1;
            if (state === 'pass') {
                accumulator.pass += 1;
            } else if (state === 'warn') {
                accumulator.warn += 1;
            } else {
                accumulator.fail += 1;
            }
            return accumulator;
        },
        {
            all: 0,
            pass: 0,
            warn: 0,
            fail: 0,
            score: Number(checklist.summary?.score || 0) || 0,
        }
    );
}

function resolveSnapshot(input = {}) {
    const snapshot = asObject(input.snapshot);
    const contactSummary = asObject(snapshot.contactSummary);
    const escalationSummary = asObject(snapshot.escalationSummary);
    const maintenanceWindow = normalizeTurneroSurfaceSupportMaintenanceWindow(
        snapshot.maintenanceWindow || input.maintenanceWindow || {}
    );
    const backupMode = normalizeTurneroSurfaceSupportBackupMode(
        snapshot.backupMode || input.backupMode || {},
        snapshot.clinicProfile || input.clinicProfile || null
    );

    return {
        ...snapshot,
        contactSummary,
        escalationSummary,
        maintenanceWindow,
        backupMode,
    };
}

function resolveBand(score, counts, snapshot) {
    const openEscalations = Number(snapshot.openEscalations || 0) || 0;
    const contactSummary = asObject(snapshot.contactSummary);
    const maintenanceState = toString(
        snapshot.maintenanceWindow?.state,
        'ready'
    );
    const backupState = toString(snapshot.backupMode?.state, 'ready');

    if (openEscalations >= 2) {
        return 'blocked';
    }

    if (
        counts.fail > 0 ||
        contactSummary.active === 0 ||
        maintenanceState === 'degraded' ||
        backupState === 'degraded' ||
        score < 45
    ) {
        return 'degraded';
    }

    if (
        counts.warn > 0 ||
        openEscalations === 1 ||
        contactSummary.primary === 0 ||
        contactSummary.backup === 0 ||
        maintenanceState === 'watch' ||
        backupState === 'watch' ||
        score < 80
    ) {
        return 'watch';
    }

    return 'ready';
}

function buildSummaryText(band) {
    if (band === 'blocked') {
        return '2 escalaciones abiertas bloquean el soporte.';
    }
    if (band === 'degraded') {
        return 'Soporte degradado; requiere estabilizacion.';
    }
    if (band === 'watch') {
        return 'Cobertura parcial o mantenimiento bajo observacion.';
    }

    return 'Soporte listo.';
}

function buildDecision(band) {
    switch (band) {
        case 'ready':
            return 'support-ready';
        case 'watch':
            return 'support-monitor';
        case 'degraded':
            return 'support-stabilize';
        default:
            return 'support-escalate';
    }
}

function buildBlockers(snapshot) {
    const blockers = [];
    const contactSummary = asObject(snapshot.contactSummary);
    const maintenanceState = toString(
        snapshot.maintenanceWindow?.state,
        'ready'
    );
    const backupState = toString(snapshot.backupMode?.state, 'ready');

    if ((Number(snapshot.openEscalations || 0) || 0) >= 2) {
        blockers.push('open-escalations');
    }
    if (contactSummary.active === 0) {
        blockers.push('contact-roster-empty');
    }
    if (maintenanceState === 'degraded') {
        blockers.push('maintenance-degraded');
    }
    if (backupState === 'degraded') {
        blockers.push('backup-degraded');
    }

    return blockers;
}

function buildWarnings(snapshot) {
    const warnings = [];
    const contactSummary = asObject(snapshot.contactSummary);
    const maintenanceState = toString(
        snapshot.maintenanceWindow?.state,
        'ready'
    );
    const backupState = toString(snapshot.backupMode?.state, 'ready');

    if ((Number(snapshot.openEscalations || 0) || 0) === 1) {
        warnings.push('open-escalation');
    }
    if (contactSummary.primary === 0 && contactSummary.active > 0) {
        warnings.push('primary-contact-missing');
    }
    if (contactSummary.backup === 0 && contactSummary.active > 1) {
        warnings.push('backup-contact-missing');
    }
    if (maintenanceState === 'watch') {
        warnings.push('maintenance-watch');
    }
    if (backupState === 'watch') {
        warnings.push('backup-watch');
    }

    return warnings;
}

export function buildTurneroSurfaceSupportGate(input = {}) {
    const snapshot = resolveSnapshot(input);
    const checklist =
        input.checklist && typeof input.checklist === 'object'
            ? input.checklist
            : buildTurneroSurfaceSupportChecklist({
                  snapshot,
                  contacts: snapshot.allContacts || snapshot.contacts || [],
                  escalations:
                      snapshot.allEscalations || snapshot.escalations || [],
                  maintenanceWindow: snapshot.maintenanceWindow,
                  backupMode: snapshot.backupMode,
                  clinicProfile:
                      snapshot.clinicProfile || input.clinicProfile || null,
                  surfaceKey:
                      snapshot.surfaceKey || input.surfaceKey || 'admin',
              });
    const counts = countChecklistStates(checklist);
    const contactSummary = asObject(snapshot.contactSummary);
    const escalationSummary = asObject(snapshot.escalationSummary);
    const score = clamp(
        Math.round(
            counts.score -
                Math.min(
                    (Number(snapshot.openEscalations || 0) || 0) * 10,
                    24
                ) -
                (contactSummary.primary === 0 ? 10 : 0) -
                (contactSummary.backup === 0 ? 8 : 0) -
                (contactSummary.active === 0 ? 18 : 0) -
                (toString(snapshot.maintenanceWindow?.state, 'ready') ===
                'watch'
                    ? 6
                    : toString(snapshot.maintenanceWindow?.state, 'ready') ===
                        'degraded'
                      ? 12
                      : 0) -
                (toString(snapshot.backupMode?.state, 'ready') === 'watch'
                    ? 6
                    : toString(snapshot.backupMode?.state, 'ready') ===
                        'degraded'
                      ? 12
                      : 0)
        ),
        0,
        100
    );
    const band = resolveBand(score, counts, snapshot);
    const blockers = buildBlockers(snapshot);
    const warnings = buildWarnings(snapshot);

    return {
        scope: toString(snapshot.scope, 'queue-support'),
        surfaceKey: toString(snapshot.surfaceKey, 'admin'),
        score,
        band,
        decision: buildDecision(band),
        checklistSummary: counts,
        contactSummary,
        escalationSummary,
        openEscalations: Number(snapshot.openEscalations || 0) || 0,
        maintenanceState: toString(snapshot.maintenanceWindow?.state, 'ready'),
        backupState: toString(snapshot.backupMode?.state, 'ready'),
        blockers: band === 'ready' ? [] : blockers,
        warnings: band === 'ready' ? [] : warnings,
        summary: buildSummaryText(band),
        detail: toString(snapshot.detail || ''),
        generatedAt: new Date().toISOString(),
    };
}

export {
    resolveBand as resolveTurneroSurfaceSupportBand,
    buildDecision as resolveTurneroSurfaceSupportDecision,
};
