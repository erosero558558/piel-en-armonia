import {
    qs,
    setHtml,
    setText,
    toIsoDateKey,
    escapeHtml,
} from '../../shared/ui/render.js';
import { getState } from '../../shared/core/store.js';
import { persistAvailabilityPreferences } from './preferences.js';
import {
    buildMonthDays,
    describeDay,
    formatDateKeyLabel,
    getCalendarModeSummary,
    getSelectedDaySlots,
    isReadOnlyMode,
    monthLabel,
    normalizeMonthAnchor,
    readSelectedDateOrDefault,
    sortTimes,
} from './selectors.js';
import { cloneAvailability } from './helpers.js';

function renderSlotList() {
    const { selectedDate, slots } = getSelectedDaySlots();
    const readOnly = isReadOnlyMode();

    setText('#selectedDate', selectedDate || '-');

    if (!slots.length) {
        setHtml(
            '#timeSlotsList',
            `<p class="empty-message" data-admin-empty-state="availability-slots">${escapeHtml(
                describeDay([], readOnly)
            )}</p>`
        );
        return;
    }

    setHtml(
        '#timeSlotsList',
        slots
            .map(
                (time) => `
            <div class="time-slot-item">
                <div>
                    <strong>${escapeHtml(time)}</strong>
                    <small>${escapeHtml(readOnly ? 'Slot publicado' : 'Disponible para consulta')}</small>
                </div>
                <button type="button" data-action="remove-time-slot" data-date="${encodeURIComponent(
                    selectedDate
                )}" data-time="${encodeURIComponent(time)}" ${
                    readOnly ? 'disabled' : ''
                }>Quitar</button>
            </div>
        `
            )
            .join('')
    );
}

function renderCalendar() {
    const state = getState();
    const anchor = normalizeMonthAnchor(
        state.availability.monthAnchor,
        state.availability.selectedDate
    );
    const selectedDate = readSelectedDateOrDefault();
    const currentMonth = anchor.getMonth();
    const draft = cloneAvailability(state.availability.draft);
    const today = toIsoDateKey(new Date());

    setText('#calendarMonth', monthLabel(anchor));

    const markup = buildMonthDays(anchor)
        .map((date) => {
            const dateKey = toIsoDateKey(date);
            const slots = Array.isArray(draft[dateKey]) ? draft[dateKey] : [];
            const hasSlots = slots.length > 0;
            const inMonth = date.getMonth() === currentMonth;
            const classes = [
                'calendar-day',
                inMonth ? '' : 'other-month',
                hasSlots ? 'has-slots' : '',
                dateKey === selectedDate ? 'is-selected' : '',
                dateKey === today ? 'is-today' : '',
            ]
                .filter(Boolean)
                .join(' ');

            return `
                <button type="button" class="${classes}" data-action="select-availability-day" data-date="${dateKey}">
                    <span>${date.getDate()}</span>
                    <small>${hasSlots ? `${slots.length} slot${slots.length === 1 ? '' : 's'}` : inMonth ? 'Sin slots' : ''}</small>
                </button>
            `;
        })
        .join('');

    setHtml('#availabilityCalendar', markup);
}

function refreshAvailabilityHeader() {
    const state = getState();
    const selectedDate = readSelectedDateOrDefault();
    const draft = cloneAvailability(state.availability.draft);
    const slots = Array.isArray(draft[selectedDate])
        ? sortTimes(draft[selectedDate])
        : [];
    const readOnly = isReadOnlyMode();
    const { sourceText, modeText, timezone } = getCalendarModeSummary();

    setText(
        '#availabilityHeading',
        readOnly
            ? 'Calendario de disponibilidad - Solo lectura'
            : 'Calendario de disponibilidad'
    );
    setText('#availabilitySourceBadge', `Fuente: ${sourceText}`);
    setText('#availabilityModeBadge', `Modo: ${modeText}`);
    setText('#availabilityTimezoneBadge', `TZ: ${timezone}`);

    setText(
        '#availabilitySelectionSummary',
        `Fecha: ${selectedDate} | ${formatDateKeyLabel(selectedDate)} | Fuente: ${sourceText} | Modo: ${modeText} | Slots: ${slots.length}`
    );
    setText(
        '#availabilityDraftStatus',
        state.availability.draftDirty
            ? 'cambios pendientes'
            : 'Sin cambios pendientes'
    );
    setText(
        '#availabilitySyncStatus',
        readOnly ? `Google Calendar | ${timezone}` : `Store local | ${timezone}`
    );

    const addSlotForm = qs('#addSlotForm');
    const presets = qs('#availabilityQuickSlotPresets');
    if (addSlotForm) addSlotForm.classList.toggle('is-hidden', readOnly);
    if (presets) presets.classList.toggle('is-hidden', readOnly);

    const addSlotInput = qs('#newSlotTime');
    if (addSlotInput instanceof HTMLInputElement) {
        addSlotInput.disabled = readOnly;
    }

    const addSlotButton = qs('[data-action="add-time-slot"]');
    if (addSlotButton instanceof HTMLButtonElement) {
        addSlotButton.disabled = readOnly;
    }

    const clipboardSize = Array.isArray(state.availability.clipboard)
        ? state.availability.clipboard.length
        : 0;
    let dayActionStatus = describeDay(slots, readOnly);
    if (readOnly) {
        dayActionStatus = 'Edicion bloqueada por proveedor Google';
    } else if (state.availability.lastAction) {
        dayActionStatus = String(state.availability.lastAction);
    } else if (clipboardSize) {
        dayActionStatus = `Portapapeles: ${clipboardSize} slots`;
    }
    setText('#availabilityDayActionsStatus', dayActionStatus);

    const actionButtons = document.querySelectorAll(
        '#availabilityDayActions [data-action], #availabilitySaveDraftBtn, #availabilityDiscardDraftBtn'
    );
    actionButtons.forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) return;
        if (button.id === 'availabilityDiscardDraftBtn') {
            button.disabled = readOnly || !state.availability.draftDirty;
            return;
        }
        if (button.id === 'availabilitySaveDraftBtn') {
            button.disabled = readOnly || !state.availability.draftDirty;
            return;
        }
        const action = String(button.dataset.action || '');
        if (action === 'paste-availability-day') {
            button.disabled = readOnly || clipboardSize === 0;
            return;
        }
        button.disabled = readOnly;
    });
}

export function renderAvailabilitySection() {
    renderCalendar();
    renderSlotList();
    refreshAvailabilityHeader();
    persistAvailabilityPreferences();
}
