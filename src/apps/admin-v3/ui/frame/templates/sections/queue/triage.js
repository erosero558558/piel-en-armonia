export function renderQueueTriageToolbar() {
    return `
        <div id="queueTriageToolbar" class="toolbar-row">
            <button type="button" data-queue-filter="all">Todo</button>
            <button type="button" data-queue-filter="called">Llamados</button>
            <button type="button" data-queue-filter="sla_risk">Riesgo SLA</button>
            <input type="search" id="queueSearchInput" placeholder="Buscar ticket" />
            <button type="button" data-action="queue-clear-search">Limpiar</button>
            <button type="button" id="queueSelectVisibleBtn" data-action="queue-select-visible">Seleccionar visibles</button>
            <button type="button" id="queueClearSelectionBtn" data-action="queue-clear-selection">Limpiar seleccion</button>
            <button type="button" data-action="queue-bulk-action" data-queue-action="completar">Bulk completar</button>
            <button type="button" data-action="queue-bulk-action" data-queue-action="no_show">Bulk no_show</button>
            <button type="button" data-action="queue-bulk-reprint">Bulk reprint</button>
        </div>
    `;
}

export function renderQueueTriageMeta() {
    return `
        <div class="toolbar-row slim">
            <p id="queueTriageSummary">Sin riesgo</p>
            <span id="queueSelectionChip" class="is-hidden">Seleccionados: <strong id="queueSelectedCount">0</strong></span>
        </div>
    `;
}
