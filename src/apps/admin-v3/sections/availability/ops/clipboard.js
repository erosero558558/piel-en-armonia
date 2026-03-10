import { getState } from '../../../shared/core/store.js';
import { isReadOnlyMode, sortTimes } from '../selectors.js';
import {
    setActionStatus,
    setAvailabilityPatch,
    writeSlotsForDate,
} from '../state.js';
import { getSelectedAvailabilityDate } from './shared.js';

export function copyAvailabilityDay() {
    if (isReadOnlyMode()) return;
    const state = getState();
    const dateKey = getSelectedAvailabilityDate();
    if (!dateKey) return;

    const slots = Array.isArray(state.availability.draft[dateKey])
        ? sortTimes(state.availability.draft[dateKey])
        : [];

    setAvailabilityPatch(
        {
            clipboard: slots,
            clipboardDate: dateKey,
            lastAction: slots.length
                ? `Portapapeles: ${slots.length} slots (${dateKey})`
                : 'Portapapeles vacio',
        },
        { render: true }
    );
}

export function pasteAvailabilityDay() {
    if (isReadOnlyMode()) return;
    const state = getState();
    const clipboard = Array.isArray(state.availability.clipboard)
        ? sortTimes(state.availability.clipboard)
        : [];
    if (!clipboard.length) {
        setActionStatus('Portapapeles vacio');
        return;
    }

    const dateKey = getSelectedAvailabilityDate();
    if (!dateKey) return;

    writeSlotsForDate(
        dateKey,
        clipboard,
        `Pegado ${clipboard.length} slots en ${dateKey}`
    );
}
