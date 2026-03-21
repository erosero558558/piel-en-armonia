import { createTurneroSurfaceEscalationLedger } from './turnero-surface-escalation-ledger.js';
import { createTurneroSurfaceSupportContactStore } from './turnero-surface-support-contact-store.js';
import { buildTurneroSurfaceSupportChecklist } from './turnero-surface-support-checklist.js';
import { buildTurneroSurfaceSupportGate } from './turnero-surface-support-gate.js';
import { buildTurneroSurfaceSupportSnapshot } from './turnero-surface-support-snapshot.js';
import { asObject, toArray, toString } from './turnero-surface-helpers.js';

function resolvePackInput(input = {}) {
    if (
        input &&
        typeof input === 'object' &&
        input.snapshot &&
        input.checklist &&
        input.gate
    ) {
        return input;
    }

    return buildTurneroSurfaceSupportPack(input);
}

function buildSupportReadout(pack = {}) {
    const snapshot = asObject(pack.snapshot);
    const checklist = asObject(pack.checklist);
    const gate = asObject(pack.gate);
    const contactSummary = asObject(snapshot.contactSummary);
    const escalationSummary = asObject(snapshot.escalationSummary);
    const maintenance = asObject(snapshot.maintenanceWindow);
    const backup = asObject(snapshot.backupMode);
    const checklistSummary = asObject(checklist.summary);

    return {
        scope: toString(snapshot.scope, 'queue-support'),
        surfaceKey: toString(snapshot.surfaceKey, 'admin'),
        surfaceLabel: toString(
            snapshot.surfaceLabel,
            snapshot.surfaceKey || 'admin'
        ),
        state: toString(gate.band, 'watch'),
        score: Number(gate.score || 0) || 0,
        decision: toString(gate.decision, 'support-monitor'),
        badge: `${toString(gate.band, 'watch')} · ${Number(gate.score || 0) || 0}`,
        summary: toString(gate.summary || snapshot.summary, 'Soporte listo.'),
        detail: toString(
            snapshot.detail ||
                gate.detail ||
                `${Number(contactSummary.active || 0)} contacto(s) activos · ${Number(
                    escalationSummary.open || 0
                )} escalacion(es) abiertas · mantenimiento ${toString(
                    maintenance.state,
                    'ready'
                )} · backup ${toString(backup.state, 'ready')}`
        ),
        contactsLabel: `${Number(contactSummary.active || 0)}/${Number(
            contactSummary.all || 0
        )} contactos`,
        escalationsLabel: `${Number(escalationSummary.open || 0)}/${Number(
            escalationSummary.all || 0
        )} escalaciones`,
        maintenanceLabel: `${toString(maintenance.state, 'ready')}`,
        backupLabel: `${toString(backup.state, 'ready')}`,
        checklistLabel: `${Number(checklistSummary.pass || 0)}/${Number(
            checklistSummary.all || 0
        )} checks`,
        chips: [
            {
                label: 'Contacts',
                value: `${Number(contactSummary.active || 0)} active`,
                state:
                    Number(contactSummary.active || 0) === 0
                        ? 'alert'
                        : Number(contactSummary.primary || 0) === 0
                          ? 'warning'
                          : 'ready',
            },
            {
                label: 'Escalations',
                value: `${Number(escalationSummary.open || 0)} open`,
                state:
                    Number(escalationSummary.open || 0) >= 2
                        ? 'alert'
                        : Number(escalationSummary.open || 0) === 1
                          ? 'warning'
                          : 'ready',
            },
            {
                label: 'Maintenance',
                value: toString(maintenance.state, 'ready'),
                state:
                    maintenance.state === 'blocked' ||
                    maintenance.state === 'degraded'
                        ? 'alert'
                        : maintenance.state === 'watch'
                          ? 'warning'
                          : 'ready',
            },
            {
                label: 'Backup',
                value: toString(backup.state, 'ready'),
                state:
                    backup.state === 'blocked' || backup.state === 'degraded'
                        ? 'alert'
                        : backup.state === 'watch'
                          ? 'warning'
                          : 'ready',
            },
        ],
    };
}

function buildBriefLines(pack = {}) {
    const snapshot = asObject(pack.snapshot);
    const checklist = asObject(pack.checklist);
    const gate = asObject(pack.gate);
    const readout = asObject(pack.readout);
    const contacts = Array.isArray(snapshot.contacts) ? snapshot.contacts : [];
    const escalations = Array.isArray(snapshot.escalations)
        ? snapshot.escalations
        : [];

    const lines = [
        '# Surface Support Readiness',
        '',
        `Scope: ${toString(snapshot.scope, 'queue-support')}`,
        `Clinic: ${toString(snapshot.clinicName, snapshot.clinicId || 'default-clinic')}`,
        `Surface: ${toString(snapshot.surfaceLabel, snapshot.surfaceKey || 'admin')}`,
        `Gate: ${Number(gate.score || 0) || 0} (${toString(gate.band, 'watch')})`,
        `Decision: ${toString(gate.decision, 'support-monitor')}`,
        `Summary: ${toString(readout.summary, snapshot.summary || '')}`,
        `Detail: ${toString(readout.detail, snapshot.detail || '')}`,
        '',
        '## Contacts',
    ];

    if (contacts.length === 0) {
        lines.push('Sin contactos activos.');
    } else {
        contacts.forEach((contact) => {
            lines.push(
                `- [${toString(contact.priority, 'other')}] ${toString(
                    contact.name,
                    'Support contact'
                )} · ${toString(contact.role, 'ops')} · ${toString(
                    contact.channel,
                    'phone'
                )} · ${toString(contact.phone, '')}`
            );
        });
    }

    lines.push('', '## Escalations');

    if (escalations.length === 0) {
        lines.push('Sin escalaciones abiertas.');
    } else {
        escalations.forEach((escalation) => {
            lines.push(
                `- [${toString(escalation.severity, 'medium')}] ${toString(
                    escalation.surfaceKey,
                    'surface'
                )} · ${toString(escalation.title, '')} · ${toString(
                    escalation.detail,
                    ''
                )}`
            );
        });
    }

    lines.push('', '## Checklist');
    toArray(checklist.checks).forEach((check) => {
        lines.push(
            `- [${toString(check.state, 'warn')}] ${toString(
                check.label,
                check.key || 'check'
            )} · ${toString(check.detail, '')}`
        );
    });

    return lines.join('\n').trim();
}

export function buildTurneroSurfaceSupportPack(input = {}) {
    const clinicProfile = asObject(input.clinicProfile);
    const scope = toString(
        input.scope ||
            clinicProfile.region ||
            clinicProfile.branding?.city ||
            'queue-support',
        'queue-support'
    );
    const contactStore =
        input.contactStore &&
        typeof input.contactStore.list === 'function' &&
        typeof input.contactStore.add === 'function'
            ? input.contactStore
            : createTurneroSurfaceSupportContactStore(scope, clinicProfile);
    const escalationLedger =
        input.escalationLedger &&
        typeof input.escalationLedger.list === 'function' &&
        typeof input.escalationLedger.add === 'function'
            ? input.escalationLedger
            : createTurneroSurfaceEscalationLedger(scope, clinicProfile);
    const snapshot = buildTurneroSurfaceSupportSnapshot({
        ...input,
        scope,
        clinicProfile,
        contactStore,
        escalationLedger,
    });
    const checklist = buildTurneroSurfaceSupportChecklist({
        snapshot,
        contacts: snapshot.allContacts || snapshot.contacts || [],
        escalations: snapshot.allEscalations || snapshot.escalations || [],
        maintenanceWindow: snapshot.maintenanceWindow,
        backupMode: snapshot.backupMode,
        clinicProfile,
        surfaceKey: snapshot.surfaceKey || input.surfaceKey || 'admin',
    });
    const gate = buildTurneroSurfaceSupportGate({
        snapshot,
        checklist,
        clinicProfile,
        surfaceKey: snapshot.surfaceKey || input.surfaceKey || 'admin',
    });
    const pack = {
        scope,
        clinicProfile,
        contactStore,
        escalationLedger,
        snapshot,
        checklist,
        gate,
        readout: null,
        brief: '',
        contacts: snapshot.contacts || [],
        allContacts: snapshot.allContacts || [],
        escalations: snapshot.escalations || [],
        allEscalations: snapshot.allEscalations || [],
        generatedAt: snapshot.generatedAt || new Date().toISOString(),
    };
    pack.readout = buildSupportReadout(pack);
    pack.brief = buildBriefLines(pack);
    return pack;
}

export function formatTurneroSurfaceSupportBrief(input = {}) {
    const pack = resolvePackInput(input);
    return toString(pack.brief, buildBriefLines(pack));
}

export {
    buildSupportReadout as buildTurneroSurfaceSupportReadout,
    buildBriefLines as formatTurneroSurfaceSupportBriefLines,
};
