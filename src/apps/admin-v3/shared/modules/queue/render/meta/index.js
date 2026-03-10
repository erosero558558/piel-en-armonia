import { getState } from '../../../../core/store.js';
import { renderQueueCountMeta } from './counts.js';
import { renderQueueStationMeta } from './stations.js';
import { renderQueueSyncMeta } from './sync.js';

export function setQueueNowMeta(queueMeta, appendActivity) {
    const state = getState();

    renderQueueCountMeta(queueMeta);
    renderQueueStationMeta(queueMeta);
    renderQueueSyncMeta(state, queueMeta, appendActivity);
}
