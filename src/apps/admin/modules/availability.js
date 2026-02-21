import { currentAvailability } from './state.js';
import { apiRequest } from './api.js';
import { escapeHtml, showToast } from './ui.js';

let selectedDate = null;
let currentMonth = new Date();

export function renderAvailabilityCalendar() {
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

export function initAvailabilityCalendar() {
    renderAvailabilityCalendar();
}

export function changeMonth(delta) {
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
    document.getElementById('addSlotForm').classList.remove('is-hidden');
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

export async function addTimeSlot() {
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

export async function removeTimeSlot(dateStr, time) {
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
