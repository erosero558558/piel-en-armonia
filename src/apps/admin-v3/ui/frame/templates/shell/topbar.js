import { icon } from '../../../../shared/ui/icons.js';
import { renderHeaderThemeSwitcher } from '../login.js';

const OPERATIONAL_SECTIONS = [
    { section: 'callbacks', label: 'Pendientes' },
    { section: 'appointments', label: 'Agenda' },
    { section: 'queue', label: 'Turnero', active: true },
];

function renderTopbarOperationalNav() {
    const items = OPERATIONAL_SECTIONS.map(({ section, label, active }) => {
        return `
            <a
                href="#${section}"
                class="admin-v3-topbar-subnav-item${active ? ' active' : ''}"
                data-section="${section}"
                ${active ? 'aria-current="page"' : ''}
            >${label}</a>
        `;
    }).join('');

    return `
        <nav
            id="adminTopbarOperationalNav"
            class="admin-v3-topbar__subnav"
            aria-label="Accesos operativos"
        >
            ${items}
        </nav>
    `;
}

export function renderShellTopbar() {
    return `
        <header class="admin-v3-topbar">
            <div class="admin-v3-topbar__copy">
                <p class="sony-kicker">Consola de control</p>
                <div style="display: flex; align-items: center; gap: 16px;">
                    <h2 id="pageTitle">Turnero</h2>
                    <!-- S33-05: Workload indicator module -->
                    <div id="adminWorkloadPill" class="workload-pill patients-today-header" style="
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                        padding: 4px 12px;
                        border-radius: 999px;
                        background: rgba(34, 197, 94, 0.15); /* verde por defecto */
                        border: 1px solid rgba(34, 197, 94, 0.3);
                        backdrop-filter: blur(12px);
                        font-size: 0.75rem;
                        font-weight: 700;
                        color: #4ade80;
                        letter-spacing: 0.05em;
                        text-transform: uppercase;
                    ">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                        <span data-workload-text>12 pacientes hoy / 4 completados</span>
                    </div>
                </div>
                ${renderTopbarOperationalNav()}
            </div>
            <div class="admin-v3-topbar__actions">
                <button type="button" id="adminMenuToggle" class="admin-v3-topbar__menu" aria-controls="adminSidebar" aria-expanded="false">${icon('menu')}<span>Menu</span></button>
                <button type="button" class="admin-v3-agent-btn" data-action="open-agent-panel">Copiloto</button>
                <button type="button" class="admin-v3-command-btn" data-action="open-command-palette">Acciones</button>
                <button type="button" id="refreshAdminDataBtn" data-action="refresh-admin-data">Actualizar</button>
                ${renderHeaderThemeSwitcher()}
            </div>
        </header>
    `;
}
