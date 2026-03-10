import { setText } from '../../../shared/ui/render.js';
import { persistPreferences } from '../preferences.js';
import { buildToolbarStateParts } from '../selectors.js';
import { normalize } from '../utils.js';

function updateQuickFilterButtons(filter) {
    const normalized = normalize(filter);
    document
        .querySelectorAll('.appointment-quick-filter-btn[data-filter-value]')
        .forEach((button) => {
            const isActive =
                normalize(button.dataset.filterValue) === normalized;
            button.classList.toggle('is-active', isActive);
        });
}

export function syncAppointmentControls(
    appointmentsState,
    visibleCount,
    totalCount
) {
    setText(
        '#appointmentsToolbarMeta',
        `Mostrando ${visibleCount} de ${totalCount}`
    );

    setText(
        '#appointmentsToolbarState',
        buildToolbarStateParts(appointmentsState, visibleCount).join(' | ')
    );

    const clearButton = document.getElementById('clearAppointmentsFiltersBtn');
    if (clearButton) {
        const canReset =
            normalize(appointmentsState.filter) !== 'all' ||
            normalize(appointmentsState.search) !== '';
        clearButton.classList.toggle('is-hidden', !canReset);
    }

    const filterSelect = document.getElementById('appointmentFilter');
    if (filterSelect instanceof HTMLSelectElement) {
        filterSelect.value = appointmentsState.filter;
    }

    const sortSelect = document.getElementById('appointmentSort');
    if (sortSelect instanceof HTMLSelectElement) {
        sortSelect.value = appointmentsState.sort;
    }

    const searchInput = document.getElementById('searchAppointments');
    if (
        searchInput instanceof HTMLInputElement &&
        searchInput.value !== appointmentsState.search
    ) {
        searchInput.value = appointmentsState.search;
    }

    const section = document.getElementById('appointments');
    if (section) {
        section.classList.toggle(
            'appointments-density-compact',
            normalize(appointmentsState.density) === 'compact'
        );
    }

    document
        .querySelectorAll('[data-action="appointment-density"][data-density]')
        .forEach((button) => {
            const isActive =
                normalize(button.dataset.density) ===
                normalize(appointmentsState.density);
            button.classList.toggle('is-active', isActive);
        });

    updateQuickFilterButtons(appointmentsState.filter);
    persistPreferences(appointmentsState);
}
