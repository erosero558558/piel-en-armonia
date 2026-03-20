import { toText } from './turnero-release-control-center.js';

const STORAGE_KEY = 'turnero-release-human-review-disagreement-ledger:v1';
const MEMORY_STORAGE = new Map();

function getStorage() {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (_error) {
        return null;
    }
}

function safeParse(value, fallback = {}) {
    if (!value) {
        return fallback;
    }

    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed
            : fallback;
    } catch (_error) {
        return fallback;
    }
}

function safeStringify(value) {
    try {
        return JSON.stringify(
            value && typeof value === 'object' ? value : {},
            null,
            2
        );
    } catch (_error) {
        return '{}';
    }
}

function readAll() {
    const storage = getStorage();
    if (storage) {
        try {
            return safeParse(storage.getItem(STORAGE_KEY) || '', {});
        } catch (_error) {
            return safeParse(
                safeStringify(MEMORY_STORAGE.get(STORAGE_KEY) || {}),
                {}
            );
        }
    }

    return safeParse(safeStringify(MEMORY_STORAGE.get(STORAGE_KEY) || {}), {});
}

function writeAll(data) {
    const snapshot = safeParse(safeStringify(data), {});
    MEMORY_STORAGE.set(STORAGE_KEY, snapshot);

    const storage = getStorage();
    if (storage) {
        try {
            storage.setItem(STORAGE_KEY, safeStringify(snapshot));
        } catch (_error) {
            // Fall back to the in-memory snapshot.
        }
    }
}

function cloneRows(rows) {
    return Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [];
}

function normalizeEntry(entry = {}) {
    const nowIso = new Date().toISOString();
    return {
        id: toText(entry.id, `disagreement-${Date.now()}`),
        reviewer: toText(entry.reviewer, 'reviewer'),
        key: toText(entry.key, ''),
        severity: toText(entry.severity, 'medium'),
        note: toText(entry.note, ''),
        status: toText(entry.status, 'open'),
        createdAt: toText(entry.createdAt, nowIso),
    };
}

export function createTurneroReleaseHumanReviewDisagreementLedger(
    scope = 'global'
) {
    const scopeKey = toText(scope, 'global') || 'global';

    return {
        scope: scopeKey,
        list() {
            const data = readAll();
            return cloneRows(
                Array.isArray(data[scopeKey]) ? data[scopeKey] : []
            );
        },
        add(entry = {}) {
            const data = readAll();
            const rows = Array.isArray(data[scopeKey]) ? data[scopeKey] : [];
            const next = normalizeEntry(entry);

            data[scopeKey] = [next, ...rows].slice(0, 150);
            writeAll(data);
            return { ...next };
        },
        clear() {
            const data = readAll();
            if (Object.prototype.hasOwnProperty.call(data, scopeKey)) {
                delete data[scopeKey];
            }
            writeAll(data);
        },
    };
}

export default createTurneroReleaseHumanReviewDisagreementLedger;
