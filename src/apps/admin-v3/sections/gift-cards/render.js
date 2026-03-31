import { apiRequest } from '../../shared/core/api-client.js';
import { setHtml } from '../../shared/ui/render.js';

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export async function fetchAndRenderGiftCards() {
    const listContainer = document.getElementById('gift-cards');
    if (!listContainer) return;
    
    setHtml('#gift-cards', `
        <article class="admin-panel" style="padding: 2rem;">
            <header style="margin-bottom: 2rem;">
                <h2 class="title" style="margin: 0;">Gestión de Gift Cards</h2>
                <p style="color: var(--text-muted); margin-top: 0.5rem;">Cargando listado de vigencia...</p>
            </header>
        </article>
    `);

    try {
        const payload = await apiRequest('gift-cards-expiring');
        const count = payload?.count || 0;
        const list = payload?.data || [];

        let rows = list.map(card => {
            const amount = (card.balance_cents / 100).toFixed(2);
            return `
                <tr>
                    <td style="font-family: monospace;">${escapeHtml(card.code)}</td>
                    <td>$${amount}</td>
                    <td>${escapeHtml(card.recipient_email || 'Sin correo')}</td>
                    <td>${escapeHtml(card.expires_at)}</td>
                    <td><strong style="color: var(--status-warning)"> Faltan ${card.days_remaining} días</strong></td>
                </tr>
            `;
        }).join('');

        if (list.length === 0) {
            rows = `<tr><td colspan="5" style="text-align:center; padding: 2rem;">No hay Gift Cards próximas a vencer en los siguientes 14 días.</td></tr>`;
        }

        setHtml('#gift-cards', `
            <article class="admin-panel" style="padding: 2rem; max-width: 1000px;">
                <header style="margin-bottom: 2rem;">
                    <h2 class="title" style="margin: 0;">Gestión de Gift Cards</h2>
                    <p style="color: var(--text-muted); margin-top: 0.5rem;">Mostrando ${count} tarjeta(s) que expirarán pronto.</p>
                </header>
                <div class="data-table-container">
                    <table class="data-table" style="width: 100%;">
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Saldo USD</th>
                                <th>Destinatario</th>
                                <th>Fecha Expiración</th>
                                <th>Vigencia</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </article>
        `);
    } catch (err) {
        setHtml('#gift-cards', `
            <article class="admin-panel" style="padding: 2rem;">
                <h2 class="title" style="margin: 0; color: var(--status-error);">Error cargando Gift Cards</h2>
                <p>No se pudieron listar las tarjetas expirando: ${escapeHtml(err.message)}</p>
            </article>
        `);
    }
}
