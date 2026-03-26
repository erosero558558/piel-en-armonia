import { setText } from '../../../../ui/render.js';

function getCallingTicket(queueMeta, consultorio) {
    return (
        queueMeta.callingNowByConsultorio?.[String(consultorio)] ||
        queueMeta.callingNowByConsultorio?.[consultorio] ||
        null
    );
}

function getTicketCode(ticket) {
    return ticket
        ? String(ticket.ticketCode || ticket.ticket_code || 'A-000')
        : 'Sin llamado';
}

function syncReleaseButton(buttonId, consultorio, ticket, ticketCode) {
    const button = document.getElementById(buttonId);
    if (!(button instanceof HTMLButtonElement)) {
        return;
    }

    button.hidden = !ticket;
    button.textContent = ticket
        ? `Liberar C${consultorio} · ${ticketCode}`
        : `Liberar C${consultorio}`;

    if (ticket) {
        button.setAttribute('data-queue-id', String(Number(ticket.id || 0)));
        return;
    }

    button.removeAttribute('data-queue-id');
}

export function renderQueueStationMeta(queueMeta) {
    const c1 = getCallingTicket(queueMeta, 1);
    const c2 = getCallingTicket(queueMeta, 2);
    const c1Code = getTicketCode(c1);
    const c2Code = getTicketCode(c2);

    setText('#queueC1Now', c1Code);
    setText('#queueC2Now', c2Code);

    syncReleaseButton('queueReleaseC1', 1, c1, c1Code);
    syncReleaseButton('queueReleaseC2', 2, c2, c2Code);
}
