function renderAssistanceActions(ticket, id) {
    if (!ticket.needsAssistance) {
        return '';
    }

    return `<button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="atender_apoyo">Atender apoyo</button>
                    <button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="resolver_apoyo">Resolver apoyo</button>`;
}

function renderRecallAction(id, ticket) {
    if (ticket.status !== 'called') {
        return '';
    }

    const consultorio = Number(ticket.assignedConsultorio || 1) === 2 ? 2 : 1;
    return `<button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="re-llamar" data-queue-consultorio="${consultorio}">Re-llamar</button>`;
}

function renderReleaseAction(id, ticket) {
    if (!(ticket.status === 'called' && ticket.assignedConsultorio)) {
        return '';
    }

    return `<button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="liberar">Liberar</button>`;
}

export function renderQueueActions(ticket, id, operatorSurface) {
    const recall = renderRecallAction(id, ticket);
    const release = renderReleaseAction(id, ticket);
    const assistance = renderAssistanceActions(ticket, id);

    if (operatorSurface) {
        return `
                    ${recall}
                    ${release}
                    ${assistance}
                    <button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="completar">Completar</button>
                    <button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="no_show">No show</button>
                    <button type="button" data-action="queue-reprint-ticket" data-queue-id="${id}">Reimprimir</button>
                `;
    }

    return `
                    <button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="reasignar" data-queue-consultorio="1">Reasignar C1</button>
                    <button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="reasignar" data-queue-consultorio="2">Reasignar C2</button>
                    ${recall}
                    ${release}
                    ${assistance}
                    <button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="completar">Completar</button>
                    <button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="no_show">No show</button>
                    <button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="cancelar">Cancelar</button>
                    <button type="button" data-action="queue-reprint-ticket" data-queue-id="${id}">Reimprimir</button>
                `;
}
