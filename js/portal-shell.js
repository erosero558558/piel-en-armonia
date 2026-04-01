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

    async function fetchPatientSummary() {
        const session = getSession();
        if (!isFreshSession(session)) return null;
        try {
            const token = String(session.token || '');
            if (!token) return null;
            const res = await window.fetch('/api.php?resource=patient-summary', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': 'Bearer ' + token
                }
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.ok && data.data && data.data.summary) {
                    return data.data.summary;
                }
            }
        } catch (err) {
            console.error('[portal-shell] failed to fetch patient summary', err);
        }
        return null;
    }

    window.AuroraPatientPortalShell = {
        clearSession,
        getSession,
        isFreshSession,
        redirectToLogin,
        updatePatient,
        fetchPatientSummary,
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
            if (document.body && document.body.dataset.portalSessionRequired === 'true') {
                if (window.Piel && window.Piel.AnalyticsEngine && typeof window.Piel.AnalyticsEngine.trackEvent === 'function') {
                    window.Piel.AnalyticsEngine.trackEvent('portal_opened');
                }
            }
        }
    });
})(window, document);
