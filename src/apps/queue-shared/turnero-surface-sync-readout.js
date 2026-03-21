function normalizeText(value) {
    return String(value || '').trim();
}

function summarize(driftState, gateBand, openHandoffs) {
    if (driftState === 'blocked' || gateBand === 'blocked') {
        return 'Sync bloqueado. Revisa drift crítico antes de operar.';
    }
    if (gateBand === 'degraded') {
        return 'Sync degradado. Conviene revisar la superficie antes de seguir.';
    }
    if (openHandoffs > 0) {
        return `${openHandoffs} handoff abierto${openHandoffs === 1 ? '' : 's'} en esta superficie.`;
    }
    if (driftState === 'watch' || gateBand === 'watch') {
        return 'Sync bajo observación. Mantén el equipo monitoreado.';
    }
    return 'Sync visible alineado.';
}

export function buildTurneroSurfaceSyncReadout(input = {}) {
    const snapshot =
        input.snapshot && typeof input.snapshot === 'object'
            ? input.snapshot
            : {};
    const drift =
        input.drift && typeof input.drift === 'object' ? input.drift : {};
    const gate = input.gate && typeof input.gate === 'object' ? input.gate : {};
    const handoffs = Array.isArray(input.handoffs) ? input.handoffs : [];
    const openHandoffs = handoffs.filter(
        (handoff) => String(handoff?.status || '').toLowerCase() !== 'closed'
    ).length;

    return {
        surfaceKey: normalizeText(snapshot.surfaceKey) || 'surface',
        queueVersion: normalizeText(snapshot.queueVersion),
        visibleTurn: normalizeText(snapshot.visibleTurn),
        announcedTurn: normalizeText(snapshot.announcedTurn),
        handoffState: normalizeText(snapshot.handoffState) || 'unknown',
        heartbeatState: normalizeText(snapshot.heartbeatState) || 'unknown',
        heartbeatChannel: normalizeText(snapshot.heartbeatChannel) || 'unknown',
        driftState: normalizeText(drift.state) || 'unknown',
        driftSeverity: normalizeText(drift.severity) || 'unknown',
        driftFlags: Array.isArray(drift.driftFlags) ? drift.driftFlags : [],
        gateBand: normalizeText(gate.band) || 'degraded',
        gateScore: Number(gate.score || 0) || 0,
        openHandoffs,
        summary: summarize(
            normalizeText(drift.state),
            normalizeText(gate.band),
            openHandoffs
        ),
        generatedAt: new Date().toISOString(),
    };
}
