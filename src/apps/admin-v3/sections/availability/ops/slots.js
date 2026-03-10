import { getState } from '../../../shared/core/store.js';
import { qs } from '../../../shared/ui/render.js';
import { normalizeDateKey } from '../helpers.js';
import { isReadOnlyMode } from '../selectors.js';
import { writeSlotsForDate } from '../state.js';
import {
    getSelectedAvailabilityDate,
    normalizeAvailabilityInputTime,
    offsetDateKey,
} from './shared.js';

export function addAvailabilitySlot() {
    if (isReadOnlyMode()) return;
    const input = qs('#newSlotTime');
    if (!(input instanceof HTMLInputElement)) return;

    const time = normalizeAvailabilityInputTime(input.value);
    if (!time) return;

    const state = getState();
    const dateKey = getSelectedAvailabilityDate();
    if (!dateKey) return;

    const current = Array.isArray(state.availability.draft[dateKey])
        ? state.availability.draft[dateKey]
        : [];
    writeSlotsForDate(
        dateKey,
        [...current, time],
        `Slot ${time} agregado en ${dateKey}`
    );
    input.value = '';
}

export function removeAvailabilitySlot(dateKey, time) {
    if (isReadOnlyMode()) return;
    const normalizedDate = normalizeDateKey(dateKey);
    if (!normalizedDate) return;

    const state = getState();
    const slots = Array.isArray(state.availability.draft[normalizedDate])
        ? state.availability.draft[normalizedDate]
        : [];
    const normalizedTime = normalizeAvailabilityInputTime(time);
    writeSlotsForDate(
        normalizedDate,
        slots.filter(
            (item) => normalizeAvailabilityInputTime(item) !== normalizedTime
        ),
        `Slot ${normalizedTime || '-'} removido en ${normalizedDate}`
    );
}

export function duplicateAvailabilityDay(daysOffset) {
    if (isReadOnlyMode()) return;
    const state = getState();
    const selected = getSelectedAvailabilityDate();
    if (!selected) return;

    const slots = Array.isArray(state.availability.draft[selected])
        ? state.availability.draft[selected]
        : [];
    const targetDate = offsetDateKey(selected, daysOffset);
    if (!targetDate) return;

    writeSlotsForDate(
        targetDate,
        slots,
        `Duplicado ${slots.length} slots en ${targetDate}`
    );
}
