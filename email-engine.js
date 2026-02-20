(function (window) {
    'use strict';
    let deps = null;
    let initialized = false;

    function init(inputDeps) {
        if (initialized) return api;
        deps = inputDeps || {};
        initialized = true;
        return api;
    }

    // Helper for validating email format
    function validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    // This function could eventually call a backend endpoint
    async function sendEmail(payload) {
        // Implementation for future use or contact form
        // For now, it might be used by other modules to trigger generic email sending if endpoint existed
        // But currently appointments/callbacks send emails automatically.
        // We will just return resolved for now or implement a call to a hypothetical 'contact' endpoint
        return Promise.resolve({ ok: true });
    }

    const api = {
        init,
        validateEmail,
        sendEmail,
    };

    window.PielEmailEngine = api;
})(window);
