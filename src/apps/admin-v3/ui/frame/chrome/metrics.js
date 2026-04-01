import { SECTION_CONTEXT } from '../config.js';

function countPendingTransfers(appointments) {
    return appointments.filter((item) => {
        const status = String(
            item.paymentStatus || item.payment_status || ''
        ).toLowerCase();
        return (
            status === 'pending_transfer_review' ||
            status === 'pending_transfer'
        );
    }).length;
}

function countPendingCallbacks(callbacks) {
    return callbacks.filter((item) => {
        const status = String(item.status || '')
            .toLowerCase()
            .trim();
        return status === 'pending' || status === 'pendiente';
    }).length;
}

function countAvailabilityDays(availability) {
    return Object.values(availability || {}).filter(
        (slots) => Array.isArray(slots) && slots.length > 0
    ).length;
}

function countWaitingTickets(queueTickets, queueMeta) {
    if (queueMeta && Number.isFinite(Number(queueMeta.waitingCount))) {
        return Math.max(0, Number(queueMeta.waitingCount));
    }

    return (Array.isArray(queueTickets) ? queueTickets : []).filter(
        (ticket) => String(ticket.status || '').toLowerCase() === 'waiting'
    ).length;
}

function calculateWorkload(appointments) {
    const today = new Date().toISOString().split('T')[0];
    const todayApps = appointments.filter(app => {
        if (!app.date) return false;
        return String(app.date).slice(0, 10) === today;
    });
    // For visual testing when DB is empty, use dummy 12/4
    const total = todayApps.length > 0 ? todayApps.length : 12;
    const completed = todayApps.length > 0
        ? todayApps.filter(a => String(a.status).toLowerCase() === 'completed').length
        : 4;
    
    // < 60% (green), 60-90% (amber), > 90% (red)
    const ratio = total > 0 ? (completed / total) : 0;
    const loadPercent = ratio * 100;
    
    let color = 'green';
    if (loadPercent < 60) color = 'green';
    else if (loadPercent <= 90) color = 'amber';
    else color = 'red';

    return { total, completed, color };
}

export function getChromeMetrics(state) {
    const section = state?.ui?.activeSection || 'dashboard';
    const config = SECTION_CONTEXT[section] || SECTION_CONTEXT.dashboard;
    const auth = state?.auth && typeof state.auth === 'object' ? state.auth : {};
    const appointments = Array.isArray(state?.data?.appointments) ? state.data.appointments : [];
    const callbacks = Array.isArray(state?.data?.callbacks) ? state.data.callbacks : [];
    const reviews = Array.isArray(state?.data?.reviews) ? state.data.reviews : [];
    const availability = state?.data?.availability && typeof state.data.availability === 'object' ? state.data.availability : {};
    const queueTickets = Array.isArray(state?.data?.queueTickets) ? state.data.queueTickets : [];
    const queueMeta = state?.data?.queueMeta && typeof state.data.queueMeta === 'object' ? state.data.queueMeta : null;
    const internalConsoleMeta = state?.data?.internalConsoleMeta && typeof state.data.internalConsoleMeta === 'object' ? state.data.internalConsoleMeta : null;

    const pendingTransfers = countPendingTransfers(appointments);
    const pendingCallbacks = countPendingCallbacks(callbacks);
    const availabilityDays = countAvailabilityDays(availability);
    const waitingTickets = countWaitingTickets(queueTickets, queueMeta);
    const workload = calculateWorkload(appointments);

    return {
        auth,
        config,
        internalConsoleMeta,
        appointments,
        reviews,
        pendingTransfers,
        pendingCallbacks,
        availabilityDays,
        waitingTickets,
        dashboardAlerts: pendingTransfers + pendingCallbacks,
        workload
    };
}
