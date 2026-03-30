import {
    escapeHtml,
    formatNumber,
    setHtml,
    setText,
} from '../../../shared/ui/render.js';
import { breakdownList } from '../markup.js';

function asObject(value) {
    return value && typeof value === 'object' ? value : {};
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function firstValue(source, keys, fallback = 0) {
    const data = asObject(source);
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            return data[key];
        }
    }
    return fallback;
}

function readCount(source, keys) {
    const value = Number(firstValue(source, keys, 0));
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function readLabel(source, keys) {
    return String(firstValue(source, keys, '') || '').trim();
}

function normalizeBreakdown(list) {
    return asArray(list)
        .map((entry) => ({
            label: String(entry?.label || entry?.reason || entry?.intent || '')
                .trim()
                .toLowerCase(),
            count: readCount(entry, ['count']),
        }))
        .filter((entry) => entry.label && entry.count > 0)
        .sort((left, right) => right.count - left.count);
}

function normalizeCountMap(value) {
    if (Array.isArray(value)) {
        return value
            .map((entry) => ({
                label: String(entry?.label || entry?.hour || '')
                    .trim()
                    .toLowerCase(),
                count: readCount(entry, ['count', 'value']),
            }))
            .filter((entry) => entry.label && entry.count > 0);
    }

    const source = asObject(value);
    return Object.entries(source)
        .map(([label, count]) => ({
            label: String(label || '').trim().toLowerCase(),
            count: readCount({ count }, ['count']),
        }))
        .filter((entry) => entry.label && entry.count > 0);
}

function normalizeAssistantWindow(raw) {
    const source = asObject(raw);
    return {
        actioned: readCount(source, ['actioned']),
        resolvedWithoutHuman: readCount(source, [
            'resolvedWithoutHuman',
            'resolved_without_human',
        ]),
        assistedResolutions: readCount(source, [
            'assistedResolutions',
            'assisted_resolutions',
        ]),
        escalated: readCount(source, ['escalated']),
        clinicalBlocked: readCount(source, [
            'clinicalBlocked',
            'clinical_blocked',
        ]),
        fallback: readCount(source, ['fallback']),
        errors: readCount(source, ['errors']),
        latencyTotalMs: readCount(source, [
            'latencyTotalMs',
            'latency_total_ms',
        ]),
        latencySamples: readCount(source, [
            'latencySamples',
            'latency_samples',
        ]),
        sessions: readCount(source, ['sessions']),
        usefulSessions: readCount(source, [
            'usefulSessions',
            'useful_sessions',
        ]),
        avgLatencyMs: readCount(source, ['avgLatencyMs', 'avg_latency_ms']),
        avgQueueWaitMs: readCount(source, [
            'avgQueueWaitMs',
            'avg_queue_wait_ms',
        ]),
        hourlyThroughput: normalizeCountMap(
            firstValue(source, ['hourlyThroughput', 'hourly_throughput'], {})
        ).sort((left, right) => left.label.localeCompare(right.label)),
    };
}

function normalizeTopRow(raw, breakdown) {
    const source = asObject(raw);
    const label = readLabel(source, ['label']);
    const count = readCount(source, ['count']);
    if (label) {
        return { label, count };
    }
    return breakdown[0] || { label: '', count: 0 };
}

function normalizeQueueAssistant(raw) {
    const source = asObject(raw);
    const today = normalizeAssistantWindow(
        firstValue(source, ['today', 'today_metrics', 'todayMetrics'], {})
    );
    const last7d = normalizeAssistantWindow(
        firstValue(source, ['last7d', 'last_7d', 'week', 'week_metrics'], {})
    );
    const intentBreakdown = normalizeBreakdown(
        firstValue(source, ['intentBreakdown', 'intent_breakdown'], [])
    );
    const helpReasonBreakdown = normalizeBreakdown(
        firstValue(source, ['helpReasonBreakdown', 'help_reason_breakdown'], [])
    );
    const reviewOutcomeBreakdown = normalizeBreakdown(
        firstValue(
            source,
            ['reviewOutcomeBreakdown', 'review_outcome_breakdown'],
            []
        )
    );

    return {
        today,
        last7d,
        intentBreakdown,
        helpReasonBreakdown,
        reviewOutcomeBreakdown,
        topIntent: normalizeTopRow(
            firstValue(source, ['topIntent', 'top_intent'], {}),
            intentBreakdown
        ),
        topHelpReason: normalizeTopRow(
            firstValue(source, ['topHelpReason', 'top_help_reason'], {}),
            helpReasonBreakdown
        ),
        topReviewOutcome: normalizeTopRow(
            firstValue(source, ['topReviewOutcome', 'top_review_outcome'], {}),
            reviewOutcomeBreakdown
        ),
    };
}

function formatAssistantLabel(value, fallback = 'sin datos') {
    const label = String(value || '')
        .trim()
        .replace(/[_-]+/g, ' ');
    return label || fallback;
}

function resolveAssistantStatus(metrics) {
    const { today, last7d } = metrics;
    if (today.errors > 0) {
        return { label: 'Incidencias', tone: 'danger' };
    }
    if (today.clinicalBlocked > 0 || today.escalated > 0) {
        return { label: 'Con derivaciones', tone: 'warning' };
    }
    if (today.assistedResolutions > 0) {
        return { label: 'Recepcion cerrando', tone: 'success' };
    }
    if (today.resolvedWithoutHuman > 0) {
        return { label: 'Resolviendo', tone: 'success' };
    }
    if (today.actioned > 0) {
        return { label: 'Activo', tone: 'neutral' };
    }
    if (last7d.actioned > 0) {
        return { label: 'Sin uso hoy', tone: 'neutral' };
    }
    return { label: 'Sin uso', tone: 'neutral' };
}

function buildAssistantSummary(metrics) {
    const { today, last7d } = metrics;
    if (today.actioned <= 0) {
        return last7d.usefulSessions > 0
            ? `Sin actividad hoy. En 7 dias cerro ${formatNumber(last7d.usefulSessions)} sesiones utiles.`
            : 'Sin actividad del asistente todavia.';
    }

    const fragments = [`Hoy acciono ${formatNumber(today.actioned)} caso(s)`];
    if (today.resolvedWithoutHuman > 0) {
        fragments.push(
            `resolvio ${formatNumber(today.resolvedWithoutHuman)} sin humano`
        );
    }
    if (today.assistedResolutions > 0) {
        fragments.push(
            `recepcion cerro ${formatNumber(today.assistedResolutions)} con guia`
        );
    }
    if (today.escalated > 0) {
        fragments.push(`escalo ${formatNumber(today.escalated)} a recepcion`);
    }
    if (today.clinicalBlocked > 0) {
        fragments.push(
            `bloqueo ${formatNumber(today.clinicalBlocked)} consulta(s) clinica(s)`
        );
    }
    if (today.errors > 0) {
        fragments.push(`registro ${formatNumber(today.errors)} error(es)`);
    }
    return `${fragments.join(' | ')}.`;
}

function humanizeLabel(value, fallback = 'Sin datos') {
    const normalized = String(value || '')
        .trim()
        .replace(/[_-]+/g, ' ');
    if (!normalized) {
        return fallback;
    }

    return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeConversionDashboard(raw, serviceFunnel = []) {
    const source = asObject(raw);
    const today = asObject(source.today);
    const last7d = asObject(source.last7d);
    const dailySeries = asArray(source.dailySeries)
        .map((entry) => ({
            day: String(entry?.day || entry?.label || '').trim(),
            label: String(entry?.label || entry?.day || '').trim(),
            visits: readCount(entry, ['visits']),
            whatsappClicks: readCount(entry, [
                'whatsappClicks',
                'whatsapp_clicks',
            ]),
            bookingConfirmed: readCount(entry, [
                'bookingConfirmed',
                'booking_confirmed',
            ]),
        }))
        .filter((entry) => entry.label !== '')
        .slice(-7);
    const topServices = (asArray(source.topServices).length > 0
        ? asArray(source.topServices)
        : asArray(serviceFunnel)
    )
        .map((entry) => ({
            serviceSlug: String(entry?.serviceSlug || entry?.service_slug || '')
                .trim()
                .toLowerCase(),
            detailViews: readCount(entry, ['detailViews', 'detail_views']),
            bookingIntent: readCount(entry, ['bookingIntent', 'booking_intent']),
            checkoutStarts: readCount(entry, [
                'checkoutStarts',
                'checkout_starts',
            ]),
            bookingConfirmed: readCount(entry, [
                'bookingConfirmed',
                'booking_confirmed',
            ]),
            detailToConfirmedPct: Number(
                firstValue(entry, [
                    'detailToConfirmedPct',
                    'detail_to_confirmed_pct',
                ], 0)
            ),
        }))
        .filter((entry) => entry.serviceSlug !== '')
        .slice(0, 5);

    return {
        today: {
            visits: readCount(today, ['visits']),
            whatsappClicks: readCount(today, [
                'whatsappClicks',
                'whatsapp_clicks',
            ]),
            bookingConfirmed: readCount(today, [
                'bookingConfirmed',
                'booking_confirmed',
            ]),
        },
        last7d: {
            visits: readCount(last7d, ['visits']),
            whatsappClicks: readCount(last7d, [
                'whatsappClicks',
                'whatsapp_clicks',
            ]),
            bookingConfirmed: readCount(last7d, [
                'bookingConfirmed',
                'booking_confirmed',
            ]),
            visitsPerDay: Number(
                firstValue(last7d, ['visitsPerDay', 'visits_per_day'], 0)
            ),
            whatsappClicksPerDay: Number(
                firstValue(last7d, [
                    'whatsappClicksPerDay',
                    'whatsapp_clicks_per_day',
                ], 0)
            ),
            bookingConfirmedPerDay: Number(
                firstValue(last7d, [
                    'bookingConfirmedPerDay',
                    'booking_confirmed_per_day',
                ], 0)
            ),
        },
        dailySeries,
        topServices,
    };
}

function resolveConversionStatus(conversion) {
    if (conversion.today.whatsappClicks > 0) {
        return { label: 'Con traccion', tone: 'success' };
    }
    if (conversion.today.visits > 0 || conversion.topServices.length > 0) {
        return { label: 'Moviendose', tone: 'warning' };
    }
    return { label: 'Sin datos', tone: 'neutral' };
}

function buildConversionSummary(conversion) {
    if (
        conversion.today.visits <= 0 &&
        conversion.today.whatsappClicks <= 0 &&
        conversion.topServices.length === 0
    ) {
        return 'Sin eventos de conversion todavia. El panel se poblara cuando entren visitas al flujo y clicks a WhatsApp desde la web publica.';
    }

    return `Hoy entraron ${formatNumber(conversion.today.visits)} visita(s) al flujo y ${formatNumber(conversion.today.whatsappClicks)} click(s) a WhatsApp. En 7 dias vamos en ${Number(conversion.last7d.visitsPerDay || 0).toFixed(1)} visita(s)/dia y ${Number(conversion.last7d.whatsappClicksPerDay || 0).toFixed(1)} click(s)/dia.`;
}

function buildConversionDailyList(rows) {
    const activeRows = asArray(rows).filter(
        (entry) =>
            entry.visits > 0 ||
            entry.whatsappClicks > 0 ||
            entry.bookingConfirmed > 0
    );

    if (activeRows.length === 0) {
        return '<li><div><span>Sin datos</span><small>Esperando eventos diarios del funnel.</small></div><strong>0</strong></li>';
    }

    return activeRows
        .map(
            (entry) => `<li data-conversion-day="true"><div><span>${escapeHtml(
                entry.label
            )}</span><small>WhatsApp ${escapeHtml(
                formatNumber(entry.whatsappClicks)
            )} · Confirmadas ${escapeHtml(
                formatNumber(entry.bookingConfirmed)
            )}</small></div><strong>${escapeHtml(
                formatNumber(entry.visits)
            )}</strong></li>`
        )
        .join('');
}

function buildTopServicesList(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
        return '<li><div><span>Sin ranking</span><small>Esperando vistas y cierres por servicio.</small></div><strong>0%</strong></li>';
    }

    return rows
        .map(
            (entry) => `<li data-conversion-service="true"><div><span>${escapeHtml(
                humanizeLabel(entry.serviceSlug, 'Sin datos')
            )}</span><small>${escapeHtml(
                formatNumber(entry.bookingConfirmed)
            )} confirmadas · ${escapeHtml(
                formatNumber(entry.checkoutStarts)
            )} checkout</small></div><strong>${escapeHtml(
                Number(entry.detailToConfirmedPct || 0).toFixed(1)
            )}%</strong></li>`
        )
        .join('');
}

function setAssistantUtilityMetrics(metrics) {
    const { today, last7d, topIntent, topHelpReason, topReviewOutcome } =
        metrics;
    const status = resolveAssistantStatus(metrics);
    const statusEl = document.getElementById('dashboardAssistantStatus');
    if (statusEl) {
        statusEl.textContent = status.label;
        statusEl.setAttribute('data-state', status.tone);
    }

    setText('#dashboardAssistantMeta', 'Recepcionista ejecutora en sala');
    setText('#dashboardAssistantActioned', formatNumber(today.actioned));
    setText(
        '#dashboardAssistantResolved',
        formatNumber(today.resolvedWithoutHuman)
    );
    setText('#dashboardAssistantEscalated', formatNumber(today.escalated));
    setText('#dashboardAssistantBlocked', formatNumber(today.clinicalBlocked));
    setText('#dashboardAssistantSummary', buildAssistantSummary(metrics));
    setText(
        '#dashboardAssistantWindowMeta',
        `7d: ${formatNumber(last7d.usefulSessions)} sesiones utiles | ${formatNumber(last7d.avgLatencyMs)} ms promedio | ${formatNumber(last7d.assistedResolutions)} cierre(s) asistidos | espera hoy ${formatNumber(today.avgQueueWaitMs)} ms`
    );
    setText(
        '#dashboardAssistantTopIntent',
        topIntent.count > 0
            ? `Intent principal: ${formatAssistantLabel(topIntent.label)} (${formatNumber(topIntent.count)})`
            : 'Intent principal: sin datos'
    );
    setText(
        '#dashboardAssistantTopReason',
        topHelpReason.count > 0
            ? `Motivo de apoyo: ${formatAssistantLabel(topHelpReason.label)} (${formatNumber(topHelpReason.count)})`
            : 'Motivo de apoyo: sin datos'
    );
    setText(
        '#dashboardAssistantTopOutcome',
        topReviewOutcome.count > 0
            ? `Cierre asistido: ${formatAssistantLabel(topReviewOutcome.label)} (${formatNumber(topReviewOutcome.count)})`
            : 'Cierre asistido: sin datos'
    );
}

export function setFunnelMetrics(funnel) {
    const summary = asObject(funnel.summary);
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
        breakdownList(
            funnel.sourceBreakdown || funnel.eventSourceBreakdown,
            'source',
            'count'
        )
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
        breakdownList(
            funnel.abandonReasonBreakdown || funnel.checkoutAbandonByReason,
            'reason',
            'count'
        )
    );
    setHtml(
        '#funnelStepList',
        breakdownList(funnel.bookingStepBreakdown, 'step', 'count')
    );
    setHtml(
        '#funnelErrorCodeList',
        breakdownList(funnel.errorCodeBreakdown, 'code', 'count')
    );
    const conversion = normalizeConversionDashboard(
        funnel.conversionDashboard,
        funnel.topServices || funnel.serviceFunnel || []
    );
    const conversionStatus = resolveConversionStatus(conversion);
    const conversionChip = document.getElementById('dashboardConversionChip');
    if (conversionChip) {
        conversionChip.textContent = conversionStatus.label;
        conversionChip.setAttribute('data-state', conversionStatus.tone);
    }
    setText('#dashboardConversionSummary', buildConversionSummary(conversion));
    setText('#funnelDailyVisitsToday', formatNumber(conversion.today.visits));
    setText(
        '#funnelDailyWhatsappToday',
        formatNumber(conversion.today.whatsappClicks)
    );
    setText(
        '#funnelDailyVisitsAvg',
        Number(conversion.last7d.visitsPerDay || 0).toFixed(1)
    );
    setText(
        '#funnelDailyWhatsappAvg',
        Number(conversion.last7d.whatsappClicksPerDay || 0).toFixed(1)
    );
    const topService = conversion.topServices[0] || null;
    setText(
        '#dashboardConversionTopService',
        topService
            ? humanizeLabel(topService.serviceSlug, 'Sin ranking')
            : 'Sin ranking'
    );
    setText(
        '#dashboardConversionTopServiceMeta',
        topService
            ? `${formatNumber(topService.bookingConfirmed)} confirmadas · ${formatNumber(topService.checkoutStarts)} checkout · ${Number(topService.detailToConfirmedPct || 0).toFixed(1)}% detalle->confirmada`
            : 'Cuando existan vistas y reservas, aqui aparecera el servicio con mejor cierre.'
    );
    setText(
        '#dashboardConversionPaceHeadline',
        `${formatNumber(conversion.last7d.bookingConfirmed)} confirmadas`
    );
    setText(
        '#dashboardConversionPaceMeta',
        `${Number(conversion.last7d.bookingConfirmedPerDay || 0).toFixed(1)} por dia · ${formatNumber(conversion.last7d.visits)} visitas · ${formatNumber(conversion.last7d.whatsappClicks)} click(s) WhatsApp`
    );
    setHtml(
        '#dashboardConversionDailyList',
        buildConversionDailyList(conversion.dailySeries)
    );
    setHtml(
        '#dashboardConversionTopServices',
        buildTopServicesList(conversion.topServices)
    );
    const queueAssistant = normalizeQueueAssistant(
        funnel.queueAssistant || funnel.queue_assistant || {}
    );
    setAssistantUtilityMetrics(queueAssistant);
    return queueAssistant;
}
