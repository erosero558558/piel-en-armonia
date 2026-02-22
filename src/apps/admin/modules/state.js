export let currentAppointments = [];
export let currentCallbacks = [];
export let currentReviews = [];
export let currentAvailability = {};
export let currentAvailabilityMeta = {};
export let currentFunnelMetrics = null;
export let csrfToken = '';

export function setAppointments(data) { currentAppointments = data || []; }
export function setCallbacks(data) { currentCallbacks = data || []; }
export function setReviews(data) { currentReviews = data || []; }
export function setAvailability(data) { currentAvailability = data || {}; }
export function setAvailabilityMeta(data) { currentAvailabilityMeta = data || {}; }
export function setFunnelMetrics(data) { currentFunnelMetrics = data; }
export function setCsrfToken(token) { csrfToken = token; }

export function getEmptyFunnelMetrics() {
    return {
        summary: {
            viewBooking: 0,
            startCheckout: 0,
            bookingConfirmed: 0,
            checkoutAbandon: 0,
            startRatePct: 0,
            confirmedRatePct: 0,
            abandonRatePct: 0
        },
        checkoutAbandonByStep: [],
        checkoutEntryBreakdown: [],
        paymentMethodBreakdown: [],
        bookingStepBreakdown: []
    };
}
