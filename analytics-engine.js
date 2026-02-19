/**
 * Analytics and booking funnel engine (deferred-loaded).
 * Handles event tracking, section prefetch, and checkout session state.
 */
(function () {
    'use strict';

    let deps = null;
    let bookingViewTracked = false;
    let availabilityPrefetched = false;
    let reviewsPrefetched = false;
    let checkoutSession = {
        active: false,
        completed: false,
        startedAt: 0,
        service: '',
        doctor: ''
    };

    function init(inputDeps) {
        deps = inputDeps || {};
        return window.PielAnalyticsEngine;
    }

    function trackEvent(eventName, params = {}) {
        if (!eventName || typeof eventName !== 'string') {
            return;
        }

        const payload = {
            event_category: 'conversion',
            ...params
        };

        if (typeof window.gtag === 'function') {
            window.gtag('event', eventName, payload);
            return;
        }

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            event: eventName,
            ...payload
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
            return deps.observeOnceWhenVisible(element, onVisible, options || {});
        }

        const { threshold = 0.2, rootMargin = '0px', onNoObserver } = options || {};
        if (!('IntersectionObserver' in window)) {
            if (typeof onNoObserver === 'function') {
                onNoObserver();
            }
            return false;
        }

        const observer = new IntersectionObserver((entries, currentObserver) => {
            const isVisible = entries.some((entry) => entry && entry.isIntersecting);
            if (!isVisible) {
                return;
            }
            currentObserver.disconnect();
            onVisible();
        }, {
            threshold,
            rootMargin
        });

        observer.observe(element);
        return true;
    }

    function prefetchAvailabilityData(source = 'unknown') {
        if (availabilityPrefetched) {
            return;
        }

        availabilityPrefetched = true;

        if (deps && typeof deps.loadAvailabilityData === 'function') {
            Promise.resolve(deps.loadAvailabilityData({ background: true })).catch(() => {
                availabilityPrefetched = false;
            });
        }

        trackEvent('availability_prefetch', { source });
    }

    function prefetchReviewsData(source = 'unknown') {
        if (reviewsPrefetched) {
            return;
        }

        reviewsPrefetched = true;

        if (deps && typeof deps.loadPublicReviews === 'function') {
            Promise.resolve(deps.loadPublicReviews({ background: true })).catch(() => {
                reviewsPrefetched = false;
            });
        }

        trackEvent('reviews_prefetch', { source });
    }

    function markBookingViewed(source = 'unknown') {
        if (bookingViewTracked) {
            return;
        }

        bookingViewTracked = true;
        trackEvent('view_booking', { source });
    }

    function initBookingFunnelObserver() {
        const bookingSection = document.getElementById('citas');
        if (!bookingSection) {
            return;
        }

        observeOnceWhenVisible(bookingSection, () => {
            markBookingViewed('observer');
            prefetchAvailabilityData('booking_section_visible');
        }, {
            threshold: 0.35,
            onNoObserver: () => {
                markBookingViewed('fallback_no_observer');
                prefetchAvailabilityData('fallback_no_observer');
            }
        });
    }

    function initDeferredSectionPrefetch() {
        const reviewsSection = document.getElementById('resenas');
        if (!reviewsSection) {
            return;
        }

        observeOnceWhenVisible(reviewsSection, () => {
            prefetchReviewsData('reviews_section_visible');
        }, {
            threshold: 0.2,
            rootMargin: '120px 0px',
            onNoObserver: () => {
                prefetchReviewsData('fallback_no_observer');
            }
        });
    }

    function startCheckoutSession(appointment) {
        checkoutSession = {
            active: true,
            completed: false,
            startedAt: Date.now(),
            service: appointment && appointment.service ? appointment.service : '',
            doctor: appointment && appointment.doctor ? appointment.doctor : ''
        };
    }

    function setCheckoutSessionActive(active) {
        checkoutSession.active = active === true;
    }

    function getCheckoutSession() {
        return {
            active: checkoutSession.active === true,
            completed: checkoutSession.completed === true,
            startedAt: Number(checkoutSession.startedAt) || 0,
            service: String(checkoutSession.service || ''),
            doctor: String(checkoutSession.doctor || '')
        };
    }

    function completeCheckoutSession(method) {
        if (!checkoutSession.active) {
            return;
        }

        checkoutSession.completed = true;
        trackEvent('booking_confirmed', {
            payment_method: method || 'unknown',
            service: checkoutSession.service || '',
            doctor: checkoutSession.doctor || ''
        });
    }

    function maybeTrackCheckoutAbandon(reason = 'unknown') {
        if (!checkoutSession.active || checkoutSession.completed) {
            return;
        }

        const startedAt = checkoutSession.startedAt || Date.now();
        const elapsedSec = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
        trackEvent('checkout_abandon', {
            service: checkoutSession.service || '',
            doctor: checkoutSession.doctor || '',
            elapsed_sec: elapsedSec,
            reason: normalizeAnalyticsLabel(reason, 'unknown')
        });
    }

    window.PielAnalyticsEngine = {
        init,
        trackEvent,
        normalizeAnalyticsLabel,
        markBookingViewed,
        prefetchAvailabilityData,
        prefetchReviewsData,
        initBookingFunnelObserver,
        initDeferredSectionPrefetch,
        startCheckoutSession,
        setCheckoutSessionActive,
        getCheckoutSession,
        completeCheckoutSession,
        maybeTrackCheckoutAbandon
    };
})();
