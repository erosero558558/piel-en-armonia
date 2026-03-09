import { getStorageItem, setStorageItem } from './persistence.js';

const THEME_STORAGE_KEY = 'themeMode';
const THEMES = new Set(['light', 'dark', 'system']);

export function readThemeMode() {
    const stored = String(
        getStorageItem(THEME_STORAGE_KEY, 'system') || 'system'
    )
        .trim()
        .toLowerCase();
    return THEMES.has(stored) ? stored : 'system';
}

export function persistThemeMode(mode) {
    const value = THEMES.has(mode) ? mode : 'system';
    setStorageItem(THEME_STORAGE_KEY, value);
}

export function resolveTheme(mode) {
    if (mode === 'light' || mode === 'dark') return mode;
    return window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
}

export function applyTheme(mode) {
    const resolved = resolveTheme(mode);
    document.documentElement.setAttribute('data-theme-mode', mode);
    document.documentElement.setAttribute('data-theme', resolved);
    return resolved;
}
