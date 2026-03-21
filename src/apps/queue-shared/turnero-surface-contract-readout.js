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
            return 'danger';
        default:
            return 'warning';
    }
}

function summarize(snapshot, drift, gate) {
    const contract = asObject(snapshot.contract);
    const profile = asObject(snapshot.profile);
    const storage = asObject(snapshot.storage);
    const runtime = asObject(snapshot.runtime);
    const heartbeat = asObject(snapshot.heartbeat);
    const openActionCount = Number(snapshot.openActionCount || 0) || 0;

    if (gate.band === 'blocked' || contract.state === 'alert') {
        const issue =
            drift.primaryFlag?.detail ||
            contract.detail ||
            'Recuperacion bloqueada.';
        return `Bloqueado · ${issue}`;
    }

    if (gate.band === 'degraded') {
        const issue =
            drift.primaryFlag?.detail ||
            storage.summary ||
            runtime.summary ||
            heartbeat.summary ||
            'Recuperacion degradada.';
        return `Degradado · ${issue}`;
    }

    if (gate.band === 'watch') {
        return openActionCount > 0
            ? `Observacion activa · ${openActionCount} accion(es) abierta(s).`
            : 'Observacion activa · sin acciones abiertas.';
    }

    return `${
        profile.clinicShortName || profile.clinicName || snapshot.surfaceLabel
    } alineado · perfil, storage, runtime y heartbeat listos.`;
}

function buildDetail(snapshot) {
    const contract = asObject(snapshot.contract);
    const readiness = asObject(snapshot.readiness);
    const storage = asObject(snapshot.storage);
    const runtime = asObject(snapshot.runtime);
    const heartbeat = asObject(snapshot.heartbeat);
    const detailParts = [
        contract.detail,
        readiness.summary,
        storage.summary,
        runtime.summary,
        heartbeat.summary,
    ].filter(Boolean);

    return detailParts.join(' · ');
}

function buildChip(label, value, state) {
    return {
        label,
        value: toString(value),
        state: normalizeChipState(state),
    };
}

export function buildTurneroSurfaceContractReadout(input = {}) {
    const snapshot = asObject(input.snapshot);
    const drift = asObject(input.drift);
    const gate = asObject(input.gate);
    const readiness = asObject(input.readiness || snapshot.readiness);
    const contract = asObject(snapshot.contract);
    const profile = asObject(snapshot.profile);
    const storage = asObject(snapshot.storage);
    const runtime = asObject(snapshot.runtime);
    const heartbeat = asObject(snapshot.heartbeat);
    const surfaceKey = toString(
        snapshot.surfaceKey || input.surfaceKey,
        'operator'
    );
    const surfaceLabel = toString(
        snapshot.surfaceLabel ||
            profile.surfaceLabel ||
            contract.label ||
            surfaceKey
    );
    const badge = `${toString(gate.band || drift.state || 'watch')} · ${Number(
        gate.score || 0
    )}`;
    const summary = summarize(snapshot, drift, gate);
    const detail = buildDetail(snapshot);
    const contractValue =
        contract.state === 'alert'
            ? contract.reason || 'alert'
            : contract.state;

    return {
        surfaceKey,
        surfaceLabel,
        clinicName: toString(profile.clinicName || ''),
        clinicShortName: toString(profile.clinicShortName || ''),
        contractState: toString(contract.state || 'ready'),
        contractTone: normalizeChipState(
            contract.state === 'alert' ? 'blocked' : 'ready'
        ),
        contractValue: toString(contractValue || 'ready'),
        driftState: toString(drift.state || 'aligned'),
        driftSeverity: toString(drift.severity || 'low'),
        driftTone: normalizeChipState(drift.state || drift.severity || 'watch'),
        gateBand: toString(gate.band || 'watch'),
        gateScore: Number(gate.score || 0) || 0,
        gateTone: normalizeChipState(gate.band || 'watch'),
        storageState: toString(storage.state || 'ready'),
        runtimeState: toString(runtime.state || 'ready'),
        heartbeatState: toString(heartbeat.state || 'ready'),
        readinessState: toString(readiness.state || 'ready'),
        openActionCount: Number(snapshot.openActionCount || 0) || 0,
        summary,
        detail,
        badge,
        chips: [
            buildChip('Contract', contractValue || 'ready', contract.state),
            buildChip('Drift', drift.state || 'aligned', drift.state),
            buildChip('Gate', badge, gate.band),
        ],
        generatedAt: new Date().toISOString(),
        primaryIssue: toString(
            drift.primaryFlag?.detail || drift.primaryFlag?.label || ''
        ),
        notes: toArray(drift.driftFlags).map((flag) => ({
            ...flag,
        })),
    };
}

export const buildTurneroSurfaceRecoveryReadout =
    buildTurneroSurfaceContractReadout;
