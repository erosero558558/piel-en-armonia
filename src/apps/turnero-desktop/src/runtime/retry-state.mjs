function toFiniteMs(value, fallback = 0) {
    const normalized = Number(value);
    return Number.isFinite(normalized) && normalized > 0
        ? normalized
        : fallback;
}

function normalizeAttempt(value) {
    const normalized = Number(value);
    return Number.isFinite(normalized) && normalized > 0
        ? Math.floor(normalized)
        : 0;
}

export function createEmptyRetryState() {
    return {
        active: false,
        attempt: 0,
        delayMs: 0,
        nextRetryAt: '',
        reason: '',
    };
}

export function buildScheduledRetryState({
    retryCount = 0,
    delayMs = 0,
    reason = '',
    now = Date.now(),
} = {}) {
    const safeDelayMs = toFiniteMs(delayMs);
    const safeNow = toFiniteMs(now, Date.now());
    const attempt = normalizeAttempt(retryCount) + 1;

    if (safeDelayMs <= 0) {
        return createEmptyRetryState();
    }

    return {
        active: true,
        attempt,
        delayMs: safeDelayMs,
        nextRetryAt: new Date(safeNow + safeDelayMs).toISOString(),
        reason: String(reason || '').trim(),
    };
}

export function getRetryRemainingMs(retryState, now = Date.now()) {
    if (!retryState?.active) {
        return 0;
    }

    const nextRetryAtMs = Date.parse(String(retryState.nextRetryAt || ''));
    if (!Number.isFinite(nextRetryAtMs)) {
        return 0;
    }

    return Math.max(0, nextRetryAtMs - toFiniteMs(now, Date.now()));
}

export function getRetrySnapshot(retryState, now = Date.now()) {
    const base =
        retryState && typeof retryState === 'object'
            ? retryState
            : createEmptyRetryState();
    const active =
        Boolean(base.active) && String(base.nextRetryAt || '').trim() !== '';

    return {
        active,
        attempt: normalizeAttempt(base.attempt),
        delayMs: toFiniteMs(base.delayMs),
        nextRetryAt: String(base.nextRetryAt || '').trim(),
        reason: String(base.reason || '').trim(),
        remainingMs: active ? getRetryRemainingMs(base, now) : 0,
    };
}
