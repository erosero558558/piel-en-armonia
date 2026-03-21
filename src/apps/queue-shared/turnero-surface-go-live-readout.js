import {
    asObject,
    formatTimestamp,
    toArray,
    toString,
} from './turnero-surface-helpers.js';

function normalizeText(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function resolveTone(band) {
    const normalized = normalizeText(band, 'degraded').toLowerCase();
    if (normalized === 'ready') {
        return 'ready';
    }
    if (normalized === 'watch') {
        return 'warning';
    }
    return 'alert';
}

function buildSummary(gate, checklist, evidence) {
    const all = Number(checklist.summary?.all || 0) || 0;
    const pass = Number(checklist.summary?.pass || 0) || 0;
    const readyEvidenceCount = Number(gate.readyEvidenceCount || 0) || 0;
    const evidenceCount =
        Number(evidence.length || gate.evidenceCount || 0) || 0;

    if (gate.band === 'ready') {
        return `Go-live listo. Checklist ${pass}/${all} y evidencia ${readyEvidenceCount}/${evidenceCount}.`;
    }
    if (gate.band === 'watch') {
        return `Go-live en observacion. Checklist ${pass}/${all} y evidencia ${readyEvidenceCount}/${evidenceCount}.`;
    }
    if (gate.band === 'degraded') {
        return `Go-live degradado. Checklist ${pass}/${all} y evidencia ${readyEvidenceCount}/${evidenceCount}.`;
    }
    return `Go-live bloqueado. Checklist ${pass}/${all} y evidencia ${readyEvidenceCount}/${evidenceCount}.`;
}

function buildDetail(snapshot, failedChecks = []) {
    const parts = [
        `Runtime ${toString(snapshot.runtimeState, 'unknown')}`,
        `truth ${toString(snapshot.truth, 'unknown')}`,
        `printer ${toString(snapshot.printerState, 'unknown')}`,
        `bell ${toString(snapshot.bellState, 'unknown')}`,
        `signage ${toString(snapshot.signageState, 'unknown')}`,
        `operator ${snapshot.operatorReady ? 'ready' : 'pending'}`,
    ];

    if (failedChecks.length > 0) {
        parts.push(`pendientes ${failedChecks.join(', ')}`);
    }

    return parts.join(' · ');
}

function buildBrief(state) {
    const lines = [
        '# Surface Go-Live Readiness',
        '',
        `Surface: ${toString(state.surfaceLabel, state.surfaceKey)}`,
        `Clinic: ${toString(state.clinicLabel, state.clinicId || 'n/a')}`,
        `Scope: ${toString(state.scope, 'global')}`,
        `Gate: ${toString(state.gateBand, 'unknown')} (${Number(
            state.gateScore || 0
        )})`,
        `Decision: ${toString(state.gateDecision, 'review')}`,
        '',
        '## Checklist',
    ];

    if (state.checklist.checks.length === 0) {
        lines.push('- Sin checks.');
    } else {
        state.checklist.checks.forEach((check) => {
            lines.push(
                `- [${check.pass ? 'x' : ' '}] ${toString(check.label, check.key)}`
            );
        });
    }

    lines.push('', '## Evidence');
    if (state.evidence.length === 0) {
        lines.push('- Sin evidencia.');
    } else {
        state.evidence.forEach((entry) => {
            lines.push(
                `- [${toString(entry.status, 'ready')}] ${toString(
                    entry.surfaceKey,
                    'surface'
                )} · ${toString(entry.kind, 'go-live-evidence')} · ${toString(
                    entry.note,
                    ''
                )}`
            );
        });
    }

    return lines.join('\n').trim();
}

function buildSurfaceLabel(snapshot = {}) {
    return toString(snapshot.surfaceLabel, snapshot.surfaceKey || 'surface');
}

export function buildTurneroSurfaceGoLiveReadout(input = {}) {
    const snapshot =
        input.snapshot && typeof input.snapshot === 'object'
            ? input.snapshot
            : {};
    const checklist =
        input.checklist && typeof input.checklist === 'object'
            ? input.checklist
            : {
                  checks: [],
                  summary: {
                      all: 0,
                      pass: 0,
                      fail: 0,
                  },
              };
    const gate = asObject(input.gate);
    const evidence = Array.isArray(input.evidence) ? input.evidence : [];
    const failedChecks = checklist.checks
        .filter((item) => !item.pass)
        .map((item) => item.label || item.key)
        .filter(Boolean);
    const passedChecks = checklist.checks
        .filter((item) => item.pass)
        .map((item) => item.label || item.key)
        .filter(Boolean);

    const gateBand = normalizeText(gate.band, 'degraded');
    const gateScore = Number(gate.score || 0) || 0;

    return {
        surfaceKey: toString(snapshot.surfaceKey, 'surface'),
        surfaceLabel: buildSurfaceLabel(snapshot),
        clinicId: toString(snapshot.clinicId, ''),
        clinicLabel: toString(snapshot.clinicLabel, ''),
        scope: toString(snapshot.scope, 'global'),
        runtimeState: toString(snapshot.runtimeState, 'unknown'),
        truth: toString(snapshot.truth, 'unknown'),
        printerState: toString(snapshot.printerState, 'unknown'),
        bellState: toString(snapshot.bellState, 'unknown'),
        signageState: toString(snapshot.signageState, 'unknown'),
        operatorReady: snapshot.operatorReady === true,
        checklistAll: Number(checklist.summary?.all || 0) || 0,
        checklistPass: Number(checklist.summary?.pass || 0) || 0,
        checklistFail: Number(checklist.summary?.fail || 0) || 0,
        evidenceCount: evidence.length,
        readyEvidenceCount: Number(gate.readyEvidenceCount || 0) || 0,
        failedChecks,
        passedChecks,
        gateBand,
        gateScore,
        gateDecision: toString(gate.decision, 'review'),
        title:
            gateBand === 'ready'
                ? 'Go-live listo'
                : gateBand === 'watch'
                  ? 'Go-live en observacion'
                  : gateBand === 'degraded'
                    ? 'Go-live degradado'
                    : 'Go-live bloqueado',
        summary: buildSummary(gate, checklist, evidence),
        detail: buildDetail(snapshot, failedChecks),
        badge: `${gateBand} · ${gateScore}`,
        tone: resolveTone(gateBand),
        brief: buildBrief({
            ...snapshot,
            gateBand,
            gateScore,
            gateDecision: toString(gate.decision, 'review'),
            checklist,
            evidence,
        }),
        generatedAt: new Date().toISOString(),
    };
}
