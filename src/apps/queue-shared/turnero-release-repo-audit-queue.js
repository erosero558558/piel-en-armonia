const STORAGE_KEY = 'turnero-release-repo-audit-queue:v1';
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

function normalizeAuditQueueEntry(
    entry = {},
    scope = 'global',
    fallbackIndex = 0
) {
    const now = new Date().toISOString();
    const currentScope =
        String(entry.scope || scope || 'global').trim() || 'global';
    const id = String(
        entry.id || `audit-queue-${Date.now()}-${fallbackIndex + 1}`
    ).trim();

    return {
        id,
        scope: currentScope,
        title:
            String(entry.title || 'Repo audit task').trim() ||
            'Repo audit task',
        owner: String(entry.owner || 'program').trim() || 'program',
        status:
            String(entry.status || 'queued')
                .trim()
                .toLowerCase() || 'queued',
        area: String(entry.area || 'repo').trim() || 'repo',
        note: String(entry.note || '').trim(),
        createdAt: String(entry.createdAt || now).trim() || now,
        updatedAt: String(entry.updatedAt || now).trim() || now,
    };
}

export function createTurneroReleaseRepoAuditQueue(scope = 'global') {
    const scopeKey = String(scope || 'global').trim() || 'global';

    return {
        list() {
            const data = readAll();
            return Array.isArray(data[scopeKey])
                ? data[scopeKey].map((entry) => ({ ...entry }))
                : [];
        },
        add(entry = {}) {
            const data = readAll();
            const rows = Array.isArray(data[scopeKey]) ? data[scopeKey] : [];
            const next = normalizeAuditQueueEntry(entry, scopeKey, rows.length);

            data[scopeKey] = [next, ...rows].slice(0, 200);
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
