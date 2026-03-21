import { buildTurneroSurfaceQueueSnapshot } from './turnero-surface-queue-snapshot.js';
import {
    buildTurneroSurfaceTicketMaskState,
    maskTurneroTicket,
} from './turnero-surface-ticket-mask.js';
import { buildTurneroSurfaceAnnounceDrift } from './turnero-surface-announce-drift.js';
import { buildTurneroSurfaceQueueIntegrityGate } from './turnero-surface-queue-integrity-gate.js';

function toArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function buildTurneroSurfaceIntegrityPack(input = {}) {
    const snapshot = buildTurneroSurfaceQueueSnapshot(input);
    const maskState = buildTurneroSurfaceTicketMaskState({
        ticketDisplay: snapshot.ticketDisplay,
        maskedTicket: snapshot.maskedTicket,
        privacyMode: snapshot.privacyMode,
    });
    const drift = {
        ...buildTurneroSurfaceAnnounceDrift({ snapshot }),
        queueVersion: snapshot.queueVersion,
        heartbeatState: snapshot.heartbeatState,
        heartbeatChannel: snapshot.heartbeatChannel,
    };
    const evidence = toArray(input.evidence);
    const gate = buildTurneroSurfaceQueueIntegrityGate({
        drifts: [drift],
        evidence,
    });

    return {
        surfaceKey: snapshot.surfaceKey,
        snapshot,
        maskState,
        drift,
        drifts: [drift],
        gate,
        evidence,
        generatedAt: new Date().toISOString(),
    };
}

export { maskTurneroTicket };
