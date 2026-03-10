import { getState, updateState } from '../../../core/store.js';
import { persistQueueUi } from '../persistence.js';
import { renderQueueSection } from '../render.js';
import { normalize } from '../helpers.js';
import { appendActivity } from './activity.js';

export function updateQueueUi(patch) {
    updateState((state) => ({
        ...state,
        queue: {
            ...state.queue,
            ...patch,
        },
    }));
    persistQueueUi(getState());
    renderQueueSection(appendActivity);
}

export function setQueueFilter(filter) {
    updateQueueUi({ filter: normalize(filter) || 'all', selected: [] });
}

export function setQueueSearch(search) {
    updateQueueUi({ search: String(search || ''), selected: [] });
}

export function clearQueueSearch() {
    updateQueueUi({ search: '', selected: [] });
    const input = document.getElementById('queueSearchInput');
    if (input instanceof HTMLInputElement) input.value = '';
}
