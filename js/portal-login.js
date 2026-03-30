(function (window, document) {
    'use strict';

    const portalSession = window.AuroraPatientPortalSession || null;
    const loginState = {
        challengeId: '',
        phone: '',
    };

    function query(selector) {
        return document.querySelector(selector);
    }

    function setHidden(element, hidden) {
        if (!(element instanceof HTMLElement)) {
            return;
        }
        element.hidden = hidden;
    }

    function setStatus(message, tone = 'neutral') {
        const node = query('[data-portal-login-status]');
        if (!(node instanceof HTMLElement)) {
            return;
        }
        node.textContent = String(message || '');
        node.dataset.state = String(tone || 'neutral');
    }

    function setButtonBusy(button, busy, label) {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.disabled = !!busy;
        if (label) {
            button.textContent = label;
        }
    }

    async function requestJson(resource, payload, token = '') {
        const response = await window.fetch(`/api.php?resource=${resource}`, {
            method: payload ? 'POST' : 'GET',
            headers: {
                Accept: 'application/json',
                ...(payload ? { 'Content-Type': 'application/json' } : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: payload ? JSON.stringify(payload) : undefined,
        });

        const data = await response.json().catch(() => ({}));
        return { ok: response.ok, status: response.status, body: data };
    }

    async function hydrateExistingSession() {
        if (!portalSession || typeof portalSession.read !== 'function') {
            return;
        }

        const session = portalSession.read();
        if (!portalSession.isFresh(session)) {
            portalSession.clear();
            return;
        }

        const result = await requestJson('patient-portal-auth-status', null, session.token);
        if (result.ok && result.body && result.body.ok && result.body.data && result.body.data.authenticated) {
            window.location.replace('/es/portal/');
            return;
        }

        portalSession.clear();
    }

    async function handleRequestCode(event) {
        event.preventDefault();

        const phoneInput = query('input[name="whatsapp"]');
        const requestButton = query('[data-portal-login-request-form] button[type="submit"]');
        const verifyStage = query('[data-portal-login-verify-stage]');
        const verifyPhone = query('[data-portal-login-phone]');
        const debugNode = query('[data-portal-login-debug-code]');

        const phone = phoneInput instanceof HTMLInputElement ? phoneInput.value.trim() : '';
        if (!phone) {
            setStatus('Ingresa tu numero de WhatsApp para continuar.', 'error');
            return;
        }

        setButtonBusy(requestButton, true, 'Enviando codigo...');
        setStatus('Estamos enviando tu codigo por WhatsApp.', 'loading');

        try {
            const result = await requestJson('patient-portal-auth-start', { phone });
            if (!result.ok || !result.body || result.body.ok !== true) {
                setStatus(
                    result.body && result.body.error
                        ? result.body.error
                        : 'No pudimos iniciar el acceso al portal.',
                    'error'
                );
                return;
            }

            const payload = result.body.data || {};
            loginState.phone = phone;
            loginState.challengeId = String(payload.challengeId || '');

            setHidden(verifyStage, false);
            if (verifyPhone instanceof HTMLElement) {
                verifyPhone.textContent = String(payload.maskedPhone || '');
            }
            if (debugNode instanceof HTMLElement) {
                const debugCode = String(payload.debugCode || '').trim();
                debugNode.hidden = debugCode === '';
                debugNode.textContent = debugCode ? `Codigo de prueba: ${debugCode}` : '';
            }

            const codeInput = query('input[name="otp"]');
            if (codeInput instanceof HTMLInputElement) {
                codeInput.focus();
            }

            setStatus('Te enviamos un codigo de 6 digitos por WhatsApp.', 'success');
        } catch (_error) {
            setStatus('No pudimos contactar el portal en este momento.', 'error');
        } finally {
            setButtonBusy(requestButton, false, 'Enviar codigo por WhatsApp');
        }
    }

    async function handleVerifyCode(event) {
        event.preventDefault();

        const codeInput = query('input[name="otp"]');
        const verifyButton = query('[data-portal-login-verify-form] button[type="submit"]');
        const code = codeInput instanceof HTMLInputElement ? codeInput.value.trim() : '';

        if (!loginState.phone || !loginState.challengeId) {
            setStatus('Primero solicita un codigo por WhatsApp.', 'error');
            return;
        }

        if (!code) {
            setStatus('Ingresa el codigo de 6 digitos.', 'error');
            return;
        }

        setButtonBusy(verifyButton, true, 'Validando...');
        setStatus('Validando tu codigo y abriendo tu sesion.', 'loading');

        try {
            const result = await requestJson('patient-portal-auth-complete', {
                phone: loginState.phone,
                challengeId: loginState.challengeId,
                code,
            });

            if (!result.ok || !result.body || result.body.ok !== true) {
                setStatus(
                    result.body && result.body.error
                        ? result.body.error
                        : 'No pudimos validar tu codigo.',
                    'error'
                );
                return;
            }

            const payload = result.body.data || {};
            const session = {
                token: String(payload.token || ''),
                expiresAt: String(payload.expiresAt || ''),
                patient: payload.patient && typeof payload.patient === 'object' ? payload.patient : {},
                issuedAt: new Date().toISOString(),
            };

            if (!portalSession || typeof portalSession.write !== 'function') {
                setStatus('No pudimos guardar la sesion local del portal.', 'error');
                return;
            }

            portalSession.write(session);
            setStatus('Sesion lista. Te estamos llevando a tu portal.', 'success');
            window.setTimeout(() => {
                window.location.assign('/es/portal/');
            }, 250);
        } catch (_error) {
            setStatus('No pudimos validar el codigo en este momento.', 'error');
        } finally {
            setButtonBusy(verifyButton, false, 'Ingresar al portal');
        }
    }

    document.addEventListener('DOMContentLoaded', async () => {
        await hydrateExistingSession();

        const requestForm = query('[data-portal-login-request-form]');
        const verifyForm = query('[data-portal-login-verify-form]');

        if (requestForm instanceof HTMLFormElement) {
            requestForm.addEventListener('submit', handleRequestCode);
        }

        if (verifyForm instanceof HTMLFormElement) {
            verifyForm.addEventListener('submit', handleVerifyCode);
        }
    });
})(window, document);
