import { apiRequest } from '../../../shared/core/api-client.js';
import { getState } from '../../../shared/core/store.js';
import { refreshAdminData } from '../../../shared/modules/data.js';
import { runWhatsappOpenclawOpsAction } from '../../../shared/modules/data/remote.js';
import {
    createToast,
    escapeHtml,
    formatDateTime,
    setHtml,
    setText,
} from '../../../shared/ui/render.js';
import { buildAttentionItems, buildOperations } from '../markup.js';
import {
    buildClinicalHistoryActions,
    buildClinicalHistoryEventItems,
    buildClinicalHistoryQueueItems,
    buildWhatsappOpsActions,
    buildWhatsappOpsItems,
} from '../markup/actions.js';
import { getDashboardDerivedState } from '../state.js';
import { setFlowMetrics } from './flow.js';
import { setFunnelMetrics } from './funnel.js';
import { setJourneyHistory } from './journey.js';
import { setLiveStatus } from './live.js';
import { setOverviewMetrics } from './overview.js';
import { renderDashboardCharts } from './charts.js';

let whatsappOpsActionBusy = false;
let checkoutReviewActionBusy = false;

function normalizeNumber(value) {
    const num = Number(value || 0);
    return Number.isFinite(num) ? Math.max(0, num) : 0;
}

function normalizeList(value) {
    return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
    return String(value || '').trim();
}

function normalizeStringList(value) {
    return normalizeList(value)
        .map((item) => String(item || '').trim())
        .filter(Boolean);
}

function normalizeMap(value) {
    const source = value && typeof value === 'object' ? value : {};
    return Object.fromEntries(
        Object.entries(source).map(([key, entryValue]) => [
            String(key),
            normalizeNumber(entryValue),
        ])
    );
}

function normalizeWhatsappOpenclawOps(rawSnapshot) {
    const snapshot =
        rawSnapshot && typeof rawSnapshot === 'object' ? rawSnapshot : {};
    const available =
        snapshot.available !== undefined
            ? snapshot.available === true
            : Object.keys(snapshot).length > 0;

    return {
        available,
        statusCode: Number(snapshot.statusCode || 0),
        error: String(snapshot.error || '').trim(),
        configured: snapshot.configured === true,
        configuredMode: String(snapshot.configuredMode || 'disabled'),
        bridgeConfigured: snapshot.bridgeConfigured === true,
        bridgeMode: String(
            snapshot.bridgeMode || (available ? 'pending' : 'offline')
        ),
        bridgeStatus:
            snapshot.bridgeStatus && typeof snapshot.bridgeStatus === 'object'
                ? snapshot.bridgeStatus
                : {},
        pendingOutbox: normalizeNumber(snapshot.pendingOutbox),
        activeConversations: normalizeNumber(snapshot.activeConversations),
        aliveHolds: normalizeNumber(snapshot.aliveHolds),
        bookingsClosed: normalizeNumber(snapshot.bookingsClosed),
        paymentsStarted: normalizeNumber(snapshot.paymentsStarted),
        paymentsCompleted: normalizeNumber(snapshot.paymentsCompleted),
        deliveryFailures: normalizeNumber(snapshot.deliveryFailures),
        automationSuccessRate: Number.isFinite(
            Number(snapshot.automationSuccessRate)
        )
            ? Number(snapshot.automationSuccessRate)
            : 0,
        lastInboundAt: String(snapshot.lastInboundAt || ''),
        lastOutboundAt: String(snapshot.lastOutboundAt || ''),
        pendingOutboxItems: normalizeList(snapshot.pendingOutboxItems),
        failedOutboxItems: normalizeList(snapshot.failedOutboxItems),
        activeHolds: normalizeList(snapshot.activeHolds),
        pendingCheckouts: normalizeList(snapshot.pendingCheckouts),
        conversations: normalizeList(snapshot.conversations),
    };
}

function normalizeClinicalHistoryReviewItem(item) {
    const source = item && typeof item === 'object' ? item : {};
    return {
        sessionId: normalizeString(source.sessionId),
        caseId: normalizeString(source.caseId),
        appointmentId: source.appointmentId ?? null,
        surface: normalizeString(source.surface),
        sessionStatus: normalizeString(source.sessionStatus),
        reviewStatus: normalizeString(source.reviewStatus),
        requiresHumanReview: source.requiresHumanReview === true,
        confidence: Number.isFinite(Number(source.confidence))
            ? Number(source.confidence)
            : 0,
        reviewReasons: normalizeStringList(source.reviewReasons),
        missingFields: normalizeStringList(source.missingFields),
        redFlags: normalizeStringList(source.redFlags),
        pendingAiStatus: normalizeString(source.pendingAiStatus),
        pendingAiJobId: normalizeString(source.pendingAiJobId),
        patientName: normalizeString(source.patientName),
        patientEmail: normalizeString(source.patientEmail),
        patientPhone: normalizeString(source.patientPhone),
        attachmentCount: normalizeNumber(source.attachmentCount),
        legalReadinessStatus: normalizeString(source.legalReadinessStatus),
        legalReadinessLabel: normalizeString(source.legalReadinessLabel),
        legalReadinessSummary: normalizeString(source.legalReadinessSummary),
        approvalBlockedReasons: normalizeList(source.approvalBlockedReasons),
        summary: normalizeString(source.summary),
        createdAt: normalizeString(source.createdAt),
        updatedAt: normalizeString(source.updatedAt),
    };
}

function normalizeClinicalHistoryEventItem(item) {
    const source = item && typeof item === 'object' ? item : {};
    return {
        eventId: normalizeString(source.eventId),
        sessionId: normalizeString(source.sessionId),
        caseId: normalizeString(source.caseId),
        appointmentId: source.appointmentId ?? null,
        type: normalizeString(source.type),
        severity: normalizeString(source.severity),
        status: normalizeString(source.status),
        title: normalizeString(source.title),
        message: normalizeString(source.message),
        requiresAction: source.requiresAction === true,
        jobId: normalizeString(source.jobId),
        patientName: normalizeString(source.patientName),
        patientEmail: normalizeString(source.patientEmail),
        patientPhone: normalizeString(source.patientPhone),
        reviewStatus: normalizeString(source.reviewStatus),
        requiresHumanReview: source.requiresHumanReview === true,
        confidence: Number.isFinite(Number(source.confidence))
            ? Number(source.confidence)
            : 0,
        reviewReasons: normalizeStringList(source.reviewReasons),
        createdAt: normalizeString(source.createdAt),
        occurredAt: normalizeString(source.occurredAt),
        acknowledgedAt: normalizeString(source.acknowledgedAt),
        resolvedAt: normalizeString(source.resolvedAt),
    };
}

function normalizeClinicalHistoryMeta(rawSnapshot) {
    const snapshot =
        rawSnapshot && typeof rawSnapshot === 'object' ? rawSnapshot : {};
    const summarySource =
        snapshot.summary && typeof snapshot.summary === 'object'
            ? snapshot.summary
            : {};
    const sessionsSource =
        summarySource.sessions && typeof summarySource.sessions === 'object'
            ? summarySource.sessions
            : {};
    const draftsSource =
        summarySource.drafts && typeof summarySource.drafts === 'object'
            ? summarySource.drafts
            : {};
    const eventsSource =
        summarySource.events && typeof summarySource.events === 'object'
            ? summarySource.events
            : {};
    const diagnosticsSource =
        summarySource.diagnostics &&
        typeof summarySource.diagnostics === 'object'
            ? summarySource.diagnostics
            : snapshot.diagnostics && typeof snapshot.diagnostics === 'object'
              ? snapshot.diagnostics
              : {};
    const diagnosticsSummarySource =
        diagnosticsSource.summary &&
        typeof diagnosticsSource.summary === 'object'
            ? diagnosticsSource.summary
            : {};

    return {
        summary: {
            configured: summarySource.configured === true,
            sessions: {
                total: normalizeNumber(sessionsSource.total),
                byStatus: normalizeMap(sessionsSource.byStatus),
            },
            drafts: {
                total: normalizeNumber(draftsSource.total),
                byReviewStatus: normalizeMap(draftsSource.byReviewStatus),
                pendingAiCount: normalizeNumber(draftsSource.pendingAiCount),
                reviewQueueCount: normalizeNumber(
                    draftsSource.reviewQueueCount
                ),
            },
            events: {
                total: normalizeNumber(eventsSource.total),
                openCount: normalizeNumber(eventsSource.openCount),
                unreadCount: normalizeNumber(eventsSource.unreadCount),
                byStatus: normalizeMap(eventsSource.byStatus),
                bySeverity: normalizeMap(eventsSource.bySeverity),
                openBySeverity: normalizeMap(eventsSource.openBySeverity),
                byType: normalizeMap(eventsSource.byType),
            },
            reviewQueueCount: normalizeNumber(summarySource.reviewQueueCount),
            latestActivityAt: normalizeString(summarySource.latestActivityAt),
            diagnostics: {
                status: normalizeString(diagnosticsSource.status || 'unknown'),
                healthy: diagnosticsSource.healthy === true,
                summary: {
                    critical: normalizeNumber(
                        diagnosticsSummarySource.critical
                    ),
                    warning: normalizeNumber(diagnosticsSummarySource.warning),
                    info: normalizeNumber(diagnosticsSummarySource.info),
                    totalChecks: normalizeNumber(
                        diagnosticsSummarySource.totalChecks
                    ),
                    totalIssues: normalizeNumber(
                        diagnosticsSummarySource.totalIssues
                    ),
                },
            },
        },
        reviewQueue: normalizeList(snapshot.reviewQueue).map(
            normalizeClinicalHistoryReviewItem
        ),
        events: normalizeList(snapshot.events).map(
            normalizeClinicalHistoryEventItem
        ),
        diagnostics: {
            status: normalizeString(diagnosticsSource.status || 'unknown'),
            healthy: diagnosticsSource.healthy === true,
            summary: {
                critical: normalizeNumber(diagnosticsSummarySource.critical),
                warning: normalizeNumber(diagnosticsSummarySource.warning),
                info: normalizeNumber(diagnosticsSummarySource.info),
                totalChecks: normalizeNumber(
                    diagnosticsSummarySource.totalChecks
                ),
                totalIssues: normalizeNumber(
                    diagnosticsSummarySource.totalIssues
                ),
            },
        },
    };
}

function normalizeCheckoutReviewItem(item) {
    const source = item && typeof item === 'object' ? item : {};

    return {
        id: normalizeString(source.id),
        receiptNumber: normalizeString(source.receiptNumber),
        concept: normalizeString(source.concept),
        amountLabel: normalizeString(source.amountLabel),
        paymentStatus: normalizeString(source.paymentStatus),
        paymentStatusLabel: normalizeString(source.paymentStatusLabel),
        payerName: normalizeString(source.payerName),
        payerWhatsapp: normalizeString(source.payerWhatsapp),
        payerEmail: normalizeString(source.payerEmail),
        transferReference: normalizeString(source.transferReference),
        transferProofUrl: normalizeString(source.transferProofUrl),
        transferProofName: normalizeString(source.transferProofName),
        transferProofUploadedAt: normalizeString(source.transferProofUploadedAt),
        transferVerifiedAt: normalizeString(source.transferVerifiedAt),
        transferAppliedAt: normalizeString(source.transferAppliedAt),
        createdAt: normalizeString(source.createdAt),
        updatedAt: normalizeString(source.updatedAt),
        canVerify: source.canVerify === true,
        canApply: source.canApply === true,
    };
}

function normalizeCheckoutReviewMeta(rawSnapshot) {
    const snapshot =
        rawSnapshot && typeof rawSnapshot === 'object' ? rawSnapshot : {};
    const summary =
        snapshot.summary && typeof snapshot.summary === 'object'
            ? snapshot.summary
            : {};

    return {
        summary: {
            pendingCount: normalizeNumber(summary.pendingCount),
            verifiedCount: normalizeNumber(summary.verifiedCount),
            appliedCount: normalizeNumber(summary.appliedCount),
            missingProofCount: normalizeNumber(summary.missingProofCount),
            queueCount: normalizeNumber(summary.queueCount),
        },
        queue: normalizeList(snapshot.queue).map(normalizeCheckoutReviewItem),
    };
}

function resolveCheckoutReviewTone(meta) {
    const summary = meta?.summary || {};
    if (Number(summary.pendingCount || 0) > 0) {
        return 'warning';
    }
    if (Number(summary.verifiedCount || 0) > 0) {
        return 'neutral';
    }
    if (Number(summary.appliedCount || 0) > 0) {
        return 'success';
    }
    return 'neutral';
}

function resolveCheckoutReviewChipLabel(meta) {
    const summary = meta?.summary || {};
    if (Number(summary.pendingCount || 0) > 0) {
        return `${Number(summary.pendingCount || 0)} pendiente(s)`;
    }
    if (Number(summary.verifiedCount || 0) > 0) {
        return `${Number(summary.verifiedCount || 0)} verificado(s)`;
    }
    if (Number(summary.appliedCount || 0) > 0) {
        return `${Number(summary.appliedCount || 0)} aplicado(s)`;
    }
    return 'Sin actividad';
}

function resolveCheckoutReviewSummary(meta) {
    const summary = meta?.summary || {};
    if (Number(summary.pendingCount || 0) > 0) {
        return `Hay ${Number(summary.pendingCount || 0)} transferencia(s) lista(s) para verificar desde el checkout publico.`;
    }
    if (Number(summary.verifiedCount || 0) > 0) {
        return `Hay ${Number(summary.verifiedCount || 0)} transferencia(s) ya verificadas esperando aplicacion administrativa.`;
    }
    if (Number(summary.appliedCount || 0) > 0) {
        return `Las ultimas ${Number(summary.appliedCount || 0)} transferencia(s) ya quedaron aplicadas en el checkout digital.`;
    }
    if (Number(summary.missingProofCount || 0) > 0) {
        return `${Number(summary.missingProofCount || 0)} checkout(s) por transferencia aun no suben foto del comprobante.`;
    }
    return 'Cuando un paciente suba su comprobante aqui apareceran los cobros para verificar y aplicar.';
}

function resolveCheckoutReviewMetaLine(meta) {
    const summary = meta?.summary || {};
    return [
        Number(summary.queueCount || 0) > 0
            ? `${Number(summary.queueCount || 0)} comprobante(s) en seguimiento`
            : '',
        Number(summary.missingProofCount || 0) > 0
            ? `${Number(summary.missingProofCount || 0)} sin foto`
            : '',
    ]
        .filter(Boolean)
        .join(' • ') || 'Comprobantes recibidos desde /es/pago/.';
}

function buildCheckoutReviewItems(meta) {
    const queue = Array.isArray(meta?.queue) ? meta.queue : [];
    if (!queue.length) {
        return `
            <li class="dashboard-attention-item" data-tone="neutral">
                <div class="dashboard-checkout-review__copy">
                    <strong>Sin comprobantes por revisar</strong>
                    <small>Los pagos por transferencia del checkout publico apareceran aqui cuando el paciente suba la foto.</small>
                </div>
            </li>
        `;
    }

    return queue
        .map((item) => {
            const metaLine = [
                item.amountLabel,
                item.transferReference
                    ? `Ref. ${item.transferReference}`
                    : 'Sin referencia',
                item.transferProofUploadedAt
                    ? `Subido ${formatDateTime(item.transferProofUploadedAt)}`
                    : item.transferVerifiedAt
                      ? `Verificado ${formatDateTime(item.transferVerifiedAt)}`
                      : item.transferAppliedAt
                        ? `Aplicado ${formatDateTime(item.transferAppliedAt)}`
                        : '',
            ]
                .filter(Boolean)
                .join(' • ');
            const contactLine = [
                item.payerName || 'Paciente',
                item.payerWhatsapp || item.payerEmail || '',
            ]
                .filter(Boolean)
                .join(' • ');

            return `
                <li class="dashboard-attention-item dashboard-checkout-review__item" data-tone="${escapeHtml(
                    item.canVerify ? 'warning' : item.canApply ? 'neutral' : 'success'
                )}">
                    <div class="dashboard-checkout-review__copy">
                        <strong>${escapeHtml(item.receiptNumber || 'PAY')}</strong>
                        <small>${escapeHtml(item.concept || 'Sin concepto')} • ${escapeHtml(item.paymentStatusLabel || 'Pendiente')}</small>
                        <small>${escapeHtml(metaLine || '-')}</small>
                        <small>${escapeHtml(contactLine || '-')}</small>
                    </div>
                    <div class="dashboard-checkout-review__actions">
                        ${
                            item.transferProofUrl
                                ? `<a href="${escapeHtml(item.transferProofUrl)}" target="_blank" rel="noopener">Ver comprobante</a>`
                                : ''
                        }
                        ${
                            item.canVerify
                                ? `<button type="button" data-checkout-review-action="verify" data-order-id="${escapeHtml(item.id)}">Verificar</button>`
                                : ''
                        }
                        ${
                            item.canApply
                                ? `<button type="button" data-checkout-review-action="apply" data-order-id="${escapeHtml(item.id)}">Aplicar</button>`
                                : ''
                        }
                    </div>
                </li>
            `;
        })
        .join('');
}

function setCheckoutReviewState(meta) {
    const summary = meta?.summary || {};
    const chip = document.getElementById('dashboardCheckoutReviewChip');

    setText('#dashboardCheckoutReviewMeta', resolveCheckoutReviewMetaLine(meta));
    setText('#checkoutReviewPendingCount', Number(summary.pendingCount || 0));
    setText('#checkoutReviewVerifiedCount', Number(summary.verifiedCount || 0));
    setText('#checkoutReviewAppliedCount', Number(summary.appliedCount || 0));
    setText(
        '#checkoutReviewMissingProofCount',
        Number(summary.missingProofCount || 0)
    );
    setText(
        '#dashboardCheckoutReviewSummary',
        resolveCheckoutReviewSummary(meta)
    );
    setHtml('#dashboardCheckoutReviewQueue', buildCheckoutReviewItems(meta));
    setText(
        '#dashboardCheckoutReviewChip',
        resolveCheckoutReviewChipLabel(meta)
    );
    chip?.setAttribute('data-state', resolveCheckoutReviewTone(meta));
}

function buildWhatsappOpsActionPayload(button) {
    const payload = {};
    const mappings = [
        ['id', 'whatsappOpsId'],
        ['holdId', 'whatsappOpsHoldId'],
        ['paymentSessionId', 'whatsappOpsPaymentSessionId'],
        ['conversationId', 'whatsappOpsConversationId'],
        ['reason', 'whatsappOpsReason'],
        ['notify', 'whatsappOpsNotify'],
        ['limit', 'whatsappOpsLimit'],
    ];

    mappings.forEach(([targetKey, datasetKey]) => {
        const value = button.dataset[datasetKey];
        if (value !== undefined && value !== '') {
            payload[targetKey] = value;
        }
    });

    return payload;
}

function buildWhatsappOpsToast(action, result) {
    switch (action) {
        case 'requeue_outbox':
            return 'Outbox reencolado para reintento';
        case 'expire_checkout':
            return 'Checkout expirado y slot liberado';
        case 'release_hold':
            return 'Hold liberado desde el panel';
        case 'sweep_stale':
            return `Sweep completado: ${Number(result?.expiredCount || 0)} checkout(s) y ${Number(result?.expiredHolds || 0)} hold(s)`;
        default:
            return 'Operacion OpenClaw completada';
    }
}

function buildCheckoutReviewToast(action) {
    return action === 'verify'
        ? 'Transferencia verificada en el dashboard.'
        : 'Transferencia aplicada al checkout digital.';
}

async function executeWhatsappOpsAction(button) {
    const action = String(button.dataset.whatsappOpsAction || '').trim();
    if (!action || whatsappOpsActionBusy) {
        return;
    }

    whatsappOpsActionBusy = true;
    if (button instanceof HTMLButtonElement) {
        button.disabled = true;
    }

    try {
        const result = await runWhatsappOpenclawOpsAction(
            action,
            buildWhatsappOpsActionPayload(button)
        );
        await refreshAdminData();
        renderDashboard(getState());
        createToast(buildWhatsappOpsToast(action, result), 'success');
    } catch (error) {
        createToast(
            error?.message || 'No se pudo ejecutar la accion OpenClaw',
            'error'
        );
    } finally {
        whatsappOpsActionBusy = false;
        if (button.isConnected && button instanceof HTMLButtonElement) {
            button.disabled = false;
        }
    }
}

async function executeCheckoutReviewAction(button) {
    const action = String(button.dataset.checkoutReviewAction || '').trim();
    const orderId = String(button.dataset.orderId || '').trim();
    if (!action || !orderId || checkoutReviewActionBusy) {
        return;
    }

    checkoutReviewActionBusy = true;
    if (button instanceof HTMLButtonElement) {
        button.disabled = true;
    }

    try {
        await apiRequest('checkout-orders', {
            method: 'PATCH',
            body: {
                id: orderId,
                action,
            },
        });
        await refreshAdminData();
        renderDashboard(getState());
        createToast(buildCheckoutReviewToast(action), 'success');
    } catch (error) {
        createToast(
            error?.message || 'No se pudo actualizar la transferencia.',
            'error'
        );
    } finally {
        checkoutReviewActionBusy = false;
        if (button.isConnected && button instanceof HTMLButtonElement) {
            button.disabled = false;
        }
    }
}

function bindWhatsappOpsActions() {
    const root = document.getElementById('dashboard');
    if (
        !(root instanceof HTMLElement) ||
        root.dataset.whatsappOpsBound === 'true'
    ) {
        return;
    }

    root.addEventListener('click', (event) => {
        const target =
            event.target instanceof Element
                ? event.target.closest('[data-whatsapp-ops-action]')
                : null;
        if (!(target instanceof HTMLButtonElement)) {
            return;
        }

        event.preventDefault();
        executeWhatsappOpsAction(target);
    });

    root.dataset.whatsappOpsBound = 'true';
}

function bindCheckoutReviewActions() {
    const root = document.getElementById('dashboard');
    if (
        !(root instanceof HTMLElement) ||
        root.dataset.checkoutReviewBound === 'true'
    ) {
        return;
    }

    root.addEventListener('click', (event) => {
        const target =
            event.target instanceof Element
                ? event.target.closest('[data-checkout-review-action]')
                : null;
        if (!(target instanceof HTMLButtonElement)) {
            return;
        }

        event.preventDefault();
        executeCheckoutReviewAction(target);
    });

    root.dataset.checkoutReviewBound = 'true';
}

export function renderDashboard(state) {
    const dashboardState = {
        ...getDashboardDerivedState(state),
        clinicalHistoryMeta: normalizeClinicalHistoryMeta(
            state?.data?.clinicalHistoryMeta
        ),
        checkoutReviewMeta: normalizeCheckoutReviewMeta(
            state?.data?.checkoutReviewMeta
        ),
        whatsappOpenclawOps: normalizeWhatsappOpenclawOps(
            state?.data?.whatsappOpenclawOps
        ),
    };

    setOverviewMetrics(dashboardState);
    setLiveStatus(dashboardState);
    setFlowMetrics(dashboardState);
    setJourneyHistory(dashboardState);
    setHtml('#operationActionList', buildOperations(dashboardState));
    setHtml(
        '#dashboardOpenclawOpsActions',
        buildWhatsappOpsActions(dashboardState.whatsappOpenclawOps)
    );
    setHtml(
        '#dashboardOpenclawOpsItems',
        buildWhatsappOpsItems(dashboardState.whatsappOpenclawOps)
    );
    setHtml(
        '#dashboardClinicalHistoryActions',
        buildClinicalHistoryActions(dashboardState)
    );
    setHtml(
        '#dashboardClinicalReviewQueue',
        buildClinicalHistoryQueueItems(dashboardState.clinicalHistoryMeta)
    );
    setHtml(
        '#dashboardClinicalEventFeed',
        buildClinicalHistoryEventItems(dashboardState.clinicalHistoryMeta)
    );
    setCheckoutReviewState(dashboardState.checkoutReviewMeta);
    setHtml('#dashboardAttentionList', buildAttentionItems(dashboardState));
    const queueAssistant = setFunnelMetrics(dashboardState.funnel);
    renderDashboardCharts(queueAssistant);
    bindWhatsappOpsActions();
    bindCheckoutReviewActions();
}
