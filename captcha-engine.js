(function (window) {
    'use strict';
    let deps = null;
    let initialized = false;
    let siteKey = '';
    let scriptLoaded = false;
    let loadPromise = null;

    function init(inputDeps) {
        if (initialized) return api;
        deps = inputDeps || {};
        // Try to find site key in meta or deps
        siteKey = (deps.config && deps.config.recaptchaSiteKey) || '';

        // If not provided, try to find in DOM
        if (!siteKey) {
            const meta = document.querySelector(
                'meta[name="recaptcha-site-key"]'
            );
            if (meta) siteKey = meta.content;
        }

        // Check if global PIELARMONIA_RECAPTCHA_KEY exists (injected by PHP)
        if (!siteKey && window.PIELARMONIA_RECAPTCHA_KEY) {
            siteKey = window.PIELARMONIA_RECAPTCHA_KEY;
        }

        initialized = true;
        return api;
    }

    function loadScript() {
        if (!siteKey) return Promise.resolve(false);
        if (scriptLoaded) return Promise.resolve(true);
        if (loadPromise) return loadPromise;

        loadPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
            script.async = true;
            script.defer = true;
            script.onload = () => {
                scriptLoaded = true;
                resolve(true);
            };
            script.onerror = () => {
                console.warn('Failed to load reCAPTCHA');
                resolve(false); // resolve false to not block app
            };
            document.head.appendChild(script);
        });
        return loadPromise;
    }

    async function getToken(action) {
        if (!siteKey) return null;
        await loadScript();
        if (!window.grecaptcha) return null;

        return new Promise((resolve) => {
            window.grecaptcha.ready(async () => {
                try {
                    const token = await window.grecaptcha.execute(siteKey, {
                        action: action || 'submit',
                    });
                    resolve(token);
                } catch (e) {
                    console.error('reCAPTCHA execution failed', e);
                    resolve(null);
                }
            });
        });
    }

    const api = {
        init,
        getToken,
    };

    window.PielCaptchaEngine = api;
})(window);
