import {
    humanizeToken,
    normalize,
    normalizeAppointmentStatus,
    normalizePaymentStatus,
} from './core.js';

export function paymentMethodLabel(method) {
    const labels = {
        transfer: 'Transferencia',
        cash: 'Consultorio',
        card: 'Tarjeta',
        gateway: 'Pasarela',
    };
    return (
        labels[normalize(method)] || humanizeToken(method, 'Metodo pendiente')
    );
}

export function paymentLabel(status) {
    const labels = {
        pending_transfer_review: 'Validar pago',
        pending_transfer: 'Transferencia',
        pending_cash: 'Pago en consultorio',
        pending_gateway: 'Pago en proceso',
        paid: 'Pagado',
        failed: 'Fallido',
    };
    return labels[normalize(status)] || humanizeToken(status, 'Pendiente');
}

export function statusLabel(status) {
    const labels = {
        confirmed: 'Confirmada',
        pending: 'Pendiente',
        completed: 'Completada',
        cancelled: 'Cancelada',
        no_show: 'No show',
    };
    return labels[normalize(status)] || humanizeToken(status, 'Pendiente');
}

export function paymentTone(status) {
    const normalized = normalize(status);
    if (normalized === 'paid') return 'success';
    if (normalized === 'failed') return 'danger';
    if (normalized === 'pending_cash') return 'neutral';
    return 'warning';
}

export function statusTone(status) {
    const normalized = normalize(status);
    if (normalized === 'completed') return 'success';
    if (normalized === 'cancelled' || normalized === 'no_show') return 'danger';
    if (normalized === 'pending') return 'warning';
    return 'neutral';
}

export function isTriageAttention(item) {
    const paymentStatus = normalizePaymentStatus(item);
    const appointmentStatus = normalizeAppointmentStatus(item.status);

    return (
        paymentStatus === 'pending_transfer_review' ||
        paymentStatus === 'pending_transfer' ||
        appointmentStatus === 'no_show' ||
        appointmentStatus === 'cancelled'
    );
}
