import { setText } from '../../../shared/ui/render.js';
import { persistPreferences } from '../preferences.js';
import { normalize, normalizeFilter, normalizeSort, toDayKey } from '../utils.js';

function formatDayLabel(value) {
    const dayKey = toDayKey(value);
    if (!dayKey) return '';
    const [year, month, day] = dayKey.split('-');
    return `${day}/${month}/${year}`;
}

function toolbarStateParts(callbacksState) {
    const stateParts = [];
    if (normalizeFilter(callbacksState.filter) !== 'all') {
        stateParts.push(
            normalizeFilter(callbacksState.filter) === 'pending'
                ? 'Pendientes'
                : normalizeFilter(callbacksState.filter) === 'contacted'
                  ? 'Contactados'
                  : normalizeFilter(callbacksState.filter) === 'today'
                    ? 'Hoy'
                    : 'Urgentes SLA'
        );
    }
    if (normalize(callbacksState.search)) {
        stateParts.push(`Busqueda: ${callbacksState.search}`);
    }
    if (toDayKey(callbacksState.day)) {
        stateParts.push(`Dia: ${formatDayLabel(callbacksState.day)}`);
    }
    if (normalizeSort(callbacksState.sort) === 'priority_desc') {
        stateParts.push('Orden: Prioridad comercial');
    } else if (normalizeSort(callbacksState.sort) === 'waiting_desc') {
        stateParts.push('Orden: Mayor espera (SLA)');
    } else {
        stateParts.push('Orden: Mas recientes');
    }
    return stateParts;
}

function updateQuickFilterButtons(filter) {
    const normalized = normalize(filter);
    document
        .querySelectorAll('.callback-quick-filter-btn[data-filter-value]')
        .forEach((button) => {
            const active = normalize(button.dataset.filterValue) === normalized;
            button.classList.toggle('is-active', active);
        });
}

export function syncCallbackControls(
    callbacksState,
    visibleCount,
    scopedCount,
    totalCount
) {
    const metaLabel =
        toDayKey(callbacksState.day) && scopedCount !== totalCount
            ? `Mostrando ${visibleCount} de ${scopedCount} · ${totalCount} total`
            : `Mostrando ${visibleCount} de ${totalCount}`;
    setText('#callbacksToolbarMeta', metaLabel);
    setText(
        '#callbacksToolbarState',
        toolbarStateParts(callbacksState).join(' | ')
    );

    const filterSelect = document.getElementById('callbackFilter');
    if (filterSelect instanceof HTMLSelectElement) {
        filterSelect.value = normalizeFilter(callbacksState.filter);
    }

    const sortSelect = document.getElementById('callbackSort');
    if (sortSelect instanceof HTMLSelectElement) {
        sortSelect.value = normalizeSort(callbacksState.sort);
    }

    const search = document.getElementById('searchCallbacks');
    if (
        search instanceof HTMLInputElement &&
        search.value !== callbacksState.search
    ) {
        search.value = callbacksState.search;
    }

    const dayFilter = document.getElementById('callbackDayFilter');
    if (
        dayFilter instanceof HTMLInputElement &&
        dayFilter.value !== toDayKey(callbacksState.day)
    ) {
        dayFilter.value = toDayKey(callbacksState.day);
    }

    updateQuickFilterButtons(callbacksState.filter);
    persistPreferences(callbacksState);
}

export function syncCallbackBulkActions(sortedCount, selectedCount) {
    const selectVisibleBtn = document.getElementById(
        'callbacksBulkSelectVisibleBtn'
    );
    if (selectVisibleBtn instanceof HTMLButtonElement) {
        selectVisibleBtn.disabled = sortedCount === 0;
    }

    const clearSelectionBtn = document.getElementById('callbacksBulkClearBtn');
    if (clearSelectionBtn instanceof HTMLButtonElement) {
        clearSelectionBtn.disabled = selectedCount === 0;
    }

    const markSelectedBtn = document.getElementById('callbacksBulkMarkBtn');
    if (markSelectedBtn instanceof HTMLButtonElement) {
        markSelectedBtn.disabled = selectedCount === 0;
    }
}
