let initialized = false;
let timerId = 0;
let refreshInFlight = false;

export function isQueueAutoRefreshInitialized() {
    return initialized;
}

export function setQueueAutoRefreshInitialized(value) {
    initialized = Boolean(value);
}

export function getQueueAutoRefreshTimerId() {
    return timerId;
}

export function setQueueAutoRefreshTimerId(value) {
    timerId = Number(value || 0);
}

export function isQueueAutoRefreshInFlight() {
    return refreshInFlight;
}

export function setQueueAutoRefreshInFlight(value) {
    refreshInFlight = Boolean(value);
}
