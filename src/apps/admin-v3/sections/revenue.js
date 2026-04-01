import { setText, setHtml } from '../shared/ui/render.js';
import { apiRequest } from '../shared/core/api-client.js';

let isRevenueFetched = false;

export async function renderRevenueDashboard(state) {
    const isSuperadmin = state?.auth?.capabilities?.isSuperadmin === true;
    const navItem = document.getElementById('nav-revenue-dashboard');
    
    if (navItem) {
        navItem.style.display = isSuperadmin ? 'flex' : 'none';
    }

    // Si no es superadmin o la sección actual no es revenue, no renderizamos
    if (!isSuperadmin || state.ui.activeSection !== 'revenue') {
        return;
    }

    if (!isRevenueFetched) {
        await fetchAndRenderRevenue();
    }
}

async function fetchAndRenderRevenue() {
    const container = document.getElementById('revenueDashboardUI');
    if (!container) return;

    try {
        const response = await apiRequest('flow-os-revenue');
        
        if (!response.ok) {
            setHtml('revenueDashboardUI', `<div class="bento-card"><p style="color:var(--color-red-500)">Error cargando dashboard: ${response.error || 'Acceso denegado'}</p></div>`);
            return;
        }

        const data = response || {};
        isRevenueFetched = true;

        const html = `
            <div class="bento-grid" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));">
                <article class="bento-card" style="display: flex; flex-direction: column; gap: 8px;">
                    <h4 style="margin: 0; color: var(--admin-text-muted); font-size: 0.9rem;">MRR (Ingreso Recurrente)</h4>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--color-green-500); font-family: 'Instrument Serif', serif;">$${(data.mrr || 0).toLocaleString()}</div>
                    <div style="font-size: 0.8rem; color: var(--admin-text-muted);">+4.5% este mes</div>
                </article>

                <article class="bento-card" style="display: flex; flex-direction: column; gap: 8px;">
                    <h4 style="margin: 0; color: var(--admin-text-muted); font-size: 0.9rem;">Tasa de Churn</h4>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--color-red-400); font-family: 'Instrument Serif', serif;">${(data.churnRate || 0)}%</div>
                    <div style="font-size: 0.8rem; color: var(--admin-text-muted);">-0.2% vs mes anterior</div>
                </article>

                <article class="bento-card" style="display: flex; flex-direction: column; gap: 8px;">
                    <h4 style="margin: 0; color: var(--admin-text-muted); font-size: 0.9rem;">Clínicas Activas</h4>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--admin-text-primary); font-family: 'Instrument Serif', serif;">${(data.activeClinics || 0)}</div>
                    <div style="font-size: 0.8rem; color: var(--admin-text-muted);">Total de tenants corriendo Aurora</div>
                </article>

                <article class="bento-card" style="display: flex; flex-direction: column; gap: 8px;">
                    <h4 style="margin: 0; color: var(--admin-text-muted); font-size: 0.9rem;">Trial a Pago</h4>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--color-gold-500); font-family: 'Instrument Serif', serif;">${(data.trialConversion || 0)}%</div>
                    <div style="font-size: 0.8rem; color: var(--admin-text-muted);">Conversión Freemium MTD</div>
                </article>
            </div>
            
            <div class="bento-grid" style="grid-template-columns: 1fr; margin-top: var(--space-4);">
                <article class="bento-card">
                    <p style="color: var(--admin-text-muted); font-size: 0.9rem; margin: 0;">Resumen del Sistema</p>
                    <p style="margin: 8px 0 0 0; font-weight: 500;">${data.summary || 'Dashboard operativo en línea.'}</p>
                </article>
            </div>
        `;

        setHtml('revenueDashboardUI', html);
    } catch (e) {
        setHtml('revenueDashboardUI', `<div class="bento-card"><p style="color:var(--color-red-500)">Error de red: ${e.message}</p></div>`);
    }
}
