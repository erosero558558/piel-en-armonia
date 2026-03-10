import { getState, subscribe, updateState } from '../admin-v3/shared/core/store.js';
import { hasFocusedInput, setText, createToast } from '../admin-v3/shared/ui/render.js';
import {
    checkAuthStatus,
    loginWith2FA,
    loginWithPassword,
    logoutSession,
} from '../admin-v3/shared/modules/auth.js';
import { refreshAdminData, refreshStatusLabel } from '../admin-v3/shared/modules/data.js';
import {
    applyQueueRuntimeDefaults,
    hydrateQueueFromData,
    queueNumpadAction,
    renderQueueSection,
    refreshQueueState,
    setQueueFilter,
    setQueueSearch,
} from '../admin-v3/shared/modules/queue.js';
import {
    dismissQueueSensitiveDialog,
    handleQueueAction,
} from '../admin-v3/core/boot/listeners/action-groups/queue.js';

const QUEUE_REFRESH_MS = 8000;

let refreshIntervalId = 0;

function getById(id) {
    return document.getElementById(id);
}

function setLoginStatus(state, title, message) {
    const card = getById('operatorLoginStatus');
    const titleNode = getById('operatorLoginStatusTitle');
    const messageNode = getById('operatorLoginStatusMessage');
    if (card instanceof HTMLElement) {
        card.setAttribute('data-state', state);
    }
    if (titleNode) titleNode.textContent = title;
    if (messageNode) messageNode.textContent = message;
}

function setSubmitting(submitting) {
    const loginButton = getById('operatorLoginBtn');
    const passwordInput = getById('operatorPassword');
    const codeInput = getById('operator2FACode');

    if (loginButton instanceof HTMLButtonElement) {
        loginButton.disabled = submitting;
        loginButton.textContent = submitting ? 'Validando...' : 'Ingresar';
    }
    if (passwordInput instanceof HTMLInputElement) {
        passwordInput.disabled = submitting;
    }
    if (codeInput instanceof HTMLInputElement) {
        codeInput.disabled = submitting;
    }
}

function show2FA(required) {
    const group = getById('operator2FAGroup');
    const resetButton = getById('operatorReset2FABtn');
    if (group instanceof HTMLElement) {
        group.classList.toggle('is-hidden', !required);
    }
    if (resetButton instanceof HTMLElement) {
        resetButton.classList.toggle('is-hidden', !required);
    }
}

function resetLoginForm({ clearPassword = false } = {}) {
    const passwordInput = getById('operatorPassword');
    const codeInput = getById('operator2FACode');
    if (passwordInput instanceof HTMLInputElement && clearPassword) {
        passwordInput.value = '';
    }
    if (codeInput instanceof HTMLInputElement) {
        codeInput.value = '';
    }
}

function focusLoginField(target = 'password') {
    const id = target === '2fa' ? 'operator2FACode' : 'operatorPassword';
    const input = getById(id);
    if (input instanceof HTMLInputElement) {
        window.setTimeout(() => input.focus(), 20);
    }
}

function humanizeCallKeyLabel(value) {
    const raw = String(value || '').trim();
    if (!raw) {
        return 'Numpad Enter';
    }
    return raw
        .replace(/^NumpadEnter$/i, 'Numpad Enter')
        .replace(/^NumpadDecimal$/i, 'Numpad Decimal')
        .replace(/^NumpadSubtract$/i, 'Numpad Subtract');
}

function updateOperatorChrome() {
    const state = getState();
    const stationLabel = `C${Number(state.queue.stationConsultorio || 1)} ${
        state.queue.stationMode === 'locked' ? 'bloqueado' : 'libre'
    }`;
    const oneTapLabel = state.queue.oneTap ? '1 tecla ON' : '1 tecla OFF';
    const callKey = state.queue.customCallKey
        ? String(state.queue.customCallKey.code || state.queue.customCallKey.key || 'tecla externa')
        : 'Numpad Enter';

    setText('#operatorStationSummary', stationLabel);
    setText('#operatorOneTapSummary', `${oneTapLabel} · ${refreshStatusLabel()}`);
    setText('#operatorCallKeySummary', humanizeCallKeyLabel(callKey));
    renderQueueSection();
}

function mountAuthenticatedView() {
    getById('operatorLoginView')?.classList.add('is-hidden');
    getById('operatorApp')?.classList.remove('is-hidden');
}

function mountLoggedOutView() {
    getById('operatorApp')?.classList.add('is-hidden');
    getById('operatorLoginView')?.classList.remove('is-hidden');
}

function stopRefreshLoop() {
    if (refreshIntervalId) {
        window.clearInterval(refreshIntervalId);
        refreshIntervalId = 0;
    }
}

function startRefreshLoop() {
    stopRefreshLoop();
    refreshIntervalId = window.setInterval(() => {
        void refreshQueueState();
    }, QUEUE_REFRESH_MS);
}

async function bootAuthenticatedSurface(showToast = false) {
    mountAuthenticatedView();
    const ok = await refreshAdminData();
    await hydrateQueueFromData();
    updateOperatorChrome();
    startRefreshLoop();
    if (showToast) {
        createToast(ok ? 'Operador conectado' : 'Operador cargado con respaldo local', ok ? 'success' : 'warning');
    }
}

async function handleLoginSubmit(event) {
    event.preventDefault();

    const passwordInput = getById('operatorPassword');
    const codeInput = getById('operator2FACode');
    const password =
        passwordInput instanceof HTMLInputElement ? passwordInput.value : '';
    const code = codeInput instanceof HTMLInputElement ? codeInput.value : '';
    const state = getState();

    try {
        setSubmitting(true);
        setLoginStatus(
            state.auth.requires2FA ? 'warning' : 'neutral',
            state.auth.requires2FA ? 'Validando segundo factor' : 'Validando credenciales',
            state.auth.requires2FA
                ? 'Comprobando el código 2FA antes de abrir la consola operativa.'
                : 'Comprobando tu sesión de operador.'
        );

        if (state.auth.requires2FA) {
            await loginWith2FA(code);
        } else {
            const result = await loginWithPassword(password);
            if (result.requires2FA) {
                show2FA(true);
                setLoginStatus(
                    'warning',
                    'Código 2FA requerido',
                    'La contraseña fue validada. Ingresa ahora el código de seis dígitos.'
                );
                focusLoginField('2fa');
                return;
            }
        }

        show2FA(false);
        resetLoginForm({ clearPassword: true });
        setLoginStatus(
            'success',
            'Acceso concedido',
            'Sesión autenticada. Cargando la operación diaria.'
        );
        await bootAuthenticatedSurface(true);
    } catch (error) {
        setLoginStatus(
            'danger',
            'No se pudo iniciar sesión',
            error?.message || 'Verifica la clave o el código 2FA.'
        );
        focusLoginField(getState().auth.requires2FA ? '2fa' : 'password');
        createToast(error?.message || 'No se pudo iniciar sesión', 'error');
    } finally {
        setSubmitting(false);
    }
}

function resetTwoFactorStage() {
    show2FA(false);
    resetLoginForm();
    updateState((state) => ({
        ...state,
        auth: {
            ...state.auth,
            requires2FA: false,
        },
    }));
    setLoginStatus(
        'neutral',
        'Acceso protegido',
        'Volviste al paso de contraseña.'
    );
    focusLoginField('password');
}

async function handleDocumentClick(event) {
    const actionNode =
        event.target instanceof Element
            ? event.target.closest('[data-action], #operatorLogoutBtn, #operatorReset2FABtn')
            : null;

    if (!actionNode) {
        return;
    }

    if (actionNode.id === 'operatorLogoutBtn') {
        event.preventDefault();
        stopRefreshLoop();
        await logoutSession();
        mountLoggedOutView();
        resetLoginForm({ clearPassword: true });
        show2FA(false);
        setLoginStatus(
            'neutral',
            'Sesión cerrada',
            'Ingresa de nuevo para operar el turnero.'
        );
        createToast('Sesión cerrada', 'info');
        focusLoginField('password');
        return;
    }

    if (actionNode.id === 'operatorReset2FABtn') {
        event.preventDefault();
        resetTwoFactorStage();
        return;
    }

    const action = String(actionNode.getAttribute('data-action') || '');
    if (!action) {
        return;
    }

    event.preventDefault();

    if (action === 'close-toast') {
        actionNode.closest('.toast')?.remove();
        return;
    }

    await handleQueueAction(action, actionNode);
    updateOperatorChrome();
}

function handleDocumentInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
        return;
    }

    if (target.id === 'queueSearchInput') {
        setQueueSearch(target.value);
        updateOperatorChrome();
    }
}

function handleFilterClick(event) {
    const button =
        event.target instanceof Element
            ? event.target.closest('[data-queue-filter]')
            : null;
    if (!(button instanceof HTMLElement)) {
        return;
    }

    event.preventDefault();
    const filter = String(button.getAttribute('data-queue-filter') || 'all');
    setQueueFilter(filter);
    updateOperatorChrome();
}

function attachKeyboardBridge() {
    document.addEventListener('keydown', async (event) => {
        if (!getState().auth.authenticated) {
            return;
        }

        if (event.key === 'Escape' && dismissQueueSensitiveDialog()) {
            event.preventDefault();
            updateOperatorChrome();
            return;
        }

        if (hasFocusedInput()) {
            return;
        }

        await queueNumpadAction({
            key: event.key,
            code: event.code,
            location: event.location,
        });
        updateOperatorChrome();
    });
}

function attachVisibilityRefresh() {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && getState().auth.authenticated) {
            void refreshQueueState().then(() => updateOperatorChrome());
        }
    });

    window.addEventListener('online', () => {
        if (getState().auth.authenticated) {
            void refreshQueueState().then(() => updateOperatorChrome());
        }
    });
}

async function boot() {
    applyQueueRuntimeDefaults();
    subscribe(() => {
        if (getState().auth.authenticated) {
            updateOperatorChrome();
        }
    });

    document.addEventListener('click', (event) => {
        void handleDocumentClick(event);
    });
    document.addEventListener('click', handleFilterClick);
    document.addEventListener('input', handleDocumentInput);
    attachKeyboardBridge();
    attachVisibilityRefresh();

    const loginForm = getById('operatorLoginForm');
    if (loginForm instanceof HTMLFormElement) {
        loginForm.addEventListener('submit', (event) => {
            void handleLoginSubmit(event);
        });
    }

    const authenticated = await checkAuthStatus();
    if (authenticated) {
        await bootAuthenticatedSurface();
        return;
    }

    mountLoggedOutView();
    show2FA(false);
    setLoginStatus(
        'neutral',
        'Acceso protegido',
        'Inicia sesión para abrir la consola operativa del turnero.'
    );
    focusLoginField('password');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        void boot();
    });
} else {
    void boot();
}
