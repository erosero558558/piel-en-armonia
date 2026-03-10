import { apiRequest } from '../../../shared/core/api-client.js';
import { getState, updateState } from '../../../shared/core/store.js';
import { toIsoDateKey } from '../../../shared/ui/render.js';
import {
    cloneAvailability,
    normalizeMonthAnchor,
    resolveSelectedDate,
    resolveWeekBounds,
} from '../helpers.js';
import { currentDraftMap, isReadOnlyMode } from '../selectors.js';
import { renderAvailabilitySection } from '../render.js';
import {
    setAvailabilityPatch,
    setDraftAndRender,
    writeSlotsForDate,
} from '../state.js';
import { getSelectedAvailabilityDate } from './shared.js';

export function clearAvailabilityDay() {
    if (isReadOnlyMode()) return;
    const selected = getSelectedAvailabilityDate();
    if (!selected) return;

    const confirmed = window.confirm(
        `Se eliminaran los slots del dia ${selected}. Continuar?`
    );
    if (!confirmed) return;

    writeSlotsForDate(selected, [], `Dia ${selected} limpiado`);
}

export function clearAvailabilityWeek() {
    if (isReadOnlyMode()) return;
    const selected = getSelectedAvailabilityDate();
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
