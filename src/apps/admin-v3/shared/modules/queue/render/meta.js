import { getState } from '../../../core/store.js';
import { normalize, toMillis } from '../helpers.js';
import { setText } from '../../../ui/render.js';

let lastWatchdogBucket = '';

export function setQueueNowMeta(queueMeta, appendActivity) {
    const state = getState();
    const c1 =
        queueMeta.callingNowByConsultorio?.['1'] ||
        queueMeta.callingNowByConsultorio?.[1] ||
        null;
    const c2 =
        queueMeta.callingNowByConsultorio?.['2'] ||
        queueMeta.callingNowByConsultorio?.[2] ||
        null;
    const c1Code = c1
        ? String(c1.ticketCode || c1.ticket_code || 'A-000')
        : 'Sin llamado';
    const c2Code = c2
        ? String(c2.ticketCode || c2.ticket_code || 'A-000')
        : 'Sin llamado';

    setText(
        '#queueWaitingCountAdmin',
        Number(queueMeta.waitingCount || queueMeta.counts?.waiting || 0)
    );
    setText(
        '#queueCalledCountAdmin',
        Number(queueMeta.calledCount || queueMeta.counts?.called || 0)
    );
    setText('#queueC1Now', c1Code);
    setText('#queueC2Now', c2Code);

    const releaseC1 = document.getElementById('queueReleaseC1');
    if (releaseC1 instanceof HTMLButtonElement) {
        releaseC1.hidden = !c1;
        releaseC1.textContent = c1 ? `Liberar C1 · ${c1Code}` : 'Release C1';
        if (c1) {
            releaseC1.setAttribute('data-queue-id', String(Number(c1.id || 0)));
        } else {
            releaseC1.removeAttribute('data-queue-id');
        }
    }

    const releaseC2 = document.getElementById('queueReleaseC2');
    if (releaseC2 instanceof HTMLButtonElement) {
        releaseC2.hidden = !c2;
        releaseC2.textContent = c2 ? `Liberar C2 · ${c2Code}` : 'Release C2';
        if (c2) {
            releaseC2.setAttribute('data-queue-id', String(Number(c2.id || 0)));
        } else {
            releaseC2.removeAttribute('data-queue-id');
        }
    }

    const syncNode = document.getElementById('queueSyncStatus');
    if (normalize(state.queue.syncMode) === 'fallback') {
        setText('#queueSyncStatus', 'fallback');
        if (syncNode) syncNode.setAttribute('data-state', 'fallback');
        return;
    }

    const updatedAt = String(queueMeta.updatedAt || '').trim();
    if (!updatedAt) return;

    const ageSec = Math.max(
        0,
        Math.round((Date.now() - toMillis(updatedAt)) / 1000)
    );
    const stale = ageSec >= 60;
    setText('#queueSyncStatus', stale ? `Watchdog (${ageSec}s)` : 'vivo');
    if (syncNode) {
        syncNode.setAttribute('data-state', stale ? 'reconnecting' : 'live');
    }

    if (stale) {
        const bucket = `stale-${Math.floor(ageSec / 15)}`;
        if (bucket !== lastWatchdogBucket) {
            lastWatchdogBucket = bucket;
            appendActivity('Watchdog de cola: realtime en reconnecting');
        }
        return;
    }

    lastWatchdogBucket = 'live';
}
