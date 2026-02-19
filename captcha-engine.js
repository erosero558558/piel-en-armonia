(function () {
    'use strict';

    let deps = null;
    let siteKey = '';
    let scriptLoaded = false;
    let scriptPromise = null;

    function init(inputDeps) {
        deps = inputDeps || {};
        return window.PielCaptchaEngine;
    }

    async function loadConfig() {
        if (siteKey) return siteKey;
        if (deps && typeof deps.apiRequest === 'function') {
            try {
                // Request config. This request must NOT require captcha itself.
                const config = await deps.apiRequest('captcha-config', { background: true });
                siteKey = config.siteKey || '';
            } catch (e) {
                console.warn('Captcha config failed', e);
            }
        }
        return siteKey;
    }

    async function loadScript() {
        await loadConfig();
        if (!siteKey) return false;

        if (scriptLoaded) return true;
        if (scriptPromise) return scriptPromise;

        scriptPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
            script.async = true;
            script.defer = true;
            script.onload = () => {
                scriptLoaded = true;
                resolve(true);
            };
            script.onerror = () => {
                scriptPromise = null;
                reject(new Error('Captcha script failed to load'));
            };
            document.head.appendChild(script);
        });

        return scriptPromise;
    }

    async function getToken(action) {
        try {
            const loaded = await loadScript();
            if (!loaded || !window.grecaptcha) return '';

            return new Promise((resolve) => {
                window.grecaptcha.ready(() => {
                    window.grecaptcha.execute(siteKey, { action: action })
                        .then(token => resolve(token))
                        .catch(err => {
                            console.warn('Captcha execution failed', err);
                            resolve('');
                        });
                });
            });
        } catch (e) {
            console.warn('Captcha error', e);
            return '';
        }
    }

    window.PielCaptchaEngine = {
        init,
        getToken
    };
})();
