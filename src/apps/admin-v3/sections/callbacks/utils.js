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
    return CALLBACK_SORT_OPTIONS.has(normalized) ? normalized : 'priority_desc';
}

export function normalizeStatus(status) {
    const value = normalize(status);
    return value.includes('contact') ||
        value === 'resolved' ||
        value === 'atendido'
        ? 'contacted'
        : 'pending';
}

export function leadOps(item) {
    return item?.leadOps && typeof item.leadOps === 'object'
        ? item.leadOps
        : {};
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

export function waitingLabel(minutes) {
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440) return `${Math.round(minutes / 60)} h`;
    return `${Math.round(minutes / 1440)} d`;
}

export function phoneLabel(item) {
    return (
        String(item?.telefono || item?.phone || 'Sin telefono').trim() ||
        'Sin telefono'
    );
}

export function priorityBand(item) {
    const value = normalize(leadOps(item).priorityBand);
    return value === 'hot' || value === 'warm' ? value : 'cold';
}

export function priorityRank(item) {
    const band = priorityBand(item);
    return band === 'hot' ? 3 : band === 'warm' ? 2 : 1;
}

export function priorityLabel(item) {
    const band = priorityBand(item);
    return band === 'hot' ? 'Hot' : band === 'warm' ? 'Warm' : 'Cold';
}

export function serviceHint(item) {
    const hints = Array.isArray(leadOps(item).serviceHints)
        ? leadOps(item).serviceHints
        : [];
    return String(hints[0] || '').trim() || 'Sin sugerencia';
}

export function nextActionLabel(item) {
    return (
        String(leadOps(item).nextAction || '').trim() ||
        'Mantener visible en la cola'
    );
}

export function outcomeLabel(item) {
    const value = normalize(leadOps(item).outcome);
    if (value === 'cita_cerrada') return 'Cita cerrada';
    if (value === 'sin_respuesta') return 'Sin respuesta';
    if (value === 'descartado') return 'Descartado';
    if (value === 'contactado') return 'Contactado';
    return 'Pendiente';
}

export function aiStatusLabel(item, workerMode = '') {
    const value = normalize(leadOps(item).aiStatus);
    if (value === 'requested') {
        return workerMode === 'online' ? 'IA pendiente' : 'IA no disponible';
    }
    if (value === 'completed') return 'Borrador listo';
    if (value === 'accepted') return 'Borrador usado';
    if (value === 'failed') return 'IA fallida';
    return workerMode === 'disabled' ? 'IA apagada' : 'Sin IA';
}

export function aiDraftText(item) {
    return String(leadOps(item).aiDraft || '').trim();
}

export function heuristicScore(item) {
    const score = Number(leadOps(item).heuristicScore || 0);
    return Number.isFinite(score) ? score : 0;
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
