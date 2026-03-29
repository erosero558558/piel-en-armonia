export function renderDashboardOperationsGrid() {
    return `
        <div class="sony-grid sony-grid-three dashboard-operations-grid">
            <article class="sony-panel dashboard-card-operations">
                <header>
                    <h3>Siguientes pasos</h3>
                    <small id="operationDeckMeta">Atajos utiles para el dia</small>
                </header>
                <div class="sony-panel-stats">
                    <div><span>Transferencias</span><strong id="operationPendingReviewCount">0</strong></div>
                    <div><span>Llamadas</span><strong id="operationPendingCallbacksCount">0</strong></div>
                    <div><span>Hoy</span><strong id="operationTodayLoadCount">0</strong></div>
                </div>
                <p id="operationQueueHealth">Sin pendientes urgentes.</p>
                <div id="operationActionList" class="operations-action-list"></div>
            </article>

            <article class="sony-panel dashboard-card-journey">
                <header>
                    <div>
                        <h3>Timeline Flow OS</h3>
                        <small id="dashboardJourneyHistoryMeta">Transiciones recientes del patient journey.</small>
                    </div>
                    <span
                        class="dashboard-signal-chip"
                        id="dashboardJourneyHistoryChip"
                        data-state="neutral"
                    >
                        Sin actividad
                    </span>
                </header>
                <p id="dashboardJourneyHistorySummary">
                    Cuando existan cambios de stage, Flow OS resumira aqui el historial reciente por paciente.
                </p>
                <div class="dashboard-signal-stack">
                    <article class="dashboard-signal-card">
                        <span>Caso foco</span>
                        <strong id="dashboardJourneyFocusHeadline">Sin casos activos</strong>
                        <small id="dashboardJourneyFocusMeta">
                            El caso con actividad mas reciente aparecera aqui.
                        </small>
                    </article>
                    <article class="dashboard-signal-card">
                        <span>Etapa actual</span>
                        <strong id="dashboardJourneyStageHeadline">Sin etapa</strong>
                        <small id="dashboardJourneyStageMeta">
                            El owner y la ultima transicion del caso foco se veran aqui.
                        </small>
                    </article>
                </div>
                <ul
                    id="dashboardJourneyTimeline"
                    class="sony-list dashboard-attention-list dashboard-journey-list"
                ></ul>
            </article>

            <article class="sony-panel dashboard-card-assistant" id="dashboardAssistantUtility">
                <header>
                    <div>
                        <h3>Utilidad del asistente</h3>
                        <small id="dashboardAssistantMeta">Recepcionista ejecutora en sala</small>
                    </div>
                    <span class="dashboard-signal-chip" id="dashboardAssistantStatus" data-state="neutral">Sin uso</span>
                </header>
                <div class="sony-panel-stats">
                    <div><span>Acciones hoy</span><strong id="dashboardAssistantActioned">0</strong></div>
                    <div><span>Resueltas</span><strong id="dashboardAssistantResolved">0</strong></div>
                    <div><span>Escaladas</span><strong id="dashboardAssistantEscalated">0</strong></div>
                    <div><span>Bloqueos</span><strong id="dashboardAssistantBlocked">0</strong></div>
                </div>
                <p id="dashboardAssistantSummary">Sin actividad del asistente todavia.</p>
                <div class="dashboard-assistant-meta">
                    <p id="dashboardAssistantWindowMeta">7d: 0 sesiones utiles | 0 ms promedio</p>
                    <p id="dashboardAssistantTopIntent">Intent principal: sin datos</p>
                    <p id="dashboardAssistantTopReason">Motivo de apoyo: sin datos</p>
                    <p id="dashboardAssistantTopOutcome">Cierre asistido: sin datos</p>
                </div>
                <div class="dashboard-assistant-chart-grid">
                    <article class="dashboard-signal-card dashboard-assistant-chart-card">
                        <span>Espera real</span>
                        <strong>Promedio de hoy</strong>
                        <small>Tiempo real de espera por turno cerrado en clínica.</small>
                        <canvas id="waitTimeChart" width="320" height="180"></canvas>
                    </article>
                    <article class="dashboard-signal-card dashboard-assistant-chart-card">
                        <span>Throughput</span>
                        <strong>Cierres por hora</strong>
                        <small>Turnos completados por bloque horario durante el día.</small>
                        <canvas id="throughputChart" width="320" height="180"></canvas>
                    </article>
                </div>
            </article>

            <article class="sony-panel dashboard-card-clinical">
                <header>
                    <div>
                        <h3>Frente clinico</h3>
                        <small id="dashboardClinicalHistoryMeta">Snapshot clinico operativo del consultorio.</small>
                    </div>
                    <span
                        class="dashboard-signal-chip"
                        id="dashboardClinicalHistoryChip"
                        data-state="neutral"
                    >
                        Pendiente
                    </span>
                </header>
                <div class="sony-panel-stats">
                    <div><span>Sesiones</span><strong id="clinicalHistorySessionCount">0</strong></div>
                    <div><span>Revision</span><strong id="clinicalHistoryReviewCount">0</strong></div>
                    <div><span>IA pendiente</span><strong id="clinicalHistoryPendingAiCount">0</strong></div>
                    <div><span>Eventos</span><strong id="clinicalHistoryEventCount">0</strong></div>
                </div>
                <p id="dashboardClinicalHistorySummary">
                    La cabina de historia clinica defendible aparecera aqui cuando existan episodios, bloqueos legales o eventos clinicos en el flujo interno.
                </p>
                <div id="dashboardClinicalHistoryActions" class="operations-action-list"></div>
                <div class="dashboard-signal-stack">
                    <article class="dashboard-signal-card">
                        <span>Cola clinica</span>
                        <strong id="clinicalHistoryQueueHeadline">Sin casos pendientes</strong>
                        <small id="clinicalHistoryQueueMeta">
                            Cuando existan episodios en revision medico-legal apareceran aqui.
                        </small>
                    </article>
                    <article class="dashboard-signal-card">
                        <span>Ultimo evento</span>
                        <strong id="clinicalHistoryEventHeadline">Sin actividad reciente</strong>
                        <small id="clinicalHistoryEventMeta">
                            El feed operativo resumira conciliaciones y alertas del consultorio.
                        </small>
                    </article>
                </div>
                <ul id="dashboardClinicalReviewQueue" class="sony-list dashboard-attention-list"></ul>
                <ul id="dashboardClinicalEventFeed" class="sony-list dashboard-attention-list"></ul>
            </article>

            <article class="sony-panel" id="funnelSummary">
                <header>
                    <h3>Herramientas secundarias</h3>
                    <small>Atajos de apoyo sin salir del shell RC1</small>
                </header>
                <p class="dashboard-secondary-summary">
                    Este corte prioriza el shell diario del consultorio: historia clinica, agenda y horarios siguen a un click sin abrir superficies laterales.
                </p>
                <div class="dashboard-secondary-links">
                    <a href="#clinical-history" class="dashboard-secondary-link" data-section="clinical-history">Abrir historia clinica</a>
                    <a href="#availability" class="dashboard-secondary-link" data-section="availability">Abrir horarios</a>
                </div>
                <div class="sony-panel-stats dashboard-secondary-metrics">
                    <div><span>Reservas</span><strong id="funnelViewBooking">0</strong></div>
                    <div><span>Checkout</span><strong id="funnelStartCheckout">0</strong></div>
                    <div><span>Confirmadas</span><strong id="funnelBookingConfirmed">0</strong></div>
                    <div><span>Abandono</span><strong id="funnelAbandonRate">0%</strong></div>
                </div>
            </article>
        </div>
    `;
}
