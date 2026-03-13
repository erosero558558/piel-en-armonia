import { escapeHtml } from '../../../../ui/render.js';

function buildAssistanceFlag(ticket) {
    if (!ticket?.needsAssistance) {
        return '';
    }

    const reason = String(ticket.assistanceReason || '')
        .trim()
        .toLowerCase();
    const label = String(ticket.assistanceReasonLabel || '').trim();

    if (
        (reason === 'special_priority' && ticket.specialPriority) ||
        (reason === 'late_arrival' && ticket.lateArrival) ||
        ((reason === 'printer_issue' || reason === 'reprint_requested') &&
            ticket.reprintRequestedAt)
    ) {
        return '';
    }

    return label || 'Apoyo';
}

export function renderTicketFlags(ticket) {
    const operationalFlags = [
        ticket.specialPriority ? 'Prioridad' : '',
        buildAssistanceFlag(ticket),
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
