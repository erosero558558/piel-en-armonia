import { apiRequest } from '../../core/api-client.js';
import { loadLocalAdminFallback, persistLocalAdminData } from './local.js';
import { normalizeAdminDataPayload } from './normalizers.js';
import { writeAdminDataInStore } from './store.js';

async function fetchFunnelMetrics(data) {
    if (data.funnelMetrics) return data.funnelMetrics;
    const funnelPayload = await apiRequest('funnel-metrics').catch(() => null);
    return funnelPayload?.data || null;
}

export async function refreshAdminData() {
    try {
        const [dataPayload, healthPayload] = await Promise.all([
            apiRequest('data'),
            apiRequest('health').catch(() => null),
        ]);

        const data = dataPayload.data || {};
        const fallbackState = loadLocalAdminFallback();
        const normalized = normalizeAdminDataPayload(
            {
                ...data,
                funnelMetrics: await fetchFunnelMetrics(data),
            },
            healthPayload,
            fallbackState
        );

        writeAdminDataInStore(normalized);
        persistLocalAdminData(normalized);
        return true;
    } catch (_error) {
        const fallback = loadLocalAdminFallback();
        writeAdminDataInStore(fallback);
        return false;
    }
}
