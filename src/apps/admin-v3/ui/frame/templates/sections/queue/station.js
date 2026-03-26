export function renderQueueStationControls() {
    return `
        <section class="queue-station-shell">
            <div class="queue-station-shell__header">
                <div>
                    <p class="sony-kicker">Puesto</p>
                    <h4>Puesto y atajos</h4>
                    <p>
                        Ajusta consultorio, un toque y teclado solo cuando la
                        operación diaria lo necesite.
                    </p>
                </div>
            </div>
            <div id="queueStationControl" class="toolbar-row queue-station-bar">
                <div class="queue-station-bar__meta">
                    <span id="queueStationBadge">Puesto actual: Estación libre</span>
                    <span id="queueStationModeBadge">Modo: Libre</span>
                    <span id="queuePracticeModeBadge" hidden>Modo práctica</span>
                </div>
                <div class="queue-station-bar__actions">
                    <button type="button" data-action="queue-lock-station" data-queue-consultorio="1">Fijar C1</button>
                    <button type="button" data-action="queue-lock-station" data-queue-consultorio="2">Fijar C2</button>
                    <button type="button" data-action="queue-set-station-mode" data-queue-mode="free">Modo libre</button>
                    <button type="button" data-action="queue-toggle-one-tap" aria-pressed="false">Un toque</button>
                    <button type="button" data-action="queue-toggle-shortcuts">Ver atajos</button>
                    <button type="button" data-action="queue-capture-call-key">Configurar tecla</button>
                    <button type="button" data-action="queue-clear-call-key" hidden>Quitar tecla</button>
                    <button type="button" data-action="queue-start-practice">Iniciar práctica</button>
                    <button type="button" data-action="queue-stop-practice">Salir práctica</button>
                    <button type="button" id="queueReleaseC1" data-action="queue-release-station" data-queue-consultorio="1" hidden>Liberar C1</button>
                    <button type="button" id="queueReleaseC2" data-action="queue-release-station" data-queue-consultorio="2" hidden>Liberar C2</button>
                </div>
            </div>
        </section>
    `;
}

export function renderQueueShortcutPanel() {
    return `
        <div id="queueShortcutPanel" class="queue-shortcut-panel" hidden>
            <p class="queue-shortcut-panel__eyebrow">Atajos del teclado numérico</p>
            <div class="queue-shortcut-panel__grid">
                <p><strong>Enter</strong> llama el siguiente turno.</p>
                <p><strong>Decimal</strong> prepara completar.</p>
                <p><strong>Subtract</strong> prepara no show.</p>
                <p><strong>Add</strong> vuelve a llamar el turno activo.</p>
            </div>
        </div>
    `;
}
