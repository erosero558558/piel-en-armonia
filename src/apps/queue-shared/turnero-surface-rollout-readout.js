import { asObject, toArray, toString } from './turnero-surface-helpers.js';

function normalizeTone(value) {
    const normalized = toString(value, 'watch').toLowerCase();
    if (normalized === 'ready') {
        return 'ready';
    }
    if (normalized === 'blocked' || normalized === 'alert') {
        return 'alert';
    }
    return 'warning';
}

function resolveChecklistLabel(checklist = {}) {
    const pass = Number(checklist?.summary?.pass || 0) || 0;
    const all = Number(checklist?.summary?.all || 0) || 0;
    const fail = Number(checklist?.summary?.fail || 0) || 0;
    return `${pass}/${all} · ${fail} pendientes`;
}

function resolveManifestLabel(manifest = {}) {
    const state = toString(manifest.state, 'watch');
    const appKey = toString(manifest.appKey || manifest.expectedAppKey, '');
    if (state === 'ready') {
        return `Manifest listo${appKey ? ` · ${appKey}` : ''}`;
    }
    if (state === 'pending') {
        return `Manifest pendiente${appKey ? ` · ${appKey}` : ''}`;
    }
    return `Manifest parcial${appKey ? ` · ${appKey}` : ''}`;
}

function resolveLedgerLabel(ledger = {}) {
    const state = toString(ledger.state, 'watch');
    const total = Number(ledger.totalCount || 0) || 0;
    const open = Number(ledger.openCount || 0) || 0;
    if (state === 'ready') {
        return `Ledger listo · ${total} entradas`;
    }
    if (state === 'blocked') {
        return `Ledger bloqueado · ${total} entradas`;
    }
    return `Ledger en observacion · ${open} abiertas`;
}

function resolveSummary({
    gateBand,
    surfaceLabel,
    clinicShortName,
    checklist,
    manifest,
    ledger,
}) {
    if (gateBand === 'ready') {
        return `${surfaceLabel} listo para ${clinicShortName || 'la clínica'}.`;
    }

    const checklistLabel = resolveChecklistLabel(checklist);
    return `${surfaceLabel} ${gateBand === 'blocked' ? 'bloqueado' : 'en observacion'} · ${checklistLabel} · ${resolveManifestLabel(manifest)} · ${resolveLedgerLabel(ledger)}.`;
}

function resolveDetail({ snapshot, checklist, manifest, ledger, gate }) {
    return [
        `Scope ${toString(snapshot.scope, 'regional')}`,
        `Visita ${toString(snapshot.visitDate, 'pendiente') || 'pendiente'}`,
        `Owner ${toString(snapshot.owner, 'pendiente') || 'pendiente'}`,
        `Asset ${toString(snapshot.assetTag, 'none') || 'none'}`,
        `Station ${toString(snapshot.stationLabel, 'pendiente') || 'pendiente'}`,
        `Install ${toString(snapshot.installMode, 'pendiente') || 'pendiente'}`,
        `Checklist ${resolveChecklistLabel(checklist)}`,
        resolveManifestLabel(manifest),
        resolveLedgerLabel(ledger),
        `Gate ${toString(gate.band, 'watch')} · ${Number(gate.score || 0) || 0}`,
    ].join(' · ');
}

function buildBrief(readout) {
    const lines = [
        '# Turnero Surface Rollout',
        '',
        `Scope: ${toString(readout.scope, 'regional')}`,
        `Surface: ${toString(readout.surfaceLabel, readout.surfaceKey)}`,
        `Clinic: ${toString(readout.clinicShortName || readout.clinicName, readout.clinicId || 'n/a')}`,
        `Gate: ${toString(readout.gateBand, 'watch')} (${Number(readout.gateScore || 0) || 0})`,
        `Decision: ${toString(readout.gateDecision, 'review-rollout')}`,
        `Checklist: ${resolveChecklistLabel(readout.checklist || {})}`,
        `Manifest: ${resolveManifestLabel(readout.manifest || {})}`,
        `Ledger: ${resolveLedgerLabel(readout.ledger || {})}`,
        '',
        `Visit: ${toString(readout.visitDate, 'pendiente') || 'pendiente'}`,
        `Owner: ${toString(readout.owner, 'pendiente') || 'pendiente'}`,
        `Asset: ${toString(readout.assetTag, 'none') || 'none'}`,
        `Station: ${toString(readout.stationLabel, 'pendiente') || 'pendiente'}`,
        `Install: ${toString(readout.installMode, 'pendiente') || 'pendiente'}`,
    ];

    return lines.join('\n').trim();
}

function buildCheckpointChips(readout) {
    const assetTag = toString(readout.assetTag, 'none') || 'none';
    const gateBand = toString(readout.gateBand, 'watch');
    const gateScore = Number(readout.gateScore || 0) || 0;

    return [
        {
            label: 'asset',
            value: assetTag,
            state: assetTag && assetTag !== 'none' ? 'ready' : 'warning',
        },
        {
            label: 'rollout',
            value: gateBand,
            state: normalizeTone(gateBand),
        },
        {
            label: 'score',
            value: String(gateScore),
            state:
                gateBand === 'ready'
                    ? 'ready'
                    : gateBand === 'blocked'
                      ? 'alert'
                      : 'warning',
        },
    ];
}

export function buildTurneroSurfaceRolloutReadout(input = {}) {
    const snapshot = asObject(input.snapshot);
    const checklist = asObject(input.checklist || snapshot.checklist);
    const manifest = asObject(input.manifest || snapshot.manifest);
    const ledger = asObject(input.ledger || snapshot.ledger);
    const gate = asObject(input.gate || snapshot.gate);
    const surfaceLabel = toString(
        snapshot.surfaceLabel || input.surfaceLabel,
        snapshot.surfaceKey || 'surface'
    );
    const gateBand = toString(gate.band, 'watch');
    const gateScore = Number(gate.score || 0) || 0;
    const gateDecision = toString(gate.decision, 'review-rollout');
    const assetTag = toString(snapshot.assetTag, '');
    const summary = toString(
        input.summary,
        resolveSummary({
            gateBand,
            surfaceLabel,
            clinicShortName: toString(snapshot.clinicShortName, ''),
            checklist,
            manifest,
            ledger,
        })
    );
    const detail = toString(
        input.detail,
        resolveDetail({
            snapshot,
            checklist,
            manifest,
            ledger,
            gate,
        })
    );

    const readout = {
        surfaceKey: toString(snapshot.surfaceKey, 'operator-turnos'),
        surfaceId: toString(snapshot.surfaceId, 'operator'),
        surfaceLabel,
        surfaceFamily: toString(snapshot.surfaceFamily, ''),
        scope: toString(snapshot.scope, 'regional'),
        clinicId: toString(snapshot.clinicId, ''),
        clinicName: toString(snapshot.clinicName, ''),
        clinicShortName: toString(snapshot.clinicShortName, ''),
        profileFingerprint: toString(snapshot.profileFingerprint, ''),
        releaseMode: toString(snapshot.releaseMode, ''),
        visitDate: toString(snapshot.visitDate, ''),
        owner: toString(snapshot.owner, ''),
        assetTag: toString(snapshot.assetTag, ''),
        stationLabel: toString(snapshot.stationLabel, ''),
        installMode: toString(snapshot.installMode, ''),
        truth: toString(snapshot.truth, 'pending'),
        runtimeState: toString(
            snapshot.runtimeState?.state || snapshot.runtimeState,
            'watch'
        ),
        contractState: toString(snapshot.contract?.state, 'ready'),
        manifestState: toString(manifest.state, 'watch'),
        manifestAppKey: toString(
            manifest.appKey || manifest.expectedAppKey,
            ''
        ),
        ledgerState: toString(ledger.state, 'watch'),
        checklistState: toString(checklist.state, 'watch'),
        checklistCoverage: Number(checklist.coverage || 0) || 0,
        checklistPass: Number(checklist?.summary?.pass || 0) || 0,
        checklistFail: Number(checklist?.summary?.fail || 0) || 0,
        requiredFail: Number(checklist.requiredFail || 0) || 0,
        optionalFail: Number(checklist.optionalFail || 0) || 0,
        gateBand,
        gateScore,
        gateDecision,
        title:
            gateBand === 'ready'
                ? 'Rollout listo'
                : gateBand === 'blocked'
                  ? 'Rollout bloqueado'
                  : 'Rollout en observacion',
        summary,
        detail,
        badge: `${gateBand} · ${gateScore}`,
        tone: normalizeTone(gateBand),
        assetTone: assetTag && assetTag !== 'none' ? 'ready' : 'warning',
        rolloutTone: normalizeTone(gateBand),
        scoreTone:
            gateBand === 'ready'
                ? 'ready'
                : gateBand === 'blocked'
                  ? 'alert'
                  : 'warning',
        checkpointChips: buildCheckpointChips({
            assetTag,
            gateBand,
            gateScore,
        }),
        chips: buildCheckpointChips({
            assetTag,
            gateBand,
            gateScore,
        }),
        checklist,
        manifest,
        ledger,
        gate,
        brief: buildBrief({
            ...snapshot,
            checklist,
            manifest,
            ledger,
            gateBand,
            gateScore,
            gateDecision,
        }),
        generatedAt: new Date().toISOString(),
    };

    return readout;
}
