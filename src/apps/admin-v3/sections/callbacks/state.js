import { getState, updateState } from '../../shared/core/store.js';
import { persistPreferences } from './preferences.js';
import { renderCallbacksSection } from './render.js';
import { normalizeFilter, normalizeSort } from './utils.js';

function updateCallbacksState(patch, { persist = true } = {}) {
    updateState((state) => ({
        ...state,
        callbacks: {
            ...state.callbacks,
            ...patch,
        },
    }));

    if (persist) {
        persistPreferences(getState().callbacks);
    }

    renderCallbacksSection();
}

export function setCallbacksFilter(filter) {
    updateCallbacksState({
        filter: normalizeFilter(filter),
        selected: [],
    });
}

export function setCallbacksSort(sort) {
    updateCallbacksState({
        sort: normalizeSort(sort),
        selected: [],
    });
}

export function setCallbacksSearch(search) {
    updateCallbacksState({
        search: String(search || ''),
        selected: [],
    });
}

export function clearCallbacksFilters() {
    updateCallbacksState({
        filter: 'all',
        sort: 'recent_desc',
        search: '',
        selected: [],
    });
}

export function clearCallbacksSelection() {
    updateCallbacksState({ selected: [] }, { persist: false });
}

export function selectVisibleCallbacks() {
    const cards = Array.from(
        document.querySelectorAll(
            '#callbacksGrid .callback-card[data-callback-status="pendiente"]'
        )
    );
    const ids = cards
        .map((card) => Number(card.getAttribute('data-callback-id') || 0))
        .filter((id) => id > 0);

    updateCallbacksState({ selected: ids }, { persist: false });
}

export function mutateCallbackStatus(id, status) {
    const targetId = Number(id || 0);

    updateState((state) => ({
        ...state,
        data: {
            ...state.data,
            callbacks: (state.data.callbacks || []).map((item) =>
                Number(item.id || 0) === targetId
                    ? {
                          ...item,
                          status,
                      }
                    : item
            ),
        },
        callbacks: {
            ...state.callbacks,
            selected: (state.callbacks.selected || []).filter(
                (value) => Number(value || 0) !== targetId
            ),
        },
    }));

    renderCallbacksSection();
}
