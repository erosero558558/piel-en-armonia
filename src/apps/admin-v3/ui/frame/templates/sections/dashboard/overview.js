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

            <article class="sony-panel dashboard-card-payments">
                <header>
                    <div>
                        <h3>Transferencias checkout</h3>
                        <small id="dashboardCheckoutReviewMeta">Comprobantes recibidos desde /es/pago/.</small>
                    </div>
                    <span
                        class="dashboard-signal-chip"
                        id="dashboardCheckoutReviewChip"
                        data-state="neutral"
                    >
                        Sin actividad
                    </span>
                </header>
                <div class="sony-panel-stats">
                    <div><span>Pendientes</span><strong id="checkoutReviewPendingCount">0</strong></div>
                    <div><span>Verificados</span><strong id="checkoutReviewVerifiedCount">0</strong></div>
                    <div><span>Aplicados</span><strong id="checkoutReviewAppliedCount">0</strong></div>
                    <div><span>Sin foto</span><strong id="checkoutReviewMissingProofCount">0</strong></div>
                </div>
                <p id="dashboardCheckoutReviewSummary">
                    Cuando un paciente suba su comprobante aqui apareceran los cobros para verificar y aplicar.
                </p>
                <ul id="dashboardCheckoutReviewQueue" class="sony-list dashboard-attention-list"></ul>
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

            <article class="sony-panel dashboard-card-account-state">
                <header>
                    <div>
                        <h3>Estado de cuenta</h3>
                        <small id="dashboardPaymentAccountMeta">Historial agrupado por paciente desde checkout.</small>
                    </div>
                    <span
                        class="dashboard-signal-chip"
                        id="dashboardPaymentAccountChip"
                        data-state="neutral"
                    >
                        Sin deuda
                    </span>
                </header>
                <div class="sony-panel-stats">
                    <div><span>Pacientes</span><strong id="paymentAccountPatientCount">0</strong></div>
                    <div><span>Pendientes</span><strong id="paymentAccountOutstandingCount">0</strong></div>
                    <div><span>Por vencer</span><strong id="paymentAccountDueSoonCount">0</strong></div>
                    <div><span>Vencidos</span><strong id="paymentAccountOverdueCount">0</strong></div>
                </div>
                <p id="dashboardPaymentAccountSummary">
                    Cuando existan cobros en checkout, aqui veras saldos pendientes y proximos vencimientos por paciente.
                </p>
                <ul id="dashboardPaymentAccountList" class="sony-list dashboard-attention-list"></ul>
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

            <article class="sony-panel dashboard-card-conversion" id="funnelSummary">
                <header>
                    <div>
                        <h3>Conversion publica</h3>
                        <small id="dashboardConversionMeta">Visitas al flujo, clicks a WhatsApp y servicios con mejor traccion.</small>
                    </div>
                    <span class="dashboard-signal-chip" id="dashboardConversionChip" data-state="neutral">
                        Sin datos
                    </span>
                </header>
                <p class="dashboard-secondary-summary" id="dashboardConversionSummary">
                    Cuando el funnel publico reciba eventos, aqui veras el ritmo diario y los servicios que mejor convierten.
                </p>
                <div class="sony-panel-stats dashboard-secondary-metrics">
                    <div><span>Reservas</span><strong id="funnelViewBooking">0</strong></div>
                    <div><span>Checkout</span><strong id="funnelStartCheckout">0</strong></div>
                    <div><span>Confirmadas</span><strong id="funnelBookingConfirmed">0</strong></div>
                    <div><span>Abandono</span><strong id="funnelAbandonRate">0%</strong></div>
                </div>
                <div class="sony-panel-stats dashboard-conversion-daily-metrics">
                    <div><span>Visitas hoy</span><strong id="funnelDailyVisitsToday">0</strong></div>
                    <div><span>WhatsApp hoy</span><strong id="funnelDailyWhatsappToday">0</strong></div>
                    <div><span>Visitas/dia</span><strong id="funnelDailyVisitsAvg">0.0</strong></div>
                    <div><span>WhatsApp/dia</span><strong id="funnelDailyWhatsappAvg">0.0</strong></div>
                </div>
                <div class="dashboard-signal-stack dashboard-conversion-signal-stack">
                    <article class="dashboard-signal-card">
                        <span>Servicio lider</span>
                        <strong id="dashboardConversionTopService">Sin ranking</strong>
                        <small id="dashboardConversionTopServiceMeta">
                            Cuando existan vistas y reservas, aqui aparecera el servicio con mejor cierre.
                        </small>
                    </article>
                    <article class="dashboard-signal-card">
                        <span>Ritmo 7d</span>
                        <strong id="dashboardConversionPaceHeadline">0 confirmadas</strong>
                        <small id="dashboardConversionPaceMeta">
                            Aun no hay serie diaria suficiente para resumir el embudo reciente.
                        </small>
                    </article>
                </div>
                <div class="dashboard-conversion-grid">
                    <article class="dashboard-signal-card dashboard-conversion-list-card">
                        <span>Visitas y WhatsApp por dia</span>
                        <ul id="dashboardConversionDailyList" class="sony-list dashboard-attention-list dashboard-conversion-list"></ul>
                    </article>
                    <article class="dashboard-signal-card dashboard-conversion-list-card">
                        <span>Top servicios</span>
                        <ul id="dashboardConversionTopServices" class="sony-list dashboard-attention-list dashboard-conversion-list"></ul>
                    </article>
                </div>
            </article>
        </div>
    `;
}
