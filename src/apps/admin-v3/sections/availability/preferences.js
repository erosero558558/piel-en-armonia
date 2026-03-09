import { getState, updateState } from '../../shared/core/store.js';
import { toIsoDateKey } from '../../shared/ui/render.js';
import {
    AVAILABILITY_MONTH_ANCHOR_STORAGE_KEY,
    AVAILABILITY_SELECTED_DATE_STORAGE_KEY,
} from './constants.js';
import { normalizeDateKey, normalizeMonthAnchor } from './helpers.js';

export function persistAvailabilityPreferences() {
    const state = getState();
    const selectedDate = normalizeDateKey(state.availability.selectedDate);
    const monthAnchor = normalizeMonthAnchor(
        state.availability.monthAnchor,
        selectedDate
    );

    try {
        if (selectedDate) {
            localStorage.setItem(
                AVAILABILITY_SELECTED_DATE_STORAGE_KEY,
                selectedDate
            );
        } else {
            localStorage.removeItem(AVAILABILITY_SELECTED_DATE_STORAGE_KEY);
        }
        localStorage.setItem(
            AVAILABILITY_MONTH_ANCHOR_STORAGE_KEY,
            toIsoDateKey(monthAnchor)
        );
    } catch (_error) {
        // no-op
    }
}

export function hydrateAvailabilityPreferences() {
    let selectedDate = '';
    let monthAnchor = '';
    try {
        selectedDate = String(
            localStorage.getItem(AVAILABILITY_SELECTED_DATE_STORAGE_KEY) || ''
        );
        monthAnchor = String(
            localStorage.getItem(AVAILABILITY_MONTH_ANCHOR_STORAGE_KEY) || ''
        );
    } catch (_error) {
        // no-op
    }

    const normalizedSelected = normalizeDateKey(selectedDate);
    const normalizedAnchor = normalizeMonthAnchor(
        monthAnchor,
        normalizedSelected
    );

    updateState((state) => ({
        ...state,
        availability: {
            ...state.availability,
            ...(normalizedSelected ? { selectedDate: normalizedSelected } : {}),
            monthAnchor: normalizedAnchor,
        },
    }));
}
