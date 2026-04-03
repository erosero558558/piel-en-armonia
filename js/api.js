/**
 * js/api.js — Cliente HTTP Aurora Derm
 * JS-01 [Gemini]
 *
 * Contrato: siempre retorna { ok, data, error } — nunca lanza al caller.
 *
 * Uso:
 *   const { ok, data, error } = await apiGet('queue-state');
 *   const { ok, data }       = await apiPost('queue-call-next', { ticketId: 42 });
 */

'use strict';

(function () {
  const BASE = window.__AURORA_API_BASE__ || '/api.php';

  /**
   * Construye la URL del API con el resource y query params opcionales.
   * @param {string} resource
   * @param {Record<string,string>} [params]
   * @returns {string}
   */
  function buildUrl(resource, params) {
    const qs = new URLSearchParams({ resource });
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
      });
    }
    return BASE + '?' + qs.toString();
  }

  /**
   * Parsea la respuesta: intenta JSON, devuelve texto en error.
   */
  async function parseResponse(res) {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      try { return await res.json(); } catch { return null; }
    }
    try { return await res.text(); } catch { return null; }
  }

  /**
   * Wrapper de fetch que normaliza la respuesta.
   * @returns {Promise<{ ok: boolean, data: any, error: string|null, status: number }>}
   */
  async function request(method, resource, body, params) {
    const headers = { 'Accept': 'application/json' };

    // Token de sesión del admin si existe
    const token = sessionStorage.getItem('aurora_admin_token');
    if (token) headers['Authorization'] = 'Bearer ' + token;

    // Token del portal si existe
    const portalToken = sessionStorage.getItem('aurora_portal_token');
    if (portalToken) headers['X-Portal-Token'] = portalToken;

    const options = { method, headers };

    if (body !== undefined && body !== null) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    let res;
    try {
      res = await fetch(buildUrl(resource, params), options);
    } catch (networkErr) {
      return {
        ok: false,
        data: null,
        error: 'Sin conexión con el servidor. Verifica tu red.',
        status: 0,
      };
    }

    const payload = await parseResponse(res);

    if (!res.ok) {
      const errMsg = (payload && payload.error)
        ? String(payload.error)
        : `Error ${res.status}: ${res.statusText}`;
      return { ok: false, data: payload, error: errMsg, status: res.status };
    }

    // El API retorna { ok, data } — lo pasamos tal cual
    if (payload && typeof payload === 'object' && 'ok' in payload) {
      return {
        ok: payload.ok === true,
        data: payload.data ?? payload,
        error: payload.ok ? null : (payload.error || 'Error desconocido'),
        status: res.status,
      };
    }

    return { ok: true, data: payload, error: null, status: res.status };
  }

  /**
   * GET — lee un resource del API.
   * @param {string} resource
   * @param {Record<string,string>} [params]  Query params adicionales
   */
  function apiGet(resource, params) {
    return request('GET', resource, undefined, params);
  }

  /**
   * POST — envía datos a un resource del API.
   * @param {string} resource
   * @param {object} [body]
   * @param {Record<string,string>} [params]
   */
  function apiPost(resource, body, params) {
    return request('POST', resource, body ?? {}, params);
  }

  /**
   * PATCH — actualiza parcialmente un resource.
   */
  function apiPatch(resource, body, params) {
    return request('PATCH', resource, body ?? {}, params);
  }

  /**
   * DELETE — elimina un resource.
   */
  function apiDelete(resource, params) {
    return request('DELETE', resource, undefined, params);
  }

  /**
   * Versión simplificada para datos de formulario (multipart).
   */
  async function apiUpload(resource, formData) {
    const headers = {};
    const token = sessionStorage.getItem('aurora_admin_token');
    if (token) headers['Authorization'] = 'Bearer ' + token;

    let res;
    try {
      res = await fetch(buildUrl(resource), { method: 'POST', headers, body: formData });
    } catch {
      return { ok: false, data: null, error: 'Sin conexión', status: 0 };
    }

    const payload = await parseResponse(res);
    if (!res.ok) {
      return { ok: false, data: payload, error: payload?.error || `Error ${res.status}`, status: res.status };
    }
    return { ok: true, data: payload?.data ?? payload, error: null, status: res.status };
  }

  // Exports globales
  window.apiGet    = apiGet;
  window.apiPost   = apiPost;
  window.apiPatch  = apiPatch;
  window.apiDelete = apiDelete;
  window.apiUpload = apiUpload;

  if (typeof module !== 'undefined') {
    module.exports = { apiGet, apiPost, apiPatch, apiDelete, apiUpload };
  }
})();
