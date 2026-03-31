import { apiRequest } from '../shared/core/api-client.js';
import { getState } from '../shared/core/store.js';
import { createToast } from '../shared/ui/render.js';

let isFetching = false;
let lastData = null;

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function fetchOpsData() {
    if (isFetching) return null;
    isFetching = true;
    try {
        const result = await apiRequest('whatsapp-openclaw-ops');
        if (result) {
            lastData = result.data || {};
            return lastData;
        }
        createToast('Error fetching WhatsApp Ops data', 'error');
        return null;
    } catch (err) {
        console.error(err);
        createToast('Error de red en WhatsApp Ops', 'error');
        return null;
    } finally {
        isFetching = false;
    }
}

export async function resolveHandoff(conversationId) {
    if (!confirm('¿Marcar este handoff como resuelto?')) return;
    try {
        const result = await apiRequest('whatsapp-openclaw-ops', { method: 'POST', body: { action: 'resolve_handoff', conversationId } });
        if (result && result.action === 'resolve_handoff') {
            createToast('Handoff resuelto', 'success');
            await loadAndRender();
        } else {
            createToast(result?.error || 'Error al resolver', 'error');
        }
    } catch (err) {
        createToast(err.message || 'Falla de red resolviendo handoff', 'error');
    }
}

async function sweepStaleData() {
    try {
        const result = await apiRequest('whatsapp-openclaw-ops', { method: 'POST', body: { action: 'sweep_stale', limit: 50 } });
        if (result) {
            createToast('Limpieza de stale exitosa', 'success');
            await loadAndRender();
        } else {
            createToast('Error al limpiar stale', 'error');
        }
    } catch (err) {
        createToast('Falla de red limpiando stale', 'error');
    }
}

export async function requeueOutbox(id) {
    if (!confirm('¿Reencolar este mensaje fallido?')) return;
    try {
        const result = await apiRequest('whatsapp-openclaw-ops', { method: 'POST', body: { action: 'requeue_outbox', id } });
        if (result && result.action === 'requeue_outbox') {
            createToast('Mensaje reencolado (pending)', 'success');
            await loadAndRender();
        } else {
            createToast(result?.error || 'Error al reencolar', 'error');
        }
    } catch (err) {
        createToast(err.message || 'Falla de red reencolando mensaje', 'error');
    }
}

export async function releaseHold(holdId) {
    const reason = prompt('Motivo de liberación manual:', 'admin_release');
    if (reason === null) return;
    try {
        const result = await apiRequest('whatsapp-openclaw-ops', { method: 'POST', body: { action: 'release_hold', holdId, reason } });
        if (result && result.action === 'release_hold') {
            createToast('Hold liberado exitosamente', 'success');
            await loadAndRender();
        } else {
            createToast(result?.error || 'Error al liberar', 'error');
        }
    } catch (err) {
        createToast(err.message || 'Falla de red liberando hold', 'error');
    }
}

export async function loadAndRender() {
    const container = document.getElementById('whatsappOpsContainer');
    if (!container) return;
    
    container.innerHTML = '<div class="skeleton" style="height: 120px; width: 100%; border-radius: 8px;"></div>';
    const data = await fetchOpsData();
    if (!data) {
        container.innerHTML = '<div style="color:red;">Error cargando consola operativa.</div>';
        return;
    }

    const conversations = Array.isArray(data.conversations) ? data.conversations : [];
    const activeHolds = Array.isArray(data.activeHolds) ? data.activeHolds : [];
    const recentHolds = Array.isArray(data.recentHolds) ? data.recentHolds : activeHolds;
    const pendingOutboxItems = Array.isArray(data.pendingOutboxItems) ? data.pendingOutboxItems : [];
    const failedOutboxItems = Array.isArray(data.failedOutboxItems) ? data.failedOutboxItems : [];
    const pendingCheckouts = Array.isArray(data.pendingCheckouts) ? data.pendingCheckouts : [];
    const pendingHandoffs = Array.isArray(data.pendingHandoffs) ? data.pendingHandoffs : [];

    const statsHtml = `
        <div class="kpi-row" style="margin-bottom: var(--space-6);">
            <div class="kpi-card" style="${pendingHandoffs.length > 0 ? 'border: 1px solid var(--color-red-500);' : ''}">
                <h4 class="kpi-title">Handoffs Pendientes</h4>
                <div class="kpi-value" style="${pendingHandoffs.length > 0 ? 'color: var(--color-red-500);' : ''}">${pendingHandoffs.length}</div>
            </div>
            <div class="kpi-card">
                <h4 class="kpi-title">Active Conversations</h4>
                <div class="kpi-value">${conversations.length}</div>
            </div>
            <div class="kpi-card">
                <h4 class="kpi-title">Active Holds</h4>
                <div class="kpi-value">${activeHolds.length}</div>
            </div>
            <div class="kpi-card">
                <h4 class="kpi-title">Pending Outbox</h4>
                <div class="kpi-value" style="color:var(--color-yellow-600);">${pendingOutboxItems.length}</div>
            </div>
            <div class="kpi-card">
                <h4 class="kpi-title">Failed Outbox</h4>
                <div class="kpi-value" style="color:var(--color-red-500);">${failedOutboxItems.length}</div>
            </div>
        </div>
    `;

    const holdsRows = recentHolds.map(h => `
        <tr>
            <td>${escapeHtml(h.doctor || h.doctorRequested || 'Cualquiera')} - ${escapeHtml(h.date)}</td>
            <td>${escapeHtml(h.phone)}</td>
            <td>${escapeHtml(h.ttlSeconds)}s</td>
            <td>
                <span style="color: ${h.status === 'active' ? 'var(--color-green-500)' : (h.status === 'expired' ? 'var(--color-red-500)' : 'var(--text-color-muted)')}">
                    ${escapeHtml(h.status)}
                </span>
            </td>
            <td>
                ${h.status === 'active' ? `<button type="button" class="btn btn-sm btn-outline" data-release-hold-id="${escapeHtml(h.id)}">Liberar</button>` : ''}
            </td>
        </tr>
    `).join('') || '<tr><td colspan="5" style="text-align:center;">No hay holds recientes</td></tr>';

    const outboxRows = [...pendingOutboxItems, ...failedOutboxItems].map(o => `
        <tr>
            <td>${escapeHtml(o.phone)}</td>
            <td>${escapeHtml(o.type)}</td>
            <td><div style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(o.text)}">${escapeHtml(o.text)}</div></td>
            <td>
                <strong style="color: ${o.status === 'failed' ? 'var(--color-red-500)' : 'var(--color-yellow-600)'}">${escapeHtml(o.status)}</strong>
                ${o.requeueCount > 0 ? `<br><small style="color:var(--text-color-muted)">Retries: ${o.requeueCount}</small>` : ''}
            </td>
            <td>
                <div style="font-size: 0.85em; color: var(--color-red-500);">${escapeHtml(o.error)}</div>
                ${o.status === 'failed' ? `<button type="button" class="btn btn-sm btn-outline mt-1" data-requeue-outbox-id="${escapeHtml(o.id)}">Reencolar</button>` : ''}
            </td>
        </tr>
    `).join('') || '<tr><td colspan="5" style="text-align:center;">Outbox limpio</td></tr>';

    const handoffsRows = pendingHandoffs.map(h => `
        <tr>
            <td>${escapeHtml(h.phone)}</td>
            <td>${escapeHtml(h.reason)}</td>
            <td><div style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(h.latestDraftSummary)}">${escapeHtml(h.latestDraftSummary)}</div></td>
            <td>${escapeHtml(h.sla_due_at)}</td>
            <td>
                <button type="button" class="btn btn-sm btn-outline" data-resolve-handoff-id="${escapeHtml(h.conversationId)}">Resolver</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="5" style="text-align:center;">No hay handoffs pendientes</td></tr>';

    const tablesHtml = `
        <div class="bento-grid" style="grid-template-columns: 1fr;">
            ${pendingHandoffs.length > 0 ? `
            <article class="bento-card" style="border: 1px solid var(--color-red-400);">
                <div class="bento-card-title" style="color: var(--color-red-500);">Handoffs Clínicos (Acción Requerida)</div>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-color-muted); font-size: 0.85rem;">
                                <th>Phone</th>
                                <th>Motivo</th>
                                <th>Detalle Draft</th>
                                <th>SLA Due</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody>${handoffsRows}</tbody>
                    </table>
                </div>
            </article>
            ` : ''}

            <article class="bento-card" style="${pendingHandoffs.length > 0 ? 'margin-top: 1rem;' : ''}">
                <div class="bento-card-title">Retenciones (Holds) Activas</div>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-color-muted); font-size: 0.85rem;">
                                <th>Doctor/Fecha</th>
                                <th>Phone</th>
                                <th>TTL</th>
                                <th>Status</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody>${holdsRows}</tbody>
                    </table>
                </div>
            </article>
            
            <article class="bento-card" style="margin-top: 1rem;">
                <div class="bento-card-title">Outbox Messages</div>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-color-muted); font-size: 0.85rem;">
                                <th>Phone</th>
                                <th>Tipo</th>
                                <th>Texto</th>
                                <th>Status</th>
                                <th>Error</th>
                            </tr>
                        </thead>
                        <tbody>${outboxRows}</tbody>
                    </table>
                </div>
            </article>
        </div>
    `;

    container.innerHTML = statsHtml + tablesHtml;

    // Attach requeue listeners
    container.querySelectorAll('button[data-requeue-outbox-id]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-requeue-outbox-id');
            if (id) requeueOutbox(id);
        });
    });

    container.querySelectorAll('button[data-release-hold-id]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-release-hold-id');
            if (id) releaseHold(id);
        });
    });

    container.querySelectorAll('button[data-resolve-handoff-id]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-resolve-handoff-id');
            if (id) resolveHandoff(id);
        });
    });
}

let loaded = false;

export function renderWhatsappOpsDashboard() {
    const activeSection = getState().ui.activeSection;
    if (activeSection !== 'whatsapp-ops') return;

    if (!loaded) {
        loaded = true;
        
        const btnRefresh = document.getElementById('btnRefreshWhatsappOps');
        const btnSweep = document.getElementById('btnSweepStale');
        
        if (btnRefresh) {
            btnRefresh.addEventListener('click', () => loadAndRender());
        }
        if (btnSweep) {
            btnSweep.addEventListener('click', () => sweepStaleData());
        }

        loadAndRender();
    }
}
