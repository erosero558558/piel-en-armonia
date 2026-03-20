import { toText } from './turnero-release-control-center.js';

const STORAGE_KEY = 'turnero-release-diagnostic-evidence-lock:v1';
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

export function createTurneroReleaseDiagnosticEvidenceLock(scope = 'global') {
    const scopeKey = toText(scope, 'global');

    return {
        get() {
            const data = readAll();
            return data[scopeKey] || null;
        },
        set(lock = {}) {
            const data = readAll();
            data[scopeKey] = {
                id: lock.id || `lock-${Date.now()}`,
                status: lock.status || 'locked',
                note: lock.note || '',
                createdAt: lock.createdAt || new Date().toISOString(),
            };
            writeAll(data);
            return data[scopeKey];
        },
        clear() {
            const data = readAll();
            delete data[scopeKey];
            writeAll(data);
        },
    };
}

export default createTurneroReleaseDiagnosticEvidenceLock;
