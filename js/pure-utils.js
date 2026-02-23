import { DEFAULT_TIME_SLOTS } from './config.js';

/**
 * Shared utilities for Piel en Armonía (Pure functions only).
 * Can be safely imported into engines without pulling in state.
 */

export function debugLog() {
    // Debug logging removed
}

/**
 * Escapes HTML special characters to prevent XSS.
 * Avoids creating DOM nodes repeatedly to reduce memory churn.
 * @param {string} text - The text to escape.
 * @returns {string} The escaped HTML string.
 */
export function escapeHtml(text) {
    if (text === null || text === undefined) {
        return '';
    }
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function getDefaultTimeSlots() {
    return DEFAULT_TIME_SLOTS.slice();
}
