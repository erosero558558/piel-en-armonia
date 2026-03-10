import { getState } from '../../../shared/core/store.js';
import { setHtml, setText } from '../../../shared/ui/render.js';
import {
    applyFilter,
    applySearch,
    computeOps,
    sortItems,
} from '../selectors.js';
import { callbackCard } from './card.js';
import { syncCallbackBulkActions, syncCallbackControls } from './controls.js';
import { renderCallbackDeck } from './deck.js';

function renderCallbacksGrid(sorted, selectedSet) {
    return sorted.length
        ? sorted
              .map((item, index) =>
                  callbackCard(item, {
                      selected: selectedSet.has(Number(item.id || 0)),
                      position: index + 1,
                  })
              )
              .join('')
        : '<p class="callbacks-grid-empty" data-admin-empty-state="callbacks">No hay callbacks para el filtro actual.</p>';
}

export function renderCallbacksSection() {
    const state = getState();
    const source = Array.isArray(state?.data?.callbacks)
        ? state.data.callbacks
        : [];
    const callbacksState = state.callbacks;
    const filtered = applyFilter(source, callbacksState.filter);
    const searched = applySearch(filtered, callbacksState.search);
    const sorted = sortItems(searched, callbacksState.sort);
    const selectedSet = new Set(
        (callbacksState.selected || []).map((value) => Number(value || 0))
    );
    const ops = computeOps(source);

    setHtml('#callbacksGrid', renderCallbacksGrid(sorted, selectedSet));
    syncCallbackControls(callbacksState, sorted.length, source.length);

    setText('#callbacksOpsPendingCount', ops.pendingCount);
    setText('#callbacksOpsUrgentCount', ops.urgentCount);
    setText('#callbacksOpsTodayCount', ops.todayCount);
    setText('#callbacksOpsQueueHealth', ops.queueHealth);

    syncCallbackBulkActions(sorted.length, selectedSet.size);
    renderCallbackDeck(ops, sorted.length, source.length, selectedSet.size);
}
