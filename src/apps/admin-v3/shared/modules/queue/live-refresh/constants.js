const DEFAULT_QUEUE_AUTO_REFRESH_INTERVAL_MS = 45000;
const MIN_QUEUE_AUTO_REFRESH_INTERVAL_MS = 50;

export function resolveQueueAutoRefreshIntervalMs() {
    if (typeof window !== 'undefined') {
        const override = Number(window.__QUEUE_AUTO_REFRESH_INTERVAL_MS__);
        if (Number.isFinite(override) && override > 0) {
            return Math.max(
                MIN_QUEUE_AUTO_REFRESH_INTERVAL_MS,
                Math.round(override)
            );
        }
    }

    return DEFAULT_QUEUE_AUTO_REFRESH_INTERVAL_MS;
}
