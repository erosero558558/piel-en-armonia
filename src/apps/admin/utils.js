/**
 * Shared utilities for Piel en Armonía
 */

/**
 * Escapes HTML special characters to prevent XSS.
 * @param {string} text - The text to escape.
 * @returns {string} The escaped HTML string.
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
}

export function debugLog(...args) {
    // Debug logging removed
}
