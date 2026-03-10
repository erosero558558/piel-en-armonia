import { setText } from '../../../../ui/render.js';

export function renderQueueCountMeta(queueMeta) {
    setText(
        '#queueWaitingCountAdmin',
        Number(queueMeta.waitingCount || queueMeta.counts?.waiting || 0)
    );
    setText(
        '#queueCalledCountAdmin',
        Number(queueMeta.calledCount || queueMeta.counts?.called || 0)
    );
}
