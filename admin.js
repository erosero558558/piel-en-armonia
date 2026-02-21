let currentAppointments = [];
let currentCallbacks = [];
let currentReviews = [];
let currentAvailability = {};
let currentFunnelMetrics = null;
let csrfToken = '';

function setAppointments(data) { currentAppointments = data || []; }
function setCallbacks(data) { currentCallbacks = data || []; }
function setReviews(data) { currentReviews = data || []; }
function setAvailability(data) { currentAvailability = data || {}; }
function setFunnelMetrics(data) { currentFunnelMetrics = data; }
function setCsrfToken(token) { csrfToken = token; }

function getEmptyFunnelMetrics() {
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

var state = /*#__PURE__*/Object.freeze({
    __proto__: null,
    get csrfToken () { return csrfToken; },
    get currentAppointments () { return currentAppointments; },
    get currentAvailability () { return currentAvailability; },
    get currentCallbacks () { return currentCallbacks; },
    get currentFunnelMetrics () { return currentFunnelMetrics; },
    get currentReviews () { return currentReviews; },
    getEmptyFunnelMetrics: getEmptyFunnelMetrics,
    setAppointments: setAppointments,
    setAvailability: setAvailability,
    setCallbacks: setCallbacks,
    setCsrfToken: setCsrfToken,
    setFunnelMetrics: setFunnelMetrics,
    setReviews: setReviews
});

const API_ENDPOINT = '/api.php';
const AUTH_ENDPOINT = '/admin-auth.php';

function buildQuery(resource) {
    const params = new URLSearchParams();
    params.set('resource', resource);
    return `${API_ENDPOINT}?${params.toString()}`;
}

async function requestJson(url, options = {}) {
    const init = {
        method: options.method || 'GET',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json'
        }
    };

    if (csrfToken && options.method && options.method !== 'GET') {
        init.headers['X-CSRF-Token'] = csrfToken;
    }

    if (options.body !== undefined) {
        init.headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, init);
    const responseText = await response.text();

    let payload = {};
    try {
        payload = responseText ? JSON.parse(responseText) : {};
    } catch (error) {
        throw new Error('Respuesta no valida del servidor');
    }

    if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || `HTTP ${response.status}`);
    }

    return payload;
}

async function apiRequest(resource, options = {}) {
    return requestJson(buildQuery(resource), options);
}

async function authRequest(action, options = {}) {
    return requestJson(`${AUTH_ENDPOINT}?action=${encodeURIComponent(action)}`, options);
}

/**
 * Shared utilities for Piel en Armonía
 */

/**
 * Escapes HTML special characters to prevent XSS.
 * @param {string} text - The text to escape.
 * @returns {string} The escaped HTML string.
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
}

function showToast(message, type = 'info', title = '') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };

    const titles = {
        success: title || 'Exito',
        error: title || 'Error',
        warning: title || 'Advertencia',
        info: title || 'Información'
    };

    toast.innerHTML = `
        <i class="fas ${icons[type]} toast-icon"></i>
        <div class="toast-content">
            <div class="toast-title">${escapeHtml(titles[type])}</div>
            <div class="toast-message">${escapeHtml(message)}</div>
        </div>
        <button type="button" class="toast-close" data-action="close-toast">
            <i class="fas fa-times"></i>
        </button>
        <div class="toast-progress"></div>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

function formatPercent(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '0%';
    return `${num.toFixed(1)}%`;
}

function formatCount(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return '0';
    return Math.round(num).toLocaleString('es-EC');
}

function toPositiveNumber(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return 0;
    return num;
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' });
}

function sanitizePublicHref(url) {
    const value = String(url || '').trim();
    if (value === '') return '';
    if (value.startsWith('/')) return value;
    if (/^https?:\/\//i.test(value)) return value;
    return '';
}

function getServiceName(service) {
    const names = {
        consulta: 'Consulta Dermatológica',
        telefono: 'Consulta Telefónica',
        video: 'Video Consulta',
        laser: 'Tratamiento Láser',
        rejuvenecimiento: 'Rejuvenecimiento'
    };
    return names[service] || service;
}

function getDoctorName(doctor) {
    const names = {
        rosero: 'Dr. Rosero',
        narvaez: 'Dra. Narváez',
        indiferente: 'Cualquiera disponible'
    };
    return names[doctor] || doctor;
}

function getStatusText(status) {
    const texts = {
        confirmed: 'Confirmada',
        pending: 'Pendiente',
        cancelled: 'Cancelada',
        completed: 'Completada'
    };
    return texts[status] || status;
}

function getPaymentMethodText(method) {
    const normalized = String(method || '').toLowerCase().trim();
    const texts = {
        card: 'Tarjeta',
        transfer: 'Transferencia',
        cash: 'Efectivo',
        unpaid: 'Sin definir'
    };
    return texts[normalized] || (method || 'Sin definir');
}

function getPaymentStatusText(status) {
    const normalized = String(status || '').toLowerCase().trim();
    const texts = {
        paid: 'Pagado',
        pending_cash: 'Pago en consultorio',
        pending_transfer: 'Transferencia pendiente',
        pending_transfer_review: 'Comprobante por validar',
        pending_gateway: 'Pago en proceso',
        pending: 'Pendiente',
        failed: 'Pago fallido'
    };
    return texts[normalized] || (status || 'Pendiente');
}

function getPreferenceText(pref) {
    const texts = {
        ahora: 'Lo antes posible',
        '15min': 'En 15 minutos',
        '30min': 'En 30 minutos',
        '1hora': 'En 1 hora'
    };
    return texts[pref] || pref;
}

function normalizeCallbackStatus(status) {
    const normalized = String(status || '').toLowerCase().trim();
    if (normalized === 'pending') return 'pendiente';
    if (normalized === 'contacted') return 'contactado';
    return normalized === 'contactado' ? 'contactado' : 'pendiente';
}

async function logout$1() {
    try {
        await authRequest('logout', { method: 'POST' });
    } catch (error) {
        // Continue
    }
    showToast('Sesion cerrada correctamente', 'info');
    setTimeout(() => window.location.reload(), 800);
}

async function login(password) {
    return authRequest('login', {
        method: 'POST',
        body: { password }
    });
}

async function login2FA(code) {
    return authRequest('login-2fa', {
        method: 'POST',
        body: { code }
    });
}

function getLocalData(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || 'null');
        return value === null ? fallback : value;
    } catch (error) {
        return fallback;
    }
}

function saveLocalData(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
        // storage quota full or disabled
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

async function refreshData() {
    try {
        const [payload, funnelPayload] = await Promise.all([
            apiRequest('data'),
            apiRequest('funnel-metrics').catch(() => null)
        ]);

        const data = payload.data || {};

        const appointments = Array.isArray(data.appointments) ? data.appointments : [];
        setAppointments(appointments);
        saveLocalData('appointments', appointments);

        const callbacks = Array.isArray(data.callbacks) ? data.callbacks.map(c => ({
            ...c,
            status: normalizeCallbackStatus(c.status)
        })) : [];
        setCallbacks(callbacks);
        saveLocalData('callbacks', callbacks);

        const reviews = Array.isArray(data.reviews) ? data.reviews : [];
        setReviews(reviews);
        saveLocalData('reviews', reviews);

        const availability = data.availability && typeof data.availability === 'object' ? data.availability : {};
        setAvailability(availability);
        saveLocalData('availability', availability);

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

// Static imports removed to enable lazy loading
// import { loadDashboardData } from './modules/dashboard.js';
// import { loadAppointments } from './modules/appointments.js';
// import { loadCallbacks } from './modules/callbacks.js';
// import { loadReviews } from './modules/reviews.js';
// import { initAvailabilityCalendar } from './modules/availability.js';

async function renderSection(section) {
    const titles = {
        dashboard: 'Dashboard',
        appointments: 'Citas',
        callbacks: 'Callbacks',
        reviews: 'Reseñas',
        availability: 'Disponibilidad'
    };
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = titles[section] || 'Dashboard';

    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    const sectionEl = document.getElementById(section);
    if (sectionEl) sectionEl.classList.add('active');

    // Load data for the section using dynamic imports
    switch (section) {
        case 'dashboard': {
            const { loadDashboardData } = await import('./js/chunks/admin-dashboard-B6tqHnCY.js');
            loadDashboardData();
            break;
        }
        case 'appointments': {
            const { loadAppointments } = await import('./js/chunks/admin-appointments-Cwn756Iy.js');
            loadAppointments();
            break;
        }
        case 'callbacks': {
            const { loadCallbacks } = await import('./js/chunks/admin-callbacks-Bvepi_wt.js');
            loadCallbacks();
            break;
        }
        case 'reviews': {
            const { loadReviews } = await import('./js/chunks/admin-reviews-DFXlEOux.js');
            loadReviews();
            break;
        }
        case 'availability': {
            const { initAvailabilityCalendar } = await import('./js/chunks/admin-availability-4bfwcN9b.js');
            initAvailabilityCalendar();
            break;
        }
        default: {
            const { loadDashboardData } = await import('./js/chunks/admin-dashboard-B6tqHnCY.js');
            loadDashboardData();
            break;
        }
    }
}

async function handleLogin(e) {
    e.preventDefault();

    const group2FA = document.getElementById('group2FA');
    const is2FAMode = group2FA && !group2FA.classList.contains('is-hidden');

    if (is2FAMode) {
        const code = document.getElementById('admin2FACode').value;
        try {
            const result = await login2FA(code);
            if (result.csrfToken) setCsrfToken(result.csrfToken);
            showToast('Bienvenido al panel de administracion', 'success');
            await showDashboard();
        } catch (error) {
            showToast('Código incorrecto o sesión expirada', 'error');
        }
    } else {
        const password = document.getElementById('adminPassword').value;
        try {
            const loginResult = await login(password);

            if (loginResult.twoFactorRequired) {
                document.getElementById('passwordGroup').classList.add('is-hidden');
                if (group2FA) group2FA.classList.remove('is-hidden');
                document.getElementById('admin2FACode').focus();
                const btn = document.getElementById('loginBtn');
                if (btn) btn.innerHTML = '<i class="fas fa-check"></i> Verificar';
                showToast('Ingresa tu código 2FA', 'info');
            } else {
                if (loginResult.csrfToken) setCsrfToken(loginResult.csrfToken);
                showToast('Bienvenido al panel de administracion', 'success');
                await showDashboard();
            }
        } catch (error) {
            showToast('Contraseña incorrecta', 'error');
        }
    }
}

function showLogin() {
    const loginScreen = document.getElementById('loginScreen');
    const dashboard = document.getElementById('adminDashboard');
    if (loginScreen) loginScreen.classList.remove('is-hidden');
    if (dashboard) dashboard.classList.add('is-hidden');
}

async function showDashboard() {
    const loginScreen = document.getElementById('loginScreen');
    const dashboard = document.getElementById('adminDashboard');
    if (loginScreen) loginScreen.classList.add('is-hidden');
    if (dashboard) dashboard.classList.remove('is-hidden');
    await updateDate();
}

async function checkAuth() {
    try {
        if (!navigator.onLine) {
            const cached = getLocalData('appointments', null);
            if (cached) {
                // We need to implement loadFallbackState or just show dashboard
                // loadFallbackState is not imported. It seems it was used in monolithic file.
                // We can import it from data.js if it exists, or just rely on refreshData handling errors?
                // refreshData in modules/data.js handles errors?
                // Actually refreshData is imported.
                showToast('Modo Offline: Mostrando datos locales', 'info');
                await showDashboard();
                return;
            }
        }

        const payload = await authRequest('status');
        if (payload.authenticated) {
            if (payload.csrfToken) setCsrfToken(payload.csrfToken);
            await showDashboard();
        } else {
            showLogin();
        }
    } catch (error) {
        if (getLocalData('appointments', null)) {
             showToast('Error de conexión. Mostrando datos locales.', 'warning');
             await showDashboard();
             return;
        }
        showLogin();
        showToast('No se pudo verificar la sesion', 'warning');
    }
}

async function logout() {
    await logout$1();
}

async function updateDate() {
    const dateEl = document.getElementById('currentDate');
    if (dateEl) {
         const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
         dateEl.textContent = new Date().toLocaleDateString('es-EC', options);
    }

    await refreshData();
    const activeItem = document.querySelector('.nav-item.active');
    const section = activeItem?.dataset.section || 'dashboard';
    await renderSection(section);
}

function attachGlobalListeners() {
    document.addEventListener('click', async function(e) {
        const actionEl = e.target.closest('[data-action]');
        if (!actionEl) return;

        const action = actionEl.dataset.action;

        if (action === 'close-toast') {
            const toast = actionEl.closest('.toast');
            if (toast) toast.remove();
            return;
        }
        if (action === 'logout') {
            e.preventDefault();
            await logout();
            return;
        }
        if (action === 'export-data') {
            e.preventDefault();
            exportData();
            return;
        }
        if (action === 'open-import-file') {
            e.preventDefault();
            const importInput = document.getElementById('importFileInput');
            if (importInput) importInput.click();
            return;
        }

        try {
            if (['change-month', 'add-time-slot', 'remove-time-slot'].includes(action)) {
                e.preventDefault();
                const mod = await import('./js/chunks/admin-availability-4bfwcN9b.js');
                if (action === 'change-month') mod.changeMonth(Number(actionEl.dataset.delta || 0));
                if (action === 'add-time-slot') await mod.addTimeSlot();
                if (action === 'remove-time-slot') await mod.removeTimeSlot(
                    decodeURIComponent(actionEl.dataset.date || ''),
                    decodeURIComponent(actionEl.dataset.time || '')
                );
            }
            else if (['approve-transfer', 'reject-transfer', 'cancel-appointment'].includes(action)) {
                e.preventDefault();
                const mod = await import('./js/chunks/admin-appointments-Cwn756Iy.js');
                if (action === 'approve-transfer') await mod.approveTransfer(Number(actionEl.dataset.id || 0));
                if (action === 'reject-transfer') await mod.rejectTransfer(Number(actionEl.dataset.id || 0));
                if (action === 'cancel-appointment') await mod.cancelAppointment(Number(actionEl.dataset.id || 0));
            }
            else if (action === 'mark-contacted') {
                e.preventDefault();
                const mod = await import('./js/chunks/admin-callbacks-Bvepi_wt.js');
                await mod.markContacted(
                    Number(actionEl.dataset.callbackId || 0),
                    actionEl.dataset.callbackDate || ''
                );
            }
        } catch (error) {
            showToast('Error ejecutando acción: ' + error.message, 'error');
        }
    });

    const appointmentFilter = document.getElementById('appointmentFilter');
    if (appointmentFilter) {
        appointmentFilter.addEventListener('change', async () => {
             const { filterAppointments } = await import('./js/chunks/admin-appointments-Cwn756Iy.js');
             filterAppointments();
        });
    }

    const searchInput = document.getElementById('searchAppointments');
    if (searchInput) {
        searchInput.addEventListener('input', async () => {
             const { searchAppointments } = await import('./js/chunks/admin-appointments-Cwn756Iy.js');
             searchAppointments();
        });
    }

    const callbackFilter = document.getElementById('callbackFilter');
    if (callbackFilter) {
        callbackFilter.addEventListener('change', async () => {
             const { filterCallbacks } = await import('./js/chunks/admin-callbacks-Bvepi_wt.js');
             filterCallbacks();
        });
    }
}

function exportData() {
    Promise.resolve().then(function () { return state; }).then(({ currentAppointments, currentCallbacks, currentReviews, currentAvailability }) => {
         const data = {
            appointments: currentAppointments,
            callbacks: currentCallbacks,
            reviews: currentReviews,
            availability: currentAvailability,
            exportDate: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `piel-en-armonia-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Datos exportados correctamente', 'success');
    });
}

async function importData(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    input.value = '';

    if (!confirm('Esto reemplazará TODOS los datos actuales con los del archivo seleccionado.\n\n¿Deseas continuar?')) {
        return;
    }

    try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data || typeof data !== 'object') {
            throw new Error('El archivo no contiene datos válidos');
        }

        const payload = {
            appointments: Array.isArray(data.appointments) ? data.appointments : [],
            callbacks: Array.isArray(data.callbacks) ? data.callbacks : [],
            reviews: Array.isArray(data.reviews) ? data.reviews : [],
            availability: data.availability && typeof data.availability === 'object' ? data.availability : {}
        };

        await apiRequest('import', {
            method: 'POST',
            body: payload
        });

        await refreshData();
        const activeItem = document.querySelector('.nav-item.active');
        const section = activeItem?.dataset.section || 'dashboard';
        renderSection(section);
        showToast(`Datos importados: ${payload.appointments.length} citas`, 'success');
    } catch (error) {
        showToast(`Error al importar: ${error.message}`, 'error');
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    attachGlobalListeners();

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', async function(e) {
            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
            await refreshData();
            renderSection(this.dataset.section);
        });
    });

    const importFileInput = document.getElementById('importFileInput');
    if (importFileInput) {
        importFileInput.addEventListener('change', function() {
            importData(importFileInput);
        });
    }

    window.addEventListener('online', () => {
        showToast('Conexión restaurada. Actualizando datos...', 'success');
        refreshData().then(() => {
            const activeItem = document.querySelector('.nav-item.active');
            renderSection(activeItem?.dataset.section || 'dashboard');
        });
    });

    checkAuth();
});

export { apiRequest as a, getDoctorName as b, currentAppointments as c, getPaymentMethodText as d, escapeHtml as e, formatDate as f, getServiceName as g, getPaymentStatusText as h, sanitizePublicHref as i, getStatusText as j, currentCallbacks as k, getPreferenceText as l, currentReviews as m, normalizeCallbackStatus as n, currentFunnelMetrics as o, formatCount as p, formatPercent as q, refreshData as r, showToast as s, toPositiveNumber as t, getEmptyFunnelMetrics as u, currentAvailability as v };
