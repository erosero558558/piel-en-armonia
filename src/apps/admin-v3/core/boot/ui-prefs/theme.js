import {
    readThemeMode,
    persistThemeMode,
    applyTheme,
} from '../../../shared/core/flags.js';
import { updateState } from '../../../shared/core/store.js';

function getThemeButtons() {
    return Array.from(
        document.querySelectorAll('.admin-theme-btn[data-theme-mode]')
    );
}

export function readInitialThemeMode() {
    return readThemeMode();
}

export function setThemeMode(mode, { persist = false } = {}) {
    const resolvedTheme = applyTheme(mode);

    updateState((state) => ({
        ...state,
        ui: {
            ...state.ui,
            themeMode: mode,
            theme: resolvedTheme,
        },
    }));

    if (persist) {
        persistThemeMode(mode);
    }

    getThemeButtons().forEach((button) => {
        const active = button.dataset.themeMode === mode;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
    });
}
