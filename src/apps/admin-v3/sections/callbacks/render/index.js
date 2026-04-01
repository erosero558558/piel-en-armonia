import { getState } from '../../../shared/core/store.js';
import { setHtml, setText } from '../../../shared/ui/render.js';
import {
    applyDayFilter,
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
    console.log('XXX RENDER CALLBACKS SECTION:', source, state?.data?.callbacks);
    const leadOpsMeta =
        state?.data?.leadOpsMeta && typeof state.data.leadOpsMeta === 'object'
            ? state.data.leadOpsMeta
            : null;
    const callbacksState = state.callbacks;
    const dayScoped = applyDayFilter(source, callbacksState.day);
    const filtered = applyFilter(dayScoped, callbacksState.filter);
    const searched = applySearch(
        filtered,
        callbacksState.search,
        String(leadOpsMeta?.worker?.mode || '')
    );
    const sorted = sortItems(searched, callbacksState.sort);
    const selectedSet = new Set(
        (callbacksState.selected || []).map((value) => Number(value || 0))
    );
    const ops = computeOps(dayScoped, leadOpsMeta);

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
    syncCallbackControls(
        callbacksState,
        sorted.length,
        dayScoped.length,
        source.length
    );

    setText('#callbacksOpsPendingCount', ops.pendingCount);
    setText('#callbacksOpsUrgentCount', ops.hotCount);
    setText('#callbacksOpsNoContactCount', ops.withoutContactCount);
    setText('#callbacksOpsQueueHealth', ops.queueHealth);

    syncCallbackBulkActions(sorted.length, selectedSet.size);
    renderCallbackDeck(
        ops,
        sorted.length,
        dayScoped.length,
        source.length,
        selectedSet.size
    );
}
