(function() {
    // Avoid re-initialization
    if (window.Sentry || window.PielMonitoring) return;

    window.PielMonitoring = { initialized: false };

    function loadScript(src, integrity, crossorigin) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            if (integrity) script.integrity = integrity;
            if (crossorigin) script.crossOrigin = crossorigin;
            script.async = true;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    fetch('/api.php?resource=monitoring-config')
        .then(response => response.json())
        .then(config => {
            if (!config || !config.enabled || !config.dsn) {
                // Monitoring not configured or disabled
                return;
            }

            // Load Sentry Browser SDK (v7.x)
            return loadScript('https://browser.sentry-cdn.com/7.x/bundle.min.js', null, 'anonymous')
                .then(() => {
                    if (window.Sentry) {
                        const options = {
                            dsn: config.dsn,
                            environment: config.environment || 'production',
                            tracesSampleRate: parseFloat(config.tracesSampleRate || 1.0),
                            replaysSessionSampleRate: parseFloat(config.replaysSessionSampleRate || 0.1),
                            replaysOnErrorSampleRate: parseFloat(config.replaysOnErrorSampleRate || 1.0),
                        };

                        // Integrations should be auto-detected or manually added if needed.
                        // For the bundle, Sentry.Replay and Sentry.BrowserTracing are usually available.
                        const integrations = [];
                        if (window.Sentry.BrowserTracing) {
                            integrations.push(new window.Sentry.BrowserTracing());
                        }
                        if (window.Sentry.Replay) {
                            integrations.push(new window.Sentry.Replay());
                        }
                        if (integrations.length > 0) {
                            options.integrations = integrations;
                        }

                        window.Sentry.init(options);
                        window.PielMonitoring.initialized = true;
                    }
                });
        })
        .catch(err => {
            // Silent fail to not disrupt user experience
            // console.error('Monitoring load error', err);
        });
})();
