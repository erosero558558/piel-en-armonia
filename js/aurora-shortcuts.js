/**
 * js/aurora-shortcuts.js
 * Atajos de teclado para la consola operativa
 * (UI2-08)
 */
(function() {
    function isFocusInInput(e) {
        const tag = e.target.tagName ? e.target.tagName.toLowerCase() : '';
        return tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
    }

    function createHelpModal() {
        const overlay = document.createElement('div');
        overlay.id = 'shortcut-help-modal';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(15, 23, 42, 0.6)';
        overlay.style.backdropFilter = 'blur(4px)';
        overlay.style.zIndex = '99999';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.fontFamily = 'var(--font-family-base, system-ui)';

        const modal = document.createElement('div');
        modal.style.background = 'var(--color-surface, #ffffff)';
        modal.style.borderRadius = '12px';
        modal.style.padding = '24px';
        modal.style.width = '100%';
        modal.style.maxWidth = '400px';
        modal.style.boxShadow = '0 20px 25px -5px rgba(0,0,0,0.1)';
        modal.style.color = 'var(--color-text, #1e293b)';
        
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const modKey = isMac ? '⌘' : 'Ctrl';

        modal.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <h3 style="margin:0; font-size:1.25rem; font-weight:600;">Atajos de Teclado</h3>
                <button id="close-shortcut-modal" style="background:none; border:none; cursor:pointer; font-size:1.5rem; color:var(--text-muted);">&times;</button>
            </div>
            <ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:12px;">
                <li style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">
                    <span>Búsqueda Global</span>
                    <span style="background:#f1f5f9; padding:4px 8px; border-radius:4px; font-family:monospace; font-size:12px; font-weight:600;">${modKey} + K</span>
                </li>
                <li style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">
                    <span>Nueva Cita</span>
                    <span style="background:#f1f5f9; padding:4px 8px; border-radius:4px; font-family:monospace; font-size:12px; font-weight:600;">${modKey} + N</span>
                </li>
                <li style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">
                    <span>Abrir OpenClaw</span>
                    <span style="background:#f1f5f9; padding:4px 8px; border-radius:4px; font-family:monospace; font-size:12px; font-weight:600;">${modKey} + O</span>
                </li>
                <li style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">
                    <span>Imprimir Ficha Activa</span>
                    <span style="background:#f1f5f9; padding:4px 8px; border-radius:4px; font-family:monospace; font-size:12px; font-weight:600;">${modKey} + P</span>
                </li>
                <li style="display:flex; justify-content:space-between; align-items:center;">
                    <span>Ayuda de Atajos</span>
                    <span style="background:#f1f5f9; padding:4px 8px; border-radius:4px; font-family:monospace; font-size:12px; font-weight:600;">? / Shift + /</span>
                </li>
            </ul>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        modal.querySelector('#close-shortcut-modal').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    }

    document.addEventListener('keydown', (e) => {
        if (isFocusInInput(e)) return;

        if (e.key === '?') {
            e.preventDefault();
            if (!document.getElementById('shortcut-help-modal')) {
                createHelpModal();
            }
            return;
        }

        if (e.ctrlKey || e.metaKey) {
            const lowKey = e.key.toLowerCase();
            
            if (lowKey === 'k') {
                e.preventDefault();
                const searchInput = document.querySelector('.admin-search input');
                if (searchInput) searchInput.focus();
            } else if (lowKey === 'n') {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent('aurora:shortcut:new-appointment'));
                if (window.showToast) window.showToast('Atajo activado: Nueva Cita', 'info');
            } else if (lowKey === 'o') {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent('aurora:shortcut:openclaw'));
                if (window.showToast) window.showToast('Invocando asistente clínico OpenClaw', 'info');
            } else if (lowKey === 'p') {
                e.preventDefault();
                window.print();
            }
        }
    });

    function injectSearchBadge() {
        const searchContainer = document.querySelector('.admin-search');
        if (searchContainer && !searchContainer.querySelector('.shortcut-badge')) {
            const badge = document.createElement('div');
            badge.className = 'shortcut-badge';
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            badge.textContent = isMac ? '⌘K' : 'Ctrl+K';
            
            badge.style.position = 'absolute';
            badge.style.right = '12px';
            badge.style.top = '50%';
            badge.style.transform = 'translateY(-50%)';
            badge.style.background = 'var(--color-surface-2, #f1f5f9)';
            badge.style.border = '1px solid var(--border-color, #e2e8f0)';
            badge.style.borderRadius = '4px';
            badge.style.padding = '2px 6px';
            badge.style.fontSize = '11px';
            badge.style.fontWeight = '600';
            badge.style.color = 'var(--text-muted, #64748b)';
            badge.style.pointerEvents = 'none';

            searchContainer.style.position = 'relative';
            searchContainer.appendChild(badge);
            
            const input = searchContainer.querySelector('input');
            if (input) {
                input.style.paddingRight = '54px';
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectSearchBadge);
    } else {
        injectSearchBadge();
    }
})();
