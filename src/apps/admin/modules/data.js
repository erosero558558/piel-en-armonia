import { apiRequest } from './api.js';
import {
    setAppointments,
    setCallbacks,
    setReviews,
    setAvailability,
    setFunnelMetrics,
    getEmptyFunnelMetrics
} from './state.js';
import { normalizeCallbackStatus, showToast } from './ui.js';

function getLocalData(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || 'null');
        return value === null ? fallback : value;
    } catch (error) {
        return fallback;
    }
}

function loadFallbackState() {
    setAppointments(getLocalData('appointments', []));
    setCallbacks(getLocalData('callbacks', []).map(c => ({
        ...c,
        status: normalizeCallbackStatus(c.status)
    })));
    setReviews(getLocalData('reviews', []));
    setAvailability(getLocalData('availability', {}));
    setFunnelMetrics(getEmptyFunnelMetrics());
}

export async function refreshData() {
    try {
        const [payload, funnelPayload] = await Promise.all([
            apiRequest('data'),
            apiRequest('funnel-metrics').catch(() => null)
        ]);

        const data = payload.data || {};
        setAppointments(Array.isArray(data.appointments) ? data.appointments : []);
        setCallbacks(Array.isArray(data.callbacks) ? data.callbacks.map(c => ({
            ...c,
            status: normalizeCallbackStatus(c.status)
        })) : []);
        setReviews(Array.isArray(data.reviews) ? data.reviews : []);
        setAvailability(data.availability && typeof data.availability === 'object' ? data.availability : {});

        if (funnelPayload && funnelPayload.data && typeof funnelPayload.data === 'object') {
            setFunnelMetrics(funnelPayload.data);
        } else {
            setFunnelMetrics(getEmptyFunnelMetrics());
        }
    } catch (error) {
        loadFallbackState();
        showToast('No se pudo conectar al backend. Usando datos locales.', 'warning');
    }
}
