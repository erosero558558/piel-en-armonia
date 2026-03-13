const VALID_MODES = new Set(['opening', 'operations', 'incidents', 'closing']);
let opsPlaybookState = null;

function getActiveClinicId(getActiveQueueOpsClinicId) {
    return (
        String(
            typeof getActiveQueueOpsClinicId === 'function'
                ? getActiveQueueOpsClinicId()
                : ''
        ).trim() || 'default-clinic'
    );
}

export function createOpsPlaybookState(date, clinicId) {
    return {
        date,
        clinicId,
        modes: {
            opening: {},
            operations: {},
            incidents: {},
            closing: {},
        },
    };
}

export function normalizeOpsPlaybookState(rawState, deps) {
    const { getTodayLocalIsoDate, getActiveQueueOpsClinicId } = deps;
    const today = getTodayLocalIsoDate();
    const clinicId = getActiveClinicId(getActiveQueueOpsClinicId);
    const source = rawState && typeof rawState === 'object' ? rawState : {};
    const safeModes =
        source.modes && typeof source.modes === 'object' ? source.modes : {};
    const sameClinic = String(source.clinicId || '').trim() === clinicId;
    const sameDate = String(source.date || '').trim() === today;
    return {
        date: today,
        clinicId,
        modes: {
            opening:
                sameClinic &&
                sameDate &&
                safeModes.opening &&
                typeof safeModes.opening === 'object'
                    ? { ...safeModes.opening }
                    : {},
            operations:
                sameClinic &&
                sameDate &&
                safeModes.operations &&
                typeof safeModes.operations === 'object'
                    ? { ...safeModes.operations }
                    : {},
            incidents:
                sameClinic &&
                sameDate &&
                safeModes.incidents &&
                typeof safeModes.incidents === 'object'
                    ? { ...safeModes.incidents }
                    : {},
            closing:
                sameClinic &&
                sameDate &&
                safeModes.closing &&
                typeof safeModes.closing === 'object'
                    ? { ...safeModes.closing }
                    : {},
        },
    };
}

export function loadOpsPlaybookState(deps) {
    const { getTodayLocalIsoDate, getActiveQueueOpsClinicId, storageKey } =
        deps;
    const today = getTodayLocalIsoDate();
    const clinicId = getActiveClinicId(getActiveQueueOpsClinicId);
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) {
            return createOpsPlaybookState(today, clinicId);
        }
        const parsed = JSON.parse(raw);
        if (
            String(parsed?.date || '').trim() !== today ||
            String(parsed?.clinicId || '').trim() !== clinicId
        ) {
            const resetState = createOpsPlaybookState(today, clinicId);
            localStorage.setItem(storageKey, JSON.stringify(resetState));
            return resetState;
        }
        return normalizeOpsPlaybookState(parsed, deps);
    } catch (_error) {
        const resetState = createOpsPlaybookState(today, clinicId);
        try {
            localStorage.setItem(storageKey, JSON.stringify(resetState));
        } catch (_storageError) {
            // ignore storage write failures
        }
        return resetState;
    }
}

export function persistOpsPlaybookState(nextState, deps) {
    const { storageKey } = deps;
    opsPlaybookState = normalizeOpsPlaybookState(nextState, deps);
    try {
        localStorage.setItem(storageKey, JSON.stringify(opsPlaybookState));
    } catch (_error) {
        // ignore storage write failures
    }
    return opsPlaybookState;
}

export function ensureOpsPlaybookState(deps) {
    const { getTodayLocalIsoDate, getActiveQueueOpsClinicId } = deps;
    const today = getTodayLocalIsoDate();
    const clinicId = getActiveClinicId(getActiveQueueOpsClinicId);
    if (
        !opsPlaybookState ||
        opsPlaybookState.date !== today ||
        opsPlaybookState.clinicId !== clinicId
    ) {
        opsPlaybookState = loadOpsPlaybookState(deps);
    }
    return opsPlaybookState;
}

export function setOpsPlaybookStep(mode, stepId, complete, deps) {
    const current = ensureOpsPlaybookState(deps);
    const safeMode = VALID_MODES.has(mode) ? mode : 'operations';
    return persistOpsPlaybookState(
        {
            ...current,
            modes: {
                ...current.modes,
                [safeMode]: {
                    ...(current.modes[safeMode] || {}),
                    [stepId]: Boolean(complete),
                },
            },
        },
        deps
    );
}

export function resetOpsPlaybookMode(mode, deps) {
    const current = ensureOpsPlaybookState(deps);
    const safeMode = VALID_MODES.has(mode) ? mode : 'operations';
    return persistOpsPlaybookState(
        {
            ...current,
            modes: {
                ...current.modes,
                [safeMode]: {},
            },
        },
        deps
    );
}
