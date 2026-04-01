import { apiRequest } from '../../core/api-client.js';
import { getState, updateState } from '../../core/store.js';
import { loadLocalAdminFallback, persistLocalAdminData } from './local.js';
import { normalizeAdminDataPayload } from './normalizers.js';
import { writeAdminDataInStore } from './store.js';

async function fetchFunnelMetrics(data) {
    if (data.funnelMetrics) return data.funnelMetrics;
    const funnelPayload = await apiRequest('funnel-metrics').catch(() => null);
    return funnelPayload?.data || null;
}

async function fetchCallbacks(data) {
    if (data.callbacks) return data.callbacks;
    const callbacksPayload = await apiRequest('callbacks').catch(() => null);
    return callbacksPayload?.data || [];
}


async function fetchBookingFunnelReport(data) {
    const embeddedReport =
        data?.bookingFunnelReport ||
        data?.funnelMetrics?.bookingFunnelReport ||
        null;
    if (embeddedReport) return embeddedReport;

    const reportPayload = await apiRequest('booking-funnel-report').catch(
        () => null
    );
    return reportPayload?.data || null;
}

function mergeFunnelMetrics(funnelMetrics, bookingFunnelReport) {
    const merged =
        funnelMetrics && typeof funnelMetrics === 'object'
            ? { ...funnelMetrics }
            : {};

    if (
        bookingFunnelReport &&
        typeof bookingFunnelReport === 'object' &&
        Object.keys(bookingFunnelReport).length > 0
    ) {
        merged.bookingFunnelReport = bookingFunnelReport;
    }

    return Object.keys(merged).length > 0 ? merged : null;
}

function normalizeList(value) {
    return Array.isArray(value) ? value : [];
}

async function fetchReviews(data) {
    if (data.reviews) return data.reviews;
    const reviewsPayload = await apiRequest('reviews').catch(() => null);
    return reviewsPayload?.data || [];
}

function normalizeNumber(value) {
    const num = Number(value || 0);
    return Number.isFinite(num) ? Math.max(0, num) : 0;
}

function normalizeWhatsappOpenclawOpsSnapshot(payload, meta = {}) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const hasSourceData = Object.keys(source).length > 0;
    const available =
        meta.available !== undefined ? meta.available === true : hasSourceData;

    return {
        available,
        statusCode: Number(meta.statusCode || 0),
        error: String(meta.error || '').trim(),
        configured: source.configured === true,
        configuredMode: String(source.configuredMode || 'disabled'),
        bridgeConfigured: source.bridgeConfigured === true,
        bridgeMode: String(source.bridgeMode || (available ? 'pending' : 'offline')),
        bridgeStatus:
            source.bridgeStatus && typeof source.bridgeStatus === 'object'
                ? source.bridgeStatus
                : {},
        pendingOutbox: normalizeNumber(source.pendingOutbox),
        activeConversations: normalizeNumber(source.activeConversations),
        aliveHolds: normalizeNumber(source.aliveHolds),
        bookingsClosed: normalizeNumber(source.bookingsClosed),
        paymentsStarted: normalizeNumber(source.paymentsStarted),
        paymentsCompleted: normalizeNumber(source.paymentsCompleted),
        deliveryFailures: normalizeNumber(source.deliveryFailures),
        automationSuccessRate: Number.isFinite(Number(source.automationSuccessRate))
            ? Number(source.automationSuccessRate)
            : 0,
        lastInboundAt: String(source.lastInboundAt || ''),
        lastOutboundAt: String(source.lastOutboundAt || ''),
        pendingOutboxItems: normalizeList(source.pendingOutboxItems),
        failedOutboxItems: normalizeList(source.failedOutboxItems),
        activeHolds: normalizeList(source.activeHolds),
        pendingCheckouts: normalizeList(source.pendingCheckouts),
        conversations: normalizeList(source.conversations),
    };
}

function writeWhatsappOpenclawOpsSnapshot(snapshot) {
    updateState((state) => ({
        ...state,
        data: {
            ...state.data,
            whatsappOpenclawOps: snapshot,
        },
    }));
}

async function fetchWhatsappOpenclawOpsSnapshot() {
    try {
        const opsPayload = await apiRequest('whatsapp-openclaw-ops');
        return normalizeWhatsappOpenclawOpsSnapshot(opsPayload?.data || {}, {
            available: true,
            statusCode: 200,
        });
    } catch (error) {
        return normalizeWhatsappOpenclawOpsSnapshot(null, {
            available: false,
            statusCode: Number(error?.status || 0),
            error:
                error?.message || 'No se pudo cargar el snapshot de WhatsApp/OpenClaw',
        });
    }
}

export async function runWhatsappOpenclawOpsAction(action, payload = {}) {
    const safeAction = String(action || '').trim();
    if (!safeAction) {
        throw new Error('Accion OpenClaw requerida');
    }

    const response = await apiRequest('whatsapp-openclaw-ops', {
        method: 'POST',
        body: {
            action: safeAction,
            ...payload,
        },
    });

    return response?.data || {};
}

export async function refreshAdminData() {
    const queueRuntimeRevision = Number(getState().queue?.runtimeRevision || 0);
    try {
        const [dataPayload, healthPayload, whatsappOpenclawOps, callbacksPayload] = await Promise.all([
            apiRequest('data'),
            apiRequest('health').catch(() => null),
            fetchWhatsappOpenclawOpsSnapshot(),
            apiRequest('callbacks').catch(() => null),
        ]);

        const data = dataPayload.data || {};
        const [funnelMetrics, bookingFunnelReport, reviews, callbacks] =
            await Promise.all([
                fetchFunnelMetrics(data),
                fetchBookingFunnelReport(data),
                fetchReviews(data),
                fetchCallbacks(data),
            ]);
        const fallbackState = loadLocalAdminFallback();
        const normalized = normalizeAdminDataPayload(
            {
                ...data,
                callbacks: Array.isArray(callbacksPayload?.data) ? callbacksPayload.data : (data.callbacks || []),
                funnelMetrics: mergeFunnelMetrics(
                    funnelMetrics,
                    bookingFunnelReport
                ),
                reviews,
                callbacks,
            },
            healthPayload,
            fallbackState
        );

        const { preservedQueueData } = writeAdminDataInStore(normalized, {
            queueRuntimeRevision,
        });
        persistLocalAdminData(normalized);
        writeWhatsappOpenclawOpsSnapshot(whatsappOpenclawOps);
        return {
            ok: true,
            preservedQueueData,
        };
    } catch (_error) {
        const fallback = loadLocalAdminFallback();
        writeAdminDataInStore({
            ...fallback,
            turneroClinicProfileMeta: fallback.turneroClinicProfile
                ? {
                      source: 'fallback_local',
                      cached: true,
                      clinicId: String(
                          fallback.turneroClinicProfile?.clinic_id || ''
                      ).trim(),
                      profileFingerprint: String(
                          fallback.turneroClinicProfileMeta?.profileFingerprint ||
                              ''
                      ).trim(),
                      fetchedAt: String(
                          fallback.turneroClinicProfileMeta?.fetchedAt || ''
                      ).trim(),
                  }
                : null,
        });
        writeWhatsappOpenclawOpsSnapshot(
            normalizeWhatsappOpenclawOpsSnapshot(
                getState().data?.whatsappOpenclawOps || null,
                {
                    available: Boolean(getState().data?.whatsappOpenclawOps),
                }
            )
        );
        return {
            ok: false,
            preservedQueueData: false,
        };
    }
}
