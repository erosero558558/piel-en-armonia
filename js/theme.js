import { THEME_STORAGE_KEY, VALID_THEME_MODES } from './config.js';
import { getCurrentThemeMode, setCurrentThemeMode } from './state.js';

let themeTransitionTimer = null;
const systemThemeQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function resolveThemeMode(mode = getCurrentThemeMode()) {
    if (mode === 'system') {
        if (systemThemeQuery && systemThemeQuery.matches) {
            return 'dark';
        }
        return 'light';
    }
    return mode;
}

export function applyThemeMode(mode = getCurrentThemeMode()) {
    const resolvedTheme = resolveThemeMode(mode);
    document.documentElement.setAttribute('data-theme-mode', mode);
    document.documentElement.setAttribute('data-theme', resolvedTheme);
}

export function updateThemeButtons() {
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.themeMode === getCurrentThemeMode());
    });
}

export function animateThemeTransition() {
    if (!document.body) return;

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

export function setThemeMode(mode) {
    if (!VALID_THEME_MODES.has(mode)) {
        return;
    }

    setCurrentThemeMode(mode);
    localStorage.setItem(THEME_STORAGE_KEY, mode);
    animateThemeTransition();
    applyThemeMode(mode);
    updateThemeButtons();
}

export function initThemeMode() {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'system';
    const mode = VALID_THEME_MODES.has(storedTheme) ? storedTheme : 'system';
    setCurrentThemeMode(mode);
    applyThemeMode(mode);
    updateThemeButtons();

    if (systemThemeQuery) {
        const handler = () => {
             if (getCurrentThemeMode() === 'system') {
                 applyThemeMode('system');
             }
        };
        if (typeof systemThemeQuery.addEventListener === 'function') {
            systemThemeQuery.addEventListener('change', handler);
        } else if (typeof systemThemeQuery.addListener === 'function') {
            systemThemeQuery.addListener(handler);
        }
    }
}
