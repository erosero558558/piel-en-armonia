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
                top: 24px;
                right: 24px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 12px;
                align-items: flex-end;
                pointer-events: none;
            }
            .aurora-toast {
                pointer-events: auto;
                min-width: 250px;
                max-width: 400px;
                padding: 14px 16px;
                border-radius: var(--radius-lg, 8px);
                background: var(--color-surface, #ffffff);
                color: var(--color-text, #1e293b);
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 12px;
                border-left: 4px solid var(--color-base-border, #cbd5e1);
                animation: toast-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                opacity: 0;
                transform: translateX(100%);
                font-family: var(--font-family-base, system-ui, sans-serif);
                font-size: 0.875rem;
                line-height: 1.4;
            }
            .aurora-toast.success {
                border-left-color: var(--color-success, #10b981);
                background-color: var(--color-success-subtle, #f0fdf4);
            }
            .aurora-toast.error {
                border-left-color: var(--color-danger, #ef4444);
                background-color: var(--color-danger-subtle, #fef2f2);
            }
            .aurora-toast.warning {
                border-left-color: var(--color-warning, #f59e0b);
                background-color: var(--color-warning-subtle, #fffbeb);
            }
            .aurora-toast.info {
                border-left-color: var(--color-info, #3b82f6);
                background-color: var(--color-info-subtle, #eff6ff);
            }
            @keyframes toast-slide-in {
                from { opacity: 0; transform: translateX(100%); }
                to { opacity: 1; transform: translateX(0); }
            }
            @keyframes toast-fade-out {
                from { opacity: 1; transform: translateX(0) scale(1); }
                to { opacity: 0; transform: translateX(20px) scale(0.95); }
            }
            .aurora-toast.closing {
                animation: toast-fade-out 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
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
    window.showToast = function(message, type = 'info', duration = 4000) {
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
    };
})();
