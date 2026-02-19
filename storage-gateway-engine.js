/**
 * Storage gateway engine (deferred-loaded).
 * Centralizes safe localStorage read/write helpers.
 */
(function () {
    'use strict';

    function init() {
        return window.PielStorageGatewayEngine;
    }

    function getString(key, fallback = '') {
        try {
            const value = localStorage.getItem(String(key || ''));
            return (typeof value === 'string' && value !== '') ? value : fallback;
        } catch (_) {
            return fallback;
        }
    }

    function getJSON(key, fallback) {
        try {
            const value = JSON.parse(localStorage.getItem(String(key || '')) || 'null');
            return value === null ? fallback : value;
        } catch (_) {
            return fallback;
        }
    }

    function setString(key, value) {
        try {
            localStorage.setItem(String(key || ''), String(value ?? ''));
            return true;
        } catch (_) {
            return false;
        }
    }

    function setJSON(key, value) {
        try {
            localStorage.setItem(String(key || ''), JSON.stringify(value));
            return true;
        } catch (_) {
            return false;
        }
    }

    function remove(key) {
        try {
            localStorage.removeItem(String(key || ''));
            return true;
        } catch (_) {
            return false;
        }
    }

    window.PielStorageGatewayEngine = {
        init,
        getString,
        getJSON,
        setString,
        setJSON,
        remove
    };
})();
