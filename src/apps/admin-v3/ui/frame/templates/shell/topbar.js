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
                <h2 id="pageTitle">Turnero</h2>
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
