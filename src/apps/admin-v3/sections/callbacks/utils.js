import {
    CALLBACK_FILTER_OPTIONS,
    CALLBACK_SORT_OPTIONS,
    CALLBACK_URGENT_THRESHOLD_MINUTES,
} from './constants.js';

export function normalize(value) {
    return String(value || '')
        .toLowerCase()
        .trim();
}

export function normalizeFilter(value) {
    const normalized = normalize(value);
    return CALLBACK_FILTER_OPTIONS.has(normalized) ? normalized : 'all';
}

export function normalizeSort(value) {
    const normalized = normalize(value);
    return CALLBACK_SORT_OPTIONS.has(normalized) ? normalized : 'recent_desc';
}

export function normalizeStatus(status) {
    const value = normalize(status);

    if (
        value === 'contacted' ||
        value === 'contactado' ||
        value === 'completed' ||
        value === 'done' ||
        value === 'resolved' ||
        value === 'called' ||
        value === 'atendido'
    ) {
        return 'contacted';
    }

    if (
        value === 'pending' ||
        value === 'pendiente' ||
        value === 'waiting' ||
        value === 'open' ||
        value === 'new' ||
        value === 'nuevo'
    ) {
        return 'pending';
    }

    return 'pending';
}

export function createdAtMs(item) {
    const date = new Date(item?.fecha || item?.createdAt || '');
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function waitingMinutes(item) {
    const stamp = createdAtMs(item);
    if (!stamp) return 0;
    return Math.max(0, Math.round((Date.now() - stamp) / 60000));
}

export function phoneLabel(item) {
    return (
        String(item?.telefono || item?.phone || 'Sin telefono').trim() ||
        'Sin telefono'
    );
}

export function inToday(value) {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return false;
    const now = new Date();
    return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
    );
}

export function waitBand(minutes) {
    if (minutes >= CALLBACK_URGENT_THRESHOLD_MINUTES) {
        return {
            label: 'Critico SLA',
            tone: 'danger',
            note: 'Escala inmediata',
        };
    }

    if (minutes >= 45) {
        return {
            label: 'En ventana',
            tone: 'warning',
            note: 'Conviene atender pronto',
        };
    }

    return {
        label: 'Reciente',
        tone: 'neutral',
        note: 'Todavia dentro de margen',
    };
}

export function waitingLabel(minutes) {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.round(minutes / 60);
    return `${hours} h`;
}
