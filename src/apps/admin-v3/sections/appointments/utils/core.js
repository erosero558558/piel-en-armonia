export function normalize(value) {
    return String(value || '')
        .toLowerCase()
        .trim();
}

export function toTimestamp(value) {
    const date = new Date(value || '');
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
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
