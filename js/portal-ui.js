/**
 * portal-ui.js — Utilidades de interfaz compartidas del Portal del Paciente.
 * Sustituye el import fallido en es/portal/receta/index.html y es/portal/plan/index.html.
 *
 * Expone: window.AuroraPortalUI
 */
(function (window, document) {
    'use strict';

    /**
     * Escapa HTML para prevenir XSS al insertar en innerHTML.
     * @param {string} str
     * @returns {string}
     */
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Muestra un estado de error inline en un contenedor.
     * @param {HTMLElement} container
     * @param {string} message
     * @param {boolean} [retryable=false]
     */
    function showInlineError(container, message, retryable = false) {
        if (!container) return;
        const retryHtml = retryable
            ? `<button onclick="window.location.reload()" style="margin-top:12px; padding:8px 20px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); border-radius:8px; color:#fff; cursor:pointer; font-size:0.85rem;">Reintentar</button>`
            : '';
        container.innerHTML = `
            <div role="alert" style="padding:24px 20px; text-align:center; color:rgba(255,255,255,0.6); font-size:0.9rem; line-height:1.5;">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" style="margin-bottom:12px; display:block; margin-left:auto; margin-right:auto;" aria-hidden="true">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p style="margin:0;">${escapeHtml(message)}</p>
                ${retryHtml}
            </div>`;
    }

    /**
     * Muestra un estado de carga (skeleton) en un contenedor.
     * @param {HTMLElement} container
     * @param {number} [lines=3]
     */
    function showSkeleton(container, lines = 3) {
        if (!container) return;
        const bars = Array.from({ length: lines }, (_, i) => {
            const widths = ['78%', '54%', '66%', '42%', '88%'];
            return `<div class="skeleton" style="height:14px; width:${widths[i % widths.length]}; border-radius:6px; margin-bottom:10px;"></div>`;
        }).join('');
        container.innerHTML = `<div style="padding:20px;">${bars}</div>`;
    }

    /**
     * Muestra un estado vacío.
     * @param {HTMLElement} container
     * @param {string} message
     */
    function showEmptyState(container, message) {
        if (!container) return;
        container.innerHTML = `
            <div style="padding:32px 16px; text-align:center;">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" style="margin-bottom:14px; display:block; margin-left:auto; margin-right:auto;" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 9h6M9 13h4"/>
                </svg>
                <p style="color:rgba(255,255,255,0.45); font-size:0.9rem; margin:0; line-height:1.5;">${escapeHtml(message)}</p>
            </div>`;
    }

    /**
     * Formatea una fecha ISO en formato legible en español.
     * @param {string} isoDate
     * @returns {string}
     */
    function formatDate(isoDate) {
        if (!isoDate) return '—';
        try {
            return new Date(isoDate).toLocaleDateString('es-EC', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
        } catch (_) {
            return isoDate;
        }
    }

    window.AuroraPortalUI = {
        escapeHtml,
        showInlineError,
        showSkeleton,
        showEmptyState,
        formatDate,
    };
})(window, document);
