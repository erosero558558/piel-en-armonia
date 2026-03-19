import { getState } from '../../../../../../../core/store.js';
import { getQueueSource } from '../../../../../selectors.js';
import { setHtml } from '../../../../../../../ui/render.js';
import { buildSurfaceTelemetryCards } from '../cards.js';
import { buildSurfaceTelemetryAutoRefreshMeta } from './auto-refresh.js';
import { buildSurfaceTelemetryShell } from './shell.js';
import { buildSurfaceTelemetrySummary } from './summary.js';
import { mountTurneroReleaseTelemetryOptimizationHub } from '../../../../../../../../../queue-shared/turnero-release-telemetry-optimization-hub.js';

export function renderSurfaceTelemetry(manifest, detectedPlatform) {
    const root = document.getElementById('queueSurfaceTelemetry');
    if (!(root instanceof HTMLElement)) return;

    const cards = buildSurfaceTelemetryCards(manifest, detectedPlatform);
    const autoRefresh = buildSurfaceTelemetryAutoRefreshMeta();
    const summary = buildSurfaceTelemetrySummary(cards);

    setHtml(
        '#queueSurfaceTelemetry',
        buildSurfaceTelemetryShell({
            cards,
            autoRefresh,
            ...summary,
        })
    );

    const host = document.getElementById(
        'queueSurfaceTelemetryOptimizationHubHost'
    );
    if (host instanceof HTMLElement) {
        const state = getState();
        const data =
            state?.data && typeof state.data === 'object' ? state.data : {};
        const { queueMeta } = getQueueSource();
        mountTurneroReleaseTelemetryOptimizationHub(host, {
            scope:
                data.turneroClinicProfile?.region ||
                data.turneroReleaseEvidenceBundle?.region ||
                'regional',
            region:
                data.turneroClinicProfile?.region ||
                data.turneroReleaseEvidenceBundle?.region ||
                'regional',
            turneroClinicProfile: data.turneroClinicProfile || null,
            queueMeta,
            queueSurfaceStatus: data.queueSurfaceStatus || null,
            turneroReleaseEvidenceBundle:
                data.turneroReleaseEvidenceBundle || null,
        });
    }
}
