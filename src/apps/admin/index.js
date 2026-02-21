import { checkAuth, login, login2FA, logout } from './modules/auth.js';
import { refreshData } from './modules/data.js';
import { showToast, escapeHtml } from './modules/ui.js';
import { setCsrfToken } from './modules/state.js';

async function renderSection(section) {
    const titles = {
        dashboard: 'Dashboard',
        appointments: 'Citas',
        callbacks: 'Callbacks',
        reviews: 'Reseñas',
        availability: 'Disponibilidad'
    };
    document.getElementById('pageTitle').textContent = titles[section] || 'Dashboard';

    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    const sectionEl = document.getElementById(section);
    if (sectionEl) sectionEl.classList.add('active');

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

// apiRequest was redeclared here. Removing it.

async function authRequest(action, options = {}) {
    return requestJson(`${AUTH_ENDPOINT}?action=${encodeURIComponent(action)}`, options);
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

function normalizeFunnelRows(rows) {
    if (!Array.isArray(rows)) {
        return [];
    }
    return rows
        .map((row) => ({
            label: String(row && row.label ? row.label : 'unknown'),
            count: toPositiveNumber(row && row.count ? row.count : 0)
        }))
        .filter((row) => row.count > 0)
        .sort((a, b) => b.count - a.count);
}

function formatFunnelStepLabel(label) {
    const raw = String(label || '').trim().toLowerCase();
    const labels = {
        service_selected: 'Servicio seleccionado',
        doctor_selected: 'Doctor seleccionado',
        date_selected: 'Fecha seleccionada',
        time_selected: 'Hora seleccionada',
        name_added: 'Nombre ingresado',
        email_added: 'Email ingresado',
        phone_added: 'Telefono ingresado',
        contact_info_completed: 'Datos de contacto completados',
        clinical_context_added: 'Contexto clinico agregado',
        privacy_consent_checked: 'Consentimiento de privacidad',
        form_submitted: 'Formulario enviado',
        chat_booking_started: 'Reserva iniciada en chat',
        payment_modal_open: 'Modal de pago abierto',
        payment_modal_closed: 'Modal de pago cerrado',
        payment_processing: 'Pago en proceso',
        payment_error: 'Error de pago',
        patient_data: 'Datos del paciente',
        reason: 'Motivo de consulta',
        photos: 'Fotos clinicas',
        slot: 'Fecha y hora',
        payment: 'Metodo de pago',
        confirmation: 'Confirmacion',
        payment_method_selected: 'Metodo de pago',
        unknown: 'Paso no identificado'
    };

    if (labels[raw]) {
        return labels[raw];
    }

    const prettified = raw.replace(/_/g, ' ').trim();
    if (prettified === '') {
        return labels.unknown;
    }
    return prettified.charAt(0).toUpperCase() + prettified.slice(1);
}

function formatFunnelEntryLabel(label) {
    const raw = String(label || '').trim().toLowerCase();
    const labels = {
        booking_form: 'Formulario web',
        chatbot: 'Chatbot',
        unknown: 'No identificado'
    };
    if (labels[raw]) {
        return labels[raw];
    }
    const prettified = raw.replace(/_/g, ' ').trim();
    if (prettified === '') {
        return labels.unknown;
    }
    return prettified.charAt(0).toUpperCase() + prettified.slice(1);
}

function formatPaymentMethodLabel(label) {
    const raw = String(label || '').trim().toLowerCase();
    const labels = {
        card: 'Tarjeta',
        transfer: 'Transferencia',
        cash: 'Efectivo',
        unpaid: 'Sin definir',
        unknown: 'No identificado'
    };
    if (labels[raw]) {
        return labels[raw];
    }
    const prettified = raw.replace(/_/g, ' ').trim();
    if (prettified === '') {
        return labels.unknown;
    }
    return prettified.charAt(0).toUpperCase() + prettified.slice(1);
}

function renderFunnelList(elementId, rows, formatLabel, emptyMessage) {
    const listEl = document.getElementById(elementId);
    if (!listEl) {
        return;
    }

    const safeRows = normalizeFunnelRows(rows).slice(0, 6);
    if (safeRows.length === 0) {
        listEl.innerHTML = `<p class="empty-message">${escapeHtml(emptyMessage)}</p>`;
        return;
    }

    const total = safeRows.reduce((sum, row) => sum + row.count, 0);
    listEl.innerHTML = safeRows.map((row) => {
        const sharePct = total > 0 ? formatPercent((row.count / total) * 100) : '0%';
        return `
            <div class="funnel-row">
                <span class="funnel-row-label">${escapeHtml(formatLabel(row.label))}</span>
                <span class="funnel-row-count">${escapeHtml(formatCount(row.count))} (${escapeHtml(sharePct)})</span>
            </div>
        `;
    }).join('');
}

function renderFunnelMetrics() {
    const metrics = currentFunnelMetrics && typeof currentFunnelMetrics === 'object'
        ? currentFunnelMetrics
        : getEmptyFunnelMetrics();
    const summary = metrics.summary && typeof metrics.summary === 'object'
        ? metrics.summary
        : {};

    const viewBooking = toPositiveNumber(summary.viewBooking);
    const startCheckout = toPositiveNumber(summary.startCheckout);
    const bookingConfirmed = toPositiveNumber(summary.bookingConfirmed);
    const checkoutAbandon = toPositiveNumber(summary.checkoutAbandon);
    const startRatePct = toPositiveNumber(summary.startRatePct) || (viewBooking > 0 ? (startCheckout / viewBooking) * 100 : 0);
    const confirmedRatePct = toPositiveNumber(summary.confirmedRatePct) || (startCheckout > 0 ? (bookingConfirmed / startCheckout) * 100 : 0);
    const abandonRatePct = toPositiveNumber(summary.abandonRatePct) || (startCheckout > 0 ? (checkoutAbandon / startCheckout) * 100 : 0);

    const viewBookingEl = document.getElementById('funnelViewBooking');
    if (viewBookingEl) viewBookingEl.textContent = formatCount(viewBooking);

    const startCheckoutEl = document.getElementById('funnelStartCheckout');
    if (startCheckoutEl) startCheckoutEl.textContent = formatCount(startCheckout);

    const bookingConfirmedEl = document.getElementById('funnelBookingConfirmed');
    if (bookingConfirmedEl) bookingConfirmedEl.textContent = formatCount(bookingConfirmed);

    const funnelAbandonRateEl = document.getElementById('funnelAbandonRate');
    if (funnelAbandonRateEl) funnelAbandonRateEl.textContent = formatPercent(abandonRatePct);

    const checkoutConversionRateEl = document.getElementById('checkoutConversionRate');
    if (checkoutConversionRateEl) checkoutConversionRateEl.textContent = formatPercent(confirmedRatePct);

    const funnelAbandonListEl = document.getElementById('funnelAbandonList');
    if (!funnelAbandonListEl) {
        return;
    }

    renderFunnelList(
        'funnelAbandonList',
        metrics.checkoutAbandonByStep,
        formatFunnelStepLabel,
        'Sin datos de abandono'
    );
    renderFunnelList(
        'funnelEntryList',
        metrics.checkoutEntryBreakdown,
        formatFunnelEntryLabel,
        'Sin datos de entrada'
    );
    renderFunnelList(
        'funnelPaymentMethodList',
        metrics.paymentMethodBreakdown,
        formatPaymentMethodLabel,
        'Sin datos de pago'
    );
}

function loadFallbackState() {
    currentAppointments = getLocalData('appointments', []);
    currentCallbacks = getLocalData('callbacks', []).map(c => ({
        ...c,
        status: normalizeCallbackStatus(c.status)
    }));
    currentReviews = getLocalData('reviews', []);
    currentAvailability = getLocalData('availability', {});
    currentFunnelMetrics = getEmptyFunnelMetrics();
}

async function refreshData() {
    try {
        const [payload, funnelPayload] = await Promise.all([
            apiRequest('data'),
            apiRequest('funnel-metrics').catch(() => null)
        ]);

        const data = payload.data || {};
        currentAppointments = Array.isArray(data.appointments) ? data.appointments : [];
        currentCallbacks = Array.isArray(data.callbacks) ? data.callbacks.map(c => ({
            ...c,
            status: normalizeCallbackStatus(c.status)
        })) : [];
        currentReviews = Array.isArray(data.reviews) ? data.reviews : [];
        currentAvailability = data.availability && typeof data.availability === 'object' ? data.availability : {};

        if (funnelPayload && funnelPayload.data && typeof funnelPayload.data === 'object') {
            currentFunnelMetrics = funnelPayload.data;
        } else {
            currentFunnelMetrics = getEmptyFunnelMetrics();
        }

        saveLocalData('appointments', currentAppointments);
        saveLocalData('callbacks', currentCallbacks);
        saveLocalData('reviews', currentReviews);
        saveLocalData('availability', currentAvailability);
    } catch (error) {
        showToast('Error cargando módulo: ' + error.message, 'error');
    }
}

async function handleLogin(e) {
    e.preventDefault();

    const is2FAMode = !document.getElementById('group2FA').classList.contains('is-hidden');

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
                document.getElementById('group2FA').classList.remove('is-hidden');
                document.getElementById('admin2FACode').focus();
                const btn = document.getElementById('loginBtn');
                btn.innerHTML = '<i class="fas fa-check"></i> Verificar';
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

async function showDashboard() {
    const loginScreen = document.getElementById('loginScreen');
    const dashboard = document.getElementById('adminDashboard');
    if (loginScreen) loginScreen.classList.add('is-hidden');
    if (dashboard) dashboard.classList.remove('is-hidden');

async function checkAuth() {
    try {
        if (!navigator.onLine) {
            const cached = getLocalData('appointments', null);
            if (cached) {
                showToast('Modo Offline: Mostrando datos locales', 'info');
                await showDashboard();
                return;
            }
        }

        const payload = await authRequest('status');
        if (payload.authenticated) {
            if (payload.csrfToken) csrfToken = payload.csrfToken;
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
    try {
        await authRequest('logout', { method: 'POST' });
    } catch (error) {
        // Continue with local logout UI.
    }
    showToast('Sesion cerrada correctamente', 'info');
    setTimeout(() => window.location.reload(), 800);
}

function updateDate() {
    const dateEl = document.getElementById('currentDate');
    if (dateEl) {
         const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
         dateEl.textContent = new Date().toLocaleDateString('es-EC', options);
    }

    await refreshData();
    // Default to dashboard or current section
    const activeItem = document.querySelector('.nav-item.active');
    const section = activeItem?.dataset.section || 'dashboard';
    renderSection(section);
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
                const mod = await import('./modules/availability.js');
                if (action === 'change-month') mod.changeMonth(Number(actionEl.dataset.delta || 0));
                if (action === 'add-time-slot') await mod.addTimeSlot();
                if (action === 'remove-time-slot') await mod.removeTimeSlot(
                    decodeURIComponent(actionEl.dataset.date || ''),
                    decodeURIComponent(actionEl.dataset.time || '')
                );
            }
            else if (['approve-transfer', 'reject-transfer', 'cancel-appointment'].includes(action)) {
                e.preventDefault();
                const mod = await import('./modules/appointments.js');
                if (action === 'approve-transfer') await mod.approveTransfer(Number(actionEl.dataset.id || 0));
                if (action === 'reject-transfer') await mod.rejectTransfer(Number(actionEl.dataset.id || 0));
                if (action === 'cancel-appointment') await mod.cancelAppointment(Number(actionEl.dataset.id || 0));
            }
            else if (action === 'mark-contacted') {
                e.preventDefault();
                const mod = await import('./modules/callbacks.js');
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
             const { filterAppointments } = await import('./modules/appointments.js');
             filterAppointments();
        });
    }

    const searchInput = document.getElementById('searchAppointments');
    if (searchInput) {
        searchInput.addEventListener('input', async () => {
             const { searchAppointments } = await import('./modules/appointments.js');
             searchAppointments();
        });
    }

    const callbackFilter = document.getElementById('callbackFilter');
    if (callbackFilter) {
        callbackFilter.addEventListener('change', async () => {
             const { filterCallbacks } = await import('./modules/callbacks.js');
             filterCallbacks();
        });
    }
}

function exportData() {
    import('./modules/state.js').then(({ currentAppointments, currentCallbacks, currentReviews, currentAvailability }) => {
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
