import { apiRequest } from '../../core/api-client.js';
import { getState } from '../../core/store.js';
import { createToast } from '../../ui/render.js';
import { CALL_NEXT_IN_FLIGHT, SENSITIVE_QUEUE_ACTIONS } from './constants.js';
import { normalizeQueueAction, normalizeStatus } from './helpers.js';
import {
    getBulkTargetTickets,
    getCalledTicketForConsultorio,
    getQueueTicketById,
    getWaitingForConsultorio,
} from './selectors.js';
import {
    appendActivity,
    clearQueueSelection,
    mutateTicketLocal,
} from './state.js';
import { hideSensitiveConfirm, showSensitiveConfirm } from './render.js';
import { applyQueueStateResponse } from './sync.js';

function setTicketCalledLocal(ticketId, consultorio) {
    mutateTicketLocal(ticketId, (ticket) => ({
        ...ticket,
        status: 'called',
        assignedConsultorio: consultorio,
        calledAt: new Date().toISOString(),
    }));
}

function setTicketStatusLocal(ticketId, status, consultorio = undefined) {
    mutateTicketLocal(ticketId, (ticket) => ({
        ...ticket,
        status,
        assignedConsultorio:
            consultorio === undefined
                ? ticket.assignedConsultorio
                : consultorio,
        calledAt:
            status === 'called'
                ? new Date().toISOString()
                : status === 'waiting'
                  ? ''
                  : ticket.calledAt,
        completedAt:
            status === 'completed' ||
            status === 'no_show' ||
            status === 'cancelled'
                ? new Date().toISOString()
                : '',
    }));
}

function requiresSensitiveConfirm(action, ticket) {
    const normalizedAction = normalizeQueueAction(action);
    if (normalizedAction === 'cancelar') {
        return true;
    }
    if (normalizedAction !== 'no_show') {
        return false;
    }

    if (!ticket) return true;
    return (
        normalizeStatus(ticket.status) === 'called' ||
        Number(ticket.assignedConsultorio || 0) > 0
    );
}

async function executeTicketAction({ ticketId, action, consultorio }) {
    const targetId = Number(ticketId || 0);
    const targetAction = normalizeQueueAction(action);
    if (!targetId || !targetAction) return;

    const state = getState();
    if (state.queue.practiceMode) {
        if (targetAction === 'reasignar' || targetAction === 're-llamar') {
            setTicketStatusLocal(
                targetId,
                'called',
                Number(consultorio || 1) === 2 ? 2 : 1
            );
        } else if (targetAction === 'liberar') {
            setTicketStatusLocal(targetId, 'waiting', null);
        } else if (targetAction === 'completar') {
            setTicketStatusLocal(targetId, 'completed');
        } else if (targetAction === 'no_show') {
            setTicketStatusLocal(targetId, 'no_show');
        } else if (targetAction === 'cancelar') {
            setTicketStatusLocal(targetId, 'cancelled');
        }
        appendActivity(
            `Practica: accion ${targetAction} en ticket ${targetId}`
        );
        return;
    }

    const payload = await apiRequest('queue-ticket', {
        method: 'PATCH',
        body: {
            id: targetId,
            action: targetAction,
            consultorio: Number(consultorio || 0),
        },
    });

    applyQueueStateResponse(payload, { syncMode: 'live' });
    appendActivity(`Accion ${targetAction} ticket ${targetId}`);
}

export async function callNextForConsultorio(consultorio) {
    const target = Number(consultorio || 0) === 2 ? 2 : 1;
    const state = getState();
    if (CALL_NEXT_IN_FLIGHT.get(target)) return;

    if (
        state.queue.stationMode === 'locked' &&
        state.queue.stationConsultorio !== target
    ) {
        appendActivity(
            `Llamado bloqueado para C${target} por lock de estacion`
        );
        createToast('Modo bloqueado: consultorio no permitido', 'warning');
        return;
    }

    if (state.queue.practiceMode) {
        const candidate = getWaitingForConsultorio(target);
        if (!candidate) {
            appendActivity('Practica: sin tickets en espera');
            return;
        }
        setTicketCalledLocal(candidate.id, target);
        appendActivity(
            `Practica: llamado ${candidate.ticketCode} en C${target}`
        );
        return;
    }

    CALL_NEXT_IN_FLIGHT.set(target, true);
    try {
        const payload = await apiRequest('queue-call-next', {
            method: 'POST',
            body: {
                consultorio: target,
            },
        });
        applyQueueStateResponse(payload, { syncMode: 'live' });
        appendActivity(`Llamado C${target} ejecutado`);
    } catch (_error) {
        appendActivity(`Error llamando siguiente en C${target}`);
        createToast(`Error llamando siguiente en C${target}`, 'error');
    } finally {
        CALL_NEXT_IN_FLIGHT.set(target, false);
    }
}

export async function runQueueTicketAction(ticketId, action, consultorio = 0) {
    const payload = {
        ticketId: Number(ticketId || 0),
        action: normalizeQueueAction(action),
        consultorio: Number(consultorio || 0),
    };
    const state = getState();
    const currentTicket = getQueueTicketById(payload.ticketId);
    if (
        !state.queue.practiceMode &&
        SENSITIVE_QUEUE_ACTIONS.has(payload.action) &&
        requiresSensitiveConfirm(payload.action, currentTicket)
    ) {
        showSensitiveConfirm(payload);
        appendActivity(`Accion ${payload.action} pendiente de confirmacion`);
        return;
    }
    await executeTicketAction(payload);
}

export async function runQueueReleaseStation(consultorio) {
    const target = Number(consultorio || 0) === 2 ? 2 : 1;
    const activeTicket = getCalledTicketForConsultorio(target);
    if (!activeTicket) {
        appendActivity(`Sin ticket activo para liberar en C${target}`);
        return;
    }
    await runQueueTicketAction(activeTicket.id, 'liberar', target);
}

export async function confirmQueueSensitiveAction() {
    const state = getState();
    const pending = state.queue.pendingSensitiveAction;
    if (!pending) {
        hideSensitiveConfirm();
        return;
    }
    hideSensitiveConfirm();
    await executeTicketAction(pending);
}

export function cancelQueueSensitiveAction() {
    hideSensitiveConfirm();
    appendActivity('Accion sensible cancelada');
}

export function dismissQueueSensitiveDialog() {
    const dialog = document.getElementById('queueSensitiveConfirmDialog');
    const pending = getState().queue.pendingSensitiveAction;
    const isOpen =
        Boolean(pending) ||
        (dialog instanceof HTMLDialogElement
            ? dialog.open
            : dialog instanceof HTMLElement
              ? !dialog.hidden || dialog.hasAttribute('open')
              : false);
    if (!isOpen) return false;
    cancelQueueSensitiveAction();
    return true;
}

export async function runQueueBulkAction(action) {
    const targets = getBulkTargetTickets();
    const normalizedAction = normalizeQueueAction(action);
    if (!targets.length) return;

    if (SENSITIVE_QUEUE_ACTIONS.has(normalizedAction)) {
        const actionLabel =
            normalizedAction === 'no_show'
                ? 'No show'
                : normalizedAction === 'completar' ||
                    normalizedAction === 'completed'
                  ? 'Completar'
                  : 'Cancelar';
        const confirmed = window.confirm(
            `${actionLabel}: confirmar acción masiva`
        );
        if (!confirmed) return;
    }

    for (const ticket of targets) {
        try {
            await executeTicketAction({
                ticketId: ticket.id,
                action: normalizedAction,
                consultorio:
                    ticket.assignedConsultorio ||
                    getState().queue.stationConsultorio,
            });
        } catch (_error) {
            // continue
        }
    }
    clearQueueSelection();
    appendActivity(`Bulk ${normalizedAction} sobre ${targets.length} tickets`);
}

export async function reprintQueueTicket(ticketId) {
    const id = Number(ticketId || 0);
    if (!id) return;

    if (getState().queue.practiceMode) {
        appendActivity(`Practica: reprint ticket ${id}`);
        return;
    }

    await apiRequest('queue-reprint', {
        method: 'POST',
        body: { id },
    });
    appendActivity(`Reimpresion ticket ${id}`);
}

export async function runQueueBulkReprint() {
    const targets = getBulkTargetTickets();
    for (const ticket of targets) {
        try {
            await reprintQueueTicket(ticket.id);
        } catch (_error) {
            // continue
        }
    }
    clearQueueSelection();
    appendActivity(`Bulk reimpresion ${targets.length}`);
}
