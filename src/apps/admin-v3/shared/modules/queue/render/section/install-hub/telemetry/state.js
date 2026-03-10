import { getState } from '../../../../../../core/store.js';

export function getSurfaceTelemetryAutoRefreshState() {
    const runtime = getState().ui?.queueAutoRefresh;
    return runtime && typeof runtime === 'object'
        ? runtime
        : {
              state: 'idle',
              reason: 'Abre Turnero Sala para activar el monitoreo continuo.',
              intervalMs: 45000,
              lastAttemptAt: 0,
              lastSuccessAt: 0,
              lastError: '',
              inFlight: false,
          };
}

function getQueueSurfaceTelemetry() {
    const telemetry = getState().data.queueSurfaceStatus;
    return telemetry && typeof telemetry === 'object' ? telemetry : {};
}

export function getSurfaceTelemetryState(surfaceKey) {
    const telemetry = getQueueSurfaceTelemetry();
    const raw = telemetry[surfaceKey];
    return raw && typeof raw === 'object'
        ? raw
        : {
              surface: surfaceKey,
              status: 'unknown',
              stale: true,
              summary: '',
              latest: null,
              instances: [],
          };
}
