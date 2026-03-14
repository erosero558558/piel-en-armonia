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
    const normalizedMode = THEMES.has(mode) ? mode : 'system';
    const resolved = resolveTheme(normalizedMode);
    document.documentElement.setAttribute('data-theme-mode', normalizedMode);
    document.documentElement.setAttribute('data-theme', resolved);

    if (
        window.PielOpsTheme &&
        typeof window.PielOpsTheme.applyOpsTheme === 'function'
    ) {
        window.PielOpsTheme.applyOpsTheme({
            surface: 'admin',
            family: 'command',
            mode: normalizedMode,
        });
        return document.documentElement.getAttribute('data-theme') || resolved;
    }

    document.documentElement.setAttribute('data-ops-tone', resolved);
    if (document.body instanceof HTMLElement) {
        document.body.setAttribute('data-ops-tone', resolved);
        document.body.setAttribute('data-ops-family', 'command');
    }
    return resolved;
}
