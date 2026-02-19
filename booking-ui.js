(function () {
    'use strict';

    let deps = null;
    let initialized = false;

    function getLang() {
        return deps && typeof deps.getCurrentLang === 'function' ? deps.getCurrentLang() : 'es';
    }

    function t(esText, enText) {
        return getLang() === 'es' ? esText : enText;
    }

    function normalizeEcuadorPhone(rawValue) {
        const raw = String(rawValue || '').trim();
        if (raw === '') return '';

        const digits = raw.replace(/\D/g, '');

        if (digits.startsWith('593') && digits.length >= 12) {
            return `+${digits}`;
        }

        if (digits.startsWith('09') && digits.length === 10) {
            return `+593${digits.slice(1)}`;
        }

        if (digits.startsWith('9') && digits.length === 9) {
            return `+593${digits}`;
        }

        if (raw.startsWith('+')) {
            return `+${raw.slice(1).replace(/\D/g, '')}`;
        }

        return raw;
    }

    function init(inputDeps) {
        deps = inputDeps || deps;
        if (initialized) {
            return window.PielBookingUi;
        }

        const serviceSelect = document.getElementById('serviceSelect');
        const priceSummary = document.getElementById('priceSummary');
        const subtotalEl = document.getElementById('subtotalPrice');
        const ivaEl = document.getElementById('ivaPrice');
        const totalEl = document.getElementById('totalPrice');
        const dateInput = document.querySelector('input[name="date"]');
        const timeSelect = document.querySelector('select[name="time"]');
        const doctorSelect = document.querySelector('select[name="doctor"]');
        const phoneInput = document.querySelector('input[name="phone"]');
        const appointmentForm = document.getElementById('appointmentForm');

        if (!serviceSelect || !priceSummary || !subtotalEl || !ivaEl || !totalEl || !appointmentForm) {
            return window.PielBookingUi;
        }

        initialized = true;
        const completedSteps = new Set();

        function trackBookingStep(step, payload = {}, options = {}) {
            if (!deps || typeof deps.trackEvent !== 'function' || !step) {
                return;
            }

            const once = options && options.once !== false;
            if (once && completedSteps.has(step)) {
                return;
            }

            if (once) {
                completedSteps.add(step);
            }

            deps.trackEvent('booking_step_completed', {
                step,
                source: 'booking_form',
                ...payload
            });
        }

        async function updateAvailableTimes() {
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

        serviceSelect.addEventListener('change', function () {
            const selected = this.options[this.selectedIndex];
            const price = parseFloat(selected.dataset.price) || 0;
            const serviceValue = String(this.value || '').trim();

            if (price > 0) {
                const iva = price * 0.15;
                const total = price + iva;
                subtotalEl.textContent = `$${price.toFixed(2)}`;
                ivaEl.textContent = `$${iva.toFixed(2)}`;
                totalEl.textContent = `$${total.toFixed(2)}`;
                priceSummary.classList.remove('is-hidden');
            } else {
                priceSummary.classList.add('is-hidden');
            }

            if (serviceValue !== '') {
                trackBookingStep('service_selected', {
                    service: serviceValue
                });
            }

            updateAvailableTimes().catch(() => undefined);
        });

        if (dateInput) {
            dateInput.min = new Date().toISOString().split('T')[0];
            dateInput.addEventListener('change', () => {
                const dateValue = String(dateInput.value || '').trim();
                if (dateValue !== '') {
                    trackBookingStep('date_selected', {
                        date: dateValue
                    });
                }
                updateAvailableTimes().catch(() => undefined);
            });
        }

        if (doctorSelect) {
            doctorSelect.addEventListener('change', () => {
                const doctorValue = String(doctorSelect.value || '').trim();
                if (doctorValue !== '') {
                    trackBookingStep('doctor_selected', {
                        doctor: doctorValue
                    });
                }
                updateAvailableTimes().catch(() => undefined);
            });
        }

        if (timeSelect) {
            timeSelect.addEventListener('change', () => {
                const timeValue = String(timeSelect.value || '').trim();
                if (timeValue !== '') {
                    trackBookingStep('time_selected', {
                        time: timeValue
                    });
                }
            });
        }

        if (phoneInput) {
            phoneInput.addEventListener('blur', () => {
                const normalized = normalizeEcuadorPhone(phoneInput.value);
                if (normalized !== '') {
                    phoneInput.value = normalized;
                }
            });
        }

        appointmentForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            trackBookingStep('form_submitted', {}, { once: false });

            const submitBtn = this.querySelector('button[type="submit"]');
            const originalContent = submitBtn ? submitBtn.innerHTML : '';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
            }

            try {
                const formData = new FormData(this);
                const casePhotoFiles = deps.getCasePhotoFiles(this);
                deps.validateCasePhotoFiles(casePhotoFiles);
                const privacyConsent = formData.get('privacyConsent') === 'on';

                if (!privacyConsent) {
                    throw new Error(t(
                        'Debes aceptar el tratamiento de datos para continuar.',
                        'You must accept data processing to continue.'
                    ));
                }

                const normalizedPhone = normalizeEcuadorPhone(formData.get('phone'));

                const appointment = {
                    service: formData.get('service'),
                    doctor: formData.get('doctor'),
                    date: formData.get('date'),
                    time: formData.get('time'),
                    name: formData.get('name'),
                    email: formData.get('email'),
                    phone: normalizedPhone,
                    reason: formData.get('reason') || '',
                    affectedArea: formData.get('affectedArea') || '',
                    evolutionTime: formData.get('evolutionTime') || '',
                    privacyConsent,
                    casePhotoFiles,
                    casePhotoUploads: [],
                    price: totalEl.textContent
                };

                deps.markBookingViewed('form_submit');

                const bookedSlots = await deps.getBookedSlots(appointment.date, appointment.doctor);
                if (bookedSlots.includes(appointment.time)) {
                    deps.showToast(t(
                        'Este horario ya fue reservado. Por favor selecciona otro.',
                        'This time slot was just booked. Please choose another.'
                    ), 'error');
                    await updateAvailableTimes();
                    return;
                }

                deps.setCurrentAppointment(appointment);
                deps.startCheckoutSession(appointment);
                deps.trackEvent('start_checkout', {
                    service: appointment.service || '',
                    doctor: appointment.doctor || '',
                    checkout_entry: 'booking_form'
                });
                deps.openPaymentModal(appointment);
            } catch (error) {
                deps.trackEvent('booking_error', {
                    stage: 'booking_form',
                    error_code: deps.normalizeAnalyticsLabel(error && (error.code || error.message), 'booking_prepare_failed')
                });
                deps.showToast(
                    (error && error.message) || t('No se pudo preparar la reserva. Intenta nuevamente.', 'Could not prepare booking. Please try again.'),
                    'error'
                );
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalContent;
                }
            }
        });

        return window.PielBookingUi;
    }

    window.PielBookingUi = {
        init
    };
})();
