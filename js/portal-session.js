(function (window) {
    'use strict';

    const STORAGE_KEY = 'auroraPatientPortalSession';

    function safeParse(raw) {
        if (typeof raw !== 'string' || raw.trim() === '') {
            return null;
        }

        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (_error) {
            return null;
        }
    }

    function read() {
        try {
            return safeParse(window.localStorage.getItem(STORAGE_KEY));
        } catch (_error) {
            return null;
        }
    }

    function isFresh(session) {
        if (!session || typeof session !== 'object') {
            return false;
        }

        const token = typeof session.token === 'string' ? session.token.trim() : '';
        const expiresAt = typeof session.expiresAt === 'string' ? session.expiresAt.trim() : '';
        if (!token || !expiresAt) {
            return false;
        }

        const expiresAtMs = Date.parse(expiresAt);
        return Number.isFinite(expiresAtMs) && expiresAtMs > Date.now();
    }

    function write(session) {
        if (!session || typeof session !== 'object') {
            return null;
        }

        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
            return session;
        } catch (_error) {
            return null;
        }
    }

    function clear() {
        try {
            window.localStorage.removeItem(STORAGE_KEY);
        } catch (_error) {
            // no-op
        }
    }

    window.AuroraPatientPortalSession = {
        STORAGE_KEY,
        clear,
        isFresh,
        read,
        write,
    };
})(window);
