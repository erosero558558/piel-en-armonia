function normalizeText(value) {
    return String(value || '').trim();
}

export function buildTurneroSurfaceSyncDrift(input = {}) {
    const snapshot =
        input.snapshot && typeof input.snapshot === 'object'
            ? input.snapshot
            : {};
    const expectedVisibleTurn = normalizeText(input.expectedVisibleTurn);
    const expectedQueueVersion = normalizeText(input.expectedQueueVersion);
    const driftFlags = [];

    if (!snapshot.queueVersion) {
        driftFlags.push('missing-queue-version');
    }
    if (expectedVisibleTurn && !snapshot.visibleTurn) {
        driftFlags.push('missing-visible-turn');
    }
    if (
        expectedVisibleTurn &&
        snapshot.visibleTurn &&
        expectedVisibleTurn !== snapshot.visibleTurn
    ) {
        driftFlags.push('visible-turn-mismatch');
    }
    if (
        expectedQueueVersion &&
        snapshot.queueVersion &&
        expectedQueueVersion !== snapshot.queueVersion
    ) {
        driftFlags.push('queue-version-mismatch');
    }
    if (snapshot.handoffState === 'unknown') {
        driftFlags.push('unknown-handoff-state');
    }
    if (snapshot.heartbeatState === 'unknown') {
        driftFlags.push('unknown-heartbeat');
    }

    const severity =
        driftFlags.length >= 4
            ? 'high'
            : driftFlags.length >= 2
              ? 'medium'
              : driftFlags.length >= 1
                ? 'low'
                : 'none';
    const state =
        severity === 'none'
            ? 'aligned'
            : severity === 'low'
              ? 'watch'
              : severity === 'medium'
                ? 'degraded'
                : 'blocked';

    return {
        surfaceKey: normalizeText(snapshot.surfaceKey) || 'surface',
        expectedVisibleTurn,
        expectedQueueVersion,
        driftFlags,
        severity,
        state,
        generatedAt: new Date().toISOString(),
    };
}
