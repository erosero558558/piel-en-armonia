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

export function renderCallbacksSection() {
    const state = getState();
    const source = Array.isArray(state?.data?.callbacks)
        ? state.data.callbacks
        : [];
    const leadOpsMeta =
        state?.data?.leadOpsMeta && typeof state.data.leadOpsMeta === 'object'
            ? state.data.leadOpsMeta
            : null;
    const callbacksState = state.callbacks;
    const filtered = applyFilter(source, callbacksState.filter);
    const searched = applySearch(
        filtered,
        callbacksState.search,
        String(leadOpsMeta?.worker?.mode || '')
    );
    const sorted = sortItems(searched, callbacksState.sort);
    const selectedSet = new Set(
        (callbacksState.selected || []).map((value) => Number(value || 0))
    );
    const ops = computeOps(source, leadOpsMeta);

    setHtml(
        '#callbacksGrid',
        sorted.length
            ? sorted
                  .map((item, index) =>
                      callbackCard(item, {
                          selected: selectedSet.has(Number(item.id || 0)),
                          position: index + 1,
                          workerMode: String(leadOpsMeta?.worker?.mode || ''),
                      })
                  )
                  .join('')
            : '<p class="callbacks-grid-empty" data-admin-empty-state="callbacks">No hay callbacks para el filtro actual.</p>'
    );
    syncCallbackControls(callbacksState, sorted.length, source.length);

    setText('#callbacksOpsPendingCount', ops.pendingCount);
    setText('#callbacksOpsUrgentCount', ops.hotCount);
    setText('#callbacksOpsTodayCount', ops.todayCount);
    setText('#callbacksOpsQueueHealth', ops.queueHealth);

    syncCallbackBulkActions(sorted.length, selectedSet.size);
    renderCallbackDeck(ops, sorted.length, source.length, selectedSet.size);
}
