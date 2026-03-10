import {
    averageRating,
    countAvailabilityDays,
    countNoShows,
    countPendingCallbacks,
    countPendingTransfers,
    countRecentReviews,
    countTodayAppointments,
    countUrgentCallbacks,
    findNextAppointment,
} from './metrics.js';

export function getDashboardCollections(state) {
    return {
        appointments: Array.isArray(state?.data?.appointments)
            ? state.data.appointments
            : [],
        callbacks: Array.isArray(state?.data?.callbacks)
            ? state.data.callbacks
            : [],
        reviews: Array.isArray(state?.data?.reviews) ? state.data.reviews : [],
        availability:
            state?.data?.availability &&
            typeof state.data.availability === 'object'
                ? state.data.availability
                : {},
        funnel: state?.data?.funnelMetrics || {},
    };
}

export function getDashboardDerivedState(state) {
    const { appointments, availability, callbacks, funnel, reviews } =
        getDashboardCollections(state);

    const todayAppointments = countTodayAppointments(appointments);
    const pendingTransfers = countPendingTransfers(appointments);
    const pendingCallbacks = countPendingCallbacks(callbacks);
    const urgentCallbacks = countUrgentCallbacks(callbacks);
    const noShows = countNoShows(appointments);
    const avgRating = averageRating(reviews);
    const recentReviews = countRecentReviews(reviews);
    const availabilityDays = countAvailabilityDays(availability);
    const nextAppointment = findNextAppointment(appointments);

    return {
        appointments,
        availabilityDays,
        avgRating,
        callbacks,
        funnel,
        nextAppointment,
        noShows,
        pendingCallbacks,
        pendingTransfers,
        recentReviews,
        reviews,
        todayAppointments,
        urgentCallbacks,
    };
}
