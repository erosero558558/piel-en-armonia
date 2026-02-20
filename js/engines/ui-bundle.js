/**
 * Theme engine (deferred-loaded).
 * Handles light/dark/system modes and system preference changes.
 */
(function () {
    'use strict';

    let deps = null;
    let themeTransitionTimer = null;
    let systemThemeListenerBound = false;

    function init(inputDeps) {
        deps = inputDeps || {};
        bindSystemThemeListener();
        return window.PielThemeEngine;
    }

    function getCurrentThemeMode() {
        if (deps && typeof deps.getCurrentThemeMode === 'function') {
            return deps.getCurrentThemeMode() || 'system';
        }
        return 'system';
    }

    function setCurrentThemeMode(mode) {
        if (deps && typeof deps.setCurrentThemeMode === 'function') {
            deps.setCurrentThemeMode(mode);
        }
    }

    function getThemeStorageKey() {
        if (deps && typeof deps.themeStorageKey === 'string' && deps.themeStorageKey) {
            return deps.themeStorageKey;
        }
        return 'themeMode';
    }

    function getSystemThemeQuery() {
        if (deps && typeof deps.getSystemThemeQuery === 'function') {
            return deps.getSystemThemeQuery();
        }
        return window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    }

    function isValidThemeMode(mode) {
        const normalized = String(mode || '').trim();
        const validModes = deps ? deps.validThemeModes : null;
        if (Array.isArray(validModes)) {
            return validModes.includes(normalized);
        }
        return normalized === 'light' || normalized === 'dark' || normalized === 'system';
    }

    function resolveThemeMode(mode) {
        const currentMode = mode || getCurrentThemeMode();
        if (currentMode === 'system') {
            const systemThemeQuery = getSystemThemeQuery();
            if (systemThemeQuery && systemThemeQuery.matches) {
                return 'dark';
            }
            return 'light';
        }
        return currentMode;
    }

    function applyThemeMode(mode) {
        const currentMode = mode || getCurrentThemeMode();
        const resolvedTheme = resolveThemeMode(currentMode);
        document.documentElement.setAttribute('data-theme-mode', currentMode);
        document.documentElement.setAttribute('data-theme', resolvedTheme);
    }

    function updateThemeButtons() {
        const currentMode = getCurrentThemeMode();
        document.querySelectorAll('.theme-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.themeMode === currentMode);
        });
    }

    function animateThemeTransition() {
        if (!document.body) {
            return;
        }

        if (themeTransitionTimer) {
            clearTimeout(themeTransitionTimer);
        }

        document.body.classList.remove('theme-transition');
        void document.body.offsetWidth;
        document.body.classList.add('theme-transition');

        themeTransitionTimer = setTimeout(() => {
            document.body.classList.remove('theme-transition');
        }, 320);
    }

    function setThemeMode(mode) {
        if (!isValidThemeMode(mode)) {
            return;
        }

        setCurrentThemeMode(mode);
        localStorage.setItem(getThemeStorageKey(), mode);
        animateThemeTransition();
        applyThemeMode(mode);
        updateThemeButtons();
    }

    function initThemeMode() {
        const storedTheme = localStorage.getItem(getThemeStorageKey()) || 'system';
        const nextMode = isValidThemeMode(storedTheme) ? storedTheme : 'system';
        setCurrentThemeMode(nextMode);
        applyThemeMode(nextMode);
        updateThemeButtons();
    }

    function handleSystemThemeChange() {
        if (getCurrentThemeMode() === 'system') {
            applyThemeMode('system');
        }
    }

    function bindSystemThemeListener() {
        if (systemThemeListenerBound) {
            return;
        }

        const systemThemeQuery = getSystemThemeQuery();
        if (!systemThemeQuery) {
            return;
        }

        if (typeof systemThemeQuery.addEventListener === 'function') {
            systemThemeQuery.addEventListener('change', handleSystemThemeChange);
            systemThemeListenerBound = true;
            return;
        }

        if (typeof systemThemeQuery.addListener === 'function') {
            systemThemeQuery.addListener(handleSystemThemeChange);
            systemThemeListenerBound = true;
        }
    }

    window.PielThemeEngine = {
        init,
        setThemeMode,
        initThemeMode,
        applyThemeMode
    };
})();
(function () {
    'use strict';

    let deps = null;
    let initialized = false;
    let escapeListenerBound = false;
    let backGestureBound = false;
    let isClosingViaBack = false;

    function closeModalElement(modal) {
        if (!modal) {
            return;
        }

        if (modal.id === 'paymentModal') {
            if (deps && typeof deps.closePaymentModal === 'function') {
                deps.closePaymentModal();
            }
            return;
        }

        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    function bindBackdropClose() {
        document.querySelectorAll('.modal').forEach((modal) => {
            if (modal.dataset.modalUxBackdropBound === 'true') {
                return;
            }
            modal.dataset.modalUxBackdropBound = 'true';
            modal.addEventListener('click', function (e) {
                if (e.target === this) {
                    closeModalElement(this);
                }
            });
        });
    }

    function bindEscapeClose() {
        if (escapeListenerBound) {
            return;
        }
        escapeListenerBound = true;

        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') {
                return;
            }

            document.querySelectorAll('.modal').forEach((modal) => {
                if (modal.id === 'paymentModal' && modal.classList.contains('active')) {
                    if (deps && typeof deps.closePaymentModal === 'function') {
                        deps.closePaymentModal();
                    }
                    return;
                }
                modal.classList.remove('active');
            });

            document.body.style.overflow = '';
            if (deps && typeof deps.toggleMobileMenu === 'function') {
                deps.toggleMobileMenu(false);
            }
        });
    }

    function setupBackGesture() {
        if (backGestureBound) {
            return;
        }
        backGestureBound = true;

        window.addEventListener('popstate', function () {
            isClosingViaBack = true;
            let closedAny = false;

            document.querySelectorAll('.modal.active').forEach((modal) => {
                closedAny = true;
                if (modal.id === 'paymentModal') {
                    if (deps && typeof deps.closePaymentModal === 'function') {
                        deps.closePaymentModal({ skipAbandonTrack: false, reason: 'back_gesture' });
                    }
                } else {
                    modal.classList.remove('active');
                }
            });

            const mobileMenu = document.getElementById('mobileMenu');
            if (mobileMenu && mobileMenu.classList.contains('active')) {
                closedAny = true;
                if (deps && typeof deps.toggleMobileMenu === 'function') {
                    deps.toggleMobileMenu(false);
                } else {
                    mobileMenu.classList.remove('active');
                }
            }

            if (closedAny) {
                document.body.style.overflow = '';
            }

            setTimeout(() => {
                isClosingViaBack = false;
            }, 50);
        });

        const observer = new MutationObserver((mutations) => {
            let opened = false;
            let closed = false;

            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    const target = mutation.target;
                    if (target.classList.contains('active')) {
                        opened = true;
                    } else {
                        closed = true;
                    }
                }
            });

            if (opened) {
                if (!history.state || !history.state.modalOpen) {
                    history.pushState({ modalOpen: true }, '');
                }
            } else if (closed) {
                if (!isClosingViaBack && history.state && history.state.modalOpen) {
                    history.back();
                }
            }
        });

        document.querySelectorAll('.modal, #mobileMenu').forEach((el) => {
            observer.observe(el, { attributes: true, attributeFilter: ['class'] });
        });
    }

    function init(inputDeps) {
        deps = inputDeps || deps;
        bindBackdropClose();
        bindEscapeClose();
        setupBackGesture();
        initialized = true;
        return window.PielModalUxEngine;
    }

    function isInitialized() {
        return initialized;
    }

    window.PielModalUxEngine = {
        init,
        isInitialized
    };
})();
(function () {
    'use strict';
    // build-sync: 20260219-sync1

    let deps = null;
    let activeIcsUrl = '';

    function getLang() {
        return deps && typeof deps.getCurrentLang === 'function' ? deps.getCurrentLang() : 'es';
    }

    function getAppointment() {
        if (deps && typeof deps.getCurrentAppointment === 'function') {
            return deps.getCurrentAppointment() || {};
        }
        return {};
    }

    function getClinicAddress() {
        if (deps && typeof deps.getClinicAddress === 'function') {
            return String(deps.getClinicAddress() || '');
        }
        return '';
    }

    function escapeHtml(value) {
        if (deps && typeof deps.escapeHtml === 'function') {
            return deps.escapeHtml(String(value || ''));
        }
        const div = document.createElement('div');
        div.textContent = String(value || '');
        return div.innerHTML;
    }

    function getDoctorName(doctor) {
        const names = {
            rosero: 'Dr. Javier Rosero',
            narvaez: 'Dra. Carolina Narvaez',
            indiferente: 'Cualquiera disponible'
        };
        return names[doctor] || doctor || '-';
    }

    function getPaymentMethodLabel(method) {
        const lang = getLang();
        const map = {
            card: lang === 'es' ? 'Tarjeta' : 'Card',
            transfer: lang === 'es' ? 'Transferencia' : 'Transfer',
            cash: lang === 'es' ? 'Efectivo' : 'Cash',
            unpaid: lang === 'es' ? 'Pendiente' : 'Pending'
        };
        const key = String(method || '').toLowerCase();
        return map[key] || (method || map.unpaid);
    }

    function getPaymentStatusLabel(status) {
        const es = {
            paid: 'Pagado',
            pending_cash: 'Pago en consultorio',
            pending_transfer_review: 'Comprobante en validacion',
            pending_transfer: 'Transferencia pendiente',
            pending_gateway: 'Procesando pago',
            pending: 'Pendiente',
            failed: 'Fallido'
        };
        const en = {
            paid: 'Paid',
            pending_cash: 'Pay at clinic',
            pending_transfer_review: 'Proof under review',
            pending_transfer: 'Transfer pending',
            pending_gateway: 'Processing payment',
            pending: 'Pending',
            failed: 'Failed'
        };
        const key = String(status || '').toLowerCase();
        const map = getLang() === 'es' ? es : en;
        return map[key] || (status || map.pending);
    }

    function getServiceName(service) {
        const names = {
            consulta: 'Consulta Dermatologica',
            telefono: 'Consulta Telefónica',
            video: 'Video Consulta',
            laser: 'Tratamiento Láser',
            rejuvenecimiento: 'Rejuvenecimiento'
        };
        return names[service] || service || '-';
    }

    function formatDateForGoogle(date) {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    }

    function formatDateForIcs(date) {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0];
    }

    function generateGoogleCalendarUrl(appointment, startDate, endDate) {
        const title = encodeURIComponent('Cita - Piel en Armonia');
        const details = encodeURIComponent(
            `Servicio: ${getServiceName(appointment.service)}\nDoctor: ${getDoctorName(appointment.doctor)}\nPrecio: ${appointment.price || ''}`
        );
        const location = encodeURIComponent(getClinicAddress());

        return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatDateForGoogle(startDate)}/${formatDateForGoogle(endDate)}&details=${details}&location=${location}`;
    }

    function generateIcs(appointment, startDate, endDate) {
        return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Piel en Armonia//Consulta//ES
BEGIN:VEVENT
DTSTART:${formatDateForIcs(startDate)}
DTEND:${formatDateForIcs(endDate)}
SUMMARY:Cita - Piel en Armonia
DESCRIPTION:Servicio: ${getServiceName(appointment.service)}\\nDoctor: ${getDoctorName(appointment.doctor)}\\nPrecio: ${appointment.price || ''}
LOCATION:${getClinicAddress()}
END:VEVENT
END:VCALENDAR`;
    }

    function cleanupIcsUrl() {
        if (activeIcsUrl) {
            URL.revokeObjectURL(activeIcsUrl);
            activeIcsUrl = '';
        }
    }

    function showSuccessModal(emailSent) {
        const modal = document.getElementById('successModal');
        if (!modal) return;

        const appointment = getAppointment();
        const detailsDiv = document.getElementById('appointmentDetails');
        const successDesc = modal.querySelector('[data-i18n="success_desc"]');
        const lang = getLang();

        if (successDesc) {
            if (emailSent) {
                successDesc.textContent = lang === 'es'
                    ? 'Enviamos un correo de confirmacion con los detalles de tu cita.'
                    : 'A confirmation email with your appointment details was sent.';
            } else {
                successDesc.textContent = lang === 'es'
                    ? 'Tu cita fue registrada. Te contactaremos para confirmar detalles.'
                    : 'Your appointment was saved. We will contact you to confirm details.';
            }
        }

        const rawStart = appointment.date && appointment.time
            ? new Date(`${appointment.date}T${appointment.time}`)
            : new Date();
        const startDate = Number.isNaN(rawStart.getTime()) ? new Date() : rawStart;
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

        const googleCalendarUrl = generateGoogleCalendarUrl(appointment, startDate, endDate);
        const icsContent = generateIcs(appointment, startDate, endDate);
        const icsBlob = new Blob([icsContent], { type: 'text/calendar' });

        cleanupIcsUrl();
        activeIcsUrl = URL.createObjectURL(icsBlob);

        if (detailsDiv) {
            detailsDiv.innerHTML = `
                <div class="success-details-card">
                    <p class="success-details-line"><strong>${lang === 'es' ? 'Doctor:' : 'Doctor:'}</strong> ${escapeHtml(getDoctorName(appointment.doctor))}</p>
                    <p class="success-details-line"><strong>${lang === 'es' ? 'Fecha:' : 'Date:'}</strong> ${escapeHtml(appointment.date || '-')}</p>
                    <p class="success-details-line"><strong>${lang === 'es' ? 'Hora:' : 'Time:'}</strong> ${escapeHtml(appointment.time || '-')}</p>
                    <p class="success-details-line"><strong>${lang === 'es' ? 'Pago:' : 'Payment:'}</strong> ${escapeHtml(getPaymentMethodLabel(appointment.paymentMethod))} - ${escapeHtml(getPaymentStatusLabel(appointment.paymentStatus))}</p>
                    <p><strong>${lang === 'es' ? 'Total:' : 'Total:'}</strong> ${escapeHtml(appointment.price || '$0.00')}</p>
                </div>
                <div class="success-calendar-actions">
                    <a href="${googleCalendarUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary success-calendar-btn">
                        <i class="fab fa-google"></i> Google Calendar
                    </a>
                    <a href="${activeIcsUrl}" download="cita-piel-en-armonia.ics" class="btn btn-secondary success-calendar-btn">
                        <i class="fas fa-calendar-alt"></i> Outlook/Apple
                    </a>
                </div>
            `;
        }

        modal.classList.add('active');
    }

    function closeSuccessModal() {
        const modal = document.getElementById('successModal');
        if (modal) {
            modal.classList.remove('active');
        }
        document.body.style.overflow = '';
        cleanupIcsUrl();
    }

    function init(inputDeps) {
        deps = inputDeps || deps;
        return window.PielSuccessModalEngine;
    }

    window.PielSuccessModalEngine = {
        init,
        showSuccessModal,
        closeSuccessModal
    };
})();
/**
 * Consent and GA4 engine (deferred-loaded).
 * Handles cookie consent state and analytics bootstrap.
 */
(function () {
    'use strict';

    let deps = null;

    function init(inputDeps) {
        deps = inputDeps || {};
        return window.PielConsentEngine;
    }

    function getCurrentLang() {
        if (deps && typeof deps.getCurrentLang === 'function') {
            return deps.getCurrentLang() || 'es';
        }
        return 'es';
    }

    function showToastSafe(message, type) {
        if (deps && typeof deps.showToast === 'function') {
            deps.showToast(message, type || 'info');
        }
    }

    function trackEventSafe(eventName, payload) {
        if (deps && typeof deps.trackEvent === 'function') {
            deps.trackEvent(eventName, payload || {});
        }
    }

    function getConsentStorageKey() {
        if (deps && typeof deps.cookieConsentKey === 'string' && deps.cookieConsentKey) {
            return deps.cookieConsentKey;
        }
        return 'pa_cookie_consent_v1';
    }

    function getMeasurementId() {
        if (deps && typeof deps.gaMeasurementId === 'string' && deps.gaMeasurementId) {
            return deps.gaMeasurementId;
        }
        return 'G-GYY8PE5M8W';
    }

    function getCookieConsent() {
        try {
            const raw = localStorage.getItem(getConsentStorageKey());
            if (!raw) return '';
            const parsed = JSON.parse(raw);
            return typeof parsed?.status === 'string' ? parsed.status : '';
        } catch (error) {
            return '';
        }
    }

    function setCookieConsent(status) {
        const normalized = status === 'accepted' ? 'accepted' : 'rejected';
        try {
            localStorage.setItem(getConsentStorageKey(), JSON.stringify({
                status: normalized,
                at: new Date().toISOString()
            }));
        } catch (error) {
            // noop
        }
    }

    function initGA4() {
        if (window._ga4Loaded) return;
        if (getCookieConsent() !== 'accepted') return;

        window._ga4Loaded = true;

        const measurementId = getMeasurementId();
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
        document.head.appendChild(script);

        window.dataLayer = window.dataLayer || [];
        function gtag() { window.dataLayer.push(arguments); }
        window.gtag = gtag;
        gtag('js', new Date());
        gtag('consent', 'update', { analytics_storage: 'granted' });
        gtag('config', measurementId);
    }

    function setBannerActiveState(banner, isActive) {
        if (!banner) {
            return;
        }

        const active = isActive === true;
        banner.classList.toggle('active', active);

        if (document.body) {
            document.body.classList.toggle('cookie-banner-active', active);
        }
    }

    function bindCookieButtons(acceptBtn, rejectBtn, banner) {
        if (acceptBtn && !acceptBtn.dataset.cookieBound) {
            acceptBtn.dataset.cookieBound = 'true';
            acceptBtn.addEventListener('click', () => {
                setCookieConsent('accepted');
                setBannerActiveState(banner, false);
                showToastSafe(
                    getCurrentLang() === 'es'
                        ? 'Preferencias de cookies guardadas.'
                        : 'Cookie preferences saved.',
                    'success'
                );
                initGA4();
                trackEventSafe('cookie_consent_update', { status: 'accepted' });
            });
        }

        if (rejectBtn && !rejectBtn.dataset.cookieBound) {
            rejectBtn.dataset.cookieBound = 'true';
            rejectBtn.addEventListener('click', () => {
                setCookieConsent('rejected');
                setBannerActiveState(banner, false);
                showToastSafe(
                    getCurrentLang() === 'es'
                        ? 'Solo se mantendran cookies esenciales.'
                        : 'Only essential cookies will be kept.',
                    'info'
                );
                trackEventSafe('cookie_consent_update', { status: 'rejected' });
            });
        }
    }

    function initCookieBanner() {
        const banner = document.getElementById('cookieBanner');
        if (!banner) return false;

        const consent = getCookieConsent();
        if (consent === 'accepted' || consent === 'rejected') {
            setBannerActiveState(banner, false);
        } else {
            setBannerActiveState(banner, true);
        }

        const acceptBtn = document.getElementById('cookieAcceptBtn');
        const rejectBtn = document.getElementById('cookieRejectBtn');
        bindCookieButtons(acceptBtn, rejectBtn, banner);
        return true;
    }

    window.PielConsentEngine = {
        init,
        getCookieConsent,
        setCookieConsent,
        initGA4,
        initCookieBanner
    };
})();
(function () {
    'use strict';
    // build-sync: 20260220-sync2

    let initialized = false;

    function initScrollAnimations() {
        const selector = '.service-card, .team-card, .section-header, .tele-card, .review-card, .showcase-hero, .showcase-card, .showcase-split, .clinic-info, .clinic-map, .footer-content > *, .appointment-form-container, .appointment-info';
        const targets = document.querySelectorAll(selector);
        if (!targets.length) return;

        const shouldSkipObserver = window.innerWidth < 900
            || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

        if (shouldSkipObserver) {
            targets.forEach((el) => el.classList.add('visible'));
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            let intersectCount = 0;
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const delay = intersectCount * 100;
                    entry.target.style.transitionDelay = `${delay}ms`;
                    intersectCount++;

                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            root: null,
            rootMargin: '0px 0px -100px 0px',
            threshold: 0.1
        });

        targets.forEach((el) => {
            el.classList.add('animate-on-scroll');
            observer.observe(el);
        });
    }

    function initParallax() {
        const heroImage = document.querySelector('.hero-image-container');
        if (!heroImage) return;
        if (window.innerWidth < 1100) return;
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        let ticking = false;
        window.addEventListener('scroll', () => {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(() => {
                const scrolled = window.pageYOffset;
                const rate = Math.min(80, scrolled * 0.12);
                heroImage.style.transform = `translateY(calc(-50% + ${rate}px))`;
                ticking = false;
            });
        }, { passive: true });
    }

    function initNavbarScroll() {
        const nav = document.querySelector('.nav');
        if (!nav) return;

        let ticking = false;
        let isScrolled = false;

        const applyScrollState = () => {
            const shouldBeScrolled = window.scrollY > 50;
            if (shouldBeScrolled !== isScrolled) {
                nav.classList.toggle('scrolled', shouldBeScrolled);
                isScrolled = shouldBeScrolled;
            }
            ticking = false;
        };

        window.addEventListener('scroll', () => {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(applyScrollState);
        }, { passive: true });

        applyScrollState();
    }

    function initMapLoader() {
        const placeholder = document.getElementById('mapPlaceholder');
        if (!placeholder) return;

        const loadMap = () => {
            const src = placeholder.dataset.src;
            if (!src) return;

            const iframe = document.createElement('iframe');
            iframe.src = src;
            iframe.width = '100%';
            iframe.height = '100%';
            iframe.allowFullscreen = true;
            iframe.loading = 'lazy';
            iframe.referrerPolicy = 'no-referrer-when-downgrade';
            iframe.style.border = '0';

            placeholder.innerHTML = '';
            placeholder.appendChild(iframe);
            placeholder.classList.remove('map-placeholder');
            placeholder.style.backgroundColor = 'transparent';
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    loadMap();
                    observer.disconnect();
                }
            });
        }, { rootMargin: '200px' });

        observer.observe(placeholder);
        placeholder.addEventListener('click', loadMap, { once: true });
    }

    function initBlurUpImages() {
        const images = document.querySelectorAll('.blur-up img');
        images.forEach(img => {
            if (img.complete) {
                img.classList.add('loaded');
            } else {
                img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
            }
        });
    }

    function initDeferredVisualEffects() {
        const run = () => {
            initScrollAnimations();
            initParallax();
            initMapLoader();
            initBlurUpImages();
        };

        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(run, { timeout: 1200 });
        } else {
            setTimeout(run, 180);
        }
    }

    function init() {
        if (initialized) return;
        initialized = true;
        initNavbarScroll();
        initDeferredVisualEffects();
    }

    window.PielUiEffects = {
        init
    };
})();
