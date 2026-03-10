export function renderQueueSensitiveDialog() {
    return `
        <dialog id="queueSensitiveConfirmDialog" class="queue-sensitive-confirm-dialog">
            <form method="dialog">
                <p id="queueSensitiveConfirmMessage">Confirmar accion sensible</p>
                <div class="toolbar-group">
                    <button type="button" data-action="queue-sensitive-cancel">Cancelar</button>
                    <button type="button" data-action="queue-sensitive-confirm">Confirmar</button>
                </div>
            </form>
        </dialog>
    `;
}
