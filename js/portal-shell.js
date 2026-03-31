(function (window, document) {
    'use strict';

    const portalSession = window.AuroraPatientPortalSession || null;

    function getSession() {
        if (!portalSession || typeof portalSession.read !== 'function') {
            return null;
        }

        return portalSession.read();
    }

    function clearSession() {
        if (portalSession && typeof portalSession.clear === 'function') {
            portalSession.clear();
        }
    }

    function isFreshSession(session) {
        return Boolean(
            portalSession &&
                typeof portalSession.isFresh === 'function' &&
                portalSession.isFresh(session)
        );
    }

    function redirectToLogin() {
        window.location.replace('/es/portal/login/');
    }

    function buildInitials(name) {
        return String(name || '')
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join('') || 'AD';
    }

    function updatePatient(patient) {
        const safePatient =
            patient && typeof patient === 'object' ? patient : {};
        const name = String(safePatient.name || 'Paciente Aurora').trim() || 'Paciente Aurora';
        const initials = buildInitials(name);

        document
            .querySelectorAll('[data-portal-patient-name]')
            .forEach((node) => {
                node.textContent = name;
            });
        document
            .querySelectorAll('[data-portal-patient-initials]')
            .forEach((node) => {
                node.textContent = initials;
            });
    }

    function bindLogout() {
        document
            .querySelectorAll('[data-portal-logout]')
            .forEach((node) => {
                node.addEventListener('click', (event) => {
                    event.preventDefault();
                    clearSession();
                    redirectToLogin();
                });
            });
    }

    window.AuroraPatientPortalShell = {
        clearSession,
        getSession,
        isFreshSession,
        redirectToLogin,
        updatePatient,
    };

    document.addEventListener('DOMContentLoaded', () => {
        const session = getSession();

        bindLogout();

        if (document.body && document.body.dataset.portalSessionRequired === 'true') {
            if (!isFreshSession(session)) {
                clearSession();
                redirectToLogin();
                return;
            }
        }

        if (session && session.patient && typeof session.patient === 'object') {
            updatePatient(session.patient);
        }
    });
})(window, document);
