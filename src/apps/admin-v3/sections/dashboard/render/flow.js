import {
    escapeHtml,
    qs,
    setHtml,
    setText,
} from '../../../shared/ui/render.js';
import { relativeWindow } from '../time.js';

const FALLBACK_JOURNEY_STAGES = [
    {
        id: 'lead_captured',
        displayId: 'lead_captured',
        displayLabel: 'Lead',
    },
    {
        id: 'intake_completed',
        displayId: 'intake',
        displayLabel: 'Intake',
    },
    {
        id: 'scheduled',
        displayId: 'scheduled',
        displayLabel: 'Agendada',
    },
    {
        id: 'care_plan_ready',
        displayId: 'care_plan',
        displayLabel: 'Plan',
    },
    {
        id: 'follow_up_active',
        displayId: 'follow_up',
        displayLabel: 'Seguimiento',
    },
    {
        id: 'resolved',
        displayId: 'resolved',
        displayLabel: 'Resuelto',
    },
];

const JOURNEY_STAGE_SLA_MS = Object.freeze({
    lead_captured: 2 * 60 * 60 * 1000,
    follow_up: 72 * 60 * 60 * 1000,
});

let activeJourneyStageFilter = 'all';
let lastJourneyPreview = null;

function normalizeJourneyPreview(patientFlowMeta) {
    return patientFlowMeta && typeof patientFlowMeta.journeyPreview === 'object'
        ? patientFlowMeta.journeyPreview
        : null;
}

function normalizeJourneyCases(journeyPreview) {
    return Array.isArray(journeyPreview?.cases) ? journeyPreview.cases : [];
}

function normalizeJourneyStages(journeyPreview) {
    return Array.isArray(journeyPreview?.timelineStages) &&
        journeyPreview.timelineStages.length > 0
        ? journeyPreview.timelineStages
        : FALLBACK_JOURNEY_STAGES;
}

function normalizeJourneyStageId(stage) {
    return String(stage?.displayId || stage?.id || '').trim();
}

function journeyHeadline(journeyPreview) {
    if (!journeyPreview) {
        return '';
    }

    const label = String(
        journeyPreview.label || journeyPreview.stage || 'Journey sin etapa'
    ).trim();
    const nextAction = Array.isArray(journeyPreview.nextActions)
        ? journeyPreview.nextActions.find((item) => item && item.label)
        : null;
    if (!nextAction) {
        return label;
    }

    return `${label} | ${nextAction.label}`;
}

function journeyMeta(journeyPreview) {
    if (!journeyPreview) {
        return '';
    }

    const owner = String(
        journeyPreview.ownerLabel || journeyPreview.owner || 'Equipo operativo'
    ).trim();
    const alerts = Array.isArray(journeyPreview.alerts)
        ? journeyPreview.alerts.filter(Boolean)
        : [];
    if (alerts.length > 0) {
        return `${owner} | ${alerts[0]}`;
    }

    const delegationCount = Array.isArray(journeyPreview.delegationPlan)
        ? journeyPreview.delegationPlan.length
        : 0;
    return delegationCount > 0
        ? `${owner} | ${delegationCount} worker(s) sugeridos`
        : owner;
}

function uniqueJourneyAlerts(values) {
    const seen = new Set();
    return values.filter((value) => {
        const normalized = String(value || '').trim();
        if (!normalized || seen.has(normalized)) {
            return false;
        }

        seen.add(normalized);
        return true;
    });
}

function resolveTimeInStageMs(item) {
    const direct = Number(item?.timeInStageMs || 0);
    if (Number.isFinite(direct) && direct > 0) {
        return direct;
    }

    const enteredAt = String(item?.enteredAt || '').trim();
    const enteredAtMs = Date.parse(enteredAt);
    if (Number.isNaN(enteredAtMs)) {
        return 0;
    }

    return Math.max(0, Date.now() - enteredAtMs);
}

function formatDurationMs(value) {
    const ms = Number(value || 0);
    if (!Number.isFinite(ms) || ms <= 0) {
        return 'menos de 1 min';
    }

    const minutes = Math.max(1, Math.round(ms / 60000));
    if (minutes < 60) {
        return `${minutes} min`;
    }

    const hours = Math.round(minutes / 60);
    if (hours < 48) {
        return `${hours} h`;
    }

    return `${Math.round(hours / 24)} d`;
}

function stageSlaAlerts(item) {
    const stageId = String(item?.displayStage || item?.stage || '').trim();
    const timeInStageMs = resolveTimeInStageMs(item);
    const alerts = [];

    if (
        stageId === 'lead_captured' &&
        timeInStageMs > JOURNEY_STAGE_SLA_MS.lead_captured
    ) {
        alerts.push('Lead sin respuesta > 2 h');
    }

    if (
        stageId === 'follow_up' &&
        timeInStageMs > JOURNEY_STAGE_SLA_MS.follow_up
    ) {
        alerts.push('Follow-up vencido');
    }

    return alerts;
}

function journeyAlerts(item) {
    const baseAlerts = Array.isArray(item?.alerts)
        ? item.alerts
              .map((alert) => String(alert || '').trim())
              .filter(Boolean)
        : [];
    return uniqueJourneyAlerts([...baseAlerts, ...stageSlaAlerts(item)]);
}

function journeyStageLabel(journeyPreview, stageId) {
    const normalizedStageId = String(stageId || '').trim();
    const match = normalizeJourneyStages(journeyPreview).find((stage) => {
        return normalizeJourneyStageId(stage) === normalizedStageId;
    });

    return String(
        match?.displayLabel || match?.label || match?.displayId || normalizedStageId
    ).trim();
}

function normalizeJourneyFilter(journeyPreview) {
    const availableStageIds = new Set(
        normalizeJourneyStages(journeyPreview)
            .map((stage) => normalizeJourneyStageId(stage))
            .filter(Boolean)
    );

    if (
        activeJourneyStageFilter !== 'all' &&
        !availableStageIds.has(activeJourneyStageFilter)
    ) {
        activeJourneyStageFilter = 'all';
    }

    return activeJourneyStageFilter;
}

function filteredJourneyCases(journeyPreview) {
    const journeyCases = normalizeJourneyCases(journeyPreview);
    const activeFilter = normalizeJourneyFilter(journeyPreview);

    if (activeFilter === 'all') {
        return journeyCases;
    }

    return journeyCases.filter((item) => {
        return String(item?.displayStage || item?.stage || '').trim() === activeFilter;
    });
}

function journeyAlertCasesCount(items) {
    return items.reduce((count, item) => {
        return count + (journeyAlerts(item).length > 0 ? 1 : 0);
    }, 0);
}

function journeyStageTone(item) {
    const stageId = String(item?.displayStage || item?.stage || '').trim();
    const alertCount = journeyAlerts(item).length;
    if (alertCount > 0) {
        return 'warning';
    }

    if (stageId === 'resolved') {
        return 'success';
    }

    return stageId === 'lead_captured' || stageId === 'intake'
        ? 'warning'
        : 'neutral';
}

function buildJourneyTrack(item, stages) {
    const currentStageId = String(item?.displayStage || item?.stage || '').trim();
    const currentIndex = stages.findIndex((stage) => {
        const displayId = String(stage?.displayId || stage?.id || '').trim();
        return displayId === currentStageId;
    });

    return `
        <div class="dashboard-journey-track" aria-label="Timeline del paciente">
            ${stages
                .map((stage, index) => {
                    const stageLabel = String(
                        stage?.displayLabel || stage?.label || stage?.displayId || ''
                    ).trim();
                    let stateClass = 'is-upcoming';
                    let stateTone = 'neutral';
                    if (currentIndex >= 0 && index < currentIndex) {
                        stateClass = 'is-complete';
                        stateTone = 'success';
                    } else if (index === currentIndex) {
                        stateClass = 'is-active';
                        stateTone = journeyStageTone(item);
                    }

                    return `
                        <span class="dashboard-journey-node ${stateClass}" data-state="${escapeHtml(
                            stateTone
                        )}">
                            <span>${escapeHtml(stageLabel)}</span>
                        </span>
                    `;
                })
                .join('')}
        </div>
    `;
}

function buildJourneyAlerts(item) {
    const alerts = journeyAlerts(item);

    if (alerts.length === 0) {
        return '';
    }

    return `
        <div class="dashboard-journey-alerts">
            ${alerts
                .map(
                    (alert) => `
                        <span class="dashboard-signal-chip" data-state="warning">${escapeHtml(
                            alert
                        )}</span>
                    `
                )
                .join('')}
        </div>
    `;
}

function buildJourneyBoard(journeyPreview) {
    if (journeyPreview?.redacted === true) {
        return `
            <article class="dashboard-journey-stage is-protected">
                <span>Journey protegido</span>
                <strong>0</strong>
                <small>Habilita almacenamiento cifrado para abrir el kanban.</small>
            </article>
        `;
    }

    const journeyCases = normalizeJourneyCases(journeyPreview);
    const stages = normalizeJourneyStages(journeyPreview);
    const activeFilter = normalizeJourneyFilter(journeyPreview);
    const activeCases = journeyCases.filter((item) => {
        return String(item?.displayStage || item?.stage || '').trim() !== 'resolved';
    });
    const allAlertCases = journeyAlertCasesCount(journeyCases);

    const items = [
        {
            id: 'all',
            label: 'Todo el journey',
            count: journeyCases.length,
            meta:
                activeCases.length > 0
                    ? `${activeCases.length} activo(s) | ${allAlertCases} alerta(s)`
                    : 'Sin casos activos',
        },
        ...stages.map((stage) => {
            const stageId = normalizeJourneyStageId(stage);
            const stageCases = journeyCases.filter((item) => {
                return String(item?.displayStage || item?.stage || '').trim() === stageId;
            });
            const stageAlertCases = journeyAlertCasesCount(stageCases);

            return {
                id: stageId,
                label: journeyStageLabel(journeyPreview, stageId),
                count: stageCases.length,
                meta:
                    stageAlertCases > 0
                        ? `${stageAlertCases} alerta(s) SLA`
                        : stageCases.length > 0
                          ? `${stageCases.length} paciente(s)`
                          : 'Sin pacientes',
                warning: stageAlertCases > 0,
            };
        }),
    ];

    return items
        .map((item) => {
            const isActive = item.id === activeFilter;
            const classNames = ['dashboard-journey-stage'];
            if (isActive) {
                classNames.push('is-active');
            }
            if (item.warning) {
                classNames.push('is-warning');
            }

            return `
                <button
                    type="button"
                    class="${escapeHtml(classNames.join(' '))}"
                    data-journey-stage-filter="${escapeHtml(item.id)}"
                    aria-pressed="${isActive ? 'true' : 'false'}"
                >
                    <span>${escapeHtml(item.label)}</span>
                    <strong>${escapeHtml(String(item.count))}</strong>
                    <small>${escapeHtml(item.meta)}</small>
                </button>
            `;
        })
        .join('');
}

function buildJourneyList(journeyPreview) {
    const journeyCases = filteredJourneyCases(journeyPreview);
    const stages = normalizeJourneyStages(journeyPreview);
    const activeFilter = normalizeJourneyFilter(journeyPreview);

    if (journeyPreview?.redacted === true) {
        return `
            <article class="dashboard-journey-empty is-protected">
                <strong>Journey protegido por gate clinico</strong>
                <small>Activa almacenamiento cifrado para ver owners, tiempos y pacientes por etapa.</small>
            </article>
        `;
    }

    if (journeyCases.length === 0) {
        const filterLabel =
            activeFilter === 'all'
                ? 'el journey'
                : `la etapa ${journeyStageLabel(journeyPreview, activeFilter).toLowerCase()}`;
        return `
            <article class="dashboard-journey-empty">
                <strong>Sin pacientes en ${escapeHtml(filterLabel)}</strong>
                <small>Click en otra etapa para revisar el resto del kanban.</small>
            </article>
        `;
    }

    return journeyCases
        .map((item) => {
            const patientLabel = String(
                item?.patientLabel || item?.patientId || 'Paciente sin etiqueta'
            ).trim();
            const stageLabel = String(
                item?.stageLabel ||
                    item?.displayStageLabel ||
                    item?.displayStage ||
                    item?.stage ||
                    'Journey'
            ).trim();
            const ownerLabel = String(
                item?.ownerLabel || item?.owner || 'Equipo operativo'
            ).trim();
            const serviceMeta = [
                String(item?.serviceLine || '').trim(),
                String(item?.providerName || '').trim(),
            ].filter(Boolean);
            const nextAction = String(item?.nextActionLabel || '').trim();
            const timeInStageLabel = formatDurationMs(resolveTimeInStageMs(item));

            return `
                <article class="dashboard-journey-item" data-stage="${escapeHtml(
                    String(item?.displayStage || item?.stage || '').trim()
                )}">
                    <div class="dashboard-journey-item__head">
                        <div class="dashboard-journey-item__identity">
                            <strong>${escapeHtml(patientLabel)}</strong>
                            <small>${escapeHtml(
                                serviceMeta.join(' | ') || 'Sin servicio asignado'
                            )}</small>
                        </div>
                        <span class="dashboard-signal-chip" data-state="${escapeHtml(
                            journeyStageTone(item)
                        )}">
                            ${escapeHtml(stageLabel)}
                        </span>
                    </div>
                    <div class="dashboard-journey-item__meta">
                        <span>${escapeHtml(`Owner: ${ownerLabel}`)}</span>
                        <span>${escapeHtml(`Lleva ${timeInStageLabel}`)}</span>
                        ${
                            nextAction
                                ? `<span>${escapeHtml(`Siguiente: ${nextAction}`)}</span>`
                                : ''
                        }
                    </div>
                    ${buildJourneyTrack(item, stages)}
                    ${buildJourneyAlerts(item)}
                </article>
            `;
        })
        .join('');
}

function stageCountsSummary(journeyPreview) {
    const source =
        journeyPreview?.stageCounts && typeof journeyPreview.stageCounts === 'object'
            ? journeyPreview.stageCounts
            : {};
    const labelMap = Object.fromEntries(
        normalizeJourneyStages(journeyPreview).map((stage) => [
            String(stage?.displayId || stage?.id || '').trim(),
            String(stage?.displayLabel || stage?.label || stage?.displayId || '')
                .trim()
                .toLowerCase(),
        ])
    );

    return Object.entries(source)
        .filter(([, count]) => Number(count || 0) > 0)
        .slice(0, 3)
        .map(
            ([stageId, count]) =>
                `${Math.max(0, Number(count || 0))} ${
                    labelMap[stageId] || String(stageId || '').replaceAll('_', ' ')
                }`
        )
        .join(' | ');
}

function setJourneyPanel(journeyPreview) {
    lastJourneyPreview = journeyPreview;
    const chip = qs('#dashboardJourneyStatusChip');
    const journeyCases = normalizeJourneyCases(journeyPreview);
    const visibleJourneyCases = filteredJourneyCases(journeyPreview);
    const hasAlerts = journeyCases.some(
        (item) => journeyAlerts(item).length > 0
    );
    const resolvedCount = journeyCases.filter(
        (item) => String(item?.displayStage || item?.stage || '').trim() === 'resolved'
    ).length;
    const activeCount = Math.max(0, journeyCases.length - resolvedCount);
    const activeFilter = normalizeJourneyFilter(journeyPreview);
    const visibleAlerts = journeyAlertCasesCount(visibleJourneyCases);

    let headline = 'Sin pacientes en journey';
    let summary =
        'Owner actual, tiempo en etapa y siguiente accion por paciente apareceran aqui.';
    let chipText = 'Sin casos';
    let chipState = 'neutral';
    let filterLabel = 'Mostrando el journey completo';
    let slaSummary =
        'Click en una etapa para abrir la lista filtrada y revisar alertas SLA.';

    if (journeyPreview?.redacted === true) {
        activeJourneyStageFilter = 'all';
        headline = 'Journey protegido por gate clinico';
        summary =
            'El timeline nominal queda oculto hasta habilitar almacenamiento cifrado.';
        chipText = 'Protegido';
        chipState = 'warning';
        filterLabel = 'Kanban protegido por gate clinico';
        slaSummary =
            'El tablero de etapas se activa cuando el almacenamiento clinico ya esta listo.';
    } else if (journeyCases.length > 0) {
        headline = `${journeyCases.length} paciente(s) en journey`;
        const countsSummary = stageCountsSummary(journeyPreview);
        summary = countsSummary
            ? `${activeCount} activo(s) | ${countsSummary}`
            : `${activeCount} activo(s) en seguimiento operativo.`;
        chipText = hasAlerts
            ? 'Con alertas'
            : activeCount > 0
              ? 'Operativo'
              : 'Resuelto';
        chipState = hasAlerts
            ? 'warning'
            : activeCount > 0
              ? 'neutral'
              : 'success';

        filterLabel =
            activeFilter === 'all'
                ? `Mostrando ${visibleJourneyCases.length} caso(s) del journey`
                : `Mostrando ${journeyStageLabel(
                      journeyPreview,
                      activeFilter
                  )} | ${visibleJourneyCases.length} caso(s)`;
        slaSummary =
            visibleAlerts > 0
                ? `${visibleAlerts} caso(s) con alerta SLA o seguimiento vencido en la vista actual.`
                : 'Sin alertas SLA en la vista actual.';
    }

    setText('#dashboardJourneyHeadline', headline);
    setText('#dashboardJourneySummary', summary);
    setHtml('#dashboardJourneyBoard', buildJourneyBoard(journeyPreview));
    setText('#dashboardJourneyFilterLabel', filterLabel);
    setText('#dashboardJourneySlaSummary', slaSummary);
    setHtml('#dashboardJourneyTimeline', buildJourneyList(journeyPreview));
    if (chip) {
        chip.textContent = chipText;
        chip.dataset.state = chipState;
    }
}

function bindJourneyBoard() {
    const board = qs('#dashboardJourneyBoard');
    if (!(board instanceof HTMLElement) || board.dataset.bound === 'true') {
        return;
    }

    board.dataset.bound = 'true';
    board.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
            return;
        }

        const trigger = target.closest('[data-journey-stage-filter]');
        if (!(trigger instanceof HTMLElement)) {
            return;
        }

        const requestedFilter = String(
            trigger.dataset.journeyStageFilter || 'all'
        ).trim();
        if (!requestedFilter) {
            return;
        }

        activeJourneyStageFilter =
            activeJourneyStageFilter === requestedFilter ? 'all' : requestedFilter;
        setJourneyPanel(lastJourneyPreview);
    });
}

export function setFlowMetrics(state) {
    bindJourneyBoard();
    const {
        availabilityDays,
        calledTickets,
        internalConsoleMeta,
        nextAppointment,
        pendingCallbacks,
        pendingTransfers,
        patientFlowMeta,
        telemedicineMeta,
        todayAppointments,
        urgentCallbacks,
        waitingTickets,
    } = state;
    const readinessSummary =
        String(internalConsoleMeta?.overall?.summary || '').trim() ||
        'Piloto interno de consultorio en revision.';
    const readinessBlocked = Boolean(
        internalConsoleMeta?.overall?.ready === false
    );
    const blockerTitles = Array.isArray(internalConsoleMeta?.overall?.blockers)
        ? internalConsoleMeta.overall.blockers
              .map((item) => String(item?.title || '').trim())
              .filter(Boolean)
        : [];
    const blockedClinicalSignals = [];
    const telemedicineReviewQueueCount = Number(
        telemedicineMeta?.summary?.reviewQueueCount || 0
    );
    const patientCasesOpen = Number(patientFlowMeta?.casesOpen || 0);
    const journeyPreview = normalizeJourneyPreview(patientFlowMeta);
    if (telemedicineReviewQueueCount > 0) {
        blockedClinicalSignals.push(
            `${telemedicineReviewQueueCount} intake(s) telemedicina`
        );
    }
    if (patientCasesOpen > 0) {
        blockedClinicalSignals.push(`${patientCasesOpen} caso(s) activos`);
    }

    setText(
        '#dashboardQueueHealth',
        readinessBlocked
            ? blockerTitles[0] || 'Piloto interno bloqueado'
            : waitingTickets > 0 || calledTickets > 0
              ? 'Turnero activo en una app separada'
              : journeyPreview
                ? String(journeyPreview.ownerLabel || 'Flow OS activo')
                : 'Nucleo interno listo para consultorio'
    );
    setText(
        '#dashboardFlowStatus',
        readinessBlocked
            ? blockedClinicalSignals.length > 0
                ? `${readinessSummary} | ${blockedClinicalSignals.join(' | ')}`
                : readinessSummary
            : journeyPreview
              ? journeyHeadline(journeyPreview)
              : nextAppointment?.item
                ? `${relativeWindow(nextAppointment.stamp)} | ${nextAppointment.item.name || 'Paciente'}`
                : availabilityDays > 0
                  ? `${availabilityDays} dia(s) con horarios publicados`
                  : readinessSummary
    );

    setText('#operationPendingReviewCount', pendingTransfers);
    setText('#operationPendingCallbacksCount', pendingCallbacks);
    setText('#operationTodayLoadCount', todayAppointments);
    setText(
        '#operationDeckMeta',
        pendingTransfers > 0 || urgentCallbacks > 0 || pendingCallbacks > 0
            ? 'Estas son las acciones utiles del dia'
            : journeyPreview
              ? journeyMeta(journeyPreview)
              : nextAppointment?.item
                ? 'La siguiente accion ya esta clara'
                : 'Operacion sin frentes urgentes'
    );
    setText(
        '#operationQueueHealth',
        readinessBlocked
            ? readinessSummary
            : pendingTransfers > 0
              ? `${pendingTransfers} pago(s) requieren revision antes de cerrar el dia`
              : journeyPreview
                ? journeyHeadline(journeyPreview)
                : nextAppointment?.item
                ? `Siguiente paciente: ${nextAppointment.item.name || 'Paciente'} ${relativeWindow(nextAppointment.stamp).toLowerCase()}`
                  : 'Sin citas inmediatas en cola'
    );
    setJourneyPanel(journeyPreview);
}
