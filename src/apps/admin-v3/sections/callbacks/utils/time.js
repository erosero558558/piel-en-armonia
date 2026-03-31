import { CALLBACK_URGENT_THRESHOLD_MINUTES } from '../constants.js';

export function toDayKey(value) {
    const raw = String(value || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return raw;
    }
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

export function inToday(value) {
    return toDayKey(value) === toDayKey(new Date());
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
