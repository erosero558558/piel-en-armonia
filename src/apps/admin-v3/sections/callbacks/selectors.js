import { CALLBACK_URGENT_THRESHOLD_MINUTES } from './constants.js';
import {
    aiStatusLabel,
    createdAtMs,
    heuristicScore,
    inToday,
    leadOps,
    nextActionLabel,
    normalize,
    normalizeFilter,
    normalizeSort,
    normalizeStatus,
    priorityRank,
    serviceHint,
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

export function applySearch(items, search, workerMode = '') {
    const term = normalize(search);
    if (!term) return items;

    return items.filter((item) => {
        const extra = leadOps(item);
        const fields = [
            item.telefono,
            item.phone,
            item.preferencia,
            item.status,
            serviceHint(item),
            nextActionLabel(item),
            aiStatusLabel(item, workerMode),
            ...(Array.isArray(extra.reasonCodes) ? extra.reasonCodes : []),
            ...(Array.isArray(extra.serviceHints) ? extra.serviceHints : []),
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

    if (normalized === 'recent_desc') {
        list.sort((a, b) => createdAtMs(b) - createdAtMs(a));
        return list;
    }

    list.sort((a, b) => {
        const priorityDelta = priorityRank(b) - priorityRank(a);
        if (priorityDelta !== 0) return priorityDelta;

        const scoreDelta = heuristicScore(b) - heuristicScore(a);
        if (scoreDelta !== 0) return scoreDelta;

        return createdAtMs(a) - createdAtMs(b);
    });
    return list;
}

export function computeOps(items, leadOpsMeta = null) {
    const pending = items.filter(
        (item) => normalizeStatus(item.status) === 'pending'
    );
    const urgent = pending.filter(
        (item) => waitingMinutes(item) >= CALLBACK_URGENT_THRESHOLD_MINUTES
    );
    const hot = pending.filter((item) => priorityRank(item) === 3);
    const next = pending.slice().sort((a, b) => {
        const priorityDelta = priorityRank(b) - priorityRank(a);
        if (priorityDelta !== 0) return priorityDelta;
        return createdAtMs(a) - createdAtMs(b);
    })[0];

    const workerMode = normalize(leadOpsMeta?.worker?.mode || '');
    return {
        pendingCount: pending.length,
        urgentCount: urgent.length,
        hotCount: hot.length,
        todayCount: items.filter((item) =>
            inToday(item.fecha || item.createdAt)
        ).length,
        next,
        workerMode,
        queueHealth:
            workerMode === 'offline' || workerMode === 'degraded'
                ? 'Cola estable, IA degradada'
                : hot.length > 0
                  ? 'Cola: prioridad comercial alta'
                  : urgent.length > 0
                    ? 'Cola: atencion requerida'
                    : pending.length > 0
                      ? 'Cola: operativa'
                      : 'Cola: estable',
        queueState:
            hot.length > 0
                ? 'danger'
                : urgent.length > 0
                  ? 'warning'
                  : 'success',
    };
}
