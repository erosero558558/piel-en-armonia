/**
 * js/aurora-toast.js
 * Toast Notification System "Clinical Luxury" UI for Aurora Derm Admin
 */

(function() {
    const TOAST_LIMIT = 3;

    function initStyles() {
        if (document.getElementById('aurora-toast-styles')) return;
        const style = document.createElement('style');
        style.id = 'aurora-toast-styles';
        style.innerHTML = `
            #auroraToastContainer {
                position: fixed;
                bottom: 24px;
                right: 24px;
                z-index: 9999;
                display: flex;
                flex-direction: column-reverse; /* newest at bottom normally? well it appends to end so column is fine, lets use column */
                gap: 12px;
                align-items: flex-end;
                pointer-events: none;
            }
            .aurora-toast {
                pointer-events: auto;
                min-width: 250px;
                max-width: 400px;
                padding: 14px 16px;
                border-radius: var(--radius-xl, 16px);
                background: rgba(15, 23, 42, 0.65);
                backdrop-filter: blur(24px) saturate(180%);
                -webkit-backdrop-filter: blur(24px) saturate(180%);
                color: #ffffff;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1);
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 12px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-left: 4px solid var(--color-base-border, #cbd5e1);
                animation: toast-slide-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
                opacity: 0;
                transform: translateX(100%);
                font-family: var(--font-family-base, system-ui, sans-serif);
                font-size: 0.875rem;
                line-height: 1.4;
            }
            .aurora-toast.success {
                border-left-color: var(--color-success, #10b981);
                background: rgba(16, 185, 129, 0.15);
                border-color: rgba(16, 185, 129, 0.3);
                border-left: 4px solid var(--color-success, #10b981);
            }
            .aurora-toast.error {
                border-left-color: var(--color-danger, #ef4444);
                background: rgba(239, 68, 68, 0.15);
                border-color: rgba(239, 68, 68, 0.3);
                border-left: 4px solid var(--color-danger, #ef4444);
            }
            .aurora-toast.warning {
                border-left-color: var(--color-warning, #f59e0b);
                background: rgba(245, 158, 11, 0.15);
                border-color: rgba(245, 158, 11, 0.3);
                border-left: 4px solid var(--color-warning, #f59e0b);
            }
            .aurora-toast.info {
                border-left-color: var(--color-info, #3b82f6);
                background: rgba(59, 130, 246, 0.15);
                border-color: rgba(59, 130, 246, 0.3);
                border-left: 4px solid var(--color-info, #3b82f6);
            }
            @keyframes toast-slide-in {
                from { opacity: 0; transform: translateY(20px) scale(0.95); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes toast-fade-out {
                from { opacity: 1; transform: translateY(0) scale(1); }
                to { opacity: 0; transform: translateY(-20px) scale(0.95); }
            }
            .aurora-toast.closing {
                animation: toast-fade-out 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            }
            .aurora-toast-body {
                flex: 1;
                font-weight: 500;
            }
            .aurora-toast-close {
                background: transparent;
                border: none;
                color: currentColor;
                opacity: 0.5;
                cursor: pointer;
                font-size: 1.25rem;
                line-height: 1;
                padding: 0;
                margin-top: -2px;
                transition: opacity 0.2s ease;
            }
            .aurora-toast-close:hover {
                opacity: 1;
            }
        `;
        document.head.appendChild(style);
    }

    function getContainer() {
        let container = document.getElementById('auroraToastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'auroraToastContainer';
            document.body.appendChild(container);
        }
        return container;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * @param {string} message 
     * @param {string} type 'success' | 'error' | 'warning' | 'info'
     * @param {number} duration ms
     */
    window.toast = {
        show: function(message, type = 'info', duration = 4000) {
            if (typeof document === 'undefined') return;
            
            initStyles();
            const container = getContainer();

            const validTypes = ['success', 'error', 'warning', 'info'];
            const toastType = validTypes.includes(type) ? type : 'info';

            const toast = document.createElement('div');
            toast.className = `aurora-toast ${toastType}`;
            toast.setAttribute('role', toastType === 'error' ? 'alert' : 'status');
            
            toast.innerHTML = `
                <div class="aurora-toast-body">${escapeHtml(message)}</div>
                <button type="button" class="aurora-toast-close" aria-label="Cerrar">&times;</button>
            `;

            function closeToast() {
                if (toast.classList.contains('closing')) return;
                toast.classList.add('closing');
                toast.addEventListener('animationend', () => {
                    if (toast.parentElement) toast.remove();
                });
            }

            const closeBtn = toast.querySelector('.aurora-toast-close');
            closeBtn.addEventListener('click', closeToast);

            container.appendChild(toast);

            // Enforce max stack of 3 visually
            const existingToasts = Array.from(container.children);
            if (existingToasts.length > TOAST_LIMIT) {
                // Take the oldest (first child) and forcefully remove
                const toRemove = existingToasts.slice(0, existingToasts.length - TOAST_LIMIT);
                toRemove.forEach(t => t.remove());
            }

            if (duration > 0) {
                setTimeout(() => {
                    if (toast.parentElement) closeToast();
                }, duration);
            }

            return toast;
        }
    };

    // Global Fallback Alias (UI5-19 compatibility mapping)
    window.showToast = window.toast.show;
})();
