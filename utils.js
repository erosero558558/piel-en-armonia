/**
 * Shared utilities for Piel en Armonía
 */

const DEBUG = false;

/**
 * Escapes HTML special characters to prevent XSS.
 * @param {string} text - The text to escape.
 * @returns {string} The escaped HTML string.
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
}

function debugLog(...args) {
    if (DEBUG && typeof console !== 'undefined' && typeof console.log === 'function') {
        console.log(...args);
    }
}

// Expose to window explicitly to be safe, though function declaration does it in global scope
if (typeof window !== 'undefined') {
    window.escapeHtml = escapeHtml;
    window.debugLog = debugLog;
}
