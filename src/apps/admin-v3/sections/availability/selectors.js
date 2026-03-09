import { getState } from '../../shared/core/store.js';
import { toIsoDateKey } from '../../shared/ui/render.js';
import {
    cloneAvailability,
    formatDateKeyLabel,
    normalizeDateKey,
    normalizeMonthAnchor,
    resolveSelectedDate,
    serializeAvailability,
    sortTimes,
    toDateFromKey,
} from './helpers.js';

export function draftIsDirty(draft) {
    const base = cloneAvailability(getState().data.availability || {});
    return serializeAvailability(draft) !== serializeAvailability(base);
}

export function currentDraftMap() {
    const state = getState();
    return cloneAvailability(state.availability.draft || {});
}

export function isReadOnlyMode() {
    const state = getState();
    const meta = state.data.availabilityMeta || {};
    return String(meta.source || '').toLowerCase() === 'google';
}

export function getCalendarModeSummary() {
    const meta = getState().data.availabilityMeta || {};
    const readOnly = isReadOnlyMode();
    const sourceText = readOnly ? 'Google Calendar' : 'Local';
    const modeText = readOnly ? 'Solo lectura' : 'Editable';
    const timezone = String(
        meta.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || '-'
    );
    return { sourceText, modeText, timezone };
}

export function monthLabel(date) {
    return new Intl.DateTimeFormat('es-EC', {
        month: 'long',
        year: 'numeric',
    }).format(date);
}

export function buildMonthDays(anchorDate) {
    const start = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
    const offset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - offset);

    const days = [];
    for (let i = 0; i < 42; i += 1) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        days.push(date);
    }
    return days;
}

export function readSelectedDateOrDefault() {
    const state = getState();
    const selected = normalizeDateKey(state.availability.selectedDate);
    if (selected) return selected;

    const draft = cloneAvailability(state.availability.draft || {});
    const firstDate = Object.keys(draft)[0];
    if (firstDate) return firstDate;

    return toIsoDateKey(new Date());
}

export function describeDay(slots, readOnly) {
    if (!slots.length) {
        return readOnly
            ? 'No hay slots publicados en este dia.'
            : 'Agrega slots o copia una jornada existente.';
    }

    if (slots.length === 1) {
        return `1 slot publicado. ${readOnly ? 'Lectura desde Google Calendar.' : 'Puedes duplicarlo o ampliarlo.'}`;
    }

    return `${slots.length} slots en el dia. ${readOnly ? 'Referencia en solo lectura.' : 'Listo para copiar o limpiar.'}`;
}

export function resolveAvailabilityViewState() {
    const state = getState();
    const selectedDate = resolveSelectedDate(
        state.availability.selectedDate,
        state.availability.draft || {}
    );
    const monthAnchor = normalizeMonthAnchor(
        state.availability.monthAnchor,
        selectedDate
    );
    return {
        state,
        selectedDate,
        monthAnchor,
        readOnly: isReadOnlyMode(),
    };
}

export function findDateWithSlots(direction = 1) {
    const draft = currentDraftMap();
    const keys = Object.keys(draft).filter((date) => draft[date]?.length > 0);
    if (!keys.length) return '';

    const reference =
        normalizeDateKey(getState().availability.selectedDate) ||
        toIsoDateKey(new Date());

    const ordered = direction >= 0 ? keys.sort() : keys.sort().reverse();
    return (
        ordered.find((date) =>
            direction >= 0 ? date >= reference : date <= reference
        ) || ''
    );
}

export function getSelectedDaySlots() {
    const state = getState();
    const selectedDate = readSelectedDateOrDefault();
    const draft = cloneAvailability(state.availability.draft);
    return {
        selectedDate,
        slots: sortTimes(draft[selectedDate] || []),
    };
}

export {
    formatDateKeyLabel,
    normalizeDateKey,
    normalizeMonthAnchor,
    sortTimes,
    toDateFromKey,
};
