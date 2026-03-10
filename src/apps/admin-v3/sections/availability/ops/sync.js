import { getState } from '../../../shared/core/store.js';
import {
    cloneAvailability,
    normalizeMonthAnchor,
    resolveSelectedDate,
} from '../helpers.js';
import { renderAvailabilitySection } from '../render.js';
import { setAvailabilityPatch } from '../state.js';

export function syncAvailabilityFromData() {
    const state = getState();
    const baseMap = cloneAvailability(state.data.availability || {});
    const selectedDate = resolveSelectedDate(
        state.availability.selectedDate,
        baseMap
    );
    const monthAnchor = normalizeMonthAnchor(
        state.availability.monthAnchor,
        selectedDate
    );

    setAvailabilityPatch({
        draft: baseMap,
        selectedDate,
        monthAnchor,
        draftDirty: false,
        lastAction: '',
    });
    renderAvailabilitySection();
}

export function hasPendingAvailabilityChanges() {
    return Boolean(getState().availability.draftDirty);
}
