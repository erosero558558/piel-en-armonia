import { getStorageItem, setStorageItem } from './persistence.js';

const THEME_STORAGE_KEY = 'themeMode';
const SYSTEM_THEME_QUERY = '(prefers-color-scheme: dark)';
const THEMES = new Set(['light', 'dark', 'system']);
let systemThemeListenerBound = false;

function bindSystemThemeListener() {
    if (systemThemeListenerBound || typeof window.matchMedia !== 'function') {
        return;
    }

    const mediaQuery = window.matchMedia(SYSTEM_THEME_QUERY);
    const handleThemeChange = () => {
        if (
            document.documentElement.getAttribute('data-theme-mode') !==
            'system'
        ) {
            return;
        }

        applyTheme('system');
    };

    if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', handleThemeChange);
        systemThemeListenerBound = true;
        return;
    }

    if (typeof mediaQuery.addListener === 'function') {
        mediaQuery.addListener(handleThemeChange);
        systemThemeListenerBound = true;
    }
}

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
    bindSystemThemeListener();
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
    document.documentElement.setAttribute('data-ops-family', 'command');
    document.documentElement.setAttribute('data-ops-surface', 'admin');
    if (document.body instanceof HTMLElement) {
        document.body.setAttribute('data-theme', resolved);
        document.body.setAttribute('data-ops-tone', resolved);
        document.body.setAttribute('data-ops-family', 'command');
        document.body.setAttribute('data-ops-surface', 'admin');
    }
    return resolved;
}
