import { csrfToken } from './state.js';

const API_ENDPOINT = '/api.php';
const AUTH_ENDPOINT = '/admin-auth.php';

function buildQuery(resource, queryParams = {}) {
    const params = new URLSearchParams();
    params.set('resource', resource);
    Object.keys(queryParams).forEach(key => params.append(key, queryParams[key]));
    return `${API_ENDPOINT}?${params.toString()}`;
}

async function requestJson(url, options = {}) {
    const init = {
        method: options.method || 'GET',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json'
        }
    };

    if (csrfToken && options.method && options.method !== 'GET') {
        init.headers['X-CSRF-Token'] = csrfToken;
    }

    if (options.body !== undefined) {
        init.headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, init);
    const responseText = await response.text();

    let payload = {};
    try {
        payload = responseText ? JSON.parse(responseText) : {};
    } catch (error) {
        throw new Error('Respuesta no valida del servidor');
    }

    if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || `HTTP ${response.status}`);
    }

    return payload;
}

export async function apiRequest(resource, options = {}) {
    return requestJson(buildQuery(resource, options.params || {}), options);
}

export async function authRequest(action, options = {}) {
    return requestJson(`${AUTH_ENDPOINT}?action=${encodeURIComponent(action)}`, options);
}
