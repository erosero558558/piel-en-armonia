export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function qs(selector, root = document) {
    return root.querySelector(selector);
}

export function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
}

export function formatDate(value) {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return String(value || '');
    return date.toLocaleDateString('es-EC', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

export function formatDateTime(value) {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return String(value || '');
    return date.toLocaleString('es-EC', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function formatNumber(value) {
    const num = Number(value || 0);
    if (!Number.isFinite(num)) return '0';
    return Math.round(num).toLocaleString('es-EC');
}

function normalizeToastOptions(options) {
    if (typeof options === 'number' && Number.isFinite(options)) {
        return { durationMs: options };
    }

    return options && typeof options === 'object' ? options : {};
}

export function createToast(message, type = 'info', options = {}) {
    const toastOptions = normalizeToastOptions(options);
    const durationMs = toastOptions.sticky
        ? 0
        : Number.isFinite(toastOptions.durationMs)
          ? Math.max(0, Number(toastOptions.durationMs))
          : 4500;

    if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
        return window.showToast(message, type, durationMs);
    }
    
    // Fallback if global is missing
    console.warn('[Toast Fallback]', type, message);
    return null;
}

export function setText(selector, value) {
    const el = qs(selector);
    if (el) el.textContent = String(value ?? '');
}

export function setHtml(selector, html) {
    const el = qs(selector);
    if (el) el.innerHTML = html;
}

export function setClass(selector, className, enabled) {
    const el = qs(selector);
    if (el) el.classList.toggle(className, Boolean(enabled));
}

export function hasFocusedInput() {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return false;
    return Boolean(
        active.closest(
            'input, textarea, select, [contenteditable="true"], [role="textbox"]'
        )
    );
}

export function toIsoDateKey(date) {
    const d = date instanceof Date ? date : new Date(date || '');
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
