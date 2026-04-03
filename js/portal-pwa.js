(function () {
    'use strict';

    if (typeof window === 'undefined') {
        return;
    }

    const sessionStore = window.AuroraPatientPortalSession || null;
    const state = (window.__portalPwa = window.__portalPwa || {
        supported: 'serviceWorker' in navigator,
        attempted: false,
        registered: false,
        scope: '',
        error: '',
        push: {
            supported:
                'serviceWorker' in navigator &&
                'PushManager' in window &&
                typeof Notification !== 'undefined',
            configured: false,
            subscribed: false,
            busy: false,
            permission:
                typeof Notification !== 'undefined' ? String(Notification.permission || 'default') : 'default',
            publicKey: '',
            error: '',
        },
    });

    function readSession() {
        return sessionStore && typeof sessionStore.read === 'function' ? sessionStore.read() : null;
    }

    function isFreshSession(session) {
        return Boolean(
            sessionStore &&
                typeof sessionStore.isFresh === 'function' &&
                sessionStore.isFresh(session)
        );
    }

    function dispatchState() {
        window.dispatchEvent(
            new window.CustomEvent('aurora:portal-pwa-state', {
                detail: {
                    ...state,
                    push: { ...state.push },
                },
            })
        );
    }

    function setPushState(patch) {
        state.push = Object.assign({}, state.push || {}, patch || {});
        dispatchState();
        renderPushCard();
    }

    function setSwState(patch) {
        Object.assign(state, patch || {});
        dispatchState();
        renderPushCard();
    }

    function requestJson(resource, options) {
        const settings = options && typeof options === 'object' ? options : {};
        const method = String(settings.method || 'GET').toUpperCase();
        const headers = {
            Accept: 'application/json',
        };

        if (settings.token) {
            headers.Authorization = `Bearer ${settings.token}`;
        }

        if (settings.body !== undefined) {
            headers['Content-Type'] = 'application/json';
        }

        return window
            .fetch(`/api.php?resource=${encodeURIComponent(resource)}`, {
                method,
                headers,
                body:
                    settings.body !== undefined
                        ? JSON.stringify(settings.body)
                        : undefined,
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

    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const normalized = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const raw = window.atob(normalized);
        const output = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i += 1) {
            output[i] = raw.charCodeAt(i);
        }
        return output;
    }

    function getPushButton() {
        return document.querySelector('[data-portal-push-toggle]');
    }

    function renderPushCard() {
        const card = document.querySelector('[data-portal-push-card]');
        if (!card) {
            return;
        }

        const label = card.querySelector('[data-portal-push-status]');
        const copy = card.querySelector('[data-portal-push-copy]');
        const note = card.querySelector('[data-portal-push-note]');
        const button = getPushButton();
        const session = readSession();
        const hasFreshSession = isFreshSession(session);
        const pushState = state.push || {};

        let tone = 'idle';
        let statusText = 'Preparando';
        let copyText = 'Estamos revisando si este dispositivo puede recibir avisos de tu próxima cita.';
        let noteText = 'El recordatorio llega solo a este dispositivo y 24 horas antes de una cita confirmada.';
        let buttonText = 'Activar avisos';
        let buttonDisabled = false;
        let action = 'subscribe';

        if (!state.supported || !pushState.supported) {
            tone = 'warning';
            statusText = 'No compatible';
            copyText =
                'Este navegador no soporta notificaciones push para el portal del paciente.';
            buttonText = 'No disponible';
            buttonDisabled = true;
        } else if (!hasFreshSession) {
            tone = 'idle';
            statusText = 'Inicia sesión';
            copyText =
                'Entra al portal con tu código de WhatsApp para activar recordatorios en este dispositivo.';
            buttonText = 'Disponible al iniciar sesión';
            buttonDisabled = true;
        } else if (pushState.busy) {
            tone = 'idle';
            statusText = 'Procesando';
            copyText = 'Estamos actualizando tus avisos para esta instalación del portal.';
            buttonText = 'Procesando...';
            buttonDisabled = true;
        } else if (!pushState.configured) {
            tone = 'warning';
            statusText = 'No disponible';
            copyText =
                'Los recordatorios push todavía no están habilitados en este entorno.';
            buttonText = 'No disponible';
            buttonDisabled = true;
            if (pushState.error) {
                noteText = pushState.error;
            }
        } else if (pushState.permission === 'denied') {
            tone = 'attention';
            statusText = 'Bloqueadas';
            copyText =
                'El navegador bloqueó las notificaciones. Rehabilítalas en la configuración del sitio para volver a activarlas.';
            buttonText = 'Permiso bloqueado';
            buttonDisabled = true;
        } else if (pushState.subscribed) {
            tone = 'good';
            statusText = 'Activas';
            copyText =
                'Te avisaremos 24 horas antes de tu próxima cita confirmada en este dispositivo.';
            buttonText = 'Desactivar avisos';
            action = 'unsubscribe';
        } else {
            tone = 'idle';
            statusText = 'Listas para activar';
            copyText =
                'Activa avisos para recibir un recordatorio puntual 24 horas antes de tu cita.';
        }

        if (pushState.error) {
            noteText = String(pushState.error);
        }

        card.dataset.state = tone;
        if (label) {
            label.className = `portal-status-chip portal-status-chip--${tone}`;
            label.textContent = statusText;
        }
        if (copy) {
            copy.textContent = copyText;
        }
        if (note) {
            note.textContent = noteText;
        }
        if (button) {
            button.textContent = buttonText;
            button.disabled = buttonDisabled;
            button.dataset.action = action;
        }
    }

    function getLocale() {
        const locale = String(document.documentElement.lang || 'es').trim().toLowerCase();
        return locale === 'en' ? 'en' : 'es';
    }

    async function ensureServiceWorker() {
        if (!state.supported) {
            renderPushCard();
            return null;
        }

        if (state.registered && navigator.serviceWorker.ready) {
            return navigator.serviceWorker.ready;
        }

        state.attempted = true;

        try {
            const registration = await navigator.serviceWorker.register('/sw.js', {
                updateViaCache: 'none',
            });
            setSwState({
                registered: true,
                scope: String(registration && registration.scope ? registration.scope : ''),
                error: '',
            });
            return registration;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error || 'unknown_error');
            setSwState({
                registered: false,
                scope: '',
                error: message,
            });
            console.warn('[portal-pwa] service worker registration failed', error);
            return null;
        }
    }

    async function syncPushState() {
        const session = readSession();
        if (!isFreshSession(session)) {
            setPushState({
                subscribed: false,
                configured: false,
                error: '',
                permission:
                    typeof Notification !== 'undefined'
                        ? String(Notification.permission || 'default')
                        : 'default',
            });
            return;
        }

        if (!state.push.supported) {
            renderPushCard();
            return;
        }

        const registration = await ensureServiceWorker();
        if (!registration || !registration.pushManager) {
            setPushState({
                configured: false,
                error: 'No pudimos inicializar el service worker del portal.',
            });
            return;
        }

        const config = await requestJson('notification-config', {
            token: String(session.token || ''),
        });

        const publicKey = String(config.body?.data?.publicKey || '');
        const configured = Boolean(config.ok && config.body?.data?.configured && publicKey);
        const permission =
            typeof Notification !== 'undefined'
                ? String(Notification.permission || 'default')
                : 'default';

        if (!configured) {
            setPushState({
                configured: false,
                subscribed: false,
                publicKey: '',
                permission,
                error:
                    String(config.body?.error || '').trim() ||
                    'Web Push no está configurado en este momento.',
            });
            return;
        }

        const existingSubscription = await registration.pushManager.getSubscription();
        if (existingSubscription && !config.body?.data?.subscribed) {
            await requestJson('notification-subscribe', {
                method: 'POST',
                token: String(session.token || ''),
                body: {
                    locale: getLocale(),
                    subscription:
                        typeof existingSubscription.toJSON === 'function'
                            ? existingSubscription.toJSON()
                            : existingSubscription,
                },
            });
        }

        setPushState({
            configured: true,
            subscribed: Boolean(existingSubscription) || Boolean(config.body?.data?.subscribed),
            publicKey,
            permission,
            error: '',
        });
    }

    async function subscribePush() {
        const session = readSession();
        if (!isFreshSession(session)) {
            renderPushCard();
            return;
        }

        const registration = await ensureServiceWorker();
        if (!registration || !registration.pushManager) {
            throw new Error('No pudimos inicializar las notificaciones en este dispositivo.');
        }

        const config = await requestJson('notification-config', {
            token: String(session.token || ''),
        });
        const publicKey = String(config.body?.data?.publicKey || '');
        if (!config.ok || !publicKey) {
            throw new Error('Push no está configurado para este portal.');
        }

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            setPushState({ permission });
            throw new Error('Permiso de notificaciones denegado');
        }

        const existing = await registration.pushManager.getSubscription();
        const subscription =
            existing ||
            (await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey),
            }));

        const response = await requestJson('notification-subscribe', {
            method: 'POST',
            token: String(session.token || ''),
            body: {
                locale: getLocale(),
                subscription:
                    typeof subscription.toJSON === 'function' ? subscription.toJSON() : subscription,
            },
        });

        if (!response.ok) {
            throw new Error(String(response.body?.error || 'No pudimos activar los avisos.'));
        }

        setPushState({
            configured: true,
            subscribed: true,
            publicKey,
            permission,
            error: '',
        });
    }

    async function unsubscribePush() {
        const session = readSession();
        if (!isFreshSession(session)) {
            renderPushCard();
            return;
        }

        const registration = await ensureServiceWorker();
        if (!registration || !registration.pushManager) {
            throw new Error('No pudimos revisar la suscripción actual.');
        }

        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            const response = await requestJson('notification-unsubscribe', {
                method: 'POST',
                token: String(session.token || ''),
                body: {
                    endpoint: String(subscription.endpoint || ''),
                },
            });

            if (!response.ok) {
                throw new Error(String(response.body?.error || 'No pudimos desactivar los avisos.'));
            }

            await subscription.unsubscribe();
        }

        setPushState({
            subscribed: false,
            error: '',
        });
    }

    async function onTogglePush(event) {
        if (event) {
            event.preventDefault();
        }

        const button = getPushButton();
        const action = button ? String(button.dataset.action || 'subscribe') : 'subscribe';

        setPushState({
            busy: true,
            error: '',
            permission:
                typeof Notification !== 'undefined'
                    ? String(Notification.permission || 'default')
                    : 'default',
        });

        try {
            if (action === 'unsubscribe') {
                await unsubscribePush();
            } else {
                await subscribePush();
            }
        } catch (error) {
            setPushState({
                error: error instanceof Error ? error.message : String(error || 'push_error'),
            });
        } finally {
            setPushState({
                busy: false,
                permission:
                    typeof Notification !== 'undefined'
                        ? String(Notification.permission || 'default')
                        : 'default',
            });
        }
    }

    function bindPushCard() {
        const button = getPushButton();
        if (!button || button.dataset.bound === 'true') {
            renderPushCard();
            return;
        }

        button.dataset.bound = 'true';
        button.addEventListener('click', onTogglePush);
        renderPushCard();
    }

    async function bootPortalPwa() {
        bindPushCard();

        if (!state.supported) {
            renderPushCard();
            return;
        }

        await ensureServiceWorker();
        try {
            await syncPushState();
        } catch (error) {
            setPushState({
                configured: false,
                subscribed: false,
                error:
                    error instanceof Error
                        ? error.message
                        : String(error || 'No pudimos verificar tus avisos push.'),
            });
        }
    }

    if (document.readyState === 'complete') {
        bootPortalPwa();
    } else {
        window.addEventListener('load', bootPortalPwa, { once: true });
    }
})();
