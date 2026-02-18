/**
 * ADMIN PANEL - Piel en Armonía
 * Server-backed admin with session auth.
 */

const AUTH_ENDPOINT = '/admin-auth.php';
const API_ENDPOINT = '/api.php';

let currentAppointments = [];
let currentCallbacks = [];
let currentReviews = [];
let currentAvailability = {};
let selectedDate = null;
let currentMonth = new Date();
let csrfToken = '';

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

function normalizeCallbackStatus(status) {
    const normalized = String(status || '').toLowerCase().trim();
    if (normalized === 'pending') return 'pendiente';
    if (normalized === 'contacted') return 'contactado';
    return normalized === 'contactado' ? 'contactado' : 'pendiente';
}

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

function getLocalData(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || 'null');
        return value === null ? fallback : value;
    } catch (error) {
        return fallback;
    }
}

function loadFallbackState() {
    currentAppointments = getLocalData('appointments', []);
    currentCallbacks = getLocalData('callbacks', []).map(c => ({
        ...c,
        status: normalizeCallbackStatus(c.status)
    }));
    currentReviews = getLocalData('reviews', []);
    currentAvailability = getLocalData('availability', {});
}

async function refreshData() {
    try {
        const payload = await apiRequest('data');
        const data = payload.data || {};
        currentAppointments = Array.isArray(data.appointments) ? data.appointments : [];
        currentCallbacks = Array.isArray(data.callbacks) ? data.callbacks.map(c => ({
            ...c,
            status: normalizeCallbackStatus(c.status)
        })) : [];
        currentReviews = Array.isArray(data.reviews) ? data.reviews : [];
        currentAvailability = data.availability && typeof data.availability === 'object' ? data.availability : {};
    } catch (error) {
        loadFallbackState();
        showToast('No se pudo conectar al backend. Usando datos locales.', 'warning');
    }
}

function showLogin() {
    const loginScreen = document.getElementById('loginScreen');
    const dashboard = document.getElementById('adminDashboard');
    if (loginScreen) loginScreen.style.display = 'flex';
    if (dashboard) dashboard.style.display = 'none';
}

async function showDashboard() {
    const loginScreen = document.getElementById('loginScreen');
    const dashboard = document.getElementById('adminDashboard');
    if (loginScreen) loginScreen.style.display = 'none';
    if (dashboard) dashboard.style.display = 'flex';
    updateDate();
    await refreshData();
    loadDashboardData();
    renderCurrentSection();
}

async function checkAuth() {
    try {
        const payload = await authRequest('status');
        if (payload.authenticated) {
            if (payload.csrfToken) csrfToken = payload.csrfToken;
            await showDashboard();
        } else {
            showLogin();
        }
    } catch (error) {
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
    if (!dateEl) return;
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateEl.textContent = new Date().toLocaleDateString('es-EC', options);
}

function getServiceName(service) {
    const names = {
        consulta: 'Consulta Dermatologica',
        telefono: 'Consulta Telefónica',
        video: 'Video Consulta',
        laser: 'Tratamiento Laser',
        rejuvenecimiento: 'Rejuvenecimiento'
    };
    return names[service] || service;
}

function getDoctorName(doctor) {
    const names = {
        rosero: 'Dr. Rosero',
        narvaez: 'Dra. Narváez',
        indiferente: 'Cualquiera'
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

function loadDashboardData() {
    document.getElementById('totalAppointments').textContent = currentAppointments.length;

    const today = new Date().toISOString().split('T')[0];
    const todayAppointments = currentAppointments.filter(a => a.date === today && a.status !== 'cancelled');
    document.getElementById('todayAppointments').textContent = todayAppointments.length;

    const pendingCallbacks = currentCallbacks.filter(c => normalizeCallbackStatus(c.status) === 'pendiente');
    document.getElementById('pendingCallbacks').textContent = pendingCallbacks.length;

    let avgRating = 0;
    if (currentReviews.length > 0) {
        avgRating = (currentReviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / currentReviews.length).toFixed(1);
    }
    document.getElementById('avgRating').textContent = avgRating;

    const pendingTransfers = currentAppointments.filter(a => a.paymentStatus === 'pending_transfer_review').length;
    const confirmedCount = currentAppointments.filter(a => (a.status || 'confirmed') === 'confirmed').length;
    document.getElementById('appointmentsBadge').textContent = pendingTransfers > 0
        ? `${confirmedCount} (${pendingTransfers} por validar)`
        : confirmedCount;
    document.getElementById('callbacksBadge').textContent = pendingCallbacks.length;
    document.getElementById('reviewsBadge').textContent = currentReviews.length;

    const todayList = document.getElementById('todayAppointmentsList');
    if (todayAppointments.length === 0) {
        todayList.innerHTML = '<p class="empty-message">No hay citas para hoy</p>';
    } else {
        todayList.innerHTML = todayAppointments.map(a => `
            <div class="upcoming-item">
                <div class="upcoming-time">
                    <span class="time">${escapeHtml(a.time)}</span>
                </div>
                <div class="upcoming-info">
                    <span class="name">${escapeHtml(a.name)}</span>
                    <span class="service">${escapeHtml(getServiceName(a.service))}</span>
                </div>
                <div class="upcoming-actions">
                    <a href="tel:${escapeHtml(a.phone)}" class="btn-icon" title="Llamar">
                        <i class="fas fa-phone"></i>
                    </a>
                    <a href="https://wa.me/${escapeHtml(String(a.phone || '').replace(/\\D/g, ''))}" target="_blank" class="btn-icon" title="WhatsApp">
                        <i class="fab fa-whatsapp"></i>
                    </a>
                </div>
            </div>
        `).join('');
    }

    const callbacksList = document.getElementById('recentCallbacksList');
    const recentCallbacks = currentCallbacks.slice(-5).reverse();
    if (recentCallbacks.length === 0) {
        callbacksList.innerHTML = '<p class="empty-message">No hay callbacks pendientes</p>';
    } else {
        callbacksList.innerHTML = recentCallbacks.map(c => `
            <div class="upcoming-item">
                <div class="upcoming-info">
                    <span class="name">${escapeHtml(c.telefono)}</span>
                    <span class="service">${escapeHtml(getPreferenceText(c.preferencia))}</span>
                </div>
                <div class="upcoming-actions">
                    <a href="tel:${escapeHtml(c.telefono)}" class="btn-icon" title="Llamar">
                        <i class="fas fa-phone"></i>
                    </a>
                </div>
            </div>
        `).join('');
    }
}

function renderCurrentSection() {
    const activeItem = document.querySelector('.nav-item.active');
    const section = activeItem?.dataset.section || 'dashboard';
    if (section === 'appointments') loadAppointments();
    if (section === 'callbacks') loadCallbacks();
    if (section === 'reviews') loadReviews();
    if (section === 'availability') initAvailabilityCalendar();
}

function loadAppointments() {
    renderAppointments(currentAppointments);
}

function renderAppointments(appointments) {
    const tbody = document.getElementById('appointmentsTableBody');
    if (!tbody) return;

    if (appointments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-message">No hay citas registradas</td></tr>';
        return;
    }

    const sorted = [...appointments].sort((a, b) => {
        const dateA = (a.date || '') + ' ' + (a.time || '');
        const dateB = (b.date || '') + ' ' + (b.time || '');
        return dateB.localeCompare(dateA);
    });

    tbody.innerHTML = sorted.map(a => `
        <tr>
            <td>
                <strong>${escapeHtml(a.name)}</strong><br>
                <small>${escapeHtml(a.email)}</small>
            </td>
            <td>${escapeHtml(getServiceName(a.service))}</td>
            <td>${escapeHtml(getDoctorName(a.doctor))}${a.doctorAssigned ? '<br><small>Asignado: ' + escapeHtml(getDoctorName(a.doctorAssigned)) + '</small>' : ''}</td>
            <td>${escapeHtml(formatDate(a.date))}</td>
            <td>${escapeHtml(a.time)}</td>
            <td>
                <strong>${escapeHtml(a.price || '$0.00')}</strong><br>
                <small>${escapeHtml(getPaymentMethodText(a.paymentMethod))} - ${escapeHtml(getPaymentStatusText(a.paymentStatus))}</small>
                ${(a.transferReference ? `<br><small>Ref: ${escapeHtml(a.transferReference)}</small>` : '')}
                ${(sanitizePublicHref(a.transferProofUrl) ? `<br><a href="${escapeHtml(sanitizePublicHref(a.transferProofUrl))}" target="_blank" rel="noopener noreferrer">Ver comprobante</a>` : '')}
            </td>
            <td>
                <span class="status-badge status-${escapeHtml(a.status || 'confirmed')}">
                    ${escapeHtml(getStatusText(a.status || 'confirmed'))}
                </span>
            </td>
            <td>
                <div class="table-actions">
                    ${(a.paymentStatus === 'pending_transfer_review' ? `
                    <button type="button" class="btn-icon success" data-action="approve-transfer" data-id="${Number(a.id) || 0}" title="Aprobar transferencia">
                        <i class="fas fa-check"></i>
                    </button>
                    <button type="button" class="btn-icon danger" data-action="reject-transfer" data-id="${Number(a.id) || 0}" title="Rechazar transferencia">
                        <i class="fas fa-ban"></i>
                    </button>
                    ` : '')}
                    <a href="tel:${escapeHtml(a.phone)}" class="btn-icon" title="Llamar">
                        <i class="fas fa-phone"></i>
                    </a>
                    <a href="https://wa.me/${escapeHtml(String(a.phone || '').replace(/\\D/g, ''))}" target="_blank" class="btn-icon" title="WhatsApp">
                        <i class="fab fa-whatsapp"></i>
                    </a>
                    <button type="button" class="btn-icon danger" data-action="cancel-appointment" data-id="${Number(a.id) || 0}" title="Cancelar">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function getWeekRange() {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
    };
}

function filterAppointments() {
    const filter = document.getElementById('appointmentFilter').value;
    let filtered = [...currentAppointments];

    const today = new Date().toISOString().split('T')[0];
    const currentWeek = getWeekRange();
    const currentMonthNumber = new Date().getMonth();

    switch (filter) {
        case 'today':
            filtered = filtered.filter(a => a.date === today);
            break;
        case 'week':
            filtered = filtered.filter(a => a.date >= currentWeek.start && a.date <= currentWeek.end);
            break;
        case 'month':
            filtered = filtered.filter(a => new Date(a.date).getMonth() === currentMonthNumber);
            break;
        case 'confirmed':
        case 'cancelled':
            filtered = filtered.filter(a => (a.status || 'confirmed') === filter);
            break;
        case 'pending_transfer':
            filtered = filtered.filter(a => a.paymentStatus === 'pending_transfer_review');
            break;
        default:
            break;
    }

    renderAppointments(filtered);
}

function searchAppointments() {
    const search = document.getElementById('searchAppointments').value.toLowerCase();
    const filtered = currentAppointments.filter(a =>
        String(a.name || '').toLowerCase().includes(search) ||
        String(a.email || '').toLowerCase().includes(search) ||
        String(a.phone || '').includes(search)
    );
    renderAppointments(filtered);
}

async function cancelAppointment(id) {
    if (!confirm('¿Estas seguro de cancelar esta cita?')) return;
    if (!id) {
        showToast('Id de cita invalido', 'error');
        return;
    }
    try {
        await apiRequest('appointments', {
            method: 'PATCH',
            body: { id: id, status: 'cancelled' }
        });
        await refreshData();
        loadAppointments();
        loadDashboardData();
        showToast('Cita cancelada correctamente', 'success');
    } catch (error) {
        showToast(`No se pudo cancelar la cita: ${error.message}`, 'error');
    }
}

async function approveTransfer(id) {
    if (!confirm('¿Aprobar el comprobante de transferencia de esta cita?')) return;
    if (!id) { showToast('Id de cita invalido', 'error'); return; }
    try {
        await apiRequest('appointments', {
            method: 'PATCH',
            body: { id: id, paymentStatus: 'paid', paymentPaidAt: new Date().toISOString() }
        });
        await refreshData();
        loadAppointments();
        loadDashboardData();
        showToast('Transferencia aprobada', 'success');
    } catch (error) {
        showToast(`No se pudo aprobar: ${error.message}`, 'error');
    }
}

async function rejectTransfer(id) {
    if (!confirm('¿Rechazar el comprobante de transferencia? La cita quedará como pago fallido.')) return;
    if (!id) { showToast('Id de cita invalido', 'error'); return; }
    try {
        await apiRequest('appointments', {
            method: 'PATCH',
            body: { id: id, paymentStatus: 'failed' }
        });
        await refreshData();
        loadAppointments();
        loadDashboardData();
        showToast('Transferencia rechazada', 'warning');
    } catch (error) {
        showToast(`No se pudo rechazar: ${error.message}`, 'error');
    }
}

function loadCallbacks() {
    renderCallbacks(currentCallbacks);
}

function renderCallbacks(callbacks) {
    const grid = document.getElementById('callbacksGrid');
    if (!grid) return;

    if (callbacks.length === 0) {
        grid.innerHTML = '<p class="empty-message">No hay callbacks registrados</p>';
        return;
    }

    grid.innerHTML = callbacks.map(c => {
        const status = normalizeCallbackStatus(c.status);
        const callbackId = Number(c.id) || 0;
        const callbackDateKey = encodeURIComponent(String(c.fecha || ''));
        return `
            <div class="callback-card ${status}">
                <div class="callback-header">
                    <span class="callback-phone">${escapeHtml(c.telefono)}</span>
                    <span class="status-badge status-${status}">
                        ${status === 'pendiente' ? 'Pendiente' : 'Contactado'}
                    </span>
                </div>
                <span class="callback-preference">
                    <i class="fas fa-clock"></i>
                    ${escapeHtml(getPreferenceText(c.preferencia))}
                </span>
                <p class="callback-time">
                    <i class="fas fa-calendar"></i>
                    ${escapeHtml(new Date(c.fecha).toLocaleString('es-EC'))}
                </p>
                <div class="callback-actions">
                    <a href="tel:${escapeHtml(c.telefono)}" class="btn btn-phone btn-sm">
                        <i class="fas fa-phone"></i>
                        Llamar
                    </a>
                    ${status === 'pendiente' ? `
                        <button type="button" class="btn btn-primary btn-sm" data-action="mark-contacted" data-callback-id="${callbackId}" data-callback-date="${callbackDateKey}">
                            <i class="fas fa-check"></i>
                            Marcar contactado
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function filterCallbacks() {
    const filter = document.getElementById('callbackFilter').value;
    let callbacks = [...currentCallbacks];

    if (filter === 'pending') {
        callbacks = callbacks.filter(c => normalizeCallbackStatus(c.status) === 'pendiente');
    } else if (filter === 'contacted') {
        callbacks = callbacks.filter(c => normalizeCallbackStatus(c.status) === 'contactado');
    }

    renderCallbacks(callbacks);
}

async function markContacted(callbackId, callbackDate = '') {
    let callback = null;
    const normalizedId = Number(callbackId);
    if (normalizedId > 0) {
        callback = currentCallbacks.find(c => Number(c.id) === normalizedId);
    }

    const decodedDate = callbackDate ? decodeURIComponent(callbackDate) : '';
    if (!callback && decodedDate) {
        callback = currentCallbacks.find(c => c.fecha === decodedDate);
    }

    if (!callback) {
        showToast('Callback no encontrado', 'error');
        return;
    }

    try {
        const callbackId = callback.id || Date.now();
        if (!callback.id) {
            callback.id = callbackId;
        }
        await apiRequest('callbacks', {
            method: 'PATCH',
            body: { id: Number(callbackId), status: 'contactado' }
        });
        await refreshData();
        loadCallbacks();
        loadDashboardData();
        showToast('Marcado como contactado', 'success');
    } catch (error) {
        showToast(`No se pudo actualizar callback: ${error.message}`, 'error');
    }
}

function loadReviews() {
    const avgRating = currentReviews.length > 0
        ? (currentReviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / currentReviews.length).toFixed(1)
        : '0.0';

    document.getElementById('adminAvgRating').textContent = avgRating;
    document.getElementById('totalReviewsCount').textContent = `${currentReviews.length} reseñas`;

    const starsContainer = document.getElementById('adminRatingStars');
    const fullStars = Math.floor(Number(avgRating));
    starsContainer.innerHTML = '';
    for (let i = 1; i <= 5; i += 1) {
        const star = document.createElement('i');
        star.className = i <= fullStars ? 'fas fa-star' : 'far fa-star';
        starsContainer.appendChild(star);
    }

    const grid = document.getElementById('reviewsGrid');
    if (currentReviews.length === 0) {
        grid.innerHTML = '<p class="empty-message">No hay reseñas registradas</p>';
        return;
    }

    grid.innerHTML = currentReviews
        .slice()
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
        .map(r => `
            <div class="review-card-admin">
                <div class="review-header-admin">
                    <strong>${escapeHtml(r.name || 'Paciente')}</strong>
                    ${r.verified ? '<i class="fas fa-check-circle verified" style="color: var(--color-phone); margin-left: auto;"></i>' : ''}
                </div>
                <div class="review-rating">${'★'.repeat(Number(r.rating) || 0)}${'☆'.repeat(5 - (Number(r.rating) || 0))}</div>
                <p>${escapeHtml(r.text || '')}</p>
                <small>${escapeHtml(new Date(r.date).toLocaleDateString('es-EC'))}</small>
            </div>
        `).join('');
}

function initAvailabilityCalendar() {
    renderAvailabilityCalendar();
}

function renderAvailabilityCalendar() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    document.getElementById('calendarMonth').textContent = new Date(year, month).toLocaleDateString('es-EC', {
        month: 'long',
        year: 'numeric'
    });

    const calendar = document.getElementById('availabilityCalendar');
    calendar.innerHTML = '';

    const weekDays = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    weekDays.forEach(day => {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day-header';
        dayEl.textContent = day;
        calendar.appendChild(dayEl);
    });

    for (let i = firstDay - 1; i >= 0; i -= 1) {
        const day = daysInPrevMonth - i;
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day other-month';
        dayEl.textContent = day;
        calendar.appendChild(dayEl);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(year, month, day);
        const dateStr = date.toISOString().split('T')[0];
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.textContent = day;

        if (selectedDate === dateStr) dayEl.classList.add('selected');
        if (currentAvailability[dateStr] && currentAvailability[dateStr].length > 0) dayEl.classList.add('has-slots');

        dayEl.addEventListener('click', () => selectDate(dateStr));
        calendar.appendChild(dayEl);
    }

    const rendered = firstDay + daysInMonth;
    const remaining = 42 - rendered;
    for (let day = 1; day <= remaining; day += 1) {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day other-month';
        dayEl.textContent = day;
        calendar.appendChild(dayEl);
    }
}

function changeMonth(delta) {
    currentMonth.setMonth(currentMonth.getMonth() + delta);
    renderAvailabilityCalendar();
}

function selectDate(dateStr) {
    selectedDate = dateStr;
    renderAvailabilityCalendar();
    const date = new Date(dateStr);
    document.getElementById('selectedDate').textContent = date.toLocaleDateString('es-EC', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
    document.getElementById('addSlotForm').style.display = 'block';
    loadTimeSlots(dateStr);
}

function loadTimeSlots(dateStr) {
    const slots = currentAvailability[dateStr] || [];
    const list = document.getElementById('timeSlotsList');
    if (slots.length === 0) {
        list.innerHTML = '<p class="empty-message">No hay horarios configurados</p>';
        return;
    }

    const encodedDate = encodeURIComponent(String(dateStr || ''));

    list.innerHTML = slots.slice().sort().map(time => `
        <div class="time-slot-item">
            <span class="time">${escapeHtml(time)}</span>
            <div class="slot-actions">
                <button type="button" class="btn-icon danger" data-action="remove-time-slot" data-date="${encodedDate}" data-time="${encodeURIComponent(String(time || ''))}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

async function saveAvailability() {
    await apiRequest('availability', {
        method: 'POST',
        body: { availability: currentAvailability }
    });
}

async function addTimeSlot() {
    if (!selectedDate) {
        showToast('Selecciona una fecha primero', 'warning');
        return;
    }
    const time = document.getElementById('newSlotTime').value;
    if (!time) {
        showToast('Ingresa un horario', 'warning');
        return;
    }

    if (!currentAvailability[selectedDate]) {
        currentAvailability[selectedDate] = [];
    }

    if (currentAvailability[selectedDate].includes(time)) {
        showToast('Este horario ya existe', 'warning');
        return;
    }

    try {
        currentAvailability[selectedDate].push(time);
        await saveAvailability();
        loadTimeSlots(selectedDate);
        renderAvailabilityCalendar();
        document.getElementById('newSlotTime').value = '';
        showToast('Horario agregado', 'success');
    } catch (error) {
        showToast(`No se pudo guardar el horario: ${error.message}`, 'error');
    }
}

async function removeTimeSlot(dateStr, time) {
    try {
        currentAvailability[dateStr] = (currentAvailability[dateStr] || []).filter(t => t !== time);
        await saveAvailability();
        loadTimeSlots(dateStr);
        renderAvailabilityCalendar();
        showToast('Horario eliminado', 'success');
    } catch (error) {
        showToast(`No se pudo eliminar el horario: ${error.message}`, 'error');
    }
}

function exportData() {
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
}

async function importData(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    input.value = '';

    if (!confirm('Esto reemplazara TODOS los datos actuales (citas, callbacks, resenas y disponibilidad) con los del archivo seleccionado.\n\n¿Deseas continuar?')) {
        return;
    }

    try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data || typeof data !== 'object') {
            throw new Error('El archivo no contiene datos validos');
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
        renderSection(activeItem?.dataset.section || 'dashboard');
        showToast(`Datos importados: ${payload.appointments.length} citas, ${payload.callbacks.length} callbacks, ${payload.reviews.length} resenas`, 'success');
    } catch (error) {
        showToast(`Error al importar: ${error.message}`, 'error');
    }
}

function renderSection(section) {
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

    if (section === 'dashboard') loadDashboardData();
    if (section === 'appointments') loadAppointments();
    if (section === 'callbacks') loadCallbacks();
    if (section === 'reviews') loadReviews();
    if (section === 'availability') initAvailabilityCalendar();
}

document.addEventListener('DOMContentLoaded', function() {
    document.addEventListener('click', async function(e) {
        const actionEl = e.target.closest('[data-action]');
        if (!actionEl) return;

        const action = actionEl.dataset.action;
        switch (action) {
            case 'close-toast': {
                const toast = actionEl.closest('.toast');
                if (toast) toast.remove();
                break;
            }
            case 'logout':
                e.preventDefault();
                await logout();
                break;
            case 'export-data':
                e.preventDefault();
                exportData();
                break;
            case 'open-import-file': {
                e.preventDefault();
                const importInput = document.getElementById('importFileInput');
                if (importInput) importInput.click();
                break;
            }
            case 'change-month':
                e.preventDefault();
                changeMonth(Number(actionEl.dataset.delta || 0));
                break;
            case 'add-time-slot':
                e.preventDefault();
                await addTimeSlot();
                break;
            case 'approve-transfer':
                e.preventDefault();
                await approveTransfer(Number(actionEl.dataset.id || 0));
                break;
            case 'reject-transfer':
                e.preventDefault();
                await rejectTransfer(Number(actionEl.dataset.id || 0));
                break;
            case 'cancel-appointment':
                e.preventDefault();
                await cancelAppointment(Number(actionEl.dataset.id || 0));
                break;
            case 'mark-contacted':
                e.preventDefault();
                await markContacted(
                    Number(actionEl.dataset.callbackId || 0),
                    actionEl.dataset.callbackDate || ''
                );
                break;
            case 'remove-time-slot':
                e.preventDefault();
                await removeTimeSlot(
                    decodeURIComponent(actionEl.dataset.date || ''),
                    decodeURIComponent(actionEl.dataset.time || '')
                );
                break;
            default:
                break;
        }
    });

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const password = document.getElementById('adminPassword').value;
            try {
                const loginResult = await authRequest('login', {
                    method: 'POST',
                    body: { password: password }
                });
                if (loginResult.csrfToken) csrfToken = loginResult.csrfToken;
                showToast('Bienvenido al panel de administracion', 'success');
                await showDashboard();
            } catch (error) {
                showToast('Contraseña incorrecta', 'error');
            }
        });
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

    const appointmentFilter = document.getElementById('appointmentFilter');
    if (appointmentFilter) {
        appointmentFilter.addEventListener('change', filterAppointments);
    }

    const searchInput = document.getElementById('searchAppointments');
    if (searchInput) {
        searchInput.addEventListener('input', searchAppointments);
    }

    const callbackFilter = document.getElementById('callbackFilter');
    if (callbackFilter) {
        callbackFilter.addEventListener('change', filterCallbacks);
    }

    const importFileInput = document.getElementById('importFileInput');
    if (importFileInput) {
        importFileInput.addEventListener('change', function() {
            importData(importFileInput);
        });
    }

    checkAuth();
});
