import { asObject, toArray, toString } from './turnero-surface-helpers.js';

function normalizeChipState(value) {
    const normalized = toString(value).toLowerCase();
    switch (normalized) {
        case 'ready':
            return 'ready';
        case 'watch':
            return 'warning';
        case 'degraded':
        case 'blocked':
        case 'alert':
            return 'alert';
        default:
            return 'warning';
    }
}

function normalizeScoreState(score) {
    const value = Number(score || 0) || 0;
    if (value >= 90) {
        return 'ready';
    }
    if (value >= 70) {
        return 'warning';
    }
    return 'alert';
}

function buildChip(label, value, state) {
    return {
        label,
        value: toString(value, '--'),
        state: normalizeChipState(state),
    };
}

function summarize(snapshot, gate) {
    const checklist = asObject(
        snapshot.checklist?.summary || snapshot.checklist
    );
    const evidenceSummary = asObject(snapshot.evidenceSummary);
    const signoffSummary = asObject(snapshot.signoffSummary);
    const owner = toString(snapshot.acceptanceOwner || '');
    const checklistLabel = `${Number(checklist.pass || 0) || 0}/${
        Number(checklist.all || 0) || 0
    }`;

    if (gate.band === 'blocked') {
        return `Aceptación bloqueada · ${
            gate.primaryIssue?.detail ||
            gate.primaryIssue?.label ||
            snapshot.contractDetail ||
            'Revisa la superficie antes de firmar.'
        }`;
    }

    if (gate.band === 'degraded') {
        return `Aceptación degradada · ${
            gate.primaryIssue?.detail ||
            gate.primaryIssue?.label ||
            'Hay señales degradadas en runtime, sitio o entrenamiento.'
        }`;
    }

    if (gate.band === 'watch') {
        return `Aceptación bajo observacion · ${
            gate.primaryIssue?.detail ||
            (owner
                ? `Owner ${owner}`
                : 'Aun faltan aprobaciones o señales por cerrar.')
        }`;
    }

    return `Aceptación lista · ${checklistLabel} checklist · ${Number(
        evidenceSummary.total || 0
    )} evidencia(s) · ${Number(signoffSummary.approve || 0) || 0} signoff(s).`;
}

function buildDetail(snapshot) {
    const contractDetail = toString(snapshot.contractDetail || '');
    const runtimeDetail = toString(snapshot.runtime?.summary || '');
    const siteDetail = toString(snapshot.site?.summary || '');
    const trainingDetail = toString(snapshot.training?.summary || '');
    const checklist = asObject(
        snapshot.checklist?.summary || snapshot.checklist
    );
    const evidenceSummary = asObject(snapshot.evidenceSummary);
    const signoffSummary = asObject(snapshot.signoffSummary);
    const detailParts = [
        contractDetail,
        runtimeDetail,
        siteDetail,
        trainingDetail,
        `${Number(checklist.pass || 0) || 0}/${Number(checklist.all || 0) || 0} checklist`,
        `${Number(evidenceSummary.total || 0) || 0} evidencia(s)`,
        `${Number(signoffSummary.approve || 0) || 0} approve(s)`,
        `${Number(signoffSummary.reject || 0) || 0} reject(s)`,
    ].filter(Boolean);

    return detailParts.join(' · ');
}

function buildGeneratedAtLabel(value) {
    if (!value) {
        return '';
    }

    try {
        return new Intl.DateTimeFormat('es-EC', {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(new Date(value));
    } catch (_error) {
        return toString(value);
    }
}

export function buildTurneroSurfaceAcceptanceReadout(input = {}) {
    const snapshot = asObject(input.snapshot);
    const gate = asObject(input.gate);
    const surfaceKey = toString(
        snapshot.surfaceKey || input.surfaceKey,
        'operator'
    );
    const surfaceLabel = toString(
        snapshot.surfaceLabel ||
            snapshot.profile?.surfaceLabel ||
            snapshot.profile?.surfaceKey ||
            surfaceKey
    );
    const clinicName = toString(
        snapshot.profile?.clinicName ||
            snapshot.clinicName ||
            snapshot.clinicProfile?.branding?.name ||
            ''
    );
    const clinicShortName = toString(
        snapshot.profile?.clinicShortName ||
            snapshot.clinicShortName ||
            snapshot.clinicProfile?.branding?.short_name ||
            clinicName
    );
    const acceptanceOwner = toString(snapshot.acceptanceOwner || '');
    const checklist = asObject(
        snapshot.checklist?.summary || snapshot.checklist
    );
    const evidenceSummary = asObject(snapshot.evidenceSummary);
    const signoffSummary = asObject(snapshot.signoffSummary);
    const generatedAt =
        gate.generatedAt || snapshot.generatedAt || new Date().toISOString();
    const badge = `${toString(gate.band || 'watch')} · ${Number(gate.score || 0) || 0}`;
    const summary = summarize(snapshot, gate);
    const detail = buildDetail(snapshot);
    const truthState = toString(
        snapshot.truth?.state || snapshot.truthState || 'watch'
    );
    const runtimeState = toString(
        snapshot.runtime?.state || snapshot.runtimeState || 'watch'
    );
    const siteState = toString(
        snapshot.site?.state || snapshot.siteStatus || 'watch'
    );
    const trainingState = toString(
        snapshot.training?.state || snapshot.trainingStatus || 'watch'
    );
    const checklistLabel = `${Number(checklist.pass || 0) || 0}/${
        Number(checklist.all || 0) || 0
    }`;
    const evidenceLabel = `${Number(evidenceSummary.total || 0) || 0}`;
    const signoffLabel = `${Number(signoffSummary.approve || 0) || 0}/${
        Number(signoffSummary.total || 0) || 0
    }`;

    return {
        surfaceKey,
        surfaceLabel,
        clinicName,
        clinicShortName,
        acceptanceOwner,
        truthState,
        runtimeState,
        siteState,
        trainingState,
        signoffMode: toString(snapshot.signoffMode || 'manual', 'manual'),
        checklistSummary: checklistLabel,
        evidenceSummary,
        signoffSummary,
        gateBand: toString(gate.band || 'watch'),
        gateScore: Number(gate.score || 0) || 0,
        gateTone: normalizeChipState(gate.band || 'watch'),
        summary,
        detail,
        badge,
        chips: [
            buildChip(
                'owner',
                acceptanceOwner || 'none',
                acceptanceOwner ? 'ready' : 'watch'
            ),
            buildChip('acceptance', gate.band || 'watch', gate.band || 'watch'),
            buildChip(
                'score',
                String(Number(gate.score || 0) || 0),
                normalizeScoreState(gate.score)
            ),
            buildChip(
                'checklist',
                checklistLabel,
                gate.checklistState || checklist.state || 'watch'
            ),
            buildChip(
                'evidence',
                evidenceLabel,
                gate.evidenceState || evidenceSummary.state || 'watch'
            ),
            buildChip(
                'signoffs',
                signoffLabel,
                gate.signoffState || signoffSummary.state || 'watch'
            ),
        ],
        primaryIssue: toString(
            gate.primaryIssue?.detail || gate.primaryIssue?.label || ''
        ),
        notes: toArray(gate.checks).map((check) => ({
            ...check,
        })),
        generatedAt,
        generatedAtLabel: buildGeneratedAtLabel(generatedAt),
    };
}

export function formatTurneroSurfaceAcceptanceReadoutBrief(readout = {}) {
    const info = asObject(readout);
    const checklist = toString(info.checklistSummary, '0/0');
    const evidence = toString(info.evidenceSummary?.total || 0, '0');
    const signoffs = `${Number(info.signoffSummary?.approve || 0) || 0}/${
        Number(info.signoffSummary?.total || 0) || 0
    }`;

    return [
        '# Surface acceptance',
        '',
        `Scope: ${toString(info.surfaceKey, 'operator')}`,
        `Clinic: ${toString(info.clinicShortName || info.clinicName, 'sin-clinica')}`,
        `Gate: ${toString(info.gateBand, 'watch')} (${Number(info.gateScore || 0) || 0})`,
        `Owner: ${toString(info.acceptanceOwner || 'none')}`,
        `Truth: ${toString(info.truthState || 'watch')} · Runtime: ${toString(
            info.runtimeState || 'watch'
        )} · Site: ${toString(info.siteState || 'watch')} · Training: ${toString(
            info.trainingState || 'watch'
        )}`,
        `Checklist: ${checklist} · Evidence: ${evidence} · Signoffs: ${signoffs}`,
        '',
        toString(info.summary || ''),
        toString(info.detail || ''),
    ]
        .filter(Boolean)
        .join('\n')
        .trim();
}

export default buildTurneroSurfaceAcceptanceReadout;
