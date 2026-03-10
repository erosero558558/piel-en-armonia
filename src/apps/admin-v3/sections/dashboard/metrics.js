import { CALLBACK_URGENT_THRESHOLD_MINUTES } from './constants.js';
import {
    appointmentTimestamp,
    callbackTimestamp,
    isToday,
    normalize,
    toTimestamp,
} from './time.js';

export function averageRating(reviews) {
    if (!reviews.length) return '0.0';
    const total = reviews.reduce(
        (sum, item) => sum + Number(item.rating || 0),
        0
    );
    return (total / reviews.length).toFixed(1);
}

export function countRecentReviews(reviews, days = 30) {
    const now = Date.now();
    return reviews.filter((item) => {
        const stamp = toTimestamp(item.date || item.createdAt || '');
        return stamp && now - stamp <= days * 24 * 60 * 60 * 1000;
    }).length;
}

export function countPendingTransfers(appointments) {
    return appointments.filter((item) => {
        const status = normalize(item.paymentStatus || item.payment_status);
        return (
            status === 'pending_transfer_review' ||
            status === 'pending_transfer'
        );
    }).length;
}

export function countNoShows(appointments) {
    return appointments.filter((item) => normalize(item.status) === 'no_show')
        .length;
}

export function countTodayAppointments(appointments) {
    return appointments.filter((item) => isToday(appointmentTimestamp(item)))
        .length;
}

export function countPendingCallbacks(callbacks) {
    return callbacks.filter((item) => normalize(item.status) === 'pending')
        .length;
}

export function countUrgentCallbacks(callbacks) {
    return callbacks.filter((item) => {
        if (normalize(item.status) !== 'pending') return false;
        const createdAt = callbackTimestamp(item);
        if (!createdAt) return false;
        const ageMinutes = Math.round((Date.now() - createdAt) / 60000);
        return ageMinutes >= CALLBACK_URGENT_THRESHOLD_MINUTES;
    }).length;
}

export function countAvailabilityDays(availability) {
    return Object.values(availability || {}).filter(
        (slots) => Array.isArray(slots) && slots.length > 0
    ).length;
}

export function findNextAppointment(appointments) {
    return appointments
        .map((item) => ({
            item,
            stamp: appointmentTimestamp(item),
        }))
        .filter((entry) => entry.stamp > 0 && entry.stamp >= Date.now())
        .sort((a, b) => a.stamp - b.stamp)[0];
}
