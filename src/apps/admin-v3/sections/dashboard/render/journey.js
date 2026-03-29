import {
    escapeHtml,
    formatDateTime,
    qs,
    setHtml,
    setText,
} from '../../../shared/ui/render.js';
import { relativeWindow, toTimestamp } from '../time.js';

function normalizeString(value) {
    return String(value || '').trim();
}

function normalizeList(value) {
    return Array.isArray(value) ? value : [];
}

function normalizeCaseEntry(item) {
    const source = item && typeof item === 'object' ? item : {};
    return {
        caseId: normalizeString(source.caseId),
        patientId: normalizeString(source.patientId),
        patientLabel: normalizeString(source.patientLabel),
        caseStatus: normalizeString(source.caseStatus),
        currentStage: normalizeString(source.currentStage),
        currentStageLabel: normalizeString(source.currentStageLabel),
        owner: normalizeString(source.owner),
        ownerLabel: normalizeString(source.ownerLabel),
        openedAt: normalizeString(source.openedAt),
        latestActivityAt: normalizeString(source.latestActivityAt),
        timelineCount: Number.isFinite(Number(source.timelineCount))
            ? Number(source.timelineCount)
            : 0,
        currentTransitionTitle: normalizeString(source.currentTransitionTitle),
    };
}

function normalizeTransition(item) {
    const source = item && typeof item === 'object' ? item : {};
    return {
        caseId: normalizeString(source.caseId),
        patientId: normalizeString(source.patientId),
        patientLabel: normalizeString(source.patientLabel),
        caseStatus: normalizeString(source.caseStatus),
        stage: normalizeString(source.stage),
        stageLabel: normalizeString(source.stageLabel),
        title: normalizeString(source.title),
        actor: normalizeString(source.actor),
        actorLabel: normalizeString(source.actorLabel),
        occurredAt: normalizeString(source.occurredAt),
        sourceType: normalizeString(source.sourceType),
        sourceTitle: normalizeString(source.sourceTitle),
        meta: normalizeString(source.meta),
    };
}

function normalizeHistory(patientFlowMeta) {
    const source =
        patientFlowMeta?.journeyHistory &&
        typeof patientFlowMeta.journeyHistory === 'object'
            ? patientFlowMeta.journeyHistory
            : {};

    return {
        selectedCaseId: normalizeString(source.selectedCaseId),
        generatedAt: normalizeString(source.generatedAt),
        cases: normalizeList(source.cases).map(normalizeCaseEntry),
        recentTransitions: normalizeList(source.recentTransitions).map(
            normalizeTransition
        ),
    };
}

function resolveFocusCase(history) {
    if (!history.selectedCaseId) {
        return history.cases[0] || null;
    }

    return (
        history.cases.find((item) => item.caseId === history.selectedCaseId) ||
        history.cases[0] ||
        null
    );
}

function resolveChipTone(focusCase, recentTransitions) {
    if (!focusCase || recentTransitions.length === 0) {
        return 'success';
    }

    switch (focusCase.currentStage) {
        case 'lead_captured':
        case 'intake_completed':
            return 'warning';
        case 'resolved':
            return 'success';
        default:
            return 'neutral';
    }
}

function resolveChipLabel(focusCase, recentTransitions) {
    if (!focusCase || recentTransitions.length === 0) {
        return 'Sin actividad';
    }

    return `${recentTransitions.length} cambio(s)`;
}

function buildSummary(history, focusCase) {
    if (!focusCase || history.recentTransitions.length === 0) {
        return 'Cuando existan cambios de stage, Flow OS resumira aqui el historial reciente por paciente.';
    }

    const caseCount = history.cases.length;
    const currentLabel = focusCase.currentStageLabel || 'Etapa activa';
    return `${history.recentTransitions.length} transicion(es) recientes en ${caseCount} caso(s). Caso foco en ${currentLabel.toLowerCase()}.`;
}

function buildHistoryMeta(history, focusCase) {
    if (history.generatedAt) {
        return `Actualizado ${formatDateTime(history.generatedAt)}`;
    }

    if (focusCase?.latestActivityAt) {
        return `Ultima actividad ${formatDateTime(focusCase.latestActivityAt)}`;
    }

    return 'Transiciones recientes del patient journey.';
}

function buildFocusMeta(focusCase) {
    if (!focusCase) {
        return 'El caso con actividad mas reciente aparecera aqui.';
    }

    const activityAt = focusCase.latestActivityAt || focusCase.openedAt;
    if (!activityAt) {
        return `${focusCase.timelineCount} transicion(es) trazadas.`;
    }

    return `${focusCase.timelineCount} transicion(es) trazadas • ${formatDateTime(activityAt)}`;
}

function buildStageMeta(focusCase) {
    if (!focusCase) {
        return 'El owner y la ultima transicion del caso foco se veran aqui.';
    }

    const parts = [];
    if (focusCase.ownerLabel) {
        parts.push(focusCase.ownerLabel);
    }
    if (focusCase.currentTransitionTitle) {
        parts.push(focusCase.currentTransitionTitle);
    }
    if (focusCase.caseStatus) {
        parts.push(`Status ${focusCase.caseStatus}`);
    }

    return parts.join(' • ') || 'Sin detalle adicional.';
}

function resolveTransitionTone(stage) {
    switch (stage) {
        case 'lead_captured':
        case 'intake_completed':
            return 'warning';
        case 'resolved':
            return 'success';
        default:
            return 'neutral';
    }
}

function buildTransitionMeta(item) {
    const parts = [];
    if (item.title && item.title !== item.stageLabel) {
        parts.push(item.title);
    } else if (item.sourceTitle && item.sourceTitle !== item.stageLabel) {
        parts.push(item.sourceTitle);
    }

    if (item.occurredAt) {
        parts.push(relativeWindow(toTimestamp(item.occurredAt)));
    }

    if (item.actorLabel) {
        parts.push(item.actorLabel);
    }

    if (item.meta) {
        parts.push(item.meta);
    }

    return parts.filter(Boolean).join(' • ');
}

function buildTransitionItems(history) {
    if (history.recentTransitions.length === 0) {
        return `
            <li class="dashboard-attention-item dashboard-journey-item" data-tone="neutral">
                <div class="dashboard-journey-item-copy">
                    <span>Sin transiciones recientes</span>
                    <small>Los cambios de stage por paciente apareceran aqui cuando Flow OS los detecte.</small>
                </div>
                <strong class="dashboard-journey-item-stamp">--</strong>
            </li>
        `;
    }

    return history.recentTransitions
        .slice(0, 6)
        .map((item) => {
            const patientLabel = item.patientLabel || item.patientId || 'Paciente';
            const stageLabel = item.stageLabel || item.stage || 'Sin etapa';
            const occurredAt = item.occurredAt
                ? formatDateTime(item.occurredAt)
                : '--';
            return `
                <li class="dashboard-attention-item dashboard-journey-item" data-tone="${escapeHtml(
                    resolveTransitionTone(item.stage)
                )}">
                    <div class="dashboard-journey-item-copy">
                        <span>${escapeHtml(`${patientLabel} -> ${stageLabel}`)}</span>
                        <small>${escapeHtml(buildTransitionMeta(item) || 'Sin detalle adicional.')}</small>
                    </div>
                    <strong class="dashboard-journey-item-stamp">${escapeHtml(
                        occurredAt
                    )}</strong>
                </li>
            `;
        })
        .join('');
}

export function setJourneyHistory(state) {
    const history = normalizeHistory(state.patientFlowMeta);
    const focusCase = resolveFocusCase(history);
    const chip = qs('#dashboardJourneyHistoryChip');

    setText('#dashboardJourneyHistoryMeta', buildHistoryMeta(history, focusCase));
    setText('#dashboardJourneyHistorySummary', buildSummary(history, focusCase));
    setText(
        '#dashboardJourneyFocusHeadline',
        focusCase ? focusCase.patientLabel || 'Caso con actividad' : 'Sin casos activos'
    );
    setText('#dashboardJourneyFocusMeta', buildFocusMeta(focusCase));
    setText(
        '#dashboardJourneyStageHeadline',
        focusCase ? focusCase.currentStageLabel || 'Sin etapa' : 'Sin etapa'
    );
    setText('#dashboardJourneyStageMeta', buildStageMeta(focusCase));
    setHtml('#dashboardJourneyTimeline', buildTransitionItems(history));

    if (chip) {
        chip.textContent = resolveChipLabel(focusCase, history.recentTransitions);
        chip.setAttribute(
            'data-state',
            resolveChipTone(focusCase, history.recentTransitions)
        );
    }
}
