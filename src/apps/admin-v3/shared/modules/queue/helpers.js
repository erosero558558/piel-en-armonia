export function normalize(value) {
    return String(value || '')
        .toLowerCase()
        .trim();
}

export function normalizeStatus(value) {
    const normalized = normalize(value);
    if (['waiting', 'wait', 'en_espera', 'espera'].includes(normalized)) {
        return 'waiting';
    }
    if (['called', 'calling', 'llamado'].includes(normalized)) return 'called';
    if (['completed', 'complete', 'completar', 'done'].includes(normalized)) {
        return 'completed';
    }
    if (
        ['no_show', 'noshow', 'no-show', 'no show', 'no_asistio'].includes(
            normalized
        )
    ) {
        return 'no_show';
    }
    if (
        ['cancelled', 'canceled', 'cancelar', 'cancelado'].includes(normalized)
    ) {
        return 'cancelled';
    }
    return normalized || 'waiting';
}

export function normalizeQueueAction(value) {
    const normalized = normalize(value);
    if (['complete', 'completed', 'completar'].includes(normalized)) {
        return 'completar';
    }
    if (['no_show', 'noshow', 'no-show', 'no show'].includes(normalized)) {
        return 'no_show';
    }
    if (
        ['cancel', 'cancelled', 'canceled', 'cancelar', 'cancelado'].includes(
            normalized
        )
    ) {
        return 'cancelar';
    }
    if (['reasignar', 'reassign'].includes(normalized)) return 'reasignar';
    if (['re-llamar', 'rellamar', 'recall', 'llamar'].includes(normalized)) {
        return 're-llamar';
    }
    if (['liberar', 'release'].includes(normalized)) return 'liberar';
    return normalized;
}

export function statusLabel(status) {
    switch (normalizeStatus(status)) {
        case 'waiting':
            return 'En espera';
        case 'called':
            return 'Llamado';
        case 'completed':
            return 'Completado';
        case 'no_show':
            return 'No asistio';
        case 'cancelled':
            return 'Cancelado';
        default:
            return String(status || '--');
    }
}

export function asArray(value) {
    return Array.isArray(value) ? value : [];
}

export function toFiniteNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

export function toMillis(value) {
    const date = new Date(value || '');
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function coalesceNonEmptyString(...values) {
    for (const value of values) {
        const text = String(value ?? '').trim();
        if (text) return text;
    }
    return '';
}
