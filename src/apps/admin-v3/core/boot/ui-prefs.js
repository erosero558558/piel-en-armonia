import {
    readThemeMode,
    persistThemeMode,
    applyTheme,
} from '../../shared/core/flags.js';
import {
    getStorageItem,
    setStorageItem,
} from '../../shared/core/persistence.js';
import { normalizeSection, setSectionHash } from '../../shared/core/router.js';
import { getState, updateState } from '../../shared/core/store.js';
import { qs } from '../../shared/ui/render.js';
import { setActiveSection, setSidebarState } from '../../ui/frame.js';

const ADMIN_LAST_SECTION_STORAGE_KEY = 'adminLastSection';
const ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY = 'adminSidebarCollapsed';
const COMPACT_SIDEBAR_MEDIA_QUERY = '(max-width: 1024px)';

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

export function restoreUiPrefs() {
    const lastSection = normalizeSection(
        getStorageItem(ADMIN_LAST_SECTION_STORAGE_KEY, 'dashboard')
    );
    const collapsed =
        getStorageItem(ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY, '0') === '1';

    updateState((state) => ({
        ...state,
        ui: {
            ...state.ui,
            activeSection: lastSection,
            sidebarCollapsed: collapsed,
            sidebarOpen: false,
        },
    }));

    setActiveSection(lastSection);
    setSectionHash(lastSection);
    renderSidebarState();
}

export function persistUiPrefs() {
    const state = getState();
    setStorageItem(ADMIN_LAST_SECTION_STORAGE_KEY, state.ui.activeSection);
    setStorageItem(
        ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY,
        state.ui.sidebarCollapsed ? '1' : '0'
    );
}

export function isCompactViewport() {
    return window.matchMedia(COMPACT_SIDEBAR_MEDIA_QUERY).matches;
}

function isFocusableElement(element) {
    if (!(element instanceof HTMLElement)) return false;
    if (element.hidden) return false;
    if (element.getAttribute('aria-hidden') === 'true') return false;
    if ('disabled' in element && element.disabled) return false;
    return element.getClientRects().length > 0;
}

export function getCompactSidebarFocusables() {
    const sidebar = qs('#adminSidebar');
    if (!(sidebar instanceof HTMLElement)) return [];

    const menuClose = qs('#adminMenuClose');
    const activeNav = sidebar.querySelector('.nav-item.active[data-section]');
    const navItems = Array.from(
        sidebar.querySelectorAll('.nav-item[data-section]')
    ).filter((node) => node !== activeNav);
    const logoutButton = sidebar.querySelector('.logout-btn');

    return [menuClose, activeNav, ...navItems, logoutButton].filter(
        isFocusableElement
    );
}

function focusSidebarEntry() {
    const sidebar = qs('#adminSidebar');
    if (!(sidebar instanceof HTMLElement)) return;

    window.requestAnimationFrame(() => {
        const activeNav =
            sidebar.querySelector('.nav-item.active[data-section]') ||
            sidebar.querySelector('.nav-item[data-section]');
        if (activeNav instanceof HTMLElement) {
            activeNav.focus();
        }
    });
}

export function renderSidebarState() {
    const state = getState();
    const compactViewport = isCompactViewport();
    const sidebar = qs('#adminSidebar');
    const wasOpen =
        sidebar instanceof HTMLElement && sidebar.classList.contains('is-open');

    setSidebarState({
        open: compactViewport ? state.ui.sidebarOpen : false,
        collapsed: compactViewport ? false : state.ui.sidebarCollapsed,
    });

    if (compactViewport && state.ui.sidebarOpen && !wasOpen) {
        focusSidebarEntry();
    }
}
