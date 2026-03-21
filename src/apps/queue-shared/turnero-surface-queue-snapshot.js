function normalizeText(value) {
    return String(value ?? '').trim();
}

function normalizeTicketCode(value) {
    return normalizeText(value).toUpperCase().replace(/\s+/g, '');
}

function normalizeTicketToken(value) {
    return normalizeText(value)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
}

function normalizeMaskedTicket(value) {
    return normalizeText(value)
        .toUpperCase()
        .replace(/[^A-Z0-9*]/g, '');
}

function normalizePrivacyMode(value) {
    const normalized = normalizeText(value).toLowerCase();
    if (normalized === 'full' || normalized === 'open') {
        return 'full';
    }
    return 'masked';
}

function buildTurneroSurfaceQueueFingerprint(input = {}) {
    const snapshot = {
        surfaceKey: normalizeText(input.surfaceKey) || 'surface',
        visibleTurn: normalizeTicketCode(input.visibleTurn),
        announcedTurn: normalizeTicketCode(input.announcedTurn),
        ticketDisplay: normalizeTicketToken(input.ticketDisplay),
        maskedTicket: normalizeTicketToken(input.maskedTicket),
        privacyMode: normalizePrivacyMode(input.privacyMode),
        heartbeatState:
            normalizeText(input.heartbeat?.state || input.heartbeatState) ||
            'unknown',
        heartbeatChannel:
            normalizeText(input.heartbeat?.channel || input.heartbeatChannel) ||
            'unknown',
        updatedAt: normalizeText(input.updatedAt || input.createdAt),
    };
    return JSON.stringify(snapshot);
}

export function resolveTurneroSurfaceQueueVersion(input = {}) {
    const explicitQueueVersion = normalizeText(input.queueVersion);
    if (explicitQueueVersion) {
        return explicitQueueVersion;
    }

    const updatedAt = normalizeText(input.updatedAt || input.createdAt);
    if (updatedAt) {
        return updatedAt;
    }

    return buildTurneroSurfaceQueueFingerprint(input);
}

export function buildTurneroSurfaceQueueSnapshot(input = {}) {
    const createdAt =
        normalizeText(input.createdAt || input.updatedAt) ||
        new Date().toISOString();

    return {
        surfaceKey: normalizeText(input.surfaceKey) || 'surface',
        queueVersion: resolveTurneroSurfaceQueueVersion(input),
        visibleTurn: normalizeTicketCode(input.visibleTurn),
        announcedTurn: normalizeTicketCode(input.announcedTurn),
        ticketDisplay: normalizeTicketToken(
            input.ticketDisplay || input.visibleTurn
        ),
        maskedTicket: normalizeMaskedTicket(input.maskedTicket),
        privacyMode: normalizePrivacyMode(input.privacyMode),
        heartbeatState:
            normalizeText(input.heartbeat?.state || input.heartbeatState) ||
            'unknown',
        heartbeatChannel:
            normalizeText(input.heartbeat?.channel || input.heartbeatChannel) ||
            'unknown',
        createdAt,
        updatedAt: createdAt,
    };
}
