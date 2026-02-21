/**
 * Analytics gateway engine (deferred-loaded).
 * Keeps checkout session continuity even when analytics engine is not loaded yet.
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
        doctor: '',
    };

    function init(inputDeps) {
        deps = inputDeps || {};
        return window.PielAnalyticsGatewayEngine;
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

    function normalizeCheckoutSession(session) {
        const value = session && typeof session === 'object' ? session : {};
        return {
            active: value.active === true,
            completed: value.completed === true,
            startedAt: Number(value.startedAt) || 0,
            service: String(value.service || ''),
            doctor: String(value.doctor || ''),
        };
    }

    function getAnalyticsEngine() {
        if (deps && typeof deps.getAnalyticsEngine === 'function') {
            const engine = deps.getAnalyticsEngine();
            if (engine && typeof engine === 'object') {
                return engine;
            }
        }
        return null;
    }

    function loadAnalyticsEngineModule() {
        if (deps && typeof deps.loadAnalyticsEngine === 'function') {
            return Promise.resolve(deps.loadAnalyticsEngine());
        }
        const direct = getAnalyticsEngine();
        if (direct) {
            return Promise.resolve(direct);
        }
        return Promise.reject(
            new Error(
                'AnalyticsGatewayEngine dependency missing: loadAnalyticsEngine'
            )
        );
    }

    function trackEventFallback(eventName, params = {}) {
        if (!eventName || typeof eventName !== 'string') {
            return;
        }

        const payload = {
            event_category: 'conversion',
            ...(params || {}),
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

    function callAnalytics(methodName, args = []) {
        const direct = getAnalyticsEngine();
        if (direct && typeof direct[methodName] === 'function') {
            return Promise.resolve(direct[methodName].apply(direct, args));
        }

        return loadAnalyticsEngineModule().then((engine) => {
            if (!engine || typeof engine[methodName] !== 'function') {
                throw new Error(
                    `Analytics gateway action unavailable: ${methodName}`
                );
            }
            return engine[methodName].apply(engine, args);
        });
    }

    function mirrorSessionFromAnalytics() {
        const direct = getAnalyticsEngine();
        if (!direct || typeof direct.getCheckoutSession !== 'function') {
            return;
        }

        try {
            checkoutSession = normalizeCheckoutSession(
                direct.getCheckoutSession()
            );
        } catch (_) {
            // noop
        }
    }

    function trackEvent(eventName, params = {}) {
        const direct = getAnalyticsEngine();
        if (direct && typeof direct.trackEvent === 'function') {
            direct.trackEvent(eventName, params || {});
            return;
        }

        trackEventFallback(eventName, params || {});
    }

    function markBookingViewed(source = 'unknown') {
        const direct = getAnalyticsEngine();
        if (direct && typeof direct.markBookingViewed === 'function') {
            direct.markBookingViewed(source);
            return;
        }

        if (bookingViewTracked) {
            return;
        }
        bookingViewTracked = true;
        trackEventFallback('view_booking', { source });
    }

    function prefetchAvailabilityData(source = 'unknown') {
        const direct = getAnalyticsEngine();
        if (direct && typeof direct.prefetchAvailabilityData === 'function') {
            direct.prefetchAvailabilityData(source);
            return;
        }

        if (availabilityPrefetched) {
            return;
        }
        availabilityPrefetched = true;
        trackEventFallback('availability_prefetch', { source });
    }

    function prefetchReviewsData(source = 'unknown') {
        const direct = getAnalyticsEngine();
        if (direct && typeof direct.prefetchReviewsData === 'function') {
            direct.prefetchReviewsData(source);
            return;
        }

        if (reviewsPrefetched) {
            return;
        }
        reviewsPrefetched = true;
        trackEventFallback('reviews_prefetch', { source });
    }

    function initBookingFunnelObserver() {
        callAnalytics('initBookingFunnelObserver').catch(() => undefined);
    }

    function initDeferredSectionPrefetch() {
        callAnalytics('initDeferredSectionPrefetch').catch(() => undefined);
    }

    function startCheckoutSession(appointment) {
        checkoutSession = normalizeCheckoutSession({
            active: true,
            completed: false,
            startedAt: Date.now(),
            service:
                appointment && appointment.service ? appointment.service : '',
            doctor: appointment && appointment.doctor ? appointment.doctor : '',
        });

        callAnalytics('startCheckoutSession', [appointment]).catch(
            () => undefined
        );
    }

    function getCheckoutSession() {
        mirrorSessionFromAnalytics();
        return normalizeCheckoutSession(checkoutSession);
    }

    function setCheckoutSessionActive(active) {
        checkoutSession.active = active === true;
        callAnalytics('setCheckoutSessionActive', [active]).catch(
            () => undefined
        );
    }

    function completeCheckoutSession(method) {
        mirrorSessionFromAnalytics();
        if (!checkoutSession.active) {
            return;
        }

        checkoutSession.completed = true;

        const direct = getAnalyticsEngine();
        if (direct && typeof direct.completeCheckoutSession === 'function') {
            direct.completeCheckoutSession(method);
            return;
        }

        trackEventFallback('booking_confirmed', {
            payment_method: method || 'unknown',
            service: checkoutSession.service || '',
            doctor: checkoutSession.doctor || '',
        });
    }

    function maybeTrackCheckoutAbandon(reason = 'unknown') {
        mirrorSessionFromAnalytics();
        if (!checkoutSession.active || checkoutSession.completed) {
            return;
        }

        const direct = getAnalyticsEngine();
        if (direct && typeof direct.maybeTrackCheckoutAbandon === 'function') {
            direct.maybeTrackCheckoutAbandon(reason);
            return;
        }

        const startedAt = checkoutSession.startedAt || Date.now();
        const elapsedSec = Math.max(
            0,
            Math.round((Date.now() - startedAt) / 1000)
        );
        trackEventFallback('checkout_abandon', {
            service: checkoutSession.service || '',
            doctor: checkoutSession.doctor || '',
            elapsed_sec: elapsedSec,
            reason: normalizeAnalyticsLabel(reason, 'unknown'),
        });
    }

    window.Piel = window.Piel || {};
    window.Piel.AnalyticsGatewayEngine = {
        init,
        trackEvent,
        markBookingViewed,
        prefetchAvailabilityData,
        prefetchReviewsData,
        initBookingFunnelObserver,
        initDeferredSectionPrefetch,
        startCheckoutSession,
        getCheckoutSession,
        setCheckoutSessionActive,
        completeCheckoutSession,
        maybeTrackCheckoutAbandon,
    };
})();
