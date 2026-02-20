/**
 * Shared utilities for Piel en Armonía
 */

/**
 * Escapes HTML special characters to prevent XSS.
 * @param {string} text - The text to escape.
 * @returns {string} The escaped HTML string.
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text || '');
    return div.innerHTML;
}

function debugLog() {
    // Debug logging removed
}

function waitMs(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' });
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

function showToast(message, type = 'info', title = '') {
    // Create container if doesn't exist
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };

    const titles = {
        success: title || 'Exito',
        error: title || 'Error',
        warning: title || 'Advertencia',
        info: title || 'Informacion'
    };

    // Escapar mensaje para prevenir XSS
    const safeMsg = String(message).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    toast.innerHTML = `
        <i class="fas ${icons[type]} toast-icon"></i>
        <div class="toast-content">
            <div class="toast-title">${titles[type]}</div>
            <div class="toast-message">${safeMsg}</div>
        </div>
        <button type="button" class="toast-close" data-action="toast-close">
            <i class="fas fa-times"></i>
        </button>
        <div class="toast-progress"></div>
    `;

    container.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

// Expose to window explicitly to be safe, though function declaration does it in global scope
if (typeof window !== 'undefined') {
    window.escapeHtml = escapeHtml;
    window.debugLog = debugLog;
    window.waitMs = waitMs;
    window.formatDate = formatDate;
    window.debounce = debounce;
    window.showToast = showToast;
}
