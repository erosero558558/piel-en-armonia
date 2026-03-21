function normalizeText(value) {
    return String(value ?? '').trim();
}

function normalizeTicketToken(value) {
    return normalizeText(value)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
}

function normalizePrivacyMode(value) {
    const normalized = normalizeText(value).toLowerCase();
    if (normalized === 'full' || normalized === 'open') {
        return 'full';
    }
    return 'masked';
}

export function buildTurneroSurfaceAnnounceDrift(input = {}) {
    const snapshot =
        input.snapshot && typeof input.snapshot === 'object'
            ? input.snapshot
            : {};
    const visibleTurn = normalizeText(snapshot.visibleTurn);
    const announcedTurn = normalizeText(snapshot.announcedTurn);
    const ticketDisplay = normalizeTicketToken(snapshot.ticketDisplay);
    const maskedTicket = normalizeTicketToken(snapshot.maskedTicket);
    const privacyMode = normalizePrivacyMode(snapshot.privacyMode);
    const driftFlags = [];

    if (!snapshot.queueVersion) {
        driftFlags.push('missing-queue-version');
    }
    if (!visibleTurn) {
        driftFlags.push('missing-visible-turn');
    }
    if (visibleTurn && !announcedTurn) {
        driftFlags.push('missing-announced-turn');
    }
    if (visibleTurn && announcedTurn && visibleTurn !== announcedTurn) {
        driftFlags.push('announce-visible-mismatch');
    }
    if (privacyMode === 'masked' && ticketDisplay && !maskedTicket) {
        driftFlags.push('missing-ticket-mask');
    }
    if (
        privacyMode === 'masked' &&
        ticketDisplay &&
        maskedTicket &&
        maskedTicket === ticketDisplay
    ) {
        driftFlags.push('ticket-not-masked');
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
        visibleTurn,
        announcedTurn,
        ticketDisplay,
        maskedTicket,
        maskedTicketRaw: normalizeText(snapshot.maskedTicket),
        privacyMode,
        driftFlags,
        severity,
        state,
        summary:
            driftFlags.length === 0
                ? 'Visible turn and announcement are aligned.'
                : `${driftFlags.length} drift flag(s)`,
        detail: driftFlags.join(' · ') || 'No drift flags.',
        generatedAt: new Date().toISOString(),
    };
}
