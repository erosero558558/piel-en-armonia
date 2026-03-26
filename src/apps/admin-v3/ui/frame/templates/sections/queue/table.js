export function renderQueueTableShell() {
    return `
        <section class="queue-operations-stream">
            <div class="queue-operations-stream__header">
                <div>
                    <p class="queue-premium-band__eyebrow">Atención</p>
                    <h4>Turnos que piden seguimiento</h4>
                    <p>
                        Siguiente llamado, apoyos de recepción y cierres
                        recientes viven juntos para que la operación diaria no
                        se mezcle ni se disperse.
                    </p>
                </div>
            </div>
            <ul id="queueNextAdminList" class="sony-list"></ul>

            <div
                id="queueReceptionGuidancePanel"
                class="sony-panel soft queue-reception-guidance"
            >
                <div class="queue-reception-guidance__header">
                    <div>
                        <h4>Guía de recepción</h4>
                        <p id="queueReceptionGuidanceMeta">
                            Sin apoyos activos para recepcion.
                        </p>
                    </div>
                </div>
                <ul id="queueReceptionGuidanceList" class="sony-list"></ul>
            </div>

            <div
                id="queueReceptionResolutionsPanel"
            class="sony-panel soft queue-reception-guidance"
        >
            <div class="queue-reception-guidance__header">
                <div>
                    <h4>Resoluciones recientes</h4>
                        <p id="queueRecentResolutionsMeta">
                            Sin cierres asistidos todavia.
                        </p>
                    </div>
                </div>
                <ul id="queueRecentResolutionsList" class="sony-list"></ul>
            </div>
        </section>

        <div class="table-scroll">
            <table class="sony-table queue-admin-table">
                <thead>
                    <tr><th>Turno</th><th>Estado</th><th>Box</th><th>Acción</th></tr>
                </thead>
                <tbody id="queueTableBody">
                    <tr>
                        <td colspan="4" class="empty-cell">
                            Sin turnos en cola.
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div id="queueActivityPanel" class="sony-panel soft queue-activity-panel">
            <h4>Actividad de la cola</h4>
            <ul id="queueActivityList" class="sony-list"></ul>
        </div>
    `;
}
