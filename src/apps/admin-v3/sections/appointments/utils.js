export function normalize(value) {
    return String(value || '')
        .toLowerCase()
        .trim();
}

export function toTimestamp(value) {
    const date = new Date(value || '');
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function appointmentTimestamp(item) {
    return toTimestamp(`${item?.date || ''}T${item?.time || '00:00'}:00`);
}

export function normalizePaymentStatus(item) {
    return normalize(item.paymentStatus || item.payment_status || '');
}

export function normalizeAppointmentStatus(status) {
    return normalize(status);
}

export function humanizeToken(value, fallback = '-') {
    const source = String(value || '')
        .replace(/[_-]+/g, ' ')
        .trim();
    if (!source) return fallback;
    return source
        .split(/\s+/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

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

export function relativeWindow(timestamp) {
    if (!timestamp) return 'Sin fecha';
    const diffMinutes = Math.round((timestamp - Date.now()) / 60000);
    const absoluteMinutes = Math.abs(diffMinutes);

    if (diffMinutes < 0) {
        if (absoluteMinutes < 60) {
            return `Hace ${absoluteMinutes} min`;
        }
        if (absoluteMinutes < 24 * 60) {
            return `Hace ${Math.round(absoluteMinutes / 60)} h`;
        }
        return 'Ya ocurrio';
    }

    if (diffMinutes < 60) {
        return `En ${Math.max(diffMinutes, 0)} min`;
    }
    if (diffMinutes < 24 * 60) {
        return `En ${Math.round(diffMinutes / 60)} h`;
    }
    return `En ${Math.round(diffMinutes / (24 * 60))} d`;
}

export function isToday(item) {
    const stamp = appointmentTimestamp(item);
    if (!stamp) return false;
    const date = new Date(stamp);
    const now = new Date();
    return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
    );
}

export function isUpcoming48h(item) {
    const stamp = appointmentTimestamp(item);
    if (!stamp) return false;
    const diff = stamp - Date.now();
    return diff >= 0 && diff <= 48 * 60 * 60 * 1000;
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

export function whatsappLink(phone) {
    const digits = String(phone || '').replace(/\D+/g, '');
    return digits ? `https://wa.me/${digits}` : '';
}
