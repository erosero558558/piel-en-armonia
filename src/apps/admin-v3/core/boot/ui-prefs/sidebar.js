import { getState } from '../../../shared/core/store.js';
import { qs } from '../../../shared/ui/render.js';
import { setSidebarState } from '../../../ui/frame.js';
import { COMPACT_SIDEBAR_MEDIA_QUERY } from './constants.js';

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
