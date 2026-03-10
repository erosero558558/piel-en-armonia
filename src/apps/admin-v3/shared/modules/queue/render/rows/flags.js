import { escapeHtml } from '../../../../ui/render.js';

export function renderTicketFlags(ticket) {
    const operationalFlags = [
        ticket.specialPriority ? 'Prioridad' : '',
        ticket.needsAssistance ? 'Apoyo' : '',
        ticket.lateArrival ? 'Tarde' : '',
        ticket.reprintRequestedAt ? 'Reimpresion' : '',
    ].filter(Boolean);

    if (!operationalFlags.length) {
        return '';
    }

    return `<div class="queue-row-flags">${operationalFlags
        .map((flag) => `<span>${escapeHtml(flag)}</span>`)
        .join(' · ')}</div>`;
}
