/**
 * ADMIN PANEL - Piel en Armonía
 * Panel de administración para gestionar citas, callbacks y reseñas
 */

// ========================================
// CONFIGURACIÓN
// ========================================
const ADMIN_PASSWORD = 'admin123'; // En producción, usar hash

// ========================================
// TOAST NOTIFICATIONS
// ========================================
function showToast(message, type = 'info', title = '') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };
    
    const titles = {
        success: title || 'Éxito',
        error: title || 'Error',
        warning: title || 'Advertencia',
        info: title || 'Información'
    };
    
    toast.innerHTML = `
        <i class="fas ${icons[type]} toast-icon"></i>
        <div class="toast-content">
            <div class="toast-title">${titles[type]}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
        <div class="toast-progress"></div>
    `;
    
    container.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

// ========================================
// AUTHENTICATION
// ========================================
function checkAuth() {
    const isLoggedIn = sessionStorage.getItem('adminLoggedIn');
    if (isLoggedIn === 'true') {
        showDashboard();
    } else {
        showLogin();
    }
}

function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('adminDashboard').style.display = 'none';
}

function showDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'flex';
    updateDate();
    loadDashboardData();
}

function logout() {
    sessionStorage.removeItem('adminLoggedIn');
    showToast('Sesión cerrada correctamente', 'info');
    setTimeout(() => {
        location.reload();
    }, 1000);
}

// Login form
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const password = document.getElementById('adminPassword').value;
            
            if (password === ADMIN_PASSWORD) {
                sessionStorage.setItem('adminLoggedIn', 'true');
                showToast('Bienvenido al panel de administración', 'success');
                showDashboard();
            } else {
                showToast('Contraseña incorrecta', 'error');
            }
        });
    }
    
    checkAuth();
});

// ========================================
// NAVIGATION
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.dataset.section;
            
            // Update active nav
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
            
            // Show section
            document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
            document.getElementById(section).classList.add('active');
            
            // Update title
            const titles = {
                dashboard: 'Dashboard',
                appointments: 'Citas',
                callbacks: 'Callbacks',
                reviews: 'Reseñas',
                availability: 'Disponibilidad'
            };
            document.getElementById('pageTitle').textContent = titles[section];
            
            // Load section data
            if (section === 'appointments') loadAppointments();
            if (section === 'callbacks') loadCallbacks();
            if (section === 'reviews') loadReviews();
            if (section === 'availability') initAvailabilityCalendar();
        });
    });
});

// ========================================
// DASHBOARD
// ========================================
function updateDate() {
    const dateEl = document.getElementById('currentDate');
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateEl.textContent = new Date().toLocaleDateString('es-EC', options);
}

function loadDashboardData() {
    const appointments = JSON.parse(localStorage.getItem('appointments') || '[]');
    const callbacks = JSON.parse(localStorage.getItem('callbacks') || '[]');
    const reviews = JSON.parse(localStorage.getItem('reviews') || '[]');
    
    // Total appointments
    document.getElementById('totalAppointments').textContent = appointments.length;
    
    // Today's appointments
    const today = new Date().toISOString().split('T')[0];
    const todayAppointments = appointments.filter(a => a.date === today && a.status !== 'cancelled');
    document.getElementById('todayAppointments').textContent = todayAppointments.length;
    
    // Pending callbacks
    const pendingCallbacks = callbacks.filter(c => c.status === 'pendiente');
    document.getElementById('pendingCallbacks').textContent = pendingCallbacks.length;
    
    // Average rating
    let avgRating = 0;
    if (reviews.length > 0) {
        avgRating = (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1);
    }
    document.getElementById('avgRating').textContent = avgRating;
    
    // Update badges
    document.getElementById('appointmentsBadge').textContent = appointments.filter(a => a.status === 'confirmed').length;
    document.getElementById('callbacksBadge').textContent = pendingCallbacks.length;
    document.getElementById('reviewsBadge').textContent = reviews.length;
    
    // Load today's appointments list
    const todayList = document.getElementById('todayAppointmentsList');
    if (todayAppointments.length === 0) {
        todayList.innerHTML = '<p class="empty-message">No hay citas para hoy</p>';
    } else {
        todayList.innerHTML = todayAppointments.map(a => `
            <div class="upcoming-item">
                <div class="upcoming-time">
                    <span class="time">${a.time}</span>
                </div>
                <div class="upcoming-info">
                    <span class="name">${a.name}</span>
                    <span class="service">${getServiceName(a.service)}</span>
                </div>
                <div class="upcoming-actions">
                    <a href="tel:${a.phone}" class="btn-icon" title="Llamar">
                        <i class="fas fa-phone"></i>
                    </a>
                    <a href="https://wa.me/${a.phone.replace(/\D/g, '')}" target="_blank" class="btn-icon" title="WhatsApp">
                        <i class="fab fa-whatsapp"></i>
                    </a>
                </div>
            </div>
        `).join('');
    }
    
    // Load recent callbacks
    const callbacksList = document.getElementById('recentCallbacksList');
    const recentCallbacks = callbacks.slice(-5).reverse();
    if (recentCallbacks.length === 0) {
        callbacksList.innerHTML = '<p class="empty-message">No hay callbacks pendientes</p>';
    } else {
        callbacksList.innerHTML = recentCallbacks.map(c => `
            <div class="upcoming-item">
                <div class="upcoming-info">
                    <span class="name">${c.telefono}</span>
                    <span class="service">${getPreferenceText(c.preferencia)}</span>
                </div>
                <div class="upcoming-actions">
                    <a href="tel:${c.telefono}" class="btn-icon" title="Llamar">
                        <i class="fas fa-phone"></i>
                    </a>
                </div>
            </div>
        `).join('');
    }
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

function getPreferenceText(pref) {
    const texts = {
        ahora: 'Lo antes posible',
        '15min': 'En 15 minutos',
        '30min': 'En 30 minutos',
        '1hora': 'En 1 hora'
    };
    return texts[pref] || pref;
}

// ========================================
// APPOINTMENTS
// ========================================
let currentAppointments = [];

function loadAppointments() {
    currentAppointments = JSON.parse(localStorage.getItem('appointments') || '[]');
    renderAppointments(currentAppointments);
}

function renderAppointments(appointments) {
    const tbody = document.getElementById('appointmentsTableBody');
    
    if (appointments.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-message">No hay citas registradas</td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = appointments.map(a => `
        <tr>
            <td>
                <strong>${a.name}</strong><br>
                <small>${a.email}</small>
            </td>
            <td>${getServiceName(a.service)}</td>
            <td>${getDoctorName(a.doctor)}</td>
            <td>${formatDate(a.date)}</td>
            <td>${a.time}</td>
            <td>${a.price}</td>
            <td>
                <span class="status-badge status-${a.status || 'confirmed'}">
                    ${getStatusText(a.status || 'confirmed')}
                </span>
            </td>
            <td>
                <div class="table-actions">
                    <a href="tel:${a.phone}" class="btn-icon" title="Llamar">
                        <i class="fas fa-phone"></i>
                    </a>
                    <a href="https://wa.me/${a.phone.replace(/\D/g, '')}" target="_blank" class="btn-icon" title="WhatsApp">
                        <i class="fab fa-whatsapp"></i>
                    </a>
                    <button class="btn-icon danger" onclick="cancelAppointment(${a.id})" title="Cancelar">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
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

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' });
}

function filterAppointments() {
    const filter = document.getElementById('appointmentFilter').value;
    let filtered = [...currentAppointments];
    
    const today = new Date().toISOString().split('T')[0];
    const currentWeek = getWeekRange();
    const currentMonth = new Date().getMonth();
    
    switch(filter) {
        case 'today':
            filtered = filtered.filter(a => a.date === today);
            break;
        case 'week':
            filtered = filtered.filter(a => a.date >= currentWeek.start && a.date <= currentWeek.end);
            break;
        case 'month':
            filtered = filtered.filter(a => new Date(a.date).getMonth() === currentMonth);
            break;
        case 'confirmed':
        case 'cancelled':
            filtered = filtered.filter(a => (a.status || 'confirmed') === filter);
            break;
    }
    
    renderAppointments(filtered);
}

function getWeekRange() {
    const now = new Date();
    const start = new Date(now.setDate(now.getDate() - now.getDay()));
    const end = new Date(now.setDate(now.getDate() + 6));
    return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
    };
}

function searchAppointments() {
    const search = document.getElementById('searchAppointments').value.toLowerCase();
    const filtered = currentAppointments.filter(a => 
        a.name.toLowerCase().includes(search) ||
        a.email.toLowerCase().includes(search) ||
        a.phone.includes(search)
    );
    renderAppointments(filtered);
}

function cancelAppointment(id) {
    if (!confirm('¿Estás seguro de cancelar esta cita?')) return;
    
    let appointments = JSON.parse(localStorage.getItem('appointments') || '[]');
    const index = appointments.findIndex(a => a.id === id);
    
    if (index !== -1) {
        appointments[index].status = 'cancelled';
        localStorage.setItem('appointments', JSON.stringify(appointments));
        showToast('Cita cancelada correctamente', 'success');
        loadAppointments();
        loadDashboardData();
    }
}

// ========================================
// CALLBACKS
// ========================================
function loadCallbacks() {
    const callbacks = JSON.parse(localStorage.getItem('callbacks') || '[]');
    renderCallbacks(callbacks);
}

function renderCallbacks(callbacks) {
    const grid = document.getElementById('callbacksGrid');
    
    if (callbacks.length === 0) {
        grid.innerHTML = '<p class="empty-message">No hay callbacks registrados</p>';
        return;
    }
    
    grid.innerHTML = callbacks.map(c => `
        <div class="callback-card ${c.status}">
            <div class="callback-header">
                <span class="callback-phone">${c.telefono}</span>
                <span class="status-badge status-${c.status}">
                    ${c.status === 'pendiente' ? 'Pendiente' : 'Contactado'}
                </span>
            </div>
            <span class="callback-preference">
                <i class="fas fa-clock"></i>
                ${getPreferenceText(c.preferencia)}
            </span>
            <p class="callback-time">
                <i class="fas fa-calendar"></i>
                ${new Date(c.fecha).toLocaleString('es-EC')}
            </p>
            <div class="callback-actions">
                <a href="tel:${c.telefono}" class="btn btn-phone btn-sm">
                    <i class="fas fa-phone"></i>
                    Llamar
                </a>
                ${c.status === 'pendiente' ? `
                    <button class="btn btn-primary btn-sm" onclick="markContacted('${c.fecha}')">
                        <i class="fas fa-check"></i>
                        Marcar contactado
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

function filterCallbacks() {
    const filter = document.getElementById('callbackFilter').value;
    let callbacks = JSON.parse(localStorage.getItem('callbacks') || '[]');
    
    if (filter !== 'all') {
        callbacks = callbacks.filter(c => c.status === filter);
    }
    
    renderCallbacks(callbacks);
}

function markContacted(fecha) {
    let callbacks = JSON.parse(localStorage.getItem('callbacks') || '[]');
    const callback = callbacks.find(c => c.fecha === fecha);
    
    if (callback) {
        callback.status = 'contactado';
        localStorage.setItem('callbacks', JSON.stringify(callbacks));
        showToast('Marcado como contactado', 'success');
        loadCallbacks();
        loadDashboardData();
    }
}

// ========================================
// REVIEWS
// ========================================
function loadReviews() {
    const reviews = JSON.parse(localStorage.getItem('reviews') || '[]');
    
    // Update stats
    const avgRating = reviews.length > 0 
        ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
        : '0.0';
    
    document.getElementById('adminAvgRating').textContent = avgRating;
    document.getElementById('totalReviewsCount').textContent = `${reviews.length} reseñas`;
    
    // Update stars
    const starsContainer = document.getElementById('adminRatingStars');
    const fullStars = Math.floor(avgRating);
    const hasHalf = avgRating % 1 >= 0.5;
    
    let starsHtml = '';
    for (let i = 0; i < 5; i++) {
        if (i < fullStars) {
            starsHtml += '<i class="fas fa-star"></i>';
        } else if (i === fullStars && hasHalf) {
            starsHtml += '<i class="fas fa-star-half-alt"></i>';
        } else {
            starsHtml += '<i class="far fa-star"></i>';
        }
    }
    starsContainer.innerHTML = starsHtml;
    
    // Render reviews
    const grid = document.getElementById('reviewsGrid');
    if (reviews.length === 0) {
        grid.innerHTML = '<p class="empty-message">No hay reseñas registradas</p>';
        return;
    }
    
    grid.innerHTML = reviews.map(r => `
        <div class="review-card-admin">
            <div class="review-header">
                <div class="review-avatar">${r.name.split(' ').map(n => n[0]).join('').toUpperCase()}</div>
                <div>
                    <div style="font-weight: 600;">${r.name}</div>
                    <div class="review-stars" style="color: #ffb800; font-size: 0.8rem;">
                        ${Array(5).fill(0).map((_, i) => 
                            `<i class="${i < r.rating ? 'fas' : 'far'} fa-star"></i>`
                        ).join('')}
                    </div>
                </div>
                ${r.verified ? '<i class="fas fa-check-circle verified" style="color: var(--color-phone); margin-left: auto;"></i>' : ''}
            </div>
            <p class="review-text">${r.text}</p>
            <span class="review-date-admin">${new Date(r.date).toLocaleDateString('es-EC')}</span>
        </div>
    `).join('');
}

// ========================================
// AVAILABILITY CALENDAR
// ========================================
let currentMonth = new Date();
let selectedDate = null;

function initAvailabilityCalendar() {
    renderAvailabilityCalendar();
}

function renderAvailabilityCalendar() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // Update header
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    document.getElementById('calendarMonth').textContent = `${monthNames[month]} ${year}`;
    
    // Get availability data
    const availability = JSON.parse(localStorage.getItem('availability') || '{}');
    
    // Generate calendar
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    const calendar = document.getElementById('availabilityCalendar');
    let html = '';
    
    // Day headers
    const dayHeaders = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    dayHeaders.forEach(day => {
        html += `<div class="calendar-day-header">${day}</div>`;
    });
    
    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
        html += `<div class="calendar-day other-month">${daysInPrevMonth - i}</div>`;
    }
    
    // Current month days
    const today = new Date().toISOString().split('T')[0];
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === today;
        const isSelected = dateStr === selectedDate;
        const hasSlots = availability[dateStr] && availability[dateStr].length > 0;
        
        html += `
            <div class="calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${hasSlots ? 'has-slots' : ''}"
                 onclick="selectDate('${dateStr}')"
                 style="position: relative;">
                ${day}
            </div>
        `;
    }
    
    // Next month days
    const remainingDays = 42 - (firstDay + daysInMonth);
    for (let day = 1; day <= remainingDays; day++) {
        html += `<div class="calendar-day other-month">${day}</div>`;
    }
    
    calendar.innerHTML = html;
}

function changeMonth(delta) {
    currentMonth.setMonth(currentMonth.getMonth() + delta);
    renderAvailabilityCalendar();
}

function selectDate(dateStr) {
    selectedDate = dateStr;
    renderAvailabilityCalendar();
    
    // Update selected date display
    const date = new Date(dateStr);
    document.getElementById('selectedDate').textContent = date.toLocaleDateString('es-EC', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // Show add slot form
    document.getElementById('addSlotForm').style.display = 'block';
    
    // Load time slots
    loadTimeSlots(dateStr);
}

function loadTimeSlots(dateStr) {
    const availability = JSON.parse(localStorage.getItem('availability') || '{}');
    const slots = availability[dateStr] || [];
    
    const list = document.getElementById('timeSlotsList');
    if (slots.length === 0) {
        list.innerHTML = '<p class="empty-message">No hay horarios configurados</p>';
        return;
    }
    
    list.innerHTML = slots.sort().map(time => `
        <div class="time-slot-item">
            <span class="time">${time}</span>
            <div class="slot-actions">
                <button class="btn-icon danger" onclick="removeTimeSlot('${dateStr}', '${time}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function addTimeSlot() {
    if (!selectedDate) {
        showToast('Selecciona una fecha primero', 'warning');
        return;
    }
    
    const time = document.getElementById('newSlotTime').value;
    if (!time) {
        showToast('Ingresa un horario', 'warning');
        return;
    }
    
    const availability = JSON.parse(localStorage.getItem('availability') || '{}');
    if (!availability[selectedDate]) {
        availability[selectedDate] = [];
    }
    
    if (!availability[selectedDate].includes(time)) {
        availability[selectedDate].push(time);
        localStorage.setItem('availability', JSON.stringify(availability));
        showToast('Horario agregado', 'success');
        document.getElementById('newSlotTime').value = '';
        loadTimeSlots(selectedDate);
        renderAvailabilityCalendar();
    } else {
        showToast('Este horario ya existe', 'warning');
    }
}

function removeTimeSlot(dateStr, time) {
    const availability = JSON.parse(localStorage.getItem('availability') || '{}');
    availability[dateStr] = availability[dateStr].filter(t => t !== time);
    localStorage.setItem('availability', JSON.stringify(availability));
    showToast('Horario eliminado', 'success');
    loadTimeSlots(dateStr);
    renderAvailabilityCalendar();
}

// ========================================
// EXPORT DATA
// ========================================
function exportData() {
    const data = {
        appointments: JSON.parse(localStorage.getItem('appointments') || '[]'),
        callbacks: JSON.parse(localStorage.getItem('callbacks') || '[]'),
        reviews: JSON.parse(localStorage.getItem('reviews') || '[]'),
        availability: JSON.parse(localStorage.getItem('availability') || '{}'),
        exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' };
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

// ========================================
// CONFIGURACIÓN DEL CHATBOT
// ========================================
function toggleAIMode() {
    const currentMode = localStorage.getItem('forceAI') === 'true';
    const newMode = !currentMode;
    localStorage.setItem('forceAI', newMode.toString());
    
    if (newMode) {
        showToast('Modo IA real ACTIVADO. El chatbot intentará usar Kimi API.', 'info');
    } else {
        showToast('Modo IA real DESACTIVADO. Usando respuestas locales.', 'info');
    }
}

// ========================================
// INITIALIZE
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Panel de Administración - Piel en Armonía');
    console.log('📊 Contraseña: admin123');
});
