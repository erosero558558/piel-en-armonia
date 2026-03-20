const STORAGE_KEY = 'turnero-release-diagnostic-session-registry:v1';
const MEMORY_STORAGE = new Map();

function getStorage() {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (_error) {
        return null;
    }
}

function readAll() {
    const storage = getStorage();
    if (storage) {
        try {
            return JSON.parse(storage.getItem(STORAGE_KEY) || '{}');
        } catch (_error) {
            return {};
        }
    }

    return MEMORY_STORAGE.get(STORAGE_KEY) || {};
}

function writeAll(data) {
    const storage = getStorage();
    if (storage) {
        storage.setItem(STORAGE_KEY, JSON.stringify(data));
        return;
    }

    MEMORY_STORAGE.set(STORAGE_KEY, data);
}

function normalizeEntry(entry = {}, scope = 'global') {
    const now = new Date().toISOString();
    const currentScope =
        String(entry.scope || scope || 'global').trim() || 'global';

    return {
        id: String(entry.id || `diag-session-${Date.now()}`),
        status: String(entry.status || 'prepared').trim() || 'prepared',
        operator: String(entry.operator || 'program').trim() || 'program',
        note: String(entry.note || '').trim(),
        scope: currentScope,
        createdAt: String(entry.createdAt || now).trim() || now,
        updatedAt: String(entry.updatedAt || now).trim() || now,
    };
}

export function createTurneroReleaseDiagnosticSessionRegistry(
    scope = 'global'
) {
    const scopeKey = String(scope || 'global').trim() || 'global';

    return {
        get() {
            const data = readAll();
            const entry = data[scopeKey];
            return entry && typeof entry === 'object' ? { ...entry } : null;
        },
        set(entry = {}) {
            const data = readAll();
            const current =
                data[scopeKey] && typeof data[scopeKey] === 'object'
                    ? data[scopeKey]
                    : {};
            const next = normalizeEntry(
                {
                    ...current,
                    ...entry,
                    id: entry.id || current.id,
                    createdAt: current.createdAt || entry.createdAt,
                    updatedAt: new Date().toISOString(),
                    scope: scopeKey,
                },
                scopeKey
            );

            data[scopeKey] = next;
            writeAll(data);
            return { ...next };
        },
        clear() {
            const data = readAll();
            delete data[scopeKey];
            writeAll(data);
        },
    };
}
