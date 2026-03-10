export function renderQueueTableShell() {
    return `
        <ul id="queueNextAdminList" class="sony-list"></ul>

        <div class="table-scroll">
            <table class="sony-table queue-admin-table">
                <thead>
                    <tr>
                        <th>Sel</th>
                        <th>Ticket</th>
                        <th>Tipo</th>
                        <th>Estado</th>
                        <th>Consultorio</th>
                        <th>Espera</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody id="queueTableBody"></tbody>
            </table>
        </div>

        <div id="queueActivityPanel" class="sony-panel soft">
            <h4>Actividad</h4>
            <ul id="queueActivityList" class="sony-list"></ul>
        </div>
    `;
}
