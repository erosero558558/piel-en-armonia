/**
 * Booking Utilities Bundle
 * Contains: Reschedule Engine, Payment Gateway Logic
 */

// --- Reschedule Engine ---
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
        return deps && typeof deps.getCurrentLang === 'function' ? deps.getCurrentLang() : 'es';
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
            const resp = await deps.apiRequest('reschedule', { query: { token: token } });
            if ((resp && (resp.ok === undefined || resp.ok)) && resp.data) {
                rescheduleAppointment = resp.data;
                openRescheduleModal(resp.data);
                return true;
            }
            notify(resp?.error || t('Enlace de reprogramacion invalido.', 'Invalid reschedule link.'), 'error');
            return false;
        } catch (error) {
            notify(t('No se pudo cargar la cita. Verifica el enlace.', 'Unable to load appointment. Verify the link.'), 'error');
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
            const doctorLabel = doctorValue === 'rosero'
                ? 'Dr. Javier Rosero'
                : doctorValue === 'narvaez'
                    ? 'Dra. Carolina Narvaez'
                    : doctorValue === 'indiferente'
                        ? 'Cualquiera disponible'
                        : doctorValue;

            info.innerHTML =
                '<p><strong>' + t('Paciente', 'Patient') + ':</strong> ' + safe(rescheduleAppointment.name) + '</p>' +
                '<p><strong>' + t('Servicio', 'Service') + ':</strong> ' + safe(rescheduleAppointment.service) + '</p>' +
                '<p><strong>' + t('Doctor', 'Doctor') + ':</strong> ' + safe(doctorLabel) + '</p>' +
                '<p><strong>' + t('Fecha actual', 'Current date') + ':</strong> ' + safe(rescheduleAppointment.date) + ' ' + safe(rescheduleAppointment.time) + '</p>';
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
            timeSelect.innerHTML = '<option value="">' + t('Selecciona un horario', 'Select a time') + '</option>';
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

        timeSelect.innerHTML = '<option value="">' + t('Cargando...', 'Loading...') + '</option>';

        try {
            const availability = await deps.loadAvailabilityData();
            const daySlots = availability[selectedDate] || getDefaultTimeSlots();
            const booked = await deps.getBookedSlots(selectedDate, rescheduleAppointment.doctor || '');
            const isToday = selectedDate === new Date().toISOString().split('T')[0];
            const nowMinutes = isToday ? new Date().getHours() * 60 + new Date().getMinutes() : -1;
            const freeSlots = daySlots.filter((slot) => {
                if (booked.includes(slot)) return false;
                if (isToday) {
                    const [h, m] = slot.split(':').map(Number);
                    if (h * 60 + m <= nowMinutes + 60) return false;
                }
                return true;
            });

            timeSelect.innerHTML = '<option value="">' + t('Selecciona un horario', 'Select a time') + '</option>';
            freeSlots.forEach((slot) => {
                const opt = document.createElement('option');
                opt.value = slot;
                opt.textContent = slot;
                timeSelect.appendChild(opt);
            });

            if (freeSlots.length === 0) {
                timeSelect.innerHTML = '<option value="">' + t('Sin horarios disponibles', 'No slots available') + '</option>';
            }
        } catch (error) {
            timeSelect.innerHTML = '<option value="">' + t('Error al cargar horarios', 'Error loading slots') + '</option>';
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
            errorDiv.textContent = t('Selecciona fecha y horario.', 'Select date and time.');
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
                    time: newTime
                }
            });

            if (resp && (resp.ok === undefined || resp.ok)) {
                const oldDate = rescheduleAppointment?.date || '';
                const doctor = rescheduleAppointment?.doctor || '';
                deps.invalidateBookedSlotsCache(oldDate, doctor);
                deps.invalidateBookedSlotsCache(newDate, doctor);
                closeRescheduleModal();
                notify(t('Cita reprogramada exitosamente.', 'Appointment rescheduled successfully.'), 'success');
            } else {
                errorDiv.textContent = resp?.error || t('Error al reprogramar.', 'Error while rescheduling.');
                errorDiv.classList.remove('is-hidden');
            }
        } catch (error) {
            errorDiv.textContent = t('Error de conexion. Intentalo de nuevo.', 'Connection error. Try again.');
            errorDiv.classList.remove('is-hidden');
        } finally {
            btn.disabled = false;
            btn.textContent = t('Confirmar reprogramacion', 'Confirm reschedule');
        }
    }

    function initRescheduleFromParam() {
        return checkRescheduleParam();
    }

    window.PielRescheduleEngine = {
        init,
        checkRescheduleParam,
        openRescheduleModal,
        closeRescheduleModal,
        loadRescheduleSlots,
        submitReschedule,
        initRescheduleFromParam
    };
})();

// --- Payment Gateway Engine ---
(function () {
    'use strict';

    let deps = null;
    let paymentConfig = { enabled: false, provider: 'stripe', publishableKey: '', currency: 'USD' };
    let paymentConfigLoaded = false;
    let paymentConfigLoadedAt = 0;
    let stripeSdkPromise = null;

    function init(inputDeps) {
        deps = inputDeps || {};
        // Initialize state if passed in deps
        if (deps.getPaymentConfigLoaded && deps.getPaymentConfigLoaded()) {
             paymentConfig = deps.getPaymentConfig();
             paymentConfigLoaded = true;
             paymentConfigLoadedAt = deps.getPaymentConfigLoadedAt();
        }
        if (deps.getStripeSdkPromise) {
            stripeSdkPromise = deps.getStripeSdkPromise();
        }
        return window.PielPaymentGatewayEngine;
    }

    function getApiRequest() {
        if (deps && typeof deps.apiRequest === 'function') {
            return deps.apiRequest;
        }
        throw new Error('PaymentGatewayEngine dependency missing: apiRequest');
    }

    async function loadPaymentConfig() {
        const now = Date.now();
        // Check local state first
        if (paymentConfigLoaded && (now - paymentConfigLoadedAt) < 5 * 60 * 1000) {
            return paymentConfig;
        }

        // Check global state if provided
        if (deps && typeof deps.getPaymentConfigLoaded === 'function' && deps.getPaymentConfigLoaded()) {
             const loadedAt = deps.getPaymentConfigLoadedAt();
             if ((now - loadedAt) < 5 * 60 * 1000) {
                 paymentConfig = deps.getPaymentConfig();
                 paymentConfigLoaded = true;
                 paymentConfigLoadedAt = loadedAt;
                 return paymentConfig;
             }
        }

        try {
            const payload = await getApiRequest()('payment-config');
            paymentConfig = {
                enabled: payload.enabled === true,
                provider: payload.provider || 'stripe',
                publishableKey: payload.publishableKey || '',
                currency: payload.currency || 'USD'
            };
        } catch (_) {
            paymentConfig = { enabled: false, provider: 'stripe', publishableKey: '', currency: 'USD' };
        }

        paymentConfigLoaded = true;
        paymentConfigLoadedAt = now;

        // Update global state if provided
        if (deps && typeof deps.setPaymentConfig === 'function') {
            deps.setPaymentConfig(paymentConfig);
            deps.setPaymentConfigLoaded(true);
            deps.setPaymentConfigLoadedAt(now);
        }

        return paymentConfig;
    }

    async function loadStripeSdk() {
        if (typeof window.Stripe === 'function') {
            return true;
        }

        if (stripeSdkPromise) {
            return stripeSdkPromise;
        }

        if (deps && typeof deps.getStripeSdkPromise === 'function' && deps.getStripeSdkPromise()) {
            stripeSdkPromise = deps.getStripeSdkPromise();
            return stripeSdkPromise;
        }

        stripeSdkPromise = new Promise((resolve, reject) => {
            const existingScript = document.querySelector('script[data-stripe-sdk="true"]');
            if (existingScript) {
                existingScript.addEventListener('load', () => resolve(true), { once: true });
                existingScript.addEventListener('error', () => reject(new Error('No se pudo cargar Stripe SDK')), { once: true });
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://js.stripe.com/v3/';
            script.async = true;
            script.defer = true;
            script.dataset.stripeSdk = 'true';
            script.onload = () => resolve(true);
            script.onerror = () => reject(new Error('No se pudo cargar Stripe SDK'));
            document.head.appendChild(script);
        }).catch((error) => {
            stripeSdkPromise = null;
            if (deps && typeof deps.setStripeSdkPromise === 'function') {
                deps.setStripeSdkPromise(null);
            }
            throw error;
        });

        if (deps && typeof deps.setStripeSdkPromise === 'function') {
            deps.setStripeSdkPromise(stripeSdkPromise);
        }

        return stripeSdkPromise;
    }

    async function createPaymentIntent(appointment) {
        return getApiRequest()('payment-intent', {
            method: 'POST',
            body: appointment
        });
    }

    async function verifyPaymentIntent(paymentIntentId) {
        return getApiRequest()('payment-verify', {
            method: 'POST',
            body: { paymentIntentId }
        });
    }

    async function uploadTransferProof(file) {
        const formData = new FormData();
        formData.append('proof', file);

        const query = new URLSearchParams({ resource: 'transfer-proof' });
        const controller = new AbortController();
        const timeoutMs = (deps && deps.apiRequestTimeoutMs) || 9000;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const apiEndpoint = (deps && deps.apiEndpoint) || '/api.php';

        let response;
        let text = '';
        try {
            response = await fetch(`${apiEndpoint}?${query.toString()}`, {
                method: 'POST',
                credentials: 'same-origin',
                body: formData,
                signal: controller.signal
            });
            text = await response.text();
        } catch (error) {
            if (error && error.name === 'AbortError') {
                const lang = deps && typeof deps.getCurrentLang === 'function' ? deps.getCurrentLang() : 'es';
                throw new Error(
                    lang === 'es'
                        ? 'Tiempo de espera agotado al subir el comprobante'
                        : 'Upload timed out while sending proof file'
                );
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }

        let payload = {};
        try {
            payload = text ? JSON.parse(text) : {};
        } catch (error) {
            throw new Error('No se pudo interpretar la respuesta de subida');
        }

        if (!response.ok || payload.ok === false) {
            throw new Error(payload.error || `HTTP ${response.status}`);
        }

        return payload.data || {};
    }

    window.PielPaymentGatewayEngine = {
        init,
        loadPaymentConfig,
        loadStripeSdk,
        createPaymentIntent,
        verifyPaymentIntent,
        uploadTransferProof
    };
})();

// --- Booking Calendar Engine ---
(function () {
    'use strict';

    function initCalendar() {
        if (window.debugLog) {
            window.debugLog('Booking calendar module loaded lazy.');
        }
    }

    async function updateAvailableTimes(deps, elements) {
        const { dateInput, timeSelect, doctorSelect, t } = elements;

        const selectedDate = dateInput ? dateInput.value : '';
        if (!selectedDate || !timeSelect) return;

        const selectedDoctor = doctorSelect ? doctorSelect.value : '';
        const availability = await deps.loadAvailabilityData();
        const bookedSlots = await deps.getBookedSlots(selectedDate, selectedDoctor);
        const availableSlots = availability[selectedDate] || deps.getDefaultTimeSlots();
        const isToday = selectedDate === new Date().toISOString().split('T')[0];
        const nowMinutes = isToday ? new Date().getHours() * 60 + new Date().getMinutes() : -1;
        const freeSlots = availableSlots.filter((slot) => {
            if (bookedSlots.includes(slot)) return false;
            if (isToday) {
                const [h, m] = slot.split(':').map(Number);
                if (h * 60 + m <= nowMinutes + 60) return false;
            }
            return true;
        });

        const currentValue = timeSelect.value;
        timeSelect.innerHTML = '<option value="">Hora</option>';

        if (freeSlots.length === 0) {
            timeSelect.innerHTML += '<option value="" disabled>No hay horarios disponibles</option>';
            deps.showToast(t('No hay horarios disponibles para esta fecha', 'No slots available for this date'), 'warning');
            return;
        }

        freeSlots.forEach((time) => {
            const option = document.createElement('option');
            option.value = time;
            option.textContent = time;
            if (time === currentValue) option.selected = true;
            timeSelect.appendChild(option);
        });
    }

    window.PielBookingCalendarEngine = {
        initCalendar,
        updateAvailableTimes
    };
})();
