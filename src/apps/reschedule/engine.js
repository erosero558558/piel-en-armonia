'use strict';

let deps = null;
let rescheduleToken = '';
let rescheduleAppointment = null;

function init(inputDeps) {
    deps = inputDeps || deps;
    return window.PielRescheduleEngine;
}

function translate(key, fallback) {
    if (deps && typeof deps.translate === 'function') {
        return deps.translate(key, fallback);
    }
    return fallback || key;
}

function safe(text) {
    if (deps && typeof deps.escapeHtml === 'function') {
        return deps.escapeHtml(String(text || ''));
    }
    const div = document.createElement('div');
    div.textContent = String(text || '');
    return div.innerHTML;
}

function notify(message, type) {
    if (deps && typeof deps.showToast === 'function') {
        deps.showToast(message, type || 'info');
    }
}

async function checkRescheduleParam() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('reschedule');
    if (!token) {
        return false;
    }

    rescheduleToken = token;

    try {
        const resp = await deps.apiRequest('reschedule', {
            query: { token: token },
        });
        if (resp && (resp.ok === undefined || resp.ok) && resp.data) {
            rescheduleAppointment = resp.data;
            openRescheduleModal(resp.data);
            return true;
        }
        notify(
            resp?.error ||
                translate(
                    'reschedule_invalid_link',
                    'Enlace de reprogramacion invalido.'
                ),
            'error'
        );
        return false;
    } catch {
        notify(
            translate(
                'reschedule_load_error',
                'No se pudo cargar la cita. Verifica el enlace.'
            ),
            'error'
        );
        return false;
    }
}

function openRescheduleModal(appt) {
    const modal = document.getElementById('rescheduleModal');
    if (!modal) return;

    if (appt) {
        rescheduleAppointment = appt;
    }

    const info = document.getElementById('rescheduleInfo');
    if (info && rescheduleAppointment) {
        const doctorValue = String(rescheduleAppointment.doctor || '');
        const doctorLabel =
            doctorValue === 'rosero'
                ? 'Dr. Javier Rosero'
                : doctorValue === 'narvaez'
                  ? 'Dra. Carolina Narvaez'
                  : doctorValue === 'indiferente'
                    ? 'Cualquiera disponible'
                    : doctorValue;

        info.innerHTML =
            '<p><strong>' +
            translate('label_patient', 'Paciente') +
            ':</strong> ' +
            safe(rescheduleAppointment.name) +
            '</p>' +
            '<p><strong>' +
            translate('label_service', 'Servicio') +
            ':</strong> ' +
            safe(rescheduleAppointment.service) +
            '</p>' +
            '<p><strong>' +
            translate('label_doctor', 'Doctor') +
            ':</strong> ' +
            safe(doctorLabel) +
            '</p>' +
            '<p><strong>' +
            translate('label_current_date', 'Fecha actual') +
            ':</strong> ' +
            safe(rescheduleAppointment.date) +
            ' ' +
            safe(rescheduleAppointment.time) +
            '</p>';
    }

    const dateInput = document.getElementById('rescheduleDate');
    if (dateInput) {
        dateInput.min = new Date().toISOString().split('T')[0];
        dateInput.value = '';
        dateInput.removeEventListener('change', loadRescheduleSlots);
        dateInput.addEventListener('change', loadRescheduleSlots);
    }

    const timeSelect = document.getElementById('rescheduleTime');
    if (timeSelect) {
        timeSelect.innerHTML =
            '<option value="">' +
            translate('reschedule_select_time', 'Selecciona un horario') +
            '</option>';
    }

    const errorDiv = document.getElementById('rescheduleError');
    if (errorDiv) {
        errorDiv.classList.add('is-hidden');
    }

    modal.classList.add('active');
}

function closeRescheduleModal() {
    const modal = document.getElementById('rescheduleModal');
    if (modal) {
        modal.classList.remove('active');
    }

    if (window.history.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.delete('reschedule');
        window.history.replaceState({}, '', url.toString());
    }
}

async function loadRescheduleSlots() {
    const dateInput = document.getElementById('rescheduleDate');
    const timeSelect = document.getElementById('rescheduleTime');
    if (!dateInput || !timeSelect || !rescheduleAppointment) {
        return;
    }

    const selectedDate = dateInput.value;
    if (!selectedDate) {
        return;
    }

    timeSelect.innerHTML =
        '<option value="">' + translate('loading', 'Cargando...') + '</option>';

    try {
        const service = String(rescheduleAppointment.service || 'consulta');
        const availability = await deps.loadAvailabilityData({
            doctor: String(rescheduleAppointment.doctor || 'indiferente'),
            service,
            strict: true,
        });
        const daySlots = availability[selectedDate] || [];
        const booked = await deps.getBookedSlots(
            selectedDate,
            rescheduleAppointment.doctor || '',
            service
        );
        const isToday =
            selectedDate === new Date().toISOString().split('T')[0];
        const nowMinutes = isToday
            ? new Date().getHours() * 60 + new Date().getMinutes()
            : -1;
        const freeSlots = daySlots.filter((slot) => {
            if (booked.includes(slot)) return false;
            if (isToday) {
                const [h, m] = slot.split(':').map(Number);
                if (h * 60 + m <= nowMinutes + 60) return false;
            }
            return true;
        });

        timeSelect.innerHTML =
            '<option value="">' +
            translate('reschedule_select_time', 'Selecciona un horario') +
            '</option>';
        freeSlots.forEach((slot) => {
            const opt = document.createElement('option');
            opt.value = slot;
            opt.textContent = slot;
            timeSelect.appendChild(opt);
        });

        if (freeSlots.length === 0) {
            timeSelect.innerHTML =
                '<option value="">' +
                translate('reschedule_no_slots', 'Sin horarios disponibles') +
                '</option>';
        }
    } catch (error) {
        const isCalendarUnavailable =
            error &&
            (error.code === 'calendar_unreachable' ||
                String(error.message || '')
                    .toLowerCase()
                    .includes('calendar_unreachable'));
        timeSelect.innerHTML =
            '<option value="">' +
            (isCalendarUnavailable
                ? translate('reschedule_calendar_unavailable', 'Agenda temporalmente no disponible')
                : translate('reschedule_slots_error', 'Error al cargar horarios')) +
            '</option>';
    }
}

async function submitReschedule() {
    const dateInput = document.getElementById('rescheduleDate');
    const timeSelect = document.getElementById('rescheduleTime');
    const errorDiv = document.getElementById('rescheduleError');
    const btn = document.getElementById('rescheduleSubmitBtn');
    if (!dateInput || !timeSelect || !errorDiv || !btn) {
        return;
    }

    const newDate = dateInput.value;
    const newTime = timeSelect.value;

    errorDiv.classList.add('is-hidden');

    if (!newDate || !newTime) {
        errorDiv.textContent = translate(
            'reschedule_select_date_time',
            'Selecciona fecha y horario.'
        );
        errorDiv.classList.remove('is-hidden');
        return;
    }

    btn.disabled = true;
    btn.textContent = translate('reschedule_processing', 'Reprogramando...');

    try {
        const resp = await deps.apiRequest('reschedule', {
            method: 'PATCH',
            body: {
                token: rescheduleToken,
                date: newDate,
                time: newTime,
            },
        });

        if (resp && (resp.ok === undefined || resp.ok)) {
            const oldDate = rescheduleAppointment?.date || '';
            const doctor = rescheduleAppointment?.doctor || '';
            const service = String(rescheduleAppointment?.service || 'consulta');
            deps.invalidateBookedSlotsCache(oldDate, doctor, service);
            deps.invalidateBookedSlotsCache(newDate, doctor, service);
            closeRescheduleModal();
            notify(
                translate(
                    'reschedule_success',
                    'Cita reprogramada exitosamente.'
                ),
                'success'
            );
        } else {
            errorDiv.textContent =
                resp?.error ||
                translate('reschedule_error', 'Error al reprogramar.');
            errorDiv.classList.remove('is-hidden');
        }
    } catch {
        errorDiv.textContent = translate(
            'error_connection',
            'Error de conexion. Intentalo de nuevo.'
        );
        errorDiv.classList.remove('is-hidden');
    } finally {
        btn.disabled = false;
        btn.textContent = translate(
            'reschedule_confirm',
            'Confirmar reprogramacion'
        );
    }
}

window.PielRescheduleEngine = {
    init,
    checkRescheduleParam,
    openRescheduleModal,
    closeRescheduleModal,
    loadRescheduleSlots,
    submitReschedule,
};
