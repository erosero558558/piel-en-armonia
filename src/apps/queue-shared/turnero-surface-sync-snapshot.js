function normalizeText(value) {
    return String(value || '').trim();
}

function normalizeTicketCode(value) {
    return normalizeText(value).toUpperCase();
}

function normalizeTicketList(tickets) {
    return Array.isArray(tickets)
        ? tickets
              .map((ticket) => ({
                  id: Number(ticket?.id || 0) || 0,
                  ticketCode: normalizeTicketCode(ticket?.ticketCode),
                  consultorio: Number(ticket?.assignedConsultorio || 0) || 0,
                  position: Number(ticket?.position || 0) || 0,
                  updatedAt: normalizeText(
                      ticket?.updatedAt || ticket?.calledAt || ''
                  ),
              }))
              .filter(
                  (ticket) =>
                      ticket.id > 0 ||
                      ticket.ticketCode ||
                      ticket.consultorio > 0 ||
                      ticket.position > 0
              )
        : [];
}

export function buildTurneroSurfaceSyncFingerprint(input = {}) {
    const counts =
        input.counts && typeof input.counts === 'object' ? input.counts : {};
    const normalized = {
        updatedAt: normalizeText(input.updatedAt),
        counts: {
            waiting: Number(counts.waiting || input.waitingCount || 0) || 0,
            called: Number(counts.called || input.calledCount || 0) || 0,
            completed: Number(counts.completed || 0) || 0,
            no_show: Number(counts.no_show || 0) || 0,
            cancelled: Number(counts.cancelled || 0) || 0,
        },
        callingNow: normalizeTicketList(input.callingNow),
        nextTickets: normalizeTicketList(input.nextTickets).slice(0, 8),
    };
    return JSON.stringify(normalized);
}

export function resolveTurneroSurfaceSyncQueueVersion(input = {}) {
    const explicitQueueVersion = normalizeText(input.queueVersion);
    if (explicitQueueVersion) {
        return explicitQueueVersion;
    }

    const updatedAt = normalizeText(input.updatedAt);
    if (updatedAt) {
        return updatedAt;
    }

    return buildTurneroSurfaceSyncFingerprint(input);
}

export function buildTurneroSurfaceSyncSnapshot(input = {}) {
    return {
        surfaceKey: normalizeText(input.surfaceKey) || 'surface',
        queueVersion: resolveTurneroSurfaceSyncQueueVersion(input),
        visibleTurn: normalizeTicketCode(input.visibleTurn),
        announcedTurn: normalizeTicketCode(input.announcedTurn),
        handoffState: normalizeText(input.handoffState) || 'unknown',
        heartbeatState:
            normalizeText(input.heartbeat?.state || input.heartbeatState) ||
            'unknown',
        heartbeatChannel:
            normalizeText(input.heartbeat?.channel || input.heartbeatChannel) ||
            'unknown',
        updatedAt: normalizeText(input.updatedAt) || new Date().toISOString(),
    };
}
