function normalizeCallbacks(list) {
    return (Array.isArray(list) ? list : []).map((item) => ({
        ...item,
        status: String(item.status || '')
            .toLowerCase()
            .includes('contact')
            ? 'contacted'
            : 'pending',
    }));
}

function normalizeQueueTickets(data) {
    if (Array.isArray(data.queue_tickets)) return data.queue_tickets;
    if (Array.isArray(data.queueTickets)) return data.queueTickets;
    return [];
}

export function normalizeAdminDataPayload(data, healthPayload, fallbackState) {
    return {
        appointments: Array.isArray(data.appointments) ? data.appointments : [],
        callbacks: Array.isArray(data.callbacks) ? data.callbacks : [],
        reviews: Array.isArray(data.reviews) ? data.reviews : [],
        availability:
            data.availability && typeof data.availability === 'object'
                ? data.availability
                : {},
        availabilityMeta:
            data.availabilityMeta && typeof data.availabilityMeta === 'object'
                ? data.availabilityMeta
                : {},
        queueTickets: normalizeQueueTickets(data),
        queueMeta:
            data.queueMeta && typeof data.queueMeta === 'object'
                ? data.queueMeta
                : data.queue_state && typeof data.queue_state === 'object'
                  ? data.queue_state
                  : null,
        funnelMetrics: data.funnelMetrics || fallbackState?.funnelMetrics || null,
        health: healthPayload && healthPayload.ok ? healthPayload : null,
    };
}

export function normalizeAdminStorePayload(payload, currentFunnelMetrics) {
    return {
        appointments: payload.appointments || [],
        callbacks: normalizeCallbacks(payload.callbacks || []),
        reviews: payload.reviews || [],
        availability: payload.availability || {},
        availabilityMeta: payload.availabilityMeta || {},
        queueTickets: payload.queueTickets || [],
        queueMeta: payload.queueMeta || null,
        funnelMetrics: payload.funnelMetrics || currentFunnelMetrics,
        health: payload.health || null,
    };
}
