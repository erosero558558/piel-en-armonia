import { qs, qsa } from '../../shared/ui/render.js';
import { SECTION_TITLES } from './config.js';

const TOPBAR_QUICK_NAV_ITEMS = Object.freeze([
    {
        section: 'dashboard',
        label: 'Inicio',
        shortcut: 'Alt+1',
        title: 'Abrir el resumen principal del admin',
    },
    {
        section: 'callbacks',
        label: 'Pendientes',
        shortcut: 'Alt+3',
        title: 'Abrir callbacks y pendientes de contacto',
    },
    {
        section: 'queue',
        label: 'Turnero',
        shortcut: 'Alt+6',
        title: 'Abrir el corte piloto del turnero en admin v3',
    },
]);

function renderTopbarQuickNavMarkup() {
    return TOPBAR_QUICK_NAV_ITEMS.map(
        ({ section, label, shortcut, title }, index) => `
            <button
                type="button"
                class="admin-quick-nav-item${index === 0 ? ' active' : ''}"
                data-section="${section}"
                aria-pressed="${index === 0 ? 'true' : 'false'}"
                ${title ? `title="${title}"` : ''}
                ${title ? `aria-label="${label}. ${title}"` : ''}
            >
                <span>${label}</span>
                <span class="admin-quick-nav-shortcut">${shortcut}</span>
            </button>
        `
    ).join('');
}

function ensureTopbarQuickNav() {
    const topbar = qs('.admin-v3-topbar');
    if (!(topbar instanceof HTMLElement)) {
        return null;
    }

    const existing = qs('#adminQuickNav', topbar);
    if (existing instanceof HTMLElement) {
        return existing;
    }

    const quickNav = document.createElement('nav');
    quickNav.id = 'adminQuickNav';
    quickNav.className = 'admin-quick-nav';
    quickNav.setAttribute('aria-label', 'Accesos rapidos del admin');
    quickNav.innerHTML = renderTopbarQuickNavMarkup();

    const actions = qs('.admin-v3-topbar__actions', topbar);
    if (actions instanceof HTMLElement) {
        topbar.insertBefore(quickNav, actions);
        return quickNav;
    }

    topbar.appendChild(quickNav);
    return quickNav;
}

export function showLoginView() {
    const login = qs('#loginScreen');
    const dashboard = qs('#adminDashboard');
    if (login) login.classList.remove('is-hidden');
    if (dashboard) dashboard.classList.add('is-hidden');
}

export function showDashboardView() {
    const login = qs('#loginScreen');
    const dashboard = qs('#adminDashboard');
    if (login) login.classList.add('is-hidden');
    if (dashboard) dashboard.classList.remove('is-hidden');
}

export function showCommandPalette() {
    const palette = qs('#adminCommandPalette');
    if (!(palette instanceof HTMLElement)) return;
    palette.classList.remove('is-hidden');
    palette.setAttribute('aria-hidden', 'false');
    document.body.classList.add('admin-command-open');
}

export function hideCommandPalette() {
    const palette = qs('#adminCommandPalette');
    if (!(palette instanceof HTMLElement)) return;
    palette.classList.add('is-hidden');
    palette.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('admin-command-open');
}

export function showAgentPanel() {
    const panel = qs('#adminAgentPanel');
    const shell = qs('.admin-v3-shell');
    if (!(panel instanceof HTMLElement)) return;
    panel.classList.remove('is-hidden');
    panel.setAttribute('aria-hidden', 'false');
    shell?.classList.add('has-agent-panel');
    document.body.classList.add('admin-agent-open');
}

export function hideAgentPanel() {
    const panel = qs('#adminAgentPanel');
    const shell = qs('.admin-v3-shell');
    if (!(panel instanceof HTMLElement)) return;
    panel.classList.add('is-hidden');
    panel.setAttribute('aria-hidden', 'true');
    shell?.classList.remove('has-agent-panel');
    document.body.classList.remove('admin-agent-open');
}

export function setActiveSection(section) {
    ensureTopbarQuickNav();

    qsa('.admin-section').forEach((node) => {
        node.classList.toggle('active', node.id === section);
    });

    qsa('.nav-item[data-section]').forEach((node) => {
        const active = node.dataset.section === section;
        node.classList.toggle('active', active);
        if (active) {
            node.setAttribute('aria-current', 'page');
        } else {
            node.removeAttribute('aria-current');
        }
    });

    qsa('.admin-quick-nav-item[data-section]').forEach((node) => {
        const active = node.dataset.section === section;
        node.classList.toggle('active', active);
        node.setAttribute('aria-pressed', String(active));
    });

    const title = SECTION_TITLES[section] || 'Inicio';
    const pageTitle = qs('#pageTitle');
    if (pageTitle) pageTitle.textContent = title;
}

export function setSidebarState({ open, collapsed }) {
    const sidebar = qs('#adminSidebar');
    const backdrop = qs('#adminSidebarBackdrop');
    const toggle = qs('#adminMenuToggle');

    if (sidebar) sidebar.classList.toggle('is-open', Boolean(open));
    if (backdrop) backdrop.classList.toggle('is-hidden', !open);
    if (toggle) toggle.setAttribute('aria-expanded', String(Boolean(open)));

    document.body.classList.toggle('admin-sidebar-open', Boolean(open));
    document.body.classList.toggle(
        'admin-sidebar-collapsed',
        Boolean(collapsed)
    );

    const collapseBtn = qs('#adminSidebarCollapse');
    if (collapseBtn)
        collapseBtn.setAttribute('aria-pressed', String(Boolean(collapsed)));
}

export function getSectionTitle(section) {
    return SECTION_TITLES[section] || 'Inicio';
}
