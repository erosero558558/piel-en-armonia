export function renderQueueHeader() {
    return `
        <header class="section-header">
            <h3>Turnero Sala</h3>
            <div class="queue-admin-header-actions">
                <button type="button" data-action="queue-call-next" data-queue-consultorio="1">Llamar C1</button>
                <button type="button" data-action="queue-call-next" data-queue-consultorio="2">Llamar C2</button>
                <button type="button" data-action="queue-refresh-state">Refrescar</button>
            </div>
        </header>
    `;
}

export function renderQueueKpiGrid() {
    return `
        <div class="sony-grid sony-grid-kpi slim">
            <article class="sony-kpi"><h4>Espera</h4><strong id="queueWaitingCountAdmin">0</strong></article>
            <article class="sony-kpi"><h4>Llamados</h4><strong id="queueCalledCountAdmin">0</strong></article>
            <article class="sony-kpi"><h4>C1</h4><strong id="queueC1Now">Sin llamado</strong></article>
            <article class="sony-kpi"><h4>C2</h4><strong id="queueC2Now">Sin llamado</strong></article>
            <article class="sony-kpi"><h4>Sync</h4><strong id="queueSyncStatus" data-state="live">vivo</strong></article>
        </div>
    `;
}
