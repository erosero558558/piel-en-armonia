export function renderDashboardSignalPanel() {
    return `
        <article class="sony-panel dashboard-signal-panel" id="opsQueueLaunchCard">
            <header>
                <div>
                    <h3>Nucleo de consultorio</h3>
                    <small id="operationRefreshSignal">Turnero al frente, OpenClaw y clinica detras</small>
                </div>
                <span class="dashboard-signal-chip" id="dashboardLiveStatus">Estable</span>
            </header>
            <p id="dashboardLiveMeta">
                Prioriza recepcion y consultorio antes de abrir herramientas secundarias.
            </p>
            <div class="dashboard-signal-stack">
                <article class="dashboard-signal-card">
                    <span>Turnero</span>
                    <strong id="opsQueueStatus">Listo para abrir</strong>
                    <small id="opsQueueMeta">Sin cola activa</small>
                </article>
                <article class="dashboard-signal-card">
                    <span>Readiness</span>
                    <strong id="dashboardQueueHealth">Piloto interno en revision</strong>
                    <small id="dashboardFlowStatus">OpenClaw auth e historias clinicas deben quedar listas antes de uso real.</small>
                </article>
            </div>
            <section class="dashboard-journey-panel" aria-labelledby="dashboardJourneyHeadline">
                <header class="dashboard-journey-header">
                    <div>
                        <span>Patient journey</span>
                        <strong id="dashboardJourneyHeadline">Sin pacientes en journey</strong>
                        <small id="dashboardJourneySummary">
                            Owner actual, tiempo en etapa y siguiente accion por paciente apareceran aqui.
                        </small>
                    </div>
                    <span
                        class="dashboard-signal-chip"
                        id="dashboardJourneyStatusChip"
                        data-state="neutral"
                    >
                        Sin casos
                    </span>
                </header>
                <div class="dashboard-journey-board" id="dashboardJourneyBoard">
                    <button
                        type="button"
                        class="dashboard-journey-stage is-active"
                        data-journey-stage-filter="all"
                        aria-pressed="true"
                    >
                        <span>Todo el journey</span>
                        <strong>0</strong>
                        <small>Sin casos activos</small>
                    </button>
                </div>
                <div class="dashboard-journey-toolbar">
                    <strong id="dashboardJourneyFilterLabel">Mostrando el journey completo</strong>
                    <small id="dashboardJourneySlaSummary">
                        Click en una etapa para abrir la lista filtrada y revisar alertas SLA.
                    </small>
                </div>
                <div id="dashboardJourneyTimeline" class="dashboard-journey-list">
                    <article class="dashboard-journey-empty">
                        <strong>Sin pacientes trazados</strong>
                        <small>Cuando Flow OS exponga episodios, el timeline visual aparecera aqui.</small>
                    </article>
                </div>
            </section>
            <button
                type="button"
                id="openOperatorAppBtn"
                class="dashboard-launch-btn"
                data-action="open-operator-app"
            >
                Abrir turnero operador
            </button>
            <ul id="dashboardAttentionList" class="sony-list dashboard-attention-list"></ul>
        </article>
    `;
}
