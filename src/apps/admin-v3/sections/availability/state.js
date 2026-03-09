import { getState, updateState } from '../../shared/core/store.js';
import {
    cloneAvailability,
    normalizeDateKey,
    normalizeMonthAnchor,
    resolveSelectedDate,
    sortTimes,
} from './helpers.js';
import {
    draftIsDirty,
    currentDraftMap,
    readSelectedDateOrDefault,
} from './selectors.js';
import { renderAvailabilitySection } from './render.js';
import { persistAvailabilityPreferences } from './preferences.js';

export function setAvailabilityPatch(patch, { render = false } = {}) {
    updateState((state) => ({
        ...state,
        availability: {
            ...state.availability,
            ...patch,
        },
    }));

    if (render) {
        renderAvailabilitySection();
    } else {
        persistAvailabilityPreferences();
    }
}

export function setDraftAndRender(draft, patch = {}) {
    const normalizedDraft = cloneAvailability(draft);
    const selectedDate = resolveSelectedDate(
        patch.selectedDate || getState().availability.selectedDate,
        normalizedDraft
    );
    const monthAnchor = normalizeMonthAnchor(
        patch.monthAnchor || getState().availability.monthAnchor,
        selectedDate
    );

    setAvailabilityPatch(
        {
            draft: normalizedDraft,
            selectedDate,
            monthAnchor,
            draftDirty: draftIsDirty(normalizedDraft),
            ...patch,
        },
        { render: true }
    );
}

export function setActionStatus(statusMessage) {
    setAvailabilityPatch(
        {
            lastAction: String(statusMessage || ''),
        },
        { render: true }
    );
}

export function writeSlotsForDate(dateKey, slots, lastAction = '') {
    const normalizedDate =
        normalizeDateKey(dateKey) || readSelectedDateOrDefault();
    if (!normalizedDate) return;

    const draft = currentDraftMap();
    const nextSlots = sortTimes(Array.isArray(slots) ? slots : []);
    if (nextSlots.length) {
        draft[normalizedDate] = nextSlots;
    } else {
        delete draft[normalizedDate];
    }

    setDraftAndRender(draft, {
        selectedDate: normalizedDate,
        monthAnchor: normalizedDate,
        lastAction,
    });
}
