import {
    asArray,
    coalesceNonEmptyString,
    normalize,
    normalizeStatus,
    toFiniteNumber,
} from './helpers.js';

export function normalizeTicket(raw, fallbackIndex = 0) {
    const id = Number(raw?.id || raw?.ticket_id || fallbackIndex + 1);
    return {
        id,
        ticketCode: String(raw?.ticketCode || raw?.ticket_code || `A-${id}`),
        queueType: String(raw?.queueType || raw?.queue_type || 'walk_in'),
        patientInitials: String(
            raw?.patientInitials || raw?.patient_initials || '--'
        ),
        priorityClass: String(
            raw?.priorityClass || raw?.priority_class || 'walk_in'
        ),
        status: normalizeStatus(raw?.status || 'waiting'),
        assignedConsultorio:
            Number(
                raw?.assignedConsultorio || raw?.assigned_consultorio || 0
            ) === 2
                ? 2
                : Number(
                        raw?.assignedConsultorio ||
                            raw?.assigned_consultorio ||
                            0
                    ) === 1
                  ? 1
                  : null,
        createdAt: String(
            raw?.createdAt || raw?.created_at || new Date().toISOString()
        ),
        calledAt: String(raw?.calledAt || raw?.called_at || ''),
        completedAt: String(raw?.completedAt || raw?.completed_at || ''),
    };
}

function normalizeMetaTicket(raw, fallbackIndex = 0, overrides = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const normalized = normalizeTicket(
        {
            ...source,
            ...overrides,
        },
        fallbackIndex
    );

    if (!coalesceNonEmptyString(source.createdAt, source.created_at)) {
        normalized.createdAt = '';
    }
    if (!coalesceNonEmptyString(source.priorityClass, source.priority_class)) {
        normalized.priorityClass = '';
    }
    if (!coalesceNonEmptyString(source.queueType, source.queue_type)) {
        normalized.queueType = '';
    }
    if (
        !coalesceNonEmptyString(source.patientInitials, source.patient_initials)
    ) {
        normalized.patientInitials = '';
    }

    return normalized;
}

export function buildQueueMeta(tickets) {
    const waiting = tickets.filter((item) => item.status === 'waiting');
    const called = tickets.filter((item) => item.status === 'called');

    const nowByConsultorio = {
        1: called.find((item) => item.assignedConsultorio === 1) || null,
        2: called.find((item) => item.assignedConsultorio === 2) || null,
    };

    return {
        updatedAt: new Date().toISOString(),
        waitingCount: waiting.length,
        calledCount: called.length,
        counts: {
            waiting: waiting.length,
            called: called.length,
            completed: tickets.filter((item) => item.status === 'completed')
                .length,
            no_show: tickets.filter((item) => item.status === 'no_show').length,
            cancelled: tickets.filter((item) => item.status === 'cancelled')
                .length,
        },
        callingNowByConsultorio: nowByConsultorio,
        nextTickets: waiting.slice(0, 5).map((item, index) => ({
            id: item.id,
            ticketCode: item.ticketCode,
            patientInitials: item.patientInitials,
            position: index + 1,
        })),
    };
}

export function normalizeQueueMeta(rawMeta, tickets = []) {
    const meta = rawMeta && typeof rawMeta === 'object' ? rawMeta : {};
    const counts =
        meta.counts && typeof meta.counts === 'object' ? meta.counts : {};
    const callingByConsultorio =
        meta.callingNowByConsultorio &&
        typeof meta.callingNowByConsultorio === 'object'
            ? meta.callingNowByConsultorio
            : meta.calling_now_by_consultorio &&
                typeof meta.calling_now_by_consultorio === 'object'
              ? meta.calling_now_by_consultorio
              : {};
    const callingNowList = asArray(meta.callingNow).concat(
        asArray(meta.calling_now)
    );
    const fromTickets = asArray(tickets).map((ticket, index) =>
        normalizeTicket(ticket, index)
    );

    const c1Raw =
        callingByConsultorio['1'] ||
        callingByConsultorio[1] ||
        callingNowList.find(
            (item) =>
                Number(
                    item?.assignedConsultorio || item?.assigned_consultorio || 0
                ) === 1
        ) ||
        null;
    const c2Raw =
        callingByConsultorio['2'] ||
        callingByConsultorio[2] ||
        callingNowList.find(
            (item) =>
                Number(
                    item?.assignedConsultorio || item?.assigned_consultorio || 0
                ) === 2
        ) ||
        null;

    const c1 = c1Raw
        ? normalizeMetaTicket(c1Raw, 0, {
              status: 'called',
              assignedConsultorio: 1,
          })
        : null;
    const c2 = c2Raw
        ? normalizeMetaTicket(c2Raw, 1, {
              status: 'called',
              assignedConsultorio: 2,
          })
        : null;

    const nextTickets = asArray(meta.nextTickets)
        .concat(asArray(meta.next_tickets))
        .map((item, index) =>
            normalizeMetaTicket(
                {
                    ...item,
                    status: item?.status || 'waiting',
                    assignedConsultorio: null,
                },
                index
            )
        );

    const waitingFromTickets = fromTickets.filter(
        (ticket) => ticket.status === 'waiting'
    ).length;
    const calledFromTickets = fromTickets.filter(
        (ticket) => ticket.status === 'called'
    ).length;
    const calledCountFallback = Math.max(
        Number(Boolean(c1)) + Number(Boolean(c2)),
        calledFromTickets
    );

    const waitingCount = toFiniteNumber(
        meta.waitingCount ??
            meta.waiting_count ??
            counts.waiting ??
            nextTickets.length ??
            waitingFromTickets,
        0
    );
    const calledCount = toFiniteNumber(
        meta.calledCount ??
            meta.called_count ??
            counts.called ??
            calledCountFallback,
        0
    );
    const completedCount = toFiniteNumber(
        counts.completed ??
            meta.completedCount ??
            meta.completed_count ??
            fromTickets.filter((ticket) => ticket.status === 'completed')
                .length,
        0
    );
    const noShowCount = toFiniteNumber(
        counts.no_show ??
            counts.noShow ??
            meta.noShowCount ??
            meta.no_show_count ??
            fromTickets.filter((ticket) => ticket.status === 'no_show').length,
        0
    );
    const cancelledCount = toFiniteNumber(
        counts.cancelled ??
            counts.canceled ??
            meta.cancelledCount ??
            meta.cancelled_count ??
            fromTickets.filter((ticket) => ticket.status === 'cancelled')
                .length,
        0
    );

    return {
        updatedAt: String(
            meta.updatedAt || meta.updated_at || new Date().toISOString()
        ),
        waitingCount,
        calledCount,
        counts: {
            waiting: waitingCount,
            called: calledCount,
            completed: completedCount,
            no_show: noShowCount,
            cancelled: cancelledCount,
        },
        callingNowByConsultorio: {
            1: c1,
            2: c2,
        },
        nextTickets,
    };
}

export function ticketIdentity(ticket) {
    const normalized = normalizeTicket(ticket, 0);
    if (normalized.id > 0) return `id:${normalized.id}`;
    return `code:${normalize(normalized.ticketCode || '')}`;
}

export function buildTicketsFromMeta(queueMeta) {
    const meta = normalizeQueueMeta(queueMeta);
    const byIdentity = new Map();

    const addTicket = (ticket) => {
        if (!ticket) return;
        const normalized = normalizeTicket(ticket, byIdentity.size);
        if (!coalesceNonEmptyString(ticket?.createdAt, ticket?.created_at)) {
            normalized.createdAt = '';
        }
        if (
            !coalesceNonEmptyString(
                ticket?.priorityClass,
                ticket?.priority_class
            )
        ) {
            normalized.priorityClass = '';
        }
        if (!coalesceNonEmptyString(ticket?.queueType, ticket?.queue_type)) {
            normalized.queueType = '';
        }
        byIdentity.set(ticketIdentity(normalized), normalized);
    };

    const c1 =
        meta.callingNowByConsultorio?.['1'] ||
        meta.callingNowByConsultorio?.[1] ||
        null;
    const c2 =
        meta.callingNowByConsultorio?.['2'] ||
        meta.callingNowByConsultorio?.[2] ||
        null;
    if (c1) addTicket({ ...c1, status: 'called', assignedConsultorio: 1 });
    if (c2) addTicket({ ...c2, status: 'called', assignedConsultorio: 2 });

    for (const nextTicket of asArray(meta.nextTickets)) {
        addTicket({
            ...nextTicket,
            status: 'waiting',
            assignedConsultorio: null,
        });
    }

    return Array.from(byIdentity.values());
}

export function extractTicketsFromPayload(queueState) {
    if (!queueState || typeof queueState !== 'object') return [];
    if (Array.isArray(queueState.queue_tickets))
        return queueState.queue_tickets;
    if (Array.isArray(queueState.queueTickets)) return queueState.queueTickets;
    if (Array.isArray(queueState.tickets)) return queueState.tickets;
    return [];
}

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
