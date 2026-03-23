import { getState } from '../../../core/store.js';
import { loadLocalAdminFallback } from '../../data/local.js';
import { setQueueStateWithTickets } from '../state.js';
import {
    applyQueueMetaFallback,
    applyQueueSnapshotFallback,
    getMetaFromStateData,
    getNormalizedStateTickets,
    getQueueSnapshot,
} from './fallbacks.js';
import { refreshQueueState } from './refresh.js';

export async function hydrateQueueFromData() {
    const tickets = getNormalizedStateTickets();
    const metaFromData = getMetaFromStateData(tickets);

    if (tickets.length) {
        setQueueStateWithTickets(tickets, metaFromData || null, {
            fallbackPartial: false,
            syncMode: 'live',
        });
        return;
    }

    const localFallback = loadLocalAdminFallback();
    const cachedTickets = Array.isArray(localFallback?.queueTickets)
        ? localFallback.queueTickets
        : [];
    if (cachedTickets.length) {
        setQueueStateWithTickets(cachedTickets, localFallback.queueMeta || null, {
            fallbackPartial: false,
            syncMode: 'live',
        });
        return;
    }

    if (applyQueueMetaFallback(metaFromData)) {
        return;
    }

    await refreshQueueState();
    const refreshed = getState().data.queueTickets || [];
    if (refreshed.length) return;

    if (
        applyQueueSnapshotFallback(
            getQueueSnapshot(),
            'Queue fallback desde snapshot local'
        )
    ) {
        return;
    }

    setQueueStateWithTickets([], null, {
        fallbackPartial: false,
        syncMode: 'live',
    });
}
