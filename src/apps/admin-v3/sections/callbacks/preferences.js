import { getState, updateState } from '../../shared/core/store.js';
import {
    CALLBACK_FILTER_STORAGE_KEY,
    CALLBACK_SORT_STORAGE_KEY,
} from './constants.js';
import { normalizeFilter, normalizeSort } from './utils.js';

export function persistPreferences(callbacksState) {
    try {
        localStorage.setItem(
            CALLBACK_FILTER_STORAGE_KEY,
            JSON.stringify(normalizeFilter(callbacksState.filter))
        );
        localStorage.setItem(
            CALLBACK_SORT_STORAGE_KEY,
            JSON.stringify(normalizeSort(callbacksState.sort))
        );
    } catch (_error) {
        // no-op
    }
}

export function hydrateCallbacksPreferences() {
    let filter = 'all';
    let sort = 'recent_desc';

    try {
        filter = JSON.parse(
            localStorage.getItem(CALLBACK_FILTER_STORAGE_KEY) || '"all"'
        );
        sort = JSON.parse(
            localStorage.getItem(CALLBACK_SORT_STORAGE_KEY) || '"recent_desc"'
        );
    } catch (_error) {
        // no-op
    }

    updateState((state) => ({
        ...state,
        callbacks: {
            ...state.callbacks,
            filter: normalizeFilter(filter),
            sort: normalizeSort(sort),
        },
    }));
}

export function persistCurrentCallbackPreferences() {
    persistPreferences(getState().callbacks);
}
