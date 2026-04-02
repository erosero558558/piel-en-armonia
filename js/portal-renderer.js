/**
 * portal-renderer.js — Renderizadores de componentes reutilizables del Portal del Paciente.
 * Referenciado por es/portal/receta/index.html.
 *
 * Expone: window.AuroraPortalRenderer
 */
(function (window, document) {
    'use strict';

    const escapeHtml = window.AuroraPortalUI ? window.AuroraPortalUI.escapeHtml : (s) => s;

    /**
     * Renderiza la tarjeta de un medicamento en la lista de recetas.
     * @param {{ name:string, dose:string, frequency:string, duration:string, notes?:string }} med
     * @returns {string} HTML
     */
    function renderMedicationCard(med) {
        const name = escapeHtml(med.name || med.genericName || 'Medicamento');
        const dose = escapeHtml(med.dose || med.dosage || '');
        const frequency = escapeHtml(med.frequency || '');
        const duration = escapeHtml(med.duration || '');
        const notes = escapeHtml(med.notes || med.instructions || '');

        return `
            <article style="
                background: rgba(255,255,255,0.03);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 14px;
                padding: 16px 18px;
                margin-bottom: 12px;
            ">
                <div style="display:flex; align-items:flex-start; gap:12px;">
                    <div style="
                        width:36px; height:36px; border-radius:10px;
                        background: rgba(199,163,109,0.12);
                        border: 1px solid rgba(199,163,109,0.25);
                        display:flex; align-items:center; justify-content:center;
                        flex-shrink:0;
                    ">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(199,163,109,0.85)" stroke-width="2" aria-hidden="true">
                            <path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v3"/>
                            <circle cx="18" cy="18" r="3"/><path d="m22 22-1.5-1.5"/>
                        </svg>
                    </div>
                    <div style="flex:1; min-width:0;">
                        <strong style="color:#fff; font-size:1rem; display:block; margin-bottom:4px;">${name}</strong>
                        ${dose ? `<span style="color:rgba(255,255,255,0.65); font-size:0.85rem;">${dose}</span>` : ''}
                        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">
                            ${frequency ? `<span style="background:rgba(255,255,255,0.06); border-radius:6px; padding:3px 8px; font-size:0.78rem; color:rgba(255,255,255,0.6);">${frequency}</span>` : ''}
                            ${duration ? `<span style="background:rgba(255,255,255,0.06); border-radius:6px; padding:3px 8px; font-size:0.78rem; color:rgba(255,255,255,0.6);">${duration}</span>` : ''}
                        </div>
                        ${notes ? `<p style="margin:8px 0 0; font-size:0.82rem; color:rgba(255,255,255,0.5); line-height:1.4;">${notes}</p>` : ''}
                    </div>
                </div>
            </article>`;
    }

    /**
     * Renderiza el bloque de verificación QR de una receta o certificado.
     * @param {{ verifyUrl:string, documentCode?:string }} doc
     * @returns {string} HTML
     */
    function renderVerifyBlock(doc) {
        const url = escapeHtml(doc.verifyUrl || '');
        const code = escapeHtml(doc.documentCode || doc.folio || '');
        if (!url) return '';

        return `
            <div style="
                background: rgba(255,255,255,0.03);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 14px;
                padding: 18px;
                display: flex;
                align-items: center;
                gap: 14px;
            ">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="rgba(199,163,109,0.7)" stroke-width="1.5" aria-hidden="true" style="flex-shrink:0;">
                    <rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/>
                    <rect x="3" y="13" width="8" height="8" rx="1"/>
                    <path d="M13 13h2v2h-2zm4 0h2v2h-2zm0 4h2v2h-2zm-4 0h2v2h-2z"/>
                </svg>
                <div style="flex:1; min-width:0;">
                    ${code ? `<p style="margin:0 0 4px; font-size:0.78rem; color:rgba(255,255,255,0.45);">Folio ${code}</p>` : ''}
                    <a href="${url}" target="_blank" rel="noopener"
                       style="color:rgba(199,163,109,0.9); font-size:0.88rem; text-decoration:none; word-break:break-all;">
                        Verificar autenticidad del documento →
                    </a>
                </div>
            </div>`;
    }

    window.AuroraPortalRenderer = {
        renderMedicationCard,
        renderVerifyBlock,
    };
})(window, document);
