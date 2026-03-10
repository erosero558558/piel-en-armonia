import { escapeHtml } from '../../../shared/ui/render.js';
import { appointmentPriority } from '../selectors.js';
import {
    humanizeToken,
    normalizeAppointmentStatus,
    normalizePaymentStatus,
    paymentLabel,
    paymentMethodLabel,
    paymentTone,
    statusLabel,
    statusTone,
    whatsappLink,
} from '../utils.js';

export function paymentCell(item) {
    const paymentStatus = item.paymentStatus || item.payment_status || '';
    const proofUrl = String(
        item.transferProofUrl ||
            item.transferProofURL ||
            item.transfer_proof_url ||
            ''
    ).trim();

    return `
        <div class="appointment-payment-stack">
            <span class="appointment-pill" data-tone="${escapeHtml(paymentTone(paymentStatus))}">${escapeHtml(paymentLabel(paymentStatus))}</span>
            <small>Metodo: ${escapeHtml(paymentMethodLabel(item.paymentMethod || item.payment_method || ''))}</small>
            ${proofUrl ? `<a href="${escapeHtml(proofUrl)}" target="_blank" rel="noopener">Ver comprobante</a>` : '<small>Sin comprobante adjunto</small>'}
        </div>
    `;
}

export function statusCell(item) {
    const status = normalizeAppointmentStatus(item.status);
    const paymentStatus = normalizePaymentStatus(item);
    const priority = appointmentPriority(item);
    const notes = [];

    if (paymentStatus === 'pending_transfer_review') {
        notes.push('Transferencia por validar');
    }
    if (status === 'no_show') {
        notes.push('Paciente ausente');
    }
    if (status === 'cancelled') {
        notes.push('Cita cerrada');
    }

    return `
        <div class="appointment-status-stack">
            <span class="appointment-pill" data-tone="${escapeHtml(statusTone(status))}">${escapeHtml(statusLabel(status))}</span>
            <small>${escapeHtml(notes[0] || priority.note)}</small>
        </div>
    `;
}

export function rowActions(item) {
    const id = Number(item.id || 0);
    const paymentStatus = normalizePaymentStatus(item);
    const phoneHref = whatsappLink(item.phone || '');
    const actions = [];

    if (phoneHref) {
        actions.push(
            `<a href="${escapeHtml(phoneHref)}" target="_blank" rel="noopener" aria-label="WhatsApp de ${escapeHtml(item.name || 'Paciente')}" title="WhatsApp para seguimiento">WhatsApp</a>`
        );
    }

    if (
        paymentStatus === 'pending_transfer_review' ||
        paymentStatus === 'pending_transfer'
    ) {
        actions.push(
            `<button type="button" data-action="approve-transfer" data-id="${id}">Aprobar</button>`
        );
        actions.push(
            `<button type="button" data-action="reject-transfer" data-id="${id}">Rechazar</button>`
        );
    }

    actions.push(
        `<button type="button" data-action="mark-no-show" data-id="${id}">No show</button>`
    );
    actions.push(
        `<button type="button" data-action="cancel-appointment" data-id="${id}">Cancelar</button>`
    );

    return `<div class="table-actions">${actions.join('')}</div>`;
}

export function serviceCell(item) {
    const priority = appointmentPriority(item);

    return `
        <div class="appointment-service">
            <strong>${escapeHtml(humanizeToken(item.service, 'Servicio pendiente'))}</strong>
            <span>Especialista: ${escapeHtml(humanizeToken(item.doctor, 'Sin asignar'))}</span>
            <small>${escapeHtml(priority.label)} | ${escapeHtml(priority.note)}</small>
        </div>
    `;
}
