export function renderCallbacksFocusPanel() {
    return `
        <article class="sony-panel callbacks-next-panel">
            <header class="section-header">
                <div>
                    <p class="sony-kicker" id="callbacksNextEyebrow">Siguiente callback por score</p>
                    <h3 id="callbacksOpsNext">Sin telefono</h3>
                    <p id="callbacksNextSummary">La siguiente llamada prioritaria aparecera aqui.</p>
                </div>
                <span id="callbacksSelectionChip" class="is-hidden">Seleccionados: <strong id="callbacksSelectedCount">0</strong></span>
            </header>
            <div class="callbacks-next-grid">
                <div class="callbacks-next-stat">
                    <span>Score</span>
                    <strong id="callbacksNextScore">0</strong>
                </div>
                <div class="callbacks-next-stat">
                    <span>Espera</span>
                    <strong id="callbacksNextWait">0 min</strong>
                </div>
                <div class="callbacks-next-stat">
                    <span>Servicio</span>
                    <strong id="callbacksNextPreference">-</strong>
                </div>
                <div class="callbacks-next-stat">
                    <span>Ultimo contacto</span>
                    <strong id="callbacksNextLastContact">Sin contacto</strong>
                </div>
                <div class="callbacks-next-stat">
                    <span>Accion</span>
                    <strong id="callbacksNextState">Pendiente</strong>
                </div>
                <div class="callbacks-next-stat">
                    <span>Estado IA</span>
                    <strong id="callbacksDeckHint">Sin bloqueos</strong>
                </div>
            </div>
        </article>
    `;
}
