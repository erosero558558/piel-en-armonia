import { setText } from '../../../shared/ui/render.js';
import { relativeWindow } from '../time.js';

function normalizeJourneyPreview(patientFlowMeta) {
    return patientFlowMeta && typeof patientFlowMeta.journeyPreview === 'object'
        ? patientFlowMeta.journeyPreview
        : null;
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

export function setFlowMetrics(state) {
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
}
