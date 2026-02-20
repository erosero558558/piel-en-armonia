(function () {
    'use strict';

    let deps = null;
    let rescheduleToken = '';
    let rescheduleAppointment = null;

    function init(inputDeps) {
        deps = inputDeps || deps;
        return window.PielRescheduleEngine;
    }

    function getLang() {
        return deps && typeof deps.getCurrentLang === 'function'
            ? deps.getCurrentLang()
            : 'es';
    }

    function t(esText, enText) {
        return getLang() === 'es' ? esText : enText;
    }

    function safe(text) {
        if (deps && typeof deps.escapeHtml === 'function') {
            return deps.escapeHtml(String(text || ''));
        }
        const div = document.createElement('div');
        div.textContent = String(text || '');
        return div.innerHTML;
    }

    function getDefaultTimeSlots() {
        if (deps && typeof deps.getDefaultTimeSlots === 'function') {
            return deps.getDefaultTimeSlots();
        }
        return ['09:00', '10:00', '11:00', '12:00', '15:00', '16:00', '17:00'];
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
                    t(
                        'Enlace de reprogramacion invalido.',
                        'Invalid reschedule link.'
                    ),
                'error'
            );
            return false;
        } catch (error) {
            notify(
                t(
                    'No se pudo cargar la cita. Verifica el enlace.',
                    'Unable to load appointment. Verify the link.'
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
                t('Paciente', 'Patient') +
                ':</strong> ' +
                safe(rescheduleAppointment.name) +
                '</p>' +
                '<p><strong>' +
                t('Servicio', 'Service') +
                ':</strong> ' +
                safe(rescheduleAppointment.service) +
                '</p>' +
                '<p><strong>' +
                t('Doctor', 'Doctor') +
                ':</strong> ' +
                safe(doctorLabel) +
                '</p>' +
                '<p><strong>' +
                t('Fecha actual', 'Current date') +
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
                t('Selecciona un horario', 'Select a time') +
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
            '<option value="">' + t('Cargando...', 'Loading...') + '</option>';

        try {
            const availability = await deps.loadAvailabilityData();
            const daySlots =
                availability[selectedDate] || getDefaultTimeSlots();
            const booked = await deps.getBookedSlots(
                selectedDate,
                rescheduleAppointment.doctor || ''
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
                t('Selecciona un horario', 'Select a time') +
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
                    t('Sin horarios disponibles', 'No slots available') +
                    '</option>';
            }
        } catch (error) {
            timeSelect.innerHTML =
                '<option value="">' +
                t('Error al cargar horarios', 'Error loading slots') +
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
            errorDiv.textContent = t(
                'Selecciona fecha y horario.',
                'Select date and time.'
            );
            errorDiv.classList.remove('is-hidden');
            return;
        }

        btn.disabled = true;
        btn.textContent = t('Reprogramando...', 'Rescheduling...');

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
                deps.invalidateBookedSlotsCache(oldDate, doctor);
                deps.invalidateBookedSlotsCache(newDate, doctor);
                closeRescheduleModal();
                notify(
                    t(
                        'Cita reprogramada exitosamente.',
                        'Appointment rescheduled successfully.'
                    ),
                    'success'
                );
            } else {
                errorDiv.textContent =
                    resp?.error ||
                    t('Error al reprogramar.', 'Error while rescheduling.');
                errorDiv.classList.remove('is-hidden');
            }
        } catch (error) {
            errorDiv.textContent = t(
                'Error de conexion. Intentalo de nuevo.',
                'Connection error. Try again.'
            );
            errorDiv.classList.remove('is-hidden');
        } finally {
            btn.disabled = false;
            btn.textContent = t(
                'Confirmar reprogramacion',
                'Confirm reschedule'
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
})();
