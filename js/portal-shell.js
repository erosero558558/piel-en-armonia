(function (window, document) {
    'use strict';

    const portalSession = window.AuroraPatientPortalSession || null;
    const clinicProfileState = {
        loaded: false,
        promise: null,
        profile: null,
    };

    function buildDefaultClinicProfile() {
        return {
            clinicName: 'Aurora Derm',
            name: 'Aurora Derm',
            address: '',
            phone: '',
            logoImage: '',
            colors: {
                primary: '#248a65',
                accent: '#e6aa16',
            },
            businessHours: [],
            activeDoctors: [],
            services: [],
        };
    }

    function normalizeClinicProfile(profile) {
        const source = profile && typeof profile === 'object' ? profile : {};
        const colors =
            source.colors && typeof source.colors === 'object' ? source.colors : {};
        const clinicName = String(
            source.clinicName || source.name || 'Aurora Derm'
        ).trim() || 'Aurora Derm';

        return {
            clinicName,
            name: clinicName,
            address: String(source.address || '').trim(),
            phone: String(source.phone || '').trim(),
            logoImage: String(source.logoImage || source.logo || '').trim(),
            colors: {
                primary: String(colors.primary || '#248a65').trim() || '#248a65',
                accent: String(colors.accent || '#e6aa16').trim() || '#e6aa16',
            },
            businessHours: Array.isArray(source.businessHours)
                ? source.businessHours.map((entry) => String(entry || '').trim()).filter(Boolean)
                : [],
            activeDoctors: Array.isArray(source.activeDoctors)
                ? source.activeDoctors
                : [],
            services: Array.isArray(source.services) ? source.services : [],
        };
    }

    function requestPublicJson(resource) {
        return window
            .fetch(`/api.php?resource=${encodeURIComponent(resource)}`, {
                headers: {
                    Accept: 'application/json',
                },
            })
            .then(async (response) => {
                const body = await response.json().catch(() => ({}));
                return {
                    ok: response.ok,
                    status: response.status,
                    body,
                };
            });
    }

    function setMetaContent(selector, content) {
        const node = document.querySelector(selector);
        if (node instanceof HTMLMetaElement) {
            node.setAttribute('content', String(content || ''));
        }
    }

    function applyClinicProfile(profile) {
        const safeProfile = normalizeClinicProfile(profile);
        clinicProfileState.profile = safeProfile;
        clinicProfileState.loaded = true;

        document.documentElement.dataset.portalClinicName = safeProfile.clinicName;
        document.documentElement.style.setProperty(
            '--portal-clinic-primary',
            safeProfile.colors.primary
        );
        document.documentElement.style.setProperty(
            '--portal-clinic-accent',
            safeProfile.colors.accent
        );
        document.documentElement.style.setProperty('--rb-accent', safeProfile.colors.accent);

        setMetaContent('meta[name="application-name"]', safeProfile.clinicName);
        setMetaContent(
            'meta[name="apple-mobile-web-app-title"]',
            safeProfile.clinicName
        );
        setMetaContent('meta[name="theme-color"]', safeProfile.colors.primary);

        if (document.title.includes('Aurora Derm')) {
            document.title = document.title.replace(/Aurora Derm/g, safeProfile.clinicName);
        }

        document
            .querySelectorAll('[data-portal-clinic-name]')
            .forEach((node) => {
                node.textContent = safeProfile.clinicName;
            });

        window.dispatchEvent(
            new window.CustomEvent('aurora:portal-clinic-profile', {
                detail: safeProfile,
            })
        );

        return safeProfile;
    }

    async function loadClinicProfile() {
        if (clinicProfileState.loaded && clinicProfileState.profile) {
            return clinicProfileState.profile;
        }

        if (clinicProfileState.promise) {
            return clinicProfileState.promise;
        }

        clinicProfileState.promise = requestPublicJson('clinic-profile')
            .then((result) => {
                if (
                    result.ok &&
                    result.body &&
                    result.body.ok === true &&
                    result.body.data &&
                    typeof result.body.data === 'object'
                ) {
                    return applyClinicProfile(result.body.data);
                }

                return applyClinicProfile(buildDefaultClinicProfile());
            })
            .catch((error) => {
                console.warn('[portal-shell] failed to load clinic profile', error);
                return applyClinicProfile(buildDefaultClinicProfile());
            })
            .finally(() => {
                clinicProfileState.promise = null;
            });

        return clinicProfileState.promise;
    }

    function getClinicProfile() {
        return clinicProfileState.profile || buildDefaultClinicProfile();
    }

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
        getClinicProfile,
        loadClinicProfile,
        normalizeClinicProfile,
    };

    document.addEventListener('DOMContentLoaded', () => {
        const session = getSession();

        void loadClinicProfile();
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
