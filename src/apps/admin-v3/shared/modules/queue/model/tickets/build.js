import { asArray, coalesceNonEmptyString } from '../../helpers.js';
import { normalizeQueueMeta } from '../meta.js';
import { normalizeTicket } from '../normalizers.js';
import { ticketIdentity } from './identity.js';

function mergeActiveHelpRequest(ticket, activeHelpRequests) {
    const candidate = ticket && typeof ticket === 'object' ? ticket : null;
    if (!candidate) {
        return ticket;
    }

    const activeRequest =
        asArray(activeHelpRequests).find((request) => {
            const requestTicketId = Number(request?.ticketId || 0);
            const candidateId = Number(candidate.id || 0);
            if (requestTicketId > 0 && candidateId > 0) {
                return requestTicketId === candidateId;
            }

            const requestTicketCode = String(request?.ticketCode || '').trim();
            const candidateTicketCode = String(
                candidate.ticketCode || ''
            ).trim();
            return (
                requestTicketCode !== '' &&
                candidateTicketCode !== '' &&
                requestTicketCode === candidateTicketCode
            );
        }) || null;

    if (!activeRequest) {
        return candidate;
    }

    const reason = String(activeRequest.reason || '')
        .trim()
        .toLowerCase();

    return {
        ...candidate,
        needsAssistance: true,
        assistanceRequestStatus: String(activeRequest.status || 'pending'),
        activeHelpRequestId: Number(activeRequest.id || 0) || null,
        assistanceReason: reason,
        assistanceReasonLabel: String(activeRequest.reasonLabel || '').trim(),
        specialPriority:
            Boolean(candidate.specialPriority) || reason === 'special_priority',
        lateArrival:
            Boolean(candidate.lateArrival) || reason === 'late_arrival',
        reprintRequestedAt:
            reason === 'printer_issue' || reason === 'reprint_requested'
                ? String(
                      activeRequest.createdAt ||
                          candidate.reprintRequestedAt ||
                          ''
                  )
                : String(candidate.reprintRequestedAt || ''),
    };
}

function mergeMetaTicket(byIdentity, ticket) {
    if (!ticket) return;

    const normalized = normalizeTicket(ticket, byIdentity.size);
    if (!coalesceNonEmptyString(ticket?.createdAt, ticket?.created_at)) {
        normalized.createdAt = '';
    }
    if (
        !coalesceNonEmptyString(ticket?.priorityClass, ticket?.priority_class)
    ) {
        normalized.priorityClass = '';
    }
    if (!coalesceNonEmptyString(ticket?.queueType, ticket?.queue_type)) {
        normalized.queueType = '';
    }

    byIdentity.set(ticketIdentity(normalized), normalized);
}

export function buildTicketsFromMeta(queueMeta) {
    const meta = normalizeQueueMeta(queueMeta);
    const byIdentity = new Map();

    const c1 =
        meta.callingNowByConsultorio?.['1'] ||
        meta.callingNowByConsultorio?.[1] ||
        null;
    const c2 =
        meta.callingNowByConsultorio?.['2'] ||
        meta.callingNowByConsultorio?.[2] ||
        null;

    if (c1) {
        mergeMetaTicket(
            byIdentity,
            mergeActiveHelpRequest(
                {
                    ...c1,
                    status: 'called',
                    assignedConsultorio: 1,
                },
                meta.activeHelpRequests
            )
        );
    }
    if (c2) {
        mergeMetaTicket(
            byIdentity,
            mergeActiveHelpRequest(
                {
                    ...c2,
                    status: 'called',
                    assignedConsultorio: 2,
                },
                meta.activeHelpRequests
            )
        );
    }

    for (const nextTicket of asArray(meta.nextTickets)) {
        mergeMetaTicket(
            byIdentity,
            mergeActiveHelpRequest(
                {
                    ...nextTicket,
                    status: 'waiting',
                    assignedConsultorio: null,
                },
                meta.activeHelpRequests
            )
        );
    }

    return Array.from(byIdentity.values());
}
