import { setHtml } from '../shared/ui/render.js';
import { apiRequest } from '../shared/core/api-client.js';

let isFetched = false;

export async function renderB2bReferrals(state) {
    if (state.ui.activeSection !== 'b2b-referrals') {
        return;
    }

    if (!isFetched) {
        // Render loading state
        setHtml(
            'b2b-referrals',
            `
            <div class="admin-section-header">
                <h2>Referir Clínicas (Flow OS B2B)</h2>
                <p>Gana meses de suscripción gratis refiriendo Aurora Derm a otras clínicas.</p>
            </div>
            <div class="bento-card"><p>Cargando información de referidos...</p></div>
        `
        );
        await fetchAndRenderReferrals();
    }
}

async function fetchAndRenderReferrals() {
    try {
        const response = await apiRequest('flow-os-b2b-referral');

        if (!response.ok) {
            setHtml(
                'b2b-referrals',
                `
                <div class="admin-section-header">
                    <h2>Referir Clínicas</h2>
                </div>
                <div class="bento-card"><p style="color:var(--color-red-500)">Error cargando referidos: ${response.error || 'Desconocido'}</p></div>
            `
            );
            return;
        }

        const data = response || {};
        isFetched = true;

        const whatsappMsg = `¡Hola! Te recomiendo Flow OS para gestionar tu clínica dermatológica. Usa mi enlace para obtener beneficios: ${data.shareUrl}`;

        const html = `
            <div class="admin-section-header" style="margin-bottom: var(--space-6);">
                <h2 style="font-family: 'Instrument Serif', serif; font-size: 2.5rem; margin-bottom: 8px;">Referir Clínicas</h2>
                <p style="color: var(--admin-text-muted); font-size: 1.1rem;">Por cada clínica que contrate Flow OS con tu enlace, ambas obtienen 1 mes gratis de suscripción.</p>
            </div>

            <div class="bento-card" style="margin-bottom: var(--space-6); background: rgba(211, 176, 114, 0.05); border: 1px solid rgba(211, 176, 114, 0.3);">
                <h3 style="color: var(--color-gold-400); margin-bottom: 16px;">Tu enlace único</h3>
                <div style="display: flex; gap: 12px; align-items: center; background: rgba(0,0,0,0.2); padding: 12px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                    <code style="flex: 1; color: var(--color-gold-300); word-break: break-all;">${data.shareUrl}</code>
                    <button class="btn btn-primary" onclick="navigator.clipboard.writeText('${data.shareUrl}'); if(window.toast) window.toast.show('Enlace copiado al portapapeles', 'success');" style="white-space: nowrap;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px; vertical-align: middle;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        Copiar
                    </button>
                    <a href="https://wa.me/?text=${encodeURIComponent(whatsappMsg)}" target="_blank" class="btn" style="background: #25D366; color: white; border: none; white-space: nowrap; display: inline-flex; align-items: center;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                        Compartir
                    </a>
                </div>
            </div>

            <div class="bento-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
                <article class="bento-card" style="display: flex; flex-direction: column; gap: 8px;">
                    <h4 style="margin: 0; color: var(--admin-text-muted); font-size: 0.9rem;">Clics en tu enlace</h4>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--admin-text-primary); font-family: 'Instrument Serif', serif;">${data.stats.clicks || 0}</div>
                </article>

                <article class="bento-card" style="display: flex; flex-direction: column; gap: 8px;">
                    <h4 style="margin: 0; color: var(--admin-text-muted); font-size: 0.9rem;">Clínicas en proceso</h4>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--color-gold-400); font-family: 'Instrument Serif', serif;">${data.stats.pendingFollowUps || 0}</div>
                </article>

                <article class="bento-card" style="display: flex; flex-direction: column; gap: 8px;">
                    <h4 style="margin: 0; color: var(--admin-text-muted); font-size: 0.9rem;">Clínicas Suscritas</h4>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--color-green-500); font-family: 'Instrument Serif', serif;">${data.stats.conversions || 0}</div>
                </article>

                <article class="bento-card" style="display: flex; flex-direction: column; gap: 8px;">
                    <h4 style="margin: 0; color: var(--admin-text-muted); font-size: 0.9rem;">Meses Gratis Ganados</h4>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--color-aurora-500); font-family: 'Instrument Serif', serif;">${data.stats.freeMonthsEarned || 0}</div>
                </article>
            </div>
        `;

        setHtml('b2b-referrals', html);
    } catch (e) {
        setHtml(
            'b2b-referrals',
            `
            <div class="admin-section-header"><h2>Referir Clínicas</h2></div>
            <div class="bento-card"><p style="color:var(--color-red-500)">Error de red: ${e.message}</p></div>
        `
        );
    }
}
