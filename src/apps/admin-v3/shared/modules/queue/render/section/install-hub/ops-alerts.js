let opsAlertsState = null;
let opsFocusMode = null;
let opsFocusModeClinicId = null;

function getActiveClinicId(getActiveQueueOpsClinicId) {
    return (
        String(
            typeof getActiveQueueOpsClinicId === 'function'
                ? getActiveQueueOpsClinicId()
                : ''
        ).trim() || 'default-clinic'
    );
}

function createOpsAlertsState(date, clinicId) {
    return {
        date,
        clinicId,
        reviewed: {},
    };
}

function normalizeOpsAlertsState(rawState, today, clinicId) {
    const source = rawState && typeof rawState === 'object' ? rawState : {};
    const reviewedSource =
        source.reviewed && typeof source.reviewed === 'object'
            ? source.reviewed
            : {};
    const sameClinic = String(source.clinicId || '').trim() === clinicId;
    const sameDate = String(source.date || '').trim() === today;
    const reviewed = Object.entries(reviewedSource).reduce(
        (acc, [alertId, value]) => {
            if (!alertId) {
                return acc;
            }
            const reviewedAt = String(value?.reviewedAt || '').trim();
            acc[String(alertId)] = {
                reviewedAt: reviewedAt || new Date().toISOString(),
            };
            return acc;
        },
        {}
    );

    return {
        date: today,
        clinicId,
        reviewed: sameClinic && sameDate ? reviewed : {},
    };
}

function loadOpsAlertsState(
    storageKey,
    getTodayLocalIsoDate,
    getActiveQueueOpsClinicId
) {
    const today = getTodayLocalIsoDate();
    const clinicId = getActiveClinicId(getActiveQueueOpsClinicId);
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) {
            return createOpsAlertsState(today, clinicId);
        }
        const parsed = JSON.parse(raw);
        if (
            String(parsed?.date || '').trim() !== today ||
            String(parsed?.clinicId || '').trim() !== clinicId
        ) {
            const resetState = createOpsAlertsState(today, clinicId);
            localStorage.setItem(storageKey, JSON.stringify(resetState));
            return resetState;
        }
        return normalizeOpsAlertsState(parsed, today, clinicId);
    } catch (_error) {
        const resetState = createOpsAlertsState(today, clinicId);
        try {
            localStorage.setItem(storageKey, JSON.stringify(resetState));
        } catch (_storageError) {
            // ignore storage write failures
        }
        return resetState;
    }
}

function persistOpsAlertsState(
    storageKey,
    getTodayLocalIsoDate,
    getActiveQueueOpsClinicId,
    nextState
) {
    opsAlertsState = normalizeOpsAlertsState(
        nextState,
        getTodayLocalIsoDate(),
        getActiveClinicId(getActiveQueueOpsClinicId)
    );
    try {
        localStorage.setItem(storageKey, JSON.stringify(opsAlertsState));
    } catch (_error) {
        // ignore storage write failures
    }
    return opsAlertsState;
}

export function ensureOpsAlertsState(
    storageKey,
    getTodayLocalIsoDate,
    getActiveQueueOpsClinicId
) {
    const today = getTodayLocalIsoDate();
    const clinicId = getActiveClinicId(getActiveQueueOpsClinicId);
    if (
        !opsAlertsState ||
        opsAlertsState.date !== today ||
        opsAlertsState.clinicId !== clinicId
    ) {
        opsAlertsState = loadOpsAlertsState(
            storageKey,
            getTodayLocalIsoDate,
            getActiveQueueOpsClinicId
        );
    }
    return opsAlertsState;
}

export function setOpsAlertReviewed(
    storageKey,
    getTodayLocalIsoDate,
    getActiveQueueOpsClinicId,
    alertId,
    reviewed
) {
    const current = ensureOpsAlertsState(
        storageKey,
        getTodayLocalIsoDate,
        getActiveQueueOpsClinicId
    );
    const nextReviewed = {
        ...current.reviewed,
    };
    if (reviewed) {
        nextReviewed[String(alertId)] = {
            reviewedAt: new Date().toISOString(),
        };
    } else {
        delete nextReviewed[String(alertId)];
    }
    return persistOpsAlertsState(
        storageKey,
        getTodayLocalIsoDate,
        getActiveQueueOpsClinicId,
        {
            ...current,
            reviewed: nextReviewed,
        }
    );
}

export function markOpsAlertsReviewed(
    storageKey,
    getTodayLocalIsoDate,
    getActiveQueueOpsClinicId,
    alertIds
) {
    const validIds = Array.isArray(alertIds)
        ? alertIds
              .map((alertId) => String(alertId || '').trim())
              .filter(Boolean)
        : [];
    if (!validIds.length) {
        return ensureOpsAlertsState(
            storageKey,
            getTodayLocalIsoDate,
            getActiveQueueOpsClinicId
        );
    }

    const current = ensureOpsAlertsState(
        storageKey,
        getTodayLocalIsoDate,
        getActiveQueueOpsClinicId
    );
    const nextReviewed = { ...current.reviewed };
    const reviewedAt = new Date().toISOString();
    validIds.forEach((alertId) => {
        nextReviewed[alertId] = { reviewedAt };
    });

    return persistOpsAlertsState(
        storageKey,
        getTodayLocalIsoDate,
        getActiveQueueOpsClinicId,
        {
            ...current,
            reviewed: nextReviewed,
        }
    );
}

function normalizeOpsFocusMode(rawValue) {
    const value = String(rawValue || 'auto')
        .trim()
        .toLowerCase();
    return value === 'opening' ||
        value === 'operations' ||
        value === 'incidents' ||
        value === 'closing'
        ? value
        : 'auto';
}

function loadOpsFocusMode(storageKey, getActiveQueueOpsClinicId) {
    const clinicId = getActiveClinicId(getActiveQueueOpsClinicId);
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) {
            return 'auto';
        }
        const parsed = JSON.parse(raw);
        const parsedClinicId = String(parsed?.clinicId || '').trim();
        if (parsedClinicId && parsedClinicId !== clinicId) {
            const fallbackMode = 'auto';
            localStorage.setItem(
                storageKey,
                JSON.stringify({ clinicId, mode: fallbackMode })
            );
            return fallbackMode;
        }
        const safeMode = normalizeOpsFocusMode(parsed?.mode);
        if (parsedClinicId !== clinicId || safeMode !== parsed?.mode) {
            localStorage.setItem(
                storageKey,
                JSON.stringify({ clinicId, mode: safeMode })
            );
        }
        return safeMode;
    } catch (_error) {
        try {
            const legacyValue = localStorage.getItem(storageKey);
            if (legacyValue) {
                const safeMode = normalizeOpsFocusMode(legacyValue);
                localStorage.setItem(
                    storageKey,
                    JSON.stringify({ clinicId, mode: safeMode })
                );
                return safeMode;
            }
        } catch (_nestedError) {
            // ignore storage recovery failures
        }
        return 'auto';
    }
}

export function ensureOpsFocusMode(storageKey, getActiveQueueOpsClinicId) {
    const clinicId = getActiveClinicId(getActiveQueueOpsClinicId);
    if (!opsFocusMode || opsFocusModeClinicId !== clinicId) {
        opsFocusMode = loadOpsFocusMode(storageKey, getActiveQueueOpsClinicId);
        opsFocusModeClinicId = clinicId;
    }
    return opsFocusMode;
}

export function persistOpsFocusMode(
    storageKey,
    nextMode,
    getActiveQueueOpsClinicId
) {
    const clinicId = getActiveClinicId(getActiveQueueOpsClinicId);
    opsFocusMode = normalizeOpsFocusMode(nextMode);
    opsFocusModeClinicId = clinicId;
    try {
        localStorage.setItem(
            storageKey,
            JSON.stringify({
                clinicId,
                mode: opsFocusMode,
            })
        );
    } catch (_error) {
        // ignore storage write failures
    }
    return opsFocusMode;
}
