import { formatNumber, setHtml, setText } from '../../shared/ui/render.js';
import {
    breakdownList,
    buildAttentionItems,
    buildLiveMeta,
    buildOperations,
    heroSummary,
} from './markup.js';
import { relativeWindow } from './time.js';
import { getDashboardDerivedState } from './state.js';

function setLiveStatus(state) {
    const {
        nextAppointment,
        pendingTransfers,
        todayAppointments,
        urgentCallbacks,
    } = state;

    const liveStatus =
        pendingTransfers > 0 || urgentCallbacks > 0
            ? 'Atencion'
            : todayAppointments > 0
              ? 'Activo'
              : 'Estable';
    const liveTone =
        pendingTransfers > 0 || urgentCallbacks > 0
            ? 'warning'
            : todayAppointments > 0
              ? 'neutral'
              : 'success';

    setText('#dashboardLiveStatus', liveStatus);
    document
        .getElementById('dashboardLiveStatus')
        ?.setAttribute('data-state', liveTone);
    setText(
        '#dashboardLiveMeta',
        buildLiveMeta({
            pendingTransfers,
            urgentCallbacks,
            nextAppointment,
        })
    );
}

function setOverviewMetrics(state) {
    const {
        appointments,
        avgRating,
        nextAppointment,
        noShows,
        pendingCallbacks,
        pendingTransfers,
        recentReviews,
        reviews,
        todayAppointments,
        urgentCallbacks,
    } = state;

    setText('#todayAppointments', todayAppointments);
    setText('#totalAppointments', appointments.length);
    setText('#pendingCallbacks', pendingCallbacks);
    setText('#totalReviewsCount', reviews.length);
    setText('#totalNoShows', noShows);
    setText('#avgRating', avgRating);
    setText('#adminAvgRating', avgRating);

    setText('#dashboardHeroRating', avgRating);
    setText('#dashboardHeroRecentReviews', recentReviews);
    setText('#dashboardHeroUrgentCallbacks', urgentCallbacks);
    setText('#dashboardHeroPendingTransfers', pendingTransfers);
    setText(
        '#dashboardHeroSummary',
        heroSummary({
            pendingTransfers,
            urgentCallbacks,
            noShows,
            nextAppointment,
        })
    );
}

function setFlowMetrics(state) {
    const {
        availabilityDays,
        nextAppointment,
        pendingCallbacks,
        pendingTransfers,
        todayAppointments,
        urgentCallbacks,
    } = state;

    setText(
        '#dashboardQueueHealth',
        urgentCallbacks > 0
            ? 'Cola: SLA comprometido'
            : pendingCallbacks > 0
              ? 'Cola: pendiente por drenar'
              : 'Cola: estable'
    );
    setText(
        '#dashboardFlowStatus',
        nextAppointment?.item
            ? `${relativeWindow(nextAppointment.stamp)} | ${nextAppointment.item.name || 'Paciente'}`
            : availabilityDays > 0
              ? `${availabilityDays} dia(s) con slots publicados`
              : 'Sin citas inmediatas'
    );

    setText('#operationPendingReviewCount', pendingTransfers);
    setText('#operationPendingCallbacksCount', pendingCallbacks);
    setText('#operationTodayLoadCount', todayAppointments);
    setText(
        '#operationDeckMeta',
        pendingTransfers > 0 || urgentCallbacks > 0
            ? 'La prioridad ya esta definida'
            : nextAppointment?.item
              ? 'Siguiente accion lista'
              : 'Operacion sin frentes urgentes'
    );
    setText(
        '#operationQueueHealth',
        nextAppointment?.item
            ? `Siguiente hito: ${nextAppointment.item.name || 'Paciente'} ${relativeWindow(nextAppointment.stamp).toLowerCase()}`
            : 'Sin citas inmediatas en cola'
    );
}

function setFunnelMetrics(funnel) {
    const summary = funnel.summary || {};
    setText('#funnelViewBooking', formatNumber(summary.viewBooking || 0));
    setText('#funnelStartCheckout', formatNumber(summary.startCheckout || 0));
    setText(
        '#funnelBookingConfirmed',
        formatNumber(summary.bookingConfirmed || 0)
    );
    setText(
        '#funnelAbandonRate',
        `${Number(summary.abandonRatePct || 0).toFixed(1)}%`
    );

    setHtml(
        '#funnelEntryList',
        breakdownList(funnel.checkoutEntryBreakdown, 'entry', 'count')
    );
    setHtml(
        '#funnelSourceList',
        breakdownList(funnel.sourceBreakdown, 'source', 'count')
    );
    setHtml(
        '#funnelPaymentMethodList',
        breakdownList(funnel.paymentMethodBreakdown, 'method', 'count')
    );
    setHtml(
        '#funnelAbandonList',
        breakdownList(funnel.checkoutAbandonByStep, 'step', 'count')
    );
    setHtml(
        '#funnelAbandonReasonList',
        breakdownList(funnel.abandonReasonBreakdown, 'reason', 'count')
    );
    setHtml(
        '#funnelStepList',
        breakdownList(funnel.bookingStepBreakdown, 'step', 'count')
    );
    setHtml(
        '#funnelErrorCodeList',
        breakdownList(funnel.errorCodeBreakdown, 'code', 'count')
    );
}

export function renderDashboard(state) {
    const dashboardState = getDashboardDerivedState(state);

    setOverviewMetrics(dashboardState);
    setLiveStatus(dashboardState);
    setFlowMetrics(dashboardState);
    setHtml('#operationActionList', buildOperations(dashboardState));
    setHtml('#dashboardAttentionList', buildAttentionItems(dashboardState));
    setFunnelMetrics(dashboardState.funnel);
}
