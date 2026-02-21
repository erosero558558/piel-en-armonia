import { checkAuth, login, login2FA, logout } from './modules/auth.js';
import { refreshData } from './modules/data.js';
import { showToast, escapeHtml } from './modules/ui.js';
import { apiRequest } from './modules/api.js';
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
        if (section === 'dashboard') {
            const { loadDashboardData } = await import('./modules/dashboard.js');
            loadDashboardData();
        } else if (section === 'appointments') {
            const { loadAppointments } = await import('./modules/appointments.js');
            loadAppointments();
        } else if (section === 'callbacks') {
            const { loadCallbacks } = await import('./modules/callbacks.js');
            loadCallbacks();
        } else if (section === 'reviews') {
            const { loadReviews } = await import('./modules/reviews.js');
            loadReviews();
        } else if (section === 'availability') {
            const { initAvailabilityCalendar } = await import('./modules/availability.js');
            initAvailabilityCalendar();
        }
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

    const isAuthenticated = await checkAuth();
    if (isAuthenticated) {
        await showDashboard();
    } else {
        const loginScreen = document.getElementById('loginScreen');
        const dashboard = document.getElementById('adminDashboard');
        if (loginScreen) loginScreen.classList.remove('is-hidden');
        if (dashboard) dashboard.classList.add('is-hidden');
    }
});
