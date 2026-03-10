import { getState } from '../../../shared/core/store.js';
import { qs, toIsoDateKey } from '../../../shared/ui/render.js';
import { normalizeDateKey, normalizeMonthAnchor } from '../helpers.js';
import { findDateWithSlots, isReadOnlyMode } from '../selectors.js';
import { setActionStatus, setAvailabilityPatch } from '../state.js';
import {
    jumpToAvailabilityDate,
    normalizeAvailabilityInputTime,
} from './shared.js';

export function selectAvailabilityDate(dateKey) {
    const normalized = normalizeDateKey(dateKey);
    if (!normalized) return;
    setAvailabilityPatch(
        {
            selectedDate: normalized,
            monthAnchor: normalizeMonthAnchor(normalized, normalized),
            lastAction: '',
        },
        { render: true }
    );
}

export function changeAvailabilityMonth(delta) {
    const amount = Number(delta || 0);
    if (!Number.isFinite(amount) || amount === 0) return;
    const current = normalizeMonthAnchor(
        getState().availability.monthAnchor,
        getState().availability.selectedDate
    );
    current.setMonth(current.getMonth() + amount);
    setAvailabilityPatch(
        {
            monthAnchor: current,
            lastAction: '',
        },
        { render: true }
    );
}

export function jumpAvailabilityToday() {
    jumpToAvailabilityDate(toIsoDateKey(new Date()), 'Hoy');
}

export function jumpAvailabilityNextWithSlots() {
    const candidate = findDateWithSlots(1);
    if (!candidate) {
        setActionStatus('No hay fechas siguientes con slots');
        return;
    }
    jumpToAvailabilityDate(
        candidate,
        `Siguiente fecha con slots: ${candidate}`
    );
}

export function jumpAvailabilityPrevWithSlots() {
    const candidate = findDateWithSlots(-1);
    if (!candidate) {
        setActionStatus('No hay fechas anteriores con slots');
        return;
    }
    jumpToAvailabilityDate(candidate, `Fecha previa con slots: ${candidate}`);
}

export function prefillAvailabilityTime(time) {
    if (isReadOnlyMode()) return;
    const input = qs('#newSlotTime');
    if (input instanceof HTMLInputElement) {
        input.value = normalizeAvailabilityInputTime(time);
        input.focus();
    }
}
