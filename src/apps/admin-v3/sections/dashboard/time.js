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

export function callbackTimestamp(item) {
    return toTimestamp(item?.fecha || item?.createdAt || '');
}

export function isToday(timestamp) {
    if (!timestamp) return false;
    const date = new Date(timestamp);
    const now = new Date();
    return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
    );
}

export function relativeWindow(timestamp) {
    if (!timestamp) return 'Sin fecha';
    const diffMinutes = Math.round((timestamp - Date.now()) / 60000);
    const absoluteMinutes = Math.abs(diffMinutes);

    if (diffMinutes < 0) {
        if (absoluteMinutes < 60) return `Hace ${absoluteMinutes} min`;
        if (absoluteMinutes < 24 * 60) {
            return `Hace ${Math.round(absoluteMinutes / 60)} h`;
        }
        return 'Ya ocurrio';
    }

    if (diffMinutes < 60) return `En ${Math.max(diffMinutes, 0)} min`;
    if (diffMinutes < 24 * 60) {
        return `En ${Math.round(diffMinutes / 60)} h`;
    }
    return `En ${Math.round(diffMinutes / (24 * 60))} d`;
}
