function safeStorage() {
    try {
        if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
            return globalThis.localStorage;
        }
    } catch (_error) {
        // ignore
    }

    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            return window.localStorage;
        }
    } catch (_error) {
        // ignore
    }

    return null;
}

function normalizeKey(scope = 'default') {
    return `turnero-release-program-office:${scope}`;
}

function clone(value) {
    try {
        return JSON.parse(JSON.stringify(value ?? {}));
    } catch (_error) {
        return value && typeof value === 'object' ? { ...value } : {};
    }
}

function buildDefaultState(scope = 'default') {
    return {
        scope,
        presetId: 'stabilize-core',
        notes: '',
        overrides: {},
        trafficLimitPercent: null,
        freeze: false,
        lastRunAt: null,
        updatedAt: null,
    };
}

function normalizeTrafficLimitPercent(value) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) {
        return null;
    }

    return Math.max(0, Math.min(100, Math.round(numberValue)));
}

function normalizeProgramOfficeState(scope = 'default', value = {}) {
    const source = value && typeof value === 'object' ? value : {};
    const presetId = String(source.presetId || 'stabilize-core').trim();
    const notes = typeof source.notes === 'string' ? source.notes : '';
    const overrides =
        source.overrides &&
        typeof source.overrides === 'object' &&
        !Array.isArray(source.overrides)
            ? source.overrides
            : {};

    return {
        scope,
        presetId: presetId || 'stabilize-core',
        notes,
        overrides,
        trafficLimitPercent: normalizeTrafficLimitPercent(
            source.trafficLimitPercent
        ),
        freeze: source.freeze === true,
        lastRunAt:
            typeof source.lastRunAt === 'string' && source.lastRunAt.trim()
                ? source.lastRunAt.trim()
                : null,
        updatedAt:
            typeof source.updatedAt === 'string' && source.updatedAt.trim()
                ? source.updatedAt.trim()
                : null,
    };
}

export function readProgramOfficeState(scope = 'default') {
    const storage = safeStorage();
    if (!storage) {
        return buildDefaultState(scope);
    }

    try {
        const raw = storage.getItem(normalizeKey(scope));
        if (!raw) {
            return buildDefaultState(scope);
        }

        const parsed = JSON.parse(raw);
        return normalizeProgramOfficeState(scope, parsed);
    } catch (_error) {
        return buildDefaultState(scope);
    }
}

export function writeProgramOfficeState(scope = 'default', patch = {}) {
    const storage = safeStorage();
    const current = readProgramOfficeState(scope);
    const now = new Date().toISOString();
    const next = normalizeProgramOfficeState(scope, {
        ...current,
        ...clone(patch),
        scope,
        updatedAt: now,
        lastRunAt: now,
    });

    if (storage) {
        try {
            storage.setItem(normalizeKey(scope), JSON.stringify(next));
        } catch (_error) {
            // ignore write failures in non-persistent modes
        }
    }

    return next;
}

export function resetProgramOfficeState(scope = 'default') {
    const storage = safeStorage();
    if (storage) {
        try {
            storage.removeItem(normalizeKey(scope));
        } catch (_error) {
            // ignore remove failures in non-persistent modes
        }
    }

    return readProgramOfficeState(scope);
}
