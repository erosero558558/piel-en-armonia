// @ts-check

function fulfillJson(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

function buildAdminAvailabilityMeta(overrides = {}) {
    return {
        source: 'store',
        mode: 'live',
        timezone: 'America/Guayaquil',
        calendarConfigured: true,
        calendarReachable: true,
        generatedAt: new Date().toISOString(),
        ...overrides,
    };
}

function buildAdminDataPayload(overrides = {}) {
    const {
        appointments = [],
        callbacks = [],
        reviews = [],
        availability = {},
        availabilityMeta = {},
        ...rest
    } = overrides;

    return {
        appointments: Array.isArray(appointments) ? appointments : [],
        callbacks: Array.isArray(callbacks) ? callbacks : [],
        reviews: Array.isArray(reviews) ? reviews : [],
        availability:
            availability && typeof availability === 'object'
                ? availability
                : {},
        availabilityMeta: buildAdminAvailabilityMeta(availabilityMeta),
        ...rest,
    };
}

function normalizeAdminQueueTicket(ticket, index = 0) {
    const source = ticket && typeof ticket === 'object' ? ticket : {};
    const id = Number(source.id || index + 1) || index + 1;
    const ticketCode =
        typeof source.ticketCode === 'string' && source.ticketCode.trim()
            ? source.ticketCode.trim()
            : `A-${String(id).padStart(3, '0')}`;
    const status = String(source.status || 'waiting').trim() || 'waiting';

    return {
        id,
        ticketCode,
        appointmentId: Number(source.appointmentId || 0) || 0,
        patientInitials:
            typeof source.patientInitials === 'string' &&
            source.patientInitials.trim()
                ? source.patientInitials.trim()
                : 'PA',
        queueType:
            String(source.queueType || 'appointment').trim() || 'appointment',
        priorityClass:
            String(source.priorityClass || 'appointment').trim() ||
            'appointment',
        status,
        createdAt:
            typeof source.createdAt === 'string' && source.createdAt.trim()
                ? source.createdAt.trim()
                : new Date().toISOString(),
        calledAt:
            typeof source.calledAt === 'string' && source.calledAt.trim()
                ? source.calledAt.trim()
                : '',
        assignedConsultorio:
            source.assignedConsultorio === null ||
            source.assignedConsultorio === undefined
                ? null
                : Number(source.assignedConsultorio || 0) || null,
    };
}

function buildAdminQueueStatePayload(queueTickets = []) {
    const tickets = (Array.isArray(queueTickets) ? queueTickets : []).map(
        (ticket, index) => normalizeAdminQueueTicket(ticket, index)
    );
    const waiting = tickets.filter((ticket) => ticket.status === 'waiting');
    const called = tickets.filter((ticket) => ticket.status === 'called');
    const completed = tickets.filter((ticket) => ticket.status === 'completed');
    const noShow = tickets.filter((ticket) => ticket.status === 'no_show');
    const cancelled = tickets.filter((ticket) => ticket.status === 'cancelled');

    return {
        ok: true,
        data: {
            updatedAt: new Date().toISOString(),
            waitingCount: waiting.length,
            calledCount: called.length,
            counts: {
                waiting: waiting.length,
                called: called.length,
                completed: completed.length,
                no_show: noShow.length,
                cancelled: cancelled.length,
            },
            callingNow: called.map((ticket) => ({
                id: ticket.id,
                ticketCode: ticket.ticketCode,
                appointmentId: ticket.appointmentId,
                patientInitials: ticket.patientInitials,
                queueType: ticket.queueType,
                priorityClass: ticket.priorityClass,
                calledAt: ticket.calledAt || ticket.createdAt,
                assignedConsultorio: ticket.assignedConsultorio,
            })),
            nextTickets: waiting.map((ticket, index) => ({
                id: ticket.id,
                ticketCode: ticket.ticketCode,
                appointmentId: ticket.appointmentId,
                patientInitials: ticket.patientInitials,
                queueType: ticket.queueType,
                priorityClass: ticket.priorityClass,
                position: index + 1,
                createdAt: ticket.createdAt,
            })),
        },
    };
}

function buildAdminFunnelMetricsFixture(overrides = {}) {
    const {
        summary: summaryOverride = {},
        queueAssistant: queueAssistantRaw = {},
        conversionDashboard: conversionDashboardRaw = {},
        bookingFunnelReport: bookingFunnelReportRaw = {},
        checkoutAbandonByStep = [],
        checkoutEntryBreakdown = [],
        paymentMethodBreakdown = [],
        bookingStepBreakdown = [],
        sourceBreakdown = [],
        abandonReasonBreakdown = [],
        errorCodeBreakdown = [],
        ...rest
    } = overrides;
    const queueAssistantOverride =
        queueAssistantRaw && typeof queueAssistantRaw === 'object'
            ? queueAssistantRaw
            : {};
    const todayOverride =
        queueAssistantOverride.today &&
        typeof queueAssistantOverride.today === 'object'
            ? queueAssistantOverride.today
            : {};
    const last7dOverride =
        queueAssistantOverride.last7d &&
        typeof queueAssistantOverride.last7d === 'object'
            ? queueAssistantOverride.last7d
            : {};
    const conversionDashboardOverride =
        conversionDashboardRaw && typeof conversionDashboardRaw === 'object'
            ? conversionDashboardRaw
            : {};
    const conversionTodayOverride =
        conversionDashboardOverride.today &&
        typeof conversionDashboardOverride.today === 'object'
            ? conversionDashboardOverride.today
            : {};
    const conversionLast7dOverride =
        conversionDashboardOverride.last7d &&
        typeof conversionDashboardOverride.last7d === 'object'
            ? conversionDashboardOverride.last7d
            : {};
    const bookingFunnelReportOverride =
        bookingFunnelReportRaw && typeof bookingFunnelReportRaw === 'object'
            ? bookingFunnelReportRaw
            : {};
    const bookingFunnelSummaryOverride =
        bookingFunnelReportOverride.summary &&
        typeof bookingFunnelReportOverride.summary === 'object'
            ? bookingFunnelReportOverride.summary
            : {};

    return {
        summary: {
            viewBooking: 0,
            startCheckout: 0,
            bookingConfirmed: 0,
            checkoutAbandon: 0,
            startRatePct: 0,
            confirmedRatePct: 0,
            abandonRatePct: 0,
            ...summaryOverride,
        },
        checkoutAbandonByStep,
        checkoutEntryBreakdown,
        paymentMethodBreakdown,
        bookingStepBreakdown,
        sourceBreakdown,
        abandonReasonBreakdown,
        errorCodeBreakdown,
        conversionDashboard: {
            today: {
                visits: 0,
                whatsappClicks: 0,
                bookingConfirmed: 0,
                ...conversionTodayOverride,
            },
            last7d: {
                days: 7,
                visits: 0,
                whatsappClicks: 0,
                bookingConfirmed: 0,
                visitsPerDay: 0,
                whatsappClicksPerDay: 0,
                bookingConfirmedPerDay: 0,
                ...conversionLast7dOverride,
            },
            dailySeries: conversionDashboardOverride.dailySeries || [],
            topServices: conversionDashboardOverride.topServices || [],
            generatedAt: conversionDashboardOverride.generatedAt || '',
        },
        bookingFunnelReport: {
            summary: {
                servicesTracked: 0,
                detailViews: 0,
                bookingOpened: 0,
                slotSelected: 0,
                bookingConfirmed: 0,
                biggestDropoffService: '',
                biggestDropoffStage: '',
                biggestDropoffCount: 0,
                ...bookingFunnelSummaryOverride,
            },
            rows: bookingFunnelReportOverride.rows || [],
            generatedAt: bookingFunnelReportOverride.generatedAt || '',
        },
        queueAssistant: {
            today: {
                actioned: 0,
                resolvedWithoutHuman: 0,
                assistedResolutions: 0,
                escalated: 0,
                clinicalBlocked: 0,
                fallback: 0,
                errors: 0,
                latencyTotalMs: 0,
                latencySamples: 0,
                sessions: 0,
                usefulSessions: 0,
                avgLatencyMs: 0,
                ...todayOverride,
            },
            last7d: {
                actioned: 0,
                resolvedWithoutHuman: 0,
                assistedResolutions: 0,
                escalated: 0,
                clinicalBlocked: 0,
                fallback: 0,
                errors: 0,
                latencyTotalMs: 0,
                latencySamples: 0,
                sessions: 0,
                usefulSessions: 0,
                avgLatencyMs: 0,
                ...last7dOverride,
            },
            intentBreakdown: queueAssistantOverride.intentBreakdown || [],
            helpReasonBreakdown:
                queueAssistantOverride.helpReasonBreakdown || [],
            reviewOutcomeBreakdown:
                queueAssistantOverride.reviewOutcomeBreakdown || [],
            topIntent: queueAssistantOverride.topIntent || {
                label: '',
                count: 0,
            },
            topHelpReason: queueAssistantOverride.topHelpReason || {
                label: '',
                count: 0,
            },
            topReviewOutcome: queueAssistantOverride.topReviewOutcome || {
                label: '',
                count: 0,
            },
            generatedAt: queueAssistantOverride.generatedAt || '',
        },
        ...rest,
    };
}

function buildAdminAgentStatusPayload(overrides = {}) {
    return {
        ok: true,
        data: {
            session: null,
            outbox: [],
            health: {
                relay: {
                    mode: 'disabled',
                },
                counts: {
                    messages: 0,
                    turns: 0,
                    toolCalls: 0,
                    pendingApprovals: 0,
                    outboxQueued: 0,
                    outboxTotal: 0,
                },
            },
            tools: [],
            ...overrides,
        },
    };
}

function buildAdminAgentSnapshot(overrides = {}) {
    const {
        session: sessionOverride = {},
        context: contextOverride = {},
        messages = [],
        turns = [],
        toolCalls = [],
        approvals = [],
        events = [],
        outbox = [],
        health = {},
        tools = [],
        ...rest
    } = overrides;

    return {
        session: {
            sessionId: 'ags_test_001',
            status: 'active',
            riskMode: 'autopilot_partial',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...sessionOverride,
        },
        context: {
            section: 'callbacks',
            selectedEntity: {
                type: 'callback',
                id: 401,
                label: 'Lead 401',
            },
            visibleIds: [401, 402],
            ...contextOverride,
        },
        messages,
        turns,
        toolCalls,
        approvals,
        events,
        outbox,
        health: {
            relay: {
                mode: 'disabled',
            },
            counts: {
                messages: messages.length,
                turns: turns.length,
                toolCalls: toolCalls.length,
                pendingApprovals: approvals.filter(
                    (item) => item.status === 'pending'
                ).length,
                outboxQueued: outbox.filter((item) => item.status === 'queued')
                    .length,
                outboxTotal: outbox.length,
            },
            ...health,
        },
        tools,
        ...rest,
    };
}

function buildAdminFeaturesPayload(overrides = {}) {
    const { data: dataOverride = {}, ...rest } = overrides;

    return {
        ok: true,
        ...rest,
        data: {
            admin_sony_ui: true,
            ...dataOverride,
        },
    };
}

function buildAdminHealthPayload(overrides = {}) {
    return {
        ok: true,
        data: {},
        ...overrides,
    };
}

function buildAdminMonitoringConfigPayload(overrides = {}) {
    return {
        sentry_dsn_frontend: '',
        ga_measurement_id: '',
        clarity_id: '',
        ...overrides,
    };
}

function buildAdminDefaultPayload(overrides = {}) {
    return {
        ok: true,
        data: {},
        ...overrides,
    };
}

function parseRoutePayload(route, method) {
    if (!['PATCH', 'POST', 'PUT'].includes(method)) {
        return {};
    }

    try {
        return route.request().postDataJSON() || {};
    } catch (_error) {
        const rawBody = route.request().postData() || '';
        const params = new URLSearchParams(rawBody);
        return Object.fromEntries(params.entries());
    }
}

async function installBasicAdminApiMocks(page, options = {}) {
    const context = {
        data: buildAdminDataPayload(options.dataOverrides || {}),
        funnelMetrics: buildAdminFunnelMetricsFixture(
            options.funnelMetrics || {}
        ),
        featuresPayload: buildAdminFeaturesPayload(
            options.featuresPayload || {}
        ),
        healthPayload: buildAdminHealthPayload(options.healthPayload || {}),
        monitoringConfigPayload: buildAdminMonitoringConfigPayload(
            options.monitoringConfigPayload || {}
        ),
        defaultPayload: buildAdminDefaultPayload(options.defaultPayload || {}),
    };

    await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
        const url = new URL(route.request().url());
        const resource = url.searchParams.get('resource') || '';
        const method = route.request().method().toUpperCase();
        const payload = parseRoutePayload(route, method);
        const intendedMethod = String(payload._method || method).toUpperCase();

        if (typeof options.handleRoute === 'function') {
            const handled = await options.handleRoute({
                route,
                url,
                resource,
                method,
                payload,
                intendedMethod,
                context,
                fulfillJson,
            });

            if (handled) {
                return;
            }
        }

        if (resource === 'data') {
            return fulfillJson(route, { ok: true, data: context.data });
        }

        if (resource === 'features') {
            return fulfillJson(route, context.featuresPayload);
        }

        if (resource === 'funnel-metrics') {
            return fulfillJson(route, {
                ok: true,
                data: context.funnelMetrics,
            });
        }

        if (resource === 'booking-funnel-report') {
            return fulfillJson(route, {
                ok: true,
                data: context.funnelMetrics.bookingFunnelReport || {},
            });
        }

        if (resource === 'availability') {
            return fulfillJson(route, {
                ok: true,
                data: context.data.availability,
                meta: context.data.availabilityMeta,
            });
        }

        if (resource === 'queue-state') {
            return fulfillJson(
                route,
                buildAdminQueueStatePayload(context.data.queue_tickets || [])
            );
        }

        if (resource === 'monitoring-config') {
            return fulfillJson(route, context.monitoringConfigPayload);
        }

        if (resource === 'health') {
            return fulfillJson(route, context.healthPayload);
        }

        return fulfillJson(route, context.defaultPayload);
    });

    return context;
}

module.exports = {
    buildAdminAgentSnapshot,
    buildAdminAgentStatusPayload,
    buildAdminAvailabilityMeta,
    buildAdminDataPayload,
    buildAdminDefaultPayload,
    buildAdminFeaturesPayload,
    buildAdminFunnelMetricsFixture,
    buildAdminHealthPayload,
    buildAdminMonitoringConfigPayload,
    fulfillJson,
    installBasicAdminApiMocks,
};
