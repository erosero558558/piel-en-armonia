import { apiRequest } from './api.js';
import {
    currentQueueMeta,
    currentQueueTickets,
    setQueueMeta,
    setQueueTickets,
} from './state.js';
import { escapeHtml, showToast } from './ui.js';

const QUEUE_STATUS_LABELS = {
    waiting: 'En espera',
    called: 'Llamado',
    completed: 'Completado',
    no_show: 'No asistio',
    cancelled: 'Cancelado',
};

const QUEUE_PRIORITY_LABELS = {
    appt_overdue: 'Cita vencida',
    appt_current: 'Cita vigente',
    walk_in: 'Walk-in',
};

const TERMINAL_QUEUE_STATUSES = new Set(['completed', 'no_show', 'cancelled']);
const QUEUE_REALTIME_BASE_MS = 2500;
const QUEUE_REALTIME_MAX_MS = 15000;
const QUEUE_SLA_RISK_MINUTES = 20;
const QUEUE_FILTER_ORDER = [
    'all',
    'waiting',
    'called',
    'sla_risk',
    'appointments',
    'walk_in',
];
const queueUiState = {
    pendingCallByConsultorio: new Set(),
    realtimeTimerId: 0,
    realtimeEnabled: false,
    realtimeFailureStreak: 0,
    realtimeRequestInFlight: false,
    activeFilter: 'all',
    searchTerm: '',
    triageControlsBound: false,
};

function getQueueSyncStatusEl() {
    return document.getElementById('queueSyncStatus');
}

function setQueueSyncStatus(state, message) {
    const statusEl = getQueueSyncStatusEl();
    if (!statusEl) return;

    const normalizedState = String(state || 'paused').toLowerCase();
    const fallbackMessageByState = {
        live: 'Cola en vivo',
        reconnecting: 'Reintentando sincronizacion',
        offline: 'Sin conexion al backend',
        paused: 'Cola en pausa',
    };

    statusEl.dataset.state = normalizedState;
    statusEl.textContent =
        String(message || '').trim() ||
        fallbackMessageByState[normalizedState] ||
        fallbackMessageByState.paused;
}

function getRealtimeDelayMs() {
    const multiplier = Math.max(
        0,
        Number(queueUiState.realtimeFailureStreak || 0)
    );
    const delay = QUEUE_REALTIME_BASE_MS * Math.pow(2, Math.min(multiplier, 3));
    return Math.min(QUEUE_REALTIME_MAX_MS, delay);
}

function clearQueueRealtimeTimer() {
    if (!queueUiState.realtimeTimerId) return;
    window.clearTimeout(queueUiState.realtimeTimerId);
    queueUiState.realtimeTimerId = 0;
}

function scheduleQueueRealtimeTick({ immediate = false } = {}) {
    clearQueueRealtimeTimer();
    if (!queueUiState.realtimeEnabled) return;
    const delayMs = immediate ? 0 : getRealtimeDelayMs();
    queueUiState.realtimeTimerId = window.setTimeout(() => {
        void runQueueRealtimeTick();
    }, delayMs);
}

function formatDateTime(value) {
    const ts = Date.parse(String(value || ''));
    if (!Number.isFinite(ts)) {
        return '--';
    }
    return new Date(ts).toLocaleString('es-EC', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function normalizeQueueMetaFromState(queueState) {
    const callingNowByConsultorio = {
        1: null,
        2: null,
    };

    const callingNow = Array.isArray(queueState?.callingNow)
        ? queueState.callingNow
        : [];
    for (const ticket of callingNow) {
        const consultorio = Number(ticket?.assignedConsultorio || 0);
        if (consultorio === 1 || consultorio === 2) {
            callingNowByConsultorio[String(consultorio)] = ticket;
        }
    }

    return {
        updatedAt: queueState?.updatedAt || new Date().toISOString(),
        waitingCount: Number(queueState?.waitingCount || 0),
        calledCount: Number(queueState?.calledCount || 0),
        counts: queueState?.counts || {},
        callingNowByConsultorio,
        nextTickets: Array.isArray(queueState?.nextTickets)
            ? queueState.nextTickets
            : [],
    };
}

function getTicketStatusRank(status) {
    const rankByStatus = {
        waiting: 0,
        called: 1,
        completed: 2,
        no_show: 3,
        cancelled: 4,
    };
    return rankByStatus[String(status || '').toLowerCase()] ?? 9;
}

function getTicketPriorityRank(priorityClass) {
    const rankByPriority = {
        appt_overdue: 0,
        appt_current: 1,
        walk_in: 2,
    };
    return rankByPriority[String(priorityClass || '').toLowerCase()] ?? 9;
}

function normalizeQueueFilter(filter) {
    const normalized = String(filter || '')
        .trim()
        .toLowerCase();
    return QUEUE_FILTER_ORDER.includes(normalized) ? normalized : 'all';
}

function getTicketWaitMinutes(ticket) {
    const createdTs = Date.parse(String(ticket?.createdAt || ''));
    if (!Number.isFinite(createdTs)) return null;

    const calledTs = Date.parse(String(ticket?.calledAt || ''));
    const status = String(ticket?.status || '').toLowerCase();
    const endTs =
        status === 'called' && Number.isFinite(calledTs)
            ? calledTs
            : Date.now();
    const minutes = Math.round((endTs - createdTs) / 60000);
    return minutes >= 0 ? minutes : 0;
}

function isSlaRiskTicket(ticket) {
    const status = String(ticket?.status || '').toLowerCase();
    if (status !== 'waiting') return false;
    const waitMinutes = getTicketWaitMinutes(ticket);
    return (
        Number.isFinite(waitMinutes) && waitMinutes >= QUEUE_SLA_RISK_MINUTES
    );
}

function matchesQueueFilter(ticket, filter) {
    const normalizedFilter = normalizeQueueFilter(filter);
    const status = String(ticket?.status || '').toLowerCase();
    const queueType = String(ticket?.queueType || '').toLowerCase();
    if (normalizedFilter === 'all') return true;
    if (normalizedFilter === 'waiting') return status === 'waiting';
    if (normalizedFilter === 'called') return status === 'called';
    if (normalizedFilter === 'sla_risk') return isSlaRiskTicket(ticket);
    if (normalizedFilter === 'appointments') return queueType === 'appointment';
    if (normalizedFilter === 'walk_in') return queueType === 'walk_in';
    return true;
}

function normalizeSearchText(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function matchesQueueSearch(ticket, searchTerm) {
    const normalizedTerm = normalizeSearchText(searchTerm);
    if (!normalizedTerm) return true;
    const haystack = [
        ticket?.ticketCode,
        ticket?.patientInitials,
        ticket?.phoneLast4,
        ticket?.queueType,
        ticket?.priorityClass,
        ticket?.status,
    ]
        .map((value) => normalizeSearchText(value))
        .filter(Boolean)
        .join(' ');
    return haystack.includes(normalizedTerm);
}

function getSortedTickets(tickets) {
    return [...tickets].sort((a, b) => {
        const statusDiff =
            getTicketStatusRank(a?.status) - getTicketStatusRank(b?.status);
        if (statusDiff !== 0) return statusDiff;

        const priorityDiff =
            getTicketPriorityRank(a?.priorityClass) -
            getTicketPriorityRank(b?.priorityClass);
        if (priorityDiff !== 0) return priorityDiff;

        const waitA = getTicketWaitMinutes(a);
        const waitB = getTicketWaitMinutes(b);
        if (
            Number.isFinite(waitA) &&
            Number.isFinite(waitB) &&
            waitA !== waitB
        ) {
            return waitB - waitA;
        }

        const aTs = Date.parse(String(a?.createdAt || ''));
        const bTs = Date.parse(String(b?.createdAt || ''));
        if (Number.isFinite(aTs) && Number.isFinite(bTs) && aTs !== bTs) {
            return aTs - bTs;
        }
        return Number(a?.id || 0) - Number(b?.id || 0);
    });
}

function buildQueueViewState() {
    const sourceTickets = Array.isArray(currentQueueTickets)
        ? currentQueueTickets
        : [];
    const sortedTickets = getSortedTickets(sourceTickets);
    const activeFilter = normalizeQueueFilter(queueUiState.activeFilter);
    const searchTerm = String(queueUiState.searchTerm || '');

    const filteredTickets = sortedTickets.filter(
        (ticket) =>
            matchesQueueFilter(ticket, activeFilter) &&
            matchesQueueSearch(ticket, searchTerm)
    );

    const waitingCount = sortedTickets.filter(
        (ticket) => String(ticket?.status || '').toLowerCase() === 'waiting'
    ).length;
    const calledCount = sortedTickets.filter(
        (ticket) => String(ticket?.status || '').toLowerCase() === 'called'
    ).length;
    const riskCount = sortedTickets.filter((ticket) =>
        isSlaRiskTicket(ticket)
    ).length;

    return {
        tickets: filteredTickets,
        totalCount: sortedTickets.length,
        waitingCount,
        calledCount,
        riskCount,
        activeFilter,
        searchTerm,
    };
}

function updateTicketInState(nextTicket) {
    if (!nextTicket || typeof nextTicket !== 'object') return;
    const ticketId = Number(nextTicket.id || 0);
    if (!ticketId) return;

    const tickets = Array.isArray(currentQueueTickets)
        ? [...currentQueueTickets]
        : [];
    const index = tickets.findIndex(
        (ticket) => Number(ticket?.id || 0) === ticketId
    );
    if (index >= 0) {
        tickets[index] = { ...tickets[index], ...nextTicket };
    } else {
        tickets.push(nextTicket);
    }
    setQueueTickets(tickets);
}

function normalizeErrorMessage(error) {
    return String(error?.message || 'Error desconocido');
}

function isConsultorioBusyError(error) {
    const normalized = normalizeErrorMessage(error)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    return normalized.includes('consultorio') && normalized.includes('ocupado');
}

function queueActionSuccessMessage(action, ticketCode = '') {
    const code = ticketCode ? `${ticketCode} ` : '';
    switch (String(action || '').toLowerCase()) {
        case 're-llamar':
        case 'rellamar':
        case 'recall':
        case 'llamar':
            return `${code}re-llamado correctamente`.trim();
        case 'liberar':
        case 'release':
            return `${code}liberado y regresado a espera`.trim();
        case 'completar':
        case 'complete':
        case 'completed':
            return `${code}marcado como completado`.trim();
        case 'no_show':
        case 'noshow':
            return `${code}marcado como no show`.trim();
        case 'cancelar':
        case 'cancel':
        case 'cancelled':
            return `${code}cancelado`.trim();
        case 'reasignar':
        case 'reassign':
            return `${code}reasignado`.trim();
        default:
            return 'Turno actualizado';
    }
}

function getHeaderCallButton(consultorio) {
    return document.querySelector(
        `[data-action="queue-call-next"][data-queue-consultorio="${consultorio}"]`
    );
}

function ensureHeaderReleaseButton(consultorio) {
    const buttonId = `queueReleaseC${consultorio}`;
    const existing = document.getElementById(buttonId);
    if (existing instanceof HTMLButtonElement) {
        return existing;
    }

    const headerActions = document.querySelector(
        '#queue .queue-admin-header-actions'
    );
    if (!(headerActions instanceof HTMLElement)) {
        return null;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.id = buttonId;
    button.className = 'btn btn-secondary btn-sm';
    button.dataset.action = 'queue-ticket-action';
    button.dataset.queueAction = 'liberar';
    button.dataset.queueConsultorio = String(consultorio);
    button.disabled = true;
    button.innerHTML = `<i class="fas fa-rotate-left"></i> Liberar C${consultorio}`;

    const callButton = getHeaderCallButton(consultorio);
    if (callButton?.parentElement === headerActions && callButton.nextSibling) {
        headerActions.insertBefore(button, callButton.nextSibling);
    } else {
        headerActions.appendChild(button);
    }
    return button;
}

function syncHeaderConsultorioControls(consultorio, activeTicket) {
    const callButton = getHeaderCallButton(consultorio);
    const releaseButton = ensureHeaderReleaseButton(consultorio);
    const roomLabel = `Consultorio ${consultorio}`;
    const hasActiveTicket = Boolean(activeTicket && activeTicket.id);
    const callPending = queueUiState.pendingCallByConsultorio.has(
        String(consultorio)
    );

    if (callButton instanceof HTMLButtonElement) {
        const disabled = hasActiveTicket || callPending;
        callButton.disabled = disabled;
        if (callPending) {
            callButton.title = `Procesando llamado para ${roomLabel}`;
        } else if (hasActiveTicket) {
            const ticketCode = String(activeTicket?.ticketCode || '--');
            callButton.title = `${roomLabel} ocupado por ${ticketCode}`;
        } else {
            callButton.title = `Llamar siguiente turno en ${roomLabel}`;
        }
    }

    if (!(releaseButton instanceof HTMLButtonElement)) return;

    releaseButton.disabled = !hasActiveTicket;
    if (!hasActiveTicket) {
        delete releaseButton.dataset.queueId;
        releaseButton.title = `Sin turno activo en ${roomLabel}`;
        releaseButton.innerHTML = `<i class="fas fa-rotate-left"></i> Liberar C${consultorio}`;
        return;
    }

    const ticketCode = String(activeTicket?.ticketCode || '--');
    releaseButton.dataset.queueId = String(activeTicket?.id || '');
    releaseButton.title = `Liberar ${ticketCode} de ${roomLabel}`;
    releaseButton.innerHTML = `<i class="fas fa-rotate-left"></i> Liberar C${consultorio} (${escapeHtml(ticketCode)})`;
}

function getQueueFilterLabel(filter) {
    const labels = {
        all: 'Todos',
        waiting: 'En espera',
        called: 'Llamados',
        sla_risk: `SLA +${QUEUE_SLA_RISK_MINUTES}m`,
        appointments: 'Cita',
        walk_in: 'Walk-in',
    };
    return labels[normalizeQueueFilter(filter)] || labels.all;
}

function ensureQueueTriageControls() {
    const shell = document.querySelector('#queue .queue-admin-shell');
    if (!(shell instanceof HTMLElement)) return;

    let toolbar = document.getElementById('queueTriageToolbar');
    if (!(toolbar instanceof HTMLElement)) {
        toolbar = document.createElement('section');
        toolbar.id = 'queueTriageToolbar';
        toolbar.className = 'queue-triage-toolbar';
        toolbar.innerHTML = `
            <div class="queue-triage-filters" role="group" aria-label="Filtros de turnero">
                ${QUEUE_FILTER_ORDER.map(
                    (filter) => `
                        <button
                            type="button"
                            class="btn btn-secondary btn-sm queue-triage-filter"
                            data-queue-filter="${filter}"
                        >
                            ${escapeHtml(getQueueFilterLabel(filter))}
                        </button>
                    `
                ).join('')}
            </div>
            <div class="queue-triage-search-wrap">
                <input
                    id="queueSearchInput"
                    class="queue-triage-search"
                    type="search"
                    inputmode="search"
                    autocomplete="off"
                    placeholder="Buscar ticket, iniciales o ultimos 4"
                    aria-label="Buscar en cola"
                />
                <button
                    type="button"
                    class="btn btn-secondary btn-sm"
                    data-action="queue-clear-search"
                >
                    Limpiar
                </button>
            </div>
            <p id="queueTriageSummary" class="queue-triage-summary">Sin datos de cola</p>
        `;
        const kpis = shell.querySelector('.queue-admin-kpis');
        if (kpis?.parentElement === shell) {
            shell.insertBefore(toolbar, kpis);
        } else {
            shell.appendChild(toolbar);
        }
    }

    const searchInput = document.getElementById('queueSearchInput');
    if (
        searchInput instanceof HTMLInputElement &&
        searchInput.value !== String(queueUiState.searchTerm || '')
    ) {
        searchInput.value = String(queueUiState.searchTerm || '');
    }

    if (queueUiState.triageControlsBound) return;
    queueUiState.triageControlsBound = true;

    toolbar.addEventListener('click', (event) => {
        const filterButton = event.target.closest('[data-queue-filter]');
        if (filterButton instanceof HTMLElement) {
            queueUiState.activeFilter = normalizeQueueFilter(
                filterButton.dataset.queueFilter || 'all'
            );
            renderQueueSection();
            return;
        }
        const clearButton = event.target.closest(
            '[data-action="queue-clear-search"]'
        );
        if (clearButton instanceof HTMLElement) {
            queueUiState.searchTerm = '';
            renderQueueSection();
        }
    });

    if (searchInput instanceof HTMLInputElement) {
        searchInput.addEventListener('input', () => {
            queueUiState.searchTerm = searchInput.value || '';
            renderQueueSection();
        });
    }
}

function syncQueueTriageControls(viewState) {
    const toolbar = document.getElementById('queueTriageToolbar');
    if (!(toolbar instanceof HTMLElement)) return;

    const activeFilter = normalizeQueueFilter(viewState?.activeFilter || 'all');
    toolbar.querySelectorAll('[data-queue-filter]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) return;
        const isActive =
            normalizeQueueFilter(button.dataset.queueFilter || '') ===
            activeFilter;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });

    const searchInput = document.getElementById('queueSearchInput');
    if (
        searchInput instanceof HTMLInputElement &&
        searchInput.value !== String(viewState?.searchTerm || '')
    ) {
        searchInput.value = String(viewState?.searchTerm || '');
    }

    const summary = document.getElementById('queueTriageSummary');
    if (summary instanceof HTMLElement) {
        const visibleCount = Number(viewState?.tickets?.length || 0);
        const totalCount = Number(viewState?.totalCount || 0);
        const riskCount = Number(viewState?.riskCount || 0);
        const waitingCount = Number(viewState?.waitingCount || 0);
        summary.textContent = `${visibleCount}/${totalCount} visibles · ${waitingCount} en espera · ${riskCount} en riesgo SLA`;
    }
}

function renderQueueOverview() {
    const queueMeta =
        currentQueueMeta && typeof currentQueueMeta === 'object'
            ? currentQueueMeta
            : {
                  waitingCount: 0,
                  calledCount: 0,
                  nextTickets: [],
                  callingNowByConsultorio: { 1: null, 2: null },
                  updatedAt: '',
              };

    const waitingCountEl = document.getElementById('queueWaitingCountAdmin');
    const calledCountEl = document.getElementById('queueCalledCountAdmin');
    const sidebarBadgeEl = document.getElementById('queueBadge');
    const consultorio1El = document.getElementById('queueC1Now');
    const consultorio2El = document.getElementById('queueC2Now');
    const nextListEl = document.getElementById('queueNextAdminList');
    const updatedAtEl = document.getElementById('queueLastUpdate');

    if (waitingCountEl)
        waitingCountEl.textContent = String(queueMeta.waitingCount || 0);
    if (calledCountEl)
        calledCountEl.textContent = String(queueMeta.calledCount || 0);
    if (sidebarBadgeEl)
        sidebarBadgeEl.textContent = String(queueMeta.waitingCount || 0);
    if (updatedAtEl)
        updatedAtEl.textContent = formatDateTime(queueMeta.updatedAt);

    const consultorio1 = queueMeta?.callingNowByConsultorio?.['1'];
    const consultorio2 = queueMeta?.callingNowByConsultorio?.['2'];

    if (consultorio1El) {
        consultorio1El.textContent = consultorio1
            ? `${consultorio1.ticketCode || '--'} · ${consultorio1.patientInitials || '--'}`
            : 'Sin llamado';
    }
    if (consultorio2El) {
        consultorio2El.textContent = consultorio2
            ? `${consultorio2.ticketCode || '--'} · ${consultorio2.patientInitials || '--'}`
            : 'Sin llamado';
    }

    syncHeaderConsultorioControls(1, consultorio1);
    syncHeaderConsultorioControls(2, consultorio2);

    if (nextListEl) {
        const nextTickets = Array.isArray(queueMeta.nextTickets)
            ? queueMeta.nextTickets
            : [];
        if (nextTickets.length === 0) {
            nextListEl.innerHTML =
                '<li class="empty-message">No hay turnos en espera.</li>';
        } else {
            nextListEl.innerHTML = nextTickets
                .map(
                    (ticket) => `
                        <li>
                            <strong>${escapeHtml(ticket.ticketCode || '--')}</strong>
                            <span>${escapeHtml(ticket.patientInitials || '--')}</span>
                            <span>#${escapeHtml(ticket.position || '-')}</span>
                        </li>
                    `
                )
                .join('');
        }
    }
}

function renderQueueTable(viewState) {
    const tableBody = document.getElementById('queueTableBody');
    if (!tableBody) return;

    const tickets = Array.isArray(viewState?.tickets) ? viewState.tickets : [];
    if (tickets.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-message">Sin tickets en cola.</td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = tickets
        .map((ticket) => {
            const id = Number(ticket.id || 0);
            const status = String(ticket.status || 'waiting');
            const canCall = status === 'waiting' || status === 'called';
            const canRelease = status === 'called';
            const isTerminal = TERMINAL_QUEUE_STATUSES.has(status);
            const canResolve = !isTerminal;
            const canAssignConsultorio = !isTerminal;
            const waitMinutes = getTicketWaitMinutes(ticket);
            const hasSlaRisk = isSlaRiskTicket(ticket);
            const rowClass = hasSlaRisk ? 'queue-row-risk' : '';
            const waitLabel = Number.isFinite(waitMinutes)
                ? `${waitMinutes}m`
                : '--';

            return `
                <tr class="${rowClass}">
                    <td>${escapeHtml(ticket.ticketCode || '--')}</td>
                    <td>${escapeHtml(ticket.queueType || '--')}</td>
                    <td>${escapeHtml(QUEUE_PRIORITY_LABELS[ticket.priorityClass] || ticket.priorityClass || '--')}</td>
                    <td class="queue-status-cell">
                        <span>${escapeHtml(QUEUE_STATUS_LABELS[status] || status)}</span>
                        ${
                            hasSlaRisk
                                ? `<small class="queue-risk-note">SLA > ${QUEUE_SLA_RISK_MINUTES}m</small>`
                                : ''
                        }
                    </td>
                    <td>${escapeHtml(ticket.assignedConsultorio || '-')}</td>
                    <td>
                        <span>${escapeHtml(formatDateTime(ticket.createdAt))}</span>
                        <small class="queue-wait-note">Espera: ${escapeHtml(waitLabel)}</small>
                    </td>
                    <td>${escapeHtml(ticket.patientInitials || '--')}</td>
                    <td>
                        <div class="queue-actions">
                            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-reprint-ticket" data-queue-id="${id}">
                                Reimprimir
                            </button>
                            ${
                                canCall
                                    ? `<button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="re-llamar" data-queue-id="${id}">
                                Re-llamar
                            </button>`
                                    : ''
                            }
                            ${
                                canRelease
                                    ? `<button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="liberar" data-queue-id="${id}">
                                Liberar
                            </button>`
                                    : ''
                            }
                            ${
                                canResolve
                                    ? `<button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="completar" data-queue-id="${id}">
                                Completar
                            </button>
                            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="no_show" data-queue-id="${id}">
                                No show
                            </button>
                            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="cancelar" data-queue-id="${id}">
                                Cancelar
                            </button>`
                                    : ''
                            }
                            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="reasignar" data-queue-consultorio="1" data-queue-id="${id}" ${canAssignConsultorio ? '' : 'disabled'}>
                                C1
                            </button>
                            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="reasignar" data-queue-consultorio="2" data-queue-id="${id}" ${canAssignConsultorio ? '' : 'disabled'}>
                                C2
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        })
        .join('');
}

function renderQueueSection() {
    ensureQueueTriageControls();
    const viewState = buildQueueViewState();
    syncQueueTriageControls(viewState);
    renderQueueOverview();
    renderQueueTable(viewState);
}

async function runQueueRealtimeTick() {
    if (!queueUiState.realtimeEnabled) return;

    if (!isQueueSectionActive()) {
        setQueueSyncStatus('paused', 'Cola en pausa');
        clearQueueRealtimeTimer();
        return;
    }

    if (document.hidden) {
        setQueueSyncStatus('paused', 'Cola en pausa (pestana oculta)');
        scheduleQueueRealtimeTick();
        return;
    }

    if (navigator.onLine === false) {
        queueUiState.realtimeFailureStreak += 1;
        setQueueSyncStatus('offline', 'Sin conexion al backend');
        scheduleQueueRealtimeTick();
        return;
    }

    if (queueUiState.realtimeRequestInFlight) {
        scheduleQueueRealtimeTick();
        return;
    }

    queueUiState.realtimeRequestInFlight = true;
    const refreshed = await refreshQueueRealtime({
        silent: true,
        fromRealtime: true,
    });
    queueUiState.realtimeRequestInFlight = false;

    if (refreshed) {
        queueUiState.realtimeFailureStreak = 0;
        setQueueSyncStatus('live', 'Cola en vivo');
    } else {
        queueUiState.realtimeFailureStreak += 1;
        const retrySeconds = Math.max(
            1,
            Math.ceil(getRealtimeDelayMs() / 1000)
        );
        setQueueSyncStatus('reconnecting', `Reintentando en ${retrySeconds}s`);
    }

    scheduleQueueRealtimeTick();
}

export function isQueueSectionActive() {
    return (
        document.querySelector('.nav-item.active')?.dataset.section === 'queue'
    );
}

export async function refreshQueueRealtime({
    silent = false,
    fromRealtime = false,
} = {}) {
    try {
        const payload = await apiRequest('data');
        const data = payload.data || {};
        setQueueTickets(
            Array.isArray(data.queue_tickets) ? data.queue_tickets : []
        );
        setQueueMeta(
            data.queueMeta && typeof data.queueMeta === 'object'
                ? data.queueMeta
                : null
        );
        renderQueueSection();
        if (!fromRealtime && isQueueSectionActive()) {
            setQueueSyncStatus('live', 'Cola sincronizada');
        }
        return true;
    } catch (error) {
        if (!fromRealtime && isQueueSectionActive()) {
            setQueueSyncStatus(
                navigator.onLine === false ? 'offline' : 'reconnecting',
                navigator.onLine === false
                    ? 'Sin conexion al backend'
                    : 'No se pudo sincronizar cola'
            );
        }
        if (!silent) {
            showToast(
                `No se pudo actualizar turnero: ${error.message}`,
                'warning'
            );
        }
        return false;
    }
}

export function loadQueueSection() {
    renderQueueSection();
    setQueueSyncStatus('paused', 'Sincronizacion lista');
    void refreshQueueRealtime({ silent: true });
}

export function startQueueRealtimeSync({ immediate = true } = {}) {
    queueUiState.realtimeEnabled = true;
    queueUiState.realtimeFailureStreak = 0;
    if (!isQueueSectionActive()) {
        setQueueSyncStatus('paused', 'Cola en pausa');
        clearQueueRealtimeTimer();
        return;
    }

    if (immediate) {
        setQueueSyncStatus('live', 'Sincronizando cola...');
        clearQueueRealtimeTimer();
        void runQueueRealtimeTick();
        return;
    }

    setQueueSyncStatus('live', 'Cola en vivo');
    scheduleQueueRealtimeTick();
}

export function stopQueueRealtimeSync({ reason = 'paused' } = {}) {
    queueUiState.realtimeEnabled = false;
    queueUiState.realtimeFailureStreak = 0;
    queueUiState.realtimeRequestInFlight = false;
    clearQueueRealtimeTimer();

    const reasonText = String(reason || 'paused').toLowerCase();
    if (reasonText === 'offline') {
        setQueueSyncStatus('offline', 'Sin conexion al backend');
        return;
    }
    if (reasonText === 'hidden') {
        setQueueSyncStatus('paused', 'Cola en pausa (pestana oculta)');
        return;
    }
    setQueueSyncStatus('paused', 'Cola en pausa');
}

export async function callNextForConsultorio(consultorio) {
    const room = Number(consultorio || 0);
    if (![1, 2].includes(room)) {
        showToast('Consultorio invalido', 'error');
        return;
    }
    const roomKey = String(room);
    if (queueUiState.pendingCallByConsultorio.has(roomKey)) {
        return;
    }

    queueUiState.pendingCallByConsultorio.add(roomKey);
    renderQueueOverview();

    try {
        const payload = await apiRequest('queue-call-next', {
            method: 'POST',
            body: { consultorio: room },
        });
        const ticket = payload?.data?.ticket || null;
        updateTicketInState(ticket);
        setQueueMeta(
            normalizeQueueMetaFromState(payload?.data?.queueState || {})
        );
        renderQueueSection();
        if (ticket && ticket.ticketCode) {
            showToast(
                `Llamando ${ticket.ticketCode} en Consultorio ${room}`,
                'success'
            );
        } else {
            showToast(`Consultorio ${room} actualizado`, 'success');
        }
    } catch (error) {
        if (isConsultorioBusyError(error)) {
            await refreshQueueRealtime({ silent: true });
            showToast(normalizeErrorMessage(error), 'warning');
            return;
        }
        showToast(
            `No se pudo llamar siguiente turno: ${normalizeErrorMessage(error)}`,
            'error'
        );
    } finally {
        queueUiState.pendingCallByConsultorio.delete(roomKey);
        renderQueueOverview();
    }
}

export async function applyQueueTicketAction(
    ticketId,
    action,
    consultorio = null
) {
    const id = Number(ticketId || 0);
    if (!id || !action) {
        showToast('Accion de ticket invalida', 'error');
        return;
    }

    const body = { id, action };
    const room = Number(consultorio || 0);
    if ([1, 2].includes(room)) {
        body.consultorio = room;
    }

    try {
        const payload = await apiRequest('queue-ticket', {
            method: 'PATCH',
            body,
        });
        const ticket = payload?.data?.ticket || null;
        updateTicketInState(ticket);
        setQueueMeta(
            normalizeQueueMetaFromState(payload?.data?.queueState || {})
        );
        renderQueueSection();
        showToast(
            queueActionSuccessMessage(action, ticket?.ticketCode || ''),
            'success'
        );
    } catch (error) {
        if (isConsultorioBusyError(error)) {
            await refreshQueueRealtime({ silent: true });
            showToast(normalizeErrorMessage(error), 'warning');
            return;
        }
        showToast(
            `No se pudo actualizar ticket: ${normalizeErrorMessage(error)}`,
            'error'
        );
    }
}

export async function reprintQueueTicket(ticketId) {
    const id = Number(ticketId || 0);
    if (!id) {
        showToast('Ticket invalido para reimpresion', 'error');
        return;
    }

    try {
        const payload = await apiRequest('queue-reprint', {
            method: 'POST',
            body: { id },
        });
        if (payload?.printed) {
            showToast('Ticket reimpreso', 'success');
        } else {
            const detail = payload?.print?.message || 'sin detalle';
            showToast(`Ticket generado sin impresion: ${detail}`, 'warning');
        }
    } catch (error) {
        showToast(`No se pudo reimprimir ticket: ${error.message}`, 'error');
    }
}
