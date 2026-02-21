import { login, login2FA } from './modules/auth.js';
import { showToast, normalizeCallbackStatus } from './modules/ui.js';
import {
    currentAppointments,
    currentCallbacks,
    currentReviews,
    currentAvailability,
    currentFunnelMetrics,
    csrfToken,
    setAppointments,
    setCallbacks,
    setReviews,
    setAvailability,
    setFunnelMetrics,
    setCsrfToken,
    getEmptyFunnelMetrics
} from './modules/state.js';
import { apiRequest, authRequest } from './modules/api.js';
import { loadDashboardData } from './modules/dashboard.js';
import { loadAppointments } from './modules/appointments.js';
import { loadCallbacks } from './modules/callbacks.js';
import { loadReviews } from './modules/reviews.js';
import { initAvailabilityCalendar } from './modules/availability.js';

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

    switch (section) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'appointments':
            loadAppointments();
            break;
        case 'callbacks':
            loadCallbacks();
            break;
        case 'reviews':
            loadReviews();
            break;
        case 'availability':
            initAvailabilityCalendar();
            break;
        default:
            loadDashboardData();
            break;
    }
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

        const apps = Array.isArray(data.appointments) ? data.appointments : [];
        setAppointments(apps);

        const cbs = Array.isArray(data.callbacks) ? data.callbacks.map(c => ({
            ...c,
            status: normalizeCallbackStatus(c.status)
        })) : [];
        setCallbacks(cbs);

        const revs = Array.isArray(data.reviews) ? data.reviews : [];
        setReviews(revs);

        const avail = data.availability && typeof data.availability === 'object' ? data.availability : {};
        setAvailability(avail);

        if (funnelPayload && funnelPayload.data && typeof funnelPayload.data === 'object') {
            setFunnelMetrics(funnelPayload.data);
        } else {
            setFunnelMetrics(getEmptyFunnelMetrics());
        }

        saveLocalData('appointments', apps);
        saveLocalData('callbacks', cbs);
        saveLocalData('reviews', revs);
        saveLocalData('availability', avail);
    } catch (error) {
        showToast('Error cargando módulo: ' + error.message, 'error');
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
                const passGroup = document.getElementById('passwordGroup');
                if (passGroup) passGroup.classList.add('is-hidden');

                if (group2FA) group2FA.classList.remove('is-hidden');

                const codeInput = document.getElementById('admin2FACode');
                if (codeInput) codeInput.focus();

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

async function showDashboard() {
    const loginScreen = document.getElementById('loginScreen');
    const dashboard = document.getElementById('adminDashboard');
    if (loginScreen) loginScreen.classList.add('is-hidden');
    if (dashboard) dashboard.classList.remove('is-hidden');

    // Initial load
    await refreshData();
    renderSection('dashboard');
}

async function checkAuth() {
    try {
        if (!navigator.onLine) {
            const cached = getLocalData('appointments', null);
            if (cached) {
                loadFallbackState();
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
            loadFallbackState();
            showToast('Error de conexión. Mostrando datos locales.', 'warning');
            await showDashboard();
            return;
        }
        showLogin();
        showToast('No se pudo verificar la sesion', 'warning');
    }
}

function showLogin() {
    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) loginScreen.classList.remove('is-hidden');
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

async function updateDate() {
    const dateEl = document.getElementById('currentDate');
    if (dateEl) {
         const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
         dateEl.textContent = new Date().toLocaleDateString('es-EC', options);
    }

    await refreshData();
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
