const STORAGE_KEY = 'turnero-release-provenance-ledger:v1';

function getStorage() {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (_error) {
        return null;
    }
}

function readAll() {
    const storage = getStorage();
    if (!storage) {
        return {};
    }

    try {
        return JSON.parse(storage.getItem(STORAGE_KEY) || '{}');
    } catch (_error) {
        return {};
    }
}

function writeAll(data) {
    const storage = getStorage();
    if (!storage) {
        return;
    }

    storage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function createTurneroReleaseProvenanceLedger(scope = 'global') {
    return {
        list() {
            const data = readAll();
            return Array.isArray(data[scope]) ? data[scope] : [];
        },
        add(entry = {}) {
            const data = readAll();
            const rows = Array.isArray(data[scope]) ? data[scope] : [];
            const next = {
                id: entry.id || `prov-${Date.now()}`,
                moduleKey: entry.moduleKey || '',
                commitRef: entry.commitRef || '',
                note: entry.note || '',
                owner: entry.owner || 'program',
                createdAt: entry.createdAt || new Date().toISOString(),
            };
            data[scope] = [next, ...rows].slice(0, 300);
            writeAll(data);
            return next;
        },
        clear() {
            const data = readAll();
            delete data[scope];
            writeAll(data);
        },
    };
}
