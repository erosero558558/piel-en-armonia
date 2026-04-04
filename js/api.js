/**
 * js/api.js
 * Cliente HTTP Vanilla para la API de Aurora Derm
 */

/**
 * Realiza una petición GET al backend
 * @param {string} resource El recurso (ej: 'queue-state')
 * @returns {Promise<{ok: boolean, data?: any, error?: string}>}
 */
async function apiGet(resource) {
  try {
    const res = await fetch(`/api.php?resource=${resource}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    // Si la respuesta no es json válido, se capturará en el catch
    const json = await res.json();
    
    if (res.ok) {
      // Backend devuelve { ok: true, data: ... }
      return json;
    } else {
      // Backend devuelve { ok: false, error: ... }
      return { ok: false, error: json.error || `Error HTTP ${res.status}` };
    }
  } catch (e) {
    console.error(`[apiGet] Error en recurso ${resource}:`, e);
    return { ok: false, error: 'Error de red o de servidor.' };
  }
}

/**
 * Realiza una petición POST al backend
 * @param {string} resource El recurso (ej: 'queue-checkin')
 * @param {object} body El cuerpo de la petición (JSON)
 * @returns {Promise<{ok: boolean, data?: any, error?: string}>}
 */
async function apiPost(resource, body) {
  try {
    const res = await fetch(`/api.php?resource=${resource}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    
    const json = await res.json();
    
    if (res.ok) {
      return json; // success payload usually handles {ok: true, data: ...}
    } else {
      return { ok: false, error: json.error || `Error HTTP ${res.status}` };
    }
  } catch (e) {
    console.error(`[apiPost] Error en recurso ${resource}:`, e);
    return { ok: false, error: 'Error de red o de servidor.' };
  }
}
