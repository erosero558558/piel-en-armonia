import { buildTurneroSurfaceExpansionGate } from './turnero-surface-expansion-gate.js';
import { buildTurneroSurfaceExpansionReadout } from './turnero-surface-expansion-readout.js';
import { buildTurneroSurfaceExpansionSnapshot } from './turnero-surface-expansion-snapshot.js';

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function toArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function toString(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function resolveChecklistDefaults(surfaceKey) {
    const normalizedSurfaceKey = toString(surfaceKey, 'surface');
    if (normalizedSurfaceKey === 'kiosk') {
        return { all: 4, pass: 2, fail: 2 };
    }
    if (normalizedSurfaceKey === 'admin') {
        return { all: 6, pass: 4, fail: 2 };
    }
    return { all: 4, pass: 3, fail: 1 };
}

function normalizeChecklist(input = {}, surfaceKey = '') {
    const source = asObject(input);
    const summary = asObject(source.summary);
    const defaults = resolveChecklistDefaults(surfaceKey);

    return {
        all: Math.max(0, Number(summary.all ?? defaults.all) || 0),
        pass: Math.max(0, Number(summary.pass ?? defaults.pass) || 0),
        fail: Math.max(0, Number(summary.fail ?? defaults.fail) || 0),
        checks: Array.isArray(source.checks)
            ? source.checks.filter(Boolean)
            : [],
    };
}

function buildBriefLines(pack = {}) {
    const snapshot = asObject(pack.snapshot);
    const checklist = asObject(pack.checklist);
    const gate = asObject(pack.gate);
    const readout = asObject(pack.readout);
    const ledger = Array.isArray(pack.ledger) ? pack.ledger : [];
    const owners = Array.isArray(pack.owners) ? pack.owners : [];

    const lines = [
        '# Surface Expansion Upsell',
        '',
        `Scope: ${toString(snapshot.scope, 'regional')}`,
        `Clinic: ${toString(
            snapshot.clinicLabel,
            snapshot.clinicId || 'default-clinic'
        )}`,
        `Surface: ${toString(
            snapshot.surfaceLabel,
            snapshot.surfaceKey || 'surface'
        )}`,
        `Gate: ${Number(gate.score || 0) || 0} (${toString(gate.band, 'watch')})`,
        `Decision: ${toString(gate.decision, 'review-expansion-opportunities')}`,
        `Summary: ${toString(readout.summary, gate.summary || '')}`,
        `Detail: ${toString(readout.detail, gate.detail || '')}`,
        '',
        `Checklist: ${Number(checklist.pass || 0)}/${Number(
            checklist.all || 0
        )} pass`,
        `Demand: ${toString(snapshot.demandSignal, 'none')}`,
        `Expansion: ${toString(snapshot.opportunityState, 'watch')}`,
        `Gap: ${toString(snapshot.gapState, 'sin gap') || 'sin gap'}`,
        `Owner: ${toString(snapshot.expansionOwner, 'sin owner') || 'sin owner'}`,
        `Next module: ${toString(snapshot.nextModuleHint, 'sin siguiente modulo') || 'sin siguiente modulo'}`,
        '',
        '## Ledger',
    ];

    if (ledger.length === 0) {
        lines.push('Sin expansion items registrados.');
    } else {
        ledger.forEach((entry) => {
            lines.push(
                `- [${toString(entry.status, 'watch')}] ${toString(
                    entry.surfaceKey,
                    'surface'
                )} · ${toString(entry.kind, 'module-hint')} · ${toString(
                    entry.owner,
                    'ops'
                )} · ${toString(entry.title, 'Expansion item')} · ${toString(entry.note, '')}`
            );
        });
    }

    lines.push('', '## Owners');
    if (owners.length === 0) {
        lines.push('Sin owners registrados.');
    } else {
        owners.forEach((entry) => {
            lines.push(
                `- [${toString(entry.status, 'active')}] ${toString(
                    entry.surfaceKey,
                    'surface'
                )} · ${toString(entry.actor, 'owner')} · ${toString(
                    entry.role,
                    'expansion'
                )} · ${toString(entry.note, '')}`
            );
        });
    }

    return lines.join('\n').trim();
}

function resolvePackInput(input = {}) {
    if (
        input &&
        typeof input === 'object' &&
        input.snapshot &&
        input.checklist &&
        input.gate &&
        input.readout
    ) {
        return input;
    }

    return buildTurneroSurfaceExpansionPack(input);
}

export function buildTurneroSurfaceExpansionPack(input = {}) {
    const snapshot = buildTurneroSurfaceExpansionSnapshot(input);
    const checklist = normalizeChecklist(input.checklist, snapshot.surfaceKey);
    const ledger = toArray(input.ledger);
    const owners = toArray(input.owners);
    const gate =
        input.gate && typeof input.gate === 'object'
            ? {
                  ...input.gate,
                  band: toString(input.gate.band, 'degraded'),
                  score: Number(input.gate.score || 0) || 0,
                  decision: toString(
                      input.gate.decision,
                      input.gate.band === 'ready'
                          ? 'expansion-ready'
                          : input.gate.band === 'watch'
                            ? 'review-expansion-opportunities'
                            : input.gate.band === 'degraded'
                              ? 'stabilize-expansion-readiness'
                              : 'hold-expansion-readiness'
                  ),
              }
            : buildTurneroSurfaceExpansionGate({
                  snapshot,
                  checklist,
                  ledger,
                  owners,
              });
    const readout = buildTurneroSurfaceExpansionReadout({
        snapshot,
        gate,
        checklist,
        ledger,
        owners,
    });

    return {
        surfaceKey: snapshot.surfaceKey,
        snapshot,
        checklist,
        ledger,
        owners,
        gate,
        readout,
        brief: buildBriefLines({
            snapshot,
            checklist,
            ledger,
            owners,
            gate,
            readout,
        }),
        generatedAt: new Date().toISOString(),
    };
}

export function formatTurneroSurfaceExpansionBrief(input = {}) {
    const pack = resolvePackInput(input);
    return toString(pack.brief, buildBriefLines(pack));
}
