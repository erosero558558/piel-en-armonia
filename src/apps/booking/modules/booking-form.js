// build-sync: 20260220-sync1

let deps = null;
let initialized = false;
const completedFormSteps = Object.create(null);
const formEngagementState = {
    started: false,
    submitted: false,
    abandonedTracked: false,
    lastStep: '',
};

function getLang() {
    return deps && typeof deps.getCurrentLang === 'function'
        ? deps.getCurrentLang()
        : 'es';
}

function t(esText, enText) {
    return getLang() === 'es' ? esText : enText;
}

function getBookingFeedbackEl() {
    return (
        document.getElementById('v5-booking-feedback') ||
        document.getElementById('bookingInlineFeedback')
    );
}

function getBookingElement(primaryId, legacyId) {
    return (
        document.getElementById(primaryId) ||
        (legacyId ? document.getElementById(legacyId) : null)
    );
}

function getSelectedOptionLabel(select, fallback = '') {
    if (!select || !select.options || select.selectedIndex < 0) {
        return fallback;
    }

    const option = select.options[select.selectedIndex];
    const label = option ? String(option.textContent || '').trim() : '';
    return label || fallback;
}

function setBookingFeedback(message, type = 'info') {
    const feedback = getBookingFeedbackEl();
    if (!feedback) return;

    const normalizedType =
        type === 'error' || type === 'success' ? type : 'info';
    feedback.textContent = String(message || '').trim();
    feedback.className = `booking-inline-feedback booking-inline-feedback--${normalizedType}`;
    feedback.setAttribute(
        'role',
        normalizedType === 'error' ? 'alert' : 'status'
    );
    feedback.setAttribute(
        'aria-live',
        normalizedType === 'error' ? 'assertive' : 'polite'
    );
    feedback.classList.toggle('is-hidden', feedback.textContent === '');
}

function clearBookingFeedback() {
    const feedback = getBookingFeedbackEl();
    if (!feedback) return;
    feedback.textContent = '';
    feedback.className = 'booking-inline-feedback is-hidden';
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');
}

function findFieldByName(form, fieldName) {
    if (!form || !fieldName) return null;
    return form.querySelector(`[name="${fieldName}"]`);
}

function getFieldErrorContainer(field) {
    if (!field) return null;
    return field.closest('.form-group') || field.closest('.form-consent');
}

function clearFieldErrorState(field) {
    if (!field) return;
    field.removeAttribute('aria-invalid');
    const container = getFieldErrorContainer(field);
    if (container) {
        container.classList.remove('has-error');
    }
}

function markFieldErrorState(field) {
    if (!field) return;
    field.setAttribute('aria-invalid', 'true');
    const container = getFieldErrorContainer(field);
    if (container) {
        container.classList.add('has-error');
    }
}

function clearBookingValidationState(form) {
    if (!form) return;
    form.querySelectorAll('[aria-invalid="true"]').forEach((field) => {
        field.removeAttribute('aria-invalid');
    });
    form.querySelectorAll('.has-error').forEach((node) => {
        node.classList.remove('has-error');
    });
}

function focusFieldForCorrection(field) {
    if (!field || typeof field.focus !== 'function') return;
    try {
        field.focus({ preventScroll: true });
    } catch (_) {
        field.focus();
    }
    if (typeof field.scrollIntoView === 'function') {
        field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function bindInlineErrorReset(form) {
    if (!form || form.dataset.bookingInlineResetBound === 'true') {
        return;
    }

    const clearField = (event) => {
        const target = event && event.target;
        if (!(target instanceof Element)) return;
        if (!form.contains(target)) return;
        if (!target.matches('input, select, textarea, button[type="submit"]')) {
            return;
        }
        clearFieldErrorState(target);
        const feedback = getBookingFeedbackEl();
        if (
            feedback &&
            feedback.classList.contains('booking-inline-feedback--error')
        ) {
            clearBookingFeedback();
        }
    };

    form.addEventListener('input', clearField);
    form.addEventListener('change', clearField);
    form.dataset.bookingInlineResetBound = 'true';
}

function isCalendarUnavailableError(error) {
    if (!error) return false;
    const code = String(error.code || '').toLowerCase();
    const message = String(error.message || '').toLowerCase();
    return (
        code === 'calendar_unreachable' ||
        code === 'calendar_auth_failed' ||
        code === 'calendar_token_rejected' ||
        message.includes('calendar_unreachable') ||
        message.includes('agenda temporalmente no disponible') ||
        message.includes('no se pudo consultar la agenda real') ||
        message.includes('google calendar no')
    );
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

function getPhoneDigits(value) {
    return String(value || '').replace(/\D/g, '');
}

function hasValidPhoneLength(value) {
    const digits = getPhoneDigits(value);
    return digits.length >= 7 && digits.length <= 15;
}

function ensurePhoneInputGuidance(phoneInput) {
    if (!phoneInput) return;

    const placeholder = t('+593 9XXXXXXXX', '+593 9XXXXXXXX');
    if (!phoneInput.placeholder || phoneInput.placeholder.trim() === '') {
        phoneInput.placeholder = placeholder;
    }

    phoneInput.setAttribute('inputmode', 'tel');
    phoneInput.setAttribute('autocomplete', 'tel');
    phoneInput.setAttribute('autocapitalize', 'off');
    phoneInput.setAttribute('spellcheck', 'false');

    const helpId = 'bookingPhoneFormatHelp';
    let help = document.getElementById(helpId);
    if (!help) {
        help = document.createElement('small');
        help.id = helpId;
        help.className = 'form-help';
        phoneInput.insertAdjacentElement('afterend', help);
    }
    help.textContent = t(
        'Formato recomendado: +593 9XXXXXXXX o 09XXXXXXXX.',
        'Recommended format: +593 9XXXXXXXX or 09XXXXXXXX.'
    );
}

function ensureReschedulePolicyHint(appointmentForm) {
    if (!appointmentForm) return;
    if (appointmentForm.querySelector('.booking-policy-note')) {
        return;
    }

    const policyNote = document.createElement('p');
    policyNote.className = 'form-help booking-policy-note';
    policyNote.innerHTML = `${t(
        'Reprogramacion o cancelacion sin costo hasta 24 horas antes.',
        'Free rescheduling or cancellation up to 24 hours before.'
    )} <a href="terminos.html#cancelaciones" target="_blank" rel="noopener noreferrer">${t(
        'Ver politica',
        'View policy'
    )}</a>`;

    const policyLink = policyNote.querySelector('a');
    if (policyLink) {
        policyLink.addEventListener('click', () => {
            trackFormStep('reschedule_policy_opened', {}, { once: false });
            if (deps && typeof deps.trackEvent === 'function') {
                deps.trackEvent('booking_policy_opened', {
                    source: 'booking_form',
                });
            }
        });
    }

    const consentBlock = appointmentForm.querySelector('.form-consent');
    if (consentBlock && consentBlock.parentNode) {
        consentBlock.insertAdjacentElement('afterend', policyNote);
        return;
    }

    appointmentForm.appendChild(policyNote);
}

function trackFormStep(step, payload = {}, options = {}) {
    if (!deps || typeof deps.trackEvent !== 'function' || !step) {
        return;
    }

    formEngagementState.started = true;
    formEngagementState.lastStep = step;

    const once = options && options.once !== false;
    if (once && completedFormSteps[step]) {
        return;
    }

    if (once) {
        completedFormSteps[step] = true;
    }

    const stepPayload = {
        step,
        source: 'booking_form',
        ...payload,
    };

    deps.trackEvent('booking_step_completed', stepPayload);

    if (typeof deps.setCheckoutStep === 'function') {
        deps.setCheckoutStep(step, {
            checkoutEntry: 'booking_form',
            ...payload,
        });
    }
}

function trackFormAbandon(reason = 'form_exit') {
    if (
        !deps ||
        typeof deps.trackEvent !== 'function' ||
        !formEngagementState.started ||
        formEngagementState.submitted ||
        formEngagementState.abandonedTracked
    ) {
        return;
    }

    formEngagementState.abandonedTracked = true;
    deps.trackEvent('checkout_abandon', {
        checkout_entry: 'booking_form',
        checkout_step: formEngagementState.lastStep || 'booking_form',
        reason,
    });
}

function hasClinicalContext(formData) {
    return !!(
        (formData.get('reason') || '').trim() ||
        (formData.get('affectedArea') || '').trim() ||
        (formData.get('evolutionTime') || '').trim()
    );
}

export function init(inputDeps) {
    deps = inputDeps || deps;
    if (initialized) {
        return { init };
    }

    const serviceSelect = getBookingElement(
        'v5-service-select',
        'serviceSelect'
    );
    const priceSummary = document.getElementById('priceSummary');
    const subtotalEl = document.getElementById('subtotalPrice');
    const ivaEl = document.getElementById('ivaPrice');
    const totalEl = document.getElementById('totalPrice');
    const selectedPriceLabelEl = document.getElementById('selectedPriceLabel');
    const selectedPriceRuleEl = document.getElementById('selectedPriceRule');
    const selectedServiceMetaEl = document.getElementById(
        'selectedServiceMeta'
    );
    const selectedPriceDisclaimerEl = document.getElementById(
        'selectedPriceDisclaimer'
    );
    const dateInput =
        getBookingElement('v5-date', 'appointmentDate') ||
        document.querySelector('input[name="date"]');
    const timeSelect =
        getBookingElement('v5-time', 'timeSelect') ||
        document.querySelector('select[name="time"]');
    const doctorSelect =
        getBookingElement('v5-doctor-select', 'doctorSelect') ||
        document.querySelector('select[name="doctor"]');
    const phoneInput = document.querySelector('input[name="phone"]');
    const appointmentForm = getBookingElement(
        'v5-booking-form',
        'appointmentForm'
    );
    const waitlistCard = document.getElementById('bookingWaitlistCard');
    const waitlistSummary = document.getElementById('bookingWaitlistSummary');
    const waitlistStatus = document.getElementById('bookingWaitlistStatus');
    const waitlistBtn = document.getElementById('bookingWaitlistBtn');

    if (
        !serviceSelect ||
        !priceSummary ||
        !subtotalEl ||
        !ivaEl ||
        !totalEl ||
        !appointmentForm
    ) {
        return { init };
    }

    initialized = true;
    formEngagementState.started = false;
    formEngagementState.submitted = false;
    formEngagementState.abandonedTracked = false;
    formEngagementState.lastStep = '';
    let waitlistContext = {
        visible: false,
        date: '',
        doctor: '',
        service: '',
    };

    function setWaitlistStatus(message = '', tone = 'info') {
        if (!waitlistStatus) return;
        waitlistStatus.textContent = String(message || '').trim();
        waitlistStatus.dataset.tone = tone;
        waitlistStatus.classList.toggle(
            'is-hidden',
            waitlistStatus.textContent === ''
        );
    }

    function setWaitlistState(nextState = {}) {
        waitlistContext = {
            ...waitlistContext,
            ...nextState,
        };

        if (!waitlistCard) {
            return;
        }

        const visible = waitlistContext.visible === true;
        waitlistCard.classList.toggle('is-hidden', !visible);

        if (!visible) {
            if (waitlistBtn) {
                waitlistBtn.disabled = false;
                waitlistBtn.removeAttribute('data-done');
                if (waitlistBtn.dataset.defaultLabel) {
                    waitlistBtn.textContent = waitlistBtn.dataset.defaultLabel;
                }
            }
            setWaitlistStatus('');
            return;
        }

        const serviceLabel = getSelectedOptionLabel(
            serviceSelect,
            t('la ruta seleccionada', 'the selected route')
        );
        const doctorLabel =
            waitlistContext.doctor &&
            waitlistContext.doctor !== 'indiferente'
                ? getSelectedOptionLabel(
                      doctorSelect,
                      t('el especialista elegido', 'the selected specialist')
                  )
                : t('cualquiera disponible', 'any available specialist');

        if (waitlistSummary) {
            waitlistSummary.textContent = t(
                `No vemos horarios libres el ${waitlistContext.date}. Déjanos tus datos y te avisamos por WhatsApp si se libera un espacio para ${serviceLabel} con ${doctorLabel}.`,
                `We do not see open slots on ${waitlistContext.date}. Leave your details and we will message you on WhatsApp if a space opens for ${serviceLabel} with ${doctorLabel}.`
            );
        }
    }

    async function updateAvailableTimes() {
        try {
            await deps.updateAvailableTimes({
                dateInput,
                timeSelect,
                doctorSelect,
                serviceSelect,
                t,
                setWaitlistState,
            });
        } catch (error) {
            setWaitlistState({ visible: false });
            if (deps && typeof deps.debugLog === 'function') {
                deps.debugLog('Failed to load booking-calendar.js', error);
            }
            const isCalendarUnavailable = isCalendarUnavailableError(error);
            deps.showToast(
                isCalendarUnavailable
                    ? t(
                          'La agenda esta temporalmente no disponible. Intenta en unos minutos.',
                          'The schedule is temporarily unavailable. Please try again in a few minutes.'
                      )
                    : t(
                          'Error cargando calendario. Intenta nuevamente.',
                          'Error loading calendar. Please try again.'
                      ),
                'error'
            );
        }
    }

    function serviceTypeLabel(serviceType) {
        const normalized = String(serviceType || '')
            .trim()
            .toLowerCase();
        if (!normalized) {
            return t(
                'Selecciona una ruta para ver detalles',
                'Select a route to see details'
            );
        }
        if (normalized === 'clinical')
            return t('Ruta clínica', 'Clinical route');
        if (normalized === 'telemedicine')
            return t('Ruta remota', 'Remote-first route');
        if (normalized === 'procedure')
            return t('Ruta de procedimiento', 'Procedure route');
        if (normalized === 'aesthetic')
            return t('Ruta de estética médica', 'Medical aesthetics route');
        return t('Ruta especializada', 'Specialized route');
    }

    serviceSelect.addEventListener('change', function () {
        const selected = this.options[this.selectedIndex];
        const price = parseFloat(selected.dataset.price) || 0;
        const taxRate = parseFloat(selected.dataset.serviceTax) || 0;
        const priceTotal = parseFloat(selected.dataset.priceTotal) || 0;
        const priceLabelShort = String(
            selected.dataset.priceLabelShort || ''
        ).trim();
        const priceRule = String(selected.dataset.priceRule || '').trim();
        const priceDisclaimer = String(
            selected.dataset.priceDisclaimer || ''
        ).trim();
        const serviceType = String(selected.dataset.serviceType || '').trim();
        const durationMin = Number(selected.dataset.durationMin || 0);
        const priceHint = document.getElementById('priceHint');

        const iva = price * taxRate;
        const total = priceTotal > 0 ? priceTotal : price + iva;
        subtotalEl.textContent = `$${price.toFixed(2)}`;
        ivaEl.textContent = `$${iva.toFixed(2)}`;
        totalEl.textContent = `$${total.toFixed(2)}`;

        if (selectedPriceLabelEl) {
            selectedPriceLabelEl.textContent = priceLabelShort || '-';
        }
        if (selectedPriceRuleEl) {
            selectedPriceRuleEl.textContent =
                priceRule === 'base_plus_tax'
                    ? t(
                          'Total = precio base + impuesto aplicable',
                          'Total = base price + applicable tax'
                      )
                    : t(
                          'Regla de precio según catálogo',
                          'Pricing rule according to catalogue'
                      );
        }
        if (selectedServiceMetaEl) {
            const typeLabel = serviceTypeLabel(serviceType);
            selectedServiceMetaEl.textContent =
                durationMin > 0
                    ? `${typeLabel} · ${durationMin} min`
                    : typeLabel;
        }
        if (selectedPriceDisclaimerEl) {
            selectedPriceDisclaimerEl.textContent =
                priceDisclaimer ||
                t(
                    'El valor final se confirma antes de autorizar el pago.',
                    'Final amount is confirmed before payment authorization.'
                );
        }

        if (price > 0) {
            priceSummary.classList.remove('is-hidden');
            if (priceHint) priceHint.classList.add('is-hidden');
        } else {
            priceSummary.classList.add('is-hidden');
            if (priceHint) priceHint.classList.remove('is-hidden');
        }

        if (this.value) {
            trackFormStep('service_selected', {
                service: this.value,
            });
        }

        updateAvailableTimes().catch(() => undefined);
    });

    if (dateInput) {
        dateInput.min = new Date().toISOString().split('T')[0];
        dateInput.addEventListener('change', () => {
            if (dateInput.value) {
                trackFormStep('date_selected');
            }
            updateAvailableTimes().catch(() => undefined);
        });
    }

    if (doctorSelect) {
        doctorSelect.addEventListener('change', () => {
            if (doctorSelect.value) {
                trackFormStep('doctor_selected', {
                    doctor: doctorSelect.value,
                });
            }
            updateAvailableTimes().catch(() => undefined);
        });
    }

    if (timeSelect) {
        timeSelect.addEventListener('change', () => {
            if (timeSelect.value) {
                trackFormStep('time_selected');
                setWaitlistState({ visible: false });
            }
        });
    }

    if (phoneInput) {
        ensurePhoneInputGuidance(phoneInput);
        phoneInput.addEventListener('blur', () => {
            const normalized = normalizeEcuadorPhone(phoneInput.value);
            if (normalized !== '') {
                phoneInput.value = normalized;
            }

            const validPhoneLength = hasValidPhoneLength(normalized);
            phoneInput.setCustomValidity(
                validPhoneLength
                    ? ''
                    : t(
                          'Ingresa un telefono valido (ejemplo: +593 9XXXXXXXX).',
                          'Enter a valid phone number (example: +593 9XXXXXXXX).'
                      )
            );
            if (validPhoneLength) {
                trackFormStep('phone_added');
            }
        });
        phoneInput.addEventListener('input', () => {
            phoneInput.setCustomValidity('');
        });
    }

    const nameInput = appointmentForm.querySelector('input[name="name"]');
    if (nameInput) {
        nameInput.addEventListener('blur', () => {
            if ((nameInput.value || '').trim().length >= 2) {
                trackFormStep('name_added');
            }
        });
    }

    const emailInput = appointmentForm.querySelector('input[name="email"]');
    if (emailInput) {
        emailInput.addEventListener('blur', () => {
            const email = (emailInput.value || '').trim();
            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                trackFormStep('email_added');
            }
        });
    }

    const reasonInput = appointmentForm.querySelector(
        'textarea[name="reason"]'
    );
    const areaSelect = appointmentForm.querySelector(
        'select[name="affectedArea"]'
    );
    const evolutionSelect = appointmentForm.querySelector(
        'select[name="evolutionTime"]'
    );
    const maybeTrackClinicalContext = () => {
        const reason = reasonInput ? (reasonInput.value || '').trim() : '';
        const area = areaSelect ? (areaSelect.value || '').trim() : '';
        const evolution = evolutionSelect
            ? (evolutionSelect.value || '').trim()
            : '';
        if (reason || area || evolution) {
            trackFormStep('clinical_context_added');
        }
    };
    if (reasonInput) {
        reasonInput.addEventListener('blur', maybeTrackClinicalContext);
    }
    if (areaSelect) {
        areaSelect.addEventListener('change', maybeTrackClinicalContext);
    }
    if (evolutionSelect) {
        evolutionSelect.addEventListener('change', maybeTrackClinicalContext);
    }

    const privacyConsentInput = appointmentForm.querySelector(
        'input[name="privacyConsent"]'
    );
    if (privacyConsentInput) {
        privacyConsentInput.addEventListener('change', () => {
            if (privacyConsentInput.checked) {
                trackFormStep('privacy_consent_checked');
            }
        });
    }
    ensureReschedulePolicyHint(appointmentForm);
    bindInlineErrorReset(appointmentForm);

    if (waitlistBtn) {
        const originalWaitlistLabel = waitlistBtn.textContent || '';
        waitlistBtn.dataset.defaultLabel = originalWaitlistLabel;
        waitlistBtn.addEventListener('click', async () => {
            clearBookingFeedback();
            clearBookingValidationState(appointmentForm);

            const nameField = findFieldByName(appointmentForm, 'name');
            const emailField = findFieldByName(appointmentForm, 'email');
            const phoneField = findFieldByName(appointmentForm, 'phone');
            const consentField = findFieldByName(
                appointmentForm,
                'privacyConsent'
            );

            const name = String(nameField?.value || '').trim();
            const email = String(emailField?.value || '').trim();
            const normalizedPhone = normalizeEcuadorPhone(phoneField?.value);
            const hasConsent = !!(consentField && consentField.checked);

            if (!waitlistContext.date || !waitlistContext.service) {
                const message = t(
                    'Selecciona una fecha sin cupo para activar la lista de espera.',
                    'Select a full date to enable the waitlist.'
                );
                setBookingFeedback(message, 'error');
                setWaitlistStatus(message, 'error');
                return;
            }

            if (name.length < 2) {
                const message = t(
                    'Necesitamos tu nombre para la lista de espera.',
                    'We need your name for the waitlist.'
                );
                if (nameField) {
                    markFieldErrorState(nameField);
                    focusFieldForCorrection(nameField);
                }
                setBookingFeedback(message, 'error');
                setWaitlistStatus(message, 'error');
                return;
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                const message = t(
                    'Ingresa un email válido para avisarte si se libera un cupo.',
                    'Enter a valid email so we can alert you if a slot opens.'
                );
                if (emailField) {
                    markFieldErrorState(emailField);
                    focusFieldForCorrection(emailField);
                }
                setBookingFeedback(message, 'error');
                setWaitlistStatus(message, 'error');
                return;
            }

            if (!hasValidPhoneLength(normalizedPhone)) {
                const message = t(
                    'Ingresa un teléfono válido para enviarte el aviso por WhatsApp.',
                    'Enter a valid phone number so we can notify you on WhatsApp.'
                );
                if (phoneField) {
                    markFieldErrorState(phoneField);
                    focusFieldForCorrection(phoneField);
                }
                setBookingFeedback(message, 'error');
                setWaitlistStatus(message, 'error');
                return;
            }

            if (!hasConsent) {
                const message = t(
                    'Debes aceptar el tratamiento de datos para unirte a la lista de espera.',
                    'You must accept data processing to join the waitlist.'
                );
                if (consentField) {
                    markFieldErrorState(consentField);
                    focusFieldForCorrection(consentField);
                }
                setBookingFeedback(message, 'error');
                setWaitlistStatus(message, 'error');
                return;
            }

            waitlistBtn.disabled = true;
            waitlistBtn.dataset.loading = 'true';
            waitlistBtn.textContent = t(
                'Guardando en lista...',
                'Saving to waitlist...'
            );
            setWaitlistStatus(
                t(
                    'Estamos guardando tu solicitud.',
                    'We are saving your request.'
                ),
                'info'
            );

            try {
                if (phoneField) {
                    phoneField.value = normalizedPhone;
                }

                const payload = {
                    service:
                        waitlistContext.service ||
                        String(serviceSelect?.value || ''),
                    doctor:
                        waitlistContext.doctor ||
                        String(doctorSelect?.value || 'indiferente'),
                    date: waitlistContext.date,
                    name,
                    email,
                    phone: normalizedPhone,
                    reason: String(reasonInput?.value || '').trim(),
                    affectedArea: String(areaSelect?.value || '').trim(),
                    evolutionTime: String(evolutionSelect?.value || '').trim(),
                    privacyConsent: true,
                };

                const result = await deps.createBookingWaitlistEntry(payload);
                const created = result && result.created === true;
                const successMessage = created
                    ? t(
                          'Te sumamos a la lista de espera. Si se libera un espacio, te escribiremos por WhatsApp.',
                          'You are on the waitlist. If a slot opens, we will message you on WhatsApp.'
                      )
                    : t(
                          'Ya tenías una solicitud activa para ese día. Te avisaremos por WhatsApp si se libera un espacio.',
                          'You already had an active request for that day. We will message you on WhatsApp if a slot opens.'
                      );

                trackFormStep(
                    'waitlist_joined',
                    {
                        service: payload.service,
                        doctor: payload.doctor,
                    },
                    { once: false }
                );
                deps.trackEvent('booking_waitlist_joined', {
                    source: 'booking_form',
                    service: payload.service,
                    doctor: payload.doctor,
                    date: payload.date,
                    state: created ? 'new' : 'existing',
                });
                setBookingFeedback(successMessage, 'success');
                setWaitlistStatus(successMessage, 'success');
                waitlistBtn.setAttribute('data-done', 'true');
                waitlistBtn.textContent = t(
                    'En lista de espera',
                    'On the waitlist'
                );
            } catch (error) {
                const message =
                    (error && error.message) ||
                    t(
                        'No pudimos registrar tu solicitud en este momento.',
                        'We could not register your waitlist request right now.'
                    );
                waitlistBtn.disabled = false;
                waitlistBtn.textContent = originalWaitlistLabel;
                setBookingFeedback(message, 'error');
                setWaitlistStatus(message, 'error');
                deps.showToast(message, 'error');
            } finally {
                delete waitlistBtn.dataset.loading;
            }
        });
    }

    if (serviceSelect.value) {
        serviceSelect.dispatchEvent(new Event('change'));
    }

    appointmentForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        clearBookingFeedback();
        clearBookingValidationState(this);

        if (!this.checkValidity()) {
            if (typeof this.reportValidity === 'function') {
                this.reportValidity();
            }
            const invalidField = this.querySelector(':invalid');
            if (invalidField) {
                markFieldErrorState(invalidField);
                focusFieldForCorrection(invalidField);
            }
            setBookingFeedback(
                t(
                    'Revisa los campos obligatorios antes de continuar.',
                    'Please review the required fields before continuing.'
                ),
                'error'
            );
            return;
        }

        const submitBtn = this.querySelector('button[type="submit"]');
        const originalContent = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.dataset.loading = 'true';
            submitBtn.innerHTML =
                '<i class="fas fa-spinner fa-spin"></i> Validando agenda...';
        }
        this.setAttribute('aria-busy', 'true');
        setBookingFeedback(
            t(
                'Validando disponibilidad en tiempo real. Esto toma unos segundos.',
                'Checking real-time availability. This takes a few seconds.'
            ),
            'info'
        );

        try {
            const formData = new FormData(this);
            const casePhotoFiles = deps.getCasePhotoFiles(this);
            deps.validateCasePhotoFiles(casePhotoFiles);
            const privacyConsent = formData.get('privacyConsent') === 'on';

            if (!privacyConsent) {
                const error = new Error(
                    t(
                        'Debes aceptar el tratamiento de datos para continuar.',
                        'You must accept data processing to continue.'
                    )
                );
                error.fieldName = 'privacyConsent';
                throw error;
            }

            const normalizedPhone = normalizeEcuadorPhone(
                formData.get('phone')
            );
            if (!hasValidPhoneLength(normalizedPhone)) {
                const error = new Error(
                    t(
                        'Ingresa un telefono valido (ejemplo: +593 9XXXXXXXX).',
                        'Enter a valid phone number (example: +593 9XXXXXXXX).'
                    )
                );
                error.fieldName = 'phone';
                throw error;
            }

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
                checkoutEntry: 'booking_form',
                price: totalEl.textContent,
            };

            trackFormStep('form_submitted', {}, { once: false });
            if (appointment.service) {
                trackFormStep('service_selected', {
                    service: appointment.service,
                });
            }
            if (appointment.doctor) {
                trackFormStep('doctor_selected', {
                    doctor: appointment.doctor,
                });
            }
            if (appointment.date) {
                trackFormStep('date_selected');
            }
            if (appointment.time) {
                trackFormStep('time_selected');
            }
            if ((appointment.name || '').trim().length >= 2) {
                trackFormStep('name_added');
            }
            if (
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                    (appointment.email || '').trim()
                )
            ) {
                trackFormStep('email_added');
            }
            if ((appointment.phone || '').replace(/\D/g, '').length >= 7) {
                trackFormStep('phone_added');
            }
            if (privacyConsent) {
                trackFormStep('privacy_consent_checked');
            }
            if (hasClinicalContext(formData)) {
                trackFormStep('clinical_context_added');
            }

            deps.markBookingViewed('form_submit');

            const bookedSlots = await deps.getBookedSlots(
                appointment.date,
                appointment.doctor,
                appointment.service || 'consulta'
            );
            if (bookedSlots.includes(appointment.time)) {
                const slotTakenMessage = t(
                    'Este horario ya fue reservado. Elige otro para continuar.',
                    'This time slot was just booked. Please choose another one.'
                );
                setBookingFeedback(slotTakenMessage, 'error');
                const timeField = findFieldByName(this, 'time');
                if (timeField) {
                    markFieldErrorState(timeField);
                    focusFieldForCorrection(timeField);
                }
                deps.showToast(slotTakenMessage, 'error');
                await updateAvailableTimes();
                return;
            }

            deps.setCurrentAppointment(appointment);
            deps.startCheckoutSession(appointment, {
                checkoutEntry: 'booking_form',
                step: 'booking_form_validated',
            });
            deps.trackEvent('start_checkout', {
                service: appointment.service || '',
                doctor: appointment.doctor || '',
                checkout_entry: 'booking_form',
            });
            formEngagementState.submitted = true;
            setBookingFeedback(
                t(
                    'Horario validado. Continuamos al paso de pago.',
                    'Time slot validated. Continuing to the payment step.'
                ),
                'success'
            );
            deps.openPaymentModal(appointment);
        } catch (error) {
            const message =
                (error && error.message) ||
                t(
                    'No se pudo preparar la reserva. Intenta nuevamente.',
                    'Could not prepare booking. Please try again.'
                );
            const fieldName = error && error.fieldName;
            const field = fieldName ? findFieldByName(this, fieldName) : null;
            if (field) {
                markFieldErrorState(field);
                focusFieldForCorrection(field);
            }
            deps.trackEvent('booking_error', {
                stage: 'booking_form',
                error_code: deps.normalizeAnalyticsLabel(
                    error && (error.code || error.message),
                    'booking_prepare_failed'
                ),
            });
            setBookingFeedback(message, 'error');
            deps.showToast(message, 'error');
        } finally {
            this.removeAttribute('aria-busy');
            if (submitBtn) {
                submitBtn.disabled = false;
                delete submitBtn.dataset.loading;
                submitBtn.innerHTML = originalContent;
            }
        }
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            trackFormAbandon('form_visibility_hidden');
        }
    });

    window.addEventListener('pagehide', () => {
        trackFormAbandon('form_page_hide');
    });

    return { init };
}
