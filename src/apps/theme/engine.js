'use strict';

let deps = null;
let themeTransitionTimer = null;
let systemThemeListenerBound = false;

function init(inputDeps) {
    deps = inputDeps || {};
    bindSystemThemeListener();
    return window.PielThemeEngine;
}

function getCurrentThemeMode() {
    if (deps && typeof deps.getCurrentThemeMode === 'function') {
        return deps.getCurrentThemeMode() || 'system';
    }
    return 'system';
}

function setCurrentThemeMode(mode) {
    if (deps && typeof deps.setCurrentThemeMode === 'function') {
        deps.setCurrentThemeMode(mode);
    }
}

function getThemeStorageKey() {
    if (deps && typeof deps.themeStorageKey === 'string' && deps.themeStorageKey) {
        return deps.themeStorageKey;
    }
    return 'themeMode';
}

function getSystemThemeQuery() {
    if (deps && typeof deps.getSystemThemeQuery === 'function') {
        return deps.getSystemThemeQuery();
    }
    return window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
}

function isValidThemeMode(mode) {
    const normalized = String(mode || '').trim();
    const validModes = deps ? deps.validThemeModes : null;
    if (Array.isArray(validModes)) {
        return validModes.includes(normalized);
    }
    return normalized === 'light' || normalized === 'dark' || normalized === 'system';
}

function resolveThemeMode(mode) {
    const currentMode = mode || getCurrentThemeMode();
    if (currentMode === 'system') {
        const systemThemeQuery = getSystemThemeQuery();
        if (systemThemeQuery && systemThemeQuery.matches) {
            return 'dark';
        }
        return 'light';
    }
    return currentMode;
}

function applyThemeMode(mode) {
    const currentMode = mode || getCurrentThemeMode();
    const resolvedTheme = resolveThemeMode(currentMode);
    document.documentElement.setAttribute('data-theme-mode', currentMode);
    document.documentElement.setAttribute('data-theme', resolvedTheme);
}

function updateThemeButtons() {
    const currentMode = getCurrentThemeMode();
    document.querySelectorAll('.theme-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.themeMode === currentMode);
    });
}

function animateThemeTransition() {
    if (!document.body) {
        return;
    }

    if (themeTransitionTimer) {
        clearTimeout(themeTransitionTimer);
    }

    document.body.classList.remove('theme-transition');
    void document.body.offsetWidth;
    document.body.classList.add('theme-transition');

    themeTransitionTimer = setTimeout(() => {
        document.body.classList.remove('theme-transition');
    }, 320);
}

function setThemeMode(mode) {
    if (!isValidThemeMode(mode)) {
        return;
    }

    setCurrentThemeMode(mode);
    localStorage.setItem(getThemeStorageKey(), mode);
    animateThemeTransition();
    applyThemeMode(mode);
    updateThemeButtons();
}

function initThemeMode() {
    const storedTheme = localStorage.getItem(getThemeStorageKey()) || 'system';
    const nextMode = isValidThemeMode(storedTheme) ? storedTheme : 'system';
    setCurrentThemeMode(nextMode);
    applyThemeMode(nextMode);
    updateThemeButtons();
}

function handleSystemThemeChange() {
    if (getCurrentThemeMode() === 'system') {
        applyThemeMode('system');
    }
}

function bindSystemThemeListener() {
    if (systemThemeListenerBound) {
        return;
    }

    const systemThemeQuery = getSystemThemeQuery();
    if (!systemThemeQuery) {
        return;
    }

    if (typeof systemThemeQuery.addEventListener === 'function') {
        systemThemeQuery.addEventListener('change', handleSystemThemeChange);
        systemThemeListenerBound = true;
        return;
    }

    if (typeof systemThemeQuery.addListener === 'function') {
        systemThemeQuery.addListener(handleSystemThemeChange);
        systemThemeListenerBound = true;
    }
}

window.PielThemeEngine = {
    init,
    setThemeMode,
    initThemeMode,
    applyThemeMode
};
