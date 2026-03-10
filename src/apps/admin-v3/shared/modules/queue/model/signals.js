import { asArray } from '../helpers.js';
import { ticketIdentity } from './tickets.js';
import { normalizeTicket } from './normalizers.js';

function hasOwnField(record, field) {
    return Object.prototype.hasOwnProperty.call(record || {}, field);
}

export function hasExplicitQueueSignals(
    queueState,
    fullTickets,
    payloadTicket
) {
    if (fullTickets.length > 0) return true;
    if (
        hasOwnField(queueState, 'queue_tickets') ||
        hasOwnField(queueState, 'queueTickets') ||
        hasOwnField(queueState, 'tickets')
    ) {
        return true;
    }
    if (payloadTicket && typeof payloadTicket === 'object') return true;

    const hasTopLevelCounts =
        hasOwnField(queueState, 'waitingCount') ||
        hasOwnField(queueState, 'waiting_count') ||
        hasOwnField(queueState, 'calledCount') ||
        hasOwnField(queueState, 'called_count') ||
        hasOwnField(queueState, 'completedCount') ||
        hasOwnField(queueState, 'completed_count') ||
        hasOwnField(queueState, 'noShowCount') ||
        hasOwnField(queueState, 'no_show_count') ||
        hasOwnField(queueState, 'cancelledCount') ||
        hasOwnField(queueState, 'cancelled_count');
    if (hasTopLevelCounts) return true;

    const counts =
        queueState?.counts && typeof queueState.counts === 'object'
            ? queueState.counts
            : null;
    if (
        counts &&
        (hasOwnField(counts, 'waiting') ||
            hasOwnField(counts, 'called') ||
            hasOwnField(counts, 'completed') ||
            hasOwnField(counts, 'no_show') ||
            hasOwnField(counts, 'noShow') ||
            hasOwnField(counts, 'cancelled') ||
            hasOwnField(counts, 'canceled'))
    ) {
        return true;
    }

    if (
        hasOwnField(queueState, 'nextTickets') ||
        hasOwnField(queueState, 'next_tickets')
    ) {
        return true;
    }

    const callingByConsultorio =
        queueState?.callingNowByConsultorio &&
        typeof queueState.callingNowByConsultorio === 'object'
            ? queueState.callingNowByConsultorio
            : queueState?.calling_now_by_consultorio &&
                typeof queueState.calling_now_by_consultorio === 'object'
              ? queueState.calling_now_by_consultorio
              : null;
    if (
        callingByConsultorio &&
        (Boolean(callingByConsultorio[1]) ||
            Boolean(callingByConsultorio[2]) ||
            Boolean(callingByConsultorio['1']) ||
            Boolean(callingByConsultorio['2']))
    ) {
        return true;
    }

    const callingNow = asArray(queueState?.callingNow).concat(
        asArray(queueState?.calling_now)
    );
    return callingNow.some(Boolean);
}

export function getQueueStateSignalFlags(queueState) {
    const counts =
        queueState?.counts && typeof queueState.counts === 'object'
            ? queueState.counts
            : null;
    const hasWaitingCount =
        hasOwnField(queueState, 'waitingCount') ||
        hasOwnField(queueState, 'waiting_count') ||
        Boolean(counts && hasOwnField(counts, 'waiting'));
    const hasCalledCount =
        hasOwnField(queueState, 'calledCount') ||
        hasOwnField(queueState, 'called_count') ||
        Boolean(counts && hasOwnField(counts, 'called'));
    const hasNextTickets =
        hasOwnField(queueState, 'nextTickets') ||
        hasOwnField(queueState, 'next_tickets');
    const hasCallingNow =
        hasOwnField(queueState, 'callingNowByConsultorio') ||
        hasOwnField(queueState, 'calling_now_by_consultorio') ||
        hasOwnField(queueState, 'callingNow') ||
        hasOwnField(queueState, 'calling_now');
    return {
        waiting: hasWaitingCount || hasNextTickets,
        called: hasCalledCount || hasCallingNow,
    };
}

export function reconcilePartialMetaSignals(
    byIdentity,
    normalizedMeta,
    signalFlags
) {
    const nowByConsultorio = normalizedMeta.callingNowByConsultorio || {};
    const calledCount = Number(
        normalizedMeta.calledCount || normalizedMeta.counts?.called || 0
    );
    const waitingCount = Number(
        normalizedMeta.waitingCount || normalizedMeta.counts?.waiting || 0
    );
    const nextTickets = asArray(normalizedMeta.nextTickets);

    const calledIdentities = new Set();
    const c1 = nowByConsultorio['1'] || nowByConsultorio[1] || null;
    const c2 = nowByConsultorio['2'] || nowByConsultorio[2] || null;
    if (c1) calledIdentities.add(ticketIdentity(c1));
    if (c2) calledIdentities.add(ticketIdentity(c2));

    const waitingIdentities = new Set(
        nextTickets.map((ticket) => ticketIdentity(ticket))
    );

    const canReconcileCalled = calledIdentities.size > 0 || calledCount === 0;
    const canReconcileWaiting =
        waitingIdentities.size > 0 || waitingCount === 0;
    const hasPartialWaitingList =
        waitingIdentities.size > 0 && waitingCount > waitingIdentities.size;

    for (const [identity, existingTicket] of byIdentity.entries()) {
        const normalized = normalizeTicket(existingTicket, 0);
        if (
            signalFlags.called &&
            canReconcileCalled &&
            normalized.status === 'called' &&
            !calledIdentities.has(identity)
        ) {
            byIdentity.set(
                identity,
                normalizeTicket(
                    {
                        ...normalized,
                        status: 'completed',
                        assignedConsultorio: null,
                        completedAt:
                            normalized.completedAt || new Date().toISOString(),
                    },
                    0
                )
            );
            continue;
        }

        if (
            !signalFlags.waiting ||
            !canReconcileWaiting ||
            normalized.status !== 'waiting'
        ) {
            continue;
        }
        if (waitingCount <= 0) {
            byIdentity.delete(identity);
            continue;
        }
        if (!hasPartialWaitingList && !waitingIdentities.has(identity)) {
            byIdentity.delete(identity);
        }
    }
}
