(function () {
    if (window.__auroraSentryLoaded) return;
    window.__auroraSentryLoaded = true;

    window.Piel = window.Piel || {};
    if (window.Sentry || window.Piel.Monitoring) return;

    window.Piel.Monitoring = { initialized: false };

    function ensureNoopFallback() {
        if (!window.Sentry) {
            window.Sentry = {
                init: function () {},
                captureException: function () {},
                captureMessage: function () {},
                withScope: function(cb) { cb({ setTag: () => {}, setExtra: () => {} }); }
            };
        }
    }

    function loadScriptWithTimeout(src, integrity, crossorigin, timeoutMs) {
        return new Promise((resolve, reject) => {
            let handled = false;
            const timer = setTimeout(() => {
                if (!handled) {
                    handled = true;
                    ensureNoopFallback();
                    reject(new Error('CDN Timeout'));
                }
            }, timeoutMs);

            const script = document.createElement('script');
            script.src = src;
            if (integrity) script.integrity = integrity;
            if (crossorigin) script.crossOrigin = crossorigin;
            script.async = true;
            script.onload = () => {
                if (!handled) {
                    handled = true;
                    clearTimeout(timer);
                    resolve();
                }
            };
            script.onerror = () => {
                if (!handled) {
                    handled = true;
                    clearTimeout(timer);
                    ensureNoopFallback();
                    reject(new Error('CDN Error'));
                }
            };
            document.head.appendChild(script);
        });
    }

    function bootstrapMonitoring() {
        fetch('/api.php?resource=monitoring-config')
            .then((response) => response.json())
            .then((config) => {
                const dsn = config.sentry_dsn_frontend || config.dsn;
                if (!config || !dsn) {
                    ensureNoopFallback();
                    return;
                }

                return loadScriptWithTimeout(
                    'https://browser.sentry-cdn.com/7.114.0/bundle.tracing.replay.min.js',
                    'sha384-51gMU5jRjjavIBCIRU4VzXEfEVtMgbLfcUfDPin3cOVRfmBDGNCWy59iG1JUn6jo',
                    'anonymous',
                    5000
                ).then(() => {
                    if (window.Sentry) {
                        const options = {
                            dsn: dsn,
                            environment: config.environment || config.sentry_environment || 'production',
                            tracesSampleRate: parseFloat(
                                config.tracesSampleRate || 1.0
                            ),
                            replaysSessionSampleRate: parseFloat(
                                config.replaysSessionSampleRate || 0.1
                            ),
                            replaysOnErrorSampleRate: parseFloat(
                                config.replaysOnErrorSampleRate || 1.0
                            ),
                        };

                        // Integrations should be auto-detected or manually added if needed.
                        // For the bundle, Sentry.Replay and Sentry.BrowserTracing are usually available.
                        const integrations = [];
                        if (window.Sentry.BrowserTracing) {
                            integrations.push(
                                new window.Sentry.BrowserTracing()
                            );
                        }
                        if (window.Sentry.Replay) {
                            integrations.push(new window.Sentry.Replay());
                        }
                        if (integrations.length > 0) {
                            options.integrations = integrations;
                        }

                        window.Sentry.init(options);
                        window.Piel.Monitoring.initialized = true;
                    }
                });
            })
            .catch(() => {
                // Silent fail to not disrupt user experience
                // console.error('Monitoring load error', err);
            });
    }

    function scheduleBootstrap() {
        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(bootstrapMonitoring, { timeout: 5000 });
            return;
        }
        window.setTimeout(bootstrapMonitoring, 1800);
    }

    if (document.readyState === 'complete') {
        scheduleBootstrap();
        return;
    }

    window.addEventListener('load', scheduleBootstrap, { once: true });
})();
