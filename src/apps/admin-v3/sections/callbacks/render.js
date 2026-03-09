import { getState } from '../../shared/core/store.js';
import {
    escapeHtml,
    formatDateTime,
    setHtml,
    setText,
} from '../../shared/ui/render.js';
import { persistPreferences } from './preferences.js';
import {
    applyFilter,
    applySearch,
    computeOps,
    sortItems,
} from './selectors.js';
import {
    normalize,
    normalizeFilter,
    normalizeSort,
    normalizeStatus,
    phoneLabel,
    waitBand,
    waitingLabel,
    waitingMinutes,
} from './utils.js';

function callbackCard(item, { selected = false, position = null } = {}) {
    const status = normalizeStatus(item.status);
    const cardClass =
        status === 'pending'
            ? 'callback-card pendiente'
            : 'callback-card contactado';
    const cardStatus = status === 'pending' ? 'pendiente' : 'contactado';
    const id = Number(item.id || 0);
    const phone = phoneLabel(item);
    const ageMinutes = waitingMinutes(item);
    const band = waitBand(ageMinutes);
    const preference = item.preferencia || 'Sin preferencia';
    const headline =
        status === 'pending'
            ? position === 1
                ? 'Siguiente contacto recomendado'
                : 'Caso pendiente en cola'
            : 'Caso ya resuelto';

    return `
        <article class="${cardClass}${selected ? ' is-selected' : ''}" data-callback-id="${id}" data-callback-status="${cardStatus}">
            <header>
                <div class="callback-card-heading">
                    <span class="callback-status-pill" data-tone="${escapeHtml(status === 'pending' ? band.tone : 'success')}">${escapeHtml(status === 'pending' ? 'Pendiente' : 'Contactado')}</span>
                    <h4>${escapeHtml(phone)}</h4>
                </div>
                <span class="callback-card-wait" data-tone="${escapeHtml(status === 'pending' ? band.tone : 'success')}">${escapeHtml(status === 'pending' ? band.label : 'Cerrado')}</span>
            </header>
            <div class="callback-card-grid">
                <p><span>Preferencia</span><strong>${escapeHtml(preference)}</strong></p>
                <p><span>Fecha</span><strong>${escapeHtml(formatDateTime(item.fecha || item.createdAt || ''))}</strong></p>
                <p><span>Espera</span><strong>${escapeHtml(waitingLabel(ageMinutes))}</strong></p>
                <p><span>Lectura</span><strong>${escapeHtml(headline)}</strong></p>
            </div>
            <p class="callback-card-note">${escapeHtml(status === 'pending' ? band.note : 'Registro ya marcado como contactado.')}</p>
            <div class="callback-actions">
                <button type="button" data-action="mark-contacted" data-callback-id="${id}" data-callback-date="${escapeHtml(item.fecha || '')}" ${status !== 'pending' ? 'disabled' : ''}>${status === 'pending' ? 'Marcar contactado' : 'Contactado'}</button>
            </div>
        </article>
    `;
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

function renderCallbackDeck(ops, visibleCount, totalCount, selectedCount) {
    setText(
        '#callbacksDeckSummary',
        totalCount > 0
            ? `${ops.pendingCount} pendiente(s), ${ops.urgentCount} fuera de SLA y ${visibleCount} visibles.`
            : 'Sin callbacks pendientes.'
    );
    setText(
        '#callbacksDeckHint',
        ops.urgentCount > 0
            ? 'Escala primero los casos criticos.'
            : ops.pendingCount > 0
              ? 'La cola se puede drenar en esta misma vista.'
              : 'Sin bloqueos'
    );

    const queueChip = document.getElementById('callbacksQueueChip');
    if (queueChip) {
        queueChip.textContent =
            ops.queueState === 'danger'
                ? 'SLA comprometido'
                : ops.queueState === 'warning'
                  ? 'Cola activa'
                  : 'Cola estable';
        queueChip.setAttribute('data-state', ops.queueState);
    }

    const queueHealth = document.getElementById('callbacksOpsQueueHealth');
    if (queueHealth) {
        queueHealth.setAttribute('data-state', ops.queueState);
    }

    const next = ops.next;
    setText('#callbacksOpsNext', next ? phoneLabel(next) : 'Sin telefono');
    setText(
        '#callbacksNextSummary',
        next
            ? `Prioriza ${phoneLabel(next)} antes de seguir con la cola.`
            : 'La siguiente llamada prioritaria aparecera aqui.'
    );
    setText(
        '#callbacksNextWait',
        next ? waitingLabel(waitingMinutes(next)) : '0 min'
    );
    setText('#callbacksNextPreference', next ? next.preferencia || '-' : '-');
    setText(
        '#callbacksNextState',
        next ? waitBand(waitingMinutes(next)).label : 'Pendiente'
    );

    const selectionChip = document.getElementById('callbacksSelectionChip');
    if (selectionChip) {
        selectionChip.classList.toggle('is-hidden', selectedCount === 0);
    }
    setText('#callbacksSelectedCount', selectedCount);
}

export function renderCallbacksSection() {
    const state = getState();
    const source = Array.isArray(state?.data?.callbacks)
        ? state.data.callbacks
        : [];

    const filtered = applyFilter(source, state.callbacks.filter);
    const searched = applySearch(filtered, state.callbacks.search);
    const sorted = sortItems(searched, state.callbacks.sort);
    const selectedSet = new Set(
        (state.callbacks.selected || []).map((value) => Number(value || 0))
    );

    setHtml(
        '#callbacksGrid',
        sorted.length
            ? sorted
                  .map((item, index) =>
                      callbackCard(item, {
                          selected: selectedSet.has(Number(item.id || 0)),
                          position: index + 1,
                      })
                  )
                  .join('')
            : '<p class="callbacks-grid-empty" data-admin-empty-state="callbacks">No hay callbacks para el filtro actual.</p>'
    );

    setText(
        '#callbacksToolbarMeta',
        `Mostrando ${sorted.length} de ${source.length}`
    );

    const stateParts = [];
    if (normalizeFilter(state.callbacks.filter) !== 'all') {
        stateParts.push(
            normalizeFilter(state.callbacks.filter) === 'pending'
                ? 'Pendientes'
                : normalizeFilter(state.callbacks.filter) === 'contacted'
                  ? 'Contactados'
                  : normalizeFilter(state.callbacks.filter) === 'today'
                    ? 'Hoy'
                    : 'Urgentes SLA'
        );
    }
    if (normalize(state.callbacks.search)) {
        stateParts.push(`Busqueda: ${state.callbacks.search}`);
    }
    if (normalizeSort(state.callbacks.sort) === 'waiting_desc') {
        stateParts.push('Orden: Mayor espera (SLA)');
    } else {
        stateParts.push('Orden: Mas recientes');
    }

    setText('#callbacksToolbarState', stateParts.join(' | '));

    const filterSelect = document.getElementById('callbackFilter');
    if (filterSelect instanceof HTMLSelectElement) {
        filterSelect.value = normalizeFilter(state.callbacks.filter);
    }

    const sortSelect = document.getElementById('callbackSort');
    if (sortSelect instanceof HTMLSelectElement) {
        sortSelect.value = normalizeSort(state.callbacks.sort);
    }

    const search = document.getElementById('searchCallbacks');
    if (
        search instanceof HTMLInputElement &&
        search.value !== state.callbacks.search
    ) {
        search.value = state.callbacks.search;
    }

    updateQuickFilterButtons(state.callbacks.filter);

    const ops = computeOps(source);
    setText('#callbacksOpsPendingCount', ops.pendingCount);
    setText('#callbacksOpsUrgentCount', ops.urgentCount);
    setText('#callbacksOpsTodayCount', ops.todayCount);
    setText('#callbacksOpsQueueHealth', ops.queueHealth);

    const selectVisibleBtn = document.getElementById(
        'callbacksBulkSelectVisibleBtn'
    );
    if (selectVisibleBtn instanceof HTMLButtonElement) {
        selectVisibleBtn.disabled = sorted.length === 0;
    }

    const clearSelectionBtn = document.getElementById('callbacksBulkClearBtn');
    if (clearSelectionBtn instanceof HTMLButtonElement) {
        clearSelectionBtn.disabled = selectedSet.size === 0;
    }

    const markSelectedBtn = document.getElementById('callbacksBulkMarkBtn');
    if (markSelectedBtn instanceof HTMLButtonElement) {
        markSelectedBtn.disabled = selectedSet.size === 0;
    }

    renderCallbackDeck(ops, sorted.length, source.length, selectedSet.size);
    persistPreferences(getState().callbacks);
}
