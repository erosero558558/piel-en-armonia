import {
    getCallingByConsultorio,
    getCallingNowList,
    getQueueMetaCounts,
} from './shared.js';
import {
    buildTicketFallbacks,
    normalizeNextTickets,
    resolveCallingSlots,
    resolveQueueMetaCounts,
} from './normalize/index.js';
import { asArray, toFiniteNumber } from '../../helpers.js';
import { normalizeHelpRequest } from '../normalizers.js';

export function normalizeQueueMeta(rawMeta, tickets = []) {
    const meta = rawMeta && typeof rawMeta === 'object' ? rawMeta : {};
    const counts = getQueueMetaCounts(meta);
    const callingByConsultorio = getCallingByConsultorio(meta);
    const callingNowList = getCallingNowList(meta);
    const ticketFallbacks = buildTicketFallbacks(tickets);
    const { c1, c2 } = resolveCallingSlots(
        callingByConsultorio,
        callingNowList
    );
    const nextTickets = normalizeNextTickets(meta);
    const normalizedCounts = resolveQueueMetaCounts(
        meta,
        counts,
        nextTickets,
        ticketFallbacks,
        { c1, c2 }
    );
    const rawActiveHelpRequests = asArray(meta.activeHelpRequests).length
        ? asArray(meta.activeHelpRequests)
        : asArray(meta.active_help_requests);
    const activeHelpRequests = rawActiveHelpRequests.map((request, index) =>
        normalizeHelpRequest(request, index)
    );
    const rawRecentResolvedHelpRequests = asArray(
        meta.recentResolvedHelpRequests
    ).length
        ? asArray(meta.recentResolvedHelpRequests)
        : asArray(meta.recent_resolved_help_requests);
    const recentResolvedHelpRequests = rawRecentResolvedHelpRequests.map(
        (request, index) => normalizeHelpRequest(request, index)
    );
    const nextTicketWaits = nextTickets
        .map((ticket) => toFiniteNumber(ticket?.estimatedWaitMin, -1))
        .filter((value) => value >= 0);

    return {
        updatedAt: String(
            meta.updatedAt || meta.updated_at || new Date().toISOString()
        ),
        waitingCount: normalizedCounts.waitingCount,
        calledCount: normalizedCounts.calledCount,
        estimatedWaitMin: toFiniteNumber(
            meta.estimatedWaitMin ??
                meta.estimated_wait_min ??
                Math.max(0, nextTicketWaits.length ? nextTicketWaits[nextTicketWaits.length - 1] : 0),
            0
        ),
        delayReason: String(meta.delayReason || meta.delay_reason || ''),
        assistancePendingCount: toFiniteNumber(
            meta.assistancePendingCount ??
                meta.assistance_pending_count ??
                activeHelpRequests.filter(
                    (request) =>
                        String(request?.status || '').toLowerCase() ===
                        'pending'
                ).length,
            0
        ),
        activeHelpRequests,
        recentResolvedHelpRequests,
        counts: {
            waiting: normalizedCounts.waitingCount,
            called: normalizedCounts.calledCount,
            completed: normalizedCounts.completedCount,
            no_show: normalizedCounts.noShowCount,
            cancelled: normalizedCounts.cancelledCount,
        },
        callingNowByConsultorio: {
            1: c1,
            2: c2,
        },
        nextTickets,
    };
}
