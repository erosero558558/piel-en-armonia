(function () {
    'use strict';

    let deps = null;

    function init(inputDeps) {
        deps = inputDeps || {};
        return window.PielEmailEngine;
    }

    function validateEmail(email) {
        if (!email || typeof email !== 'string') {
            return false;
        }
        const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(String(email).toLowerCase());
    }

    function normalizeEmail(email) {
        return email ? String(email).trim().toLowerCase() : '';
    }

    window.PielEmailEngine = {
        init,
        validateEmail,
        normalizeEmail
    };
})();
