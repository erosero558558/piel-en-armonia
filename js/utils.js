import { getCurrentLang } from './state.js';
import { COOKIE_CONSENT_KEY } from './config.js';

const DEBUG = false;

export function debugLog(...args) {
    if (DEBUG) {
        console.log(...args);
    }
}

export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function waitMs(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function isConstrainedNetworkConnection() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return !!(connection && (
        connection.saveData === true
        || /(^|[^0-9])2g/.test(String(connection.effectiveType || ''))
    ));
}

// TOAST NOTIFICATIONS SYSTEM
export function showToast(message, type = 'info', title = '') {
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
        success: title || 'Éxito',
        error: title || 'Error',
        warning: title || 'Advertencia',
        info: title || 'Información'
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

export function storageGetJSON(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || 'null');
        return value === null ? fallback : value;
    } catch (error) {
        return fallback;
    }
}

export function storageSetJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        // Ignore storage quota errors.
    }
}

export function getInitials(name) {
    const parts = String(name || 'Paciente')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2);
    if (parts.length === 0) return 'PA';
    return parts.map(part => part[0].toUpperCase()).join('');
}

export function getRelativeDateLabel(dateText) {
    const date = new Date(dateText);
    if (Number.isNaN(date.getTime())) {
        return getCurrentLang() === 'es' ? 'Reciente' : 'Recent';
    }
    const now = new Date();
    const days = Math.max(0, Math.floor((now - date) / (1000 * 60 * 60 * 24)));
    if (getCurrentLang() === 'es') {
        if (days <= 1) return 'Hoy';
        if (days < 7) return `Hace ${days} d${days === 1 ? 'ía' : 'ías'}`;
        if (days < 30) return `Hace ${Math.floor(days / 7)} semana(s)`;
        return date.toLocaleDateString('es-EC');
    }
    if (days <= 1) return 'Today';
    if (days < 7) return `${days} day(s) ago`;
    if (days < 30) return `${Math.floor(days / 7)} week(s) ago`;
    return date.toLocaleDateString('en-US');
}

export function renderStars(rating) {
    const value = Math.max(1, Math.min(5, Number(rating) || 0));
    let html = '';
    for (let i = 1; i <= 5; i += 1) {
        html += `<i class="${i <= value ? 'fas' : 'far'} fa-star"></i>`;
    }
    return html;
}

export function getCookieConsent() {
    try {
        const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
        if (!raw) return '';
        const parsed = JSON.parse(raw);
        return typeof parsed?.status === 'string' ? parsed.status : '';
    } catch (error) {
        return '';
    }
}

export function setCookieConsent(status) {
    const normalized = status === 'accepted' ? 'accepted' : 'rejected';
    try {
        localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({
            status: normalized,
            at: new Date().toISOString()
        }));
    } catch (error) {
        // noop
    }
}
