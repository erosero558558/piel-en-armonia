import { getState } from '../../../shared/core/store.js';
import { toIsoDateKey } from '../../../shared/ui/render.js';
import {
    normalizeDateKey,
    normalizeMonthAnchor,
    normalizeTime,
    toDateFromKey,
} from '../helpers.js';
import { readSelectedDateOrDefault } from '../selectors.js';
import { setAvailabilityPatch } from '../state.js';

export function jumpToAvailabilityDate(dateKey, label) {
    const normalized = normalizeDateKey(dateKey);
    if (!normalized) return;
    setAvailabilityPatch(
        {
            selectedDate: normalized,
            monthAnchor: normalizeMonthAnchor(normalized, normalized),
            lastAction: label || '',
        },
        { render: true }
    );
}

export function getSelectedAvailabilityDate() {
    const state = getState();
    return (
        normalizeDateKey(state.availability.selectedDate) ||
        readSelectedDateOrDefault()
    );
}

export function normalizeAvailabilityInputTime(value) {
    return normalizeTime(value);
}

export function offsetDateKey(dateKey, daysOffset) {
    const baseDate = toDateFromKey(dateKey);
    if (!baseDate) return '';
    baseDate.setDate(baseDate.getDate() + Number(daysOffset || 0));
    return toIsoDateKey(baseDate);
}
