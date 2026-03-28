const QUICK_NAV_ITEMS = [
    { section: 'dashboard', label: 'Inicio' },
    { section: 'appointments', label: 'Agenda' },
    { section: 'callbacks', label: 'Pendientes' },
    { section: 'reviews', label: 'Resenas' },
    { section: 'availability', label: 'Horarios' },
    { section: 'queue', label: 'Turnero' },
];

function renderShellQuickNav() {
    return `
        <nav class="admin-quick-nav" aria-label="Navegacion rapida del admin">
            ${QUICK_NAV_ITEMS.map(
                ({ section, label }, index) => `
                    <button
                        type="button"
                        class="admin-quick-nav-item${index === 0 ? ' active' : ''}"
                        data-section="${section}"
                        aria-pressed="${index === 0 ? 'true' : 'false'}"
                    >
                        <span>${label}</span>
                    </button>
                `
            ).join('')}
        </nav>
    `;
}

export function renderShellContextStrip() {
    return `
        <section class="admin-v3-context-strip" id="adminProductivityStrip">
            <div class="admin-v3-context-copy" data-admin-section-hero>
                <p class="sony-kicker" id="adminSectionEyebrow">Inicio operativo</p>
                <h3 id="adminContextTitle">Resumen del consultorio</h3>
                <p id="adminContextSummary">Agenda, feedback y disponibilidad visibles desde la primera lectura, con acceso rapido al turnero cuando haga falta.</p>
                ${renderShellQuickNav()}
                <div id="adminContextActions" class="sony-context-actions"></div>
            </div>
            <div class="admin-v3-status-rail" data-admin-priority-rail>
                <article class="sony-status-tile">
                    <span>Push</span>
                    <strong id="pushStatusIndicator">Inicializando</strong>
                    <small id="pushStatusMeta">Comprobando permisos del navegador</small>
                </article>
                <article class="sony-status-tile" id="adminSessionTile" data-state="neutral">
                    <span>Sesion</span>
                    <strong id="adminSessionState">No autenticada</strong>
                    <small id="adminSessionMeta">Autenticate para operar el panel</small>
                </article>
                <article class="sony-status-tile">
                    <span>Sincronizacion</span>
                    <strong id="adminRefreshStatus">Datos: sin sincronizar</strong>
                    <small id="adminSyncState">Listo para primera sincronizacion</small>
                </article>
            </div>
        </section>
    `;
}
