let csrfToken = '';
const tabSessionId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);

function normalizeJson(payload) {
    if (payload && typeof payload === 'object') return payload;
    return {};
}

async function requestJsonRaw(url, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const headers = {
        Accept: 'application/json',
        'X-Tab-Session-Id': tabSessionId,
        ...(options.headers || {}),
    };

    const init = {
        method,
        credentials: 'same-origin',
        headers,
    };

    if (method !== 'GET' && csrfToken) {
        init.headers['X-CSRF-Token'] = csrfToken;
    }

    if (options.body !== undefined) {
        init.headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, init);
    const text = await response.text();
    let payload;
    try {
        payload = text ? JSON.parse(text) : {};
    } catch (_error) {
        throw new Error(`Respuesta no valida (${response.status})`);
    }

    return {
        ok: response.ok && payload.ok !== false,
        status: Number(response.status || 0),
        payload: normalizeJson(payload),
    };
}

let concurrenceTriggered = false;

function toRequestError(result) {
    const payload =
        result && result.payload && typeof result.payload === 'object'
            ? result.payload
            : {};
    
    if (result.status === 409 && payload.code === 'session_transferred' && !concurrenceTriggered) {
        concurrenceTriggered = true;
        document.body.dispatchEvent(new CustomEvent('admin-toast', {
            detail: { message: payload.message || 'Sesión transferida a otra ventana.', tone: 'warning' }
        }));
        setTimeout(() => {
            window.location.href = '/admin.html?reason=transferred';
        }, 2000);
    }

    const error = new Error(
        payload.error ||
            payload.message ||
            `HTTP ${Number(result && result.status) || 0}`
    );
    error.status = Number(result && result.status) || 0;
    error.payload = payload;
    return error;
}

async function requestJson(url, options = {}) {
    const result = await requestJsonRaw(url, options);
    if (!result.ok) {
        throw toRequestError(result);
    }
    return result.payload;
}

export function setApiCsrfToken(token) {
    csrfToken = String(token || '');
}

export function getApiCsrfToken() {
    return csrfToken;
}

function buildApiUrl(resource, query = {}) {
    const value = String(resource || '');
    const [baseResource, rawQuery = ''] = value.split('?');
    const params = new URLSearchParams(rawQuery);

    Object.entries(query || {}).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        params.set(key, String(value));
    });

    const queryString = params.toString();
    return `/api.php?resource=${encodeURIComponent(baseResource)}${queryString ? `&${queryString}` : ''}`;
}

export async function apiRequest(resource, options = {}) {
    const url = buildApiUrl(resource, options.query || {});
    const { query, ...requestOptions } = options || {};
    return requestJson(url, requestOptions);
}

export async function authRequestRaw(action, options = {}) {
    const url = `/admin-auth.php?action=${encodeURIComponent(action)}`;
    return requestJsonRaw(url, options);
}

export async function authRequest(action, options = {}) {
    const url = `/admin-auth.php?action=${encodeURIComponent(action)}`;
    return requestJson(url, options);
}
