export function renderClinicalHistorySection() {
    return `
        <section id="clinical-history" class="admin-section" tabindex="-1">
            <div class="clinical-history-stage">
                <article class="sony-panel clinical-history-summary-panel">
                    <header class="section-header">
                        <div>
                            <h3>Historia clinica defendible</h3>
                            <p id="clinicalHistoryHeaderMeta">
                                Selecciona un caso para revisar la nota viva, el consentimiento y la aptitud legal de cierre.
                            </p>
                        </div>
                        <div class="clinical-history-header-status">
                            <span
                                class="clinical-history-status-chip"
                                id="clinicalHistoryStatusChip"
                                data-tone="neutral"
                            >
                                Sin seleccion
                            </span>
                            <span
                                class="clinical-history-status-meta"
                                id="clinicalHistoryStatusMeta"
                            >
                                Cola clinica lista para lectura medico-legal
                            </span>
                        </div>
                    </header>
                    <div
                        id="clinicalHistorySummaryGrid"
                        class="clinical-history-summary-grid"
                    ></div>
                    <section
                        id="clinicalHistoryLegalReadinessPanel"
                        class="clinical-history-legal-panel"
                    ></section>
                    <section
                        id="clinicalHistoryApprovalConstancy"
                        class="clinical-history-approval-constancy"
                    ></section>
                    <section
                        id="clinicalHistoryRecordsGovernancePanel"
                        class="clinical-history-approval-constancy"
                    ></section>
                    <div
                        id="clinicalHistoryAttachmentStrip"
                        class="clinical-history-attachment-strip"
                    ></div>
                </article>

                <article class="sony-panel clinical-history-side-panel">
                    <header class="section-header">
                        <div>
                            <h3>Cola clinica</h3>
                            <p id="clinicalHistoryQueueMeta">
                                Casos ordenados por aptitud medico-legal y riesgo clinico.
                            </p>
                        </div>
                        <button
                            type="button"
                            id="clinicalHistoryRefreshBtn"
                            data-clinical-review-action="refresh-current"
                        >
                            Refrescar caso
                        </button>
                    </header>
                    <div
                        id="clinicalHistoryQueueFilters"
                        class="clinical-history-filter-row"
                    ></div>
                    <div
                        id="clinicalHistoryQueueList"
                        class="clinical-history-queue-list"
                    ></div>
                </article>
            </div>

            <div
                id="clinicalHistoryWorkspaceTabs"
                class="clinical-history-workspace-tabs"
            ></div>

            <div
                id="clinicalCompareWorkbench"
                class="clinical-compare-workbench"
                hidden
            ></div>

            <div
                id="clinicalMediaFlowWorkbench"
                class="clinical-media-flow-grid"
                hidden
            >
                <article class="sony-panel clinical-media-flow-queue-panel">
                    <header class="section-header">
                        <div>
                            <h3>Cola before/after</h3>
                            <p id="clinicalMediaFlowQueueMeta">
                                Casos con media privada lista para comparacion editorial.
                            </p>
                        </div>
                        <div class="clinical-history-header-status">
                            <span
                                class="clinical-history-status-chip"
                                id="clinicalMediaFlowStatusChip"
                                data-tone="neutral"
                            >
                                Sin caso
                            </span>
                            <span
                                class="clinical-history-status-meta"
                                id="clinicalMediaFlowStatusMeta"
                            >
                                Esperando seleccion
                            </span>
                        </div>
                    </header>
                    <div class="toolbar-row clinical-media-flow-toolbar">
                        <button
                            type="button"
                            id="clinicalMediaFlowRefreshBtn"
                            data-media-flow-action="refresh"
                        >
                            Refrescar caso
                        </button>
                        <button
                            type="button"
                            id="clinicalMediaFlowGenerateBtn"
                            data-media-flow-action="generate-proposal"
                        >
                            Regenerar propuesta
                        </button>
                    </div>
                    <div
                        id="clinicalMediaFlowQueueList"
                        class="clinical-media-flow-queue-list"
                    ></div>
                </article>

                <article class="sony-panel clinical-media-flow-workspace-panel">
                    <header class="section-header">
                        <div>
                            <h3>Comparador clinico</h3>
                            <p id="clinicalMediaFlowCaseMeta">
                                Selecciona un caso para revisar consentimiento, fotos y comparativas before/after.
                            </p>
                        </div>
                    </header>
                    <div
                        id="clinicalMediaFlowConsentStrip"
                        class="clinical-media-flow-consent-strip"
                    ></div>
                    <div
                        id="clinicalMediaFlowAssetGrid"
                        class="clinical-media-flow-asset-grid"
                    ></div>
                    <div
                        id="clinicalMediaFlowAgentSurface"
                        class="clinical-media-flow-agent-surface"
                    ></div>
                    <div
                        id="clinicalMediaFlowProposalForm"
                        class="clinical-media-flow-form"
                    ></div>
                    <div
                        id="clinicalMediaFlowTimeline"
                        class="clinical-media-flow-timeline"
                    ></div>
                </article>
            </div>

            <div
                id="clinicalHistoryWorkbench"
                class="clinical-history-workbench"
            >
                <article class="sony-panel clinical-history-transcript-panel">
                    <header class="section-header">
                        <div>
                            <h3>Cabina clinica IA</h3>
                            <p id="clinicalHistoryTranscriptMeta">
                                La conversacion del episodio activo aparece aqui.
                            </p>
                        </div>
                        <span
                            class="clinical-history-panel-meta"
                            id="clinicalHistoryTranscriptCount"
                        >
                            0 mensajes
                        </span>
                    </header>
                    <div
                        id="clinicalHistoryTranscript"
                        class="clinical-history-transcript"
                    ></div>
                </article>

                <article class="sony-panel clinical-history-draft-panel">
                    <header class="section-header">
                        <div>
                            <h3>Nota viva</h3>
                            <p id="clinicalHistoryDraftSummary">
                                Ajusta anamnesis, plan, consentimiento y documentos antes de aprobar la nota final.
                            </p>
                        </div>
                        <span
                            class="clinical-history-panel-meta"
                            id="clinicalHistoryDraftMeta"
                        >
                            Sin cambios
                        </span>
                    </header>
                    <form
                        id="clinicalHistoryDraftForm"
                        class="clinical-history-form"
                    ></form>
                </article>
            </div>

            <div
                id="clinicalHistoryFooterGrid"
                class="clinical-history-footer-grid"
            >
                <article class="sony-panel soft clinical-history-events-panel">
                    <header class="section-header">
                        <div>
                            <h3>Eventos del episodio</h3>
                            <p id="clinicalHistoryEventsMeta">
                                Alertas clinicas, conciliacion de IA y acciones pendientes.
                            </p>
                        </div>
                    </header>
                    <div
                        id="clinicalHistoryEvents"
                        class="clinical-history-events"
                    ></div>
                </article>

                <article class="sony-panel soft clinical-history-followup-panel">
                    <header class="section-header">
                        <div>
                            <h3>Solicitud clinica</h3>
                            <p id="clinicalHistoryFollowUpMeta">
                                Solicita el dato faltante sin salir del episodio activo.
                            </p>
                        </div>
                    </header>
                    <textarea
                        id="clinicalHistoryFollowUpInput"
                        class="clinical-history-followup-input"
                        rows="4"
                        placeholder="Ej.: Confirma alergias, tiempo de evolucion o factor desencadenante relevante."
                    ></textarea>
                    <div class="toolbar-row clinical-history-actions-row">
                        <button
                            type="button"
                            id="clinicalHistorySendFollowUpBtn"
                            data-clinical-review-action="send-follow-up"
                        >
                            Solicitar dato faltante
                        </button>
                        <button
                            type="button"
                            id="clinicalHistoryReviewRequiredBtn"
                            data-clinical-review-action="mark-review-required"
                        >
                            Mantener bloqueada
                        </button>
                        <button
                            type="submit"
                            id="clinicalHistorySaveBtn"
                            form="clinicalHistoryDraftForm"
                        >
                            Guardar borrador
                        </button>
                        <button
                            type="button"
                            id="clinicalHistoryApproveBtn"
                            data-clinical-review-action="approve-current"
                        >
                            Aprobar nota final
                        </button>
                    </div>
                </article>
            </div>
        </section>
    `;
}
