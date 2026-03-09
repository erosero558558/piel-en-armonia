import { CALLBACK_URGENT_THRESHOLD_MINUTES } from './constants.js';
import {
    createdAtMs,
    inToday,
    normalize,
    normalizeFilter,
    normalizeSort,
    normalizeStatus,
    waitingMinutes,
} from './utils.js';

export function applyFilter(items, filter) {
    const normalized = normalizeFilter(filter);

    if (normalized === 'pending' || normalized === 'contacted') {
        return items.filter(
            (item) => normalizeStatus(item.status) === normalized
        );
    }

    if (normalized === 'today') {
        return items.filter((item) => inToday(item.fecha || item.createdAt));
    }

    if (normalized === 'sla_urgent') {
        return items.filter((item) => {
            if (normalizeStatus(item.status) !== 'pending') return false;
            return waitingMinutes(item) >= CALLBACK_URGENT_THRESHOLD_MINUTES;
        });
    }

    return items;
}

export function applySearch(items, search) {
    const term = normalize(search);
    if (!term) return items;

    return items.filter((item) => {
        const fields = [
            item.telefono,
            item.phone,
            item.preferencia,
            item.status,
        ];
        return fields.some((field) => normalize(field).includes(term));
    });
}

export function sortItems(items, sort) {
    const normalized = normalizeSort(sort);
    const list = [...items];

    if (normalized === 'waiting_desc') {
        list.sort((a, b) => createdAtMs(a) - createdAtMs(b));
        return list;
    }

    list.sort((a, b) => createdAtMs(b) - createdAtMs(a));
    return list;
}

export function computeOps(items) {
    const pending = items.filter(
        (item) => normalizeStatus(item.status) === 'pending'
    );
    const urgent = pending.filter(
        (item) => waitingMinutes(item) >= CALLBACK_URGENT_THRESHOLD_MINUTES
    );
    const next = pending
        .slice()
        .sort((a, b) => createdAtMs(a) - createdAtMs(b))[0];

    return {
        pendingCount: pending.length,
        urgentCount: urgent.length,
        todayCount: items.filter((item) =>
            inToday(item.fecha || item.createdAt)
        ).length,
        next,
        queueHealth:
            urgent.length > 0
                ? 'Cola: prioridad alta'
                : pending.length > 0
                  ? 'Cola: atencion requerida'
                  : 'Cola: estable',
        queueState:
            urgent.length > 0
                ? 'danger'
                : pending.length > 0
                  ? 'warning'
                  : 'success',
    };
}
