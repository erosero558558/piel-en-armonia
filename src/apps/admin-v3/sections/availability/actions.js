import { apiRequest } from '../../shared/core/api-client.js';
import { getState, updateState } from '../../shared/core/store.js';
import { qs, toIsoDateKey } from '../../shared/ui/render.js';
import {
    cloneAvailability,
    normalizeDateKey,
    normalizeMonthAnchor,
    normalizeTime,
    resolveSelectedDate,
    resolveWeekBounds,
    toDateFromKey,
} from './helpers.js';
import {
    currentDraftMap,
    findDateWithSlots,
    isReadOnlyMode,
    readSelectedDateOrDefault,
    sortTimes,
} from './selectors.js';
import {
    setActionStatus,
    setAvailabilityPatch,
    setDraftAndRender,
    writeSlotsForDate,
} from './state.js';
import { renderAvailabilitySection } from './render.js';

function jumpToAvailabilityDate(dateKey, label) {
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
    const today = toIsoDateKey(new Date());
    jumpToAvailabilityDate(today, 'Hoy');
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
        input.value = normalizeTime(time);
        input.focus();
    }
}

export function addAvailabilitySlot() {
    if (isReadOnlyMode()) return;
    const input = qs('#newSlotTime');
    if (!(input instanceof HTMLInputElement)) return;

    const time = normalizeTime(input.value);
    if (!time) return;

    const state = getState();
    const dateKey =
        normalizeDateKey(state.availability.selectedDate) ||
        readSelectedDateOrDefault();
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
    const normalizedTime = normalizeTime(time);
    writeSlotsForDate(
        normalizedDate,
        slots.filter((item) => normalizeTime(item) !== normalizedTime),
        `Slot ${normalizedTime || '-'} removido en ${normalizedDate}`
    );
}

export function copyAvailabilityDay() {
    if (isReadOnlyMode()) return;
    const state = getState();
    const dateKey =
        normalizeDateKey(state.availability.selectedDate) ||
        readSelectedDateOrDefault();
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

    const dateKey =
        normalizeDateKey(state.availability.selectedDate) ||
        readSelectedDateOrDefault();
    writeSlotsForDate(
        dateKey,
        clipboard,
        `Pegado ${clipboard.length} slots en ${dateKey}`
    );
}

export function duplicateAvailabilityDay(daysOffset) {
    if (isReadOnlyMode()) return;
    const state = getState();
    const selected =
        normalizeDateKey(state.availability.selectedDate) ||
        readSelectedDateOrDefault();
    const slots = Array.isArray(state.availability.draft[selected])
        ? state.availability.draft[selected]
        : [];
    const baseDate = toDateFromKey(selected);
    if (!baseDate) return;

    baseDate.setDate(baseDate.getDate() + Number(daysOffset || 0));
    const targetDate = toIsoDateKey(baseDate);
    writeSlotsForDate(
        targetDate,
        slots,
        `Duplicado ${slots.length} slots en ${targetDate}`
    );
}

export function clearAvailabilityDay() {
    if (isReadOnlyMode()) return;
    const state = getState();
    const selected =
        normalizeDateKey(state.availability.selectedDate) ||
        readSelectedDateOrDefault();
    if (!selected) return;

    const confirmed = window.confirm(
        `Se eliminaran los slots del dia ${selected}. Continuar?`
    );
    if (!confirmed) return;

    writeSlotsForDate(selected, [], `Dia ${selected} limpiado`);
}

export function clearAvailabilityWeek() {
    if (isReadOnlyMode()) return;
    const state = getState();
    const selected =
        normalizeDateKey(state.availability.selectedDate) ||
        readSelectedDateOrDefault();
    if (!selected) return;

    const bounds = resolveWeekBounds(selected);
    if (!bounds) return;
    const startKey = toIsoDateKey(bounds.start);
    const endKey = toIsoDateKey(bounds.end);

    const confirmed = window.confirm(
        `Se eliminaran los slots de la semana ${startKey} a ${endKey}. Continuar?`
    );
    if (!confirmed) return;

    const draft = currentDraftMap();
    for (let i = 0; i < 7; i += 1) {
        const date = new Date(bounds.start);
        date.setDate(bounds.start.getDate() + i);
        delete draft[toIsoDateKey(date)];
    }

    setDraftAndRender(draft, {
        selectedDate: selected,
        lastAction: `Semana limpiada (${startKey} - ${endKey})`,
    });
}

export async function saveAvailabilityDraft() {
    if (isReadOnlyMode()) return;
    const draft = currentDraftMap();
    const response = await apiRequest('availability', {
        method: 'POST',
        body: {
            availability: draft,
        },
    });

    const serverDraft =
        response?.data && typeof response.data === 'object'
            ? cloneAvailability(response.data)
            : draft;
    const responseMeta =
        response?.meta && typeof response.meta === 'object'
            ? response.meta
            : null;

    updateState((state) => ({
        ...state,
        data: {
            ...state.data,
            availability: serverDraft,
            availabilityMeta: responseMeta
                ? {
                      ...state.data.availabilityMeta,
                      ...responseMeta,
                  }
                : state.data.availabilityMeta,
        },
        availability: {
            ...state.availability,
            draft: serverDraft,
            draftDirty: false,
            lastAction: `Cambios guardados ${new Date().toLocaleTimeString(
                'es-EC',
                {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                }
            )}`,
        },
    }));
    renderAvailabilitySection();
}

export function discardAvailabilityDraft() {
    if (isReadOnlyMode()) return;
    const state = getState();
    if (state.availability.draftDirty) {
        const confirmed = window.confirm(
            'Se descartaran los cambios pendientes de disponibilidad. Continuar?'
        );
        if (!confirmed) return;
    }

    const base = cloneAvailability(state.data.availability || {});
    const selectedDate = resolveSelectedDate(
        state.availability.selectedDate,
        base
    );
    const monthAnchor = normalizeMonthAnchor(
        state.availability.monthAnchor,
        selectedDate
    );
    setAvailabilityPatch(
        {
            draft: base,
            selectedDate,
            monthAnchor,
            draftDirty: false,
            lastAction: 'Borrador descartado',
        },
        { render: true }
    );
}
