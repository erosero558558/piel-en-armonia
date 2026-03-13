import { apiRequest } from '../../../core/api-client.js';
import { getState } from '../../../core/store.js';
import { getQueueCommandAdapter } from '../command-adapter.js';
import { asArray, normalize } from '../helpers.js';
import { applyQueueStateResponse } from '../sync.js';
import { appendActivity, setQueueStateWithTickets } from '../state.js';

function normalizeHelpRequestStatus(value) {
    const normalized = normalize(value);
    if (normalized === 'pending') {
        return 'pending';
    }
    if (normalized === 'attending') {
        return 'attending';
    }
    if (normalized === 'resolved') {
        return 'resolved';
    }
    return '';
}

function helpRequestActionLabel(status) {
    if (status === 'attending') {
        return 'atendido';
    }
    if (status === 'resolved') {
        return 'resuelto';
    }
    return 'actualizado';
}

function matchesHelpRequest(request, helpRequestId, ticketId) {
    const requestId = Number(request?.id || 0);
    const requestTicketId = Number(
        request?.ticketId || request?.ticket_id || 0
    );

    if (helpRequestId > 0 && requestId === helpRequestId) {
        return true;
    }

    return helpRequestId <= 0 && ticketId > 0 && requestTicketId === ticketId;
}

function normalizeResolutionContext(context) {
    return context && typeof context === 'object' ? context : {};
}

function helpRequestResolutionLabel(context) {
    const normalized = normalizeResolutionContext(context);
    const keys = [
        'resolutionOutcomeLabel',
        'resolution_outcome_label',
        'reviewOutcomeLabel',
        'review_outcome_label',
        'reviewAssessmentLabel',
        'review_assessment_label',
    ];

    for (const key of keys) {
        const value = normalized[key];
        if (value === undefined || value === null) {
            continue;
        }
        const text = String(value).trim();
        if (text !== '') {
            return text;
        }
    }

    return '';
}

function applyHelpRequestStatusPractice({
    helpRequestId,
    ticketId,
    status,
    context = null,
}) {
    const normalizedStatus = normalizeHelpRequestStatus(status);
    if (!normalizedStatus) {
        return;
    }

    const state = getState();
    const nowIso = new Date().toISOString();
    const queueMeta =
        state.data.queueMeta && typeof state.data.queueMeta === 'object'
            ? state.data.queueMeta
            : {};
    const currentTickets = Array.isArray(state.data.queueTickets)
        ? state.data.queueTickets
        : [];
    const contextPatch = normalizeResolutionContext(context);
    const recentResolvedLimit = 5;

    let matchedTicketId = Number(ticketId || 0) || 0;
    let resolvedRequest = null;
    const nextHelpRequests = asArray(queueMeta.activeHelpRequests)
        .map((request) => {
            if (!matchesHelpRequest(request, helpRequestId, matchedTicketId)) {
                return request;
            }

            matchedTicketId =
                matchedTicketId ||
                Number(request?.ticketId || request?.ticket_id || 0) ||
                0;

            return {
                ...request,
                status: normalizedStatus,
                updatedAt: nowIso,
                context:
                    contextPatch && Object.keys(contextPatch).length
                        ? {
                              ...(request?.context &&
                              typeof request.context === 'object'
                                  ? request.context
                                  : {}),
                              ...contextPatch,
                          }
                        : request?.context &&
                            typeof request.context === 'object'
                          ? request.context
                          : {},
                ...(normalizedStatus === 'attending'
                    ? { attendedAt: nowIso }
                    : {}),
                ...(normalizedStatus === 'resolved'
                    ? { resolvedAt: nowIso }
                    : {}),
            };
        })
        .filter((request) => {
            const requestStatus = normalizeHelpRequestStatus(request?.status);
            if (requestStatus === 'resolved') {
                resolvedRequest = request;
                return false;
            }
            return ['pending', 'attending'].includes(requestStatus);
        });
    const recentResolvedHelpRequests = [
        ...(resolvedRequest ? [resolvedRequest] : []),
        ...asArray(queueMeta.recentResolvedHelpRequests).filter(
            (request) =>
                Number(request?.id || 0) !== Number(resolvedRequest?.id || 0)
        ),
    ].slice(0, recentResolvedLimit);

    const activeHelpRequestByTicketId = new Map();
    nextHelpRequests.forEach((request) => {
        const activeTicketId =
            Number(request?.ticketId || request?.ticket_id || 0) || 0;
        if (
            activeTicketId > 0 &&
            !activeHelpRequestByTicketId.has(activeTicketId)
        ) {
            activeHelpRequestByTicketId.set(activeTicketId, request);
        }
    });

    const nextTickets = currentTickets.map((ticket) => {
        const currentTicketId = Number(ticket?.id || 0) || 0;
        const activeHelpRequest =
            activeHelpRequestByTicketId.get(currentTicketId) || null;

        if (activeHelpRequest) {
            const reason = String(
                activeHelpRequest.reason || ticket.assistanceReason || ''
            )
                .trim()
                .toLowerCase();
            return {
                ...ticket,
                needsAssistance: true,
                assistanceRequestStatus: String(
                    activeHelpRequest.status || 'pending'
                ),
                activeHelpRequestId: Number(activeHelpRequest.id || 0) || null,
                assistanceReason: reason,
                assistanceReasonLabel:
                    String(
                        activeHelpRequest.reasonLabel ||
                            ticket.assistanceReasonLabel ||
                            ''
                    ) || ticket.assistanceReasonLabel,
                specialPriority:
                    Boolean(ticket.specialPriority) ||
                    reason === 'special_priority',
                lateArrival:
                    Boolean(ticket.lateArrival) || reason === 'late_arrival',
                reprintRequestedAt:
                    reason === 'printer_issue' || reason === 'reprint_requested'
                        ? String(
                              activeHelpRequest.createdAt ||
                                  ticket.reprintRequestedAt ||
                                  nowIso
                          )
                        : ticket.reprintRequestedAt || '',
            };
        }

        if (
            currentTicketId === matchedTicketId ||
            Number(ticket?.activeHelpRequestId || 0) ===
                Number(helpRequestId || 0)
        ) {
            return {
                ...ticket,
                needsAssistance: false,
                assistanceRequestStatus: '',
                activeHelpRequestId: null,
            };
        }

        return ticket;
    });

    setQueueStateWithTickets(
        nextTickets,
        {
            ...queueMeta,
            updatedAt: nowIso,
            activeHelpRequests: nextHelpRequests,
            recentResolvedHelpRequests,
            assistancePendingCount: nextHelpRequests.filter(
                (request) =>
                    normalizeHelpRequestStatus(request?.status) === 'pending'
            ).length,
        },
        {
            fallbackPartial: false,
            syncMode: 'live',
            bumpRuntimeRevision: true,
        }
    );

    appendActivity(
        `Practica: apoyo ${helpRequestActionLabel(normalizedStatus)} ${matchedTicketId || helpRequestId}${
            helpRequestResolutionLabel(resolvedRequest?.context || contextPatch)
                ? ` · ${helpRequestResolutionLabel(
                      resolvedRequest?.context || contextPatch
                  )}`
                : ''
        }`
    );
}

export async function updateQueueHelpRequestStatus({
    helpRequestId,
    ticketId,
    status,
    context = null,
}) {
    const normalizedStatus = normalizeHelpRequestStatus(status);
    const resolvedHelpRequestId = Number(helpRequestId || 0) || 0;
    const resolvedTicketId = Number(ticketId || 0) || 0;
    if (!normalizedStatus || (!resolvedHelpRequestId && !resolvedTicketId)) {
        return;
    }

    if (getState().queue.practiceMode) {
        applyHelpRequestStatusPractice({
            helpRequestId: resolvedHelpRequestId,
            ticketId: resolvedTicketId,
            status: normalizedStatus,
            context,
        });
        return;
    }

    const commandAdapter = getQueueCommandAdapter();
    if (typeof commandAdapter?.updateHelpRequestStatus === 'function') {
        return commandAdapter.updateHelpRequestStatus({
            helpRequestId: resolvedHelpRequestId,
            ticketId: resolvedTicketId,
            status: normalizedStatus,
        });
    }

    const body = {
        status: normalizedStatus,
    };
    if (resolvedHelpRequestId > 0) {
        body.id = resolvedHelpRequestId;
    }
    if (resolvedTicketId > 0) {
        body.ticketId = resolvedTicketId;
    }
    if (context && typeof context === 'object' && Object.keys(context).length) {
        body.context = context;
    }

    const payload = await apiRequest('queue-help-request', {
        method: 'PATCH',
        body,
    });

    applyQueueStateResponse(payload, {
        syncMode: 'live',
        bumpRuntimeRevision: true,
    });
    const activitySuffix = helpRequestResolutionLabel(context)
        ? ` · ${helpRequestResolutionLabel(context)}`
        : '';
    appendActivity(
        `Apoyo ${helpRequestActionLabel(normalizedStatus)} ${resolvedTicketId || resolvedHelpRequestId}${activitySuffix}`
    );
}
