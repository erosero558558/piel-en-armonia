(function () {
    'use strict';

    (function () {

        let deps = null;

        // Helper to access state via deps
        function getCheckoutSessionData() {
            if (deps && typeof deps.getCheckoutSession === 'function') {
                return deps.getCheckoutSession() || {};
            }
            return {};
        }

        function setCheckoutSessionData(data) {
            if (deps && typeof deps.setCheckoutSession === 'function') {
                deps.setCheckoutSession(data);
            }
        }

        function getBookingViewTracked() {
            if (deps && typeof deps.getBookingViewTracked === 'function') {
                return deps.getBookingViewTracked() === true;
            }
            return false;
        }

        function setBookingViewTracked(val) {
            if (deps && typeof deps.setBookingViewTracked === 'function') {
                deps.setBookingViewTracked(val === true);
            }
        }

        function getAvailabilityPrefetched() {
            if (deps && typeof deps.getAvailabilityPrefetched === 'function') {
                return deps.getAvailabilityPrefetched() === true;
            }
            return false;
        }

        function setAvailabilityPrefetched(val) {
            if (deps && typeof deps.setAvailabilityPrefetched === 'function') {
                deps.setAvailabilityPrefetched(val === true);
            }
        }

        function getReviewsPrefetched() {
            if (deps && typeof deps.getReviewsPrefetched === 'function') {
                return deps.getReviewsPrefetched() === true;
            }
            return false;
        }

        function setReviewsPrefetched(val) {
            if (deps && typeof deps.setReviewsPrefetched === 'function') {
                deps.setReviewsPrefetched(val === true);
            }
        }


        function init(inputDeps) {
            deps = inputDeps || {};
            return window.Piel.AnalyticsEngine;
        }

        function trackEvent(eventName, params = {}) {
            if (!eventName || typeof eventName !== 'string') {
                return;
            }

            if (deps && typeof deps.trackEventToServer === 'function') {
                try {
                    deps.trackEventToServer(eventName, params);
                } catch (_) {
                    // Ignore telemetry forwarding failures.
                }
            }

            const payload = {
                event_category: 'conversion',
                ...params,
            };

            if (typeof window.gtag === 'function') {
                window.gtag('event', eventName, payload);
                return;
            }

            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({
                event: eventName,
                ...payload,
            });
        }

        function normalizeAnalyticsLabel(value, fallback = 'unknown') {
            if (value === null || value === undefined) {
                return fallback;
            }

            const normalized = String(value)
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_+|_+$/g, '')
                .slice(0, 64);

            return normalized || fallback;
        }

        function observeOnceWhenVisible(element, onVisible, options = {}) {
            if (!element || typeof onVisible !== 'function') {
                return false;
            }

            if (deps && typeof deps.observeOnceWhenVisible === 'function') {
                return deps.observeOnceWhenVisible(
                    element,
                    onVisible,
                    options || {}
                );
            }

            const {
                threshold = 0.2,
                rootMargin = '0px',
                onNoObserver,
            } = options || {};
            if (!('IntersectionObserver' in window)) {
                if (typeof onNoObserver === 'function') {
                    onNoObserver();
                }
                return false;
            }

            const observer = new IntersectionObserver(
                (entries, currentObserver) => {
                    const isVisible = entries.some(
                        (entry) => entry && entry.isIntersecting
                    );
                    if (!isVisible) {
                        return;
                    }
                    currentObserver.disconnect();
                    onVisible();
                },
                {
                    threshold,
                    rootMargin,
                }
            );

            observer.observe(element);
            return true;
        }

        function prefetchAvailabilityData(source = 'unknown') {
            if (getAvailabilityPrefetched()) {
                return;
            }

            setAvailabilityPrefetched(true);

            if (deps && typeof deps.loadAvailabilityData === 'function') {
                Promise.resolve(
                    deps.loadAvailabilityData({ background: true })
                ).catch(() => {
                    setAvailabilityPrefetched(false);
                });
            }

            trackEvent('availability_prefetch', { source });
        }

        function prefetchReviewsData(source = 'unknown') {
            if (getReviewsPrefetched()) {
                return;
            }

            setReviewsPrefetched(true);

            if (deps && typeof deps.loadPublicReviews === 'function') {
                Promise.resolve(deps.loadPublicReviews({ background: true })).catch(
                    () => {
                        setReviewsPrefetched(false);
                    }
                );
            }

            trackEvent('reviews_prefetch', { source });
        }

        function markBookingViewed(source = 'unknown') {
            if (getBookingViewTracked()) {
                return;
            }

            setBookingViewTracked(true);
            trackEvent('view_booking', { source });
        }

        function initBookingFunnelObserver() {
            const bookingSection = document.getElementById('citas');
            if (!bookingSection) {
                return;
            }

            observeOnceWhenVisible(
                bookingSection,
                () => {
                    markBookingViewed('observer');
                    prefetchAvailabilityData('booking_section_visible');
                },
                {
                    threshold: 0.35,
                    onNoObserver: () => {
                        markBookingViewed('fallback_no_observer');
                        prefetchAvailabilityData('fallback_no_observer');
                    },
                }
            );
        }

        function initDeferredSectionPrefetch() {
            const reviewsSection = document.getElementById('resenas');
            if (!reviewsSection) {
                return;
            }

            observeOnceWhenVisible(
                reviewsSection,
                () => {
                    prefetchReviewsData('reviews_section_visible');
                },
                {
                    threshold: 0.2,
                    rootMargin: '120px 0px',
                    onNoObserver: () => {
                        prefetchReviewsData('fallback_no_observer');
                    },
                }
            );
        }

        function startCheckoutSession(appointment, metadata = {}) {
            const checkoutEntry = normalizeAnalyticsLabel(
                metadata && (metadata.checkoutEntry || metadata.entry),
                'unknown'
            );
            const initialStep = normalizeAnalyticsLabel(
                metadata && metadata.step,
                'checkout_started'
            );

            const newSession = {
                active: true,
                completed: false,
                startedAt: Date.now(),
                service:
                    appointment && appointment.service ? appointment.service : '',
                doctor: appointment && appointment.doctor ? appointment.doctor : '',
                step: initialStep,
                entry: checkoutEntry,
                paymentMethod: '',
            };

            setCheckoutSessionData(newSession);
        }

        function setCheckoutStep(step, metadata = {}) {
            const session = getCheckoutSessionData();
            if (!session.active || session.completed) {
                return;
            }

            session.step = normalizeAnalyticsLabel(
                step,
                session.step || 'unknown'
            );

            if (metadata && typeof metadata === 'object') {
                if (metadata.service) {
                    session.service = String(metadata.service);
                }
                if (metadata.doctor) {
                    session.doctor = String(metadata.doctor);
                }
                if (metadata.paymentMethod) {
                    session.paymentMethod = normalizeAnalyticsLabel(
                        metadata.paymentMethod,
                        'unknown'
                    );
                }
                if (metadata.checkoutEntry || metadata.entry) {
                    session.entry = normalizeAnalyticsLabel(
                        metadata.checkoutEntry || metadata.entry,
                        session.entry || 'unknown'
                    );
                }
            }
            setCheckoutSessionData(session);
        }

        function setCheckoutSessionActive(active) {
            if (deps && typeof deps.setCheckoutSessionActive === 'function') {
                deps.setCheckoutSessionActive(active === true);
                return;
            }
            // Fallback if specific setter not available (should use full object setter)
            const session = getCheckoutSessionData();
            session.active = active === true;
            setCheckoutSessionData(session);
        }

        function getCheckoutSession() {
            const session = getCheckoutSessionData();
            return {
                active: session.active === true,
                completed: session.completed === true,
                startedAt: Number(session.startedAt) || 0,
                service: String(session.service || ''),
                doctor: String(session.doctor || ''),
                step: String(session.step || ''),
                entry: String(session.entry || ''),
                paymentMethod: String(session.paymentMethod || ''),
            };
        }

        function completeCheckoutSession(method) {
            const session = getCheckoutSessionData();
            if (!session.active) {
                return;
            }

            session.completed = true;
            session.step = 'booking_confirmed';
            session.paymentMethod = normalizeAnalyticsLabel(
                method,
                session.paymentMethod || 'unknown'
            );
            setCheckoutSessionData(session);

            trackEvent('booking_confirmed', {
                payment_method: method || 'unknown',
                service: session.service || '',
                doctor: session.doctor || '',
                checkout_step: session.step || 'booking_confirmed',
                checkout_entry: session.entry || 'unknown',
            });
        }

        function maybeTrackCheckoutAbandon(reason = 'unknown') {
            const session = getCheckoutSessionData();
            if (!session.active || session.completed) {
                return;
            }

            const startedAt = session.startedAt || Date.now();
            const elapsedSec = Math.max(
                0,
                Math.round((Date.now() - startedAt) / 1000)
            );
            trackEvent('checkout_abandon', {
                service: session.service || '',
                doctor: session.doctor || '',
                payment_method: session.paymentMethod || 'unknown',
                elapsed_sec: elapsedSec,
                reason: normalizeAnalyticsLabel(reason, 'unknown'),
                checkout_step: session.step || 'unknown',
                checkout_entry: session.entry || 'unknown',
            });
        }

        window.Piel = window.Piel || {};
        window.Piel.AnalyticsEngine = {
            init,
            trackEvent,
            normalizeAnalyticsLabel,
            markBookingViewed,
            prefetchAvailabilityData,
            prefetchReviewsData,
            initBookingFunnelObserver,
            initDeferredSectionPrefetch,
            startCheckoutSession,
            setCheckoutStep,
            setCheckoutSessionActive,
            getCheckoutSession,
            completeCheckoutSession,
            maybeTrackCheckoutAbandon,
        };

    })();

})();
