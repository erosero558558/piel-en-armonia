let e = null,
    t = !1;
const n = Object.create(null),
    o = { started: !1, submitted: !1, abandonedTracked: !1, lastStep: '' };
function a(t, n) {
    return 'es' ===
        (e && 'function' == typeof e.getCurrentLang ? e.getCurrentLang() : 'es')
        ? t
        : n;
}
function i() {
    return document.getElementById('bookingInlineFeedback');
}
function r(e, t = 'info') {
    const n = i();
    if (!n) return;
    const o = 'error' === t || 'success' === t ? t : 'info';
    ((n.textContent = String(e || '').trim()),
        (n.className = `booking-inline-feedback booking-inline-feedback--${o}`),
        n.setAttribute('role', 'error' === o ? 'alert' : 'status'),
        n.setAttribute('aria-live', 'error' === o ? 'assertive' : 'polite'),
        n.classList.toggle('is-hidden', '' === n.textContent));
}
function c() {
    const e = i();
    e &&
        ((e.textContent = ''),
        (e.className = 'booking-inline-feedback is-hidden'),
        e.setAttribute('role', 'status'),
        e.setAttribute('aria-live', 'polite'));
}
function s(e, t) {
    return e && t ? e.querySelector(`[name="${t}"]`) : null;
}
function l(e) {
    return e ? e.closest('.form-group') || e.closest('.form-consent') : null;
}
function d(e) {
    if (!e) return;
    e.setAttribute('aria-invalid', 'true');
    const t = l(e);
    t && t.classList.add('has-error');
}
function u(e) {
    if (e && 'function' == typeof e.focus) {
        try {
            e.focus({ preventScroll: !0 });
        } catch (t) {
            e.focus();
        }
        'function' == typeof e.scrollIntoView &&
            e.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}
function m(e) {
    const t = String(e || '').trim();
    if ('' === t) return '';
    const n = t.replace(/\D/g, '');
    return n.startsWith('593') && n.length >= 12
        ? `+${n}`
        : n.startsWith('09') && 10 === n.length
          ? `+593${n.slice(1)}`
          : n.startsWith('9') && 9 === n.length
            ? `+593${n}`
            : t.startsWith('+')
              ? `+${t.slice(1).replace(/\D/g, '')}`
              : t;
}
function p(e) {
    const t = (function (e) {
        return String(e || '').replace(/\D/g, '');
    })(e);
    return t.length >= 7 && t.length <= 15;
}
function g(t, a = {}, i = {}) {
    if (!e || 'function' != typeof e.trackEvent || !t) return;
    ((o.started = !0), (o.lastStep = t));
    const r = i && !1 !== i.once;
    if (r && n[t]) return;
    r && (n[t] = !0);
    const c = { step: t, source: 'booking_form', ...a };
    (e.trackEvent('booking_step_completed', c),
        'function' == typeof e.setCheckoutStep &&
            e.setCheckoutStep(t, { checkoutEntry: 'booking_form', ...a }));
}
function f(t = 'form_exit') {
    e &&
        'function' == typeof e.trackEvent &&
        o.started &&
        !o.submitted &&
        !o.abandonedTracked &&
        ((o.abandonedTracked = !0),
        e.trackEvent('checkout_abandon', {
            checkout_entry: 'booking_form',
            checkout_step: o.lastStep || 'booking_form',
            reason: t,
        }));
}
((window.Piel = window.Piel || {}),
    (window.Piel.BookingUi = {
        init: function n(h) {
            if (((e = h || e), t)) return { init: n };
            const v = document.getElementById('serviceSelect'),
                b = document.getElementById('priceSummary'),
                y = document.getElementById('subtotalPrice'),
                X = document.getElementById('ivaPrice'),
                k = document.getElementById('totalPrice'),
                _ = document.getElementById('selectedPriceLabel'),
                E = document.getElementById('selectedPriceRule'),
                S = document.getElementById('selectedServiceMeta'),
                L = document.getElementById('selectedPriceDisclaimer'),
                C = document.querySelector('input[name="date"]'),
                w = document.querySelector('select[name="time"]'),
                x = document.querySelector('select[name="doctor"]'),
                I = document.querySelector('input[name="phone"]'),
                T = document.getElementById('appointmentForm');
            if (!(v && b && y && X && k && T)) return { init: n };
            async function A() {
                try {
                    await e.updateAvailableTimes({
                        dateInput: C,
                        timeSelect: w,
                        doctorSelect: x,
                        serviceSelect: v,
                        t: a,
                    });
                } catch (t) {
                    e &&
                        'function' == typeof e.debugLog &&
                        e.debugLog('Failed to load booking-calendar.js', t);
                    const n = (function (e) {
                        if (!e) return !1;
                        const t = String(e.code || '').toLowerCase(),
                            n = String(e.message || '').toLowerCase();
                        return (
                            'calendar_unreachable' === t ||
                            'calendar_auth_failed' === t ||
                            'calendar_token_rejected' === t ||
                            n.includes('calendar_unreachable') ||
                            n.includes('agenda temporalmente no disponible') ||
                            n.includes('no se pudo consultar la agenda real') ||
                            n.includes('google calendar no')
                        );
                    })(t);
                    e.showToast(
                        n
                            ? a(
                                  'La agenda esta temporalmente no disponible. Intenta en unos minutos.',
                                  'The schedule is temporarily unavailable. Please try again in a few minutes.'
                              )
                            : a(
                                  'Error cargando calendario. Intenta nuevamente.',
                                  'Error loading calendar. Please try again.'
                              ),
                        'error'
                    );
                }
            }
            ((t = !0),
                (o.started = !1),
                (o.submitted = !1),
                (o.abandonedTracked = !1),
                (o.lastStep = ''),
                v.addEventListener('change', function () {
                    const e = this.options[this.selectedIndex],
                        t = parseFloat(e.dataset.price) || 0,
                        n = parseFloat(e.dataset.serviceTax) || 0,
                        o = parseFloat(e.dataset.priceTotal) || 0,
                        i = String(e.dataset.priceLabelShort || '').trim(),
                        r = String(e.dataset.priceRule || '').trim(),
                        c = String(e.dataset.priceDisclaimer || '').trim(),
                        s = String(e.dataset.serviceType || '').trim(),
                        l = Number(e.dataset.durationMin || 0),
                        d = document.getElementById('priceHint'),
                        u = t * n,
                        m = o > 0 ? o : t + u;
                    if (
                        ((y.textContent = `$${t.toFixed(2)}`),
                        (X.textContent = `$${u.toFixed(2)}`),
                        (k.textContent = `$${m.toFixed(2)}`),
                        _ && (_.textContent = i || '-'),
                        E &&
                            (E.textContent =
                                'base_plus_tax' === r
                                    ? a(
                                          'Total = precio base + impuesto aplicable',
                                          'Total = base price + applicable tax'
                                      )
                                    : a(
                                          'Regla de precio según catálogo',
                                          'Pricing rule according to catalogue'
                                      )),
                        S)
                    ) {
                        const e = (function (e) {
                            const t = String(e || '')
                                .trim()
                                .toLowerCase();
                            return t
                                ? 'clinical' === t
                                    ? a('Ruta clínica', 'Clinical route')
                                    : 'telemedicine' === t
                                      ? a('Ruta remota', 'Remote-first route')
                                      : 'procedure' === t
                                        ? a(
                                              'Ruta de procedimiento',
                                              'Procedure route'
                                          )
                                        : 'aesthetic' === t
                                          ? a(
                                                'Ruta de estética médica',
                                                'Medical aesthetics route'
                                            )
                                          : a(
                                                'Ruta especializada',
                                                'Specialized route'
                                            )
                                : a(
                                      'Selecciona una ruta para ver detalles',
                                      'Select a route to see details'
                                  );
                        })(s);
                        S.textContent = l > 0 ? `${e} · ${l} min` : e;
                    }
                    (L &&
                        (L.textContent =
                            c ||
                            a(
                                'El valor final se confirma antes de autorizar el pago.',
                                'Final amount is confirmed before payment authorization.'
                            )),
                        t > 0
                            ? (b.classList.remove('is-hidden'),
                              d && d.classList.add('is-hidden'))
                            : (b.classList.add('is-hidden'),
                              d && d.classList.remove('is-hidden')),
                        this.value &&
                            g('service_selected', { service: this.value }),
                        A().catch(() => {}));
                }),
                C &&
                    ((C.min = new Date().toISOString().split('T')[0]),
                    C.addEventListener('change', () => {
                        (C.value && g('date_selected'), A().catch(() => {}));
                    })),
                x &&
                    x.addEventListener('change', () => {
                        (x.value && g('doctor_selected', { doctor: x.value }),
                            A().catch(() => {}));
                    }),
                w &&
                    w.addEventListener('change', () => {
                        w.value && g('time_selected');
                    }),
                I &&
                    ((function (e) {
                        if (!e) return;
                        const t = a('+593 9XXXXXXXX', '+593 9XXXXXXXX');
                        ((e.placeholder && '' !== e.placeholder.trim()) ||
                            (e.placeholder = t),
                            e.setAttribute('inputmode', 'tel'),
                            e.setAttribute('autocomplete', 'tel'),
                            e.setAttribute('autocapitalize', 'off'),
                            e.setAttribute('spellcheck', 'false'));
                        const n = 'bookingPhoneFormatHelp';
                        let o = document.getElementById(n);
                        (o ||
                            ((o = document.createElement('small')),
                            (o.id = n),
                            (o.className = 'form-help'),
                            e.insertAdjacentElement('afterend', o)),
                            (o.textContent = a(
                                'Formato recomendado: +593 9XXXXXXXX o 09XXXXXXXX.',
                                'Recommended format: +593 9XXXXXXXX or 09XXXXXXXX.'
                            )));
                    })(I),
                    I.addEventListener('blur', () => {
                        const e = m(I.value);
                        '' !== e && (I.value = e);
                        const t = p(e);
                        (I.setCustomValidity(
                            t
                                ? ''
                                : a(
                                      'Ingresa un telefono valido (ejemplo: +593 9XXXXXXXX).',
                                      'Enter a valid phone number (example: +593 9XXXXXXXX).'
                                  )
                        ),
                            t && g('phone_added'));
                    }),
                    I.addEventListener('input', () => {
                        I.setCustomValidity('');
                    })));
            const P = T.querySelector('input[name="name"]');
            P &&
                P.addEventListener('blur', () => {
                    (P.value || '').trim().length >= 2 && g('name_added');
                });
            const q = T.querySelector('input[name="email"]');
            q &&
                q.addEventListener('blur', () => {
                    const e = (q.value || '').trim();
                    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && g('email_added');
                });
            const B = T.querySelector('textarea[name="reason"]'),
                $ = T.querySelector('select[name="affectedArea"]'),
                F = T.querySelector('select[name="evolutionTime"]'),
                R = () => {
                    const e = B ? (B.value || '').trim() : '',
                        t = $ ? ($.value || '').trim() : '',
                        n = F ? (F.value || '').trim() : '';
                    (e || t || n) && g('clinical_context_added');
                };
            (B && B.addEventListener('blur', R),
                $ && $.addEventListener('change', R),
                F && F.addEventListener('change', R));
            const V = T.querySelector('input[name="privacyConsent"]');
            return (
                V &&
                    V.addEventListener('change', () => {
                        V.checked && g('privacy_consent_checked');
                    }),
                (function (t) {
                    if (!t) return;
                    if (t.querySelector('.booking-policy-note')) return;
                    const n = document.createElement('p');
                    ((n.className = 'form-help booking-policy-note'),
                        (n.innerHTML = `${a('Reprogramacion o cancelacion sin costo hasta 24 horas antes.', 'Free rescheduling or cancellation up to 24 hours before.')} <a href="terminos.html#cancelaciones" target="_blank" rel="noopener noreferrer">${a('Ver politica', 'View policy')}</a>`));
                    const o = n.querySelector('a');
                    o &&
                        o.addEventListener('click', () => {
                            (g('reschedule_policy_opened', {}, { once: !1 }),
                                e &&
                                    'function' == typeof e.trackEvent &&
                                    e.trackEvent('booking_policy_opened', {
                                        source: 'booking_form',
                                    }));
                        });
                    const i = t.querySelector('.form-consent');
                    i && i.parentNode
                        ? i.insertAdjacentElement('afterend', n)
                        : t.appendChild(n);
                })(T),
                (function (e) {
                    if (!e || 'true' === e.dataset.bookingInlineResetBound)
                        return;
                    const t = (t) => {
                        const n = t && t.target;
                        if (!(n instanceof Element)) return;
                        if (!e.contains(n)) return;
                        if (
                            !n.matches(
                                'input, select, textarea, button[type="submit"]'
                            )
                        )
                            return;
                        !(function (e) {
                            if (!e) return;
                            e.removeAttribute('aria-invalid');
                            const t = l(e);
                            t && t.classList.remove('has-error');
                        })(n);
                        const o = i();
                        o &&
                            o.classList.contains(
                                'booking-inline-feedback--error'
                            ) &&
                            c();
                    };
                    (e.addEventListener('input', t),
                        e.addEventListener('change', t),
                        (e.dataset.bookingInlineResetBound = 'true'));
                })(T),
                v.value && v.dispatchEvent(new Event('change')),
                T.addEventListener('submit', async function (t) {
                    if (
                        (t.preventDefault(),
                        c(),
                        this &&
                            (this.querySelectorAll(
                                '[aria-invalid="true"]'
                            ).forEach((e) => {
                                e.removeAttribute('aria-invalid');
                            }),
                            this.querySelectorAll('.has-error').forEach((e) => {
                                e.classList.remove('has-error');
                            })),
                        !this.checkValidity())
                    ) {
                        'function' == typeof this.reportValidity &&
                            this.reportValidity();
                        const e = this.querySelector(':invalid');
                        return (
                            e && (d(e), u(e)),
                            void r(
                                a(
                                    'Revisa los campos obligatorios antes de continuar.',
                                    'Please review the required fields before continuing.'
                                ),
                                'error'
                            )
                        );
                    }
                    const n = this.querySelector('button[type="submit"]'),
                        i = n ? n.innerHTML : '';
                    (n &&
                        ((n.disabled = !0),
                        (n.dataset.loading = 'true'),
                        (n.innerHTML =
                            '<i class="fas fa-spinner fa-spin"></i> Validando agenda...')),
                        this.setAttribute('aria-busy', 'true'),
                        r(
                            a(
                                'Validando disponibilidad en tiempo real. Esto toma unos segundos.',
                                'Checking real-time availability. This takes a few seconds.'
                            ),
                            'info'
                        ));
                    try {
                        const t = new FormData(this),
                            n = e.getCasePhotoFiles(this);
                        e.validateCasePhotoFiles(n);
                        const i = 'on' === t.get('privacyConsent');
                        if (!i) {
                            const e = new Error(
                                a(
                                    'Debes aceptar el tratamiento de datos para continuar.',
                                    'You must accept data processing to continue.'
                                )
                            );
                            throw ((e.fieldName = 'privacyConsent'), e);
                        }
                        const c = m(t.get('phone'));
                        if (!p(c)) {
                            const e = new Error(
                                a(
                                    'Ingresa un telefono valido (ejemplo: +593 9XXXXXXXX).',
                                    'Enter a valid phone number (example: +593 9XXXXXXXX).'
                                )
                            );
                            throw ((e.fieldName = 'phone'), e);
                        }
                        const l = {
                            service: t.get('service'),
                            doctor: t.get('doctor'),
                            date: t.get('date'),
                            time: t.get('time'),
                            name: t.get('name'),
                            email: t.get('email'),
                            phone: c,
                            reason: t.get('reason') || '',
                            affectedArea: t.get('affectedArea') || '',
                            evolutionTime: t.get('evolutionTime') || '',
                            privacyConsent: i,
                            casePhotoFiles: n,
                            casePhotoUploads: [],
                            checkoutEntry: 'booking_form',
                            price: k.textContent,
                        };
                        if (
                            (g('form_submitted', {}, { once: !1 }),
                            l.service &&
                                g('service_selected', { service: l.service }),
                            l.doctor &&
                                g('doctor_selected', { doctor: l.doctor }),
                            l.date && g('date_selected'),
                            l.time && g('time_selected'),
                            (l.name || '').trim().length >= 2 &&
                                g('name_added'),
                            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                                (l.email || '').trim()
                            ) && g('email_added'),
                            (l.phone || '').replace(/\D/g, '').length >= 7 &&
                                g('phone_added'),
                            i && g('privacy_consent_checked'),
                            (function (e) {
                                return !!(
                                    (e.get('reason') || '').trim() ||
                                    (e.get('affectedArea') || '').trim() ||
                                    (e.get('evolutionTime') || '').trim()
                                );
                            })(t) && g('clinical_context_added'),
                            e.markBookingViewed('form_submit'),
                            (
                                await e.getBookedSlots(
                                    l.date,
                                    l.doctor,
                                    l.service || 'consulta'
                                )
                            ).includes(l.time))
                        ) {
                            const t = a(
                                'Este horario ya fue reservado. Elige otro para continuar.',
                                'This time slot was just booked. Please choose another one.'
                            );
                            r(t, 'error');
                            const n = s(this, 'time');
                            return (
                                n && (d(n), u(n)),
                                e.showToast(t, 'error'),
                                void (await A())
                            );
                        }
                        (e.setCurrentAppointment(l),
                            e.startCheckoutSession(l, {
                                checkoutEntry: 'booking_form',
                                step: 'booking_form_validated',
                            }),
                            e.trackEvent('start_checkout', {
                                service: l.service || '',
                                doctor: l.doctor || '',
                                checkout_entry: 'booking_form',
                            }),
                            (o.submitted = !0),
                            r(
                                a(
                                    'Horario validado. Continuamos al paso de pago.',
                                    'Time slot validated. Continuing to the payment step.'
                                ),
                                'success'
                            ),
                            e.openPaymentModal(l));
                    } catch (t) {
                        const n =
                                (t && t.message) ||
                                a(
                                    'No se pudo preparar la reserva. Intenta nuevamente.',
                                    'Could not prepare booking. Please try again.'
                                ),
                            o = t && t.fieldName,
                            i = o ? s(this, o) : null;
                        (i && (d(i), u(i)),
                            e.trackEvent('booking_error', {
                                stage: 'booking_form',
                                error_code: e.normalizeAnalyticsLabel(
                                    t && (t.code || t.message),
                                    'booking_prepare_failed'
                                ),
                            }),
                            r(n, 'error'),
                            e.showToast(n, 'error'));
                    } finally {
                        (this.removeAttribute('aria-busy'),
                            n &&
                                ((n.disabled = !1),
                                delete n.dataset.loading,
                                (n.innerHTML = i)));
                    }
                }),
                document.addEventListener('visibilitychange', () => {
                    'hidden' === document.visibilityState &&
                        f('form_visibility_hidden');
                }),
                window.addEventListener('pagehide', () => {
                    f('form_page_hide');
                }),
                { init: n }
            );
        },
    }));
