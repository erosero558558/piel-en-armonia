function toString(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

export function buildTurneroSurfaceCommercialReadout(input = {}) {
    const snapshot = asObject(input.snapshot);
    const gate = asObject(input.gate);

    return {
        surfaceKey: toString(
            snapshot.surfaceKey || input.surfaceKey,
            'surface'
        ),
        clinicLabel: toString(snapshot.clinicLabel, ''),
        runtimeState: toString(snapshot.runtimeState, 'unknown'),
        truth: toString(snapshot.truth, 'unknown'),
        packageTier: toString(snapshot.packageTier, 'pilot'),
        commercialOwner: toString(snapshot.commercialOwner, ''),
        opsOwner: toString(snapshot.opsOwner, ''),
        scopeState: toString(snapshot.scopeState, 'draft'),
        pricingState: toString(snapshot.pricingState, 'draft'),
        gateBand: toString(gate.band, 'degraded'),
        gateScore: Number(gate.score || 0) || 0,
        gateDecision: toString(gate.decision, 'hold-commercial-readiness'),
        generatedAt: new Date().toISOString(),
    };
}
