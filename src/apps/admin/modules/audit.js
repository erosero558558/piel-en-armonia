import { apiRequest } from './api.js';
import { showToast, escapeHtml } from './ui.js';

let auditLogs = [];

export async function loadAuditLogs(limit = 100, offset = 0) {
    try {
        const response = await apiRequest('audit', {
            method: 'GET',
            params: { limit, offset }
        });

        if (response.ok && Array.isArray(response.data)) {
            auditLogs = response.data;
            renderAuditLogs(auditLogs);
        } else {
            showToast('Error cargando logs de auditoria', 'error');
        }
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}

function renderAuditLogs(logs) {
    const tbody = document.getElementById('auditLogsTableBody');
    if (!tbody) return;

    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-message">No hay registros de auditoria</td></tr>';
        return;
    }

    tbody.innerHTML = logs.map(log => {
        let details = '';
        if (log.details) {
            try {
                // If it's already an object (decoded by controller), use it.
                // If it's a string, parse it.
                const obj = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
                details = `<pre class="json-details">${escapeHtml(JSON.stringify(obj, null, 2))}</pre>`;
            } catch (e) {
                details = escapeHtml(String(log.details));
            }
        }

        return `
            <tr>
                <td>${escapeHtml(log.ts)}</td>
                <td><span class="badge badge-info">${escapeHtml(log.event)}</span></td>
                <td>${escapeHtml(log.actor)} (${escapeHtml(log.ip)})</td>
                <td>${escapeHtml(log.path)}</td>
                <td>
                    <button type="button" class="btn-sm btn-secondary toggle-details">Ver Detalles</button>
                    <div class="log-details is-hidden">${details}</div>
                </td>
            </tr>
        `;
    }).join('');

    // Re-attach event listeners for details toggle
    tbody.querySelectorAll('.toggle-details').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const detailsDiv = e.target.nextElementSibling;
            detailsDiv.classList.toggle('is-hidden');
            e.target.textContent = detailsDiv.classList.contains('is-hidden') ? 'Ver Detalles' : 'Ocultar';
        });
    });
}
