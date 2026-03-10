import { normalize, toMillis } from '../../helpers.js';
import { setText } from '../../../../ui/render.js';

let lastWatchdogBucket = '';

export function renderQueueSyncMeta(state, queueMeta, appendActivity) {
    const syncNode = document.getElementById('queueSyncStatus');

    if (normalize(state.queue.syncMode) === 'fallback') {
        setText('#queueSyncStatus', 'fallback');
        if (syncNode) {
            syncNode.setAttribute('data-state', 'fallback');
        }
        return;
    }

    const updatedAt = String(queueMeta.updatedAt || '').trim();
    if (!updatedAt) {
        return;
    }

    const ageSec = Math.max(
        0,
        Math.round((Date.now() - toMillis(updatedAt)) / 1000)
    );
    const stale = ageSec >= 60;
    const assistancePending = Math.max(
        0,
        Number(queueMeta.assistancePendingCount || 0)
    );
    const baseStatus = stale ? `Watchdog (${ageSec}s)` : 'vivo';
    const statusText = assistancePending
        ? `${baseStatus} · ${assistancePending} apoyo(s)`
        : baseStatus;

    setText('#queueSyncStatus', statusText);
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
