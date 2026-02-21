import { k as currentCallbacks, n as normalizeCallbackStatus, s as showToast, a as apiRequest, r as refreshData, e as escapeHtml, l as getPreferenceText } from '../../admin.js';
import { loadDashboardData } from './admin-dashboard-B6tqHnCY.js';

function renderCallbacks(callbacks) {
    const grid = document.getElementById('callbacksGrid');
    if (!grid) return;

    if (callbacks.length === 0) {
        grid.innerHTML = '<p class="empty-message">No hay callbacks registrados</p>';
        return;
    }

    grid.innerHTML = callbacks.map(c => {
        const status = normalizeCallbackStatus(c.status);
        const callbackId = Number(c.id) || 0;
        const callbackDateKey = encodeURIComponent(String(c.fecha || ''));
        return `
            <div class="callback-card ${status}">
                <div class="callback-header">
                    <span class="callback-phone">${escapeHtml(c.telefono)}</span>
                    <span class="status-badge status-${status}">
                        ${status === 'pendiente' ? 'Pendiente' : 'Contactado'}
                    </span>
                </div>
                <span class="callback-preference">
                    <i class="fas fa-clock"></i>
                    ${escapeHtml(getPreferenceText(c.preferencia))}
                </span>
                <p class="callback-time">
                    <i class="fas fa-calendar"></i>
                    ${escapeHtml(new Date(c.fecha).toLocaleString('es-EC'))}
                </p>
                <div class="callback-actions">
                    <a href="tel:${escapeHtml(c.telefono)}" class="btn btn-phone btn-sm">
                        <i class="fas fa-phone"></i>
                        Llamar
                    </a>
                    ${status === 'pendiente' ? `
                        <button type="button" class="btn btn-primary btn-sm" data-action="mark-contacted" data-callback-id="${callbackId}" data-callback-date="${callbackDateKey}">
                            <i class="fas fa-check"></i>
                            Marcar contactado
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function loadCallbacks() {
    renderCallbacks(currentCallbacks);
}

function filterCallbacks() {
    const filter = document.getElementById('callbackFilter').value;
    let callbacks = [...currentCallbacks];

    if (filter === 'pending') {
        callbacks = callbacks.filter(c => normalizeCallbackStatus(c.status) === 'pendiente');
    } else if (filter === 'contacted') {
        callbacks = callbacks.filter(c => normalizeCallbackStatus(c.status) === 'contactado');
    }

    renderCallbacks(callbacks);
}

async function markContacted(callbackId, callbackDate = '') {
    let callback = null;
    const normalizedId = Number(callbackId);
    if (normalizedId > 0) {
        callback = currentCallbacks.find(c => Number(c.id) === normalizedId);
    }

    const decodedDate = callbackDate ? decodeURIComponent(callbackDate) : '';
    if (!callback && decodedDate) {
        callback = currentCallbacks.find(c => c.fecha === decodedDate);
    }

    if (!callback) {
        showToast('Callback no encontrado', 'error');
        return;
    }

    try {
        const callbackId = callback.id || Date.now();
        if (!callback.id) {
            callback.id = callbackId;
        }
        await apiRequest('callbacks', {
            method: 'PATCH',
            body: { id: Number(callbackId), status: 'contactado' }
        });
        await refreshData();
        loadCallbacks();
        loadDashboardData();
        showToast('Marcado como contactado', 'success');
    } catch (error) {
        showToast(`No se pudo actualizar callback: ${error.message}`, 'error');
    }
}

export { filterCallbacks, loadCallbacks, markContacted, renderCallbacks };
